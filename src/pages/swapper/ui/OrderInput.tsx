import { Button } from '@/shared/ui'

import { MAX_ORDER_LENGTH } from '../config/preset-orders'
import { beatsPerBar } from '../model/bar-shape'
import { orderError, orderText, presets, setOrderText } from '../model/beat-order'
import styles from './OrderInput.module.css'

export function OrderInput() {
  const text = orderText.value
  const error = orderError.value
  const beats = beatsPerBar.value

  return (
    <div class={styles.block}>
      <label class={styles.field}>
        <span class={styles.label}>並び順</span>
        <input
          type="text"
          class={styles.input}
          value={text}
          inputMode="numeric"
          autocomplete="off"
          spellcheck={false}
          maxLength={MAX_ORDER_LENGTH}
          aria-invalid={error !== null}
          onInput={(event) => setOrderText(event.currentTarget.value)}
        />
      </label>

      <p class={error ? styles.error : styles.hint}>
        {error ?? `1〜${beats} の数字を並べます。同じ拍を繰り返しても、落としても構いません。`}
      </p>

      <div class={styles.presets}>
        {presets.value.map((preset) => (
          <Button
            key={preset.text}
            class={styles.preset}
            title={preset.description}
            onClick={() => setOrderText(preset.text)}
          >
            {preset.text}
          </Button>
        ))}
      </div>
    </div>
  )
}
