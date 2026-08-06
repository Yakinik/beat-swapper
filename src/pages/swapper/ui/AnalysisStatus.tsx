import { formatTime } from '@/shared/lib'
import { Button, Icon } from '@/shared/ui'

import type { AnalysisStage } from '../lib/beat-analysis'
import {
  analysis,
  analysisError,
  analysisStage,
  effectiveBpm,
  resetDetection,
  setBpm,
  setStartPositionMs,
  startPositionSeconds,
  usingManualGrid,
} from '../model/analysis'
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

interface StepperProps {
  label: string
  value: number
  step: number
  /** 表示・入力に使う小数点以下の桁数 */
  decimals: number
  unit?: string
  onChange: (value: number) => void
}

/** 数値をボタンでも直接入力でも動かせる小さなフィールド。 */
function Stepper({ label, value, step, decimals, unit, onChange }: StepperProps) {
  const text = value.toFixed(decimals)
  return (
    <div class={styles.stepper}>
      <span class={styles.term}>{label}</span>
      <Button
        square
        class={styles.nudge}
        title={`${label}を ${step} 減らす`}
        aria-label={`${label}を減らす`}
        onClick={() => onChange(value - step)}
      >
        −
      </Button>
      <input
        type="text"
        class={styles.number}
        value={text}
        inputMode="decimal"
        autocomplete="off"
        spellcheck={false}
        aria-label={label}
        onChange={(event) => {
          const next = Number(event.currentTarget.value)
          if (Number.isFinite(next)) onChange(next)
          else event.currentTarget.value = text
        }}
      />
      {unit && <span class={styles.unit}>{unit}</span>}
      <Button
        square
        class={styles.nudge}
        title={`${label}を ${step} 増やす`}
        aria-label={`${label}を増やす`}
        onClick={() => onChange(value + step)}
      >
        ＋
      </Button>
    </div>
  )
}

export function AnalysisStatus() {
  const current = track.value
  const result = analysis.value
  const error = analysisError.value
  const stage = analysisStage.value
  const working = busy.value

  // 何も読み込んでいないうちは空の枠を出さない
  if (!current && !error && !working) return null

  const startMs = Math.round(startPositionSeconds.value * 1000)

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
        <>
          <div class={styles.facts}>
            <Stepper
              label="BPM"
              value={effectiveBpm.value}
              step={0.1}
              decimals={2}
              onChange={setBpm}
            />
            <Stepper
              label="開始位置"
              value={startMs}
              step={1}
              decimals={0}
              unit="ms"
              onChange={setStartPositionMs}
            />
            <span class={styles.fact}>
              <span class={styles.term}>拍</span>
              {result.ticks.length}
            </span>
            <span class={styles.fact}>
              <span class={styles.term}>小節</span>
              {plan.value.bars}
            </span>
            <span class={styles.fact} title="Essentia の multifeature 法による 0〜5.32 のスケール">
              <span class={styles.term}>信頼度</span>
              {result.confidence.toFixed(2)}
            </span>
            {usingManualGrid.value && (
              <Button variant="ghost" class={styles.reset} onClick={resetDetection}>
                検出値に戻す
              </Button>
            )}
          </div>
          {usingManualGrid.value && (
            <p class={styles.note}>
              検出した拍位置ではなく、BPM と開始位置から作った等間隔のグリッドで鳴らしています。
            </p>
          )}
        </>
      )}
    </section>
  )
}
