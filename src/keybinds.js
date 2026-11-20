// TICKET-04 §4: đổi phím. Mỗi hành động có 2 ô phím (chính, phụ; phụ có thể trống). Thuần → test được.
export const ACTIONS = [
  ['up', 'Đi lên'], ['down', 'Đi xuống'], ['left', 'Sang trái'], ['right', 'Sang phải'],
  ['jump', 'Nhảy'], ['dash', 'Lướt'], ['interact', 'Tương tác (nạp/châm)'], ['pulse', 'Tỏa sáng'], ['pause', 'Tạm dừng'],
  ['camLeft', 'Xoay camera trái'], ['camRight', 'Xoay camera phải'],
];
export const ACTION_IDS = ACTIONS.map(([id]) => id);
export const actionLabel = (id) => (ACTIONS.find(([a]) => a === id) || [, id])[1];

export const DEFAULT_BINDS = Object.freeze({
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', null], right: ['KeyD', null],
  jump: ['Space', null], dash: ['ShiftLeft', 'ShiftRight'], interact: ['KeyE', null], pulse: ['KeyF', null],
  pause: ['Escape', 'KeyP'], camLeft: ['ArrowLeft', null], camRight: ['ArrowRight', null],
});
// Phím dành riêng cho menu, không được gán cho hành động
export const RESERVED = ['Enter', 'Tab'];

export const cloneBinds = (b) => Object.fromEntries(ACTION_IDS.map((a) => [a, [...b[a]]]));
export const defaultBinds = () => cloneBinds(DEFAULT_BINDS);

/** Hành động (và ô) đang dùng phím `code`, bỏ qua ô `except` = [action, slot]. */
export function findOwner(binds, code, except = null) {
  for (const a of ACTION_IDS) for (let s = 0; s < 2; s++) {
    if (except && except[0] === a && except[1] === s) continue;
    if (binds[a][s] === code) return { action: a, slot: s };
  }
  return null;
}

/**
 * Gán phím `code` cho ô [action, slot]. Không cho trùng: trả {ok:false, conflict} và giữ nguyên.
 * code = null để xóa ô phụ (ô chính không được để trống).
 */
export function assignKey(binds, action, slot, code) {
  if (!ACTION_IDS.includes(action) || (slot !== 0 && slot !== 1)) return { ok: false, error: 'ô không hợp lệ', binds };
  if (code === null) {
    if (slot === 0) return { ok: false, error: 'Phím chính không được để trống', binds };
    const nb = cloneBinds(binds); nb[action][1] = null; return { ok: true, binds: nb };
  }
  if (typeof code !== 'string' || !code) return { ok: false, error: 'phím không hợp lệ', binds };
  if (RESERVED.includes(code)) return { ok: false, error: `${keyLabel(code)} dành cho menu`, binds };
  const owner = findOwner(binds, code, [action, slot]);
  if (owner) return { ok: false, conflict: owner, error: `${keyLabel(code)} đang dùng cho "${actionLabel(owner.action)}"`, binds };
  const nb = cloneBinds(binds); nb[action][slot] = code; return { ok: true, binds: nb };
}

/** Danh sách các phím bị trùng (dùng khi đọc cấu hình lưu từ trước). */
export function findDuplicates(binds) {
  const seen = new Map(), dup = new Set();
  for (const a of ACTION_IDS) for (const c of binds[a]) if (c) { if (seen.has(c)) dup.add(c); else seen.set(c, a); }
  return [...dup];
}

/** Đọc từ localStorage: thiếu/hỏng/trùng → mặc định. */
export function parseBinds(raw) {
  try {
    const o = JSON.parse(raw || 'null');
    if (!o || typeof o !== 'object') return defaultBinds();
    const b = defaultBinds();
    for (const a of ACTION_IDS) {
      const v = o[a];
      if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'string' && v[0] && (v[1] === null || typeof v[1] === 'string')) b[a] = [v[0], v[1] || null];
    }
    return findDuplicates(b).length ? defaultBinds() : b;
  } catch { return defaultBinds(); }
}

/** Hành động mà phím `code` điều khiển (hoặc null). */
export function actionOf(binds, code) { const o = findOwner(binds, code); return o ? o.action : null; }

const NAMED = { Space: 'Space', Escape: 'Esc', ShiftLeft: 'Shift', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl', ControlRight: 'Ctrl phải',
  AltLeft: 'Alt', AltRight: 'Alt phải', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backspace: 'Backspace', Enter: 'Enter', Tab: 'Tab' };
export function keyLabel(code) {
  if (!code) return '—';
  if (NAMED[code]) return NAMED[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return 'Num ' + code.slice(6);
  return code;
}
