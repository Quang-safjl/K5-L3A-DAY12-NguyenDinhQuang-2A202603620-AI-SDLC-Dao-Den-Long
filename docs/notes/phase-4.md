# Phase 4 — Ticket-04 "Bình minh: phát hành v1.0.0" (Non-functional + Release, Test Contract v1.3)

Quyết định thiết kế: [ADR 0002](../adr/0002-benchmark-soak-release.md) · Bằng chứng: [docs/proof/phase-4](../proof/phase-4/README.md) · Retro: [retro.md](retro.md)

## Yêu cầu (chép nguyên văn phần bắt buộc)

> Đưa game từ "chạy được" thành sản phẩm phát hành được: đo được hiệu năng, ổn định khi chạy lâu, có bảng xếp hạng, dễ tiếp cận, cài đặt dễ dàng.
>
> Về sáng tạo: phần sáng tạo của bạn vẫn được giữ, miễn là luật, số liệu và Test Contract không bị đổi và đầu ra headless không đổi. Trong cảnh benchmark và soak test, nhân vật, kẻ địch và hiệu ứng sáng tạo thêm phải tắt (hoặc không ảnh hưởng số đo), để mọi bài được đo trên cùng một cảnh chuẩn.
>
> **1. Chế độ benchmark** — `<bench_cmd> --seed 42 --duration 30 --out bench.json`
> - Mở cửa sổ 1280×720, không toàn màn hình; tắt vsync nếu engine cho phép (ghi rõ trong README nếu không tắt được).
> - Tải Đêm 1 với đầy đủ hiệu ứng và ánh sáng như lúc chơi thật.
> - Sinh đúng 200 Bóng Mực ở trạng thái wander, rải đều trên đảo (seed 42), và đúng 100 đom đóm (bench được phép vượt trần của gameplay). 3 đèn L1–L3 đang sáng với fuel 100.
> - Trong cảnh bench tắt: sinh thêm thực thể, sát thương, nhặt đom đóm, hao dầu và điều kiện kết thúc Đêm. Bóng Mực vẫn di chuyển theo luật wander bình thường.
> - Không có input người chơi. Mây đứng yên tại (0,0,0). Camera bay vòng tròn tâm (0,0,0), bán kính 30 m, ở độ cao Y = 15 m, luôn nhìn vào (0,0,0), xuất phát ở góc 0° (điểm (30,15,0)), quay ngược chiều kim đồng hồ khi nhìn từ trên xuống, 15 s một vòng.
> - 3 s đầu là khởi động (không đo). Sau đó đo đúng --duration giây rồi tự thoát với mã 0.
> - Output: `contract_version, avg_fps, p1_low_fps, frame_ms_p95, frames, load_ms, peak_mem_mb, vsync_off, renderer, os`.
> - frames = N khung trong khoảng đo · avg_fps = 1000 × N / Σ dt_i · p1_low_fps: k = max(1, ceil(0.01 × N)), lấy k dt lớn nhất, = 1000 / trung bình k giá trị · frame_ms_p95 = phân vị 95 của dt · load_ms = từ lúc tiến trình bắt đầu tới khung hình đầu tiên của cảnh bench · peak_mem_mb = RSS cao nhất trong lúc đo; null nếu bản web không đo được và giải thích.
> - Ngưỡng (máy chấm): avg_fps ≥ 60 · p1_low_fps ≥ 30 · load_ms ≤ 10000.
>
> **2. Soak test** — `<soak_cmd> --seed 7 --nights 10 --out soak.json`. Chạy headless 10 Đêm liên tiếp trong cùng một tiến trình (Đêm 1 → 2 → 3 xoay vòng), Đêm thứ i dùng seed 7 + i, mỗi Đêm chạy tới khi kết thúc hoặc hết thời lượng chuẩn. Input ngẫu nhiên theo seed: mỗi 30 tick chọn lại hướng di chuyển; mỗi tick xác suất 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác. mem_start_mb: RSS sau khi tải xong Đêm đầu tiên. mem_end_mb: RSS sau khi reset xong Đêm cuối cùng. Output `{"nights", "crashes", "results", "mem_start_mb", "mem_end_mb", "duration_s"}`. Ngưỡng: crashes = 0 và mem_end_mb ≤ 1.2 × mem_start_mb.
>
> **3. Bảng xếp hạng cục bộ** — Sau màn hình Bình Minh (thắng Đêm 3) hoặc sau khi thua ở bất kỳ Đêm nào, cho nhập tên để lưu điểm. Tên: 3–12 ký tự [A-Za-z0-9_] (tiếng Việt có dấu là điểm cộng). Mỗi mục: name, score (tổng điểm các Đêm đã thắng), nights_won (0–3), achieved_at (ISO 8601 có múi giờ), seed. Giữ top 10, score giảm dần; bằng điểm thì ai đạt trước đứng trên. Lưu trên đĩa cục bộ, còn sau khi tắt/mở lại game. Có màn hình Bảng xếp hạng từ menu chính. Lệnh xuất: `<run_cmd> --export-leaderboard out.json` → `{"entries": [ ... ]}` đúng thứ tự.
>
> **4. Dễ tiếp cận** — Đổi phím: mọi hành động (di chuyển 4 hướng, nhảy, lướt, tương tác, tỏa sáng, tạm dừng); phát hiện trùng phím và báo; nút "Khôi phục mặc định"; được lưu. Phụ đề / chỉ báo hình ảnh: Bóng Mực xuất hiện (kèm mũi tên chỉ hướng ở mép màn hình), gió sắp thổi, 10 s cuối, đèn có fuel < 30. Giảm chuyển động: tắt rung camera và hiệu ứng chớp màn hình. Cỡ chữ UI tối thiểu 18 px ở 1280×720; tùy chọn chữ lớn (×1.25).
>
> **5. Đóng gói & tài liệu** — Clone repo sạch → README tối đa 3 lệnh → chơi được. README có: mô tả ngắn, ảnh chụp hoặc GIF, yêu cầu hệ thống, cài đặt, điều khiển, cách chạy test, headless, bench, soak. CHANGELOG.md có mục cho cả 4 phase. CREDITS.md liệt kê mọi asset, âm thanh và công cụ AI tạo nội dung. Có LICENSE. GitHub Release v1.0.0 có bản chạy được.
>
> **6. Test Contract v1.3** — `contract_version: "1.3"`; `game.contract.json` thêm `bench_cmd` và `soak_cmd`; mọi yêu cầu v1.0–v1.2 giữ nguyên.
>
> **7. Retro & demo** — Retro 1–2 trang; video demo .mp4 < 5 phút (Release v1.0.0 hoặc docs/demo/demo.mp4).
>
> **DoD** — bằng chứng; tag phase-4 và Release v1.0.0; bench.json và soak.json tự chạy được commit; mọi test Phase 1–3 còn hiệu lực vẫn đạt; repo public, đủ harness và tài liệu.

