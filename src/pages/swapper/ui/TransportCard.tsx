import { formatTime } from '@/shared/lib'
import { Button, Icon, type IconName } from '@/shared/ui'

import {
  looping,
  pause,
  play,
  playhead,
  plan,
  playing,
  restart,
  stepBar,
  stepBeat,
  stop,
} from '../model/playback'
import { PlaybackRateField } from './PlaybackRateField'
import styles from './TransportCard.module.css'

interface Step {
  icon: IconName
  label: string
  run: () => void
}

const STEPS: readonly Step[] = [
  { icon: 'toStart', label: '最初から', run: restart },
  { icon: 'barBack', label: '1 小節戻る', run: () => stepBar(-1) },
  { icon: 'beatBack', label: '1 拍戻る', run: () => stepBeat(-1) },
  { icon: 'beatForward', label: '1 拍進む', run: () => stepBeat(1) },
  { icon: 'barForward', label: '1 小節進む', run: () => stepBar(1) },
]

export function TransportCard() {
  const current = plan.value
  const isPlaying = playing.value
  const ready = current.slices.length > 0

  return (
    <div class={styles.card}>
      <Button
        variant="primary"
        disabled={!ready}
        title={isPlaying ? '一時停止' : '再生'}
        onClick={() => {
          if (isPlaying) pause()
          else void play()
        }}
      >
        <Icon name={isPlaying ? 'pause' : 'play'} />
        {isPlaying ? '一時停止' : '再生'}
      </Button>

      <Button square disabled={!ready} title="停止（先頭へ戻る）" onClick={stop}>
        <Icon name="stop" />
      </Button>

      <Button
        square
        title={looping.value ? 'ループ再生: オン' : 'ループ再生: オフ'}
        aria-pressed={looping.value}
        class={looping.value ? styles.on : undefined}
        onClick={() => {
          looping.value = !looping.value
        }}
      >
        <Icon name="loop" />
      </Button>

      <span class={styles.divider} aria-hidden="true" />

      {STEPS.map((step) => (
        <Button
          key={step.label}
          square
          disabled={!ready}
          title={step.label}
          aria-label={step.label}
          onClick={step.run}
        >
          <Icon name={step.icon} />
        </Button>
      ))}

      <span class={styles.time}>
        {formatTime(playhead.value)} / {formatTime(current.duration)}
      </span>

      <PlaybackRateField />
    </div>
  )
}
