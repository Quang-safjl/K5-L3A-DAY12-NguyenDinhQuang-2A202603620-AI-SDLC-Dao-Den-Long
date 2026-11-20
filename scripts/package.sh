#!/usr/bin/env bash
# Đóng gói bản phát hành chạy được: bash scripts/package.sh [v1.0.0] → dist/dao-den-long-<ver>.zip
# Dùng git archive (đúng nội dung của commit HEAD, không lẫn file rác), đã gồm three.js trong vendor/ → chạy offline.
set -euo pipefail
cd "$(dirname "$0")/.."
VER="${1:-v1.0.0}"
mkdir -p dist
git archive --format=zip --prefix="dao-den-long-$VER/" -o "dist/dao-den-long-$VER.zip" HEAD
echo "dist/dao-den-long-$VER.zip ($(du -h "dist/dao-den-long-$VER.zip" | cut -f1))"
