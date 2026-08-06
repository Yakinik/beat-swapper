// 曲頭・曲尾の取りこぼしを埋める。
//
// RhythmExtractor2013 は曲の最初の一撃を拾いそこねることがある。実測例では、音が
// 0.069 秒から鳴り始めているのに最初の tick が 0.708 秒（拍間隔 0.662 秒）で、
// ちょうど 1 拍分が欠けていた。こうなると 1 拍目がグリッド上に存在せず、位相を
// どれに選んでも指定できないし、その手前は再生からも落ちる。
//
// 周辺の拍間隔から外挿して前後を埋める。埋める量は前後それぞれ 4 拍までに抑える
// （1 小節の拍数を切り替えても意味が変わらないよう、小節ではなく拍で数える）。
// 既に足りている曲には何も足さない。

/** 前後に補う最大の拍数 */
const PADDING_BEATS = 4

/** 手入力で受け付けるテンポの範囲 */
export const MIN_BPM = 20
export const MAX_BPM = 400

/** 開始位置を音源より手前へどこまで置けるか [s] */
const MAX_LEAD_IN = 60

/**
 * BPM と開始位置から等間隔の拍列を作る。
 *
 * 検出した拍位置はテンポ揺れに追従できる反面、テンポを半分・倍に取り違えたり
 * グリッドごとずれたりすると手直しできない。BPM か開始位置を手で触ったときは、
 * 検出結果を捨ててこちらへ切り替える。
 */
export function makeUniformTicks(
  startSeconds: number,
  bpm: number,
  duration: number,
): Float32Array {
  const beat = 60 / Math.min(Math.max(bpm, MIN_BPM), MAX_BPM)
  const from = Math.max(startSeconds, -MAX_LEAD_IN)
  const count = Math.max(2, Math.floor((Math.max(duration, 0) - from) / beat) + 1)
  const ticks = new Float32Array(count)
  for (let i = 0; i < count; i += 1) ticks[i] = from + i * beat
  return ticks
}

/** 拍間隔を測るのに使う拍数 */
const SAMPLE_BEATS = 8

/** [from, to] の範囲の拍間隔の中央値。テンポ揺れや検出漏れに引きずられにくい。 */
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
 * @param duration 音源の長さ [s]。末尾を音源の外へはみ出させないために使う。
 */
export function extendBeatGrid(
  ticks: Float32Array,
  duration: number,
  paddingBeats = PADDING_BEATS,
): Float32Array {
  if (ticks.length < 2) return ticks
  const limit = Math.max(0, paddingBeats)
  if (limit === 0) return ticks

  const headInterval = medianInterval(ticks, 0, Math.min(SAMPLE_BEATS, ticks.length - 1))
  const before: number[] = []
  if (headInterval > 0) {
    let at = (ticks[0] ?? 0) - headInterval
    while (at >= 0 && before.length < limit) {
      before.unshift(at)
      at -= headInterval
    }
  }

  const tailFrom = Math.max(0, ticks.length - 1 - SAMPLE_BEATS)
  const tailInterval = medianInterval(ticks, tailFrom, ticks.length - 1)
  const after: number[] = []
  if (tailInterval > 0) {
    let at = (ticks[ticks.length - 1] ?? 0) + tailInterval
    while (at <= duration && after.length < limit) {
      after.push(at)
      at += tailInterval
    }
  }

  if (before.length === 0 && after.length === 0) return ticks

  const extended = new Float32Array(before.length + ticks.length + after.length)
  extended.set(before, 0)
  extended.set(ticks, before.length)
  extended.set(after, before.length + ticks.length)
  return extended
}
