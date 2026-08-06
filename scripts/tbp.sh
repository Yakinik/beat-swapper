#!/usr/bin/env bash
# beat-swapper の三層ブランチ運用ヘルパー。
#
#   develop … ソース一式。唯一の編集場所（SSOT）
#   master  … README.md だけの情報掲示ブランチ（デフォルトブランチ）
#   pages   … ビルド成果物だけの公開ブランチ（GitHub Pages の配信元）
#
# master / pages への書き込みはすべて一時 worktree 経由で行う。主作業ツリーが
# ブランチを切り替えることはないので、未コミットの変更が消える事故が起きない。
# master / pages はこのスクリプトが全内容を再構成する管理対象なので、
# 手動でコミットを積まないこと（次回の同期で消える）。
set -euo pipefail

DEV="${BS_DEV_BRANCH:-develop}"
MAIN="${BS_MAIN_BRANCH:-master}"
PAGES="${BS_PAGES_BRANCH:-pages}"
BUILD_DIR="${BS_BUILD_DIR:-dist}"
MAIN_PATHS="${BS_MAIN_PATHS:-README.md LICENSE}"

die() {
  echo "tbp: error: $*" >&2
  exit 1
}
info() { echo "tbp: $*"; }

git rev-parse --show-toplevel >/dev/null 2>&1 || die "not inside a git repository"
cd "$(git rev-parse --show-toplevel)"

WT=""
cleanup() {
  if [ -n "$WT" ]; then
    git worktree remove --force "$WT" >/dev/null 2>&1 || rm -rf "$WT"
    git worktree prune >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

has_branch() { git rev-parse --verify --quiet "refs/heads/$1" >/dev/null; }

# $1 のブランチを一時 worktree に用意し、追跡ファイルを空にする。
checkout_empty() {
  WT="$(mktemp -d "${TMPDIR:-/tmp}/bs.XXXXXX")/wt"
  if has_branch "$1"; then
    git worktree add "$WT" "$1" >/dev/null
  else
    git worktree add --detach "$WT" "$DEV" >/dev/null
    git -C "$WT" switch --orphan "$1" >/dev/null
  fi
  git -C "$WT" rm -rqf --ignore-unmatch -- . >/dev/null 2>&1 || true
}

commit_and_push() { # $1=branch $2=message
  git -C "$WT" add -A
  if git -C "$WT" rev-parse --verify --quiet HEAD >/dev/null &&
    git -C "$WT" diff --cached --quiet; then
    info "$1: no changes"
  else
    git -C "$WT" commit -q -m "$2"
    info "$1: committed ($2)"
  fi
  if git remote get-url origin >/dev/null 2>&1; then
    git -C "$WT" push -u origin "$1"
  else
    info "$1: no 'origin' remote, push skipped"
  fi
}

cmd_publish() {
  has_branch "$DEV" || die "branch '$DEV' not found"
  [ "$(git rev-parse --abbrev-ref HEAD)" = "$DEV" ] || die "run this from '$DEV'"
  [ -n "$(git status --porcelain)" ] &&
    info "warning: working tree has uncommitted changes; they are built and published as-is"

  npm run build
  [ -d "$BUILD_DIR" ] || die "'$BUILD_DIR' was not created"

  checkout_empty "$PAGES"
  cp -R "$BUILD_DIR"/. "$WT"/
  : >"$WT/.nojekyll" # Jekyll を通さない
  commit_and_push "$PAGES" "publish: $DEV@$(git rev-parse --short HEAD)"
}

cmd_sync_main() {
  has_branch "$DEV" || die "branch '$DEV' not found"
  checkout_empty "$MAIN"
  local found=0 path
  for path in $MAIN_PATHS; do
    git cat-file -e "$DEV:$path" 2>/dev/null || continue
    git -C "$WT" restore --source="$DEV" --staged --worktree -- "$path"
    found=$((found + 1))
  done
  [ "$found" -gt 0 ] || die "none of BS_MAIN_PATHS ($MAIN_PATHS) exist on '$DEV'"
  commit_and_push "$MAIN" "docs: sync from $DEV@$(git rev-parse --short "$DEV")"
}

case "${1:-}" in
publish) cmd_publish ;;
sync-master) cmd_sync_main ;;
*)
  cat <<'EOF'
usage: scripts/tbp.sh <subcommand>

  publish      develop をビルドし、dist の中身だけを pages ブランチへ公開する
  sync-master  develop の README.md と LICENSE を master ブランチへ同期する

ブランチ名などは BS_DEV_BRANCH / BS_MAIN_BRANCH / BS_PAGES_BRANCH /
BS_BUILD_DIR / BS_MAIN_PATHS で上書きできる。
EOF
  exit 1
  ;;
esac
