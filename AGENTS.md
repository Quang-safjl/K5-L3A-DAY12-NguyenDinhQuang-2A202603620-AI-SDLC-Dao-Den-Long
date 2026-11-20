# AGENTS.md — Đảo Đèn Lồng

Game 3D (Three.js) + chế độ headless theo **Test Contract v1.1** (3 Đêm). JavaScript ESM, Node >= 18, không có dependency npm.

## Lệnh
- Test: `npm test` (= `node --test`). Phải xanh trước khi kết thúc bất kỳ việc nào.
- Bằng chứng: `bash scripts/proof.sh phase-N` → `docs/proof/phase-N/test-report.txt`
- Kiểm thử giao diện: `python3 scripts/ui_smoke.py [chrome]` (menu→3 đêm→Bình Minh, pause, cài đặt)
- Headless: `node headless.js --seed 1 --night 1|2|3 [--scenario f] [--inputs f] --ticks N --out o.jsonl`
- Chơi: `node serve.js` rồi mở http://localhost:8000 (không dùng python http.server: trên Windows trả .js sai MIME → trang đen)

## Kiến trúc
- `src/sim.js`: TOÀN BỘ luật chơi, thuần, tất định. Không dùng `Math.random`, `Date`, DOM. Thứ tự 12 bước/tick theo Ticket-02 (có comment đánh số).
- `src/maps.js`: bản đồ chuẩn 3 đêm (`ground(x,z)` trả độ cao mặt đất hoặc null = vực).
- `headless.js`: CLI, parse/validate, ghi JSONL. Không chứa luật chơi.
- `src/game3d.js`: chỉ hiển thị + đọc phím. Không chứa luật chơi.
- Mọi con số gameplay đọc từ `game.contract.json` → `tuning` (số CHUẨN Ticket-02, không được tự đổi). Hằng số không có trong tuning để ở đầu `sim.js`.

## Quy tắc
- Đọc yêu cầu từ `docs/notes/phase-N.md` (đã chép nguyên văn phần bắt buộc). Không tự bịa yêu cầu; chỗ mơ hồ ghi vào mục Giả định.
- Thêm/đổi hành vi → thêm test `R-xx` trong `tests/` và dòng tương ứng trong `docs/proof/phase-N/README.md`.
- Không sửa output headless bằng tay, không viết test luôn đạt, không xóa test cũ âm thầm (ghi lý do).
- Sáng tạo thêm không được làm đổi output headless.
- Thời gian tính bằng tick nguyên (60 tick/s) để tất định.
- Ticket mới đổi luật cũ: sửa test cũ kèm comment `TICKET-0N:` + lý do, ghi bảng "Thay đổi" trong `docs/notes/phase-N.md`.
- Bot `scripts/autoplay.js` là công cụ bằng chứng, không phải luật; đừng sửa sim để bot thắng.
- Input UI: dùng cả `keys` (đang giữ) và `tapped` (đã nhấn) để không mất cú nhấn nhanh; muốn tạo cạnh pause khi đang dừng phải gửi 1 bước pause=false trước.