## Tiêu chí nghiệm thu
| Mã | Yêu cầu | Tiêu chí kiểm chứng được | Kiểm chứng |
|---|---|---|---|
| P4-01 | Contract v1.3 | `contract_version` 1.3, có `bench_cmd`/`soak_cmd`, `tuning` giống hệt tag phase-3, `run_cmd` không có comment | test P4-01 |
| P4-02 | Headless không đổi | seed 42 × 4000 tick × 3 Đêm giống từng byte `docs/proof/phase-3/runs/det-n*-a.jsonl` | test P4-02 |
| P4-03 | Cảnh bench | Đêm 1, đúng 200 Bóng wander + 100 đom đóm trên đảo, rải đều 4 góc phần tư, L1–L3 fuel 100, Mây (0,0,0), tất định theo seed | test P4-03 |
| P4-04 | Bench tắt gameplay | chạy quá thời lượng Đêm: 0 sự kiện, đủ 200/100, fuel 100, không thắng/thua, Bóng chỉ wander và có di chuyển | test P4-04 |
| P4-05 | Camera bench | (30,15,0) lúc 0 s, (0,15,−30) lúc 3.75 s, (−30,15,0) lúc 7.5 s, quay về sau 15 s; luôn R 30, Y 15 | test P4-05 |
| P4-06 | Công thức số đo | avg, 1% low (k = max(1, ceil(1%·N))), p95 trên dữ liệu biết trước | test P4-06 |
| P4-07 | Bench chạy thật | thoát mã 0, viewport 1280×720, đủ trường; ngưỡng avg ≥ 60, 1% low ≥ 30, load ≤ 10000 | `bench.json` |
| P4-08 | Soak | 0 crash, RAM cuối ≤ 1.2 × đầu, kết quả tất định, đúng định dạng | test P4-07 + `soak.json` |
| P4-09 | Input soak | đổi hướng đúng mỗi 30 tick; tần suất 5/3/2/10 % (±0.6 %) | test P4-08 |
| P4-10 | Bảng xếp hạng | tên hợp lệ/không hợp lệ, top 10, sắp xếp, bằng điểm ai trước trên, ISO có múi giờ | test P4-09 |
| P4-11 | Lưu đĩa + export | POST → `data/leaderboard.json`, còn sau khi khởi động lại server, `--export-leaderboard` đúng thứ tự | test P4-10 + E2E |
| P4-12 | Nhập tên sau thua / Bình Minh, màn hình Bảng xếp hạng | từ chối "ab", lưu "Mây_đẹp", bảng hiện đúng thứ tự, còn sau khi tải lại | UI smoke |
| P4-13 | Đổi phím | mọi hành động; trùng phím bị từ chối + báo; J nhảy được; khôi phục mặc định; lưu | test P4-11 + UI smoke |
| P4-14 | Phụ đề / chỉ báo | Bóng xuất hiện + mũi tên mép màn hình, gió sắp thổi, 10 s cuối, đèn < 30 | UI smoke + ảnh |
| P4-15 | Giảm chuyển động | bị đánh: mặc định có chớp; bật giảm chuyển động thì không chớp, không rung | UI smoke |
| P4-16 | Cỡ chữ | mọi chữ đang hiện ≥ 18 px ở 1280×720 (menu, HUD, kết quả, bảng xếp hạng, đổi phím); chữ lớn ×1.25 | UI smoke |
| P4-17 | Đóng gói & tài liệu | README ≤ 3 lệnh, ảnh, yêu cầu hệ thống, bench/soak; CHANGELOG 4 phase; CREDITS; LICENSE; Release có zip chạy được | thử clone sạch |

