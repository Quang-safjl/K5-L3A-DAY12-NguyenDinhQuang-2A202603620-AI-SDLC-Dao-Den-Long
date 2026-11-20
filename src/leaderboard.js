// TICKET-04 §3: bảng xếp hạng cục bộ. Thuần (không DOM, không fs) — dùng chung cho trình duyệt và serve.js.
export const MAX_ENTRIES = 10;

// Tên 3–12 ký tự: A–Z a–z 0–9 _ ; điểm cộng: chữ tiếng Việt có dấu (chuẩn hóa NFC, đếm theo ký tự).
const VI = 'àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ';
const NAME_RE = new RegExp(`^[A-Za-z0-9_${VI}${VI.toUpperCase()}]{3,12}$`, 'u');

export function normalizeName(raw) { return String(raw ?? '').normalize('NFC').trim(); }
export function isValidName(raw) { return NAME_RE.test(normalizeName(raw)); }

// ISO 8601 có múi giờ: 2026-11-20T16:40:05+07:00 hoặc ...Z (có thể kèm mili giây)
const ISO_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
export function isIsoWithTz(s) { return typeof s === 'string' && ISO_TZ.test(s) && !Number.isNaN(Date.parse(s)); }

/** Thời điểm địa phương dạng ISO 8601 kèm độ lệch múi giờ (vd +07:00). */
export function isoLocal(d = new Date()) {
  const p = (n, w = 2) => String(Math.abs(n)).padStart(w, '0');
  const off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
    + `${off >= 0 ? '+' : '-'}${p(Math.trunc(off / 60))}:${p(off % 60)}`;
}

/** Kiểm tra + chuẩn hóa một mục. Trả {ok, entry} hoặc {ok:false, error}. */
export function makeEntry(o) {
  if (!o || typeof o !== 'object') return { ok: false, error: 'mục không hợp lệ' };
  const name = normalizeName(o.name);
  if (!isValidName(name)) return { ok: false, error: 'Tên phải dài 3–12 ký tự, chỉ gồm chữ, số hoặc _' };
  if (!Number.isInteger(o.score) || o.score < 0) return { ok: false, error: 'score phải là số nguyên ≥ 0' };
  if (!Number.isInteger(o.nights_won) || o.nights_won < 0 || o.nights_won > 3) return { ok: false, error: 'nights_won phải trong 0–3' };
  if (!isIsoWithTz(o.achieved_at)) return { ok: false, error: 'achieved_at phải là ISO 8601 có múi giờ' };
  if (!Number.isInteger(o.seed)) return { ok: false, error: 'seed phải là số nguyên' };
  return { ok: true, entry: { name, score: o.score, nights_won: o.nights_won, achieved_at: o.achieved_at, seed: o.seed } };
}

/** Điểm giảm dần; bằng điểm thì ai đạt trước (achieved_at sớm hơn) đứng trên; vẫn bằng thì giữ thứ tự cũ. */
export function sortEntries(entries) {
  return entries.map((e, i) => [e, i])
    .sort(([a, i], [b, j]) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at) || i - j)
    .map(([e]) => e);
}

/** Thêm mục (đã kiểm tra) và giữ top 10. Trả mảng mới + hạng (1-based, null nếu bị loại). */
export function insertEntry(entries, entry) {
  const all = sortEntries([...entries, entry]);
  const top = all.slice(0, MAX_ENTRIES);
  const idx = top.indexOf(entry);
  return { entries: top, rank: idx >= 0 ? idx + 1 : null };
}

/** Đọc danh sách từ dữ liệu thô (JSON); bỏ mục hỏng, sắp xếp lại, cắt top 10. */
export function parseEntries(raw) {
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const list = Array.isArray(o) ? o : Array.isArray(o?.entries) ? o.entries : [];
    return sortEntries(list.map(makeEntry).filter((r) => r.ok).map((r) => r.entry)).slice(0, MAX_ENTRIES);
  } catch { return []; }
}
