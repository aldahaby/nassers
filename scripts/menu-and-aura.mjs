// CITYBREAKER — the ✕ closes, the backdrop is clean, and the screen wears the villain's colour.
//
// Three regressions this guards, all found in play:
//
//  1. THE ✕ DID NOTHING. Each ✕ carries an invisible switch control for the iOS haptic, so a tap's
//     target is that INPUT, not the button — and the dismiss handler tested e.target directly.
//     Only tapping outside the sheet worked. It now uses closest('[data-close]'). Emulated on the
//     iOS path on purpose, because that is the only place the switch exists.
//
//  2. THE BACKGROUND SOMETIMES CAME UP WRONG. Two causes, both removed: a backdrop-filter blur
//     over a live WebGL canvas (expensive, and flaky on iOS), and a second frozen-JPEG background
//     layer that could hold a stale or black frame.
//
//  3. THE SCREEN GLOW WAS ALWAYS GOLD/PURPLE. Every state colour now comes from the equipped
//     villain's own aura, so Voidstrike's violet no longer sits inside an orange screen.
//     This also caught a duplicate id="vignette" — the glow had been painted on the static LOOK
//     vignette rather than its own layer.
//
//   node scripts/menu-and-aura.mjs
//
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'), OUT='/tmp/claude-0/-home-user-nassers/b3bc857b-beed-5faf-b80d-53827eff6ffa/scratchpad';
const MIME={'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.png':'image/png','.wasm':'application/wasm','.json':'application/json'};
const srv=http.createServer((q,r)=>{ const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p,(e,d)=>{ if(e){r.writeHead(404);r.end();return;} r.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(d); }); });
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:412,height:892},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
// emulate the iPhone path, because that is where the ✕ carries the haptic switch that broke it
await pg.addInitScript(()=>{
  try{ Object.defineProperty(navigator,'vibrate',{get:()=>undefined,configurable:true}); }catch(e){}
  Object.defineProperty(HTMLInputElement.prototype,'switch',{
    get(){ return this.hasAttribute('switch'); },
    set(v){ v?this.setAttribute('switch',''):this.removeAttribute('switch'); }, configurable:true });
  try{ localStorage.setItem('invrun_map','synth'); localStorage.setItem('invrun_char','countess'); }catch(e){}
});
await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
await pg.waitForFunction('!!window.__game',{timeout:150000});
await pg.waitForTimeout(3200);
await pg.evaluate(()=>{ const l=document.getElementById('loading-overlay'); if(l) l.style.display='none'; });
await pg.waitForTimeout(600);
const out={};
out.iosMode = await pg.evaluate(()=>window.__game.haptics.mode);

// ---- 1 · the ✕ must close every sheet ----
const sheets=[['settings-btn','settings-modal'],['skins-btn','skins-modal'],
              ['powers-btn','powers-modal'],['maps-btn','maps-modal'],
              ['missions-btn','missions-modal'],['ranks-btn','ranks-modal']];
out.xCloses={};
for(const [btn,modal] of sheets){
  const has=await pg.evaluate(id=>!!document.getElementById(id),modal);
  if(!has){ out.xCloses[modal]='(no such sheet)'; continue; }
  await pg.tap('#'+btn); await pg.waitForTimeout(900);
  const opened=await pg.evaluate(id=>!document.getElementById(id).classList.contains('hidden'),modal);
  // tap the ✕ itself — and specifically its CENTRE, where the haptic switch overlay sits
  await pg.tap(`#${modal} .x`); await pg.waitForTimeout(1700);
  const closed=await pg.evaluate(id=>document.getElementById(id).classList.contains('hidden'),modal);
  out.xCloses[modal]= opened&&closed ? 'ok' : ('opened='+opened+' closed='+closed);
  if(!closed) await pg.evaluate(id=>document.getElementById(id).classList.add('hidden'),modal);
}
// the switch overlay really is inside the ✕ (i.e. we are testing the broken case)
out.switchInsideX = await pg.evaluate(()=>{
  const m=document.getElementById('settings-modal'); m.classList.remove('hidden');
  document.getElementById('settings-btn').click();
  return !!m.querySelector('.x input.hap-sw'); });