## Giả định
1. **Bench trên trình duyệt.** Game là bản web nên `bench.js` (Node) tự mở Chrome/Edge/Chromium ở chế độ cửa sổ ứng dụng (`--app`) kích thước 1280×720, `--force-device-scale-factor=1`, rồi chỉnh để **vùng vẽ** đúng 1280×720. Vsync tắt bằng `--disable-gpu-vsync --disable-frame-rate-limit` (khung hình không bị khóa ở tần số màn hình; bằng chứng: avg_fps đo được > 60 Hz của màn hình). Cần có trình duyệt Chromium trên máy; chỉ định bằng `--browser` hoặc biến `CHROME` nếu không tìm thấy.
2. **"Rải đều trên đảo"**: phân bố đều theo diện tích trong đĩa bán kính 38 m (đảo 40 m, chừa mép bãi cát). Bóng không được đặt trong vùng an toàn 6 m của L1–L3 (nếu đặt vào sẽ bị luật đẩy ra ngay ở tick đầu).
3. **"Bóng Mực vẫn di chuyển theo luật wander bình thường"**: trong bench Mây không là mục tiêu (không chase/sát thương), nên Bóng chỉ ở `wander`. Theo luật wander Ticket-03, Bóng đi về đèn tắt gần nhất (L4/L5) với 1.5 m/s và dừng cách ~1.5 m — một số Bóng tới nơi trong 33 s và đứng yên (vẫn nhấp nhô hiển thị). Đây là hành vi đúng luật, không sửa luật cho bench.
4. **"Hiệu ứng sáng tạo thêm phải tắt"** trong bench: tắt cây dừa/đá trang trí và mặt nước phản chiếu (Water). Giữ: ánh sáng (5 đèn + đèn của Mây + trăng + bán cầu), texture vật liệu, bầu trời, HUD — đây là "đầy đủ hiệu ứng và ánh sáng như lúc chơi thật". Không âm thanh.
5. **load_ms** tính từ lúc tiến trình `bench.js` bắt đầu (gồm khởi động trình duyệt) tới khung hình đầu tiên của cảnh bench (trang báo về server cục bộ).
6. **peak_mem_mb** = tổng RSS (working set) của mọi tiến trình trình duyệt thuộc hồ sơ tạm của lần chạy (Chromium chạy nhiều tiến trình: trình duyệt, GPU, renderer…), lấy mẫu mỗi 1 s trong khoảng đo. Không dùng `null`.
7. **Soak**: "Đêm thứ i dùng seed 7 + i" hiểu với i = 0…9 (Đêm đầu dùng đúng `--seed`). Đảo = (i mod 3) + 1. Input: hướng = góc ngẫu nhiên đều (vector đơn vị), `cam_yaw_deg` 0; mỗi tick rút 4 số độc lập cho nhảy/lướt/tỏa sáng/tương tác. Bộ sinh input dùng `makeRng` của sim với seed riêng của Đêm.
8. **RAM soak** đo sau 2 lần `gc()`. Soak chạy với cờ V8 `--max-opt=1 --optimize-for-size --expose-gc` (tự chạy lại chính nó với các cờ này nếu được gọi trần). Lý do và số đo ở ADR 0002: không có rò rỉ (`heapUsed` phẳng ~5 MB qua 40 Đêm); phần RSS tăng 37 → 56 MB khi để mặc định là vùng nhớ của trình biên dịch tối ưu (Maglev/Turbofan), không phải dữ liệu game.
9. **Bảng xếp hạng**: "một lượt chơi" bắt đầu khi bấm *Bắt đầu* hoặc chọn một Đêm. `score` = tổng điểm các Đêm đã thắng trong lượt (chơi lại một Đêm đã thắng thì thay điểm Đêm đó, không cộng dồn); `nights_won` = số Đêm khác nhau đã thắng; `seed` = seed của lượt (Đêm n dùng seed + n − 1). Bằng điểm: so thời điểm tuyệt đối (khác múi giờ vẫn đúng), vẫn bằng thì mục lưu trước đứng trên.
10. **"Lưu trên đĩa cục bộ"**: `serve.js` ghi `data/leaderboard.json` (ghi file tạm rồi đổi tên). Nếu trang được phục vụ bởi server tĩnh khác (không có `/api`), game lưu vào `localStorage` của trình duyệt (cũng nằm trên đĩa, còn sau khi tắt/mở) — nhưng lệnh export chỉ đọc file của `serve.js`.
11. **Tên**: chuẩn hóa NFC, đếm theo ký tự; cho phép thêm chữ tiếng Việt có dấu (điểm cộng). Không cho khoảng trắng.
12. **Đổi phím**: mỗi hành động có 2 ô (chính, phụ). Thêm 2 hành động xoay camera (←/→) để chúng cũng đổi được và không trùng. Enter/Tab dành cho menu. Trùng phím → **từ chối gán** và báo hành động đang dùng phím đó.
13. **Giảm chuyển động**: mặc định theo `prefers-reduced-motion` của hệ điều hành. Bật thì tắt rung camera, chớp màn hình (bị đánh, Tỏa Sáng), hoạt ảnh giao diện, nhấp nháy đồng hồ/đèn yếu/Mây bất tử/đom đóm sắp tan; đèn yếu vẫn được báo bằng thanh dầu đỏ + phụ đề.
14. **Cỡ chữ ≥ 18 px** áp dụng cho mọi chữ giao diện (kể cả bộ đếm FPS). Biểu tượng emoji trang trí trong thẻ chọn màn 22 px.
15. **Release**: bản chạy được = file zip mã nguồn từ `git archive` (đã gồm three.js r160 trong `vendor/`, chạy offline) + hướng dẫn `node serve.js`. Cần Node ≥ 18 và một trình duyệt hiện đại.
16. **Video demo** do người học tự quay (chơi trực tiếp); repo có chỗ để link ở đầu README.

