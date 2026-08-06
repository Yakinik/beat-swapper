import { EMPTY_PLAN, type BeatSlice, type SlicePlan, sliceIndexAt } from './slice-plan'

// 並べ替えたスライスを Web Audio の時計で鳴らす。
//
// 全スライスを一度にスケジュールすると数千ノードを作ることになり、停止も差し替えも
// できなくなる。一定間隔で少し先だけを積む「先読みスケジューラ」にしている。
// setTimeout でタイミングを作るのではなく、あくまで AudioContext の時刻へ積む。
//
// 時間には 2 種類ある。混ぜると位置がずれる。
//
//   出力時間 … 計画上の時間（曲の中のどこか、という位置）。BeatSlice.startAt や
//              outputTime はこちら。再生速度を変えても値は変わらない
//   実時間   … AudioContext.currentTime。出力時間 ÷ 再生速度

/** 先読みする長さ [s]。バックグラウンドタブで setInterval が 1 秒に間引かれても間に合う幅。 */
const LOOKAHEAD = 1.5
/** スケジューラを回す間隔 [ms] */
const TICK_MS = 120
/** 再生開始までの余裕 [s] */
const START_DELAY = 0.08

/**
 * 時間伸縮のグレイン間隔 [s]。1 グレインの長さはこの 2 倍で、隣と半分ずつ重なる。
 * 短くすると低音がやせ、長くすると打点が二重に聞こえる。45ms 前後が折り合う。
 */
const GRAIN_HOP = 0.045

