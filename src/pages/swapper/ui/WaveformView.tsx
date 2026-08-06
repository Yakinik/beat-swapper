import { useSignal, useSignalEffect } from '@preact/signals'
import { useEffect, useRef } from 'preact/hooks'

import { barRange, gridTime } from '../lib/slice-plan'
import { type TimeRange, drawWaveform } from '../lib/waveform'
import { analysis, grid, setDownbeatFromTime, startIndex } from '../model/analysis'
import { beatsPerBar } from '../model/bar-shape'
import { activeSlice } from '../model/playback'
import { track } from '../model/track'
import styles from './WaveformView.module.css'

/** 拡大表示に収める小節数 */
const DETAIL_BARS = 2

const ratioOfClick = (canvas: HTMLCanvasElement, clientX: number): number => {
  const rect = canvas.getBoundingClientRect()
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
}

export function WaveformView() {
  const overviewRef = useRef<HTMLCanvasElement>(null)
  const detailRef = useRef<HTMLCanvasElement>(null)
  /** 停止中に拡大表示が見ている中心時刻。0 なら 1 小節目。 */
  const detailCenter = useSignal(0)

  // 描画は peek だけで読む。購読は useSignalEffect 側で明示する。
  const detailView = (): TimeRange | null => {
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

    // 再生中は鳴っている小節を追う。拍ごとに動かすと目が回るので小節単位で止める。
    const slice = activeSlice.peek()
    const playingBar = slice ? barRange(current, head, beats, slice.bar) : null
    const center = playingBar
      ? (playingBar.from + playingBar.to) / 2
      : detailCenter.peek() || gridTime(current, head) + half

    const limit = Math.max(half, loaded.buffer.duration - half)
    const clamped = Math.min(Math.max(center, half), limit)
    return { from: clamped - half, to: clamped + half }
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
    const view = detailView()

    const overview = overviewRef.current
    if (overview) {
      drawWaveform(overview, {
        ...shared,
        view: { from: 0, to: loaded.buffer.duration },
        focus: view,
        normalize: 'track',
      })
    }

    const detail = detailRef.current
    if (detail && view) {
      drawWaveform(detail, { ...shared, view, showBeatNumbers: true, normalize: 'view' })
    }
  }

  useSignalEffect(() => {
    void track.value
    void grid.value
    void startIndex.value
    void beatsPerBar.value
    void activeSlice.value
    void detailCenter.value
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
        aria-label="曲全体の波形。クリックすると拡大表示がその位置へ移動します"
        onClick={(event) => {
          const canvas = overviewRef.current
          const loaded = track.peek()
          if (!canvas || !loaded) return
          detailCenter.value = ratioOfClick(canvas, event.clientX) * loaded.buffer.duration
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
              if (!canvas) return
              const view = detailView()
              if (!view) return
              const time = view.from + ratioOfClick(canvas, event.clientX) * (view.to - view.from)
              detailCenter.value = time
              setDownbeatFromTime(time)
            }}
          />
          <p class={styles.hint}>
            下の拡大表示で、太い線と数字の <b>1</b> がキックなど小節の頭に合っていれば正解です。
            ずれていたらその拍をクリックするか、「小節の頭」でずらします。
          </p>
        </>
      )}
    </div>
  )
}