## Thay đổi so với phase trước (không phá luật)
| Chỗ đổi | Lý do |
|---|---|
| `game.contract.json`: 1.2 → **1.3**, thêm `bench_cmd`, `soak_cmd`; `run_cmd` "node serve.js 8000  # rồi mở …" → `node serve.js` | Ticket-04 §6; comment `#` trong run_cmd sẽ nuốt `--export-leaderboard` khi chạy qua shell |
| Test P3-01, P2-01: chấp nhận version 1.3 (comment `TICKET-04:`) | chỉ đổi số phiên bản; khóa tuning giữ nguyên (P4-01 so với tag phase-3) |
| `sim.js`: cờ `g.bench` (mặc định `false`) | cảnh benchmark; mọi nhánh khi `bench=false` giữ nguyên → P4-02 chứng minh headless giống hệt |
| `index.html`: three.js từ `vendor/` thay vì CDN | chạy offline, load_ms ổn định |
| Phím cố định → bảng phím đổi được (`src/keybinds.js`) | §4; mặc định giống hệt Phase 3 |
| Bóng Mực, đom đóm vẽ theo lô (InstancedMesh/Points) | bench 200 Bóng: ~1000 → vài draw call; trước khi đổi: 1% low 20.6 FPS trên máy dev |

## Đánh giá Phase 4
- **Đạt (test tự động):** P4-01 → P4-11; tổng **73/73** test (Phase 1–3 vẫn đạt; 2 test chỉ đổi số phiên bản). Headless 3 Đêm giống hệt từng byte Phase 3.
- **Đạt (đo thật trên máy dev, GPU tích hợp):** bench avg **109.5** FPS, 1% low **46.0**, p95 13.5 ms, load **1.2 s**, RAM trình duyệt 804 MB (các lần chạy khác: 138–141 / 62–63). Soak 10 Đêm: **0 crash**, RAM **38.7 → 40.3 MB (1.04×)**.
- **Đạt (UI smoke 44/44, Chrome headless):** nhập tên sau thua và ở Bình Minh, Bảng xếp hạng còn sau khi tải lại, đổi phím + báo trùng + khôi phục, phụ đề 4 loại + mũi tên mép màn hình, giảm chuyển động tắt chớp màn hình, mọi chữ ≥ 18 px, chữ lớn ×1.25. E2E thật: giao diện → `serve.js` → `data/leaderboard.json` → `--export-leaderboard`.
- **Chưa kiểm chứng tự động:** rung camera (chỉ kiểm bằng code/chơi tay); hình ảnh 3D (kiểm bằng ảnh chụp `docs/screenshots/`).
- **Chưa đạt / chưa có:** video demo (người học tự quay). Repo thiếu tag `phase-2` từ trước.
- **Rủi ro:** bench cần Chrome/Edge/Chromium trên máy chấm; nếu máy chấm không cho tắt vsync bằng cờ thì avg_fps bị khóa ở tần số màn hình (README có ghi). Số đo dao động ±25 % theo nhiệt độ máy.
- **Hỏng phase trước?** Không — P4-02 và §7 của report chứng minh output headless không đổi; mọi test cũ còn hiệu lực vẫn đạt.
