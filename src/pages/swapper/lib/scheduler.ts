import { EMPTY_PLAN, type BeatSlice, type SlicePlan, sliceIndexAt } from './slice-plan'

// 並べ替えたスライスを Web Audio の時計で鳴らす。
//
// 全スライスを一度にスケジュールすると数千ノードを作ることになり、停止も差し替えも
// できなくなる。一定間隔で少し先だけを積む「先読みスケジューラ」にしている。
// setTimeout でタイミングを作るのではなく、あくまで AudioContext の時刻へ積む。

/** 先読みする長さ [s]。バックグラウンドタブで setInterval が 1 秒に間引かれても間に合う幅。 */
const LOOKAHEAD = 1.5
/** スケジューラを回す間隔 [ms] */
const TICK_MS = 120
/** 再生開始までの余裕 [s] */
const START_DELAY = 0.08

interface ActiveVoice {
  source: AudioBufferSourceNode
  gain: GainNode
}

export class SlicePlayer {
  readonly #context: AudioContext
  readonly #master: GainNode
  readonly #active = new Set<ActiveVoice>()

  #buffer: AudioBuffer | null = null
  #plan: SlicePlan = EMPTY_PLAN
  #timer: ReturnType<typeof setInterval> | null = null
  /** 次にスケジュールするスライスの位置 */
  #nextIndex = 0
  /** 出力位置 0 に対応する AudioContext の時刻 */
  #originTime = 0
  #loop = false
  #fadeSeconds = 0.004

  /** 最後まで鳴らし終えたとき（ループ中は呼ばれない） */
  onEnded: (() => void) | null = null

  constructor(context: AudioContext) {
    this.#context = context
    this.#master = context.createGain()
    this.#master.connect(context.destination)
  }

  get playing(): boolean {
    return this.#timer !== null
  }

  /** 出力タイムライン上の現在位置 [s]。停止中は 0。 */
  get outputTime(): number {
    if (!this.playing) return 0
    return Math.max(0, this.#context.currentTime - this.#originTime)
  }

  setBuffer(buffer: AudioBuffer | null): void {
    this.stop()
    this.#buffer = buffer
  }

  /**
   * 並べ替え計画を差し替える。再生中なら同じ小節の頭から鳴らし直す
   * （並び順を変えた瞬間に曲の先頭へ戻らないようにするため）。
   */
  setPlan(plan: SlicePlan): void {
    const bar = this.playing ? this.#currentBar() : -1
    this.#plan = plan
    if (!this.playing) return

    const resumeAt = bar < 0 ? 0 : (plan.slices.find((slice) => slice.bar >= bar)?.startAt ?? 0)
    this.play(resumeAt)
  }

  setVolume(value: number): void {
    this.#master.gain.setTargetAtTime(value, this.#context.currentTime, 0.01)
  }

  setFadeSeconds(value: number): void {
    this.#fadeSeconds = Math.max(0, value)
  }

  setLoop(value: boolean): void {
    this.#loop = value
  }

  play(fromOutputTime = 0): void {
    this.stop()
    if (!this.#buffer || this.#plan.slices.length === 0) return

    const from = Math.min(Math.max(0, fromOutputTime), Math.max(0, this.#plan.duration - 0.05))
    this.#originTime = this.#context.currentTime + START_DELAY - from
    const index = sliceIndexAt(this.#plan, from)
    this.#nextIndex = index < 0 ? 0 : index

    this.#tick()
    this.#timer = setInterval(this.#tick, TICK_MS)
  }

  stop(): void {
    if (this.#timer !== null) {
      clearInterval(this.#timer)
      this.#timer = null
    }
    for (const voice of this.#active) {
      voice.source.onended = null
      try {
        voice.source.stop()
      } catch {
        // 既に鳴り終わっている
      }
      voice.source.disconnect()
      voice.gain.disconnect()
    }
    this.#active.clear()
    this.#nextIndex = 0
  }

  #currentBar(): number {
    const index = sliceIndexAt(this.#plan, this.outputTime)
    return index < 0 ? -1 : (this.#plan.slices[index]?.bar ?? -1)
  }

  readonly #tick = (): void => {
    const context = this.#context
    const { slices, duration } = this.#plan
    if (!this.#buffer || slices.length === 0) {
      this.stop()
      return
    }

    const horizon = context.currentTime + LOOKAHEAD

    for (;;) {
      while (this.#nextIndex < slices.length) {
        const slice = slices[this.#nextIndex]
        if (!slice) break
        const when = this.#originTime + slice.startAt
        if (when >= horizon) return
        this.#schedule(slice, when)
        this.#nextIndex += 1
      }

      const endTime = this.#originTime + duration
      if (!this.#loop) {
        if (context.currentTime >= endTime) {
          this.stop()
          this.onEnded?.()
        }
        return
      }
      if (endTime >= horizon) return
      // ループ: 出力位置 0 を末尾へずらして積み直す
      this.#originTime = endTime
      this.#nextIndex = 0
    }
  }

  #schedule(slice: BeatSlice, when: number): void {
    const context = this.#context
    const buffer = this.#buffer
    if (!buffer) return

    // 予定時刻を過ぎていたら、その分だけ頭を削って今から鳴らす（シーク直後とタブ復帰時）。
    const lateBy = Math.max(0, context.currentTime - when)
    if (lateBy >= slice.duration) return

    const startTime = when + lateBy
    const offset = slice.offset + lateBy
    if (offset >= buffer.duration) return
    const playable = Math.min(slice.duration - lateBy, buffer.duration - offset)
    if (playable <= 0) return

    const gain = context.createGain()
    // クリックノイズ対策のフェード。スライスの内側で完結するのでタイミングはずれない。
    const fade = Math.min(this.#fadeSeconds, playable / 3)
    if (fade > 0) {
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(1, startTime + fade)
      gain.gain.setValueAtTime(1, startTime + playable - fade)
      gain.gain.linearRampToValueAtTime(0, startTime + playable)
    } else {
      gain.gain.setValueAtTime(1, startTime)
    }
    gain.connect(this.#master)

    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(gain)

    const voice: ActiveVoice = { source, gain }
    source.onended = () => {
      this.#active.delete(voice)
      source.disconnect()
      gain.disconnect()
    }
    source.start(startTime, offset, playable)
    this.#active.add(voice)
  }
}
