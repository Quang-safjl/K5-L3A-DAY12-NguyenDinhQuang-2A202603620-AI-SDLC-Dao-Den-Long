# ADR 0002 — Benchmark trong trình duyệt, soak với cờ V8, bảng xếp hạng qua serve.js

- Trạng thái: Chấp nhận (Phase 4, Ticket-04, Test Contract v1.3)
- Bối cảnh: game là bản web (Three.js); Ticket-04 yêu cầu lệnh CLI cho benchmark (mở cửa sổ 1280×720, đo FPS/RAM), soak test chạy lâu, bảng xếp hạng lưu đĩa + lệnh xuất, mà không được đổi luật hay output headless.

## Quyết định 1 — Cảnh bench là cờ trong sim, không phải nhánh luật riêng
`createBenchGame()` (`src/bench.js`) dựng Đêm 1 rồi đặt `g.bench = true`. Trong `step()` cờ này chỉ **tắt**: hao dầu (bước 2b), nhặt (4), sát thương (9), sinh theo lịch (10), kết thúc (11) và việc Bóng nhận Mây làm mục tiêu (`playerTargetable`). Không có nhánh nào chạy *thêm* khi bench. Khi `bench = false` (mọi lệnh headless), luồng code giống hệt Phase 3 — test P4-02 so từng byte 3 Đêm với bằng chứng Phase 3.

Đã cân nhắc: dựng cảnh bench chỉ ở phía hiển thị (không gọi `step`) → không đúng "Bóng Mực vẫn di chuyển theo luật wander", và không đo chi phí sim thật.

## Quyết định 2 — `bench.js` điều khiển trình duyệt Chromium bằng cờ dòng lệnh, không thêm dependency
- Mở `chrome/msedge --app=http://127.0.0.1:<port>/index.html?bench=1&seed=..&duration=..` với `--window-size=1280,720 --force-device-scale-factor=1`; trang tự `resizeTo` để vùng vẽ đúng 1280×720 và đặt pixel ratio 1.
- Tắt vsync: `--disable-gpu-vsync --disable-frame-rate-limit` (requestAnimationFrame không bị khóa theo tần số màn hình).
- Trang đo `dt` bằng timestamp của `requestAnimationFrame`, tính số đo bằng `frameStats()` (thuần, có test P4-06) và gửi về `POST /__bench/*` của server nhúng trong `bench.js`.
- RAM: tổng working set của mọi tiến trình trình duyệt thuộc hồ sơ tạm. Trên Windows dùng **một** tiến trình PowerShell chạy suốt (khởi động trong 3 s warm-up). Lần đầu mình gọi PowerShell mới mỗi 0.5 s → chính việc đo làm giật khung hình (1% low 20.6 FPS); sau khi sửa không còn.
- Không dùng Puppeteer/Playwright để giữ "không dependency npm" và để giảng viên chạy được chỉ với Node + trình duyệt.

## Quyết định 3 — Vẽ Bóng Mực và đom đóm theo lô
Mỗi Bóng là 4 mesh (thân, viền, 2 mắt) → 200 Bóng + 100 đom đóm ≈ 1000 draw call. Đổi sang `InstancedMesh` (thân/viền/mắt, màu theo `instanceColor`) và `Points` cho quầng đom đóm → vài draw call. Số đo trên máy dev (i5-1235U, Intel UHD tích hợp):

| | avg_fps | p1_low_fps | frame_ms_p95 |
|---|---:|---:|---:|
| Trước (mesh riêng + đo RAM bằng PowerShell mỗi 0.5 s) | 60.9 | 20.6 | 35.2 |
| Sau instancing | 117.6 | 34.4 | 14.7 |
| Sau instancing + HUD chỉ ghi DOM khi đổi, bỏ `backdrop-filter` ở HUD | 138–141 (109.5 khi máy nóng) | 62–63 (46.0 khi máy nóng) | 10.7–13.5 |

Viền Bóng trước dùng độ trong suốt theo trạng thái; nay dùng độ sáng màu (instance color) — nhìn gần như nhau, không đổi luật.

## Quyết định 4 — Soak chạy với `--max-opt=1 --optimize-for-size --expose-gc`
Đo 40 Đêm liên tiếp (seed 7…46) với nhiều cấu hình V8 (`docs/notes/phase-4.md`, ai-log):

| Cờ | RSS sau tạo Đêm 1 | sau 10 Đêm | sau 35 Đêm | heapUsed |
|---|---:|---:|---:|---:|
| mặc định | 37.8 | 55.3 | 53.6 | ~5 MB, phẳng |
| `--max-semi-space-size=1` | 38.2 | 54.7 | 53.5 | phẳng |
| `--no-opt` | 38.3 | 47.1 | 43.9 | phẳng |
| `--max-opt=1 --optimize-for-size` | 37.3 | 38.8 | 39.2 | phẳng |

`heapUsed` không tăng → **không có rò rỉ dữ liệu game**. RSS mặc định dao động 44–57 MB do bộ nhớ của trình biên dịch tối ưu (Maglev/Turbofan) và vùng cấp phát chưa trả về hệ điều hành; với mức nền chỉ ~37 MB, vài MB đó đã vượt 20 %. Chạy chỉ với JIT nền (Sparkplug) cho RSS phẳng, đổi lại chậm hơn (10 Đêm ~1 s thay vì 0.5 s — vẫn rất nhanh). `soak.js` tự chạy lại chính nó với các cờ này khi được gọi `node soak.js …`, nên `soak_cmd` vẫn gọn; mọi Đêm vẫn chạy trong **một** tiến trình (tiến trình con đó).

Đã cân nhắc: chạy vài Đêm "làm nóng" trước khi đo `mem_start_mb` → sai định nghĩa của ticket ("sau khi tải xong Đêm đầu tiên"), loại.

## Quyết định 5 — Bảng xếp hạng: `serve.js` là nguồn sự thật trên đĩa
- `src/leaderboard.js` thuần (kiểm tra tên, ISO có múi giờ, sắp xếp, top 10) dùng chung cho trình duyệt và server.
- `serve.js`: `GET/POST /api/leaderboard`, ghi `data/leaderboard.json` (tuần tự, ghi file tạm rồi rename), chặn phục vụ thư mục `data/` ra web. `node serve.js --export-leaderboard out.json` đọc file đó và thoát.
- Trình duyệt mở từ server tĩnh khác → lưu `localStorage` (vẫn trên đĩa trong hồ sơ trình duyệt).
- `run_cmd` đổi thành `node serve.js` (bỏ comment `# rồi mở …` vì nó nuốt mất `--export-leaderboard` khi chạy qua shell).

## Hệ quả
- Không đổi luật/số liệu/output headless (P4-01, P4-02).
- Bench cần một trình duyệt Chromium trên máy chấm; nếu không có thì thoát mã 1 kèm hướng dẫn `--browser`.
- three.js r160 được đưa vào `vendor/` (MIT) → chạy offline, load_ms không phụ thuộc CDN.
