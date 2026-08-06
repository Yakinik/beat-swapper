import type {
  AnalysisStage,
  AnalyzerRequest,
  AnalyzerResponse,
  BeatAnalysis,
} from './beat-analysis'

// 解析ワーカーの生存管理。ワーカーは essentia.js の WASM を抱えたまま常駐させ、
// 2 曲目以降は再インスタンス化のコスト（約 1 秒）を払わずに済ませる。

interface PendingRequest {
  resolve: (analysis: BeatAnalysis) => void
  reject: (error: Error) => void
  onStage: (stage: AnalysisStage) => void
}

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, PendingRequest>()

const handleMessage = (event: MessageEvent<AnalyzerResponse>) => {
  const message = event.data
  const request = pending.get(message.id)
  if (!request) return

  if (message.type === 'stage') {
    request.onStage(message.stage)
    return
  }
  pending.delete(message.id)
  if (message.type === 'result') request.resolve(message.analysis)
  else request.reject(new Error(message.message))
}

const handleError = (event: ErrorEvent) => {
  const error = new Error(event.message || '解析ワーカーが停止しました')
  for (const request of pending.values()) request.reject(error)
  pending.clear()
  worker?.terminate()
  worker = null
}

const getWorker = (): Worker => {
  if (!worker) {
    worker = new Worker(new URL('./beat-analyzer.worker.ts', import.meta.url), {
      type: 'module',
      name: 'beat-analyzer',
    })
    worker.onmessage = handleMessage
    worker.onerror = handleError
  }
  return worker
}

/**
 * 44.1kHz モノラルの PCM から BPM と拍位置を解析する。
 * `pcm` はワーカーへ transfer するので、呼び出し後に触ってはいけない。
 */
export function analyzeBeats(
  pcm: Float32Array,
  sampleRate: number,
  onStage: (stage: AnalysisStage) => void,
): Promise<BeatAnalysis> {
  const id = nextId++
  const request: AnalyzerRequest = { id, pcm, sampleRate }
  return new Promise<BeatAnalysis>((resolve, reject) => {
    pending.set(id, { resolve, reject, onStage })
    getWorker().postMessage(request, [pcm.buffer as ArrayBuffer])
  })
}
