#!/usr/bin/env node
// ローカル検証用のサンプル音源を samples/ へ取得する。
//
// samples/ は .gitignore 対象で、公開ビルド（dist）にも入らない。音源そのものを
// リポジトリへコミットしないかわりに、このスクリプトで誰でも同じ曲を再取得できる。
//
// 収録曲はすべて Internet Archive にある CC0 / CC BY のトラック。beat-swapper は
// 拍を並び替える＝二次的著作物を作るツールなので、改変が許諾されていること（ND でない
// こと）と、音源ファイルへの直リンク・自動取得が許諾されていることを条件に選んでいる。
//
// ここに無い音源を手で samples/ へ置いてもよい。README には「手動で配置した音源」
// として列挙される。
//
//   node scripts/fetch-samples.mjs

import { createWriteStream } from 'node:fs'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import https from 'node:https'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'samples')

const LICENSES = {
  cc0: {
    label: 'CC0 1.0 Universal (Public Domain Dedication)',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  'cc-by-3.0': {
    label: 'CC BY 3.0',
    url: 'https://creativecommons.org/licenses/by/3.0/',
  },
  'cc-by-4.0': {
    label: 'CC BY 4.0',
    url: 'https://creativecommons.org/licenses/by/4.0/',
  },
}

/**
 * `credit` は CC BY のクレジット表記。CC0 の曲では省略する。
 *
 * @type {{ saveAs: string, item: string, file: string, title: string,
 *          artist: string, genre: string, license: keyof typeof LICENSES,
 *          credit?: string }[]}
 */
const SAMPLES = [
  {
    saveAs: '01-house-bindanox-life-in-pixels.mp3',
    item: 'Hfr042-Bindanox-Total-Freedom',
    file: 'Life In Pixels.mp3',
    title: 'Life In Pixels',
    artist: 'Bindanox',
    genre: 'House / Housefly Records [HFR042]',
    license: 'cc0',
  },
  {
    saveAs: '02-techno-33rd-rate-revs-x.mp3',
    item: 'SICMON010',
    file: '33RD_RATE_REVS_-_X_sicmon010.mp3',
    title: 'X',
    artist: '33rd Rate Revs',
    genre: 'Techno / Sick Monkey Records [SICMON010]',
    license: 'cc0',
  },
  {
    saveAs: '03-minimal-30-hcir-compl3x.mp3',
    item: '30-hcir-berthaJamesSplit-RWT-012',
    file: '1) 30-hcir - Compl3x.mp3',
    title: 'Compl3x',
    artist: '30-hcir',
    genre: 'Minimal techno / RW-Techordings [RWT-012]',
    license: 'cc0',
  },
  {
    saveAs: '04-electronica-broke-for-free-night-owl.mp3',
    item: 'Directionless_EP-8295',
    file: 'Broke_For_Free_-_01_-_Night_Owl.mp3',
    title: 'Night Owl',
    artist: 'Broke For Free',
    genre: 'Electronica / Directionless EP',
    license: 'cc-by-3.0',
    credit: 'Night Owl by Broke For Free',
  },
  {
    saveAs: '05-soundtrack-kevin-macleod-sneaky-snitch.mp3',
    item: 'KevinMacLeod',
    file: 'Soundtrack/Sneaky Snitch.mp3',
    title: 'Sneaky Snitch',
    artist: 'Kevin MacLeod',
    genre: 'Soundtrack / Comedic',
    // archive.org 側のアイテムは CC0 を掲げているが、原著作者の公式表記（incompetech.com）
    // は CC BY 4.0。厳しい側に合わせてクレジットを出す。
    license: 'cc-by-4.0',
    credit: 'Sneaky Snitch by Kevin MacLeod (incompetech.com)',
  },
  {
    saveAs: '06-ambient-lee-rosevere-lets-start-at-the-beginning.mp3',
    item: 'LeeRosevere_MusicForPodcasts',
    file: "Lee Rosevere - Music For Podcasts - 01 Let's Start at the Beginning.mp3",
    title: "Let's Start at the Beginning",
    artist: 'Lee Rosevere',
    genre: 'Ambient / Music For Podcasts',
    license: 'cc-by-3.0',
    credit: "Let's Start at the Beginning by Lee Rosevere",
  },
]

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.opus']

/** scripts/make-test-tone.mjs が作るファイル。手動配置とは区別する。 */
const GENERATED = ['00-test-120bpm.wav']

/** パス区切りの `/` を残したまま各セグメントをエンコードする。 */
const encodePath = (/** @type {string} */ path) =>
  path.split('/').map(encodeURIComponent).join('/')

const downloadUrl = (/** @type {(typeof SAMPLES)[number]} */ sample) =>
  `https://archive.org/download/${sample.item}/${encodePath(sample.file)}`

const itemUrl = (/** @type {(typeof SAMPLES)[number]} */ sample) =>
  `https://archive.org/details/${sample.item}`

const exists = async (/** @type {string} */ path) => {
  try {
    return (await stat(path)).size > 0
  } catch {
    return false
  }
}

/**
 * リダイレクトを追ってレスポンスストリームを返す。
 *
 * fetch（undici）は接続タイムアウトが 10 秒固定で、archive.org のデータノードは
 * ハンドシェイクに 15 秒以上かかることがある。node:https にはその上限が無い。
 */
const openStream = (/** @type {string} */ url, hops = 0) =>
  new Promise((resolve, reject) => {
    if (hops > 5) {
      reject(new Error('too many redirects'))
      return
    }
    https
      .get(url, { headers: { 'user-agent': 'beat-swapper-fetch-samples' } }, (response) => {
        const status = response.statusCode ?? 0
        const location = response.headers.location
        if (status >= 300 && status < 400 && location) {
          response.resume()
          resolve(openStream(new URL(location, url).toString(), hops + 1))
          return
        }
        if (status !== 200) {
          response.resume()
          reject(new Error(`HTTP ${status}`))
          return
        }
        resolve(response)
      })
      .on('error', reject)
  })

const download = async (/** @type {(typeof SAMPLES)[number]} */ sample) => {
  const target = join(OUT_DIR, sample.saveAs)
  if (await exists(target)) {
    console.log(`skip     ${sample.saveAs}`)
    return true
  }

  // 1 曲落とせなくても残りは取りに行く。取得元のノードが落ちていることがある。
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const stream = await openStream(downloadUrl(sample))
      const expected = Number(stream.headers['content-length'] ?? 0)
      await pipeline(stream, createWriteStream(target))

      const size = (await stat(target)).size
      // 途中で切れた音源をそのまま残すと、解析結果が静かに狂う
      if (expected > 0 && size !== expected) {
        throw new Error(`truncated (${size}/${expected} bytes)`)
      }
      console.log(`fetched  ${sample.saveAs} (${(size / 1024 / 1024).toFixed(1)}MB)`)
      return true
    } catch (error) {
      await rm(target, { force: true })
      const reason = error instanceof Error ? error.message : String(error)
      console.warn(`retry ${attempt}/3  ${sample.saveAs}: ${reason}`)
    }
  }
  console.warn(`FAILED   ${sample.saveAs}（あとで再実行すれば取得できることが多い）`)
  return false
}

