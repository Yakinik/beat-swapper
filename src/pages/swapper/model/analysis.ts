import { computed, effect, signal } from '@preact/signals'

import type { AnalysisStage, BeatAnalysis } from '../lib/beat-analysis'
import { MAX_BPM, MIN_BPM, makeUniformTicks } from '../lib/beat-grid'
import { estimateDownbeatPhase } from '../lib/downbeat'
import { gridTime, makeBeatGrid } from '../lib/slice-plan'
import { beatsPerBar } from './bar-shape'
import { track } from './track'

export const analysis = signal<BeatAnalysis | null>(null)
export const analysisStage = signal<AnalysisStage | null>(null)
export const analysisError = signal<string | null>(null)

/** 小節の頭を前後させられる拍数 */
export const BEAT_SHIFT_LIMIT = 3
/** 開始する小節を前後させられる小節数 */
export const BAR_SHIFT_LIMIT = 3

/** 自動推定した 1 拍目の位相（0〜拍数-1）。手動グリッドでは常に 0。 */
export const estimatedPhase = signal(0)
/** 小節の頭の手動調整（拍単位） */
export const beatShift = signal(0)
/** 開始する小節の手動調整（小節単位）。マイナスは音源より手前＝無音 */
export const barShift = signal(0)
/** ヒット音の検知ズレを緩和する時間補正 [ms] */
export const beatOffsetMs = signal(0)

// BPM か開始位置を手で触ると、検出した拍位置ではなく等間隔グリッドへ切り替わる。
// どちらも null のあいだは解析結果をそのまま使う。
const manualBpm = signal<number | null>(null)
const manualStartSeconds = signal<number | null>(null)

/** 等間隔グリッドを使っているか */
export const usingManualGrid = computed(() => manualBpm.value !== null)

const clamp = (value: number, limit: number) => Math.min(Math.max(value, -limit), limit)

/** 拍の長さ [s]。検出モードでは拍間隔の中央値なのでテンポ揺れに引きずられない。 */
export const beatSeconds = computed(() => {
  const manual = manualBpm.value
  if (manual !== null) return 60 / manual

  const ticks = analysis.value?.ticks
  if (!ticks || ticks.length < 2) return 0
  const gaps: number[] = []
  for (let i = 1; i < ticks.length; i += 1) {
    const gap = (ticks[i] ?? 0) - (ticks[i - 1] ?? 0)
    if (gap > 0) gaps.push(gap)
  }
  if (gaps.length === 0) return 0
  gaps.sort((a, b) => a - b)
  return gaps[gaps.length >> 1] ?? 0
})

/** 画面に出すテンポ。手動グリッドでは入力値。 */
export const effectiveBpm = computed(() => manualBpm.value ?? analysis.value?.bpm ?? 0)

/** 拍の調節スライダーの可動幅 [ms]。16 分音符 1 個分。 */
export const beatOffsetLimitMs = computed(() => Math.round((beatSeconds.value / 4) * 1000))

export const beatOffsetSeconds = computed(
  () => clamp(beatOffsetMs.value, beatOffsetLimitMs.value) / 1000,
)

export const grid = computed(() => {
  const result = analysis.value
  if (!result || result.ticks.length < 2) return null

  const bpm = manualBpm.value
  const start = manualStartSeconds.value
  const ticks =
    bpm === null || start === null
      ? result.ticks
      : makeUniformTicks(start, bpm, track.value?.buffer.duration ?? 0)

  return makeBeatGrid(ticks, beatOffsetSeconds.value)
})

/** 1 小節目の 1 拍目にあたるグリッド上のインデックス。負なら音源より手前。 */
export const startIndex = computed(
  () =>
    estimatedPhase.value +
    clamp(beatShift.value, BEAT_SHIFT_LIMIT) +
    clamp(barShift.value, BAR_SHIFT_LIMIT) * beatsPerBar.value,
)

/** 1 小節目の 1 拍目の時刻 [s]。負なら音源より手前。 */
export const startPositionSeconds = computed(() => {
  const current = grid.value
  return current ? gridTime(current, startIndex.value) : 0
})

export const adjusted = computed(
  () => beatShift.value !== 0 || barShift.value !== 0 || beatOffsetMs.value !== 0,
)

/** 小節の頭・開始する小節・拍の調節だけを初期値へ戻す。 */
export function resetAdjustments(): void {
  beatShift.value = 0
  barShift.value = 0
  beatOffsetMs.value = 0
}

/** BPM と開始位置を解析結果へ戻す（等間隔グリッドをやめる）。 */
export function resetDetection(): void {
  manualBpm.value = null
  manualStartSeconds.value = null
}

/** 表示している開始位置を保ったまま、等間隔グリッドの原点を決め直す。 */
const anchorStart = (startPosition: number, bpm: number): void => {
  manualStartSeconds.value =
    startPosition - startIndex.peek() * (60 / bpm) - beatOffsetSeconds.peek()
}

/** テンポを手で決める。開始位置は動かさない。 */
export function setBpm(bpm: number): void {
  if (!Number.isFinite(bpm)) return
  const next = Math.min(Math.max(bpm, MIN_BPM), MAX_BPM)
  const keep = startPositionSeconds.peek()
  manualBpm.value = next
  anchorStart(keep, next)
}

/** 1 小節目の 1 拍目の時刻を手で決める。テンポは動かさない。 */
export function setStartPositionMs(ms: number): void {
  if (!Number.isFinite(ms)) return
  const bpm = effectiveBpm.peek()
  if (bpm <= 0) return
  manualBpm.value = Math.min(Math.max(bpm, MIN_BPM), MAX_BPM)
  anchorStart(ms / 1000, manualBpm.peek() ?? bpm)
}

/** 拡大波形をクリックした拍が小節の頭になるよう、位相の調整量を決める。 */
export function setDownbeatFromTime(time: number): void {
  const current = grid.peek()
  if (!current || current.ticks.length === 0) return

  let nearest = 0
  let smallest = Number.POSITIVE_INFINITY
  for (let i = 0; i < current.ticks.length; i += 1) {
    const distance = Math.abs((current.ticks[i] ?? 0) - time)
    if (distance < smallest) {
      smallest = distance
      nearest = i
    }
  }

  // 小節はグリッド上で beatsPerBar 拍ごとに繰り返すので、位相を合わせれば足りる。
  // 表示上の増減が小さく見えるよう、絶対値の小さい代表値を選ぶ。
  const beats = beatsPerBar.peek()
  const difference = nearest - estimatedPhase.peek()
  let shift = ((difference % beats) + beats) % beats
  if (shift > beats / 2) shift -= beats
  beatShift.value = clamp(shift, BEAT_SHIFT_LIMIT)
}

// 拍数を切り替えたら位相を推定し直す。特徴量は拍ごとなので解析はやり直さない。
// 等間隔グリッドでは特徴量と拍が対応しないので、開始位置がそのまま 1 拍目になる。
effect(() => {
  const result = analysis.value
  const beats = beatsPerBar.value
  const manual = manualBpm.value !== null
  estimatedPhase.value = !manual && result ? estimateDownbeatPhase(result.features, beats) : 0
})

// テンポが変わると拍の調節の可動幅も変わる。範囲外に取り残さない。
effect(() => {
  const limit = beatOffsetLimitMs.value
  if (Math.abs(beatOffsetMs.peek()) > limit) beatOffsetMs.value = clamp(beatOffsetMs.peek(), limit)
})
