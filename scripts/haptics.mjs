// CITYBREAKER — haptics, on all three kinds of device.
//
// Runs the game three times with a different platform emulated each time:
//
//   wkwebview  a native iOS shell published window.webkit.messageHandlers.cbHaptic
//   capacitor  a native shell published window.CBHaptics.play
//   androidapp a native Android shell published window.CBAndroid.haptic
//   android    navigator.vibrate present            -> real patterns, real durations
//   iphone     NO navigator.vibrate, but the iOS 17.4+ switch control exists -> best effort only
//   bare       neither                              -> silent, and the UI says so honestly
//
// iOS is the case worth explaining. An iPhone obviously has a Taptic Engine, but Safari has
// never shipped the Vibration API on any iOS version, and Add to Home Screen does not change
// that — it is the same WebKit under the same rules. The switch-control tap is the only hook a
// web page has, and iOS only plays it for a genuine finger-on-glass activation, so in-game
// events almost never fire it. On iOS the app build is what makes haptics real, which is why
// the `native` bridge exists and why `reliable` is false for the Safari path.
//
//   node scripts/haptics.mjs
//
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const MIME={'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.png':'image/png','.wasm':'application/wasm','.json':'application/json'};
const srv=http.createServer((q,r)=>{ const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p,(e,d)=>{ if(e){r.writeHead(404);r.end();return;} r.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(d); }); });
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});

// ---- CASE 1: Android-like. navigator.vibrate present. ----
// ---- CASE 2: iPhone-like. NO navigator.vibrate, but the iOS 17.4+ switch control exists. ----
let bad=0;
for(const CASE of ['wkwebview','capacitor','androidapp','android','iphone','bare']){
  const pg=await b.newPage({viewport:{width:412,height:892},deviceScaleFactor:1});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript((CASE)=>{
    window.__vib=[]; window.__taps=[]; window.__nat=[];
    if(CASE==='wkwebview'){
      window.webkit={messageHandlers:{cbHaptic:{postMessage:(m)=>window.__nat.push(m)}}};
    }
    if(CASE==='capacitor'){ window.CBHaptics={play:(n,p)=>window.__nat.push({name:n,pattern:p})}; }
    if(CASE==='androidapp'){ window.CBAndroid={haptic:(j)=>window.__nat.push(JSON.parse(j))}; }
    if(CASE==='android'){ navigator.vibrate=(p)=>{ window.__vib.push(p); return true; }; }
    else {
      try{ delete Navigator.prototype.vibrate; }catch(e){}
      try{ Object.defineProperty(navigator,'vibrate',{get:()=>undefined,configurable:true}); }catch(e){}
    }
    if(CASE==='iphone'){
      // Safari 17.4+ exposes a `switch` IDL attribute on checkbox inputs; emulate it and record
      // every activation, which is what plays the system haptic on a real iPhone.
      Object.defineProperty(HTMLInputElement.prototype,'switch',{
        get(){ return this.hasAttribute('switch'); },
        set(v){ v? this.setAttribute('switch','') : this.removeAttribute('switch'); },
        configurable:true });
      document.addEventListener('click',(e)=>{
        const t=e.target;
        if(t && t.tagName==='INPUT' && t.type==='checkbox' && t.hasAttribute('switch'))
          window.__taps.push(performance.now());
      },true);
    }
  },CASE);
  await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
  await pg.waitForFunction('!!window.__game',{timeout:150000});
  await pg.waitForTimeout(2500);
  const r=await pg.evaluate(async ()=>{
    const G=window.__game, H=G.haptics;
    const out={mode:H.mode, supported:H.supported, enabled:H.enabled};
    out.switchInDom = !!(H._sw && H._sw.isConnected);
    const wait=(ms)=>new Promise(r2=>setTimeout(r2,ms));
    // fire a light event and a heavy one, count what each produced
    const count=async(name)=>{
      window.__vib.length=0; window.__taps.length=0; window.__nat.length=0; H._last=0; H.stop();
      H.fire(name); await wait(600);
      return {vib:window.__vib.length, taps:window.__taps.length, nat:window.__nat.length};
    };
    out.shard = await count('shard');
    out.death = await count('death');
    out.gateBlock = await count('gateBlock');
    // OFF must be absolute on every backend
    H.set(false); window.__vib.length=0; window.__taps.length=0; H._last=0;
    window.__nat.length=0;
    H.fire('death'); H.fire('gateBlock'); await wait(500);
    out.silentWhenOff = window.__vib.length + window.__taps.length + window.__nat.length;
    out.reliable = H.reliable;
    // the bridge must receive the EVENT NAME, so a shell can map it to a real feedback style
    out.sampleNativeMsg = null;
    { H.set(true); window.__nat.length=0; H._last=0; H.fire('gateBlock'); await wait(50);
      out.sampleNativeMsg = window.__nat[0]||null; }
    H.set(true);
    // the settings row must not accuse the device
    const note=document.getElementById('haptic-note'), btn=document.getElementById('haptic-btn');
    out.note = note? note.textContent : null;
    out.btn = btn? btn.textContent : null;
    return out;
  });
  const want = { wkwebview:{mode:'native', fires:true, reliable:true},
                 capacitor:{mode:'native', fires:true, reliable:true},
                 androidapp:{mode:'native', fires:true, reliable:true},
                 android:{mode:'vibrate', fires:true, reliable:true},
                 iphone:{mode:'ios', fires:false, reliable:false},
                 bare:{mode:'none', fires:false, reliable:false} }[CASE];
  const hits = (x)=> x.vib>0 || x.taps>0 || x.nat>0;
  const checks=[
    ['backend chosen',        r.mode===want.mode],
    ['light event fires',     hits(r.shard)===want.fires],
    ['heavy event fires',     hits(r.death)===want.fires],
    ['heavy > light',         !want.fires || (r.death.vib+r.death.taps) >= (r.shard.vib+r.shard.taps)],
    ['OFF is absolute',       r.silentWhenOff===0],
    ['reliability reported honestly', r.reliable===want.reliable],
    ['UI does not blame the device',  !/device/i.test(r.note||'')],
    ['iOS Safari is not sold as working', CASE!=='iphone' || /app version only/i.test(r.note||'')],
    ['iOS Safari toggle is disabled',     CASE!=='iphone' || r.btn==='\u2014'],
    ['a working backend shows no caveat', want.reliable!==true || (r.note||'')===''],
    ['no page errors',        errs.length===0],
  ];
  const failed=checks.filter(c=>!c[1]).map(c=>c[0]);
  if(failed.length) bad++;
  console.log(CASE.padEnd(8), failed.length?('FAIL  '+failed.join('; ')):'ok    ',
              JSON.stringify(r), errs.slice(0,2).join('|'));
  await pg.close();
}
await b.close(); srv.close();
console.log('\n'+(bad? bad+' CASE(S) FAILED':'ALL HAPTIC BACKENDS PASS'));
process.exit(bad?1:0);
