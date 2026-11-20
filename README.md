# Đảo Đèn Lồng — Day 12 AI SDLC

> 🎬 **Video demo:** _(sẽ cập nhật ở Phase 4)_
> Nguyễn Đình Quang · 2A202603620 · K5-L3A
> Đề bài gốc của lab: [docs/lab/](docs/lab/README.md)

Game 3D góc nhìn thứ ba: Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại 5 Đèn Lồng Lớn và né Bóng Mực trong sương đen.

## Cài đặt và chạy (Node >= 18, Python 3, trình duyệt có Internet để tải Three.js)
```bash
git clone <repo> && cd <repo>
python3 -m http.server 8000      # rồi mở http://localhost:8000
```
Không cần `npm install` (không có dependency).

## Điều khiển
| Phím | Hành động |
|---|---|
| W A S D / ↑ ↓ | Đi (theo hướng camera) |
| Kéo chuột / ← → | Xoay camera |
| Space | Nhảy |
| E | Nạp đom đóm vào đèn gần nhất |
| F | Tỏa sáng (xua Bóng Mực) |
| R | Chơi lại |

## Luật & cách tính điểm (số lấy từ `game.contract.json`)
- Nhặt đom đóm (mang tối đa 10). Đứng gần đèn (≤ 2.5 m) bấm **E** để nạp; mỗi đèn cần **5** đom đóm.
- Tỏa sáng tốn **2** đom đóm: Bóng Mực trong 6 m bị choáng 3 s và bị đẩy lùi 4 m. Hồi chiêu 1 s.
- Bóng Mực chạm vào: mất 1 ngọn lửa (có 3), rơi một nửa số đom đóm đang mang, bất tử 1.5 s.
- Bóng Mực không vào được vòng 5 m quanh đèn **đã thắp**.
- Thắng: thắp cả 5 đèn. Thua: hết lửa, hoặc hết 5 phút (trời sáng).
- Điểm: +10 mỗi đom đóm, +100 mỗi đèn, +20 mỗi Bóng Mực bị choáng; khi thắng +1 mỗi giây còn lại và +50 mỗi ngọn lửa còn lại.

## Test & headless
```bash
npm test                                   # 20 test (gọi headless.js thật)
bash scripts/proof.sh phase-1              # sinh bằng chứng vào docs/proof/phase-1
node headless.js --seed 1 --night 1 --scenario scenarios/example.scenario.json \
  --inputs scenarios/example.inputs.json --ticks 300 --out out.jsonl
```
Test Contract: [game.contract.json](game.contract.json). Tuning không có khái niệm `null`; `fall_enabled: false` vì đảo có rìa chặn, nhân vật không rơi được.

## Cấu trúc
```
src/sim.js        luật chơi thuần, tất định (dùng chung cho game và headless)
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
- Chỉ ở phần hiển thị, không đổi output headless (test vẫn xanh).

## Tài liệu
- Giả định & tiêu chí: [docs/notes/phase-1.md](docs/notes/phase-1.md)
- Bằng chứng: [docs/proof/phase-1/](docs/proof/phase-1/README.md)
- Nhật ký AI: [docs/notes/ai-log.md](docs/notes/ai-log.md)
