import { BEATS_PER_BAR } from './beat-analysis'

// 拍の並べ替え計画。ticks（各拍の時刻）と 1 拍目の位相と並び順から、
// 「元バッファのどこを・どれだけ・出力のどの位置で鳴らすか」を並べた配列を作る。
//
// 並び順は 1〜4 の数字列で、重複と省略を許す。`2431` なら小節の長さは変わらないが、
// `1133` や `124` では出力側の小節長が元と変わる。そのため各スライスに出力タイム
// ライン上の開始位置 startAt を持たせ、再生位置の逆引きに使う。

export interface BeatSlice {
  /** 元バッファ内の開始位置 [s] */
  offset: number
  /** 鳴らす長さ [s] */
  duration: number
  /** 出力タイムライン上の開始位置 [s] */
  startAt: number
  /** 元の小節内での拍番号（1〜4） */
  beat: number
  /** 何小節目か（0 始まり） */
  bar: number
}

export interface SlicePlan {
  slices: BeatSlice[]
  /** 並べ替え後の全体の長さ [s] */
  duration: number
  /** 元の小節数 */
  bars: number
}

export const EMPTY_PLAN: SlicePlan = { slices: [], duration: 0, bars: 0 }

/**
 * @param ticks 各拍の時刻 [s]（昇順）
 * @param phase 1 拍目とみなす位相（0〜3）
 * @param order 1〜4 の数字列。重複・省略あり
 */
export function buildSlicePlan(
  ticks: Float32Array,
  phase: number,
  order: readonly number[],
): SlicePlan {
  if (ticks.length < BEATS_PER_BAR + 1 || order.length === 0) return EMPTY_PLAN

  const slices: BeatSlice[] = []
  let startAt = 0
  let bar = 0

  // 4 拍を切り出すには次の小節の頭を含めた 5 本の境界が要る。
  for (let i = phase; i + BEATS_PER_BAR < ticks.length; i += BEATS_PER_BAR) {
    for (const beat of order) {
      const from = ticks[i + beat - 1]
      const to = ticks[i + beat]
      if (from === undefined || to === undefined) continue
      const duration = to - from
      if (duration <= 0) continue

      slices.push({ offset: from, duration, startAt, beat, bar })
      startAt += duration
    }
    bar += 1
  }

  return { slices, duration: startAt, bars: bar }
}

/** 指定した小節が元音源のどこにあたるか。範囲外なら null。 */
export function barRange(
  ticks: Float32Array,
  phase: number,
  bar: number,
): { from: number; to: number } | null {
  const head = phase + bar * BEATS_PER_BAR
  const from = ticks[head]
  const to = ticks[head + BEATS_PER_BAR]
  if (from === undefined || to === undefined) return null
  return { from, to }
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
