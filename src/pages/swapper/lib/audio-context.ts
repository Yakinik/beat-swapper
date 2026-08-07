let context: AudioContext | null = null

/**
 * アプリ全体で 1 つだけ持つ AudioContext。デコードにも再生にも同じものを使う。
 * 生成直後は suspended のことがあるので、音を出す前に unlock/resume を通す。
 */
export function getAudioContext(): AudioContext {
  context ??= new AudioContext()
  return context
}

/**
 * ユーザー操作と同じタスクの中で AudioContext を解錠する。
 *
 * iOS は resume() を待っているあいだにユーザー操作の資格が切れることがあるので、
 * await を挟む前に、同期的に無音を 1 サンプル鳴らしておく。これが Web Audio を
 * 解錠する定石。クリックハンドラから最初の await より前に呼ぶこと。
 */
export function unlockAudioContext(): void {
  const audio = getAudioContext()

  // iOS の消音スイッチを無視して鳴らす。既定の 'auto' は Safari では ambient 相当に
  // 落ち、スイッチに従うので無音になる。'playback' は排他カテゴリなので他アプリの
  // 音楽は止まるが、音を聴くことが主機能のツールなのでそちらを取る。
  // モジュール読み込み時ではなく再生操作の中で設定すること（押す前に他アプリの
  // 音楽を止めてしまわないため）。未対応のブラウザでは何もしない。
  const session = navigator.audioSession
  if (session) session.type = 'playback'

  void audio.resume()
  try {
    const silence = audio.createBufferSource()
    silence.buffer = audio.createBuffer(1, 1, audio.sampleRate)
    silence.connect(audio.destination)
    silence.start(0)
  } catch {
    // 解錠済みなら失敗しても構わない
  }
}

export async function resumeAudioContext(): Promise<void> {
  const audio = getAudioContext()
  // iOS は着信やバックグラウンド化で 'interrupted' になる。suspended だけを見ない。
  if (audio.state !== 'running') await audio.resume()
}
