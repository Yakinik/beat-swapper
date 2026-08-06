# サンプル音源に有名なフリー楽曲を追加する

## 背景

`samples/` にはローカル検証用の音源を置いている。現状は Internet Archive の netlabel
コレクションにある CC0 の 3 曲だが、いずれも無名なので聴いたときの手応えが薄い。
「有名なフリー楽曲」を 3 曲追加したい。

前提（ユーザー確認済み）:

- GitHub Pages では公開しない。あくまでローカル検証用
- `samples/` は `.gitignore` 対象で、公開ビルド（dist）にも入らない

## ライセンス要件

beat-swapper は拍を並び替えるツールなので、**改変（二次的著作物の作成）が許諾されて
いること**が必須。加えて `scripts/fetch-samples.mjs` で自動取得する以上、**音源ファイル
への直リンクと bot による取得が許諾されていること**も必要。

- [x] 「2:23 AM」（しゃろう / DOVA-SYNDROME）の利用条件を調査
  - **不採用**。[音源利用ライセンス](http://dova-s.jp/help/articles/license/) と
    [サイト利用規約](https://dova-s.jp/help/articles/terms/) に以下の抵触があった
    1. 音源ファイル URL への直リンク禁止／bot 等プログラムによる自動収集禁止
       → `fetch-samples.mjs` の方式そのものが不可（playwright 等のブラウザ自動化も同様）
    2. 「音源の再生が主機能の製品・アプリ」での利用禁止 → beat-swapper が該当
    3. 「エンドユーザーが音源に容易にアクセス可能な状態」の禁止
    4. 加工は許可されるが「元の音源から乖離し、著しく損なう加工は不可」
       → 拍の並び替えは抵触の恐れ
  - ユーザー自身がブラウザで手動取得して `samples/` に置く分には私的利用の範囲。
    自動取得スクリプトには登録しない
- [x] 代替として CC0 / CC BY の楽曲を選定（改変自由・直リンク可・将来公開しても安全）

## 選定した 3 曲

| 曲 | アーティスト | ライセンス | 出典 | 選定理由 |
| --- | --- | --- | --- | --- |
| Night Owl | Broke For Free | CC BY 3.0 | archive.org `Directionless_EP-8295` | Free Music Archive 屈指の定番。ビート明瞭なエレクトロニカ |
| Sneaky Snitch | Kevin MacLeod | CC BY 4.0 | archive.org `KevinMacLeod` | 世界で最も使われているフリー BGM 作家の代表曲 |
| Let's Start at the Beginning | Lee Rosevere | CC BY 3.0 | archive.org `LeeRosevere_MusicForPodcasts` | ポッドキャスト BGM の定番 |

Kevin MacLeod は archive.org 側のアイテムが CC0 を掲げているが、原著作者の公式表記
（[incompetech](https://incompetech.com/music/royalty-free/faq.html)）は CC BY 4.0。
安全側に倒して CC BY 4.0 として扱い、クレジットを記載する。

## 作業項目

- [x] `scripts/fetch-samples.mjs` を楽曲ごとのライセンスに対応させる
      （現状は全曲 CC0 前提でハードコードされている）
- [x] archive.org のパス区切りを壊さない URL エンコードに修正
      （`Soundtrack/Sneaky Snitch.mp3` のようにパスへスラッシュを含む曲がある）
- [x] 選定した 3 曲を `SAMPLES` に追加
- [x] `samples/README.md` の生成をライセンス表記・クレジット表記に対応させる
- [x] 手動で置いた音源（2:23 AM など）を `samples/README.md` に自動で列挙する
- [x] `node scripts/fetch-samples.mjs` で 3 曲が取得できることを確認
- [x] 追加した音源が実際にアプリで解析・再生できることを確認

## レビュー

### 実施内容

1. **ライセンスをサンプル単位に**: `LICENSE` 定数（全曲 CC0 前提）を `LICENSES` テーブル
   に置き換え、各サンプルが `license` キーで参照する形にした。CC BY 曲には `credit`
   （出典表記の文面）を持たせている。
2. **URL エンコードの修正**: `encodeURIComponent(file)` はパス区切りの `/` まで
   `%2F` にしてしまい、`Soundtrack/Sneaky Snitch.mp3` のような曲で 404 になる。
   セグメントごとにエンコードする `encodePath()` を追加した。
3. **3 曲を追加**: 04〜06 番として登録。既存の CC0 3 曲は削除せず残した（House /
   Techno / Minimal は 4 つ打ちで拍が明瞭なため、ビート解析の検証に有用なので）。
4. **README 生成の刷新**: ライセンス列とクレジット表記セクションを追加。さらに
   `SAMPLES` に無い音声ファイルを「手動で配置した音源」として自動列挙するようにした。
   DOVA-SYNDROME の曲名や URL をリポジトリ側（コミット対象）に書かずに済む設計。

### 確認結果

- `node scripts/fetch-samples.mjs` — 3 曲とも取得成功（合計 19.4MB）。既存曲は skip
- 手動配置ファイルの検出 — ダミーファイルで検証し、README に列挙されることを確認
- ブラウザ検証（playwright-cli / Chromium） — 3 曲すべて読み込み・解析・再生が成功
  - Night Owl: 91 BPM / 297 beats、Sneaky Snitch: 100 BPM / 226 beats、
    Let's Start at the Beginning: 110 BPM / 283 beats
  - 拍の並び替え（1-2-3-4 → 4-3-2-1）を適用した再生も動作

### 残課題・申し送り

- 「2:23 AM」はユーザーが手動で `samples/` に配置する運用。スクリプトには登録しない
- Kevin MacLeod のライセンスは archive.org（CC0）と公式（CC BY 4.0）で食い違う。
  厳しい側の CC BY 4.0 を採用しているので、公開用途に転じても表記の追加は不要
</invoke>
