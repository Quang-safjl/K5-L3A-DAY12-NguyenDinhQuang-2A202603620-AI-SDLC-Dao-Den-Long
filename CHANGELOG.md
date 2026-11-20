# Changelog

## [1.0.0] — phase-4 · Ticket-04 "Bình minh: phát hành v1.0.0" · Test Contract v1.3

Không đổi luật, số liệu tuning hay output headless (test P4-01 so tuning với tag phase-3; P4-02 so output headless 3 Đêm từng byte với bằng chứng Phase 3).

### ⚠ Breaking changes
- `contract_version` **1.2 → 1.3**; thêm `bench_cmd` (`node bench.js`) và `soak_cmd` (`node soak.js`).
- `run_cmd` **`node serve.js 8000  # rồi mở …` → `node serve.js`** (comment `#` nuốt mất tham số `--export-leaderboard` khi chạy qua shell). Cổng mặc định vẫn 8000.
- `index.html` nạp three.js từ `vendor/` thay vì CDN unpkg.

### Added
- **Benchmark** `node bench.js --seed 42 --duration 30 --out bench.json`: mở Chrome/Edge/Chromium 1280×720 (không toàn màn hình, vsync tắt bằng cờ), cảnh chuẩn Đêm 1 với 200 Bóng Mực wander + 100 đom đóm, L1–L3 fuel 100, camera bay vòng R 30 Y 15 15 s/vòng, 3 s khởi động, ghi `avg_fps, p1_low_fps, frame_ms_p95, frames, load_ms, peak_mem_mb, vsync_off, renderer, os`.
- `sim.js`: cờ `g.bench` (mặc định false) tắt sinh thêm, sát thương, nhặt, hao dầu, kết thúc Đêm, Bóng nhận Mây làm mục tiêu. `src/bench.js`: dựng cảnh, đường bay camera, công thức số đo.
- **Soak** `node soak.js --seed 7 --nights 10 --out soak.json`: N Đêm xoay vòng 1→2→3 trong một tiến trình, input ngẫu nhiên theo seed (đổi hướng mỗi 30 tick; 5 % nhảy, 3 % lướt, 2 % tỏa sáng, 10 % tương tác), đo RSS sau `gc()`; chạy với cờ V8 `--max-opt=1 --optimize-for-size` (ADR 0002).
- **Bảng xếp hạng cục bộ**: nhập tên sau khi thua hoặc ở Bình Minh; top 10 lưu `data/leaderboard.json` qua `serve.js` (`GET/POST /api/leaderboard`); màn hình Bảng xếp hạng; `node serve.js --export-leaderboard out.json`. Tên có thể dùng chữ tiếng Việt có dấu.
- **Dễ tiếp cận**: đổi phím mọi hành động (2 ô/hành động, báo trùng, khôi phục mặc định, lưu); phụ đề + mũi tên mép màn hình khi Bóng xuất hiện, gió sắp thổi, 10 s cuối, đèn < 30; giảm chuyển động (tắt rung camera, chớp màn hình, nhấp nháy); chữ tối thiểu 18 px, tùy chọn chữ lớn ×1.25.
- Rung camera và chớp màn hình khi bị đánh / Tỏa Sáng (tắt được).
- `scripts/package.sh` (zip phát hành), `scripts/proof.sh phase-4` (soak, bench, export, so sánh headless với Phase 3), ảnh chụp `docs/screenshots/`, ADR 0002, retro.
- Test P4-01…P4-11 (73 test tổng); UI smoke 44 kiểm tra.

### Changed
- Bóng Mực và đom đóm vẽ theo lô (`InstancedMesh`, `Points`): cảnh bench từ ~1000 xuống vài draw call. HUD chỉ ghi DOM khi giá trị đổi và không dùng `backdrop-filter`. Trên máy dev: 1% low 20.6 → ~63 FPS.
- Test P3-01, P2-01: chấp nhận `contract_version` 1.3 (comment `TICKET-04:`).

### Giao diện + Chọn màn (làm sau tag phase-3, ngoài ticket, không đổi luật)

Không có breaking change: `src/sim.js`, `src/maps.js`, `game.contract.json` và output headless giữ nguyên.

