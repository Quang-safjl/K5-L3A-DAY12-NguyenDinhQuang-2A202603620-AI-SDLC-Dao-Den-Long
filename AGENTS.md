# AGENTS.md — Đảo Đèn Lồng

Game 3D (Three.js) + chế độ headless theo **Test Contract v1.3** (3 Đêm, đèn có dầu, thắng ở bình minh; bench/soak/bảng xếp hạng). JavaScript ESM, Node >= 18, không có dependency npm (three.js nằm trong `vendor/`).

## Lệnh
- Test: `npm test` (= `node --test`). Phải xanh trước khi kết thúc bất kỳ việc nào.
- Bằng chứng: `bash scripts/proof.sh phase-N` → `docs/proof/phase-N/test-report.txt` (`BENCH=1` chạy cả benchmark có cửa sổ; `CHROME=…` cho UI smoke)
- Kiểm thử giao diện: `python scripts/ui_smoke.py "<chrome.exe>"` (cần playwright; trên Windows `python3` có thể là alias Store)
- Headless: `node headless.js --seed 1 --night 1|2|3 [--scenario f] [--inputs f] --ticks N --out o.jsonl`
- Benchmark: `node bench.js --seed 42 --duration 30 --out bench.json` (mở Chrome/Edge thật ~35 s) · Soak: `node soak.js --seed 7 --nights 10 --out soak.json`
- Chơi: `node serve.js` rồi mở http://localhost:8000 (không dùng python http.server: trên Windows trả .js sai MIME → trang đen) · Xuất BXH: `node serve.js --export-leaderboard out.json`
- Đóng gói: `bash scripts/package.sh v1.0.0` → `dist/` (git archive của HEAD: commit trước khi đóng gói)

## Kiến trúc
- `src/sim.js`: TOÀN BỘ luật chơi, thuần, tất định. Không dùng `Math.random`, `Date`, DOM. Thứ tự 12 bước/tick theo Ticket-02 (có comment đánh số).
- Dầu đèn: số nguyên `fuelU` (1/60), KHÔNG dùng số thực tích lũy; vùng an toàn = `hasZone()` (lit && fuel ≥ 30), không dùng `l.lit` trực tiếp. Xem docs/adr/.
- `g.bench` (chỉ `src/bench.js` bật) chỉ được TẮT hành vi; mọi nhánh khi `bench=false` phải giữ nguyên. Test P4-02 so output headless từng byte với Phase 3 — đỏ nghĩa là đã đổi luật.
- `src/maps.js`: bản đồ chuẩn 3 đêm (`ground(x,z)` trả độ cao mặt đất hoặc null = vực).
- `headless.js`, `soak.js`, `bench.js`, `serve.js`: CLI, không chứa luật chơi. `src/leaderboard.js`, `src/keybinds.js`, `src/progress.js`: thuần, test được bằng Node.
- `src/game3d.js`: chỉ hiển thị + đọc phím (qua bảng `binds`, không hard-code mã phím). Bóng/đom đóm vẽ bằng InstancedMesh — đừng quay lại mesh riêng (bench 200 Bóng).
- Mọi con số gameplay đọc từ `game.contract.json` → `tuning` (số CHUẨN, không được tự đổi). Hằng số không có trong tuning để ở đầu `sim.js`.

## Quy tắc
- Đọc yêu cầu từ `docs/notes/phase-N.md` (đã chép nguyên văn phần bắt buộc). Không tự bịa yêu cầu; chỗ mơ hồ ghi vào mục Giả định.
- Thêm/đổi hành vi → thêm test (`R-xx`, `P4-xx`…) trong `tests/` và dòng tương ứng trong `docs/proof/phase-N/README.md`.
- Không sửa output headless hay bench.json/soak.json bằng tay, không viết test luôn đạt, không xóa test cũ âm thầm (ghi lý do).
- Sáng tạo thêm không được làm đổi output headless, và phải tắt trong cảnh bench (`BENCH_MODE`).
- Thời gian tính bằng tick nguyên (60 tick/s) để tất định.
- Ticket mới đổi luật cũ: sửa test cũ kèm comment `TICKET-0N:` + lý do, ghi bảng "Thay đổi" trong `docs/notes/phase-N.md`.
- Bot `scripts/autoplay.js` là công cụ bằng chứng, không phải luật; đừng sửa sim để bot thắng.
- Input UI: dùng cả `keys` (đang giữ) và `tapped` (đã nhấn) để không mất cú nhấn nhanh; muốn tạo cạnh pause khi đang dừng phải gửi 1 bước pause=false trước.
- Giao diện: chữ ≥ 18 px × `--k` (chữ lớn 1.25); rung/chớp/nhấp nháy phải tắt khi `settings.reduceMotion`. UI smoke kiểm tra cả hai.
- Đo hiệu năng: công cụ đo không được làm nhiễu số đo (bài học: gọi PowerShell mỗi 0.5 s làm 1% low tụt còn 20 FPS). Số đo dao động → chạy ≥ 2 lần trước khi kết luận.
- Playwright `text=…` khớp chuỗi con không phân biệt hoa thường → dùng selector theo id/thuộc tính khi chữ có thể trùng.
- Change request phá luật cũ: viết ADR trong `docs/adr/`, ghi breaking change vào `CHANGELOG.md`.
