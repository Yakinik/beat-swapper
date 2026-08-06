# beat-swapper 初期実装

曲を読み込んで BPM と拍位置を自動解析し、各小節の拍を `2431` のような順に入れ替えて
通しで再生するツールを作る。設計の元ネタは ChatGPT の共有会話、実装規約とブランチ運用は
`../instant-mask` を踏襲。

**確定事項（ユーザー確認済み）**

| 項目 | 決定 |
| --- | --- |
| 解析エンジン | Essentia.js `RhythmExtractor2013(multifeature)`。LICENSE は AGPL-3.0 |
| 作業範囲 | 実装 + ローカル確認まで。GitHub リポジトリ作成 / Pages 公開は次ステップ |
| 並べ替え仕様 | 4 拍の順列に加え、重複・省略も許す（`1133` `124` `12344`） |

## やること

- [x] リポジトリの器（git init / develop / アカウント設定 / Vite・TS・Preact の設定 / LICENSE）
- [x] shared レイヤ（Button / Slider / SegmentedControl / Icon / class-name / format-time）
- [x] 音源の入り口（decode + 44.1kHz モノラル化 + DropZone + 波形表示）
- [x] 解析（beat-analyzer.worker + analyzer-client。Essentia のバンドルが通ること）
- [x] 1 拍目の決定（downbeat 推定 + 4 段階シフト + 波形クリック吸着）
- [x] 並べ替えと再生（slice-plan → 先読みスケジューラ → TransportBar）
- [x] 仕上げ（再生位置ハイライト / ループ / フェード長 / エラー表示 / ダーク・ライト）
- [x] 検証用音源（正解つきテストトーン + CC0・CC BY の実曲取得スクリプト）
- [x] ドキュメントとブランチ運用（README / CLAUDE.md / AGENTS.md / docs / tbp.sh / publish-site）
- [x] `develop` にコミット（リモート追加・公開はしない）

## 途中で足したこと

- [x] 波形を「全体」＋「拡大 2 小節」の 2 枚にした。全体表示だけだと 4 分の曲で 1 小節が
      4.7px にしかならず、「波形クリックで 1 拍目を指定」が成立していなかった
- [x] `vite preview` で `base` が `/` に落ちる問題を修正（`isPreview` を見る）
- [x] `scripts/fetch-samples.mjs` の取得を `fetch` から `node:https` へ変更。
      undici は接続タイムアウトが 10 秒固定で、archive.org のデータノードに届かない。
      あわせて 1 曲の失敗で全体が止まらないようにし、content-length で切れを検出する

## Review

### 何を作ったか

FSD v2.1 の 3 レイヤ（`app` / `pages/swapper` / `shared`）。重い DSP は Worker、判断と UI は
メインスレッドという分離になっている。

- `lib/beat-analyzer.worker.ts` … essentia.js を import する唯一の場所。動的 import なので
  曲を読み込むまで 2.5MB のチャンクは落ちてこない
- `lib/beat-signal.ts` … PCM を 1 パスで走査し、フレーム単位の帯域別 RMS へ畳む。
  帯域信号を丸ごと配列に持つと 5 分の曲で数百MB になるため
- `lib/downbeat.ts` / `lib/slice-plan.ts` … 副作用のない純関数。そのまま数値で検算できる
- `lib/scheduler.ts` … 1.5 秒先まで先読みするスケジューラ。全スライス一括スケジュールだと
  数千ノードを作ることになり、停止も差し替えもできない

### 検証結果

正解の分かる `00-test-120bpm.wav`（120BPM / 4/4 / 最初の拍 0.5s）で:

| 項目 | 期待 | 実測 |
| --- | --- | --- |
| BPM | 120 | 119.967 |
| 拍間隔 | 0.5s | 平均 0.50017 / 最大誤差 0.0124 |
| 1 拍目 | 0.5 + 2.0×k | phase 0 → 0.4876s（一致） |
| 位相スコア | 0 番が突出 | [2.964, -1.339, -0.362, -1.348] |
| `2431` | 小節長 2.0s 不変 | 2.0008s / 60 スライス |
| `1133` | 拍 [1,1,3,3] | 2.0031s / 60 スライス |
| `124` | 3/4 に短縮 | 1.5008s / 45 スライス |

実曲 5 本（house 125.11 / techno 128.11 / minimal 120.05 / electronica 128.99 /
手持ち 89.99 BPM）でも解析成功。`decodeAudioData` が 48kHz を返すケースも含め、
44.1kHz モノラル化の経路を通っている。解析時間は 3〜6 分の曲で 9〜15 秒。

UI と再生（playwright-cli、dev / 本番ビルド両方）:

- 再生位置が AudioContext の時刻に対して 1.00 倍で進む、鳴っている拍が `2,4,3,1` の順に並ぶ
- 再生中に並び順を変えても同じ小節から鳴り続ける（`1133` で全体長 270.38→271.12 秒）
- 壊れた入力はエラーを出しつつ直前の有効な並びで鳴り続ける
- 「元の順」に切り替えると拍が `1,2,3,4` の昇順になる
- コンソールにエラー・警告なし
- 初期ロードは `index.js` + `index.css` だけ（gzip 19.2KB）。曲を読み込んだ時点で
  worker → essentia core → essentia wasm の順に取得される

### 残課題・申し送り

- **公開はしていない。** `gh repo create` も `scripts/tbp.sh publish` も実行していない。
  `master` / `pages` ブランチも未作成（`tbp.sh` が初回に orphan で作る）
- **LICENSE は AGPL-3.0。** essentia.js のコピーレフトが及ぶので、Pages で公開するなら
  リポジトリは public にする必要がある
- 並べ替え結果の WAV 書き出しは今回のスコープ外。`slice-plan` をそのまま
  `OfflineAudioContext` に流せる形にはしてある
- 1 拍目の自動推定はヒューリスティック。イントロにドラムがない曲、弱起、ライブ演奏、
  変拍子では外れる。手動補正でカバーする設計
- `.claude/settings.local.json` に `playwright-cli` の許可を足そうとしたが、権限設定の
  変更は自動承認の対象外で書き込めなかった。必要ならユーザー側で追加する
- `tasks/done/2026-08-06-add-free-sample-tracks.md` に記録された Night Owl の BPM
  （91 / 297 拍）と、今回の計測（128.99 / 416 拍）が食い違っている。今回の値は
  416 拍 ÷ 194.1 秒 = 128.6 BPM と内部整合しているので、記録側の取り違えの可能性が高い
