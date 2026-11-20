# Changelog

## [Unreleased] — Nâng cấp giao diện + Chọn màn (ngoài ticket, không đổi luật)

Không có breaking change: `src/sim.js`, `src/maps.js`, `game.contract.json` và output headless giữ nguyên.

### Added
- **Chọn màn** (menu → Chọn màn): 3 thẻ Đêm với số đèn, số đèn cần lúc bình minh, thời lượng, đặc điểm đảo, điểm cao nhất. Cả 3 Đêm mở sẵn, không cần qua màn trước; thắng thì lưu ⭐ điểm cao nhất. Lưu ở `localStorage['ddl-progress']` (`src/progress.js`, test UI-01…UI-03).
- **Asset đồ họa** trong `assets/` (nguồn & giấy phép ở `CREDITS.md`): texture CC0 ambientCG (cỏ, cát, đá, ván, vỏ cây, ngói, giấy), normal map mặt nước của three.js, font Be Vietnam Pro + Dancing Script (OFL, có dấu tiếng Việt).
- Cảnh: mặt biển phản chiếu (three.js `Water`), vòm trời gradient + 1400 ngôi sao + mặt trăng, cây dừa và đá quanh mép đảo (chỉ trang trí, không có va chạm), lan can cầu tre, chuông vàng trên tháp, đèn lồng tròn có nắp/tua và quầng sáng, quầng sáng đom đóm, ACES tone mapping.
- Menu có cảnh Đảo Bến quay chậm phía sau; HUD dạng kính mờ; favicon đèn lồng.
- Cài đặt **Đồ họa cao** (tắt để dùng mặt nước đơn giản trên máy yếu).
- `serve.js`: MIME cho `.jpg`, `.woff2`.

### Changed
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
