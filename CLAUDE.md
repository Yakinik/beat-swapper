# CLAUDE.md

ブラウザ完結の拍並べ替えツール。曲を解析して各小節の拍を `2431` のような順に
入れ替えて再生する。Vite + Preact + @preact/signals + CSS Modules + TypeScript。

## コミット

- identity は `Yakinik <1999233+Yakinik@users.noreply.github.com>`。リポジトリローカルに
  設定済み。個人の実メールアドレスでコミットしない。clone し直したときは
  `git config user.email` を設定してから作業する。
- `git add -A` / `git add .` は使わない（ユーザー設定で禁止されている）。パスを明示する。

## ブランチ運用

| ブランチ | 役割 |
| --- | --- |
| `master` | README.md と LICENSE だけの情報掲示ブランチ（デフォルト） |
| `develop` | ソース一式。編集はここだけで行う |
| `pages` | ビルド成果物だけの公開ブランチ（GitHub Pages の配信元） |

- `master` / `pages` は `scripts/tbp.sh` が一時 worktree 経由で全内容を再構成する管理対象。
  手動でコミットを積まない（次回の同期で消える）。
- 主作業ツリーで `master` / `pages` へ `git switch` しない。必要に見える作業はすべて
  `scripts/tbp.sh` の担当。
- 公開は外部公開行為。`scripts/tbp.sh publish` はユーザーの確認を取ってから実行する。

## ライセンス

**AGPL-3.0。** essentia.js が AGPL-3.0 なので、リンクしているこのアプリ全体に及ぶ。

- GitHub Pages での配信はネットワーク越しの提供にあたる。**リポジトリは public にして
  ソースを公開する**ことで義務を満たす。private 化しない。
- essentia.js を外す判断をするまで、このライセンスは変えられない。

## アーキテクチャ

Feature-Sliced Design v2.1。`app` / `pages/swapper` / `shared` の 3 レイヤのみ。

- `features` `entities` `widgets` は作らない。画面固有のものは `pages/swapper` のセグメント
  （ui / model / lib / config）に置く。同じコードが実際に複数箇所で使われるまで抽出しない。
- import は下位レイヤのみ。スライス外からは公開 API（`index.ts`）経由で参照する。
- ファイル名はドメイン基準。`types.ts` `utils.ts` のような技術的役割名は使わない。
- `shared` に業務ロジックを置かない（UI kit と汎用の文字列・時間整形まで）。
- 重い DSP は Worker（`lib/beat-signal.ts` `lib/beat-analyzer.worker.ts`）、判断と UI は
  メインスレッド（`lib/downbeat.ts` `lib/slice-plan.ts` は副作用のない純関数）。この分離を崩さない。

## 軽量方針

**アプリ本体（`index-*.js` + `index-*.css`）の gzip 合計は 30KB 以内**を上限とする
（現在 19.2KB）。上限に達したら、まず実装を見直す。それでも収まらないときはユーザーに
相談すること（勝手に上限を引き上げない）。

- essentia.js のチャンク（gzip 約 790KB）はこの予算の対象外。**初回の解析まで読み込まない**
  ことで成立している。メインスレッドから essentia を import してはいけない。
- UI ライブラリ、アイコンライブラリ、Web フォントは追加しない。アイコンはインライン SVG。

## 実装上の注意

- **essentia.js を import してよいのは `lib/beat-analyzer.worker.ts` だけ。** さらにその中でも
  動的 import にしてある。`essentia-wasm.es.js` は wasm を base64 で内包した 2.5MB のビルドで、
  import した瞬間に `instantiateSync()` が走って数百 ms〜1 秒スレッドを止める。
- **`RhythmExtractor2013` は入力が 44.1kHz 前提。** `decodeAudioData()` は AudioContext の
  サンプルレート（多くの端末で 48kHz）へ変換するので、解析用にだけ `OfflineAudioContext`
  で 44.1kHz モノラルへ落とす。再生には元の AudioBuffer を使う。
