# AGENTS.md — Đảo Đèn Lồng

Game 3D (Three.js) + chế độ headless theo **Test Contract v1.0**. JavaScript ESM, Node >= 18, không có dependency npm.

## Lệnh
- Test: `npm test` (= `node --test`). Phải xanh trước khi kết thúc bất kỳ việc nào.
- Bằng chứng: `bash scripts/proof.sh phase-N` → `docs/proof/phase-N/test-report.txt`
- Headless: `node headless.js --seed 1 --night 1 [--scenario f] [--inputs f] --ticks N --out o.jsonl`
- Chơi: `node serve.js` rồi mở http://localhost:8000 (không dùng python http.server: trên Windows trả .js sai MIME → trang đen)

## Kiến trúc
- `src/sim.js`: TOÀN BỘ luật chơi, thuần, tất định. Không dùng `Math.random`, `Date`, DOM.
- `headless.js`: CLI, parse/validate, ghi JSONL. Không chứa luật chơi.
- `src/game3d.js`: chỉ hiển thị + đọc phím. Không chứa luật chơi.
- Mọi con số gameplay đọc từ `game.contract.json` → `tuning`. Không hard-code số trùng tuning.

## Quy tắc
- Đọc yêu cầu từ `docs/notes/phase-N.md` (đã chép nguyên văn phần bắt buộc). Không tự bịa yêu cầu; chỗ mơ hồ ghi vào mục Giả định.
- Thêm/đổi hành vi → thêm test `R-xx` trong `tests/` và dòng tương ứng trong `docs/proof/phase-N/README.md`.
- Không sửa output headless bằng tay, không viết test luôn đạt, không xóa test cũ âm thầm (ghi lý do).
- Sáng tạo thêm không được làm đổi output headless.
- Thời gian tính bằng tick nguyên (60 tick/s) để tất định.
