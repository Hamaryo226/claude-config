#!/usr/bin/env bash
# 会社 PC の ~/.claude へこのプロファイルを配置する (Linux / macOS)。
#
#   ./install.sh          # 差分を表示するだけ (何も書き換えない)
#   ./install.sh --apply  # 実際に配置する
#
# 既存ファイルは上書き前に .bak-<日時> として退避する。
set -euo pipefail

APPLY=0
TARGET="${HOME}/.claude"

while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --target) TARGET="$2"; shift ;;
    *) echo "不明な引数: $1" >&2; exit 1 ;;
  esac
  shift
done

SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"

# Git Bash / MSYS では $HOME が /c/Users/... 形式になり、Node がそのパスを解決できない。
# フックの args に入れると動かないので、Windows では install.ps1 を使う。
case "${OSTYPE:-}" in
  msys*|cygwin*|win32*)
    echo "Git Bash / MSYS 上で実行されています。" >&2
    echo "Windows では install.ps1 を使ってください (パス形式が合わないため)。" >&2
    exit 1
    ;;
esac

# 配置するもの。ここに無いものは触らない。
ITEMS=(CLAUDE.md settings.json statusline.mjs agents hooks rules skills)

echo "配置元: $SOURCE"
echo "配置先: $TARGET"
[ "$APPLY" -eq 1 ] || echo -e "\n[dry-run] --apply を付けると実際に書き込みます。\n"

if [ ! -d "$TARGET" ]; then
  echo "作成: $TARGET"
  [ "$APPLY" -eq 1 ] && mkdir -p "$TARGET"
fi

for item in "${ITEMS[@]}"; do
  src="$SOURCE/$item"
  dst="$TARGET/$item"
  if [ ! -e "$src" ]; then
    echo "警告: 配置元に無い: $item" >&2
    continue
  fi
  if [ -e "$dst" ]; then
    echo "退避: $item -> $item.bak-$STAMP"
    [ "$APPLY" -eq 1 ] && mv "$dst" "$dst.bak-$STAMP"
  fi
  echo "配置: $item"
  [ "$APPLY" -eq 1 ] && cp -R "$src" "$dst"
done

# settings.json のプレースホルダを実際のパスに置き換える。
# フックの args は絶対パスでないと解決されないため、この置換が必須。
SETTINGS="$TARGET/settings.json"
echo
echo "settings.json の __CLAUDE_DIR__ を '$TARGET' に置換"
if [ "$APPLY" -eq 1 ]; then
  [ -f "$SETTINGS" ] || { echo "settings.json が見つかりません: $SETTINGS" >&2; exit 1; }
  tmp="$(mktemp)"
  sed "s|__CLAUDE_DIR__|${TARGET}|g" "$SETTINGS" > "$tmp"
  mv "$tmp" "$SETTINGS"

  if grep -q '__CLAUDE_DIR__' "$SETTINGS"; then
    echo "__CLAUDE_DIR__ が残っています。settings.json を確認してください。" >&2
    exit 1
  fi
  if command -v node >/dev/null 2>&1; then
    node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$SETTINGS"
    echo "settings.json は有効な JSON です"
  fi

  cat <<'EOM'

完了。次にやること:
  1. CLAUDE.md の『この環境について (要記入)』を埋める
  2. settings.json の permissions.allow の WebFetch に社内ドキュメントのドメインを足す
  3. 新しいセッションを開いて /status と /context を確認する
  4. claude doctor でエラーが無いことを確認する
EOM
else
  echo -e "\n[dry-run] 何も変更していません。"
fi
