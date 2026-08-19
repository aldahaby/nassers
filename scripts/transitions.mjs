// CITYBREAKER — panels animate out, they never snap.
//
// Records the CLASS SEQUENCE rather than sampling at fixed times: under software GL this page
// runs at ~1.5fps, so any wall-clock sample races the renderer. What matters is the order.
//
// Asserts a sheet pops out on open (sheetIn), plays a close before it leaves the layout
// (closing -> hidden, never straight to hidden), that re-opening mid-close cancels the pending
// hide, and that PLAY dissolves the menu (leaving -> hidden) before the run starts, clearing
// `leaving` afterwards so the menu can come back.
//
//   node scripts/transitions.mjs
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
await pg.addInitScript(()=>{ try{ localStorage.setItem('invrun_map','synth'); }catch(e){} });
await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
await pg.waitForFunction('!!window.__game',{timeout:150000});
await pg.waitForTimeout(3200);
await pg.evaluate(()=>{ const l=document.getElementById('loading-overlay'); if(l) l.style.display='none'; });
await pg.waitForTimeout(500);
await pg.screenshot({path:OUT+'/tr_menu.png'});

// Record the class TRANSITIONS rather than sampling at fixed times: this page runs at ~1.5fps
// under software GL, so any wall-clock sample races the renderer. The sequence is what matters.
await pg.evaluate(()=>{
  window.__seq={modal:[], ov:[]};
  const watch=(el,bucket)=>{ new MutationObserver(()=>{
      const c=el.className.replace(/\s+/g,' ').trim();
      const a=window.__seq[bucket]; if(a[a.length-1]!==c) a.push(c);
    }).observe(el,{attributes:true,attributeFilter:['class']}); };
  watch(document.getElementById('settings-modal'),'modal');
  watch(document.getElementById('start-overlay'),'ov');
  // did the entry / exit keyframes actually attach?
  window.__anims={};
  const grab=(k,sel)=>{ const e=document.querySelector(sel); if(!e) return;
    window.__anims[k]=e.getAnimations().map(a=>a.animationName).filter(Boolean); };
  window.__grab=grab;
});
const step=async(fn,ms=900)=>{ await fn(); await pg.waitForTimeout(ms); };

await step(()=>pg.tap('#settings-btn'));
const openAnims=await pg.evaluate(()=>{ window.__grab('open','#settings-modal .sheet'); return window.__anims.open; });
await pg.screenshot({path:OUT+'/tr_sheet.png'});
await step(()=>pg.tap('#settings-modal .x'), 1600);

// re-opening while it is closing must cancel the pending hide
await step(()=>pg.tap('#settings-btn'), 300);
await step(()=>pg.tap('#settings-modal .x'), 200);
await step(()=>pg.tap('#settings-btn'), 1800);
const reopenSurvives=await pg.evaluate(()=>!document.getElementById('settings-modal').classList.contains('hidden'));
await step(()=>pg.tap('#settings-modal .x'), 1600);

await step(()=>pg.tap('#start-btn'), 1200);
await pg.screenshot({path:OUT+'/tr_leaving.png'});
await pg.waitForTimeout(1500);
const stateAfterPlay=await pg.evaluate(()=>window.__game.run.state);
await pg.evaluate(()=>window.__game.run.toMenu&&window.__game.run.toMenu());
await pg.waitForTimeout(600);

const seq=await pg.evaluate(()=>window.__seq);
const j=(a)=>a.join(' -> ');
console.log('sheet  :', j(seq.modal));
console.log('overlay:', j(seq.ov));
console.log('open keyframes:', JSON.stringify(openAnims));
console.log('reopen cancels pending hide:', reopenSurvives, '| state after PLAY:', stateAfterPlay);
console.log('errs', errs.slice(0,2));

const sm=j(seq.modal), so=j(seq.ov);
const checks=[
  ['sheet pops out on open',      (openAnims||[]).includes('sheetIn')],
  ['sheet plays a close, not a snap', /modal closing -> modal hidden/.test(sm)],
  ['sheet never snaps shut',      !/modal -> modal hidden/.test(sm)],
  ['menu dissolves before the run', /leaving/.test(so) && so.indexOf('leaving')<so.indexOf('hidden')],
  ['menu never snaps away',       !/overlay menu -> overlay menu hidden/.test(so)],
  ['leaving is cleared afterwards', !/leaving/.test(seq.ov[seq.ov.length-1]||'')],
  ['reopen cancels pending hide', reopenSurvives],
  ['the run actually started',    stateAfterPlay!=='READY'],
  ['no page errors',              errs.length===0],
];
const bad=checks.filter(c=>!c[1]).map(c=>c[0]);
console.log(bad.length? '\nFAIL: '+bad.join('; ') : '\nTRANSITIONS OK');
await b.close(); srv.close();
process.exit(bad.length?1:0);
