#!/usr/bin/env node
// 正解の分かっている検証用音源を作る。
//
// 120BPM・4/4・最初の拍は 0.5 秒ちょうど。キックは 4 つ打ちで、1 拍目だけ低域を
// 強くし、2・4 拍目にスネアを置く。downbeat 推定のヒューリスティックが狙いどおり
// 効いているかを、耳ではなく数字で確かめるために使う。
//
//   node scripts/make-test-tone.mjs
//   → samples/00-test-120bpm.wav（既定で 32 秒）
//
// samples/ は .gitignore 対象なので、公開ビルドには入らない。

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'samples', '00-test-120bpm.wav')

export const SAMPLE_RATE = 44100
export const BPM = 120
export const FIRST_BEAT = 0.5
const SECONDS = 32

const beatInterval = 60 / BPM
const total = Math.round(SECONDS * SAMPLE_RATE)
const signal = new Float32Array(total)

/** 指数減衰する正弦波。キックとベースに使う。 */
const addTone = (at, frequency, seconds, gain, decay) => {
  const start = Math.round(at * SAMPLE_RATE)
  const length = Math.round(seconds * SAMPLE_RATE)
  for (let i = 0; i < length; i += 1) {
    const index = start + i
    if (index >= total) break
    const t = i / SAMPLE_RATE
    signal[index] += Math.sin(2 * Math.PI * frequency * t) * gain * Math.exp(-decay * t)
  }
}

/** 帯域を絞らないノイズ。スネアとハイハットに使う。 */
const addNoise = (at, seconds, gain, decay, seed) => {
  const start = Math.round(at * SAMPLE_RATE)
  const length = Math.round(seconds * SAMPLE_RATE)
  // 乱数を使わず再現可能にする（同じ入力からは必ず同じ WAV ができる）
  let state = seed
  for (let i = 0; i < length; i += 1) {
    const index = start + i
    if (index >= total) break
    state = (state * 1103515245 + 12345) & 0x7fffffff
    const noise = (state / 0x3fffffff - 1) * 0.5
    const t = i / SAMPLE_RATE
    signal[index] += noise * gain * Math.exp(-decay * t)
  }
}

let beat = 0
for (let at = FIRST_BEAT; at < SECONDS - 0.5; at += beatInterval) {
  const inBar = beat % 4

  // キックは 4 つ打ち。1 拍目だけ低域を厚くする。
  addTone(at, 55, 0.22, inBar === 0 ? 0.95 : 0.7, 22)
  if (inBar === 0) addTone(at, 41, 0.3, 0.5, 12)

  // スネアは 2・4 拍目
  if (inBar === 1 || inBar === 3) addNoise(at, 0.14, 0.45, 34, 1000 + beat)

  // ハイハットは 8 分
  addNoise(at, 0.03, 0.12, 150, 7000 + beat)
  addNoise(at + beatInterval / 2, 0.03, 0.1, 150, 9000 + beat)

  beat += 1
}

// 16bit PCM モノラルの WAV へ書き出す
const bytes = Buffer.alloc(44 + total * 2)
bytes.write('RIFF', 0)
bytes.writeUInt32LE(36 + total * 2, 4)
bytes.write('WAVE', 8)
bytes.write('fmt ', 12)
bytes.writeUInt32LE(16, 16)
bytes.writeUInt16LE(1, 20) // PCM
bytes.writeUInt16LE(1, 22) // モノラル
bytes.writeUInt32LE(SAMPLE_RATE, 24)
bytes.writeUInt32LE(SAMPLE_RATE * 2, 28)
bytes.writeUInt16LE(2, 32)
bytes.writeUInt16LE(16, 34)
bytes.write('data', 36)
bytes.writeUInt32LE(total * 2, 40)

for (let i = 0; i < total; i += 1) {
  const value = Math.max(-1, Math.min(1, signal[i] ?? 0))
  bytes.writeInt16LE(Math.round(value * 32767), 44 + i * 2)
}

await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, bytes)
console.log(
  `${OUT}\n  ${SECONDS}秒 / ${BPM}BPM / 4-4拍子 / 最初の拍 ${FIRST_BEAT}s / 拍間隔 ${beatInterval}s / ${beat}拍`,
)
