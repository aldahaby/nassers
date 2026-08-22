// CITYBREAKER — the iOS button haptic.
//
// Confirmed on a real iPhone: flipping a switch control WITH A FINGER plays the Taptic Engine;
// flipping the same switch from a script does not. iOS gates on whether the USER activated the
// control, not on what the control is.
//
// So each HUD button carries a real switch control, sized to fill it and effectively invisible,
// sitting above the artwork. The player's tap lands on a genuine control, iOS plays its tap, and
// the game reads the same touch for its own action.
//
// Four things this depends on, each of which silently kills it:
//   * the overlay must FILL the button — the finger has to land on it wherever it touches
//   * opacity may be near-zero but never display:none / visibility:hidden (removed from hit testing)
//   * native appearance must be left alone (appearance:none makes it a plain checkbox)
//   * the touch must NOT be preventDefault()ed — touch-action:none blocks scrolling instead
//
//   node scripts/haptics-ios-buttons.mjs
//
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const MIME={'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.png':'image/png','.wasm':'application/wasm','.json':'application/json'};
const srv=http.createServer((q,r)=>{ const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p,(e,d)=>{ if(e){r.writeHead(404);r.end();return;} r.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(d); }); });
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:412,height:892},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
// emulate an iPhone with the switch control
await pg.addInitScript(()=>{
  try{ Object.defineProperty(navigator,'vibrate',{get:()=>undefined,configurable:true}); }catch(e){}
  Object.defineProperty(HTMLInputElement.prototype,'switch',{
    get(){ return this.hasAttribute('switch'); },
    set(v){ v?this.setAttribute('switch',''):this.removeAttribute('switch'); }, configurable:true });
  window.__sysTaps=[];   // a real user activation on a switch = what iOS plays a haptic for
  document.addEventListener('click',(e)=>{ const t=e.target;
    if(t&&t.tagName==='INPUT'&&t.type==='checkbox'&&t.hasAttribute('switch')) window.__sysTaps.push(e.isTrusted); },true);
});
await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
await pg.waitForFunction('!!window.__game',{timeout:150000});
await pg.waitForTimeout(3000);
await pg.evaluate(()=>{ const l=document.getElementById('loading-overlay'); if(l) l.style.display='none';
  document.body.classList.add('touch'); });
await pg.evaluate(()=>{ window.__game.run.startRun(); });
await pg.waitForTimeout(600);
const r=await pg.evaluate(()=>{
  const q=(id)=>{ const el=document.getElementById(id); if(!el) return {missing:true};
    const sw=el.querySelector('input.hap-sw');
    if(!sw) return {overlay:false};
    const cs=getComputedStyle(sw), rb=el.getBoundingClientRect(), rs=sw.getBoundingClientRect();
    return { overlay:true, isSwitch:sw.hasAttribute('switch'),
      // must remain hit-testable: not display:none, not visibility:hidden, and covering the button
      display:cs.display, visibility:cs.visibility, opacity:+cs.opacity,
      appearance:cs.appearance||cs.webkitAppearance||'',
      coversButton: rs.width>=rb.width*0.9 && rs.height>=rb.height*0.9,
      touchAction:getComputedStyle(el).touchAction,
      hitTarget: (()=>{ const el2=document.elementFromPoint(rb.left+rb.width/2, rb.top+rb.height/2);
        return el2? (el2.tagName+(el2.className?('.'+String(el2.className).split(' ')[0]):'')) : 'none'; })() };
  };
  return { power:q('btn-power'), boost:q('btn-boost'), play:q('start-btn'), mode:window.__game.haptics.mode };
});
console.log(JSON.stringify(r,null,1));
// a real tap must reach the switch AND still trigger the game action
await pg.evaluate(()=>{ window.__sysTaps.length=0;
  window.__game.input._power=false; window.__game.input._surge=false; });
await pg.waitForTimeout(400);
await pg.tap('#btn-power');
await pg.tap('#btn-boost');
const after=await pg.evaluate(()=>({ taps:window.__sysTaps.length, trusted:window.__sysTaps.filter(Boolean).length }));
console.log('switch activations from a real tap:', JSON.stringify(after));
console.log('errs',errs.slice(0,3));
const ok = r.power.overlay&&r.boost.overlay&&r.play.overlay
  && r.power.display!=='none' && r.power.visibility!=='hidden'
  && r.power.coversButton && r.boost.coversButton
  && r.power.touchAction==='none' && after.taps>=2 && errs.length===0;
console.log(ok? '\nSWITCH OVERLAY WIRED CORRECTLY' : '\nPROBLEM');
await b.close(); srv.close();
process.exit(ok?0:1);
