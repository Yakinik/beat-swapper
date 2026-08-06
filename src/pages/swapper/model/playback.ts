import { computed, effect, signal } from '@preact/signals'

import { getAudioContext, resumeAudioContext } from '../lib/audio-context'
import { SlicePlayer } from '../lib/scheduler'
import { EMPTY_PLAN, type SlicePlan, buildSlicePlan, sliceIndexAt } from '../lib/slice-plan'
import { grid, startIndex } from './analysis'
import { beatsPerBar } from './bar-shape'
import { effectiveOrder } from './beat-order'
import { track } from './track'

export const playing = signal(false)
export const looping = signal(true)
export const volume = signal(0.9)
/** クリックノイズ対策のフェード長 [ms] */
export const fadeMs = signal(4)
/** 出力タイムライン上の再生位置 [s]。一時停止・停止のあいだも保持する。 */
export const playhead = signal(0)

export const plan = computed(() => {
  const current = grid.value
  if (!current) return EMPTY_PLAN
  return buildSlicePlan(current, startIndex.value, beatsPerBar.value, effectiveOrder.value)
})

/** 再生位置にあるスライス。波形のハイライトに使う（停止中も指す）。 */
export const activeSlice = computed(() => {
  const current = plan.value
  const index = sliceIndexAt(current, playhead.value)
  return index < 0 ? null : (current.slices[index] ?? null)
})

// AudioContext はユーザー操作より前に作らない。最初の再生で初期化し、以後は使い回す。
let player: SlicePlayer | null = null
/** プレイヤーへ渡してある計画。差し替えのとき再生位置を対応づけるのに使う。 */
let appliedPlan: SlicePlan = EMPTY_PLAN
let frame = 0

/** いまの再生位置。再生中はプレイヤーの時計が真、停止中は playhead が真。 */
const position = (): number =>
  playing.peek() && player ? player.outputTime : playhead.peek()

const getPlayer = (): SlicePlayer => {
  if (player) return player

  const created = new SlicePlayer(getAudioContext())
  created.onEnded = () => stop()
  created.setBuffer(track.peek()?.buffer ?? null)
  created.setPlan(appliedPlan)
  created.setVolume(volume.peek())
  created.setFadeSeconds(fadeMs.peek() / 1000)
  created.setLoop(looping.peek())
  player = created
  return created
}

const pump = () => {
  if (player) playhead.value = player.outputTime
  frame = requestAnimationFrame(pump)
}

const startPump = () => {
  if (frame === 0) frame = requestAnimationFrame(pump)
}

const stopPump = () => {
  if (frame !== 0) {
    cancelAnimationFrame(frame)
    frame = 0
  }
}

export async function play(): Promise<void> {
  if (plan.peek().slices.length === 0) return
  await resumeAudioContext()
  const current = getPlayer()
  current.play(playhead.peek())
  playing.value = true
  startPump()
}

/** 位置を保ったまま止める。 */
export function pause(): void {
  if (!playing.peek()) return
  const at = player?.outputTime ?? playhead.peek()
  player?.stop()
  stopPump()
  playhead.value = at
  playing.value = false
}

/** 止めて先頭へ戻す。 */
export function stop(): void {
  player?.stop()
  stopPump()
  playhead.value = 0
  playing.value = false
}

export function togglePlay(): void {
  if (playing.peek()) pause()
  else void play()
}

export function seekTo(outputTime: number): void {
  const limit = Math.max(0, plan.peek().duration - 0.05)
  const next = Math.min(Math.max(0, outputTime), limit)
  playhead.value = next
  if (playing.peek()) player?.play(next)
}

export function restart(): void {
  seekTo(0)
}

/**
 * 元音源の時刻から、そこを鳴らしているスライスへ移る。全体波形をクリックしたときの
 * 移動に使う。並べ替えで同じ場所が複数回鳴ることもあるので、最初に見つかったものへ。
 */
export function seekToSourceTime(sourceTime: number): void {
  const current = plan.peek()
  if (current.slices.length === 0) return

  let best = 0
  let smallest = Number.POSITIVE_INFINITY
  for (let i = 0; i < current.slices.length; i += 1) {
    const slice = current.slices[i]
    if (!slice) continue
    if (sourceTime >= slice.offset && sourceTime < slice.offset + slice.duration) {
      best = i
      break
    }
    const distance = Math.abs(slice.offset - sourceTime)
    if (distance < smallest) {
      smallest = distance
      best = i
    }
  }
  seekTo(current.slices[best]?.startAt ?? 0)
}

/** 出力タイムライン上で 1 拍（＝スライス 1 つ）動かす。 */
export function stepBeat(delta: number): void {
  const current = plan.peek()
  if (current.slices.length === 0) return
  const index = sliceIndexAt(current, position())
  const from = index < 0 ? current.slices.length - 1 : index
  const target = Math.min(Math.max(0, from + delta), current.slices.length - 1)
  seekTo(current.slices[target]?.startAt ?? 0)
}

/** 出力タイムライン上で 1 小節動かす。 */
export function stepBar(delta: number): void {
  const current = plan.peek()
  if (current.slices.length === 0) return
  const index = sliceIndexAt(current, position())
  const bar = index < 0 ? current.bars - 1 : (current.slices[index]?.bar ?? 0)
  const target = Math.min(Math.max(0, bar + delta), Math.max(0, current.bars - 1))
  seekTo(current.slices.find((slice) => slice.bar === target)?.startAt ?? 0)
}

/**
 * 計画が変わったとき、鳴っていた小節の同じ位置へ移す。並び順や小節の頭を触るたびに
 * 曲の先頭へ戻ってしまわないようにするため。
 */
function remapPosition(from: SlicePlan, to: SlicePlan, at: number): number {
  if (from.slices.length === 0 || to.slices.length === 0) return 0
  const index = sliceIndexAt(from, at)
  if (index < 0) return 0
  const source = from.slices[index]
  if (!source) return 0
  const target = to.slices.find((slice) => slice.bar >= source.bar)
  if (!target) return 0
  return target.startAt + Math.min(at - source.startAt, target.duration)
}

effect(() => {
  const next = plan.value
  const previous = appliedPlan
  appliedPlan = next
  if (!player) return

  const at = remapPosition(previous, next, position())
  playhead.value = at
  player.setPlan(next)
  if (playing.peek()) player.play(at)
})

effect(() => {
  const buffer = track.value?.buffer ?? null
  player?.setBuffer(buffer)
})

effect(() => {
  player?.setVolume(volume.value)
})

effect(() => {
  player?.setFadeSeconds(fadeMs.value / 1000)
})

effect(() => {
  player?.setLoop(looping.value)
})
