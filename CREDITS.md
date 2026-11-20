# CREDITS

## Thư viện
- **three.js r160** (MIT, © three.js authors) — `vendor/three/three.module.js` và addon `vendor/three/addons/objects/Water.js` (mặt biển phản chiếu), kèm `vendor/three/LICENSE`. https://threejs.org

## Hình ảnh
- **Texture vật liệu** — [ambientCG](https://ambientcg.com) (CC0 1.0, phạm vi công cộng), thu nhỏ còn 512 px, chỉ giữ ảnh màu + normal map, trong `assets/textures/`:
  - `grass_*` ← Grass004 · `sand_*` ← Ground054 · `rock_*` ← Rock064 · `planks_*` ← Planks037A
  - `bark_*` ← Bark014 · `roof_*` ← RoofingTiles013A · `paper_*` ← Paper005
- **`assets/textures/waternormals.jpg`** — từ kho ví dụ của three.js (`examples/textures/waternormals.jpg`, MIT).
- Nhân vật Mây, Bóng Mực, Gió Lạc, đèn lồng, cây dừa, đá, bầu trời sao, mặt trăng: dựng bằng hình khối của three.js trong code (không dùng mô hình ngoài).
- Ảnh chụp màn hình `docs/screenshots/`: chụp từ chính game bằng Chrome headless (Playwright).

## Font
- Google Fonts, SIL Open Font License 1.1, tải về `assets/fonts/` (bộ latin, latin-ext, vietnamese):
  - **Be Vietnam Pro** (Lâm Bảo, Tony Le, ViệtAnh Nguyễn) — chữ giao diện
  - **Dancing Script** (Impallari Type) — tiêu đề

## Âm thanh
- Toàn bộ hiệu ứng và nhạc nền được **tổng hợp bằng WebAudio** trong `src/audio.js` (không dùng file âm thanh ngoài, không dùng AI tạo âm thanh).

## Nội dung & công cụ AI
- Nhân vật, bối cảnh, tên gọi: bản gốc của lab Day 12.
- **Không có asset hình ảnh hay âm thanh nào do AI tạo.**
- Code, test và tài liệu được viết với sự hỗ trợ của **Claude (Anthropic)** — claude.ai (Phase 1–3) và Claude Code (giao diện, Phase 4), model Claude Opus; người học dẫn dắt, kiểm chứng và chịu trách nhiệm. Chi tiết, lỗi AI và token: [docs/notes/ai-log.md](docs/notes/ai-log.md).
- Công cụ kiểm thử: Node.js `node:test`, Playwright (Python) + Google Chrome cho UI smoke và ảnh chụp.
