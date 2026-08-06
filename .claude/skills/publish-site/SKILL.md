---
name: publish-site
description: beat-swapper を GitHub Pages へ公開・更新する定型手順。develop の変更をビルドして pages ブランチへ反映し、公開後の疎通まで確認する。README を変えたときの master 同期、リポジトリを作り直したときの初期セットアップも含む。ユーザーが「公開」「デプロイ」「サイトを更新」「Pages を更新」と言ったときに使う。ローカルの開発・ビルドだけで完結する作業には使わない。
---

# サイトを公開する

`develop` の内容をビルドし、`pages` ブランチ経由で GitHub Pages へ反映する。

**公開は外部公開行為。実行前にユーザーの確認を取ること。**

## 1. 事前チェック

```bash
git rev-parse --abbrev-ref HEAD    # develop であること
git status --porcelain             # 空であること
npm run build                      # 型チェック込み
```

- `develop` 以外にいる場合は公開しない。`scripts/tbp.sh` が拒否する。
- 未コミットの変更があるとビルド結果には入るが履歴に残らない。先にコミットするか確認する。
- **アプリ本体（`index-*.js` + `index-*.css`）の gzip 合計が 30KB を超えたら公開せずに報告する**
  （CLAUDE.md の軽量方針）。`essentia-*` チャンクはこの予算の対象外。

## 2. 公開

```bash
bash scripts/tbp.sh publish        # dist の中身を pages ブランチへ
bash scripts/tbp.sh sync-master    # README.md / LICENSE を変更したときだけ
```

どちらも一時 worktree 経由なので、主作業ツリーは `develop` のまま変わらない。
差分がなければ何もしない（冪等）。

## 3. 事後確認

```bash
gh api repos/Yakinik/beat-swapper/pages --jq '.status, .html_url'
curl -sI https://yakinik.github.io/beat-swapper/ | head -1
```

- `status` が `built` になるまで初回は 1〜2 分かかる。`null` なら少し待って再確認する。
- 見た目や操作に関わる変更なら、公開 URL を実機で 1 回操作して確認する
  （曲を読み込む → 解析完了 → `2431` で再生 → 元の順と聴き比べ）。
- 実ブラウザ操作は `playwright-cli` を使う。`claude-in-chrome` は使わない。

## 4. 報告

「何を・どのブランチへ・公開 URL・バンドルサイズ」を必ず伝える。

## リポジトリを作り直したときの初期セットアップ

```bash
git config user.email "1999233+Yakinik@users.noreply.github.com"
git config user.name "Yakinik"

gh repo create beat-swapper --public --source=. --remote=origin \
  --description "Reorder the beats inside every bar and play the result, in the browser." \
  --homepage "https://yakinik.github.io/beat-swapper/"
git push -u origin develop
bash scripts/tbp.sh sync-master
bash scripts/tbp.sh publish
gh repo edit --default-branch master
gh api -X POST "repos/Yakinik/beat-swapper/pages" \
  -f "source[branch]=pages" -f "source[path]=/"
```

- **リポジトリは必ず public にする。** essentia.js が AGPL-3.0 なので、Pages で
  配信する以上ソースを公開する義務がある（LICENSE も AGPL-3.0）。
- `gh repo delete` には `delete_repo` スコープが要る。無い場合はユーザーに
  `gh auth refresh -h github.com -s delete_repo` の実行を依頼する（対話認証が必要）。
- Pages 有効化が 409 なら有効化済み。配信元を変えるなら同じ API を `-X PUT` で叩く。

## つまずいたとき

| 症状 | 原因と対処 |
| --- | --- |
| `run this from 'develop'` | 主作業ツリーが develop にいない |
| 公開ページが旧版のまま | Pages のビルド待ち。`gh api repos/Yakinik/beat-swapper/pages/builds/latest --jq .status` |
| 公開ページが 404 | Pages の配信元が `pages` / `/` になっているか確認 |
| worktree の残骸が疑わしい | `git worktree prune` |
