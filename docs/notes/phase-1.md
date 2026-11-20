# Phase 1 — PRD-0 + Test Contract v1.0

## Yêu cầu (tóm tắt từ lab board)
- Một màn **Đêm 1 – Đảo Bến**: đảo tròn, **5 Đèn Lồng Lớn**.
- Nhân vật Mây đi lại, nhảy, camera 3D góc nhìn thứ ba.
- Đom đóm rải rác, nhặt được; nạp ánh sáng vào đèn để thắp.
- Bóng Mực xuất hiện, đuổi người chơi; chạm vào thì mất máu (flames).
- Tỏa sáng (pulse) xua Bóng Mực, tốn ánh sáng. Bóng Mực sợ đèn.
- Thắng khi thắp hết đèn, thua khi hết máu; có điểm số, HUD, chơi lại được.
- Headless theo Test Contract v1.0 (60 tick/s, JSONL snapshot/event/end, tất định theo seed, mã thoát 2 khi đầu vào sai).

## Tiêu chí nghiệm thu (mỗi dòng kiểm chứng được)
| Mã | Tiêu chí |
|---|---|
| R-01 | Output có snapshot tick 0, snapshot mỗi `--snapshot-every` tick, dòng `end` cuối với số bước đã chạy |
| R-02 | `move` xoay theo `cam_yaw_deg`, tốc độ = `player_speed`, vector > 1 được chuẩn hóa; trường vắng giữ giá trị cũ |
| R-03 | Đom đóm trong `pickup_radius` được nhặt (event `mote_picked`), không vượt `carry_capacity` |
| R-04 | `interact` (false→true) trong `interact_radius` nạp vào đèn gần nhất chưa thắp; đủ `lantern_cost` → `lantern_lit` |
| R-05 | `pulse` tốn `pulse_cost`, choáng `pulse_stun_s` + đẩy `pulse_push_m` mọi Bóng Mực trong `pulse_radius`; cooldown `pulse_cooldown_s` |
| R-06 | Bóng Mực chạm (≤ `shade_hit_radius`) → mất 1 flame, rơi `floor(carried × hit_drop_ratio)`, bất tử `invuln_s` |
| R-07 | Thắng `all_lit`; thua `no_flames` / `dawn`; mô phỏng dừng khi kết thúc |
| R-08 | Bóng Mực không vào `safe_radius` quanh đèn đã thắp |
| R-09 | Dựng scenario không phát sự kiện, không cộng điểm |
| R-10 | Cùng seed + scenario + inputs → output giống hệt byte |
| R-11 | Inputs/scenario sai định dạng → mã thoát 2, lỗi ra stderr |
| R-12 | Tọa độ làm tròn 3 chữ số |
| R-13 | Game 3D chơi được từ đầu đến thắng/thua, HUD, chơi lại (R) |

## Giả định (chỗ PRD-0 chưa quy định)
1. **Đảo** bán kính 30 m, tâm (0,0,0); nhân vật bị chặn ở mép đảo, không rơi → `fall_enabled: false`.
2. **Đèn mặc định** đặt trên vòng tròn bán kính 20 m: L1 ở (0,0,20), các đèn sau cách nhau 72°.
3. **"Ánh sáng"** = số đom đóm đang mang (`carried`). Tỏa sáng trừ `pulse_cost` đom đóm; không đủ thì không có gì xảy ra (không ghi event).
4. **Nạp đèn**: nạp `min(carried, lantern_cost − deposited)` vào đèn chưa thắp gần nhất trong bán kính; không thể nạp vào đèn đã thắp.
5. **`safe_radius`** chỉ áp dụng cho đèn **đã thắp** (đèn tối chưa làm Bóng Mực sợ).
6. **Đom đóm rơi khi bị chạm** biến mất (không rơi xuống đất để nhặt lại).
7. **Bóng Mực** luôn đuổi thẳng tới người chơi (`chase`), bị chặn ở biên vùng an toàn; trạng thái `stunned` khi bị choáng. Bóng Mực bị choáng không gây sát thương.
8. **Nhảy** chỉ đổi trục Y; mọi va chạm đo trên mặt phẳng XZ nên nhảy không né được Bóng Mực.
9. **Sinh ngẫu nhiên** (theo seed): 35 đom đóm ban đầu, thêm 1 con mỗi 3 s nếu còn < 20; 2 Bóng Mực ban đầu ở mép đảo, thêm 1 con mỗi 40 s, tối đa 5 (event `shade_spawned`).
10. **Điểm**: +10/đom đóm nhặt, +100/đèn thắp, +20/Bóng Mực bị choáng; khi **thắng** cộng thêm 1/giây còn lại (làm tròn xuống) + 50/flame còn lại.
11. Khi một tick có nhiều Bóng Mực chạm cùng lúc chỉ tính 1 lần (sau đó bất tử).
12. Thứ tự trong 1 bước: đọc nút → giảm bộ đếm → di chuyển → nhảy → nhặt → nạp → tỏa sáng → Bóng Mực di chuyển → va chạm → sinh thêm → kiểm tra kết thúc.

## Thiết kế
- `src/sim.js` chứa toàn bộ luật, dùng chung cho game 3D và headless → hai chế độ không thể lệch nhau.
- Số trong `game.contract.json` là nguồn duy nhất; game đọc file này lúc chạy.
- PRNG mulberry32 theo seed; mọi bộ đếm thời gian tính bằng tick nguyên.

## Đánh giá Phase 1
- Đạt: R-01 → R-12 có test tự động (20 test, xanh); R-13 kiểm bằng bot chơi trọn đêm qua headless (thắng ở seed 1 và 42) + chơi tay trên trình duyệt (xem bằng chứng).
- Chưa làm: âm thanh; phần hiển thị 3D chưa có test tự động (chỉ kiểm bằng mắt/ảnh).
- Rủi ro: các giả định 3, 5, 6 có thể khác ý giảng viên → nếu Ticket-02 làm rõ thì sửa và ghi lại.
