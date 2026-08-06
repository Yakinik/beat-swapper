import { signal } from '@preact/signals'

import { analyzeBeats } from '../lib/analyzer-client'
import { decodeAudioFile, toAnalysisPcm } from '../lib/audio-source'
import { ANALYSIS_SAMPLE_RATE, BEATS_PER_BAR } from '../lib/beat-analysis'
import { estimateDownbeatPhase } from '../lib/downbeat'
import { computePeaks } from '../lib/waveform'
import {
  analysis,
  analysisError,
  analysisStage,
  downbeatPhase,
  estimatedPhase,
} from './analysis'
import { stop } from './playback'
import { track } from './track'

// ファイルを開いてから解析が終わるまでの一連の流れ。
// 途中で別のファイルを落とされたときに古い結果で上書きしないよう、世代番号で判定する。

export const busy = signal(false)

let generation = 0

export async function openFile(file: File): Promise<void> {
  const current = ++generation

  stop()
  track.value = null
  analysis.value = null
  analysisError.value = null
  analysisStage.value = 'decoding'
  busy.value = true

  try {
    const buffer = await decodeAudioFile(file)
    const pcm = await toAnalysisPcm(buffer)
    if (current !== generation) return

    // ワーカーへ transfer する前にピークを取る（transfer 後は pcm を触れない）。
    const peaks = computePeaks(pcm)
    track.value = { name: file.name, buffer, peaks }

    const result = await analyzeBeats(pcm, ANALYSIS_SAMPLE_RATE, (stage) => {
      if (current === generation) analysisStage.value = stage
    })
    if (current !== generation) return

    if (result.ticks.length < BEATS_PER_BAR + 1) {
      throw new Error('拍を検出できませんでした。テンポの分かりやすい曲で試してください')
    }

    const phase = estimateDownbeatPhase(result.features)
    estimatedPhase.value = phase
    downbeatPhase.value = phase
    analysis.value = result
    analysisStage.value = 'done'
  } catch (error) {
    if (current !== generation) return
    analysisError.value = error instanceof Error ? error.message : String(error)
    analysisStage.value = null
  } finally {
    if (current === generation) busy.value = false
  }
}
