import { ANALYSIS_SAMPLE_RATE } from './beat-analysis'
import { getAudioContext } from './audio-context'

// 音声ファイルを 2 つの形に変える。
//
//   再生用 … decodeAudioData がそのまま返す AudioBuffer（端末のサンプルレート）
//   解析用 … 44.1kHz モノラルの PCM（RhythmExtractor2013 の前提）
//
// decodeAudioData は AudioContext のサンプルレートへ変換するため、端末によっては
// 48kHz になる。解析にだけ 44.1kHz へ落とし、再生には元の AudioBuffer を使う。

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const bytes = await file.arrayBuffer()
  try {
    return await getAudioContext().decodeAudioData(bytes)
  } catch {
    throw new Error('この音声ファイルは読み込めませんでした（対応していない形式か、壊れています）')
  }
}

/**
 * 解析用の 44.1kHz モノラル PCM を作る。
 * 返す配列はワーカーへ transfer できるように必ずコピーする（AudioBuffer の内部
 * バッファをそのまま渡すと、transfer で再生用データまで detach されてしまう）。
 */
export async function toAnalysisPcm(buffer: AudioBuffer): Promise<Float32Array> {
  if (buffer.sampleRate === ANALYSIS_SAMPLE_RATE && buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0).slice()
  }

  const frames = Math.max(1, Math.ceil(buffer.duration * ANALYSIS_SAMPLE_RATE))
  const offline = new OfflineAudioContext(1, frames, ANALYSIS_SAMPLE_RATE)
  const source = offline.createBufferSource()
  source.buffer = buffer
  // destination が 1ch なので、接続するだけでステレオは自動でダウンミックスされる。
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0).slice()
}
