import type { BeatFeatures } from './beat-analysis'

// 1 拍目の位相を推定するための特徴量を作る。解析ワーカーの中でだけ使う。
//
// 帯域信号を丸ごと配列に持つと 5 分の曲で数百MB になるので、サンプルを 1 回だけ
// 走査しながらフレーム単位（256 サンプル ≒ 5.8ms）の RMS に畳んでから拍へ集約する。

const HOP = 256

/** キック・ベースの帯域 */
const LOW_CUTOFF = 150
/** これ以上をスネア・ハイハットの帯域とみなす */
const HIGH_CUTOFF = 2000

/** 拍のエネルギーを測る窓の上限 [s]。実際は拍間隔の半分と短いほうを使う。 */
const BEAT_WINDOW = 0.15
/** 立ち上がりを測るときに比較する過去の位置 [s] */
const ONSET_LOOKBACK = 0.05

interface Biquad {
  b0: number
  b1: number
  b2: number
  a1: number
  a2: number
}

/** RBJ cookbook の 2 次ローパス（Q = 1/√2、バターワース特性）。 */
function lowpassCoefficients(sampleRate: number, cutoff: number): Biquad {
  const w0 = (2 * Math.PI * cutoff) / sampleRate
  const cosW0 = Math.cos(w0)
  const alpha = Math.sin(w0) / (2 * Math.SQRT1_2)
  const a0 = 1 + alpha
  const shared = (1 - cosW0) / 2 / a0
  return {
    b0: shared,
    b1: (1 - cosW0) / a0,
    b2: shared,
    a1: (-2 * cosW0) / a0,
    a2: (1 - alpha) / a0,
  }
}

export interface FrameBands {
  hop: number
  sampleRate: number
  /** フレームごとの低域 RMS */
  low: Float32Array
  /** フレームごとの高域 RMS */
  high: Float32Array
  /** フレームごとの全帯域 RMS */
  full: Float32Array
}

/**
 * PCM を 1 回だけ走査して、フレーム単位の帯域別 RMS を作る。
 * 低域は 150Hz ローパス、高域は 2kHz ローパスとの差分（= ハイパス）で取る。
 */
export function computeFrameBands(pcm: Float32Array, sampleRate: number): FrameBands {
  const lowFilter = lowpassCoefficients(sampleRate, LOW_CUTOFF)
  const highFilter = lowpassCoefficients(sampleRate, HIGH_CUTOFF)

  const frames = Math.max(1, Math.ceil(pcm.length / HOP))
  const low = new Float32Array(frames)
  const high = new Float32Array(frames)
  const full = new Float32Array(frames)

  let lx1 = 0
  let lx2 = 0
  let ly1 = 0
  let ly2 = 0
  let hx1 = 0
  let hx2 = 0
  let hy1 = 0
  let hy2 = 0

  let lowSum = 0
  let highSum = 0
  let fullSum = 0
  let taken = 0
  let frame = 0

  for (let i = 0; i < pcm.length; i += 1) {
    const x = pcm[i] ?? 0

    const lowSample =
      lowFilter.b0 * x +
      lowFilter.b1 * lx1 +
      lowFilter.b2 * lx2 -
      lowFilter.a1 * ly1 -
      lowFilter.a2 * ly2
    lx2 = lx1
    lx1 = x
    ly2 = ly1
    ly1 = lowSample

    const midSample =
      highFilter.b0 * x +
      highFilter.b1 * hx1 +
      highFilter.b2 * hx2 -
      highFilter.a1 * hy1 -
      highFilter.a2 * hy2
    hx2 = hx1
    hx1 = x
    hy2 = hy1
    hy1 = midSample
    const highSample = x - midSample

    lowSum += lowSample * lowSample
    highSum += highSample * highSample
    fullSum += x * x
    taken += 1

    if (taken === HOP) {
      low[frame] = Math.sqrt(lowSum / HOP)
      high[frame] = Math.sqrt(highSum / HOP)
      full[frame] = Math.sqrt(fullSum / HOP)
      frame += 1
      lowSum = 0
      highSum = 0
      fullSum = 0
      taken = 0
    }
  }

  if (taken > 0 && frame < frames) {
    low[frame] = Math.sqrt(lowSum / taken)
    high[frame] = Math.sqrt(highSum / taken)
    full[frame] = Math.sqrt(fullSum / taken)
  }

  return { hop: HOP, sampleRate, low, high, full }
}

const meanOfRange = (values: Float32Array, from: number, to: number): number => {
  if (to <= from) return 0
  let sum = 0
  for (let i = from; i < to; i += 1) sum += values[i] ?? 0
  return sum / (to - from)
}

/** 拍ごとに低域・高域エネルギーと立ち上がりの強さを求める。 */
export function computeBeatFeatures(bands: FrameBands, ticks: Float32Array): BeatFeatures {
  const count = ticks.length
  const low = new Float32Array(count)
  const high = new Float32Array(count)
  const onset = new Float32Array(count)

  const framesPerSecond = bands.sampleRate / bands.hop
  const lookbackFrames = Math.max(1, Math.round(ONSET_LOOKBACK * framesPerSecond))
  const totalFrames = bands.full.length

  for (let i = 0; i < count; i += 1) {
    const start = ticks[i] ?? 0
    const next = ticks[i + 1]
    const interval = next === undefined ? BEAT_WINDOW * 2 : next - start
    const window = Math.min(BEAT_WINDOW, Math.max(interval / 2, 0.02))

    const from = Math.min(totalFrames - 1, Math.max(0, Math.round(start * framesPerSecond)))
    const to = Math.min(totalFrames, Math.max(from + 1, Math.round((start + window) * framesPerSecond)))

    low[i] = meanOfRange(bands.low, from, to)
    high[i] = meanOfRange(bands.high, from, to)

    let rise = 0
    for (let f = from; f < to; f += 1) {
      const past = bands.full[Math.max(0, f - lookbackFrames)] ?? 0
      const diff = (bands.full[f] ?? 0) - past
      if (diff > rise) rise = diff
    }
    onset[i] = rise
  }

  return { low, high, onset }
}
