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

## Phase 2
| Việc | Cách làm | Ghi chú |
|---|---|---|
| Đọc ticket | Ảnh chụp toàn trang lab board → cắt thành 13 dải, phóng to để đọc chính xác từng con số | Chép phần bắt buộc vào `docs/notes/phase-2.md` |
| Thiết kế | Tách `src/maps.js` (địa hình, `ground(x,z)`), viết lại `sim.js` theo đúng 12 bước/tick | |
| Kiểm chứng trước UI | 23 test P2 + chạy lại 20 test Phase 1 với số chuẩn | 3 test Phase 1 sửa kỳ vọng có lý do |
| UI | Viết `game3d.js` mới + `audio.js` (WebAudio tổng hợp), rồi tự kiểm bằng Chrome headless + three.js giả | |

**Lỗi AI đã gặp và cách phát hiện**
1. Nút "Tiếp tục" trong menu tạm dừng không hoạt động: vòng lặp đặt `acc = 0` khi dừng nên không bao giờ đọc lệnh tiếp tục; sau đó lại thiếu cạnh false→true của `pause`. Phát hiện bằng `scripts/ui_smoke.py` (sim_tick không tăng sau khi bấm Tiếp tục). Sửa: xử lý resume riêng, gửi 1 bước pause=false rồi pause=true. Ghi vào AGENTS.md.
2. Nhấn phím nhanh (E) bị mất vì keydown+keyup xảy ra giữa hai tick → thêm tập `tapped`. Phát hiện bằng UI smoke (nhấn E cạnh đèn không nạp).
3. Bản giả three.js thiếu `Vector3` do regex `[A-Za-z]` bỏ sót chữ số — lỗi của công cụ kiểm thử, không phải game; sửa regex.
4. Test do AI viết sai thời điểm (recoil đo ở tick 60 thay vì 61, Gió Lạc cần > 260 tick, cooldown Tỏa Sáng làm Bóng quay lại) → đọc output thật rồi sửa test, không sửa game.
5. Bot đi qua cầu dao động quanh điểm vào cầu và bước khỏi cầu khi đã ở nửa đảo B → sửa bot (không sửa luật).

**Token / chi phí ước tính Phase 2:** khoảng 250–300k token (đọc ảnh ticket ~40k, viết sim/test ~100k, UI + kiểm thử ~100k). Tiết kiệm: đọc ảnh ticket một lần rồi chép ra file; test chạy CLI thật nên không phải đoán; dừng cải thiện bot sau 2 lần thử và ghi trung thực thay vì đốt thêm token.

## Phase 3
| Việc | Cách làm |
|---|---|
| Đọc ticket | Người dùng dán text → không tốn token đọc ảnh |
| Thiết kế | ADR 0001 trước khi sửa: dầu số nguyên 1/60, `hasZone()` thay mọi chỗ dùng `lit` cho vùng an toàn |
| Build | Sửa sim bằng thay thế có kiểm tra (assert chuỗi tồn tại) để không sửa nhầm chỗ |
| Verify | Chạy test cũ trước: đúng 4 test đỏ đều thuộc luật [THAY THẾ] → xác nhận phạm vi thay đổi; viết 15 test P3 |

**Lỗi AI / test sai đã gặp**
1. Test P3-08 ban đầu chạy 60 tick nhưng Bóng 4 m/s cần 120 tick để tới → đọc snapshot thật, sửa test (không sửa game).
2. Test fuel_drain kỳ vọng tick 60, thực tế 61 vì drain bắt đầu ở tick 1 → ghi giả định 3, sửa test.
3. Hết choáng chuyển wander nhưng cùng tick lại sang chase (do rơi xuống nhánh wander) → snapshot không bao giờ thấy `wander`; sửa sim để tick chuyển trạng thái dừng ở `wander`.
4. Test R-05 Phase 1 vỡ sau khi đổi luật hết choáng → cập nhật có comment TICKET-03.

**Token Phase 3:** ~120–150k (ticket dạng text rẻ hơn nhiều so với ảnh Phase 2). Tiết kiệm: ADR trước, sửa nhắm đúng chỗ, tái dùng cơ chế đẩy-ra-vùng-an-toàn của Phase 2 thay vì viết mới.
