import { signal } from '@preact/signals'

export interface Track {
  name: string
  /** 再生用。元のチャンネル数・サンプルレートのまま */
  buffer: AudioBuffer
  /** 波形表示用の列ごとの最大振幅 */
  peaks: Float32Array
}

export const track = signal<Track | null>(null)
