import type { BeatsPerBar } from './beat-analysis'

// 拍の並べ替え計画。
//
// 拍列を「番号のついた 1 本の連続したグリッド」として扱う。開始インデックスは負にも
// なれて、その場合は音源より手前を指す（スケジューラが無音として埋める）。位相を
// 0〜3 に閉じ込めていると `ticks[0]` より手前を小節の頭にできないため。
//
// 並び順は 1〜拍数 の数字列で、重複と省略を許す。`2431` なら小節の長さは変わらないが、
// `1133` や `124` では出力側の小節長が元と変わる。そのため各スライスに出力タイム
// ライン上の開始位置 startAt を持たせ、再生位置の逆引きに使う。

export interface BeatGrid {
  /** 調整済みの拍時刻 [s] */
  ticks: Float32Array
  /** 先頭より前を外挿するときの拍間隔 [s] */
  headInterval: number
  /** 末尾より後ろを外挿するときの拍間隔 [s] */
  tailInterval: number
}

/** 拍間隔を測るのに使う拍数 */
const SAMPLE_BEATS = 8

function medianInterval(ticks: Float32Array, from: number, to: number): number {
  const gaps: number[] = []
  for (let i = from + 1; i <= to; i += 1) {
    const gap = (ticks[i] ?? 0) - (ticks[i - 1] ?? 0)
    if (gap > 0) gaps.push(gap)
  }
  if (gaps.length === 0) return 0
  gaps.sort((a, b) => a - b)
  return gaps[gaps.length >> 1] ?? 0
}

/**
 * 解析結果の拍列から、時間軸を `offsetSeconds` だけずらしたグリッドを作る。
 * ずらし幅はヒット音の検知ズレを手で緩和するためのもので、全ての拍に等しくかかる
 * （＝スライスの長さは変わらない）。
 */
export function makeBeatGrid(ticks: Float32Array, offsetSeconds = 0): BeatGrid {
  const shifted = new Float32Array(ticks.length)
  for (let i = 0; i < ticks.length; i += 1) shifted[i] = (ticks[i] ?? 0) + offsetSeconds

  const headInterval = medianInterval(shifted, 0, Math.min(SAMPLE_BEATS, shifted.length - 1))
  const tailInterval = medianInterval(
    shifted,
    Math.max(0, shifted.length - 1 - SAMPLE_BEATS),
    shifted.length - 1,
  )
  return { ticks: shifted, headInterval, tailInterval }
}

/** グリッド上の拍の時刻。範囲外のインデックスは周辺の拍間隔で外挿する。 */
export function gridTime(grid: BeatGrid, index: number): number {
  const last = grid.ticks.length - 1
  if (last < 0) return 0
  if (index < 0) return (grid.ticks[0] ?? 0) + index * grid.headInterval
  if (index > last) return (grid.ticks[last] ?? 0) + (index - last) * grid.tailInterval
  return grid.ticks[index] ?? 0
}

export interface BeatSlice {
  /** 元バッファ内の開始位置 [s]。負なら音源より手前（無音） */
  offset: number
  /** 鳴らす長さ [s] */
  duration: number
  /** 出力タイムライン上の開始位置 [s] */
  startAt: number
  /** 元の小節内での拍番号（1 始まり） */
  beat: number
  /** 何小節目か（0 始まり） */
  bar: number
}

export interface SlicePlan {
  slices: BeatSlice[]
  /** 並べ替え後の全体の長さ [s] */
  duration: number
  /** 小節数 */
  bars: number
}

export const EMPTY_PLAN: SlicePlan = { slices: [], duration: 0, bars: 0 }

/**
 * @param startIndex 1 小節目の 1 拍目にあたるグリッド上のインデックス。負も取る
 * @param order 1〜beatsPerBar の数字列。重複・省略あり
 */
export function buildSlicePlan(
  grid: BeatGrid,
  startIndex: number,
  beatsPerBar: BeatsPerBar,
  order: readonly number[],
): SlicePlan {
  const last = grid.ticks.length - 1
  if (last < beatsPerBar || order.length === 0) return EMPTY_PLAN

  const slices: BeatSlice[] = []
  let startAt = 0
  let bar = 0

  // 4 拍を切り出すには次の小節の頭を含めた 5 本の境界が要る。末尾は外挿しない。
  for (let head = startIndex; head + beatsPerBar <= last; head += beatsPerBar) {
    for (const beat of order) {
      const from = gridTime(grid, head + beat - 1)
      const to = gridTime(grid, head + beat)
      const duration = to - from
      if (duration <= 0) continue

      slices.push({ offset: from, duration, startAt, beat, bar })
      startAt += duration
    }
    bar += 1
  }

  return { slices, duration: startAt, bars: bar }
}

/** 指定した小節が元音源のどこにあたるか。 */
export function barRange(
  grid: BeatGrid,
  startIndex: number,
  beatsPerBar: BeatsPerBar,
  bar: number,
): { from: number; to: number } {
  const head = startIndex + bar * beatsPerBar
  return { from: gridTime(grid, head), to: gridTime(grid, head + beatsPerBar) }
}

/**
 * 出力タイムライン上の時刻から、そのとき鳴っているスライスの位置を二分探索する。
 * 該当がなければ -1。
 */
export function sliceIndexAt(plan: SlicePlan, outputTime: number): number {
  const { slices } = plan
  if (slices.length === 0 || outputTime < 0 || outputTime >= plan.duration) return -1

  let low = 0
  let high = slices.length - 1
  while (low <= high) {
    const mid = (low + high) >> 1
    const slice = slices[mid]
    if (!slice) break
    if (outputTime < slice.startAt) high = mid - 1
    else if (outputTime >= slice.startAt + slice.duration) low = mid + 1
    else return mid
  }
  return -1
}
