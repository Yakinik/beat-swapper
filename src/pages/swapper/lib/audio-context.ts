let context: AudioContext | null = null

/**
 * アプリ全体で 1 つだけ持つ AudioContext。デコードにも再生にも同じものを使う。
 * 生成直後は suspended のことがあるので、音を出す前に resumeAudioContext() を呼ぶ。
 */
export function getAudioContext(): AudioContext {
  context ??= new AudioContext()
  return context
}

export async function resumeAudioContext(): Promise<void> {
  const audio = getAudioContext()
  if (audio.state === 'suspended') await audio.resume()
}
