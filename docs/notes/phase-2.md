# Phase 2 — Ticket-02 "Ba hòn đảo" (Test Contract v1.1)

## Yêu cầu (tóm tắt)
1. **Số liệu chuẩn** thay mọi số tự chọn ở Phase 1 (chạy 6 m/s, nhảy 7 m/s & g 20, lướt 14 m/s/0.2 s/1.5 s, mang 10, đèn 10, tương tác 2 m, vùng an toàn 6 m, Tỏa Sáng 3/5 m/3 s choáng 120 tick + đẩy 4 m trong 15 tick, Bóng Mực 4 m/s (Đêm 3: 4.5), phát hiện 12/bỏ 18 m, chạm 1 m/1.5 m, recoil 2 m/60 tick, bị đánh rơi floor(mang/2) đom đóm TTL 480 tick + bất tử 90, rơi đảo Y<-10, lửa 3, thời gian 300/330/360 s). Điểm tính khi **nạp** (+10/đom đóm), +100/đèn, +5/Bóng trúng Tỏa Sáng, thắng +2×giây còn lại +50×lửa. Thứ tự 12 bước mỗi tick bắt buộc.
2. **Bản đồ chuẩn** Đêm 1 (Đảo Bến), Đêm 2 (Đảo Cau: 2 đảo + cầu tre + bục nhảy), Đêm 3 (Đảo Chuông: 3 tầng, dốc, bục, tháp chuông, gió mạnh).
3. **Tính năng mới**: Gió Lạc, Bùa Gió, chuỗi 3 Đêm + Bình Minh, Tạm dừng, Cài đặt (lưu), Âm thanh, HUD đầy đủ, Bảng màu chuẩn.
4. **Contract v1.1**: `--night 1|2|3`, snapshot thêm `night`, `wind`, `player.{vel, grounded, invuln, dash_cd_s, pulse_cd_s, charm_s}`, mảng bắt buộc `motes/drifters/charms`; scenario & input & sự kiện mới; tên trạng thái Bóng Mực `spawning|wander|chase|recoil|stunned`; một Đêm ≤ 30 s.

