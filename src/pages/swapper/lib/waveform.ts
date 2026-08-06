import type { BeatsPerBar } from './beat-analysis'
import { type BeatGrid, gridTime } from './slice-plan'

// 波形と拍マーカーの描画。時間軸は元音源のタイムラインで、並べ替え後ではない。
//
// 全体表示だけだと 1 小節が数 px にしかならず、「どの拍が 1 拍目か」を目で確かめる
// ことも、クリックで直すこともできない。同じ描画関数に表示範囲を渡して、全体用と
// 拡大用の 2 枚を描き分けている。

/**
 * ピークの解像度。4〜5 分の曲で 1 列 8ms 前後になり、2 小節の拡大表示でも
 * 1px あたり 2 列は取れる。32768 個の float でも 128KB しかない。
 */
export const PEAK_COLUMNS = 32768

/** 各列の最大振幅を取る。波形表示にはこれだけあれば足りる。 */
export function computePeaks(pcm: Float32Array, columns = PEAK_COLUMNS): Float32Array {
  const result = new Float32Array(columns)
  if (pcm.length === 0) return result

  const perColumn = pcm.length / columns
  for (let column = 0; column < columns; column += 1) {
    const from = Math.floor(column * perColumn)
    const to = Math.min(pcm.length, Math.floor((column + 1) * perColumn))
    let peak = 0
    for (let i = from; i < to; i += 1) {
      const value = Math.abs(pcm[i] ?? 0)
      if (value > peak) peak = value
    }
    result[column] = peak
  }
  return result
}

export interface TimeRange {
  from: number
  to: number
}

export interface WaveformScene {
  peaks: Float32Array
  /** 元音源の長さ [s] */
  duration: number
  /** 描画する時間範囲 */
  view: TimeRange
  grid: BeatGrid | null
  /** 1 小節目の 1 拍目にあたるグリッド上のインデックス。負も取る */
  startIndex: number
  beatsPerBar: BeatsPerBar
  /** 再生中のスライスが指す元音源上の範囲。停止中は null */
  active: { offset: number; duration: number } | null
  /** 拍番号を描く（拡大表示のみ） */
  showBeatNumbers?: boolean
  /** 全体表示に重ねる、拡大表示が見ている範囲 */
  focus?: TimeRange | null
  /** 振幅の正規化を曲全体で揃えるか、表示範囲の中で取るか */
  normalize?: 'track' | 'view'
}

const readColor = (styles: CSSStyleDeclaration, name: string, fallback: string): string => {
  const value = styles.getPropertyValue(name).trim()
  return value === '' ? fallback : value
}

/** 拍マーカーを描くのに最低限必要な間隔 [デバイスピクセル] */
const MIN_BEAT_GAP = 6
const MIN_BAR_GAP = 10

export function drawWaveform(canvas: HTMLCanvasElement, scene: WaveformScene): void {
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.round(rect.width * dpr)
  const height = Math.round(rect.height * dpr)
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) return

  const styles = getComputedStyle(canvas)
  const waveColor = readColor(styles, '--line', '#d0d4dc')
  const accentColor = readColor(styles, '--accent', '#2f6df6')
  const mutedColor = readColor(styles, '--muted', '#6a7280')

  context.clearRect(0, 0, width, height)

  const { peaks, duration } = scene
  const span = scene.view.to - scene.view.from
  if (peaks.length === 0 || duration <= 0 || span <= 0) return

  const timeToX = (time: number) => ((time - scene.view.from) / span) * width
  const columnAt = (time: number) =>
    Math.min(peaks.length - 1, Math.max(0, Math.floor((time / duration) * peaks.length)))

  // 表示範囲の中で列の最大値を先に集めておく。正規化と描画で 2 度使う。
  const amplitudes = new Float32Array(width)
  for (let x = 0; x < width; x += 1) {
    const from = scene.view.from + (x / width) * span
    const to = scene.view.from + ((x + 1) / width) * span
    if (to < 0 || from > duration) continue
    const firstColumn = columnAt(from)
    const lastColumn = Math.max(firstColumn, columnAt(to))
    let peak = 0
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const value = peaks[column] ?? 0
      if (value > peak) peak = value
    }
    amplitudes[x] = peak
  }

  let loudest = 0
  if (scene.normalize === 'view') {
    for (let x = 0; x < width; x += 1) loudest = Math.max(loudest, amplitudes[x] ?? 0)
  } else {
    for (let i = 0; i < peaks.length; i += 1) loudest = Math.max(loudest, peaks[i] ?? 0)
  }
  const scale = loudest > 0.001 ? 1 / loudest : 1

  const centerY = height / 2
  const half = height / 2 - dpr * 2

  const activeFrom = scene.active ? timeToX(scene.active.offset) : Number.NaN
  const activeTo = scene.active ? timeToX(scene.active.offset + scene.active.duration) : Number.NaN

  for (let x = 0; x < width; x += 1) {
    const amplitude = Math.min(1, (amplitudes[x] ?? 0) * scale) * half
    if (amplitude === 0) continue
    context.fillStyle = x >= activeFrom && x < activeTo ? accentColor : waveColor
    context.fillRect(x, centerY - amplitude, 1, Math.max(dpr, amplitude * 2))
  }

  // 拡大表示が見ている範囲（全体表示にだけ描く）
  if (scene.focus) {
    const from = Math.max(0, timeToX(scene.focus.from))
    const to = Math.min(width, timeToX(scene.focus.to))
    if (to > from) {
      context.fillStyle = accentColor
      context.globalAlpha = 0.12
      context.fillRect(from, 0, Math.max(2 * dpr, to - from), height)
      context.globalAlpha = 1
    }
  }

  const { grid, beatsPerBar } = scene
  if (!grid || grid.ticks.length < 2) return

  const total = grid.ticks.length
  const secondsPerBeat = (gridTime(grid, total - 1) - gridTime(grid, 0)) / Math.max(1, total - 1)
  const beatGap = (secondsPerBeat / span) * width
  const showBeats = beatGap >= MIN_BEAT_GAP
  const showBars = beatGap * beatsPerBar >= MIN_BAR_GAP
  if (!showBars) return

  const barWidth = Math.max(1, Math.round(dpr))
  const labelSize = Math.round(11 * dpr)
  context.font = `600 ${labelSize}px system-ui, sans-serif`
  context.textAlign = 'left'
  context.textBaseline = 'top'

  // 開始インデックスが負なら、音源より手前の拍も番号どおりに描く
  for (let i = Math.min(0, scene.startIndex); i < total; i += 1) {
    const time = gridTime(grid, i)
    if (time < scene.view.from || time > scene.view.to) continue

    const relative = i - scene.startIndex
    const inBar = ((relative % beatsPerBar) + beatsPerBar) % beatsPerBar
    const isDownbeat = inBar === 0
    if (!isDownbeat && !showBeats) continue
    const x = Math.round(timeToX(time))

    if (isDownbeat) {
      context.fillStyle = accentColor
      context.globalAlpha = 0.8
      context.fillRect(x, 0, barWidth, height)
    } else {
      context.fillStyle = mutedColor
      context.globalAlpha = 0.35
      context.fillRect(x, height * 0.68, 1, height * 0.32)
    }
    context.globalAlpha = 1

    if (scene.showBeatNumbers && showBeats) {
      context.fillStyle = isDownbeat ? accentColor : mutedColor
      context.fillText(String(inBar + 1), x + 3 * dpr, 3 * dpr)
    }
  }
}
