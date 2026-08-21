// CITYBREAKER — character roster.
//
// Every villain in CHARACTERS has to clear the same bar before he ships:
//
//   1. The model loads at all (a missing/oversized GLB is a blob on screen).
//   2. He carries a cloth mask (aFlow) covering a plausible slice of the mesh — the flow
//      animation reads that attribute, and a mask over ~60% means it caught a limb, which is
//      the bug that made arms wiggle instead of capes.
//   3. His portrait actually decodes on the villain card.
//   4. He is INVISIBLE at the menu and VISIBLE once the run starts. The menu shows the city
//      flying past with nobody in it; the villain arrives on PLAY.
//   5. He has all four powers wired.
//
// 'forged' is the procedural one — built from code geometry, so it is many small meshes
// instead of one skinned mesh. Everything else about it is checked identically.
//
//   node scripts/characters.mjs
//
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MIME = {'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary',
              '.png':'image/png','.wasm':'application/wasm','.json':'application/json'};
const srv = http.createServer((q,r)=>{
  const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p,(e,d)=>{ if(e){ r.writeHead(404); r.end(); return; }
    r.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(d); });
});
await new Promise(r=>srv.listen(0,r));
const port = srv.address().port;

const browser = await chromium.launch({
  executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });

// CHARS=forged node scripts/characters.mjs  — to check one while iterating on it
const CHARS = (process.env.CHARS || 'dominus,frutiger,knight,patriot,entity,countess,'
              +'shrike,tyrant,nocturne,forged').split(',');
let bad = 0;

for(const ch of CHARS){
  const pg = await browser.newPage({viewport:{width:412,height:892},deviceScaleFactor:1});
  const errs = []; pg.on('pageerror', e=>errs.push(e.message));
  await pg.addInitScript(c=>{ try{ localStorage.setItem('invrun_char',c); }catch(e){} }, ch);
  await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
  await pg.waitForFunction('!!(window.__game&&window.__game.player&&window.__game.player.villainModel)',
    {timeout:200000}).catch(()=>errs.push('MODEL NEVER LOADED'));
  await pg.waitForTimeout(1200);

  const r = await pg.evaluate(()=>{
    const G = window.__game, P = G.player;
    let meshes=0, clothVerts=0, totalVerts=0;
    P.villainModel.traverse(o=>{
      if(!o.isMesh) return;
      meshes++;
      const fa = o.geometry.getAttribute('aFlow');
      totalVerts += o.geometry.attributes.position.count;
      if(fa) for(let i=0;i<fa.count;i++) if(fa.array[i]>0.05) clothVerts++;
    });
    const key = localStorage.getItem('invrun_char');
    const img = document.querySelector(`.card.char[data-char="${key}"] .previmg`);

    const hiddenAtMenu = P.rig.visible === false;      // menu = empty city
    G.run.startRun();
    const shownInPlay  = P.rig.visible === true;       // PLAY = villain arrives

    // ON FIRE overwrites every material's emissive. Dying while lit used to hide the fire aura,
    // and the reset was gated on that aura still being visible — so the villain stayed lit in the
    // last aura colour for the rest of the session, which read as him turning white and staying
    // white. Light him, send him back to the menu, and every material must be exactly as authored.
    const snap = ()=> P.glowMats.filter(m=>m&&m.emissive)
                       .map(m=>m.emissive.getHexString()+'@'+m.emissiveIntensity).join(',');
    const authored = snap();
    G.combo.count=40; G.combo.epicTime=99; G.combo.etherealTime=99;
    P.update(1/60, G.input.steer);
    const lit = snap();
    G.combo.count=0; G.combo.epicTime=0; G.combo.etherealTime=0;
    P.update(1/60, G.input.steer);
    const afterFire = snap();
    G.combo.count=40; G.combo.epicTime=99; G.combo.etherealTime=99;
    P.update(1/60, G.input.steer);
    G.toMenu ? G.toMenu() : P.setMenuMode(true);        // die/quit while still on fire
    const afterMenu = snap();

    G.run.state = 'READY';

    return { meshes, totalVerts, clothVerts,
             pctCloth:+(100*clothVerts/Math.max(1,totalVerts)).toFixed(1),
             portrait: img ? (img.naturalWidth>0) : 'no card',
             hiddenAtMenu, shownInPlay,
             glowLights: lit!==authored,
             glowRestores: afterFire===authored,
             glowRestoresAtMenu: afterMenu===authored,
             powers:(window.__cb.POWERS[key]||[]).length,
             name:(window.__cb.CHARACTERS[key]||{}).name };
  });

  const ok = r.meshes>0 && r.clothVerts>0 && r.pctCloth<60 && r.portrait===true
             && r.hiddenAtMenu && r.shownInPlay && r.powers===4
             && r.glowLights && r.glowRestores && r.glowRestoresAtMenu
             && errs.length===0;
  if(!ok) bad++;
  console.log(ch.padEnd(9), ok?'ok  ':'FAIL', JSON.stringify(r), errs.slice(0,1).join(''));
  await pg.close();
}

console.log('\n' + (bad ? bad+' CHARACTER(S) FAILED' : `ALL ${CHARS.length} CHARACTERS OK`));
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
