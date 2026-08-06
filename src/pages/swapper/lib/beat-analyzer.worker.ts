/// <reference lib="webworker" />
import type { AnalyzerRequest, AnalyzerResponse, BeatAnalysis } from './beat-analysis'
import { extendBeatGrid } from './beat-grid'
import { computeBeatFeatures, computeFrameBands } from './beat-signal'

// 拍解析ワーカー。essentia.js を import するのはこのファイルだけ。
//
// essentia-wasm.es.js は wasm を base64 で内包した 2.5MB の emscripten ビルドで、
// import した瞬間に同期的にインスタンス化される。動的 import にしているのは、
// ワーカーが起動した直後に「エンジン読み込み中」を通知してから待たせるため。

type EssentiaInstance = import('essentia.js/dist/essentia.js-core.es.js').default

let enginePromise: Promise<EssentiaInstance> | null = null

const loadEngine = async (): Promise<EssentiaInstance> => {
  const [{ default: Essentia }, { EssentiaWASM }] = await Promise.all([
    import('essentia.js/dist/essentia.js-core.es.js'),
    import('essentia.js/dist/essentia-wasm.es.js'),
  ])
  return new Essentia(EssentiaWASM)
}

const getEngine = (): Promise<EssentiaInstance> => (enginePromise ??= loadEngine())

const post = (message: AnalyzerResponse, transfer?: Transferable[]) => {
  if (transfer) self.postMessage(message, transfer)
  else self.postMessage(message)
}

const analyze = async (request: AnalyzerRequest): Promise<BeatAnalysis> => {
  const { id, pcm, sampleRate } = request

  post({ id, type: 'stage', stage: 'loading-engine' })
  const essentia = await getEngine()

  post({ id, type: 'stage', stage: 'tracking-beats' })
  const signal = essentia.arrayToVector(pcm)
  let bpm: number
  let ticks: Float32Array
  let confidence: number
  try {
    // multifeature は曲全体の統計を使うオフライン解析向け。degara より遅いが精度が高い。
    const rhythm = essentia.RhythmExtractor2013(signal, 208, 'multifeature', 40)
    bpm = rhythm.bpm
    confidence = rhythm.confidence
    // WASM ヒープ上のベクタは自分で解放する必要がある。
    ticks = rhythm.ticks.size() > 0 ? essentia.vectorToArray(rhythm.ticks) : new Float32Array(0)
    rhythm.ticks.delete()
    rhythm.estimates.delete()
    rhythm.bpmIntervals.delete()
  } finally {
    signal.delete()
  }

  // 曲頭・曲尾の取りこぼしを先に埋める。特徴量は拡張後のグリッドに対して取るので、
  // ticks と features の添字は必ず揃う。
  const grid = extendBeatGrid(ticks, pcm.length / sampleRate)
  const features = computeBeatFeatures(computeFrameBands(pcm, sampleRate), grid)
  return { bpm, ticks: grid, confidence, features }
}

self.onmessage = (event: MessageEvent<AnalyzerRequest>) => {
  const request = event.data
  void analyze(request).then(
    (analysis) => {
      post({ id: request.id, type: 'result', analysis }, [
        analysis.ticks.buffer as ArrayBuffer,
        analysis.features.low.buffer as ArrayBuffer,
        analysis.features.high.buffer as ArrayBuffer,
        analysis.features.onset.buffer as ArrayBuffer,
      ])
    },
    (error: unknown) => {
      post({
        id: request.id,
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    },
  )
}
