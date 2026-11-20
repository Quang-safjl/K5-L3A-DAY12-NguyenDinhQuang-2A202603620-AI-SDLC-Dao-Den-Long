# ADR 0001 — Mô hình trạng thái đèn có nhiên liệu & luật thắng ở bình minh

- Trạng thái: Đã chấp nhận (Phase 3, Ticket-03 "Đèn cạn dầu")
- Ngày: 2026-11-20

## Bối cảnh
Đến Phase 2, đèn chỉ có 2 trạng thái một chiều: `tắt → sáng` (vĩnh viễn) và trận thắng ngay khi mọi đèn sáng (`all_lit`). Playtest: người giỏi thắng sau 2 phút, cuối Đêm thiếu căng thẳng. Ticket-03 yêu cầu đèn có thể tắt lại và mục tiêu là "giữ đảo sáng tới bình minh".

## Quyết định
1. **Đèn là máy trạng thái 2 chiều** với dữ liệu kèm theo:
   `UNLIT(deposited, ever_lit) --đủ chi phí--> LIT(fuel=100) --fuel ≤ 0--> UNLIT(deposited=0, ever_lit=true)`.
   Chi phí thắp = 10 nếu `ever_lit = false`, 5 nếu đã từng sáng (thắp lại, `relit_count++`).
   Trong `LIT`: tương tác = châm dầu `used = min(mang, ceil((100−fuel)/10))`; đèn đầy (used = 0) không được chọn.
2. **Dầu lưu bằng số nguyên đơn vị 1/60** (`fuelU`, 100 dầu = 6000). Hao 1 đơn vị/tick, mỗi Bóng đang `drain` hút thêm 5 đơn vị/tick. Chỉ làm tròn khi xuất snapshot (1 chữ số). Lý do: tránh sai số số thực làm lệch tick đèn tắt giữa các lần chạy/máy — giữ tính tất định.
3. **Vùng an toàn phụ thuộc dầu**: `hasZone = lit && fuel ≥ 30`. Mọi chỗ trước đây dùng `lit` cho vùng an toàn (chặn, đẩy ra, sinh Bóng) chuyển sang `hasZone`. Châm dầu lên ≥ 30 tái dùng đúng cơ chế "đẩy ra mép trong ≤ 30 tick, không sát thương" của Phase 2 → không cần code riêng.
4. **Bóng Mực thêm trạng thái `drain`**: `wander` chọn đèn yếu gần nhất (fuel < 30, bằng nhau id nhỏ), không có thì đi về đèn tắt gần nhất; ≤ 2 m → `drain` (đứng yên). Thoát: Mây ≤ 6 m → `chase`; Tỏa Sáng → `stunned`; đèn tắt / fuel ≥ 30 / > 2 m → `wander`. Hết choáng → `wander` (thay vì chase như Phase 2).
5. **Luật thắng chuyển hẳn về bình minh**, đánh giá ở bước cuối tick sau mọi cập nhật: hết lửa → `no_flames` (luôn trước); hết giờ → `dawn_survived` nếu số đèn sáng ≥ ceil(0.6 × tổng), ngược lại `dawn`. Đèn tắt đúng tick bình minh (bước 2) không được tính.
6. Thứ tự tick Ticket-02 giữ nguyên; trừ dầu và tắt đèn chèn vào cuối bước 2 (trước di chuyển, nhặt, tương tác).

## Hệ quả
- (+) Một hàm `step` duy nhất cho game 3D và headless → hai chế độ không lệch luật.
- (+) Test tất định vẫn đạt; không có số thực tích lũy cho dầu.
- (−) Phá tương thích: `all_lit`, điểm cũ, thời lượng đêm, "đèn sáng không nhận đom đóm", "Bóng không vào vùng an toàn", "hết choáng → chase" — xem CHANGELOG.md. 5 test cũ được sửa có ghi `TICKET-03`.
- (−) Bot bằng chứng phải biết châm dầu; với kẻ địch đầy đủ bot đơn giản vẫn chưa giữ được ngưỡng đèn.

## Phương án đã cân nhắc
- Lưu dầu số thực rồi làm tròn mỗi tick: đơn giản hơn nhưng dễ lệch ±1 tick ở ngưỡng 30/0 → loại.
- Tách `refuel` thành nút riêng: ticket yêu cầu dùng chung nút Tương tác → loại.
