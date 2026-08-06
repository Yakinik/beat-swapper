#!/usr/bin/env node
// 配布物に含まれる第三者ソフトウェアのライセンス表記を組み立てる。
//
// 出力先は public/ なので、ビルドすると dist/ の直下へそのまま置かれ、
// 公開サイトから https://.../THIRD-PARTY-NOTICES.txt で読める。
//
// なぜ必要か:
//   - MIT / BSD-3-Clause は「複製物に著作権表示と許諾文を含める」ことを求める
//   - AGPL-3.0 は「すべての告知を保持する」ことを求めるが、ビルド時の最小化で
//     essentia のヘッダコメントは落ちる
//   - MPL-2.0 は実行形式で配布するとき「MPL であることと入手方法を知らせる」ことを求める
//
//   node scripts/collect-licenses.mjs

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'THIRD-PARTY-NOTICES.txt')

/** node_modules から実物の LICENSE を読むもの */
const PACKAGES = [
  { name: 'preact', role: 'UI ライブラリ' },
  { name: '@preact/signals', role: '状態管理' },
  { name: '@preact/signals-core', role: '状態管理' },
  { name: 'essentia.js', role: 'BPM・拍位置の解析（WebAssembly）' },
]

/**
 * essentia.js の WebAssembly に取り込まれている第三者コンポーネント。
 * wasm 内の文字列を調べて実際に含まれているものだけを挙げている
 * （FFTW / TagLib / FFmpeg / Chromaprint は含まれていない）。
 */
const KISS_FFT_NOTICE = `Copyright (c) 2003-2010 Mark Borgerding . All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
this list of conditions and the following disclaimer in the documentation
and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
may be used to endorse or promote products derived from this software without
specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.`

const EMBEDDED = [
  {
    name: 'Kiss FFT',
    holder: 'Mark Borgerding',
    license: 'BSD-3-Clause',
    source: 'https://github.com/mborgerding/kissfft',
    text: KISS_FFT_NOTICE,
  },
  {
    name: 'Eigen',
    holder: 'Eigen の各著作権者',
    license: 'MPL-2.0',
    source: 'https://eigen.tuxfamily.org/',
    text: `This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this file,
You can obtain one at https://mozilla.org/MPL/2.0/ .

ソース形式は上記の配布元から入手できます（本プロジェクトでは改変していません）。`,
  },
  {
    name: 'TNT (Template Numerical Toolkit)',
    holder: 'National Institute of Standards and Technology (NIST)',
    license: 'パブリックドメイン',
    source: 'https://math.nist.gov/tnt/',
    text: `NIST が作成したこのソフトウェアは著作権の対象外（パブリックドメイン）として
提供されています。`,
  },
]

const line = (char = '=') => char.repeat(76)

const section = (title) => `\n${line()}\n${title}\n${line()}\n`

const readLicense = async (name) => {
  const path = join(ROOT, 'node_modules', name, 'LICENSE')
  return (await readFile(path, 'utf8')).trimEnd()
}

const packageVersion = async (name) => {
  const path = join(ROOT, 'node_modules', name, 'package.json')
  return JSON.parse(await readFile(path, 'utf8')).version
}

const build = async () => {
  const own = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'))
  const parts = [
    `${own.name} — 第三者ソフトウェアのライセンス表記`,
    '',
    'このページ／アプリの配布物には、以下のソフトウェアが含まれています。',
    `${own.name} 自体は AGPL-3.0 で、全文はこのファイルの末尾にあります。`,
    '',
    'THIRD-PARTY NOTICES for ' + own.name,
    'This distribution includes the software listed below.',
  ]

  parts.push(section('同梱しているパッケージ'))
  for (const entry of PACKAGES) {
    const version = await packageVersion(entry.name)
    const text = await readLicense(entry.name)
    parts.push(`--- ${entry.name} ${version} — ${entry.role} ---\n`)
    // AGPL 全文は末尾に 1 つだけ置き、ここでは指し示すにとどめる
    if (text.includes('GNU AFFERO GENERAL PUBLIC LICENSE')) {
      parts.push('GNU Affero General Public License v3.0 の下で提供されています。')
      parts.push('全文はこのファイルの末尾（本体のライセンス）と同じものです。')
      parts.push('Copyright (C) 2006-2020 Music Technology Group - Universitat Pompeu Fabra')
      parts.push('入手先: https://github.com/MTG/essentia.js')
    } else {
      parts.push(text)
    }
    parts.push('')
  }

  parts.push(
    section('essentia.js の WebAssembly に取り込まれているコンポーネント'),
    'essentia.js の wasm は Essentia C++ を Emscripten でビルドしたものです。',
    'wasm 内の文字列を確認したところ、次のコンポーネントが含まれていました。',
    '（FFTW / TagLib / FFmpeg / Chromaprint は含まれていません）',
    '',
  )
  for (const entry of EMBEDDED) {
    parts.push(`--- ${entry.name} — ${entry.license} ---`)
    parts.push(`著作権者: ${entry.holder}`)
    parts.push(`入手先: ${entry.source}\n`)
    parts.push(entry.text)
    parts.push('')
  }

  parts.push(
    section('Essentia の利用条件についての注意'),
    'Essentia（および essentia.js）は非商用利用について AGPL-3.0 で提供されています。',
    '商用利用には Music Technology Group（Universitat Pompeu Fabra）から別途',
    'ライセンスを受ける必要があります。',
    'https://essentia.upf.edu/licensing_information.html',
    '',
  )

  const agpl = (await readFile(join(ROOT, 'LICENSE'), 'utf8')).trimEnd()
  parts.push(section(`${own.name} 本体のライセンス (AGPL-3.0)`), agpl, '')

  return parts.join('\n')
}

const notices = await build()
await writeFile(OUT, notices, 'utf8')
console.log(`${OUT}\n  ${notices.length} 文字 / ${PACKAGES.length + EMBEDDED.length} コンポーネント`)