## Tiêu chí nghiệm thu
| Mã | Tính năng | Tiêu chí (kiểm chứng được) | Test |
|---|---|---|---|
| P2-01 | Số chuẩn | `game.contract.json` v1.1, tuning đúng từng số | P2-01 |
| P2-02 | 3 Đêm / snapshot v1.1 | `--night 1..3` chạy, đúng số đèn & vị trí, 20 đom đóm ở 20 điểm khác nhau, đủ trường mới, `night_start` | P2-02 |
| P2-03 | Lướt | 14 m/s × 12 tick = 2.8 m; hồi chiêu 90 tick từ lúc bắt đầu; đứng yên → hướng quay mặt | P2-03 |
| P2-04 | Nhảy | đỉnh ≈ 1.225 m, chỉ nhảy khi chạm đất | P2-04 |
| P2-05 | Nhặt | XZ ≤ 1 và chênh cao ≤ 1.5 | P2-05 |
| P2-06/07 | Rơi khỏi đảo | -1 lửa, mất hết (`lost`), chờ 60, hồi sinh điểm xuất phát, bất tử 90; hết lửa thì thua ngay | P2-06, P2-07 |
| P2-08 | Lịch sinh Bóng Mực | 2 con tick 300 (`spawning`), mỗi 480 tick, ≤ 6, cách ≥ 15 m | P2-08 |
| P2-09/10 | AI & bị đánh | wander/chase 12 m; recoil 2 m/60 tick; rơi floor(n/2) đom đóm kind `dropped` ttl 8 s ở vành 1.5–2.5 m | P2-09, P2-10 |
| P2-11 | Vùng an toàn | Bóng ở trong lúc thắp bị đẩy ra mép ≤ 30 tick, không gây sát thương | P2-11 |
| P2-12 | Tỏa Sáng chuẩn | tốn 3, 3D ≤ 5 m từ chân+0.8, đẩy 4 m/15 tick, hồi 3 s, +5/con | P2-12, R-05 |
| P2-13/14 | **Gió Lạc** | chase khi mang ≥ 5 & ≤ 15 m; cướp min(3, mang) → flee 240 tick rồi biến mất; Tỏa Sáng trúng chase → flee không cướp; trúng flee có đồ → thả lại thành đom đóm rơi; không mất lửa | P2-13, P2-14 |
| P2-15 | **Bùa Gió** | nhặt như đom đóm → 600 tick: 7.2 m/s, lướt không hồi chiêu (nhấn khi đang lướt bị bỏ qua), xuất hiện lại sau 2700 tick | P2-15 |
| P2-16 | **Tạm dừng** | `tick` tăng, `sim_tick`/thời gian/hồi chiêu đứng yên, snapshot `paused`, sự kiện `paused/resumed`; UI có Tiếp tục/Chơi lại Đêm/Cài đặt/Về menu | P2-16 + UI smoke |
| P2-17/18 | Đêm 2 | bục bắn 24 m/s về đảo kia, đáp sau ≈1.4 s; qua cầu an toàn, bước khỏi cầu thì rơi | P2-17, P2-18 |
| P2-19/20 | Đêm 3 | vách tầng chặn; dốc 30° lên Y=3; bục (0,3,13) lên Y=6; gió 5 s mỗi 30 s đẩy 2 m/s | P2-19, P2-20 |
| P2-21 | Nạp đèn | đèn chưa sáng gần nhất, bằng nhau id nhỏ hơn; +10/đom đóm nạp | P2-21 |
| P2-22 | Hiệu năng | một Đêm đầy đủ < 30 s (thực đo ~0.2 s) | P2-22 + proof §5 |
| P2-23 | Tất định | cả 3 đêm chạy 2 lần giống hệt | P2-23 + proof §2 |
| P2-24 | **Chuỗi 3 Đêm** | Menu → giới thiệu Đêm (tên đảo + lời Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 → Bình Minh + tổng điểm; thua → chơi lại Đêm đó | UI smoke |
| P2-25 | **Cài đặt** | âm lượng + độ nhạy chuột, lưu localStorage giữa các lần mở | UI smoke |
| P2-26 | **Âm thanh** | nhạc nền đêm + SFX nhặt/thắp/tỏa/bị đánh/nhảy/lướt/thắng/thua/Bóng xuất hiện/đếm ngược 10 s | chơi tay (WebAudio tổng hợp, `src/audio.js`) |
| P2-27 | **HUD đầy đủ** | lửa (trái trên), mm:ss giữa trên đỏ nhấp nháy ≤ 30 s, đèn k/n + điểm (phải trên), thanh 10 ô (giữa dưới), hồi chiêu Lướt/Tỏa (phải dưới), "E — Nạp ánh sáng (x/10)", mũi tên tới đèn chưa sáng gần nhất khi ngoài màn hình | UI smoke (một phần) + ảnh |
| P2-28 | **Bảng màu chuẩn** | dùng đúng hex trong `src/game3d.js` (hằng `C`); ánh sáng môi trường = 0.15 + 0.55 × đèn sáng/tổng | đọc code + ảnh |
| P2-29 | FPS | ≥ 30 FPS ở 1280×720 (bộ đếm FPS góc dưới trái) | chơi tay + ảnh |

## Giả định (chỗ ticket chưa quy định)
1. Tăng tốc/dừng trên mặt đất **tức thời** (thỏa "≤ 0.1 s"); trên không đổi vận tốc tối đa 30 m/s² ("điều khiển trên không không đầy đủ").
2. Bóng Mực mới sinh ở trạng thái `spawning` **60 tick** (không di chuyển, không gây sát thương); `wander` đi 1.5 m/s tới điểm ngẫu nhiên trên đảo.
3. Tâm Bóng Mực cao hơn mặt đất 1 m; chênh cao khi chạm = |chân Mây − (tâm Bóng − 1)|.
4. Hết choáng/recoil: `chase` nếu người chơi trong 18 m, ngược lại `wander`.
5. Gió Lạc sinh ở "điểm sương" = các điểm sinh Bóng Mực của đêm đó. Sau khi bị Tỏa Sáng làm thả đồ, Gió Lạc biến mất sau 120 tick (đom đóm thả ra có TTL 480 như đom đóm rơi). Mỗi con chỉ đuổi/cướp 1 lần.
6. `invuln` trong snapshot = số giây bất tử còn lại (0 khi không bất tử).
7. Sự kiện `night_start {night}` ghi ở tick 0, ngay sau snapshot tick 0.
8. **Điểm xuất phát Đêm 3 = (0, 0, −30)** vì (0,0,0) nằm trong khối tầng 2/tháp chuông; Đêm 2 = (0,0,0) tâm đảo A.
9. "Trần 30" đếm tất cả đom đóm đang có (kể cả đom đóm rơi); "điểm trống" = điểm sinh chưa có đom đóm `random`.
10. Gió Đêm 3: cơn gió bắt đầu ở sim_tick 1800k (k ≥ 1), kéo dài 300 tick, hướng ngẫu nhiên theo seed (độ nguyên); báo trước 2 s bằng lá bay + âm thanh (chỉ hiển thị).
11. `pulse.stunned_ids` chỉ chứa id Bóng Mực (Gió Lạc không được tính).
12. Vật cản khi đẩy lùi Bóng Mực: mép vùng an toàn đèn đã sáng và tháp chuông.
13. Tháp chuông được mô hình như cột cao (vách) — không leo được.

## Thay đổi so với Phase 1 (và test được sửa)
| Thay đổi | Lý do | Test bị ảnh hưởng |
|---|---|---|
| Điểm +10 khi nạp, không còn khi nhặt | Ticket-02 "Điểm (chuẩn hóa)" | R-03, R-04, R-07 thắng: sửa kỳ vọng điểm |
| Đẩy lùi Tỏa Sáng chia trong 15 tick | Ticket-02 bảng Tỏa Sáng | R-05: đọc vị trí ở tick 15 thay vì tick 1 |
| Hồi chiêu Tỏa Sáng 3 s | số chuẩn | R-05 cooldown: dùng `pulse_cooldown_s` từ tuning |
| Lịch sinh Bóng Mực 2 con ở tick 300 rồi mỗi 480 | Ticket-02 | R-10: kỳ vọng [300,300,780] thay [2400] |
| Không còn 2 Bóng Mực lúc bắt đầu | Ticket-02 lịch sinh | — |
| Đảo Đêm 1 bán kính 40, có thể rơi (`fall_enabled: true`) | bản đồ chuẩn | giả định Phase 1 #1 bị thay |
| Đèn Đêm 1 vị trí chuẩn (L1 ở (0,0,25)) | bản đồ chuẩn | giả định Phase 1 #2 bị thay |
| Đom đóm bị rơi khi trúng đòn **không mất** mà rơi ra đất | Ticket-02 | giả định Phase 1 #6 bị thay |

## Đánh giá Phase 2
- **Đạt (có test tự động):** P2-01 → P2-23, toàn bộ R-xx Phase 1 vẫn đạt với số chuẩn (43/43 test).
- **Đạt (kiểm thử giao diện tự động, three.js giả):** chuỗi 3 Đêm → Bình Minh, tạm dừng/tiếp tục, cài đặt lưu, thua → chơi lại (14/14).
- **Chưa kiểm chứng tự động:** âm thanh, màu sắc, mũi tên chỉ đèn, FPS — cần ảnh/clip khi chơi tay.
- **Bot:** thắng Đêm 1 & 2 khi không có kẻ địch, Đêm 3 chỉ thắp 5/7 (bot chưa biết leo lên tầng 1/2 ổn định — hạn chế của bot, test P2-19 cho thấy địa hình đi được). Với đầy đủ kẻ địch bot đơn giản **chưa thắng** đêm nào → độ khó số chuẩn cao với AI đơn giản; người chơi thật dùng lướt/tỏa sáng tốt hơn.
- **Rủi ro:** giả định 2, 3, 5, 6, 8 có thể khác test ẩn → hỏi trợ giảng nếu kịp.
