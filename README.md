# Đảo Đèn Lồng — Day 12 AI SDLC

> 🎬 **Video demo:** _(sẽ cập nhật ở Phase 4)_
> Nguyễn Đình Quang · 2A202603620 · K5-L3A
> Đề bài gốc của lab: [docs/lab/](docs/lab/README.md)

Game 3D góc nhìn thứ ba: Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại 5 Đèn Lồng Lớn và né Bóng Mực trong sương đen.

## Cài đặt và chạy (Node >= 18, trình duyệt có Internet để tải Three.js)
```bash
git clone <repo> && cd <repo>
node serve.js                    # rồi mở http://localhost:8000
```
Không cần `npm install` (không có dependency).

## Điều khiển
| Phím | Hành động |
|---|---|
| W A S D / ↑ ↓ | Đi (theo hướng camera) |
| Kéo chuột / ← → | Xoay camera |
| Space | Nhảy |
| Shift | Lướt |
| E | Nạp đom đóm vào đèn gần nhất |
| F | Tỏa sáng (xua Bóng Mực, Gió Lạc) |
| Esc / P | Tạm dừng (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu) |

**Chọn màn:** menu → *Chọn màn* để chơi thẳng bất kỳ Đêm nào (mở sẵn cả 3, có lưu điểm cao nhất). Máy yếu có thể tắt *Đồ họa cao* trong Cài đặt. Nguồn asset: [CREDITS.md](CREDITS.md).

## Luật & cách tính điểm (Ticket-03, xem `game.contract.json` v1.2)
- 3 Đêm: **Đảo Bến** (5 đèn, 4 phút) → **Đảo Cau** (2 đảo, cầu tre, bục nhảy, 6 đèn, 4:30) → **Đảo Chuông** (3 tầng, gió mạnh, 7 đèn, 5 phút).
- **Mục tiêu: giữ đảo sáng tới bình minh.** Hết giờ mà còn sống và ≥ 60% đèn đang sáng (3/5, 4/6, 5/7) thì thắng; thắp đủ đèn không kết thúc sớm.
- Đèn sáng có **dầu 100**, hao 1/giây. Đứng cạnh đèn bấm **E** để thắp (10 đom đóm; đèn từng sáng chỉ cần 5) hoặc **châm dầu** (mỗi đom đóm +10). Dầu dưới 30: đèn nhấp nháy và **mất vùng an toàn**, Bóng Mực tới hút dầu (5/giây).
- Sức chứa đom đóm: 10 + 2 cho mỗi lần thắp thành công (tối đa 20).
- Tỏa Sáng (F, tốn 3): choáng Bóng Mực trong 5 m. Lướt (Shift). Gió Lạc cướp đom đóm, Bùa Gió tăng tốc.
- Điểm: +5 mỗi đom đóm nạp, +100 thắp lần đầu, +40 thắp lại, +5 mỗi Bóng trúng Tỏa Sáng (+15 nếu nó đang hút dầu); thắng: mỗi đèn sáng +50 + dầu còn lại, mỗi Ngọn Lửa +50.
- Cài đặt có **Bảng màu dễ phân biệt** cho người mù màu.

## Test & headless
```bash
npm test                                   # 58 test (gọi headless.js thật)
bash scripts/proof.sh phase-3              # sinh bằng chứng vào docs/proof/phase-3
python3 scripts/ui_smoke.py                # (tùy chọn, cần playwright) kiểm thử luồng giao diện
node headless.js --seed 1 --night 2 --ticks 600 --out out.jsonl
```
Test Contract v1.2: [game.contract.json](game.contract.json). Thay đổi phá tương thích: [CHANGELOG.md](CHANGELOG.md) · Quyết định thiết kế: [docs/adr/](docs/adr/0001-lantern-fuel-and-dawn-win.md)

## Cấu trúc
```
src/sim.js        luật chơi thuần, tất định (dùng chung cho game và headless)
src/maps.js       bản đồ chuẩn 3 đêm
src/audio.js      âm thanh tổng hợp WebAudio
src/game3d.js     hiển thị Three.js + điều khiển
headless.js       CLI theo Test Contract
tests/            test node:test
scenarios/        scenario + inputs mẫu, inputs bot tự chơi
scripts/          proof.sh, autoplay.js (bot), hooks/
docs/notes/       giả định từng phase, nhật ký AI, retro
docs/proof/       bằng chứng từng phase
AGENTS.md, CLAUDE.md, .claude/   harness AI
```

## Sáng tạo của tôi
- Đảo **sáng dần**: ánh sáng môi trường và màu sương chuyển từ tím đen sang ấm hơn theo số đèn đã thắp.
- Đèn lồng nhỏ trên nón của Mây **sáng hơn** khi mang nhiều đom đóm; vòng sáng 5 m hiện quanh đèn đã thắp để người chơi biết chỗ trú.
- Lời dẫn của **Ông Đăng** khác nhau cho mỗi Đêm; Gió mạnh Đêm 3 có lá bay báo trước.
- Bộ đếm FPS góc dưới trái để tự kiểm yêu cầu ≥ 30 FPS.
- Chỉ ở phần hiển thị, không đổi output headless (test vẫn xanh).

## Tài liệu
- Giả định & tiêu chí: [Phase 1](docs/notes/phase-1.md) · [Phase 2](docs/notes/phase-2.md) · [Phase 3](docs/notes/phase-3.md)
- Bằng chứng: [Phase 1](docs/proof/phase-1/README.md) · [Phase 2](docs/proof/phase-2/README.md) · [Phase 3](docs/proof/phase-3/README.md)
- Nhật ký AI: [docs/notes/ai-log.md](docs/notes/ai-log.md)
