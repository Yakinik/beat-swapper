import { formatTime } from '@/shared/lib'
import { Button, Icon, SegmentedControl, Slider } from '@/shared/ui'

import { ORIGINAL_ORDER_TEXT } from '../config/preset-orders'
import { bypass } from '../model/beat-order'
import {
  fadeMs,
  looping,
  outputPosition,
  plan,
  playing,
  togglePlay,
  volume,
} from '../model/playback'
import styles from './TransportBar.module.css'

const ORDER_MODES = [
  { value: 'swapped', label: '並べ替え' },
  { value: 'original', label: `元の順（${ORIGINAL_ORDER_TEXT}）` },
] as const

export function TransportBar() {
  const current = plan.value
  const isPlaying = playing.value
  const ready = current.slices.length > 0

  return (
    <div class={styles.bar}>
      <Button variant="primary" onClick={togglePlay} disabled={!ready}>
        <Icon name={isPlaying ? 'stop' : 'play'} />
        {isPlaying ? '停止' : '再生'}
      </Button>

      <SegmentedControl
        label="再生する並び"
        options={ORDER_MODES}
        value={bypass.value ? 'original' : 'swapped'}
        onChange={(value) => {
          bypass.value = value === 'original'
        }}
      />

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

      <span class={styles.time}>
        {formatTime(outputPosition.value)} / {formatTime(current.duration)}
      </span>

      <Slider
        class={styles.slider}
        label="音量"
        value={Math.round(volume.value * 100)}
        min={0}
        max={100}
        valueText={`${Math.round(volume.value * 100)}%`}
        onInput={(value) => {
          volume.value = value / 100
        }}
      />

      <Slider
        class={styles.slider}
        label="つなぎ目のフェード"
        value={fadeMs.value}
        min={0}
        max={20}
        valueText={`${fadeMs.value} ms`}
        onInput={(value) => {
          fadeMs.value = value
        }}
      />
    </div>
  )
}
