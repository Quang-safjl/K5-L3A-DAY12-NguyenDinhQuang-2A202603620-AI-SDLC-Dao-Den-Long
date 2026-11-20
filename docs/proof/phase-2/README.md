# Bằng chứng Phase 2

Sinh lại: `bash scripts/proof.sh phase-2` (đặt `CHROME=/đường/dẫn/chrome` để chạy cả kiểm thử giao diện) → [test-report.txt](test-report.txt), [runs/](runs/).

| Mã | Yêu cầu | Kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| R-01…R-12 | Phase 1 (regression, số chuẩn) | 20 test | test-report §1 | Đạt (3 test sửa kỳ vọng theo Ticket-02, xem docs/notes/phase-2.md) |
| P2-01 | Số chuẩn / contract v1.1 | test | §1 | Đạt |
| P2-02 | 3 Đêm, snapshot v1.1, night_start | test | §1 | Đạt |
| P2-03 | Lướt | test | §1 | Đạt |
| P2-04 | Nhảy | test | §1 | Đạt |
| P2-05 | Nhặt theo chênh cao | test | §1 | Đạt |
| P2-06/07 | Rơi khỏi đảo | test | §1 | Đạt |
| P2-08 | Lịch sinh Bóng Mực | test | §1 | Đạt |
| P2-09/10 | AI Bóng Mực, bị đánh rơi đom đóm | test | §1 | Đạt |
| P2-11 | Vùng an toàn đẩy ra ≤ 30 tick | test | §1 | Đạt |
| P2-12 | Tỏa Sáng chuẩn | test | §1 | Đạt |
| P2-13/14 | Gió Lạc | test (scenario Đêm 2) | §1 | Đạt |
| P2-15 | Bùa Gió | test (scenario Đêm 2) | §1 | Đạt |
| P2-16 | Tạm dừng (headless) | test | §1 | Đạt |
| P2-17/18 | Đêm 2 bục nhảy, cầu tre | test | §1 | Đạt |
| P2-19/20 | Đêm 3 tầng/dốc/bục, gió | test | §1 | Đạt |
| P2-21 | Nạp đèn gần nhất / id nhỏ | test | §1 | Đạt |
| P2-22 | Một Đêm ≤ 30 s | test + đo | §5 (~0.2 s/đêm) | Đạt |
| P2-23 | Tất định 3 đêm | test + cmp | §2 | Đạt |
| P2-24 | Chuỗi 3 Đêm, Bình Minh, chơi lại | UI smoke | §6 | Đạt |
| P2-25 | Cài đặt lưu | UI smoke | §6 | Đạt |
| P2-16 UI | Menu tạm dừng | UI smoke | §6 | Đạt |
| — | Thắp được hết đèn mỗi bản đồ | bot, không kẻ địch | §3a | Đêm 1, 2: thắng · Đêm 3: 5/7 (giới hạn bot) |
| — | Bot với đầy đủ kẻ địch | bot | §3b | Chưa thắng (bot đơn giản) |
| P2-26 | Âm thanh | chơi tay | (thêm clip/ghi chú) | Cần xác nhận khi chơi |
| P2-27 | HUD đầy đủ | UI smoke một phần + ảnh | screenshots/ | Cần ảnh |
| P2-28 | Bảng màu chuẩn | đọc code (`C` trong src/game3d.js) + ảnh | screenshots/ | Cần ảnh |
| P2-29 | ≥ 30 FPS 1280×720 | bộ đếm FPS trong game | screenshots/ | Cần ảnh |
