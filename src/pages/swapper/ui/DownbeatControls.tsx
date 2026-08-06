import { Button, SegmentedControl } from '@/shared/ui'

import { BEATS_PER_BAR } from '../lib/beat-analysis'
import { downbeatPhase, estimatedPhase } from '../model/analysis'
import styles from './DownbeatControls.module.css'

// 拍位置は自動で取れても「どれが 1 拍目か」までは分からない。4/4 なら選択肢は
// 4 通りしかないので、ずらす拍数をそのまま並べる。

const SHIFT_OPTIONS = Array.from({ length: BEATS_PER_BAR }, (_, shift) => ({
  value: String(shift),
  label: shift === 0 ? '±0' : `+${shift}`,
  title: `小節の頭を ${shift} 拍うしろへずらす`,
}))

export function DownbeatControls() {
  const phase = downbeatPhase.value
  const estimated = estimatedPhase.value

  return (
    <div class={styles.block}>
      <div class={styles.head}>
        <span class={styles.label}>小節の頭</span>
        {phase !== estimated && (
          <Button
            variant="ghost"
            class={styles.reset}
            onClick={() => {
              downbeatPhase.value = estimated
            }}
          >
            自動推定に戻す
          </Button>
        )}
      </div>
      <SegmentedControl
        label="小節の頭をずらす拍数"
        options={SHIFT_OPTIONS}
        value={String(phase)}
        onChange={(value) => {
          downbeatPhase.value = Number(value)
        }}
      />
      <p class={styles.hint}>1 拍目が合うまでずらします。波形をクリックしても指定できます。</p>
    </div>
  )
}
