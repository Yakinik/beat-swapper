import type { BeatsPerBar } from '../lib/beat-analysis'

/** 並び順に書ける最大の桁数。1 小節あたり 16 拍まで。 */
export const MAX_ORDER_LENGTH = 16

export interface OrderPreset {
  text: string
  description: string
}

/** 元の並び。A/B 比較のときに使う。 */
export const ORIGINAL_ORDER_TEXT: Record<BeatsPerBar, string> = {
  3: '123',
  4: '1234',
}

export const DEFAULT_ORDER_TEXT: Record<BeatsPerBar, string> = {
  3: '231',
  4: '2431',
}

export const ORDER_PRESETS: Record<BeatsPerBar, readonly OrderPreset[]> = {
  4: [
    { text: '2431', description: '2→4→3→1。小節の長さは変わらない' },
    { text: '3142', description: '3→1→4→2' },
    { text: '4321', description: '拍の並びを逆にする' },
    { text: '1324', description: '2 拍目と 3 拍目だけ入れ替える' },
    { text: '1133', description: '1・3 拍目を 2 回ずつ鳴らす' },
    { text: '124', description: '3 拍目を落として 3 拍の小節にする' },
  ],
  3: [
    { text: '231', description: '2→3→1。小節の長さは変わらない' },
    { text: '312', description: '3→1→2' },
    { text: '321', description: '拍の並びを逆にする' },
    { text: '132', description: '2 拍目と 3 拍目を入れ替える' },
    { text: '113', description: '1 拍目を 2 回鳴らす' },
    { text: '12', description: '3 拍目を落として 2 拍の小節にする' },
  ],
}
