import { useRef, useState } from 'preact/hooks'

import { APP_NAME, APP_TAGLINE, NOTICES_URL, SOURCE_URL } from '@/shared/config/app'

import { analysis } from '../model/analysis'
import { openFile } from '../model/session'
import { track } from '../model/track'
import { AnalysisStatus } from './AnalysisStatus'
import { BeatGridControls } from './BeatGridControls'
import { DropZone, PickFileButton } from './DropZone'
import { OrderInput } from './OrderInput'
import styles from './SwapperPage.module.css'
import { TransportBar } from './TransportBar'
import { TransportCard } from './TransportCard'
import { WaveformView } from './WaveformView'

export function SwapperPage() {
  const loaded = track.value !== null
  const analyzed = analysis.value !== null
  const [dragging, setDragging] = useState(false)
  // dragleave は子要素をまたぐたびに飛んでくるので、出入りを数えて判定する。
  const depth = useRef(0)

  return (
    <div
      class={styles.page}
      onDragEnter={(event) => {
        if (!event.dataTransfer) return
        event.preventDefault()
        depth.current += 1
        setDragging(true)
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setDragging(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        depth.current = 0
        setDragging(false)
        const file = event.dataTransfer?.files?.[0]
        if (file) void openFile(file)
      }}
    >
      <header class={styles.head}>
        <div>
          <h1 class={styles.title}>{APP_NAME}</h1>
          <p class={styles.tagline}>{APP_TAGLINE}</p>
        </div>
        {loaded && <PickFileButton />}
      </header>

      <main class={styles.main}>
        {loaded ? (
          <>
            <AnalysisStatus />
            {analyzed && <TransportCard />}
            <WaveformView />
            {analyzed && (
              <>
                <section class={styles.controls}>
                  <OrderInput />
                  <BeatGridControls />
                </section>
                <TransportBar />
              </>
            )}
          </>
        ) : (
          <>
            <DropZone />
            <AnalysisStatus />
          </>
        )}
      </main>

      <footer class={styles.foot}>
        <p>
          BPM と拍位置の解析には
          <a href="https://mtg.github.io/essentia.js/" target="_blank" rel="noreferrer">
            Essentia.js
          </a>
          （AGPL-3.0）の RhythmExtractor2013 を使っています。テンポの分かりやすい曲が得意です。
        </p>
        <p class={styles.legal}>
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">
            ソースコード（AGPL-3.0）
          </a>
          <span aria-hidden="true">·</span>
          <a href={NOTICES_URL} target="_blank" rel="noreferrer">
            同梱ソフトウェアのライセンス
          </a>
        </p>
      </footer>

      {dragging && <div class={styles.overlay}>ここにドロップして読み込む</div>}
    </div>
  )
}
