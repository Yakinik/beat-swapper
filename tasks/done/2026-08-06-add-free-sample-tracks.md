# サンプル音源に有名なフリー楽曲を追加する

## 背景

`samples/` にはローカル検証用の音源を置いている。当初は Internet Archive の netlabel
コレクションにある CC0 の 3 曲だけで、いずれも無名なので聴いたときの手応えが薄い。
「2:23 AM など有名なフリー楽曲」を 3 曲ほど追加したい、というのが出発点。

前提（ユーザー確認済み）:

- GitHub Pages では公開しない。あくまでローカル検証用
- `samples/` は `.gitignore` 対象で、公開ビルド（dist）にも入らない
- 「有名」は**日本で**有名、の意味（作業の途中で判明）

## ライセンス要件

beat-swapper は拍を並び替えるツールなので、**改変（二次的著作物の作成）が許諾されて
いること**が必須。加えて `scripts/fetch-samples.mjs` で自動取得する以上、**音源ファイル
への直リンクと bot による取得が許諾されていること**も必要。

### 調査した配布元

| 配布元 | 改変 | 直リンク / 自動取得 | ライセンス | 判定 |
| --- | --- | --- | --- | --- |
| [PeriTune](https://peritune.com/about/) | 自由 | 禁止規定なし | **CC BY 4.0**（2026年2月以前公開分） | ◎ 採用 |
| [BGMer](https://bgmer.net/terms) | 自由（AI 学習も可） | 未確認 | 独自 | △ 手動配置 |
| [魔王魂](https://maou.audio/rule/) | 自由（全ての改変を明示的に許可） | mp3/wav の直 URL 記載を禁止 | 独自 | △ 手動配置 |
| [甘茶の音楽工房](https://amachamusic.chagasi.com/terms.html) | 自由 | **直リンク明確に禁止** | 独自 | △ 手動配置 |
| [DOVA-SYNDROME](http://dova-s.jp/help/articles/license/) | 制限あり | 直リンク・bot 禁止 | 独自 | ✗ 自動取得不可 |

DOVA-SYNDROME（「2:23 AM」／しゃろう）を自動取得に載せられない理由:

1. 音源ファイル URL への直リンク禁止／bot 等プログラムによる自動収集禁止
   → `fetch-samples.mjs` の方式そのものが不可（playwright 等のブラウザ自動化も同様）
2. 「音源の再生が主機能の製品・アプリ」での利用禁止 → beat-swapper が該当
3. 「エンドユーザーが音源に容易にアクセス可能な状態」の禁止
4. 加工は許可されるが「元の音源から乖離し、著しく損なう加工は不可」
   → 拍の並び替えは抵触の恐れ

ユーザー自身がブラウザで手動取得して `samples/` に置く分には私的利用の範囲に収まる。
実際 `2_23_AM.mp3` は手動で配置済みで、スクリプトには登録していない。

### 結論：「日本で曲名まで有名」×「自動取得可」はほぼ空集合

日本で曲名が知られているフリー BGM は DOVA-SYNDROME（しゃろう）・魔王魂・甘茶の
音楽工房に集中しており、いずれも直リンク／自動取得を禁じている。逆に CC ライセンスで
自動取得できる PeriTune・OtoLogic は「サイトは有名だが曲名は知られていない」層。
そのため **自動取得ぶんは検証素材と割り切り、知名度がほしい曲は手動配置**という
二本立てにした。

## 採用した 3 曲（自動取得。すべて PeriTune / CC BY 4.0）

| 曲 | ファイル | ジャンル |
| --- | --- | --- |
| Cyber Noir | `04-cyber-peritune-cyber-noir.mp3` | Cyber / Techno |
| Kengeki（剣戟） | `05-japanese-rock-peritune-kengeki.mp3` | Japanese rock / Battle |
| Amenoshita3（雨の下） | `06-japanese-peritune-amenoshita3.mp3` | Japanese / Rhythmic |

作業の初期には欧米圏の定番（Night Owl / Broke For Free、Sneaky Snitch / Kevin MacLeod、
Let's Start at the Beginning / Lee Rosevere）を採用していたが、「日本で有名な曲がよい」
という指摘を受けて上記へ差し替えた。

## 手動配置の候補リスト（ユーザーへ提示済み）

規約の緩さ（この用途への適合度）と知名度はおおむね逆順になる。

1. **しゃろう / DOVA-SYNDROME** — 知名度は最上位。2:23 AM（配置済み）、
   野良猫は宇宙を目指した、3:03 PM ほか。作曲者ページ https://dova-s.jp/creator/detail/101
2. **魔王魂** — 「全ての改変を許可」と明記。シャイニングスター
   https://maou.audio/14_shining_star/ 、ロック01 https://maou.audio/game_rock01/
3. **BGMer** — 改変・アレンジ自由、クレジット任意。https://bgmer.net/
4. **甘茶の音楽工房** — 老舗の定番。https://amachamusic.chagasi.com/

## 作業項目

- [x] 「2:23 AM」（しゃろう / DOVA-SYNDROME）の利用条件を調査 → 自動取得は不可と判断
- [x] 日本の主要フリー BGM サイトの規約を調査し、自動取得できる配布元を特定
- [x] `scripts/fetch-samples.mjs` を楽曲ごとのライセンスに対応させる
      （元は全曲 CC0 前提でハードコードされていた）
- [x] archive.org 以外の配布元に対応させる（`url` / `page` を直接指定できるように）
- [x] archive.org のパス区切りを壊さない URL エンコードに修正
- [x] PeriTune の 3 曲を `SAMPLES` に登録
- [x] `samples/README.md` の生成をライセンス表記・クレジット表記に対応させる
- [x] 手動で置いた音源（2:23 AM など）を `samples/README.md` に自動で列挙する
- [x] `make-test-tone.mjs` の生成物を手動配置と区別する
- [x] `node scripts/fetch-samples.mjs` で 3 曲が取得できることを確認
- [x] 手動取得の候補リストをユーザーへ提示
- [ ] PeriTune 3 曲がアプリで解析・再生できることの確認
      → **未実施**（アプリを並行開発中のため、ユーザー判断でスキップ）

## レビュー

### 実施内容

1. **ライセンスをサンプル単位に**: `LICENSE` 定数（全曲 CC0 前提）を `LICENSES` テーブル
   に置き換え、各サンプルが `license` キーで参照する形にした。CC BY 曲には `credit`
   （出典表記の文面）を持たせている。
2. **配布元の抽象化**: Internet Archive の曲は従来どおり `item` / `file` から URL を
   組み立て、それ以外は `url`（直リンク）と `page`（出典ページ）を直接書く形にした。
   README の出典ラベルは `page` のホスト名から自動生成する。
3. **URL エンコードの修正**: `encodeURIComponent(file)` はパス区切りの `/` まで
   `%2F` にしてしまう。セグメントごとにエンコードする `encodePath()` を追加した。
4. **README 生成の刷新**: ライセンス列とクレジット表記セクションを追加。さらに
   `SAMPLES` にも `GENERATED` にも無い音声ファイルを「手動で配置した音源」として
   自動列挙するようにした。DOVA-SYNDROME の曲名や URL をコミット対象のファイルに
   書かずに済む設計。

### 確認結果

- `node scripts/fetch-samples.mjs` — PeriTune 3 曲を取得成功（合計 15.8MB）。既存の
  CC0 3 曲は skip
- `file(1)` による実体判定 — 3 曲とも MPEG layer III / 192kbps / 48kHz の正常な MP3
- `samples/README.md` — 6 曲の表、CC BY 3 曲のクレジット、生成音源、手動配置音源
  （`2_23_AM.mp3`）がすべて期待どおり出力されることを確認
- **未確認**: 最終的に採用した PeriTune 3 曲の解析・再生は検証していない

差し替え前に採用していた欧米 3 曲と、手動配置の `2_23_AM.mp3` については、
ブラウザ（playwright-cli / Chromium）で解析・再生・拍の並び替えまで動作を確認した。
スクリプトと `samples/` の仕組み自体は動く。そのときの実測値:

| 曲（差し替え前） | BPM | 拍 | 信頼度 |
| --- | --- | --- | --- |
| Night Owl / Broke For Free | 129.0 | 416 | 2.80 |
| Sneaky Snitch / Kevin MacLeod | 87.0 | 197 | 2.59 |
| Let's Start at the Beginning / Lee Rosevere | 96.9 | 250 | 2.76 |
| 2:23 AM / しゃろう（手動配置） | 90.0 | 291 | 3.84 |

> 訂正: この記録の初版には Night Owl を「91 BPM / 297 拍」と書いていたが、これは計測
> 前に書いた誤りだった。実測は上表のとおり 129.0 BPM / 416 拍。初期実装側の計測
> （128.99 BPM / 416 拍）とも一致する。

### 残課題・申し送り

- PeriTune 3 曲の解析結果（BPM・信頼度）は未測定。アプリ側が落ち着いたら確認し、
  拍が取りにくい曲があれば同じ CC BY 4.0 の別候補
  （`CyberPunk_City` / `Irregular` / `Rapid5` / `EpicBattle_J`）へ差し替えられる。
  いずれも `https://peritune.com/music/PerituneMaterial_<名前>.mp3` で取得できることは
  HTTP 200 で確認済み
- PeriTune は 2026 年 3 月以降に公開された楽曲が独自規約に変わっている。曲を追加する
  ときは公開日が 2026 年 2 月以前（= CC BY 4.0）であることを確認する
- 魔王魂・BGMer・甘茶の音楽工房・DOVA-SYNDROME の曲を使いたい場合は、配布ページから
  手動で取得して `samples/` へ置く。スクリプトには登録しない
</content>
