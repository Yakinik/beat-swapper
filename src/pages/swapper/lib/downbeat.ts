import type { BeatFeatures, BeatsPerBar } from './beat-analysis'

// 「どの拍が 1 拍目か」を決める。
//
// Essentia の Meter アルゴリズムは公式ドキュメントでも experimental・not evaluated と
// されていて、これに頼るのは危うい。ここでは拍ごとの特徴量から位相を選ぶだけの素朴な
// ヒューリスティックにしている。外したときは UI の「小節の頭」と拡大波形のクリックで
// 直せる、という前提の設計。
//
//   低域が強い拍       … キックとベースの入れ替わりは 1 拍目に来やすい
//   立ち上がりが強い拍 … 小節頭は音が変わるので鳴り出しが目立つ
//   高域が強い拍       … スネアは 2・4 拍目に置かれるので、1 拍目としては減点する

const LOW_WEIGHT = 1
const ONSET_WEIGHT = 0.6
const HIGH_WEIGHT = 0.6

/** 平均 0・分散 1 に揃える。全要素が同じ値なら 0 で埋める。 */
function standardize(values: Float32Array): Float32Array {
  const count = values.length
  if (count === 0) return values
  let sum = 0
  for (let i = 0; i < count; i += 1) sum += values[i] ?? 0
  const mean = sum / count

  let variance = 0
  for (let i = 0; i < count; i += 1) {
    const diff = (values[i] ?? 0) - mean
    variance += diff * diff
  }
  const deviation = Math.sqrt(variance / count)

  const result = new Float32Array(count)
  if (deviation === 0) return result
  for (let i = 0; i < count; i += 1) result[i] = ((values[i] ?? 0) - mean) / deviation
  return result
}

/** 位相ごとのスコア。大きいほど「そこが 1 拍目らしい」。要素数は beatsPerBar。 */
export function scoreDownbeatPhases(
  features: BeatFeatures,
  beatsPerBar: BeatsPerBar,
): number[] {
  const low = standardize(features.low)
  const onset = standardize(features.onset)
  const high = standardize(features.high)

  const sums = new Array<number>(beatsPerBar).fill(0)
  const counts = new Array<number>(beatsPerBar).fill(0)

  for (let i = 0; i < low.length; i += 1) {
    const phase = i % beatsPerBar
    sums[phase] =
      (sums[phase] ?? 0) +
      LOW_WEIGHT * (low[i] ?? 0) +
      ONSET_WEIGHT * (onset[i] ?? 0) -
      HIGH_WEIGHT * (high[i] ?? 0)
    counts[phase] = (counts[phase] ?? 0) + 1
  }

  return sums.map((sum, phase) => {
    const count = counts[phase] ?? 0
    return count === 0 ? 0 : sum / count
  })
}

/** 1 拍目とみなす位相を 0〜beatsPerBar-1 で返す。 */
export function estimateDownbeatPhase(
  features: BeatFeatures,
  beatsPerBar: BeatsPerBar,
): number {
  const scores = scoreDownbeatPhases(features, beatsPerBar)
  let best = 0
  for (let phase = 1; phase < scores.length; phase += 1) {
    if ((scores[phase] ?? 0) > (scores[best] ?? 0)) best = phase
  }
  return best
}
