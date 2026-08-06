// essentia.js@0.1.3 は ES ビルドに型定義が紐づいていない（dist/core_api.d.ts は
// UMD 向け）。ここでは実際に使う分だけを宣言する。

declare module 'essentia.js/dist/essentia-wasm.es.js' {
  /**
   * emscripten の Module オブジェクト。この ES ビルドは wasm を base64 で内包し、
   * import 時に同期的にインスタンス化される（`instantiateSync`）。
   * 2.5MB あるのでメインスレッドから import してはいけない。
   */
  export const EssentiaWASM: object
}

declare module 'essentia.js/dist/essentia.js-core.es.js' {
  /** WASM ヒープ上の float 配列。使い終わったら delete() すること。 */
  export interface VectorFloat {
    size(): number
    get(index: number): number
    delete(): void
  }

  export interface RhythmExtractor2013Result {
    /** 推定テンポ [bpm] */
    bpm: number
    /** 各拍の時刻 [s] */
    ticks: VectorFloat
    /** 拍検出の信頼度（multifeature のみ。degara では常に 0） */
    confidence: number
    estimates: VectorFloat
    bpmIntervals: VectorFloat
  }

  export default class Essentia {
    constructor(wasmModule: object, isDebug?: boolean)
    version: string
    algorithmNames: string
    arrayToVector(array: Float32Array): VectorFloat
    vectorToArray(vector: VectorFloat): Float32Array
    /**
     * @param maxTempo 既定 208
     * @param method 'multifeature'（高精度・低速）または 'degara'（高速）
     * @param minTempo 既定 40
     */
    RhythmExtractor2013(
      signal: VectorFloat,
      maxTempo?: number,
      method?: string,
      minTempo?: number,
    ): RhythmExtractor2013Result
    shutdown(): void
    delete(): void
  }
}
