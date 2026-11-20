---
name: verify-phase
description: Chạy toàn bộ kiểm chứng của một phase (test, tất định, bot chơi trọn đêm, hiệu năng, soak, benchmark, UI smoke) và lưu bằng chứng vào docs/proof/phase-N. Dùng trước khi gắn tag phase-N hoặc khi được hỏi "đã chạy đúng chưa".
---

1. `npm test` — nếu có `not ok`, dừng lại và sửa; không sửa test cho đạt.
2. `bash scripts/proof.sh phase-N` — sinh `docs/proof/phase-N/test-report.txt` và `runs/*.jsonl`. Phase 4: thêm `BENCH=1` để chạy benchmark có cửa sổ thật (ghi đè `bench.json`), `CHROME=<chrome.exe>` để chạy UI smoke.
3. Đọc report: phải thấy `# fail 0`, "giống hệt ✅" cho cả 3 đêm, bot không-kẻ-địch thắp được đèn, đứng yên thì `lost`, hiệu năng mỗi đêm < 30 s, UI smoke toàn PASS. Phase 4: "giống hệt Phase 3 ✅" (headless không đổi), soak `crashes 0` và `mem_end_mb ≤ 1.2 × mem_start_mb`, bench `avg_fps ≥ 60`, `p1_low_fps ≥ 30`, `load_ms ≤ 10000`.
4. Số đo hiệu năng dao động: chạy bench ≥ 2 lần; ghi cả lần xấu nếu có, kèm cấu hình máy. Không chỉnh tay `bench.json`/`soak.json`.
5. Cập nhật bảng truy vết `docs/proof/phase-N/README.md`: mỗi yêu cầu → test/scenario → kết quả. Chưa đạt thì ghi "chưa đạt" + lý do.
6. Báo lại cho người dùng số liệu thật từ report (không tóm tắt "chắc là chạy").
