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

## Luật & cách tính điểm (số chuẩn Ticket-02, xem `game.contract.json`)
- 3 Đêm: **Đảo Bến** (5 đèn, 5 phút) → **Đảo Cau** (2 đảo nối cầu tre, bục nhảy, 6 đèn, 5:30) → **Đảo Chuông** (3 tầng, dốc, bục, gió mạnh, 7 đèn, 6 phút). Thắng Đêm 3 → màn Bình Minh với tổng điểm.
- Mang tối đa 10 đom đóm; mỗi đèn cần 10, nạp nhiều lần được. Đèn đã sáng tạo vùng an toàn 6 m.
- Tỏa Sáng tốn 3 đom đóm: Bóng Mực trong 5 m choáng 2 s, bị đẩy lùi 4 m. Hồi 3 s. Lướt 14 m/s trong 0.2 s, hồi 1.5 s.
- Bóng Mực chạm: mất 1 Ngọn Lửa (có 3), rơi một nửa đom đóm ra đất (nhặt lại trong 8 s). Rơi khỏi đảo: mất 1 lửa + toàn bộ đom đóm, hồi sinh sau 1 s.
- Gió Lạc (Đêm 2–3) cướp 3 đom đóm khi bạn mang ≥ 5; Tỏa Sáng trúng nó lúc đang chạy trốn thì nó thả lại. Bùa Gió: 10 s chạy 7.2 m/s và lướt không hồi chiêu.
- Điểm: +10 mỗi đom đóm **nạp**, +100 mỗi đèn, +5 mỗi Bóng Mực trúng Tỏa Sáng; thắng +2 × giây còn lại + 50 × lửa còn lại. Tổng điểm = tổng các Đêm đã thắng.

## Test & headless
```bash
npm test                                   # 43 test (gọi headless.js thật)
bash scripts/proof.sh phase-2              # sinh bằng chứng vào docs/proof/phase-2
python3 scripts/ui_smoke.py                # (tùy chọn, cần playwright) kiểm thử luồng giao diện
node headless.js --seed 1 --night 2 --ticks 600 --out out.jsonl
```
Test Contract v1.1: [game.contract.json](game.contract.json) — số chuẩn của Ticket-02.

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
- Giả định & tiêu chí: [Phase 1](docs/notes/phase-1.md) · [Phase 2](docs/notes/phase-2.md)
- Bằng chứng: [Phase 1](docs/proof/phase-1/README.md) · [Phase 2](docs/proof/phase-2/README.md)
- Nhật ký AI: [docs/notes/ai-log.md](docs/notes/ai-log.md)
