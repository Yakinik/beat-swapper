import { computed, effect, signal } from '@preact/signals'

import { getAudioContext, resumeAudioContext } from '../lib/audio-context'
import { SlicePlayer } from '../lib/scheduler'
import { EMPTY_PLAN, buildSlicePlan, sliceIndexAt } from '../lib/slice-plan'
import { analysis, downbeatPhase } from './analysis'
import { effectiveOrder } from './beat-order'
import { track } from './track'

export const playing = signal(false)
export const looping = signal(true)
export const volume = signal(0.9)
/** クリックノイズ対策のフェード長 [ms] */
export const fadeMs = signal(4)
/** 出力タイムライン上の再生位置 [s]。再生中は毎フレーム更新する。 */
export const outputPosition = signal(0)

export const plan = computed(() => {
  const result = analysis.value
  if (!result || result.ticks.length === 0) return EMPTY_PLAN
  return buildSlicePlan(result.ticks, downbeatPhase.value, effectiveOrder.value)
})

/** いま鳴っているスライス。波形のハイライトに使う。 */
export const activeSlice = computed(() => {
  if (!playing.value) return null
  const current = plan.value
  const index = sliceIndexAt(current, outputPosition.value)
  return index < 0 ? null : (current.slices[index] ?? null)
})

// AudioContext はユーザー操作より前に作らない（作っても suspended になるだけだが、
// 不要なうちは触らないでおく）。最初の再生で初期化し、以後は使い回す。
let player: SlicePlayer | null = null

const getPlayer = (): SlicePlayer => {
  if (player) return player

  const created = new SlicePlayer(getAudioContext())
  created.onEnded = () => stop()
  created.setBuffer(track.peek()?.buffer ?? null)
  created.setPlan(plan.peek())
  created.setVolume(volume.peek())
  created.setFadeSeconds(fadeMs.peek() / 1000)
  created.setLoop(looping.peek())
  player = created
  return created
}

let frame = 0

const pumpPosition = () => {
  if (!player) return
  outputPosition.value = player.outputTime
  frame = requestAnimationFrame(pumpPosition)
}

export function stop(): void {
  player?.stop()
  if (frame !== 0) {
    cancelAnimationFrame(frame)
    frame = 0
  }
  outputPosition.value = 0
  playing.value = false
}

export async function play(): Promise<void> {
  if (plan.peek().slices.length === 0) return
  await resumeAudioContext()
  const current = getPlayer()
  current.play()
  playing.value = true
  if (frame === 0) frame = requestAnimationFrame(pumpPosition)
}

export function togglePlay(): void {
  if (playing.peek()) stop()
  else void play()
}

// 計画・音量・フェード・ループの変更をプレイヤーへ流す。プレイヤーがまだ無いときは
// getPlayer() の初期化がまとめて拾うので何もしない。
effect(() => {
  const next = plan.value
  player?.setPlan(next)
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
