// 解析ワーカーとメインスレッドの契約。型と定数だけを置く（実装は持たない）。

/** RhythmExtractor2013 は入力が 44.1kHz であることを前提にしている。 */
export const ANALYSIS_SAMPLE_RATE = 44100

/**
 * 1 小節の拍数。検出した拍列をどう区切るかの解釈でしかないので、解析はやり直さず
 * 切り替えられる。
 */
export type BeatsPerBar = 3 | 4

export const BEATS_PER_BAR_OPTIONS: readonly BeatsPerBar[] = [4, 3]

export const DEFAULT_BEATS_PER_BAR: BeatsPerBar = 4

export type AnalysisStage = 'decoding' | 'loading-engine' | 'tracking-beats' | 'done'

/**
 * 拍ごとの特徴量。1 拍目の位相を推定するために使う。
 * どれも要素数は ticks と同じ。
 */
export interface BeatFeatures {
  /** 150Hz 以下の帯域エネルギー（キック・ベース） */
  low: Float32Array
  /** 2kHz 以上の帯域エネルギー（スネア・ハイハット） */
  high: Float32Array
  /** 拍の直前からの音量の立ち上がり */
  onset: Float32Array
}

export interface BeatAnalysis {
  bpm: number
  /** 各拍の時刻 [s] */
  ticks: Float32Array
  /** 0〜1 ではなく 0〜5.32 のスケール（Essentia の仕様） */
  confidence: number
  features: BeatFeatures
}

export interface AnalyzerRequest {
  id: number
  /** 44.1kHz モノラルの PCM。transfer して渡す。 */
  pcm: Float32Array
  sampleRate: number
}

export type AnalyzerResponse =
  | { id: number; type: 'stage'; stage: AnalysisStage }
  | { id: number; type: 'result'; analysis: BeatAnalysis }
  | { id: number; type: 'error'; message: string }
