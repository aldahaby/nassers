// CITYBREAKER — the wordmark fits, whatever face the map brings.
//
// The seven map faces have wildly different widths — Audiowide is far wider than Titan One at the
// same size — so a font-size tuned for one clips the wordmark on another. Game.fitText measures
// and shrinks instead of carrying a per-font fudge factor. This checks CITY / BREAKER and the
// tagline fit inside the viewport on every map at 360, 412 and 430 wide, and that the fitter
// never shrinks the headline into illegibility.
//
//   node scripts/wordmark-fit.mjs
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
const SIZES=[[360,640],[412,892],[430,932]];
let bad=0;
for(const map of MAPS){
  const pg=await b.newPage({viewport:{width:412,height:892},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(m=>{ try{ localStorage.setItem('invrun_map',m); }catch(e){} },map);
  await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
  await pg.waitForFunction('!!window.__game',{timeout:150000});
  await pg.waitForTimeout(3200);
  await pg.evaluate(()=>{ const l=document.getElementById('loading-overlay'); if(l) l.style.display='none'; });
  const per=[];
  for(const [w,h] of SIZES){
    await pg.setViewportSize({width:w,height:h});
    await pg.waitForTimeout(500);
    const r=await pg.evaluate(async ()=>{
      await document.fonts.ready;
      const el=document.querySelector('.logo'), tg=document.querySelector('.tagline');
      const rb=el.getBoundingClientRect();
      return { fits: el.scrollWidth<=el.clientWidth+1,
               tagFits: tg.scrollWidth<=tg.clientWidth+1,
               inViewport: rb.left>=-1 && rb.right<=innerWidth+1,
               px:Math.round(parseFloat(getComputedStyle(el).fontSize)) };
    });
    per.push({vw:w, ...r});
  }
  await pg.setViewportSize({width:412,height:892}); await pg.waitForTimeout(400);
  await pg.screenshot({path:`${OUT}/fit_${map}.png`});
  const ok=per.every(x=>x.fits&&x.tagFits&&x.inViewport&&x.px>=26) && errs.length===0;
  if(!ok) bad++;
  console.log(map.padEnd(10), ok?'ok  ':'FAIL', JSON.stringify(per), errs.slice(0,1).join(''));
  await pg.close();
}
console.log('\n'+(bad? bad+' FAILED':'WORDMARK FITS ON EVERY MAP AND SIZE'));
await b.close(); srv.close();
process.exit(bad?1:0);
