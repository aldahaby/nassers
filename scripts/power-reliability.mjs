import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT='/home/user/nassers';
const MIME={'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.png':'image/png','.wasm':'application/wasm','.json':'application/json'};
const srv=http.createServer((q,r)=>{ const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p,(e,d)=>{ if(e){r.writeHead(404);r.end();return;} r.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(d); }); });
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const combos=[['dominus','nyc'],['frutiger','aero'],['knight','medieval'],['patriot','metro'],['entity','backrooms'],['countess','synth'],['dominus','inferno']];
let grand={att:0,fired:0,anim:0,gone:0,shells:0};
for(const [CH,MP] of combos){
  const pg=await b.newPage({viewport:{width:412,height:892},deviceScaleFactor:1});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(([c,m])=>{try{localStorage.setItem('invrun_char',c);localStorage.setItem('invrun_map',m);}catch(e){}},[CH,MP]);
  await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
  await pg.waitForFunction('!!window.__game',{timeout:120000});
  await pg.waitForTimeout(2200);
  const r=await pg.evaluate((ch)=>{
    const G=window.__game;
    G._clock.getDelta=()=>1/60; window.requestAnimationFrame=()=>0;
    G.renderer.render=()=>{}; G.ui.update=()=>{}; G.snapMenuBg=()=>{};
    G.time.frozen=()=>false; G.time.update=(rd)=>rd; G.drones._spawn=()=>{};
    G.momentum.update=()=>{G.momentum.value=100;}; G.combo.miss=()=>{};
    const st={att:0,fired:0,anim:0,gone:0,shells:0,kinds:{}};
    const list=window.__cb.POWERS[ch];
    G.run.startRun();
    for(let round=0; round<40; round++){
      // rotate through all four powers so each kind is exercised
      const pw=list[round%list.length];
      localStorage.setItem('invrun_pw_'+ch, pw.id);
      // run until a gate is targetable
      let t=null;
      for(let i=0;i<60*120 && !t;i++){ G._loop(); t=G.powers.target(); }
      if(!t) break;
      st.att++;
      const before=G.city._tear? G.city._tear.length:0;
      const ok=G.powers.press();
      if(ok) st.fired++;
      if(G.powers.fx>0) st.anim++;
      if(t.hit) st.gone++;
      const made=(G.city._tear?G.city._tear.length:0)-before;
      if(made>0) st.shells++;
      st.kinds[pw.kind]=(st.kinds[pw.kind]||0)+(ok?1:0);
      // let the burst play out fully
      for(let i=0;i<60;i++) G._loop();
    }
    return st;
  }, CH);
  console.log(`${CH}/${MP}`.padEnd(20), JSON.stringify(r), errs.length?('ERR '+errs[0]):'');
  grand.att+=r.att; grand.fired+=r.fired; grand.anim+=r.anim; grand.gone+=r.gone; grand.shells+=r.shells;
  await pg.close();
}
console.log('\nTOTAL', JSON.stringify(grand),
  '\nfire rate', (grand.fired/grand.att*100).toFixed(1)+'%',
  '| animation played', (grand.anim/grand.att*100).toFixed(1)+'%',
  '| gate destroyed', (grand.gone/grand.att*100).toFixed(1)+'%',
  '| debris spawned', (grand.shells/grand.att*100).toFixed(1)+'%');
await b.close(); srv.close();
