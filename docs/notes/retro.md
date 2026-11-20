# Retro — Đảo Đèn Lồng (Day 12 AI SDLC, 4 phase)

## 1. Tổng hợp Evaluation 4 phase
| Phase | Yêu cầu chính | Kết quả (bằng chứng) | Hỏng phase trước? | Còn phải chỉnh |
|---|---|---|---|---|
| 1 · PRD-0, Contract v1.0 | Đêm 1 chơi được, headless | 20 test, tất định, bot thắng trọn đêm (seed 1, 42) | — | Hiển thị 3D chưa có test tự động |
| 2 · Ticket-02, v1.1 | Số liệu chuẩn, 3 đảo, lướt, Gió Lạc, menu/HUD | 43 test, UI smoke 14 | Không: 3 test Phase 1 sửa kỳ vọng vì số liệu bị thay (có lý do) | Bot chưa thắng khi có kẻ địch |
| 3 · Ticket-03, v1.2 (change request) | Dầu đèn, thắp lại, drain, thắng ở bình minh | 58 test, UI smoke 17, ADR 0001, CHANGELOG | Không: 5 test sửa đều thuộc luật [THAY THẾ] | Bot thua Đêm 3 (không leo tầng) |
| 4 · Ticket-04, v1.3 (phát hành) | Bench, soak, bảng xếp hạng, dễ tiếp cận, đóng gói | 73 test, UI smoke 44; headless giống hệt Phase 3; soak 0 crash, RAM 1.0×; bench ~139 FPS / 1% low ~63 / load ~1.5 s trên GPU tích hợp | Không: 2 test chỉ đổi số phiên bản | Video demo do người học quay; thiếu tag `phase-2` |

Số liệu cuối nằm ở [bench.json](../../bench.json), [soak.json](../../soak.json), [docs/proof/phase-4/test-report.txt](../proof/phase-4/test-report.txt).

## 2. Điều hiệu quả khi làm với AI
- **Một nguồn luật (`sim.js`) cho game, headless, bench và soak.** Quyết định ở Phase 1 trả lãi suốt dự án: Phase 4 chỉ cần thêm một cờ `bench` thay vì viết lại mô phỏng.
- **Test gọi CLI thật + so output từng byte với bằng chứng phase trước** (P4-02). Nhờ vậy dám tối ưu hiển thị, đổi input, thêm bench mà không sợ phá Test Contract.
- **Đo trước khi tin**: chạy soak/bench thật ngay khi có bản đầu đã lộ 2 lỗi đo (RAM do JIT, công cụ đo gây giật) mà đọc code không thấy.
- **Xem ảnh chụp thật** của WebGL (Chrome headless) thay vì tin "code trông đúng" — bắt được vách đá đen, cột bảng lệch.
- Chép ticket nguyên văn vào `docs/notes/phase-N.md` + mục Giả định: AI không phải đọc lại ticket, và mọi chỗ mơ hồ có câu trả lời ghi rõ.

## 3. Điều không hiệu quả
- AI viết test UI sai cách nhiều lần (selector chữ trùng, thời điểm lệch tick) — tốn vòng sửa; cần quy ước selector theo id từ đầu.
- Đọc ticket Phase 2 qua ảnh chụp rất tốn token (~40k) so với text.
- Bot tự chơi chưa đủ giỏi để thắng khi có kẻ địch — dừng cải thiện sau 2 lần thử để không đốt token, ghi trung thực "chưa thắng".
- Quên gắn tag `phase-2` đúng lúc — không có kiểm tra tự động nào nhắc.

## 4. Những lần AI sai và cách phát hiện
| Lỗi | Phát hiện bằng | Chỉnh harness |
|---|---|---|
| Lệch 1 tick khi choáng / recoil / drain (P1–P3) | test kỳ vọng tick chính xác | quy tắc "tick nguyên" trong AGENTS.md |
| Màn hình đen do `python http.server` trả MIME sai (P1) | người chơi thử trên Windows | `serve.js` + ghi vào AGENTS.md |
| Nút Tiếp tục không chạy, mất cú nhấn nhanh (P2) | UI smoke | quy tắc `keys`/`tapped`, cạnh pause trong AGENTS.md |
| "Rò rỉ" RAM soak thực ra là JIT (P4) | probe in `heapUsed` qua 40 Đêm | ADR 0002 |
| Công cụ đo RAM làm giật khung hình (P4) | so 1% low trước/sau | quy tắc đo trong AGENTS.md, skill verify-phase chạy bench ≥ 2 lần |
| `run_cmd` có comment nuốt tham số (P4) | đọc lại yêu cầu `<run_cmd> --export-leaderboard` | test P4-01 |

Không có lần nào AI "bịa" yêu cầu được giữ lại: chỗ mơ hồ (seed 7 + i với i từ 0 hay 1, "rải đều", RAM bản web…) đều vào mục Giả định.

## 5. Harness giúp nhiều nhất
1. **Hook Stop `scripts/hooks/stop-if-tests-red.sh`** — agent không thể kết thúc khi test đỏ; buộc sửa ngay thay vì "để sau".
2. **AGENTS.md ngắn, cập nhật mỗi phase** bằng bài học thật (MIME, cạnh pause, `hasZone`, `g.bench`, đo hiệu năng, selector Playwright) — lỗi cũ không lặp lại.
3. **Skill `verify-phase` + `scripts/proof.sh`** — một lệnh sinh toàn bộ bằng chứng, chạy lại ở tag nào cũng ra cùng kết quả (trừ số đo thời gian).
4. UI smoke (Playwright + three.js giả) — kiểm luồng giao diện mà không cần GPU.

## 6. Token / chi phí
| Phase | Ước tính | Ghi chú |
|---|---|---|
| 1 | 150–200k | đọc tài liệu qua ảnh |
| 2 | 250–300k | đọc ticket qua ảnh ~40k |
| 3 | 120–150k | ticket dạng text |
| Giao diện + 4 | đầu ra ~150–200k; đầu vào tích lũy vài triệu (đa số cache) | một phiên Claude Code dài; số chính xác xem `/cost` |

Cách tiết kiệm: ticket dạng text; đọc đúng đoạn file cần (`grep`, `sed -n`); sửa bằng script thay thế có assert; không dùng subagent; chạy bộ bằng chứng đầy đủ một lần ở cuối; dừng việc không đáng (bot) và ghi trung thực.

## 7. Nếu làm lại
- Viết `scripts/proof.sh` và hook Stop ngay giờ đầu (đã làm) **và** thêm kiểm tra "đã gắn tag phase trước chưa" vào skill.
- Đặt id/`data-*` cho mọi nút từ đầu để test UI không phụ thuộc chữ.
- Thiết kế hiển thị theo lô (instancing) ngay khi biết có nhiều thực thể, và đặt ngân sách hiệu năng (draw call, ghi DOM mỗi khung) vào AGENTS.md từ Phase 2.
- Chia phiên AI theo phase (ngắn hơn) để giảm token đầu vào tích lũy.