#### Added
- **Chọn màn** (menu → Chọn màn): 3 thẻ Đêm với số đèn, số đèn cần lúc bình minh, thời lượng, đặc điểm đảo, điểm cao nhất. Cả 3 Đêm mở sẵn, không cần qua màn trước; thắng thì lưu ⭐ điểm cao nhất. Lưu ở `localStorage['ddl-progress']` (`src/progress.js`, test UI-01…UI-03).
- **Asset đồ họa** trong `assets/` (nguồn & giấy phép ở `CREDITS.md`): texture CC0 ambientCG (cỏ, cát, đá, ván, vỏ cây, ngói, giấy), normal map mặt nước của three.js, font Be Vietnam Pro + Dancing Script (OFL, có dấu tiếng Việt).
- Cảnh: mặt biển phản chiếu (three.js `Water`), vòm trời gradient + 1400 ngôi sao + mặt trăng, cây dừa và đá quanh mép đảo (chỉ trang trí, không có va chạm), lan can cầu tre, chuông vàng trên tháp, đèn lồng tròn có nắp/tua và quầng sáng, quầng sáng đom đóm, ACES tone mapping.
- Menu có cảnh Đảo Bến quay chậm phía sau; HUD dạng kính mờ; favicon đèn lồng.
- Cài đặt **Đồ họa cao** (tắt để dùng mặt nước đơn giản trên máy yếu).
- `serve.js`: MIME cho `.jpg`, `.woff2`.

#### Changed
- Ánh sáng nền tối thiểu 0.15 → 0.3 (vẫn tăng theo số đèn sáng) để thấy địa hình khi có texture.

## [phase-3] — Ticket-03 "Đèn cạn dầu" · Test Contract v1.2

### ⚠ Breaking changes
- `contract_version` **1.1 → 1.2**. `night1/2/3_duration_s` **300/330/360 → 240/270/300**.
- **Bỏ thắng sớm**: `game_over.reason = "all_lit"` không còn; thắng chỉ ở bình minh với `reason = "dawn_survived"` khi số đèn sáng ≥ ceil(0.6 × tổng). Thắp đủ đèn không kết thúc Đêm.
- **Đèn có thể tắt**: hết dầu → `lantern_out`, `lit=false`, `deposited=0`. Đèn đã sáng giờ **nhận** đom đóm (châm dầu) — thay luật "đèn đã sáng không nhận thêm".
- **Vùng an toàn** chỉ còn khi `fuel ≥ 30` — thay luật "Bóng Mực không bao giờ vào vùng an toàn".
- **Bóng Mực hết choáng → `wander`** (Phase 2: chase nếu trong 18 m). Thêm trạng thái `drain`; `wander` nay đi tới đèn yếu/đèn tắt gần nhất thay vì điểm ngẫu nhiên.
- **Điểm thay toàn bộ**: +5/đom đóm nạp (thắp, thắp lại, châm), +100 thắp lần đầu, +40 thắp lại, +5/Bóng trúng Tỏa Sáng (+15 nếu đang drain), bình minh (thắng): +50 + floor(fuel) mỗi đèn sáng, +50 mỗi lửa. **Bỏ thưởng thời gian.**
- Sức chứa không cố định: `10 + 2 × successful_lights`, tối đa 20.
- `lantern_lit` có thêm `relight`.

### Added
- Snapshot: `lanterns[].fuel` (1 chữ số), `ever_lit`, `relit_count`; `player.capacity`.
- Scenario: `lanterns[].{lit, fuel, ever_lit}` (lit không fuel → 100), `player.successful_lights`, `shades[].target_lantern_id`, trạng thái `drain`.
- Sự kiện: `refuel`, `lantern_out`, `fuel_drain` (mỗi 60 tick đang hút).
- Tuning: `fuel_max, fuel_decay_per_s, fuel_per_mote, relight_cost, win_ratio, drain_per_s, low_fuel_threshold, capacity_max`.
- UI: thanh dầu trên đèn, nhấp nháy 1 Hz khi fuel < 30, đèn tắt xẹp 20% + vết rách giấy, HUD "đang mang/sức chứa", nhắc "Châm dầu"/"Thắp lại", cài đặt **Bảng màu dễ phân biệt** (#00B3FF, cảnh báo trắng + ⚠).
- ADR: docs/adr/0001-lantern-fuel-and-dawn-win.md

### Tests changed (có lý do trong code, comment `TICKET-03`)
- R-07 "thắng khi thắp đủ 5 đèn" → thay bằng "thắp đủ không kết thúc Đêm"; luật bình minh ở P3-13.
- R-05 "hết choáng thì đuổi tiếp" → "hết choáng về wander rồi mới chase".
- P2-01 contract: chấp nhận 1.2, thời lượng & điểm chuyển sang P3-01.
- P2-02 thời lượng đêm đọc từ tuning. P2-21 điểm theo `per_mote` (5).

## [phase-2] — Ticket-02 "Ba hòn đảo" · v1.1
- Số liệu & bản đồ chuẩn, 3 Đêm, lướt, Gió Lạc, Bùa Gió, tạm dừng, rơi đảo, menu/cài đặt/âm thanh/HUD. Điểm +10 khi nạp (trước: khi nhặt). Xem docs/notes/phase-2.md.

## [phase-1] — PRD-0 · v1.0
- Đêm 1 chơi được, headless theo Test Contract v1.0.
