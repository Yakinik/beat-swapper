import { useRef } from 'preact/hooks'

import { AUDIO_ACCEPT } from '@/shared/config/app'
import { Button, Icon } from '@/shared/ui'

import { openFile } from '../model/session'
import styles from './DropZone.module.css'

/** 隠した <input type="file"> と、それを開く関数を作る。 */
const useFileDialog = () => {
  const inputRef = useRef<HTMLInputElement>(null)

  // input はボタンの中に入れられない（button の中に入力要素は置けない）ので
  // 兄弟として描画する。
  const input = (
    <input
      ref={inputRef}
      type="file"
      class={styles.input}
      accept={AUDIO_ACCEPT}
      onChange={(event) => {
        const file = event.currentTarget.files?.[0]
        // 同じファイルを続けて選べるように値を戻す
        event.currentTarget.value = ''
        if (file) void openFile(file)
      }}
    />
  )

  return { input, open: () => inputRef.current?.click() }
}

/** 曲を読み込む前に出す大きな受け皿。 */
export function DropZone() {
  const { input, open } = useFileDialog()

  return (
    <>
      {input}
      <button type="button" class={styles.zone} onClick={open}>
        <Icon name="music" size={28} />
        <span class={styles.lead}>音楽ファイルを選ぶ</span>
        <span class={styles.hint}>
          ここへドラッグ＆ドロップしても読み込めます（MP3 / WAV / M4A など）
        </span>
      </button>
    </>
  )
}

/** 曲を読み込んだあと、ヘッダーに置く差し替えボタン。 */
export function PickFileButton() {
  const { input, open } = useFileDialog()

  return (
    <>
      {input}
      <Button onClick={open}>
        <Icon name="file" />
        別の曲
      </Button>
    </>
  )
}
