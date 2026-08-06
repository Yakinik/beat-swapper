import { useSignalEffect } from '@preact/signals'
import { useEffect, useRef } from 'preact/hooks'

import { barRange, gridTime } from '../lib/slice-plan'
import { type TimeRange, drawWaveform } from '../lib/waveform'
import { analysis, grid, setDownbeatFromTime, startIndex } from '../model/analysis'
import { beatsPerBar } from '../model/bar-shape'
import { activeSlice, seekToSourceTime } from '../model/playback'
import { track } from '../model/track'
import styles from './WaveformView.module.css'

/** 拡大表示に収める小節数 */
const DETAIL_BARS = 2

const ratioOfClick = (canvas: HTMLCanvasElement, clientX: number): number => {
  const rect = canvas.getBoundingClientRect()
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
}

interface Layout {
  /** 全体表示の時間範囲。音源より手前を鳴らすときは負から始まる */
  overview: TimeRange
  /** 拡大表示の時間範囲 */
  detail: TimeRange
  /** いま鳴っている小節の範囲 */
  currentBar: TimeRange | null
}

export function WaveformView() {
  const overviewRef = useRef<HTMLCanvasElement>(null)
  const detailRef = useRef<HTMLCanvasElement>(null)

  // 描画は peek だけで読む。購読は useSignalEffect 側で明示する。
  const layout = (): Layout | null => {
    const loaded = track.peek()
    const current = grid.peek()
    if (!loaded || !current || current.ticks.length < 2) return null

    const beats = beatsPerBar.peek()
    const head = startIndex.peek()
    const total = current.ticks.length
    const beatSeconds =
      (gridTime(current, total - 1) - gridTime(current, 0)) / Math.max(1, total - 1)
    const window = Math.max(0.5, DETAIL_BARS * beats * beatSeconds)
    const half = window / 2

    // 音源より手前から始めているぶんは、全体表示にも枠として出す
    const leadIn = Math.max(0, -gridTime(current, head))
    const overview = { from: -leadIn, to: loaded.buffer.duration }

    const slice = activeSlice.peek()
    const currentBar = slice ? barRange(current, head, beats, slice.bar) : null
    const center = currentBar
      ? (currentBar.from + currentBar.to) / 2
      : gridTime(current, head) + half

    const clamped = Math.min(
      Math.max(center, overview.from + half),
      Math.max(overview.from + half, loaded.buffer.duration - half),
    )
    return { overview, detail: { from: clamped - half, to: clamped + half }, currentBar }
  }

  const redraw = () => {
    const loaded = track.peek()
    if (!loaded) return

    const shared = {
      peaks: loaded.peaks,
      duration: loaded.buffer.duration,
      grid: grid.peek(),
      startIndex: startIndex.peek(),
      beatsPerBar: beatsPerBar.peek(),
      active: activeSlice.peek(),
    }
    const box = layout()

    const overview = overviewRef.current
    if (overview) {
      drawWaveform(overview, {
        ...shared,
        view: box?.overview ?? { from: 0, to: loaded.buffer.duration },
        focus: box?.detail ?? null,
        normalize: 'track',
      })
    }

    const detail = detailRef.current
    if (detail && box) {
      drawWaveform(detail, {
        ...shared,
        view: box.detail,
        showBeatNumbers: true,
        dimOutside: box.currentBar,
        normalize: 'view',
      })
    }
  }

  useSignalEffect(() => {
    void track.value
    void grid.value
    void startIndex.value
    void beatsPerBar.value
    void activeSlice.value
    redraw()
  })

  useEffect(() => {
    const overview = overviewRef.current
    if (!overview) return
    const observer = new ResizeObserver(redraw)
    observer.observe(overview)
    // redraw は ref と peek しか読まないので、初回のものを使い続けてよい
    return () => observer.disconnect()
  }, [])

  const analyzed = analysis.value !== null

  return (
    <div class={styles.frame}>
      <canvas
        ref={overviewRef}
        class={styles.overview}
        role="img"
        aria-label="曲全体の波形。クリックするとその位置から再生します"
        onClick={(event) => {
          const canvas = overviewRef.current
          const box = layout()
          if (!canvas || !box) return
          const span = box.overview.to - box.overview.from
          seekToSourceTime(box.overview.from + ratioOfClick(canvas, event.clientX) * span)
        }}
      />

      {analyzed && (
        <>
          <canvas
            ref={detailRef}
            class={styles.detail}
            role="img"
            aria-label="拡大した波形と拍番号。クリックするとその拍を 1 拍目にします"
            onClick={(event) => {
              const canvas = detailRef.current
              const box = layout()
              if (!canvas || !box) return
              const span = box.detail.to - box.detail.from
              setDownbeatFromTime(box.detail.from + ratioOfClick(canvas, event.clientX) * span)
            }}
          />
          <p class={styles.hint}>
            拡大表示は再生中の小節を追いかけます。太い線と数字の <b>1</b> がキックなど小節の頭に
            合っていれば正解です。ずれていたらその拍をクリックするか、「小節の頭」でずらします。
            斜線の区間は音源より手前で、無音のまま再生されます。
          </p>
        </>
      )}
    </div>
  )
}
