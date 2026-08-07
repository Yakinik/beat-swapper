# ライセンス表記の整備と GitHub Pages への初回公開

## 要件

- [x] 公開にあたって表記すべきライセンスを洗い出す
- [x] 表記を配布物に含める
- [x] GitHub Pages へ公開する（master をデフォルト、develop で開発、pages で公開）

## 調査結果

`dist/` に実際に入るものを調べた。essentia.js の wasm については、バイナリ中の
文字列を抽出して取り込まれているコンポーネントを特定した。

| 対象 | ライセンス | 求められること |
| --- | --- | --- |
| Preact / @preact/signals / signals-core | MIT | 著作権表示と許諾文を複製物に含める |
| essentia.js / Essentia C++ | AGPL-3.0 | すべての告知を保持する・ソースを提供する |
| Kiss FFT（wasm 内） | BSD-3-Clause | 著作権表示・条件・免責を添付物に再掲する |
| Eigen（wasm 内） | MPL-2.0 | MPL であることと入手方法を知らせる |
| TNT（wasm 内） | パブリックドメイン | 表記のみ |

FFTW / TagLib / FFmpeg / Chromaprint（GPL・LGPL のもの）は**含まれていなかった**。

**実際にあった不備**: 本番ビルドの最小化で essentia.js の AGPL ヘッダコメントが
落ちていた（`dist/assets/essentia-wasm.es-*.js` に copyright 0 件）。

## 対処

- `scripts/collect-licenses.mjs` が `node_modules` の LICENSE を読んで
  `public/THIRD-PARTY-NOTICES.txt` を生成する。`npm run build` の先頭で走るので
  依存を更新したら自動で追従する。内容を手で書き写さない
- `vite.config.ts` の `licenseBanner` プラグインが、告知の在り処を全チャンクの先頭に
  残す。`rollupOptions.output.banner` は Rolldown では効かないので `generateBundle` で足す
- AGPL 第 13 条に応えて、フッターへソースコードと同梱ライセンスへのリンクを置いた

## Review

### 公開の構成

| ブランチ | 役割 | 中身 |
| --- | --- | --- |
| `master`（デフォルト） | 情報掲示 | `LICENSE` `README.md` |
| `develop` | 開発ソース | ソース一式 |
| `pages` | Pages 配信元 | `.nojekyll` `index.html` `assets` `THIRD-PARTY-NOTICES.txt` |

- リポジトリ: https://github.com/Yakinik/beat-swapper（PUBLIC）
- 公開 URL: https://yakinik.github.io/beat-swapper/
- instant-mask と同じ構成（default=master / Pages source=pages `/`）

### 公開時につまずいた点

初回の `pages build and deployment` が失敗した。原因は GitHub 側の障害で、
こちらの内容には触れる前の「Set up job」段階だった。

```
Failed to resolve action download info. Error: Service Unavailable
##[error]Internal Server Error
```

GitHub Status も Pages が `major_outage`、Actions のインシデント調査中を示していた。
**リポジトリには一切手を入れず**、`POST /repos/.../pages/builds` でビルドを要求し直す
だけで復旧後に成功した。再プッシュ・force-push・デプロイ方式の変更・リポジトリの
作り直しはしていない。

### 公開サイトでの確認

| 項目 | 結果 |
| --- | --- |
| 初期ロード | `index.js` + `index.css` のみ（Essentia は落ちてこない） |
| 曲を読み込んだ後 | worker → essentia core → essentia wasm の順に取得 |
| 解析 | 120BPM のクリックトラックで BPM **119.95** / 開始位置 488ms |
| 再生 | 7 秒で 0:01→0:08（実時間どおり） |
| 告知ファイル | 200 / 41,537 バイト / 7 コンポーネントの節 |
| フッターのリンク | Essentia.js・ソースコード・同梱ライセンスの 3 本とも正しい |

初回再生時に一度だけ `AudioContext encountered an error from the audio device` が
出たが、再測定では再現せず再生時刻も 1:1 で進んだ。音声デバイスを持たない自動操作
ブラウザ側の事情とみている。

### 残課題・申し送り

- Essentia は**非商用利用**について AGPL-3.0。商用化するなら UPF から別途ライセンスが
  要る（README と告知ファイルに明記済み）
- 依存を足したら `scripts/collect-licenses.mjs` の `PACKAGES` に追記する。wasm の中身が
  変わる依存なら、実際に何が取り込まれたか確認してから `EMBEDDED` を直す
- AGPL 第 13 条があるので、フッターのソースリンクを外さない・リポジトリを private に
  しない
