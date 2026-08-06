import { formatTime } from '@/shared/lib'
import { Icon } from '@/shared/ui'

import type { AnalysisStage } from '../lib/beat-analysis'
import { analysis, analysisError, analysisStage } from '../model/analysis'
import { plan } from '../model/playback'
import { busy } from '../model/session'
import { track } from '../model/track'
import styles from './AnalysisStatus.module.css'

const STAGE_LABELS: Record<AnalysisStage, string> = {
  decoding: '音声をデコードしています…',
  'loading-engine': '解析エンジンを読み込んでいます…（初回は少し時間がかかります）',
  'tracking-beats': 'BPM と拍位置を解析しています…',
  done: '解析が終わりました',
}

export function AnalysisStatus() {
  const current = track.value
  const result = analysis.value
  const error = analysisError.value
  const stage = analysisStage.value
  const working = busy.value

  // 何も読み込んでいないうちは空の枠を出さない
  if (!current && !error && !working) return null

  return (
    <section class={styles.status}>
      {current && (
        <p class={styles.file}>
          <Icon name="music" />
          <span class={styles.name}>{current.name}</span>
          <span class={styles.dim}>{formatTime(current.buffer.duration)}</span>
        </p>
      )}

      {error && (
        <p class={styles.error}>
          <Icon name="warn" />
          {error}
        </p>
      )}

      {working && stage && (
        <p class={styles.progress}>
          <span class={styles.spinner} aria-hidden="true" />
          {STAGE_LABELS[stage]}
        </p>
      )}

      {result && (
        <dl class={styles.facts}>
          <div>
            <dt>BPM</dt>
            <dd class={styles.strong}>{result.bpm.toFixed(1)}</dd>
          </div>
          <div>
            <dt>拍</dt>
            <dd>{result.ticks.length}</dd>
          </div>
          <div>
            <dt>小節</dt>
            <dd>{plan.value.bars}</dd>
          </div>
          <div>
            <dt>信頼度</dt>
            <dd title="Essentia の multifeature 法による 0〜5.32 のスケール">
              {result.confidence.toFixed(2)}
            </dd>
          </div>
        </dl>
      )}
    </section>
  )
}
