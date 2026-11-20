# Bằng chứng Phase 4

Sinh lại: `BENCH=1 CHROME=/đường/dẫn/chrome bash scripts/proof.sh phase-4` → [test-report.txt](test-report.txt), [runs/](runs/), [../../../bench.json](../../../bench.json), [../../../soak.json](../../../soak.json).
Máy đo: Intel Core i5-1235U (12 luồng), GPU tích hợp Intel UHD, RAM 8 GB, Windows 11 (10.0.26100), Chrome 157, Node 24.15.

| Mã | Yêu cầu | Kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| R-xx, P2-xx, P3-xx | Phase 1–3 còn hiệu lực | 58 test cũ (2 test chỉ đổi số phiên bản, comment `TICKET-04`) | §1 | Đạt |
| UI-01…04 | Chọn màn, asset (ngoài ticket) | tests/ui.test.js | §1 | Đạt |
| P4-01 | Contract v1.3: `bench_cmd`, `soak_cmd`, tuning giữ nguyên | test | §1 | Đạt |
| P4-02 | Headless không đổi | test + so file với Phase 3 | §1, §7 | Đạt — 3 Đêm giống hệt từng byte |
| P4-03…06 | Cảnh bench, tắt gameplay, camera, công thức số đo | 4 test | §1 | Đạt |
| P4-07 | Bench chạy thật, thoát mã 0, 1280×720 | `node bench.js --seed 42 --duration 30 --out bench.json` | §9, bench.json | **Đạt**: avg **109.5** FPS (≥ 60) · 1% low **46.0** (≥ 30) · p95 13.5 ms · load **1242** ms (≤ 10000) · RAM 804 MB |
| P4-08 | Soak 10 Đêm | test P4-07 + `node soak.js --seed 7 --nights 10` | §8, soak.json | **Đạt**: 0 crash · RAM 38.7 → 40.3 MB (**1.04×**, giới hạn 1.2×) · 0.5 s |
| P4-09 | Input soak theo seed | test P4-08 (60 000 tick) | §1 | Đạt |
| P4-10 | Bảng xếp hạng: tên, top 10, sắp xếp, ISO múi giờ | test P4-09 | §1 | Đạt |
| P4-11 | Lưu đĩa, còn sau khởi động lại, export | test P4-10 + E2E thật + §10 | §1, §10 | Đạt |
| P4-12 | Nhập tên sau thua / Bình Minh, màn Bảng xếp hạng | UI smoke | §6 | Đạt |
| P4-13 | Đổi phím, báo trùng, khôi phục, lưu | test P4-11 + UI smoke | §1, §6, [ảnh](../../screenshots/keys.jpg) | Đạt |
| P4-14 | Phụ đề + mũi tên mép màn hình | UI smoke + ảnh | §6, [ảnh](../../screenshots/play.jpg) | Đạt |
| P4-15 | Giảm chuyển động | UI smoke (chớp có/không) | §6 | Đạt (rung camera: kiểm bằng code + chơi tay, không có kiểm tra tự động) |
| P4-16 | Chữ ≥ 18 px, chữ lớn ×1.25 | UI smoke đo mọi chữ đang hiện | §6 | Đạt |
| P4-17 | README ≤ 3 lệnh, ảnh, CHANGELOG 4 phase, CREDITS, LICENSE | đọc + thử clone sạch | README.md | Đạt (xem mục "Thử clone sạch") |
| DoD | Tag `phase-4`, Release v1.0.0 có zip | `scripts/package.sh` | GitHub | Xem Release |
| DoD | Video demo | — | — | **Chưa có** — người học tự quay |

## Benchmark: các lần chạy trên máy đo (để thấy độ dao động)
| Lần | Thời điểm trong quá trình làm | avg_fps | p1_low_fps | frame_ms_p95 | load_ms |
|---|---|---:|---:|---:|---:|
| 1 | bản đầu (mesh riêng, đo RAM bằng PowerShell mỗi 0.5 s) | 60.9 | 20.6 | 35.2 | 2570 |
| 2 | sau instancing + đo RAM bằng 1 tiến trình | 117.6 | 34.4 | 14.7 | 1566 |
| 3 | như lần 2, chạy trong proof.sh ngay sau UI smoke | 83.4 | 19.7 | 32.7 | 1384 |
| 4 | sau khi HUD chỉ ghi DOM khi đổi + bỏ blur HUD | 138.1 | 63.3 | 10.8 | 1481 |
| 5 | như lần 4 | 140.8 | 62.3 | 10.7 | 1787 |
| 6 | như lần 4, trong proof.sh sau UI smoke → **bench.json đã commit** | 109.5 | 46.0 | 13.5 | 1242 |

Laptop GPU tích hợp nóng lên sau UI smoke nên lần 6 thấp hơn lần 4–5; vẫn đạt ngưỡng. Số trên máy chấm của giảng viên sẽ khác.

## Thử clone sạch
Đã thử (20/11/2026, commit `3183dfa`): `git clone` vào thư mục tạm mới → `cd` → `node serve.js 8124` → mở bằng Chrome (WebGL thật qua SwiftShader, không dùng cấu hình/localStorage sẵn có):
- menu hiện, bấm *Bắt đầu* → Enter → giữ W 1.5 s: `mode = play`, Mây đi được 9.9 m;
- 0 lỗi JavaScript/console, 0 request lỗi (three.js nạp từ `vendor/`, không cần Internet);
- `node --test` trong bản clone: 73/73 đạt.
