# Nhật ký dùng AI

Công cụ: Claude (claude.ai, có tool chạy code), model Claude Opus. Harness: `AGENTS.md`, hook Stop `scripts/hooks/stop-if-tests-red.sh`, skill `.claude/skills/verify-phase`, CI GitHub Actions.

## Phase 1
| Việc | Cách làm | Ghi chú |
|---|---|---|
| Đọc đề | AI đọc lab board + repo, tóm tắt yêu cầu và Test Contract | Người kiểm lại so với lab board |
| Thiết kế | Tách `sim.js` (luật) / `headless.js` (CLI) / `game3d.js` (hiển thị) trước khi code | Quyết định chính: một nguồn luật cho cả 2 chế độ |
| Code | AI viết sim + headless, chạy thử ví dụ của contract ngay | |
| Kiểm chứng | 20 test `node:test` gọi CLI thật, bot tự chơi, script proof | |

**Lỗi AI đã gặp và cách phát hiện**
1. Thời gian choáng bị lệch 1 tick (Bóng Mực choáng 179 thay vì 180 tick) vì bộ đếm được giảm ngay trong tick bị pulse. Test `R-05 hết choáng` bắt được → chuyển việc giảm bộ đếm lên đầu bước.
2. Test tất định ban đầu đòi có `shade_spawned` trong 3000 tick, nhưng người chơi đứng yên đã thua ở tick ~626 → test sai giả định chứ không phải game sai. Tách thành test riêng với scenario không có Bóng Mực.
3. Game 3D đứng màn hình đen trên Windows: `python -m http.server` trả `.js` là `text/plain` nên trình duyệt không chạy module. Phát hiện khi người chơi thử trên máy thật (log server chỉ thấy `game3d.js`, không thấy `sim.js`). Sửa: thêm `serve.js` (Node) luôn trả đúng MIME; ghi vào AGENTS.md để agent không quay lại python http.server.
4. `node --test tests/` không chạy trên Node 22 (coi `tests/` là module) → đổi script thành `node --test`.

**Token / chi phí ước tính:** khoảng 150–200k token (đọc tài liệu và lab board qua ảnh chụp chiếm phần lớn). Cách tiết kiệm: đọc đề một lần rồi chép phần bắt buộc vào `docs/notes/phase-1.md` để các lần sau không phải đọc lại; AGENTS.md ngắn; test chạy CLI thật nên không cần agent "chạy thử" bằng tay nhiều lần.
