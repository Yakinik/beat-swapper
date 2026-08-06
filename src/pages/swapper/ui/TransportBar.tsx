import { Button, Icon, SegmentedControl, Slider } from '@/shared/ui'

import { ORIGINAL_ORDER_TEXT } from '../config/preset-orders'
import { beatsPerBar } from '../model/bar-shape'
import { bypass } from '../model/beat-order'
import { fadeMs, looping, volume } from '../model/playback'
import styles from './TransportBar.module.css'

export function TransportBar() {
  const original = ORIGINAL_ORDER_TEXT[beatsPerBar.value]

  return (
    <div class={styles.bar}>
      <SegmentedControl
        label="再生する並び"
        options={[
          { value: 'swapped', label: '並べ替え' },
          { value: 'original', label: `元の順（${original}）` },
        ]}
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
