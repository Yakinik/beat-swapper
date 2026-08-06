import { computed, signal } from '@preact/signals'

import {
  DEFAULT_ORDER_TEXT,
  MAX_ORDER_LENGTH,
  ORIGINAL_ORDER_TEXT,
} from '../config/preset-orders'
import { BEATS_PER_BAR } from '../lib/beat-analysis'

// 並び順は 1〜4 の数字列。重複も省略も許すので `1133` や `124` も有効で、
// その場合は出力側の小節の長さが元と変わる。

export interface OrderParseResult {
  order: number[] | null
  error: string | null
}

export function parseOrder(text: string): OrderParseResult {
  const trimmed = text.trim()
  if (trimmed === '') return { order: null, error: '並び順を入力してください' }
  if (trimmed.length > MAX_ORDER_LENGTH) {
    return { order: null, error: `${MAX_ORDER_LENGTH} 桁までです` }
  }

  const order: number[] = []
  for (const character of trimmed) {
    const digit = Number(character)
    if (!Number.isInteger(digit) || digit < 1 || digit > BEATS_PER_BAR) {
      return { order: null, error: `1〜${BEATS_PER_BAR} の数字だけを並べてください` }
    }
    order.push(digit)
  }
  return { order, error: null }
}

const parseOrDefault = (text: string): number[] =>
  parseOrder(text).order ?? [1, 2, 3, 4]

const ORIGINAL_ORDER = parseOrDefault(ORIGINAL_ORDER_TEXT)

export const orderText = signal(DEFAULT_ORDER_TEXT)

/** 元の並びで鳴らす A/B 比較モード */
export const bypass = signal(false)

/** 入力が壊れているあいだも直前の有効な並びで鳴らし続けるための保持値 */
const appliedOrder = signal<number[]>(parseOrDefault(DEFAULT_ORDER_TEXT))

export const orderError = computed(() => parseOrder(orderText.value).error)

export const effectiveOrder = computed<number[]>(() =>
  bypass.value ? ORIGINAL_ORDER : appliedOrder.value,
)

export function setOrderText(text: string): void {
  orderText.value = text
  const { order } = parseOrder(text)
  if (order) appliedOrder.value = order
}
