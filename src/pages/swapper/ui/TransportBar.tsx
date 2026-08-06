import { Slider } from '@/shared/ui'

import { fadeMs, volume } from '../model/playback'
import styles from './TransportBar.module.css'

export function TransportBar() {
  return (
    <div class={styles.bar}>
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