/** SAMPLES にも GENERATED にも無い音声ファイル＝手で置いた音源。 */
const findManualFiles = async () => {
  const known = new Set([...SAMPLES.map((s) => s.saveAs), ...GENERATED])
  const entries = await readdir(OUT_DIR, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && !known.has(e.name))
    .map((e) => e.name)
    .filter((name) => AUDIO_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext)))
    .sort()
}

const licenseLink = (/** @type {keyof typeof LICENSES} */ key) => {
  const { label, url } = LICENSES[key]
  return `[${label}](${url})`
}

const writeCredits = async () => {
  const manual = await findManualFiles()
  const generated = []
  for (const name of GENERATED) {
    if (await exists(join(OUT_DIR, name))) generated.push(name)
  }
  const attributed = SAMPLES.filter((s) => s.credit)

  const lines = [
    '# 検証用サンプル音源',
    '',
    '`node scripts/fetch-samples.mjs` で取得した、拍の明瞭な 4/4 のトラック。',
    'すべて Internet Archive にある CC0 / CC BY の音源で、改変（拍の並び替え）が',
    '許諾されている。',
    '',
    'このディレクトリは `.gitignore` 対象で、公開ビルドにも含まれない。',
    '',
    '| ファイル | 曲 / アーティスト | ライセンス | 出典 |',
    '| --- | --- | --- | --- |',
    ...SAMPLES.map(
      (s) =>
        `| \`${s.saveAs}\` | ${s.title} — ${s.artist}<br>${s.genre} |` +
        ` ${licenseLink(s.license)} | [archive.org](${itemUrl(s)}) |`,
    ),
    '',
    '## クレジット表記',
    '',
    'CC BY の曲を使った成果物を公開するときは、次の表記が必要。',
    '',
    ...attributed.map(
      (s) =>
        `- ${s.credit} — Licensed under ${licenseLink(s.license)}` +
        ` / [source](${itemUrl(s)})`,
    ),
    '',
  ]

  if (generated.length > 0) {
    lines.push(
      '## 生成した音源',
      '',
      '`node scripts/make-test-tone.mjs` が作る、正解の分かっている検証用トーン。',
      '',
      ...generated.map((name) => `- \`${name}\``),
      '',
    )
  }

  if (manual.length > 0) {
    lines.push(
      '## 手動で配置した音源',
      '',
      'スクリプト管理外のファイル。取得元の利用規約は各自で確認すること。',
      '配布元によっては自動取得（bot / ブラウザ自動化）が禁止されているため、',
      'そうした音源はこのスクリプトに登録せず手で置く。',
      '',
      ...manual.map((name) => `- \`${name}\``),
      '',
    )
  }

  await writeFile(join(OUT_DIR, 'README.md'), lines.join('\n'), 'utf8')
}

await mkdir(OUT_DIR, { recursive: true })
let ready = 0
for (const sample of SAMPLES) {
  if (await download(sample)) ready += 1
}
await writeCredits()

const licenseSummary = [...new Set(SAMPLES.map((s) => LICENSES[s.license].label))]
console.log(`\nsamples/ に ${ready}/${SAMPLES.length} 曲を用意した。`)
console.log(`ライセンス: ${licenseSummary.join(' / ')}`)
if (ready < SAMPLES.length) process.exitCode = 1