- WASM ヒープ上の `VectorFloat` は `.delete()` で明示的に解放する。
- **ワーカーへ PCM を transfer する前に波形のピークを取る。** transfer 後は触れない。
  また `AudioBuffer.getChannelData()` の戻り値はそのまま transfer してはいけない
  （再生用データごと detach される）。必ず `.slice()` でコピーする。
- **全スライスを一括スケジュールしない。** 数千ノードを作ることになり停止も差し替えも
  できなくなる。`lib/scheduler.ts` の先読みスケジューラ（1.5 秒先まで / 120ms 間隔）を使う。
  先読み幅はバックグラウンドタブで `setInterval` が 1 秒に間引かれても間に合う値。
- **つなぎ目のフェードはスライスの内側で完結させる。** 重ねてクロスフェードすると全体の
  長さが縮み、拍の位置が元とずれる。
- 並び順は重複・省略を許すので（`1133` `124`）、出力側の小節長は元と変わりうる。
  各スライスが持つ `startAt`（出力タイムライン上の開始位置）を必ず経由すること。
- **波形は「全体」と「拡大 2 小節」の 2 枚で描く。** 4 分の曲では全体表示だと 1 小節が
  数 px しかなく、1 拍目のクリック指定が成立しない。`PEAK_COLUMNS` を 32768 にしてあるのは
  拡大表示の解像度を確保するため。
- 1 拍目の推定（`lib/downbeat.ts`）はヒューリスティック。Essentia の `Meter` は公式にも
  experimental・not evaluated とされているので使っていない。外れる前提で手動補正を残す。
- `vite preview` では `command` が `'serve'` になる。`base` は `command === 'build' || isPreview`
  で判定する。そうしないと preview で `/beat-swapper/assets/*` が 404 になる。
- TypeScript 7 では `baseUrl` が使えない。`paths` は `./src/*` のように相対で書く。
- CSS Modules の `styles.foo` は `string | undefined` になる。`exactOptionalPropertyTypes`
  が有効なので、UI kit の `class` prop は `string | undefined` と書く（`string` では渡せない）。
- Vite 8 は Oxc ベース。JSX 設定は `esbuild` ではなく `oxc` に書く。

## 検証

- `npm run build`（型チェック込み）が通ること。
- ブラウザ確認は **`playwright-cli`** を使う。`claude-in-chrome` は使わない
  （ユーザーの実ブラウザが勝手に動いて驚かせるため）。
- 検証用の音源は `node scripts/fetch-samples.mjs`（CC0 / CC BY の実曲）と
  `node scripts/make-test-tone.mjs`（120BPM・4/4 の正解つき）で用意する。
  `samples/` は `.gitignore` 対象で、公開ビルドには入らない。
  全曲まわすと重いので、普段はテスト音源＋数曲のピックアップで足りる。
- サンプルに足すのは**改変が許諾されている（ND でない）音源だけ**。このツールは
  拍を並べ替える＝二次的著作物を作る。自動取得が許諾されていない配布元の音源は
  スクリプトに登録せず、手で `samples/` に置く。
- **dev サーバー経由でモジュールを import して検証するときは、事前に dev サーバーを
  再起動する。** HMR で `?t=` 付き URL が配信されていると、テスト側の `import()` が
  アプリとは別のモジュールインスタンスになり、signal を読んでも常に初期値が返る。
  `performance.getEntriesByType('resource')` に `/src/` かつ `?t=` を含む URL が無いことを
  確認してから測る。
- UI を変えたら実機で確認する: 曲を読み込む → 解析完了 → 拡大波形で 1 拍目が合っている →
  `2431` で再生 → 元の順と聴き比べ → 並び順を変えても再生が続く → 停止。

## プロセスの停止

**`pkill -f vite` のようなパターンマッチでプロセスを一括終了しない。** 他のセッションや
他プロジェクトで動いている開発サーバーまで巻き添えで落ちる。

- バックグラウンドで起動した開発サーバーは、その起動タスクを止めて終了させる
- 直接止めるときは `lsof -nP -iTCP:<port> -sTCP:LISTEN` で PID を特定し、
  そのコマンドラインがこのリポジトリのパスであることを確認してから `kill <pid>` する
- `killall` も同様に使わない
