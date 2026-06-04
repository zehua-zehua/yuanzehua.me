#!/bin/bash
# publish.sh — 一键构建并推送到 GitHub（触发 Cloudflare Pages 自动部署）
# 用法：./scripts/publish.sh [可选的 commit 信息]

set -e

MSG=${1:-"update: $(date '+%Y-%m-%d %H:%M')"}

echo ""
echo "▸ Building site..."
node "$(dirname "$0")/build.js"

echo ""
echo "▸ Staging changes..."
git add -A

if git diff --staged --quiet; then
  echo "  Nothing to commit — site is already up to date."
  exit 0
fi

echo ""
echo "▸ Committing: $MSG"
git commit -m "$MSG"

echo ""
echo "▸ Pushing to GitHub..."
git push

echo ""
echo "✓ Done. Cloudflare Pages will deploy in ~1–2 minutes."
echo "  → https://yuanzehua.me"
echo ""
