#!/usr/bin/env python3
"""Kiểm thử luồng giao diện (menu → 3 đêm → Bình Minh, tạm dừng, cài đặt, thua, bảng xếp hạng, đổi phím,
phụ đề, giảm chuyển động, cỡ chữ ≥ 18 px) bằng Chrome headless.
Three.js được thay bằng bản giả (chỉ kiểm tra JS/DOM/luồng, không kiểm tra hình ảnh).
Cần: pip install playwright + Chrome. Chạy: python3 scripts/ui_smoke.py [đường_dẫn_chrome]"""
import functools, http.server, re, shutil, sys, tempfile, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

ROOT = Path(__file__).resolve().parent.parent
tmp = Path(tempfile.mkdtemp())
shutil.copytree(ROOT / 'src', tmp / 'src'); shutil.copytree(ROOT / 'assets', tmp / 'assets'); shutil.copy(ROOT / 'game.contract.json', tmp)
(tmp / 'index.html').write_text((ROOT / 'index.html').read_text(encoding='utf-8').replace(
    './vendor/three/three.module.js', '/three-stub.js').replace(
    './vendor/three/addons/', '/addons-stub/'), encoding='utf-8')
names = sorted(set(re.findall(r'THREE\.([A-Za-z0-9]+)', (ROOT / 'src/game3d.js').read_text(encoding='utf-8'))) - {'WebGLRenderer'} | {'Water'})
stub = """const H={get(t,p){if(p==='then')return undefined;if(p===Symbol.toPrimitive)return()=>0;if(!(p in t))t[p]=mk();return t[p]},apply(){return mk()},construct(){return mk()},set(t,p,v){t[p]=v;return true}};
function mk(){return new Proxy(function(){},H)}
export class WebGLRenderer{constructor(){this.domElement=document.createElement('canvas')}setPixelRatio(){}setSize(){}render(){}}
""" + ''.join(f'export const {n}=mk();\n' for n in names)
(tmp / 'three-stub.js').write_text(stub)
(tmp / 'addons-stub/objects').mkdir(parents=True); (tmp / 'addons-stub/objects/Water.js').write_text("export { Water } from '/three-stub.js';\n")
class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript'}
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(tmp)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_port}/'

results = []
def check(name, ok, info=''):
    results.append(ok); print(('PASS ' if ok else 'FAIL ') + name + (f' — {info}' if info else ''))

SMALL_TEXT = """(min)=>{const bad=[];for(const el of document.querySelectorAll('body *')){
  const st=getComputedStyle(el); if(st.display==='none'||st.visibility==='hidden') continue;
  const r=el.getBoundingClientRect(); if(!r.width||!r.height) continue;
  if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())) continue;
  if(parseFloat(st.fontSize)<min) bad.push((el.id||el.className||el.tagName)+':'+st.fontSize)} return bad}"""
def small_text(pg, mn=18): return pg.evaluate(SMALL_TEXT, mn)

def win_now(pg, idx):
    # Ticket-03: thắng ở bình minh khi đủ đèn sáng → đặt mọi đèn sáng và tua tới 1 tick trước bình minh
    pg.evaluate("""(i)=>{const g=__ddl.game;g.lanterns.forEach(l=>{l.lit=true;l.deposited=10;l.fuelU=6000;l.everLit=true});
      g.shades=[];g.drifters=[];g.timeStart=g.simTick/60+0.05}""", idx)
    pg.wait_for_timeout(600)

