import { useSignal } from '@preact/signals'
import { useEffect, useRef } from 'preact/hooks'

import {
  MAX_PLAYBACK_RATE,
  MIN_PLAYBACK_RATE,
  PLAYBACK_RATES,
} from '../config/playback-rates'
import { playbackRate } from '../model/playback'
import styles from './PlaybackRateField.module.css'

/** 末尾の 0 を落として `1` `1.25` のように出す。 */
const format = (rate: number) => String(Number(rate.toFixed(2)))

export function PlaybackRateField() {
  const open = useSignal(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const rate = playbackRate.value

  const commit = (value: number) => {
    if (!Number.isFinite(value)) return
    playbackRate.value = Math.min(Math.max(value, MIN_PLAYBACK_RATE), MAX_PLAYBACK_RATE)
  }

  // プルダウンの外側を触ったら閉じる
  useEffect(() => {
    if (!open.value) return
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) open.value = false
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open.value])

  return (
    <div class={styles.field} ref={rootRef}>
      <span class={styles.label}>速度</span>
      <div class={styles.combo}>
        <input
          type="text"
          class={styles.input}
          value={format(rate)}
          inputMode="decimal"
          autocomplete="off"
          spellcheck={false}
          aria-label="再生速度"
          onChange={(event) => {
            const next = Number(event.currentTarget.value)
            if (Number.isFinite(next)) commit(next)
            else event.currentTarget.value = format(playbackRate.peek())
          }}
        />
        <span class={styles.suffix}>×</span>
        <button
          type="button"
          class={styles.toggle}
          aria-label="再生速度のプリセット"
          aria-expanded={open.value}
          onClick={() => {
            open.value = !open.value
          }}
        >
          ▼
        </button>

        {open.value && (
          <ul class={styles.menu} role="listbox" aria-label="再生速度のプリセット">
            {PLAYBACK_RATES.map((preset) => (
              <li key={preset}>
                <button
                  type="button"
                  role="option"
                  aria-selected={preset === rate}
                  class={preset === rate ? styles.current : undefined}
                  onClick={() => {
                    commit(preset)
                    open.value = false
                  }}
                >
                  {format(preset)}×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
