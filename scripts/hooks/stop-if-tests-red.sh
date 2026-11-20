#!/usr/bin/env bash
# Hook Stop của Claude Code: không cho agent kết thúc khi test đang đỏ.
# Exit 2 = chặn kết thúc, stderr được gửi lại cho agent.
input="$(cat)"
# Tránh vòng lặp vô hạn nếu agent đã bị chặn một lần mà vẫn đỏ
if echo "$input" | grep -q '"stop_hook_active": *true'; then exit 0; fi
cd "$(dirname "$0")/../.."
if ! out="$(node --test 2>&1)"; then
  echo "Test đang ĐỎ — sửa trước khi kết thúc:" >&2
  echo "$out" | grep -E '^not ok|expected|actual' | head -20 >&2
  exit 2
fi
exit 0
