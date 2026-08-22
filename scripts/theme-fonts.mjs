// CITYBREAKER — every map speaks in its own typeface.
//
// Each world carries its own embedded face, switched on body.theme-<key>. This asserts the swap
// reaches EVERYTHING, not just the logo: the wordmark, the tagline, the PLAY button, the HUD
// score, the menu chips, a modal's heading and toggles, and the results screen title. It also
// checks the face is really loaded and really rendering (measured against a fallback), and that
// the menu stays translucent over the live world.
//
//   node scripts/theme-fonts.mjs
//
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'), OUT='/tmp/claude-0/-home-user-nassers/b3bc857b-beed-5faf-b80d-53827eff6ffa/scratchpad';
const MIME={'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.png':'image/png','.wasm':'application/wasm','.json':'application/json'};
const srv=http.createServer((q,r)=>{ const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p,(e,d)=>{ if(e){r.writeHead(404);r.end();return;} r.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(d); }); });
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const MAPS=['nyc','aero','medieval','metro','backrooms','inferno','synth'];
const WANT={nyc:'CBnyc',aero:'CBaero',medieval:'CBmedieval',metro:'CBmetro',
            backrooms:'CBbackrooms',inferno:'CBinferno',synth:'CBsynth'};
let bad=0;
for(const map of MAPS){
  const pg=await b.newPage({viewport:{width:412,height:892},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(m=>{ try{ localStorage.setItem('invrun_map',m); localStorage.setItem('invrun_char','dominus'); }catch(e){} },map);
  await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
  await pg.waitForFunction('!!window.__game',{timeout:150000});
  await pg.waitForTimeout(3200);
  await pg.evaluate(()=>{ const l=document.getElementById('loading-overlay'); if(l) l.style.display='none'; });
  await pg.waitForTimeout(500);
  const r=await pg.evaluate(async (want)=>{
    await document.fonts.ready;
    const fam=(sel)=>{ const e=document.querySelector(sel); return e? getComputedStyle(e).fontFamily.split(',')[0].replace(/['"]/g,'') : null; };
    const loaded=[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family.replace(/['"]/g,''));
    // is the FACE actually rendering, not just named? measure against a fallback
    const probe=(family)=>{ const c=document.createElement('canvas').getContext('2d');
      c.font='40px '+family+', monospace'; const a=c.measureText('CITYBREAKER').width;
      c.font='40px monospace'; const bw=c.measureText('CITYBREAKER').width;
      return Math.abs(a-bw)>1; };
    const ov=document.getElementById('start-overlay'), cs=getComputedStyle(ov);
    return { logo:fam('.logo'), play:fam('.btn-play'), hud:fam('#score'), chip:fam('.chip'),
             tagline:fam('.tagline'),
             faceLoaded:loaded.includes(want), faceRenders:probe("'"+want+"'"),
             overlayBg:cs.background.slice(0,60),
             translucent:/rgba\(/.test(cs.backgroundImage||cs.background),
             menuBgOpacity:+getComputedStyle(document.getElementById('menu-bg')).opacity };
  }, WANT[map]);
  // results screen + a modal must use it too
  const more=await pg.evaluate(()=>{
    // drive a real game over so the results screen is actually built, then open a sheet
    const G=window.__game; G.run.startRun(); G.score.total=123456; G.run.toGameOver();
    document.getElementById('settings-btn').click();
    const f=(s)=>{ const e=document.querySelector(s); return e? getComputedStyle(e).fontFamily.split(',')[0].replace(/['"]/g,'') : null; };
    return { resultTitle:f('.res-title'), sheetHead:f('.sheet-head span'), toggle:f('.toggle') };
  });
  const want=WANT[map];
  const all=[r.logo,r.play,r.hud,r.chip,r.tagline,more.resultTitle,more.sheetHead,more.toggle];
  const ok = all.every(x=>x===want) && r.faceLoaded && r.faceRenders && r.translucent
             && r.menuBgOpacity<0.5 && errs.length===0;
  if(!ok) bad++;
  console.log(map.padEnd(10), ok?'ok  ':'FAIL', want.padEnd(12),
    JSON.stringify({...r, ...more, overlayBg:undefined}), errs.slice(0,1).join(''));
  await pg.close();
}
console.log('\n'+(bad? bad+' FAILED':'ALL MAPS: FONT SWITCHES EVERYWHERE'));
await b.close(); srv.close();
