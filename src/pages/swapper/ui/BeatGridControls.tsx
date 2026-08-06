import { Button, SegmentedControl, Slider } from '@/shared/ui'

import { BEATS_PER_BAR_OPTIONS, type BeatsPerBar } from '../lib/beat-analysis'
import {
  BAR_SHIFT_LIMIT,
  BEAT_SHIFT_LIMIT,
  adjusted,
  barShift,
  beatOffsetLimitMs,
  beatOffsetMs,
  beatShift,
  resetAdjustments,
} from '../model/analysis'
import { beatsPerBar } from '../model/bar-shape'
import { setBeatsPerBar } from '../model/beat-order'
import styles from './BeatGridControls.module.css'

const MODE_OPTIONS = BEATS_PER_BAR_OPTIONS.map((beats) => ({
  value: String(beats),
  label: `${beats} 拍`,
  title: `1 小節を ${beats} 拍として区切る`,
}))

const signed = (value: number, unit: string) => `${value > 0 ? '+' : ''}${value} ${unit}`

export function BeatGridControls() {
  const beats = beatsPerBar.value
  const offsetLimit = beatOffsetLimitMs.value

  return (
    <div class={styles.block}>
      <div class={styles.head}>
        <span class={styles.label}>小節の拍数</span>
        {adjusted.value && (
          <Button variant="ghost" class={styles.reset} onClick={resetAdjustments}>
            調整をリセット
          </Button>
        )}
      </div>
      <SegmentedControl
        label="1 小節の拍数"
        options={MODE_OPTIONS}
        value={String(beats)}
        onChange={(value) => setBeatsPerBar(Number(value) as BeatsPerBar)}
      />

      <Slider
        class={styles.slider}
        label="拍の調節"
        value={beatOffsetMs.value}
        min={-offsetLimit}
        max={offsetLimit}
        step={1}
        valueText={`${beatOffsetMs.value > 0 ? '+' : ''}${beatOffsetMs.value} ms`}
        onInput={(value) => {
          beatOffsetMs.value = value
        }}
      />
      <p class={styles.hint}>
        検知した拍位置を全体で前後させます（±16 分音符 = ±{offsetLimit} ms）。
      </p>

      <Slider
        class={styles.slider}
        label="開始する拍"
        value={beatShift.value}
        min={-BEAT_SHIFT_LIMIT}
        max={BEAT_SHIFT_LIMIT}
        step={1}
        valueText={signed(beatShift.value, '拍')}
        onInput={(value) => {
          beatShift.value = value
        }}
      />

      <Slider
        class={styles.slider}
        label="開始する小節"
        value={barShift.value}
        min={-BAR_SHIFT_LIMIT}
        max={BAR_SHIFT_LIMIT}
        step={1}
        valueText={signed(barShift.value, '小節')}
        onInput={(value) => {
          barShift.value = value
        }}
      />
      <p class={styles.hint}>
        マイナスにすると音源より手前から始まります。足りない分は無音で埋まります。
      </p>
    </div>
  )
}