interface ActiveVoice {
  source: AudioBufferSourceNode
  nodes: AudioNode[]
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
  #rate = 1

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
    return Math.max(0, (this.#context.currentTime - this.#originTime) * this.#rate)
  }

  setBuffer(buffer: AudioBuffer | null): void {
    this.stop()
    this.#buffer = buffer
  }

  /**
   * 並べ替え計画を差し替える。鳴らし直しは呼び出し側の判断（どの位置から続けるかは
   * モデルが決める）。
   */
  setPlan(plan: SlicePlan): void {
    this.#plan = plan
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

  /**
   * 再生速度。既にスケジュール済みの音は古い速度のままなので、再生中に変えるときは
   * 呼び出し側が `play(現在位置)` で積み直す。
   */
  setRate(value: number): void {
    this.#rate = Math.min(Math.max(value, 0.05), 8)
  }

  play(fromOutputTime = 0): void {
    this.stop()
    if (!this.#buffer || this.#plan.slices.length === 0) return

    const from = Math.min(Math.max(0, fromOutputTime), Math.max(0, this.#plan.duration - 0.05))
    this.#originTime = this.#context.currentTime + START_DELAY - from / this.#rate
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
      for (const node of voice.nodes) node.disconnect()
    }
    this.#active.clear()
    this.#nextIndex = 0
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
        const when = this.#originTime + slice.startAt / this.#rate
        if (when >= horizon) return
        this.#schedule(slice, when)
        this.#nextIndex += 1
      }

      const endTime = this.#originTime + duration / this.#rate
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
    const rate = this.#rate

    // 予定時刻を過ぎていたら、その分だけ頭を削って今から鳴らす（シーク直後とタブ復帰時）。
    const lateBySeconds = Math.max(0, context.currentTime - when)
    const lateBy = lateBySeconds * rate
    if (lateBy >= slice.duration) return

    let startTime = when + lateBySeconds
    let offset = slice.offset + lateBy
    let sourceLength = slice.duration - lateBy

    // 音源より手前を指すスライス（開始する小節をマイナスにしたとき）は、その分だけ
    // 何もスケジュールしない。出力位置は startAt で決まるので、そのまま無音になる。
    if (offset < 0) {
      const silence = Math.min(-offset, sourceLength)
      startTime += silence / rate
      sourceLength -= silence
      offset = 0
    }
    if (sourceLength <= 0 || offset >= buffer.duration) return
    sourceLength = Math.min(sourceLength, buffer.duration - offset)
    if (sourceLength <= 0) return

    // スライス全体にかけるクリックノイズ対策のフェード。実時間で書く。
    const realDuration = sourceLength / rate
    const sliceGain = context.createGain()
    const fade = Math.min(this.#fadeSeconds, realDuration / 3)
    if (fade > 0) {
      sliceGain.gain.setValueAtTime(0, startTime)
      sliceGain.gain.linearRampToValueAtTime(1, startTime + fade)
      sliceGain.gain.setValueAtTime(1, startTime + realDuration - fade)
      sliceGain.gain.linearRampToValueAtTime(0, startTime + realDuration)
    } else {
      sliceGain.gain.setValueAtTime(1, startTime)
    }
    sliceGain.connect(this.#master)

    if (rate === 1) {
      // 等速なら切り貼りは要らない。1 スライス 1 ノードで素通しする。
      this.#emit(startTime, offset, sourceLength, sliceGain, null)
      return
    }
    this.#emitStretched(startTime, offset, sourceLength, realDuration, sliceGain)
  }

  /**
   * ピッチを保ったまま長さを変える（OLA）。
   *
   * playbackRate を動かすと再生速度と一緒にピッチも動いてしまう。そこで各グレインは
   * 等速のまま鳴らし、読み出し位置だけを速度ぶん進める。隣り合うグレインを半分ずつ
   * 重ねて三角形の窓で足すと、振幅が一定のまま長さだけが変わる。
   *
   * グレインの読み出しはスライスの範囲内に収める。はみ出させると隣の拍の音が混じり、
   * 並べ替えた意味が薄れる（終端の振幅は落ちるが、そこはスライスのフェードが隠す）。
   */
  #emitStretched(
    startTime: number,
    offset: number,
    sourceLength: number,
    realDuration: number,
    sliceGain: GainNode,
  ): void {
    const rate = this.#rate
    const hop = Math.min(GRAIN_HOP, realDuration)
    const count = Math.max(1, Math.round(realDuration / hop))

    for (let index = 0; index < count; index += 1) {
      const isFirst = index === 0
      const isLast = index === count - 1
      const at = index * hop
      const grainStart = startTime + at
      const grainOffset = offset + at * rate

      const outLength = Math.min(
        isLast ? realDuration - at : hop * 2,
        // 音源側に残っている分を超えて読まない
        sourceLength - at * rate,
      )
      if (outLength <= 0.001) break

      const envelope = this.#context.createGain()
      const rise = Math.min(hop, outLength)
      envelope.gain.setValueAtTime(isFirst ? 1 : 0, grainStart)
      if (!isFirst) envelope.gain.linearRampToValueAtTime(1, grainStart + rise)
      if (!isLast) {
        envelope.gain.setValueAtTime(1, grainStart + rise)
        envelope.gain.linearRampToValueAtTime(0, grainStart + outLength)
      }
      envelope.connect(sliceGain)

      this.#emit(grainStart, grainOffset, outLength, envelope, sliceGain)
    }
  }

  /** バッファの一部を等速で 1 回だけ鳴らすノードを積む。 */
  #emit(
    at: number,
    offset: number,
    length: number,
    destination: GainNode,
    extra: GainNode | null,
  ): void {
    const buffer = this.#buffer
    if (!buffer || length <= 0) return
    const playable = Math.min(length, buffer.duration - offset)
    if (playable <= 0) return

    const source = this.#context.createBufferSource()
    source.buffer = buffer
    source.connect(destination)

    const nodes: AudioNode[] = extra ? [source, destination, extra] : [source, destination]
    const voice: ActiveVoice = { source, nodes }
    source.onended = () => {
      this.#active.delete(voice)
      source.disconnect()
      destination.disconnect()
    }
    source.start(at, offset, playable)
    this.#active.add(voice)
  }
}
