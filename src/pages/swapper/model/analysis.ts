import { signal } from '@preact/signals'

import { BEATS_PER_BAR, type AnalysisStage, type BeatAnalysis } from '../lib/beat-analysis'

export const analysis = signal<BeatAnalysis | null>(null)
export const analysisStage = signal<AnalysisStage | null>(null)
export const analysisError = signal<string | null>(null)

/** 1 拍目とみなす位相（0〜3）。自動推定した値を初期値にして、手動で変えられる。 */
export const downbeatPhase = signal(0)
/** 自動推定の結果。手で動かしたあとに元へ戻せるように残しておく。 */
export const estimatedPhase = signal(0)

export function shiftDownbeat(delta: number): void {
  downbeatPhase.value = (downbeatPhase.value + delta + BEATS_PER_BAR) % BEATS_PER_BAR
}

/** 波形上の時刻に最も近い拍を 1 拍目として採用する。 */
export function setDownbeatFromTime(time: number): void {
  const ticks = analysis.value?.ticks
  if (!ticks || ticks.length === 0) return

  let nearest = 0
  let smallest = Number.POSITIVE_INFINITY
  for (let i = 0; i < ticks.length; i += 1) {
    const distance = Math.abs((ticks[i] ?? 0) - time)
    if (distance < smallest) {
      smallest = distance
      nearest = i
    }
  }
  downbeatPhase.value = nearest % BEATS_PER_BAR
}
