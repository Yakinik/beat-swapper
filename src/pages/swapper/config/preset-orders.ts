/** 並び順に書ける最大の桁数。1 小節あたり 16 拍まで。 */
export const MAX_ORDER_LENGTH = 16

/** 元の並び。A/B 比較のときにも使う。 */
export const ORIGINAL_ORDER_TEXT = '1234'

export const DEFAULT_ORDER_TEXT = '2431'

export interface OrderPreset {
  text: string
  description: string
}

export const ORDER_PRESETS: readonly OrderPreset[] = [
  { text: '2431', description: '2→4→3→1。小節の長さは変わらない' },
  { text: '3142', description: '3→1→4→2' },
  { text: '4321', description: '拍の並びを逆にする' },
  { text: '1324', description: '2 拍目と 3 拍目だけ入れ替える' },
  { text: '1133', description: '1・3 拍目を 2 回ずつ鳴らす' },
  { text: '124', description: '3 拍目を落として 3 拍の小節にする' },
]
