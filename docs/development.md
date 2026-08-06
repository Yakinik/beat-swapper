# 開発メモ

## セットアップ

```bash
npm install
npm run dev     # 開発サーバー
npm run build   # 型チェック + 本番ビルド（dist/）
npm run preview # dist を /beat-swapper/ で配信して本番と同じ形で確認
```

検証用の音源を用意する（どちらも `samples/` に置かれ、`.gitignore` 対象）。

```bash
node scripts/make-test-tone.mjs   # 120BPM・4/4・正解の分かる WAV
node scripts/fetch-samples.mjs    # CC0 / CC BY の実曲を Internet Archive から取得
```

## ブランチ運用

| ブランチ | 役割 |
| --- | --- |
| `master` | README.md と LICENSE だけの情報掲示ブランチ（デフォルト） |
| `develop` | ソース一式。編集はここだけで行う |
| `pages` | ビルド成果物だけの公開ブランチ（GitHub Pages の配信元） |

`master` と `pages` は `scripts/tbp.sh` が一時 worktree 経由で全内容を再構成する。
手動でコミットを積まないこと（次回の同期で消える）。

```bash
bash scripts/tbp.sh publish       # ビルドして pages ブランチへ公開
bash scripts/tbp.sh sync-master   # README.md / LICENSE を master へ同期
```

## 構成

Feature-Sliced Design v2.1。単一画面なので `app` / `pages` / `shared` の 3 レイヤのみで、
`features` `entities` `widgets` は作っていない。

```
src/
  app/            エントリ、グローバル CSS
  pages/swapper/  画面固有のすべて（ui / model / lib / config）
  shared/         UI kit、汎用ライブラリ、定数
```

### 処理の流れ

```text
音声ファイル
 │
 ├─ decodeAudioData()                  → 再生用 AudioBuffer（端末のサンプルレート）
 └─ OfflineAudioContext(1, n, 44100)   → 解析用 Float32Array（44.1kHz モノラル）
         │ transfer
         ▼
   beat-analyzer.worker
     Essentia.js RhythmExtractor2013(multifeature) → bpm / ticks[] / confidence
     beat-grid.ts  曲頭・曲尾の取りこぼしを前後 1 小節まで外挿して埋める
     beat-signal.ts 帯域別 RMS から拍ごとの特徴量（低域・高域・立ち上がり）
         │
         ▼
   downbeat.ts   位相 0〜3 を推定（手動で 4 段階補正 / 拡大波形クリックで吸着）
         │
         ▼
   slice-plan.ts ticks + 位相 + 並び順 → BeatSlice[] { offset, duration, startAt }
         │
         ▼
   scheduler.ts  1.5 秒先まで先読みして AudioContext の時刻へ積む
                 BufferSource → GainNode(前後 4ms のフェード) → master → destination
```

- 重い DSP は Worker、判断と UI はメインスレッド。`beat-grid.ts` `downbeat.ts`
  `slice-plan.ts` は副作用のない純関数なので、そのまま数値で検算できる。
- Essentia は曲の最初の一撃を落とすことがある。そのまま使うと本当の 1 拍目がグリッド上に
  存在せず、位相をどれに選んでも指定できないうえ曲頭が再生から落ちる。`extendBeatGrid()`
  が前後 1 小節まで外挿して埋める（既に足りている曲には何も足さない）。
- 並び順は重複・省略を許すので、`1133` や `124` では出力側の小節長が元と変わる。
  各スライスの `startAt`（出力タイムライン上の開始位置）で位置を引く。
- 波形は「全体」と「拡大 2 小節」の 2 枚。4 分の曲では全体表示だと 1 小節が数 px しか
  なく、1 拍目のクリック指定が成立しないため。

## バンドル

| チャンク | gzip | 読み込むタイミング |
| --- | --- | --- |
| `index-*.js` + `index-*.css` | 約 19KB | 初期表示 |
| `beat-analyzer.worker-*.js` | 約 1KB | 最初の解析 |
| `essentia.js-core.es-*.js` | 約 9KB | 最初の解析 |
| `essentia-wasm.es-*.js` | 約 790KB | 最初の解析 |

essentia を読むのは解析ワーカーの中の動的 import だけなので、曲を読み込むまで
2.5MB のチャンクは落ちてこない。メインスレッドから essentia を import すると
この分離が崩れる。

## 検証

ブラウザ確認には `playwright-cli` を使う（`claude-in-chrome` は使わない）。

Vite の dev サーバーは TS をそのまま配信するので、ページの中から
`import('/src/pages/swapper/lib/slice-plan.ts')` のように読み込んで、実装を直接
数値で検算できる。アプリと同じモジュールインスタンスなので signal も読める。

**ただし HMR が効いていると `?t=` 付き URL が配信され、テスト側の `import()` が
別インスタンスになる。** 測る前に dev サーバーを再起動し、
`performance.getEntriesByType('resource')` に `/src/` かつ `?t=` を含む URL が
無いことを確かめること。

正解の分かる `00-test-120bpm.wav` で確認できること:

- BPM が 120 付近、拍間隔が 0.5 秒付近
- 自動推定した 1 拍目がキックの位置（0.5 + 2.0×k 秒）と一致する
- `2431` と `1234` で小節長が変わらず、`124` では 3/4 に縮む
