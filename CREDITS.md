# CREDITS

- **three.js** r160 (MIT) — tải từ unpkg CDN lúc chạy (cả addon `examples/jsm/objects/Water.js` cho mặt biển). https://threejs.org
- **Texture vật liệu** — [ambientCG](https://ambientcg.com) (CC0 1.0, phạm vi công cộng), thu nhỏ còn 512 px, chỉ giữ ảnh màu + normal map, trong `assets/textures/`:
  - `grass_*` ← Grass004 · `sand_*` ← Ground054 · `rock_*` ← Rock064 · `planks_*` ← Planks037A
  - `bark_*` ← Bark014 · `roof_*` ← RoofingTiles013A · `paper_*` ← Paper005
- **`assets/textures/waternormals.jpg`** — từ kho ví dụ của three.js (`examples/textures/waternormals.jpg`, MIT).
- **Font** — Google Fonts, SIL Open Font License 1.1, tải về `assets/fonts/` (bộ latin, latin-ext, vietnamese):
  - Be Vietnam Pro (Lâm Bảo, Tony Le, ViệtAnh Nguyễn) — chữ giao diện
  - Dancing Script (Impallari Type) — tiêu đề
- Cây dừa, đá, đèn lồng, bầu trời sao, mặt trăng: dựng bằng primitive của three.js trong code.
- Nhân vật, bối cảnh, tên gọi: bản gốc của lab Day 12.
- Code được viết với sự hỗ trợ của Claude (Anthropic); xem docs/notes/ai-log.md.
- Âm thanh: tổng hợp bằng WebAudio trong `src/audio.js` (không dùng file âm thanh ngoài).
