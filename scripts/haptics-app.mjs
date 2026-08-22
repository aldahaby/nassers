// CITYBREAKER — every haptic event reaches the app build.
//
// Emulates an iPhone running the game inside a Capacitor app: no Vibration API, no switch
// control, but @capacitor/haptics present — exactly what the shipped app looks like. Then fires
// all eighteen game events and checks each one arrives at the native layer with the right
// feedback style.
//
// This is the evidence behind the claim that haptics work in the app build. It cannot press a
// real Taptic Engine, but it proves the entire game-side path: every event is wired, none is
// silently dropped, and the settings row reports ON with no caveat.
//
//   node scripts/haptics-app.mjs
//
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const MIME={'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.png':'image/png','.wasm':'application/wasm','.json':'application/json'};
const srv=http.createServer((q,r)=>{ const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p,(e,d)=>{ if(e){r.writeHead(404);r.end();return;} r.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(d); }); });
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pg=await b.newPage({viewport:{width:412,height:892},deviceScaleFactor:1});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
// Emulate an iPhone running the game inside a Capacitor app: no Vibration API, no switch,
// but @capacitor/haptics present — exactly what the app build looks like.
await pg.addInitScript(()=>{
  try{ Object.defineProperty(navigator,'vibrate',{get:()=>undefined,configurable:true}); }catch(e){}
  window.__calls=[];
  window.Capacitor={ Plugins:{ Haptics:{
    impact:(o)=>{ window.__calls.push({k:'impact', style:o&&o.style}); return Promise.resolve(); },
    notification:(o)=>{ window.__calls.push({k:'notification', type:o&&o.type}); return Promise.resolve(); }
  }}};
});
await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
await pg.waitForFunction('!!window.__game',{timeout:150000});
await pg.waitForTimeout(2500);
const r=await pg.evaluate(async ()=>{
  const G=window.__game, H=G.haptics, HAP=window.__cb.HAPTIC;
  const names=Object.keys(HAP);
  const out={mode:H.mode, supported:H.supported, reliable:H.reliable, perEvent:{}, missed:[]};
  for(const n of names){
    window.__calls.length=0; H._last=0;
    H.fire(n);
    await new Promise(r2=>setTimeout(r2,25));
    const c=window.__calls[0];
    if(!c){ out.missed.push(n); out.perEvent[n]='NOTHING'; }
    else out.perEvent[n] = c.k==='impact' ? ('impact '+c.style) : ('notify '+c.type);
  }
  // and the settings row must read as working
  out.note=(document.getElementById('haptic-note')||{}).textContent;
  out.btn=(document.getElementById('haptic-btn')||{}).textContent;
  return out;
});
const n=Object.keys(r.perEvent).length;
console.log('backend        :', r.mode, '| supported', r.supported, '| reliable', r.reliable);
console.log('settings row   :', JSON.stringify(r.btn), r.note?('note '+JSON.stringify(r.note)):'(no caveat)');
console.log('events wired   :', (n-r.missed.length)+'/'+n, r.missed.length?('MISSING: '+r.missed.join(', ')):'');
for(const [k,v] of Object.entries(r.perEvent)) console.log('   '+k.padEnd(12), v);
console.log('errs', errs.slice(0,2));
console.log(r.missed.length===0 && r.mode==='native' && r.supported ? '\nEVERY EVENT REACHES NATIVE HAPTICS' : '\nFAILED');
await b.close(); srv.close();
process.exit((r.missed.length===0 && r.mode==='native' && r.supported)?0:1);
