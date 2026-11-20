# Phase 3 — Ticket-03 "Đèn cạn dầu" (Change Request, Test Contract v1.2)

Quyết định thiết kế: [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md) · Breaking changes: [CHANGELOG.md](../../CHANGELOG.md)

## Tiêu chí nghiệm thu
| Mã | Yêu cầu | Tiêu chí | Test |
|---|---|---|---|
| P3-01 | Contract v1.2 | khóa tuning mới, đêm 240/270/300 | P3-01 |
| P3-02 | Dầu hao 1/s | fuel 100 → 98.5 sau 90 tick; snapshot fuel 1 chữ số, ever_lit, relit_count; lit không fuel → 100 | P3-02 |
| P3-03 | Hết dầu | lantern_out, tắt, deposited 0, ever_lit giữ | P3-03 |
| P3-04/05 | Châm dầu | used = min(mang, ceil((100−fuel)/10)); tối đa 100; +5/đom đóm; đèn đầy không được chọn | P3-04, P3-05 |
| P3-06 | Thắp lại | ever_lit cần 5, relight:true, +40, relit_count | P3-06 |
| P3-07 | Sức chứa | 10 + 2×successful_lights ≤ 20 | P3-07, UI smoke |
| P3-08 | Mất vùng an toàn < 30 | Bóng vào được và đánh trúng khi fuel 20, không khi 80 | P3-08 |
| P3-09/10 | drain | wander → đèn yếu → ≤ 2 m drain đứng yên, 5/s cộng dồn, fuel_drain mỗi 60 tick, đèn tắt → wander | P3-09, P3-10 |
| P3-11 | Thoát drain | Mây ≤ 6 m → chase; Tỏa Sáng → stunned +15; hết choáng → wander | P3-11, R-05 |
| P3-12 | Châm ≥ 30 khi Bóng trong vùng | đẩy ra mép ≤ 30 tick, không sát thương | P3-12 |
| P3-13 | Luật thắng mới | bình minh + ≥ ceil(0.6×tổng) đèn sáng → dawn_survived; điểm 50+floor(fuel)/đèn + 50/lửa; thiếu → dawn; cả 3 đêm | P3-13 |
| P3-14 | no_flames ở tick bình minh | thua no_flames | P3-14 |
| P3-15 | Đèn tắt đúng tick bình minh | không được tính (tắt sau bước 2) | P3-15 |
| P3-16 | Không thắng sớm | thắp đủ đèn không kết thúc | R-07 (viết lại) |
| P3-17 | UI | thanh dầu, nhấp nháy 1 Hz < 30, đèn tắt xẹp 20% + rách, HUD mang/sức chứa, nhắc châm dầu | UI smoke + ảnh |
| P3-18 | Chế độ mù màu | lưu được; viền/mắt Bóng #00B3FF; cảnh báo #FFFFFF + ⚠ | UI smoke + ảnh |

## Giả định
1. "Đi về đèn tắt gần nhất như trước": Bóng `wander` không có đèn yếu thì đi về đèn **tắt** gần nhất (dừng cách ~1.5 m), không có đèn tắt thì đi lang thang ngẫu nhiên. Đi tới đèn yếu với tốc độ Bóng Mực; đi về đèn tắt với tốc độ lang thang 1.5 m/s.
2. Hết choáng: tick đó Bóng chỉ chuyển về `wander`, tick sau mới xét phát hiện người chơi.
3. `fuel_drain` ghi sau mỗi 60 tick hút liên tục của **từng** Bóng (tick bắt đầu drain không tính).
4. Bóng đang `drain` không gây sát thương (đứng yên); Mây vào 6 m thì nó chuyển `chase` trước.
5. Ngưỡng thắng dùng `ceil(win_ratio × tổng − 1e-9)` để 0.6×5 = 3 không bị làm tròn thành 4 do sai số.
6. Điểm cấu hình trong `tuning.score`: `per_mote 5, per_lantern 100, per_relight 40, per_stun 5, per_stun_drain 15, per_lit_at_dawn 50, per_flame_left 50, per_second_left 0`.

## Đánh giá Phase 3
- Đạt (test tự động): P3-01 → P3-16; 58/58 test (Phase 1–2 regression + Phase 3). Tất định 3 đêm; một đêm ~0.2 s.
- UI smoke 17/17 (thêm mù màu, sức chứa, nhắc châm dầu).
- Bot không kẻ địch: thắng bình minh Đêm 1 (4/5), Đêm 2 (4/6); Đêm 3 thua (4/7, bot chưa leo tầng ổn định). Có kẻ địch: bot chưa thắng.
- Chưa kiểm chứng tự động: nhấp nháy 1 Hz, đèn xẹp/rách, màu mù màu trên hình → cần ảnh.
- Hỏng phase trước? Không: các luật không bị thay vẫn đạt; 5 test sửa đều thuộc luật bị [THAY THẾ].