with sync_playwright() as p:
    exe = sys.argv[1] if len(sys.argv) > 1 else None
    b = p.chromium.launch(executable_path=exe, args=['--no-sandbox']) if exe else p.chromium.launch()
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(800)
    check('Menu chính hiện', pg.is_visible('#scrMenu'))
    bad = small_text(pg); check('Cỡ chữ ≥ 18 px: menu', not bad, str(bad[:4]))
    pg.click('#scrMenu >> text=Chọn màn'); pg.wait_for_timeout(200)
    lock = pg.eval_on_selector_all('.level', 'e=>e.map(x=>x.disabled)')
    check('Chọn màn: mới chơi đã mở cả 3 Đêm', pg.is_visible('#scrLevels') and lock == [False, False, False], str(lock))
    pg.click('#scrLevels >> text=Quay lại'); pg.wait_for_timeout(200)
    pg.click('text=Bắt đầu'); pg.wait_for_timeout(200)
    check('Giới thiệu Đêm 1', 'Đêm 1' in pg.inner_text('#introTitle') and 'Ông Đăng' in pg.inner_text('#introText'))
    pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    pg.keyboard.down('KeyW'); pg.wait_for_timeout(1000); pg.keyboard.up('KeyW')
    check('Đi được (W)', pg.evaluate('__ddl.game.player.pos[2]') > 4)
    check('HUD: đồng hồ, đèn k/n, thanh 10 ô', re.match(r'\d\d:\d\d', pg.inner_text('#hudClock')) is not None
          and '0/5' in pg.inner_text('#hudRight') and pg.eval_on_selector_all('#hudBar i', 'e=>e.length') == 10)
    bad = small_text(pg); check('Cỡ chữ ≥ 18 px: HUD khi chơi', not bad, str(bad[:4]))
    # phụ đề / chỉ báo: Bóng xuất hiện (+ mũi tên mép màn hình), đèn < 30, gió sắp thổi, 10 s cuối
    pg.evaluate("(()=>{const g=__ddl.game;g.simTick=298})()"); pg.wait_for_timeout(250)
    check('Phụ đề: Bóng Mực xuất hiện + mũi tên ở mép màn hình', 'Bóng Mực xuất hiện' in pg.inner_text('#captions')
          and pg.eval_on_selector_all('#edgeArrows .edgeArrow', 'e=>e.length') >= 1, pg.inner_text('#captions'))
    pg.evaluate("(()=>{const g=__ddl.game;const L=g.lanterns[1];L.lit=true;L.everLit=true;L.fuelU=1750})()"); pg.wait_for_timeout(250)
    check('Phụ đề: đèn có fuel < 30', 'sắp cạn dầu' in pg.inner_text('#captions'), pg.inner_text('#captions'))
    pg.evaluate("(()=>{const g=__ddl.game;g.windEnabled=true;g.simTick=1700})()"); pg.wait_for_timeout(250)
    check('Phụ đề: gió sắp thổi', 'Gió mạnh sắp thổi' in pg.inner_text('#captions'), pg.inner_text('#captions'))
    pg.evaluate("(()=>{const g=__ddl.game;g.windEnabled=false;g.shades=[];g.timeStart=g.simTick/60+9.5})()"); pg.wait_for_timeout(300)
    check('Phụ đề: 10 giây cuối', 'giây cuối' in pg.inner_text('#captions'), pg.inner_text('#captions'))
    pg.evaluate("(()=>{const g=__ddl.game;g.timeStart=240;g.lanterns[1].lit=false;g.lanterns[1].fuelU=0;g.player.pos=[0,0,0];g.player.invulnTicks=0;g.shades=[{id:'S9',pos:[0,1,0],state:'chase',ticks:0,push:0,pushDir:[1,0],expel:0,waypoint:null,target:null,drainTicks:0}]})()")
    pg.wait_for_timeout(120)
    fl = pg.evaluate("+getComputedStyle(document.getElementById('flash')).opacity")
    check('Bị đánh: chớp màn hình (mặc định bật)', fl > 0, f'opacity {fl}')
    pg.evaluate("(()=>{const g=__ddl.game;g.shades=[];g.player.flames=3;g.player.invulnTicks=0})()"); pg.wait_for_timeout(600)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    t1 = pg.evaluate('__ddl.game.simTick'); pg.wait_for_timeout(500); t2 = pg.evaluate('__ddl.game.simTick')
    check('Tạm dừng: menu hiện, logic đứng yên', pg.is_visible('#scrPause') and t1 == t2, f'sim_tick {t1}→{t2}')
    pg.click('#scrPause >> text=Cài đặt')
    pg.eval_on_selector('#setVol', "e=>{e.value=0.35;e.dispatchEvent(new Event('input'))}")
    pg.click('text=Xong')
    check('Cài đặt được lưu (localStorage)', '0.35' in (pg.evaluate("localStorage.getItem('ddl-settings')") or ''))
    pg.click('#scrPause >> text=Tiếp tục'); pg.wait_for_timeout(300)
    check('Tiếp tục chơi', not pg.is_visible('#scrPause') and pg.evaluate('__ddl.game.state') == 'playing')
    win_now(pg, 4)
    check('Thắng Đêm 1 ở bình minh → màn kết quả', pg.is_visible('#scrResult') and 'bình minh' in pg.inner_text('#resTitle'))
    pg.click('text=Đêm kế tiếp'); pg.wait_for_timeout(200)
    check('Sang Đêm 2', 'Đêm 2' in pg.inner_text('#introTitle'))
    pg.keyboard.press('Enter'); pg.wait_for_timeout(200); win_now(pg, 5)
    pg.click('text=Đêm kế tiếp'); pg.wait_for_timeout(200)
    check('Sang Đêm 3', 'Đêm 3' in pg.inner_text('#introTitle'))
    pg.keyboard.press('Enter'); pg.wait_for_timeout(200); win_now(pg, 6)
    check('Thắng Đêm 3 → Bình Minh + tổng điểm', pg.is_visible('#scrDawn') and 'Tổng điểm' in pg.inner_text('#dawnScore'), pg.inner_text('#dawnScore'))
    check('Bình Minh: có ô nhập tên', pg.is_visible('#dawnName'))
    pg.fill('#dawnName', 'Mây_đẹp'); pg.click('#dawnForm button[type=submit]'); pg.wait_for_timeout(300)
    check('Bình Minh: lưu tên tiếng Việt có dấu', 'Đã lưu' in pg.inner_text('#dawnMsg'), pg.inner_text('#dawnMsg'))
    pg.click('#scrDawn >> text=Về menu'); pg.wait_for_timeout(200)
    pg.click('#scrMenu >> text=Chọn màn'); pg.wait_for_timeout(200)
    lock = pg.eval_on_selector_all('.level', 'e=>e.map(x=>x.disabled)')
    check('Chọn màn: thắng cả 3 đêm → có điểm cao nhất', lock == [False, False, False] and 'Cao nhất' in pg.inner_text('.level[data-night="3"]'), str(lock))
    pg.click('.level[data-night="3"]'); pg.wait_for_timeout(200)
    check('Chọn Đêm 3 → giới thiệu Đêm 3', pg.is_visible('#scrIntro') and 'Đêm 3' in pg.inner_text('#introTitle'))
    pg.keyboard.press('Enter'); pg.wait_for_timeout(200); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.click('#scrPause >> text=Về menu'); pg.wait_for_timeout(200)
    pg.click('text=Bắt đầu'); pg.wait_for_timeout(200); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    pg.evaluate('(()=>{const g=__ddl.game;g.player.flames=1;g.player.pos=[39.5,0,0]})()')
    pg.keyboard.down('KeyA'); pg.wait_for_timeout(1800); pg.keyboard.up('KeyA')
    check('Thua (rơi khi còn 1 lửa) → chơi lại Đêm, không có Đêm kế', pg.is_visible('#scrResult') and not pg.is_visible('#resNext'))
    pg.fill('#resName', 'ab'); pg.click('#resForm button[type=submit]'); pg.wait_for_timeout(200)
    check('Thua: tên 2 ký tự bị từ chối', '3–12' in pg.inner_text('#resMsg'), pg.inner_text('#resMsg'))
    pg.fill('#resName', 'Thua_1'); pg.click('#resForm button[type=submit]'); pg.wait_for_timeout(300)
    check('Thua: lưu được tên hợp lệ', 'Đã lưu' in pg.inner_text('#resMsg'), pg.inner_text('#resMsg'))
    bad = small_text(pg); check('Cỡ chữ ≥ 18 px: màn kết quả', not bad, str(bad[:4]))
    pg.click('#scrResult >> text=Chơi lại Đêm'); pg.wait_for_timeout(200)
    check('Chơi lại đúng Đêm 1', 'Đêm 1' in pg.inner_text('#introTitle'))
    pg.keyboard.press('Enter'); pg.wait_for_timeout(200); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.click('#scrPause >> text=Về menu'); pg.wait_for_timeout(200); pg.click('#scrMenu >> text=Cài đặt')
    pg.check('#setCb'); pg.click('#scrSettings >> text=Xong')
    check('Chế độ mù màu được lưu và áp dụng', '"colorblind": true' in (pg.evaluate("localStorage.getItem('ddl-settings')") or '').replace('":true', '": true') and pg.evaluate("document.body.classList.contains('cb')"))
    # bảng xếp hạng: 2 mục đã lưu, sắp theo điểm, có thời điểm
    pg.click('#scrMenu >> text=Bảng xếp hạng'); pg.wait_for_timeout(300)
    rows = pg.eval_on_selector_all('#boardBody tr', 'e=>e.map(r=>[...r.cells].map(c=>c.textContent))')
    check('Bảng xếp hạng: hiện các mục đã lưu, điểm giảm dần', len(rows) == 2 and rows[0][1] == 'Mây_đẹp' and rows[1][1] == 'Thua_1'
          and int(rows[0][2]) >= int(rows[1][2]), str(rows))
    bad = small_text(pg); check('Cỡ chữ ≥ 18 px: bảng xếp hạng', not bad, str(bad[:4]))
    pg.reload(); pg.wait_for_timeout(800); pg.click('#scrMenu >> text=Bảng xếp hạng'); pg.wait_for_timeout(300)
    check('Bảng xếp hạng còn sau khi tải lại trang', pg.eval_on_selector_all('#boardBody tr', 'e=>e.length') == 2)
    pg.click('#scrBoard >> text=Quay lại'); pg.wait_for_timeout(200)
    # đổi phím: trùng → báo, gán mới → dùng được, lưu, khôi phục mặc định
    pg.click('#scrMenu >> text=Cài đặt'); pg.click('#scrSettings >> text=Đổi phím'); pg.wait_for_timeout(200)
    bad = small_text(pg); check('Cỡ chữ ≥ 18 px: đổi phím', not bad, str(bad[:4]))
    pg.click('#keyGrid button[data-action="jump"][data-slot="0"]'); pg.keyboard.press('KeyE'); pg.wait_for_timeout(150)
    check('Đổi phím: phát hiện trùng phím và báo', 'Trùng phím' in pg.inner_text('#keyMsg') and pg.evaluate('__ddl.binds.jump[0]') == 'Space', pg.inner_text('#keyMsg'))
    pg.click('#keyGrid button[data-action="jump"][data-slot="0"]'); pg.keyboard.press('KeyJ'); pg.wait_for_timeout(150)
    check('Đổi phím: gán J cho Nhảy và lưu', pg.evaluate('__ddl.binds.jump[0]') == 'KeyJ' and 'KeyJ' in (pg.evaluate("localStorage.getItem('ddl-keys')") or ''))
    pg.click('#scrKeys >> text=Quay lại cài đặt'); pg.click('#scrSettings >> text=Xong'); pg.wait_for_timeout(150)
    check('Gợi ý phím cập nhật theo phím mới', 'J nhảy' in pg.text_content('#help'), pg.text_content('#help'))
    pg.click('#scrMenu >> text=Bắt đầu'); pg.wait_for_timeout(200); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    pg.keyboard.press('KeyJ'); pg.wait_for_timeout(120)
    check('Phím mới J làm Mây nhảy', pg.evaluate('__ddl.game.player.pos[1]') > 0.05, str(pg.evaluate('__ddl.game.player.pos')))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.click('#scrPause >> text=Cài đặt'); pg.click('#scrSettings >> text=Đổi phím'); pg.click('#scrKeys >> text=Khôi phục mặc định'); pg.wait_for_timeout(100)
    check('Khôi phục phím mặc định', pg.evaluate('__ddl.binds.jump[0]') == 'Space' and 'Space' in (pg.evaluate("localStorage.getItem('ddl-keys')") or ''))
    pg.click('#scrKeys >> text=Quay lại cài đặt')
    # giảm chuyển động + chữ lớn
    pg.check('#setRm'); pg.check('#setBig'); pg.click('#scrSettings >> text=Xong'); pg.wait_for_timeout(100)
    fs = pg.evaluate("parseFloat(getComputedStyle(document.querySelector('#scrPause button')).fontSize)")
    check('Chữ lớn ×1.25 (nút 18 → 22.5 px)', abs(fs - 22.5) < 0.01, f'{fs}px')
    pg.click('#scrPause >> text=Tiếp tục'); pg.wait_for_timeout(300)
    pg.evaluate("(()=>{const g=__ddl.game;g.player.invulnTicks=0;g.shades=[{id:'S9',pos:[...g.player.pos.slice(0,1),1,g.player.pos[2]],state:'chase',ticks:0,push:0,pushDir:[1,0],expel:0,waypoint:null,target:null,drainTicks:0}]})()")
    pg.wait_for_timeout(120)
    fl = pg.evaluate("+getComputedStyle(document.getElementById('flash')).opacity")
    hit = pg.evaluate('__ddl.game.player.flames') < 3
    check('Giảm chuyển động: bị đánh không chớp màn hình', hit and fl == 0 and pg.evaluate("document.body.classList.contains('rm')"), f'flames<3={hit}, opacity {fl}')
    bad = small_text(pg, 22.5); check('Chữ lớn: mọi chữ HUD ≥ 22.5 px', not bad, str(bad[:4]))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300); pg.click('#scrPause >> text=Cài đặt')
    pg.uncheck('#setRm'); pg.uncheck('#setBig'); pg.click('#scrSettings >> text=Xong'); pg.click('#scrPause >> text=Về menu'); pg.wait_for_timeout(200)
    pg.click('#scrMenu >> text=Bắt đầu'); pg.wait_for_timeout(200); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    pg.evaluate("(()=>{const g=__ddl.game;g.successfulLights=2})()"); pg.wait_for_timeout(200)
    check('HUD sức chứa = 10 + 2×thắp (14 ô)', pg.eval_on_selector_all('#hudBar i', 'e=>e.length') == 14, pg.inner_text('#hudBar'))
    pg.evaluate("(()=>{const g=__ddl.game;const L=g.lanterns[0];L.lit=true;L.fuelU=1200;L.everLit=true;g.player.pos=[L.pos[0]+1,0,L.pos[2]];g.shades=[]})()"); pg.wait_for_timeout(200)
    check('Nhắc châm dầu ở đèn yếu', 'Châm dầu' in pg.inner_text('#hudPrompt'), pg.inner_text('#hudPrompt'))
    check('Không có lỗi JavaScript', not errs, '; '.join(errs[:3]))
    b.close()
srv.shutdown()
print(f'\n{sum(results)}/{len(results)} PASS')
sys.exit(0 if all(results) else 1)
