# Bằng chứng Phase 3

Sinh lại: `CHROME=/đường/dẫn/chrome bash scripts/proof.sh phase-3` → [test-report.txt](test-report.txt), [runs/](runs/).

| Mã | Yêu cầu | Kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| R-xx, P2-xx | Phase 1–2 không bị thay | 43 test | §1 | Đạt (5 test sửa vì luật bị thay, xem CHANGELOG) |
| P3-01…P3-15 | Dầu, châm, thắp lại, sức chứa, drain, vùng an toàn, luật bình minh | 15 test | §1 | Đạt |
| P3-16 | Không thắng sớm | R-07 viết lại | §1 | Đạt |
| — | Tất định 3 đêm | cmp | §2 | Đạt |
| — | Giữ đủ đèn tới bình minh (không kẻ địch) | bot | §3a | Đêm 1, 2 thắng · Đêm 3 thua (giới hạn bot) |
| — | Đứng yên → thua | headless | §4 | Đạt (dawn) |
| — | Một đêm ≤ 30 s | đo | §5 | ~0.2 s |
| P3-17 | UI dầu / sức chứa / nhắc | UI smoke + ảnh | §6, screenshots/ | Đạt (smoke) · cần ảnh |
| P3-18 | Chế độ mù màu | UI smoke + ảnh | §6, screenshots/ | Đạt (lưu & áp dụng) · cần ảnh |
| UI-01…UI-03 | Chọn màn: mở sẵn cả 3 Đêm, điểm cao nhất, đọc lưu an toàn (ngoài ticket) | tests/ui.test.js | §1 | Đạt |
| UI-04 | Asset đồ họa có trong repo + ghi nguồn; sim không phụ thuộc phần hiển thị | tests/ui.test.js | §1 | Đạt |
| UI-05 | Chọn màn trong trình duyệt (mở sẵn 3 Đêm, chọn Đêm 3) | UI smoke | §6 | Đạt (20/20) |
| DoD | ADR | docs/adr/0001-lantern-fuel-and-dawn-win.md | — | Có |
| DoD | Changelog breaking changes | CHANGELOG.md | — | Có |
