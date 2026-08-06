import { computed, signal } from '@preact/signals'

import {
  DEFAULT_ORDER_TEXT,
  MAX_ORDER_LENGTH,
  ORDER_PRESETS,
  ORIGINAL_ORDER_TEXT,
} from '../config/preset-orders'
import type { BeatsPerBar } from '../lib/beat-analysis'
import { beatsPerBar } from './bar-shape'

// 並び順は 1〜（1 小節の拍数）の数字列。重複も省略も許すので `1133` や `124` も有効で、
// その場合は出力側の小節の長さが元と変わる。

export interface OrderParseResult {
  order: number[] | null
  error: string | null
}

export function parseOrder(text: string, beats: BeatsPerBar): OrderParseResult {
  const trimmed = text.trim()
  if (trimmed === '') return { order: null, error: '並び順を入力してください' }
  if (trimmed.length > MAX_ORDER_LENGTH) {
    return { order: null, error: `${MAX_ORDER_LENGTH} 桁までです` }
  }

  const order: number[] = []
  for (const character of trimmed) {
    const digit = Number(character)
    if (!Number.isInteger(digit) || digit < 1 || digit > beats) {
      return { order: null, error: `1〜${beats} の数字だけを並べてください` }
    }
    order.push(digit)
  }
  return { order, error: null }
}

const parseOrDefault = (text: string, beats: BeatsPerBar): number[] =>
  parseOrder(text, beats).order ?? parseOrder(ORIGINAL_ORDER_TEXT[beats], beats).order ?? [1]

export const orderText = signal(DEFAULT_ORDER_TEXT[beatsPerBar.peek()])

/** 元の並びで鳴らす A/B 比較モード */
export const bypass = signal(false)

/** 入力が壊れているあいだも直前の有効な並びで鳴らし続けるための保持値 */
const appliedOrder = signal<number[]>(
  parseOrDefault(DEFAULT_ORDER_TEXT[beatsPerBar.peek()], beatsPerBar.peek()),
)

export const orderError = computed(() => parseOrder(orderText.value, beatsPerBar.value).error)

export const presets = computed(() => ORDER_PRESETS[beatsPerBar.value])

export const effectiveOrder = computed<number[]>(() =>
  bypass.value
    ? parseOrDefault(ORIGINAL_ORDER_TEXT[beatsPerBar.value], beatsPerBar.value)
    : appliedOrder.value,
)

export function setOrderText(text: string): void {
  orderText.value = text
  const { order } = parseOrder(text, beatsPerBar.peek())
  if (order) appliedOrder.value = order
}

/**
 * 1 小節の拍数を切り替える。並び順が新しい拍数で成り立たなくなったら
 * （4 拍の `2431` を 3 拍モードにした場合など）そのモードの既定値へ戻す。
 */
export function setBeatsPerBar(beats: BeatsPerBar): void {
  if (beatsPerBar.peek() === beats) return
  beatsPerBar.value = beats
  if (parseOrder(orderText.peek(), beats).order === null) {
    setOrderText(DEFAULT_ORDER_TEXT[beats])
  }
}
