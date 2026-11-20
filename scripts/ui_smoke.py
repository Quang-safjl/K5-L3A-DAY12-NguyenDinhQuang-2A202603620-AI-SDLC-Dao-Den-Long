#!/usr/bin/env python3
"""Kiểm thử luồng giao diện (menu → 3 đêm → Bình Minh, tạm dừng, cài đặt, thua) bằng Chrome headless.
Three.js được thay bằng bản giả (chỉ kiểm tra JS/DOM/luồng, không kiểm tra hình ảnh).
Cần: pip install playwright + Chrome. Chạy: python3 scripts/ui_smoke.py [đường_dẫn_chrome]"""
import functools, http.server, re, shutil, sys, tempfile, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
tmp = Path(tempfile.mkdtemp())
shutil.copytree(ROOT / 'src', tmp / 'src'); shutil.copytree(ROOT / 'assets', tmp / 'assets'); shutil.copy(ROOT / 'game.contract.json', tmp)
(tmp / 'index.html').write_text((ROOT / 'index.html').read_text(encoding='utf-8').replace(
    'https://unpkg.com/three@0.160.0/build/three.module.js', '/three-stub.js').replace(
    'https://unpkg.com/three@0.160.0/examples/jsm/', '/addons-stub/'), encoding='utf-8')
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
    pg.click('#scrResult >> text=Chơi lại Đêm'); pg.wait_for_timeout(200)
    check('Chơi lại đúng Đêm 1', 'Đêm 1' in pg.inner_text('#introTitle'))
    pg.keyboard.press('Enter'); pg.wait_for_timeout(200); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    pg.click('#scrPause >> text=Về menu'); pg.wait_for_timeout(200); pg.click('#scrMenu >> text=Cài đặt')
    pg.check('#setCb'); pg.click('#scrSettings >> text=Xong')
    check('Chế độ mù màu được lưu và áp dụng', '"colorblind": true' in (pg.evaluate("localStorage.getItem('ddl-settings')") or '').replace('":true', '": true') and pg.evaluate("document.body.classList.contains('cb')"))
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
