#!/usr/bin/env bash
# Sinh lại toàn bộ bằng chứng của một phase: bash scripts/proof.sh [phase-1]
# Chạy lại ở tag tương ứng phải ra cùng kết quả (trừ thời gian đo).
set -euo pipefail
cd "$(dirname "$0")/.."
PHASE="${1:-phase-1}"
OUT="docs/proof/$PHASE"
mkdir -p "$OUT/runs"

{
  echo "# Kết quả kiểm chứng $PHASE"
  echo "code commit (lần sửa cuối của src, headless.js, contract, tests): $(git log -1 --format=%h -- src headless.js game.contract.json tests 2>/dev/null)"
  echo "node: $(node --version) · $(uname -sm)"
  echo
  echo "## 1. Unit + scenario test (node --test)"
  node --test 2>&1 | grep -E '^(ok|not ok)|^# (tests|pass|fail)'
} > "$OUT/test-report.txt"

# 2. Ví dụ trong Test Contract
node headless.js --seed 1 --night 1 --scenario scenarios/example.scenario.json \
  --inputs scenarios/example.inputs.json --ticks 300 --out "$OUT/runs/example.jsonl" --snapshot-every 60

# 3. Tính tất định: chạy 2 lần cùng seed, so sánh byte
node headless.js --seed 42 --night 1 --ticks 3000 --out "$OUT/runs/det-a.jsonl"
node headless.js --seed 42 --night 1 --ticks 3000 --out "$OUT/runs/det-b.jsonl"
{
  echo; echo "## 2. Tính tất định (seed 42, 3000 tick, chạy 2 lần)"
  sha256sum "$OUT/runs/det-a.jsonl" "$OUT/runs/det-b.jsonl" 2>/dev/null || shasum -a 256 "$OUT/runs/det-a.jsonl" "$OUT/runs/det-b.jsonl"
  if cmp -s "$OUT/runs/det-a.jsonl" "$OUT/runs/det-b.jsonl"; then echo "KẾT QUẢ: giống hệt ✅"; else echo "KẾT QUẢ: KHÁC ❌"; fi
} >> "$OUT/test-report.txt"
rm "$OUT/runs/det-b.jsonl"

# 4. Chơi trọn một đêm: bot sinh inputs, headless thật chạy lại inputs đó
{
  echo; echo "## 3. Chơi trọn Đêm 1 bằng bot (inputs → headless.js)"
  for s in 1 42; do
    node scripts/autoplay.js --seed $s --out "scenarios/autoplay-seed$s.inputs.json"
    node headless.js --seed $s --night 1 --inputs "scenarios/autoplay-seed$s.inputs.json" --ticks 18000 \
      --out "$OUT/runs/autoplay-seed$s.jsonl" --snapshot-every 600
    echo "seed $s headless end: $(tail -1 "$OUT/runs/autoplay-seed$s.jsonl")"
    echo "  sự kiện lantern_lit: $(grep -c lantern_lit "$OUT/runs/autoplay-seed$s.jsonl"), game_over: $(grep game_over "$OUT/runs/autoplay-seed$s.jsonl")"
  done
  echo; echo "## 4. Đứng yên không làm gì (phải thua)"
  node headless.js --seed 42 --night 1 --ticks 18000 --out "$OUT/runs/idle-seed42.jsonl" --snapshot-every 600
  echo "end: $(tail -1 "$OUT/runs/idle-seed42.jsonl")"
  echo "game_over: $(grep game_over "$OUT/runs/idle-seed42.jsonl")"
  echo; echo "## 5. Hiệu năng headless (một đêm đầy đủ 18000 tick, không Bóng Mực để chạy hết đêm)"
  START=$(node -e 'console.log(Date.now())')
  node headless.js --seed 5 --night 1 --scenario scenarios/perf.scenario.json --ticks 18000 --out /tmp/ddl-perf.jsonl
  END=$(node -e 'console.log(Date.now())')
  echo "18000 tick (5 phút game) chạy trong $((END-START)) ms; dòng output: $(wc -l < /tmp/ddl-perf.jsonl | tr -d ' ')"
} >> "$OUT/test-report.txt"

cat "$OUT/test-report.txt"
