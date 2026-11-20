#!/usr/bin/env bash
# Sinh lại toàn bộ bằng chứng: bash scripts/proof.sh [phase-4]   (BENCH=1 để chạy cả benchmark có cửa sổ)
# Chạy lại ở tag tương ứng phải ra cùng kết quả (trừ thời gian đo / thông tin máy).
set -euo pipefail
cd "$(dirname "$0")/.."
PHASE="${1:-phase-4}"
# python3 trên Windows có thể là alias Microsoft Store → thử python3 rồi python
PY=python3; "$PY" -c "import sys" 2>/dev/null || PY=python
OUT="docs/proof/$PHASE"
mkdir -p "$OUT/runs"
R="$OUT/test-report.txt"

{
  echo "# Kết quả kiểm chứng $PHASE"
  echo "code commit (lần sửa cuối của src, headless.js, contract, tests): $(git log -1 --format=%h -- src headless.js game.contract.json tests 2>/dev/null)"
  echo "node: $(node --version) · $(uname -sm)"
  echo
  echo "## 1. Unit + scenario test (node --test) — mọi phase"
  node --test --test-reporter=tap 2>&1 | grep -E '^(ok|not ok)|^# (tests|pass|fail)'
} > "$R"

{
  echo; echo "## 2. Tính tất định (seed 42, 4000 tick, chạy 2 lần mỗi đêm)"
  for n in 1 2 3; do
    node headless.js --seed 42 --night $n --ticks 4000 --out "$OUT/runs/det-n$n-a.jsonl"
    node headless.js --seed 42 --night $n --ticks 4000 --out /tmp/ddl-det-b.jsonl
    if cmp -s "$OUT/runs/det-n$n-a.jsonl" /tmp/ddl-det-b.jsonl; then echo "Đêm $n: giống hệt ✅"; else echo "Đêm $n: KHÁC ❌"; fi
  done

  echo; echo "## 3. Bot chơi trọn đêm (inputs → headless.js thật)"
  echo "### 3a. Bản đồ không có kẻ địch (scenarios/calm.scenario.json): chứng minh giữ được đủ đèn tới bình minh"
  for n in 1 2 3; do
    node scripts/autoplay.js --night $n --seed 42 --scenario scenarios/calm.scenario.json --out "scenarios/autoplay-calm-n$n.inputs.json" >/dev/null
    node headless.js --seed 42 --night $n --scenario scenarios/calm.scenario.json --inputs "scenarios/autoplay-calm-n$n.inputs.json" \
      --ticks 21600 --out "$OUT/runs/autoplay-calm-n$n.jsonl" --snapshot-every 1200
    echo "Đêm $n: $(tail -1 "$OUT/runs/autoplay-calm-n$n.jsonl") · lantern_lit=$(grep -c lantern_lit "$OUT/runs/autoplay-calm-n$n.jsonl")"
  done
  echo "### 3b. Đầy đủ kẻ địch (bot đơn giản, số liệu chuẩn)"
  for n in 1 2 3; do
    node scripts/autoplay.js --night $n --seed 42 --out "scenarios/autoplay-n$n.inputs.json" >/dev/null
    node headless.js --seed 42 --night $n --inputs "scenarios/autoplay-n$n.inputs.json" --ticks 21600 --out "$OUT/runs/autoplay-n$n.jsonl" --snapshot-every 1200
    echo "Đêm $n: $(tail -1 "$OUT/runs/autoplay-n$n.jsonl") · lantern_lit=$(grep -c lantern_lit "$OUT/runs/autoplay-n$n.jsonl")"
  done

  echo; echo "## 4. Đứng yên không làm gì (phải thua)"
  for n in 1 2 3; do
    node headless.js --seed 42 --night $n --ticks 21600 --out "$OUT/runs/idle-n$n.jsonl" --snapshot-every 1200
    echo "Đêm $n: $(grep game_over "$OUT/runs/idle-n$n.jsonl")"
  done

  echo; echo "## 5. Hiệu năng headless: một Đêm đầy đủ (yêu cầu ≤ 30 s)"
  for n in 1 2 3; do
    S=$(node -e 'console.log(Date.now())')
    node headless.js --seed 5 --night $n --scenario scenarios/perf.scenario.json --ticks 21600 --out /tmp/ddl-perf.jsonl
    E=$(node -e 'console.log(Date.now())')
    echo "Đêm $n: $(tail -1 /tmp/ddl-perf.jsonl) trong $((E-S)) ms"
  done
} >> "$R"

if "$PY" -c "import playwright" 2>/dev/null; then
  { echo; echo "## 6. Kiểm thử giao diện (scripts/ui_smoke.py, Chrome headless, three.js giả)"; "$PY" scripts/ui_smoke.py ${CHROME:+"$CHROME"} 2>&1 | grep -E 'PASS|FAIL'; } >> "$R" || true
fi

if [ "$PHASE" = "phase-4" ]; then
  {
    echo; echo "## 7. Headless không đổi so với Phase 3 (seed 42, 4000 tick)"
    for n in 1 2 3; do
      if cmp -s "$OUT/runs/det-n$n-a.jsonl" "docs/proof/phase-3/runs/det-n$n-a.jsonl"; then echo "Đêm $n: giống hệt Phase 3 ✅"; else echo "Đêm $n: KHÁC Phase 3 ❌"; fi
    done
    echo; echo "## 8. Soak test: node soak.js --seed 7 --nights 10 --out soak.json"
    node soak.js --seed 7 --nights 10 --out soak.json
    cat soak.json
    echo; echo "## 9. Benchmark: node bench.js --seed 42 --duration 30 --out bench.json"
    if [ -n "${BENCH:-}" ]; then node bench.js --seed 42 --duration 30 --out bench.json; else echo "(không chạy lại — đặt BENCH=1; dưới đây là bench.json đã commit)"; fi
    cat bench.json 2>/dev/null || echo "chưa có bench.json"
    echo; echo "## 10. Xuất bảng xếp hạng (dữ liệu mẫu trong thư mục tạm)"
    D=$(mktemp -d)
    printf '%s' '{"entries":[{"name":"Mây_01","score":120,"nights_won":1,"achieved_at":"2026-11-20T10:00:00+07:00","seed":1},{"name":"Dang","score":980,"nights_won":3,"achieved_at":"2026-11-20T11:00:00+07:00","seed":2}]}' > "$D/leaderboard.json"
    node serve.js --export-leaderboard "$D/out.json" --data "$D" && cat "$D/out.json"
  } >> "$R" 2>&1
fi
cat "$R"
