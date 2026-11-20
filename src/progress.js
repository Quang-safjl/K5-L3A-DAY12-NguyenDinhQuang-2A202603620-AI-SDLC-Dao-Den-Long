// Tiến trình chọn màn (chỉ giao diện, KHÔNG ảnh hưởng luật chơi/headless).
// Mọi Đêm đều mở sẵn (không cần thắng Đêm trước). Lưu Đêm đã thắng và điểm cao nhất mỗi Đêm.
export const NIGHT_COUNT = 3;
export const PROGRESS_KEY = 'ddl-progress';

export function emptyProgress() { return { cleared: [], best: {} }; }

// Đọc từ dữ liệu thô (chuỗi JSON hoặc null); dữ liệu hỏng → tiến trình rỗng.
export function parseProgress(raw) {
  const p = emptyProgress();
  try {
    const o = JSON.parse(raw || '{}');
    if (Array.isArray(o.cleared)) p.cleared = [...new Set(o.cleared.filter((n) => Number.isInteger(n) && n >= 1 && n <= NIGHT_COUNT))].sort((a, b) => a - b);
    if (o.best && typeof o.best === 'object') for (const [k, v] of Object.entries(o.best)) {
      const n = Number(k);
      if (Number.isInteger(n) && n >= 1 && n <= NIGHT_COUNT && Number.isFinite(v) && v >= 0) p.best[n] = Math.floor(v);
    }
  } catch { /* dữ liệu hỏng: bỏ qua */ }
  return p;
}

// Theo yêu cầu: không khóa màn — mọi Đêm hợp lệ đều chơi được ngay.
export function isUnlocked(_p, night) {
  return Number.isInteger(night) && night >= 1 && night <= NIGHT_COUNT;
}

// Trả tiến trình mới (không sửa bản cũ) sau khi thắng `night` với `score`.
export function recordWin(p, night, score) {
  const cleared = p.cleared.includes(night) ? [...p.cleared] : [...p.cleared, night].sort((a, b) => a - b);
  const best = { ...p.best, [night]: Math.max(p.best[night] ?? 0, Math.floor(score)) };
  return { cleared, best };
}
