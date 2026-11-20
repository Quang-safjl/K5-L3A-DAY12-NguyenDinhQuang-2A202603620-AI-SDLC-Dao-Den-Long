---
name: verify-phase
description: Chạy toàn bộ kiểm chứng của một phase (test, tất định, bot chơi trọn đêm, hiệu năng) và lưu bằng chứng vào docs/proof/phase-N. Dùng trước khi gắn tag phase-N hoặc khi được hỏi "đã chạy đúng chưa".
---

1. `npm test` — nếu có `not ok`, dừng lại và sửa; không sửa test cho đạt.
2. `bash scripts/proof.sh phase-N` — sinh `docs/proof/phase-N/test-report.txt` và `runs/*.jsonl`.
3. Đọc report: phải thấy `# fail 0`, "giống hệt ✅", bot `state":"won"`, đứng yên thì `lost`.
4. Cập nhật bảng truy vết `docs/proof/phase-N/README.md`: mỗi yêu cầu R-xx → test/scenario → kết quả. Chưa đạt thì ghi "chưa đạt" + lý do.
5. Báo lại cho người dùng số liệu thật từ report (không tóm tắt "chắc là chạy").
