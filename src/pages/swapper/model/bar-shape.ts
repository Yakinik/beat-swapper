import { signal } from '@preact/signals'

import { DEFAULT_BEATS_PER_BAR, type BeatsPerBar } from '../lib/beat-analysis'

/**
 * 1 小節を何拍で区切るか。解析し直す必要はなく、検出済みの拍列の解釈が変わるだけ。
 *
 * 切り替えは `beat-order.ts` の `setBeatsPerBar()` を通す（並び順が新しい拍数で
 * 無効になったときに直す必要があるため）。
 */
export const beatsPerBar = signal<BeatsPerBar>(DEFAULT_BEATS_PER_BAR)
