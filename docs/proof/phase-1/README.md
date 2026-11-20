# Bằng chứng Phase 1

Sinh lại toàn bộ: `bash scripts/proof.sh phase-1` → [test-report.txt](test-report.txt) + [runs/](runs/).

| Mã | Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| R-01 | Định dạng output, tick model | test `R-01` (2 test) | test-report.txt, runs/example.jsonl | Đạt |
| R-02 | Di chuyển theo camera, chuẩn hóa, giữ giá trị frame | test `R-02` (2 test) | test-report.txt | Đạt |
| R-03 | Nhặt đom đóm, giới hạn mang | test `R-03` (2 test) | test-report.txt | Đạt |
| R-04 | Nạp và thắp đèn, cạnh false→true | test `R-04` (2 test) | test-report.txt | Đạt |
| R-05 | Tỏa sáng: chi phí, choáng, đẩy, cooldown, hết choáng | test `R-05` (3 test) | test-report.txt | Đạt |
| R-06 | Bị chạm: mất lửa, rơi đom đóm, bất tử | test `R-06` | test-report.txt | Đạt |
| R-07 | Thắng all_lit / thua no_flames, dawn | test `R-07` (3 test) + bot | runs/autoplay-seed*.jsonl, runs/idle-seed42.jsonl | Đạt |
| R-08 | Vùng an toàn quanh đèn đã thắp | test `R-08` | test-report.txt | Đạt |
| R-09 | Dựng scenario không có event/điểm | test `R-09` | test-report.txt | Đạt |
| R-10 | Tính tất định | test `R-10` + chạy 2 lần so sha256 | test-report.txt mục 2 | Đạt |
| R-11 | Sai định dạng → exit 2 | test `R-11` (6 trường hợp) | test-report.txt | Đạt |
| R-12 | Làm tròn 3 chữ số | test `R-12` | test-report.txt | Đạt |
| R-13 | Game 3D chơi được tới thắng/thua, HUD, chơi lại | chơi tay trên trình duyệt | screenshots/ (thêm ảnh khi chơi) | Cần chụp ảnh |
| — | Hiệu năng headless | đo 18000 tick | test-report.txt mục 5 | ~0.1–0.2 s / đêm |

Ghi chú: phần đồ họa không có test tự động; luật chơi trong game 3D dùng chung `src/sim.js` với headless nên hành vi giống hệt.
