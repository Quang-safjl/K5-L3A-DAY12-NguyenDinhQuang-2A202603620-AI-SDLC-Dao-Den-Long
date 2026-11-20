// Test phần giao diện bổ sung (ngoài ticket): chọn màn + asset đồ họa.
// Mã UI-xx ghi trong docs/proof/phase-3/README.md (mục "Ngoài ticket").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { emptyProgress, parseProgress, isUnlocked, recordWin } from '../src/progress.js';

const root = new URL('../', import.meta.url);

test('UI-01 chọn màn: cả 3 Đêm mở sẵn, không cần qua màn trước; Đêm ngoài 1..3 không hợp lệ', () => {
  // Đổi yêu cầu: trước đây thắng Đêm n mới mở Đêm n+1; nay người dùng muốn mở hết từ đầu.
  let p = emptyProgress();
  assert.deepEqual([1, 2, 3].map((n) => isUnlocked(p, n)), [true, true, true]);
  p = recordWin(p, 3, 420);
  assert.deepEqual([1, 2, 3].map((n) => isUnlocked(p, n)), [true, true, true]);
  assert.equal(isUnlocked(p, 0), false);
  assert.equal(isUnlocked(p, 4), false);
});

test('UI-02 điểm cao nhất mỗi Đêm chỉ tăng; recordWin không sửa bản cũ', () => {
  const p0 = emptyProgress();
  const p1 = recordWin(p0, 1, 500);
  const p2 = recordWin(p1, 1, 200);
  assert.deepEqual(p0, emptyProgress());
  assert.equal(p1.best[1], 500);
  assert.equal(p2.best[1], 500);
  assert.deepEqual(p2.cleared, [1]);
});

test('UI-03 đọc tiến trình: lưu rồi đọc lại giữ nguyên; dữ liệu hỏng/lạ → rỗng hoặc bị lọc', () => {
  const p = recordWin(recordWin(emptyProgress(), 2, 99.7), 1, 10);
  assert.deepEqual(parseProgress(JSON.stringify(p)), { cleared: [1, 2], best: { 1: 10, 2: 99 } });
  assert.deepEqual(parseProgress(null), emptyProgress());
  assert.deepEqual(parseProgress('{không phải json'), emptyProgress());
  assert.deepEqual(parseProgress('{"cleared":[1,1,7,"2"],"best":{"1":-5,"3":40,"9":1}}'), { cleared: [1], best: { 3: 40 } });
});

test('UI-04 asset đồ họa có trong repo và được ghi nguồn; sim.js không import phần hiển thị', () => {
  const src = readFileSync(new URL('src/game3d.js', root), 'utf8');
  const used = [...src.matchAll(/assets\/textures\/([\w-]+\.jpg)/g)].map((m) => m[1]);
  assert.ok(used.length >= 8, 'game3d.js dùng texture trong assets/');
  for (const f of used) assert.ok(existsSync(new URL(`assets/textures/${f}`, root)), f);
  assert.ok(existsSync(new URL('assets/fonts/fonts.css', root)));
  const credits = readFileSync(new URL('CREDITS.md', root), 'utf8');
  for (const s of ['ambientCG', 'Google Fonts', 'waternormals']) assert.ok(credits.includes(s), s);
  const sim = readFileSync(new URL('src/sim.js', root), 'utf8');
  assert.ok(!/progress\.js|game3d|assets\//.test(sim));
});