await pg.evaluate(()=>document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden')));

// ---- 2 · the background: no backdrop-filter, no stale snapshot layer ----
out.bg = await pg.evaluate(()=>{
  const ov=document.getElementById('start-overlay'), cs=getComputedStyle(ov);
  const mb=document.getElementById('menu-bg');
  return { backdrop:(cs.backdropFilter||cs.webkitBackdropFilter||'none'),
           menuBgDisplay:getComputedStyle(mb).display,
           snapIsNoop: window.__game.snapMenuBg.toString().includes('return;') };
});

// ---- 3 · aura drives the screen, per villain ----
out.aura={};
for(const ch of ['dominus','knight','countess','frutiger','patriot','entity']){
  const r=await pg.evaluate(async (c)=>{
    const G=window.__game;
    G.player.setCharacter(c);
    const rs=getComputedStyle(document.documentElement);
    const epic=rs.getPropertyValue('--aura-epic').trim(), eth=rs.getPropertyValue('--aura-eth').trim();
    // and the vignette must actually paint with it.
    // The rAF loop rewrites the glow every frame, so hold the combo state and read AFTER a real
    // frame. Do NOT wait a fixed number of milliseconds for it: under software GL one frame with a
    // 100k-vertex villain on screen can outlast any wall-clock guess, and the read then lands on
    // the transparent default. Poll until the glow has actually changed instead.
    const glow=()=>getComputedStyle(document.getElementById('state-glow')).boxShadow;
    const painted=v=>/rgba?\(/.test(v) && !/, 0\)/.test(v);
    const settle=async(prev)=>{ let v=glow();
      for(let i=0;i<200 && !(painted(v) && v!==prev); i++){
        await new Promise(r=>setTimeout(r,100)); v=glow(); }
      return v; };
    G.run.startRun(); G.combo.count=40; G.combo.epicTime=99; G.combo.etherealTime=99;
    const vigEth=await settle(null);
    G.combo.etherealTime=0;
    const vigEpic=await settle(vigEth);
    G.combo.count=0; G.combo.epicTime=0;
    const cfg=window.__cb.CHARACTERS[c].aura;
    return { epic, eth, cfgEpic:'#'+cfg.epic.toString(16).padStart(6,'0'),
             cfgEth:'#'+cfg.eth.toString(16).padStart(6,'0'),
             // must be a real, non-transparent colour — the old default was rgba(...,0)
             vigEthHasColour:  !/, 0\)/.test(vigEth)  && /rgba?\(/.test(vigEth),
             vigEpicHasColour: !/, 0\)/.test(vigEpic) && /rgba?\(/.test(vigEpic),
             vigEth:vigEth.slice(0,34), vigEpic:vigEpic.slice(0,34) };
  }, ch);
  out.aura[ch]=r;
}
console.log(JSON.stringify(out,null,1));
console.log('errs',errs.slice(0,3));
const xOk=Object.values(out.xCloses).every(v=>v==='ok'||v==='(no such sheet)');
const auraOk=Object.values(out.aura).every(a=>a.vigEthHasColour&&a.vigEpicHasColour&&a.vigEth!==a.vigEpic);
// the six villains must not all end up with the same screen colour
const distinct=new Set(Object.values(out.aura).map(a=>a.epic+'/'+a.eth)).size;
const ok = xOk && out.switchInsideX && out.bg.backdrop==='none'
  && out.bg.menuBgDisplay==='none' && out.bg.snapIsNoop && auraOk && distinct>=4 && errs.length===0;
console.log('distinct aura pairs:', distinct);
console.log(ok? '\nALL THREE FIXED' : '\nPROBLEM');
await b.close(); srv.close();
process.exit(ok?0:1);
