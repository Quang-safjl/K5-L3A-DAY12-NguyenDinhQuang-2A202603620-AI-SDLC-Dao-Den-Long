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

## Giữa Phase 3 và 4 — giao diện + Chọn màn (Claude Code trong VS Code)
| Việc | Cách làm |
|---|---|
| Asset | AI tìm nguồn CC0 (ambientCG qua API, three.js waternormals, Google Fonts OFL), tải vào thư mục riêng, thu nhỏ 512 px bằng script → ~1 MB; ghi nguồn trong CREDITS.md (test UI-04 kiểm tra file và ghi nguồn) |
| Kiểm chứng hình | Chụp ảnh WebGL thật bằng Chrome headless (SwiftShader) rồi **xem ảnh** thay vì tin code |

**Lỗi AI**: (1) vách đá Đêm 3 đen thui sau khi thêm texture (ánh sáng nền tối thiểu 0.15) — chỉ phát hiện khi xem ảnh chụp; (2) câu "…mở Đêm kế tiếp" trên màn Chọn màn làm Playwright `text=Đêm kế tiếp` bấm nhầm — smoke test bắt được; (3) heredoc bash có dấu nháy làm script hỏng → chuyển sang ghi file script riêng.

## Phase 4 (Claude Code trong VS Code)
| Việc | Cách làm |
|---|---|
| Đọc ticket | Người dùng dán text; AI đọc thêm `docs/lab/` (CHECKPOINTS, RUBRIC, RULES, SUBMISSION) để biết DoD, rồi chép phần bắt buộc vào `docs/notes/phase-4.md` |
| Thiết kế | Cờ `g.bench` chỉ *tắt* hành vi; test P4-02 so output headless từng byte với Phase 3 trước khi làm UI; ADR 0002 |
| Đo trước, sửa sau | Soak và bench chạy thật ngay khi có bản đầu → thấy 2 lỗi đo (bên dưới) trước khi viết tài liệu |
| Verify | 11 test P4 + 2 test cũ sửa version (TICKET-04) · UI smoke 17 → 44 kiểm tra · E2E bảng xếp hạng qua `serve.js` thật · `proof.sh phase-4` |

**Lỗi AI / vấn đề đã gặp và cách phát hiện**
1. **Soak "rò rỉ" RAM giả**: bản đầu cho 37 → 56 MB (vượt 1.2×). AI không vội "sửa" bằng cách đo muộn hơn; chạy probe 40 Đêm in `heapUsed` → heap phẳng ~5 MB, RSS dao động do trình biên dịch JIT. So 7 cấu hình cờ V8 rồi chọn `--max-opt=1 --optimize-for-size` (RSS phẳng 37 → 39 MB). Ghi số liệu vào ADR 0002. Cách "làm nóng vài Đêm trước khi đo" bị loại vì sai định nghĩa của ticket.
2. **Công cụ đo làm nhiễu số đo**: bench lần đầu 1% low 20.6 FPS — một phần do gọi PowerShell mới mỗi 0.5 s để đo RAM. Sửa: một tiến trình PowerShell chạy suốt. Ghi bài học vào AGENTS.md.
3. **Hiệu năng thật**: 200 Bóng × 4 mesh ≈ 1000 draw call → InstancedMesh. Lần chạy proof sau đó lại ra 1% low 19.7 (dao động) → tìm tiếp: HUD ghi `innerHTML` mỗi khung + `backdrop-filter` trên HUD. Sau khi sửa: ~139 FPS / 1% low ~63, ổn định qua nhiều lần chạy. Bài học: chạy bench ≥ 2 lần (thêm vào skill verify-phase).
4. **Node 24 đổi định dạng `node --test` khi pipe** → `proof.sh` grep không ra dòng nào và dừng (set -e) → thêm `--test-reporter=tap`.
5. **Test giao diện tự viết sai**: `text=Lưu điểm` khớp nhãn "…để lưu điểm…" (không phân biệt hoa thường); `inner_text` của phần tử đang ẩn trả rỗng → sửa selector, không sửa game. Ghi quy tắc vào AGENTS.md.
6. **`run_cmd` có comment** `node serve.js 8000  # rồi mở …` sẽ nuốt `--export-leaderboard` → phát hiện khi đọc lại yêu cầu `<run_cmd> --export-leaderboard`; đổi thành `node serve.js`, test P4-01 giữ điều này.
7. Phát hiện thiếu tag `phase-2` khi test P4-01 cần `git show phase-3:…` → báo người học (không tự gắn tag lùi ngày).

**Token / chi phí ước tính (giao diện + Phase 4, một phiên Claude Code dài):** đầu ra ~150–200k token; đầu vào tích lũy lớn (vài triệu token, phần lớn đọc lại từ cache vì phiên dài và nhiều lần chạy công cụ). Số chính xác: xem `/cost` hoặc trang usage. Tiết kiệm: đọc ticket dạng text; dùng `grep`/`sed -n` đọc đúng đoạn cần thay vì cả file; sửa file lớn bằng script thay thế có kiểm tra (assert chuỗi tồn tại); không dùng subagent; ảnh chụp xem ở JPEG nhỏ; chạy proof một lần ở cuối thay vì sau mỗi thay đổi.
