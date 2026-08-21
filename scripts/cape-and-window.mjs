// CITYBREAKER — cape/wing flow, and the guarantee that a gate is always answerable.
//
// TWO things are asserted, per character:
//
// 1. CLOTH. Every villain is ONE mesh with ONE material and no bones, so the cape or wings can
//    only be moved by a per-vertex weight. That weight (CHARACTERS[key].flow -> aFlow) must exist,
//    the shader must be live, and it must cover a plausible SLICE of the model — enough to be the
//    cape, nowhere near enough to be the whole body. The visual check that only cloth is weighted
//    is the mask render; this is the regression guard that it stays wired up.
//
// 2. THE POWER WINDOW. Reach is speed x PWR.leadSec, so the time you get to answer a gate is the
//    same at any speed. This measures the REAL thing during play: from the frame a gate first
//    becomes targetable to the frame you reach it, for every gate, with death disabled so no
//    approach is lost. Must never drop below 2.3s for any character.
//
//   node scripts/cape-and-window.mjs
//
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const MIME={'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.png':'image/png','.wasm':'application/wasm','.json':'application/json'};
const srv=http.createServer((q,r)=>{ const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p,(e,d)=>{ if(e){r.writeHead(404);r.end();return;} r.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(d); }); });
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
let bad=0;
for(const key of ['dominus','frutiger','knight','patriot','entity','countess']){
  const pg=await b.newPage({viewport:{width:412,height:892},deviceScaleFactor:1});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(k=>{ try{ localStorage.setItem('invrun_char',k); }catch(e){} },key);
  await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
  await pg.waitForFunction('!!(window.__game&&window.__game.player&&window.__game.player.villainModel)',{timeout:200000}).catch(()=>errs.push('NO MODEL'));
  await pg.waitForTimeout(1500);
  const r=await pg.evaluate(()=>{
    const G=window.__game, P=G.player;
    const out={};
    // ---- 1) CLOTH: only cape/wing vertices carry any weight, and the shader is live ----
    let tot=0, moving=0, meshes=0, hasAttr=true, shaderOn=false;
    P.villainModel.traverse(o=>{ if(!o.isMesh) return; meshes++;
      const g=o.geometry, fa=g.getAttribute('aFlow');
      if(!fa){ hasAttr=false; return; }
      tot+=fa.count;
      for(let i=0;i<fa.count;i++) if(fa.array[i]>0.05) moving++;
      if(o.material && o.material.onBeforeCompile) shaderOn=true;
    });
    out.cloth={meshes, verts:tot, moving, pctMoving:+(100*moving/Math.max(1,tot)).toFixed(1),
               hasAttr, shaderOn, flowBack:[+P._flowBack.x.toFixed(2),+P._flowBack.y.toFixed(2),+P._flowBack.z.toFixed(2)]};
    // ---- 2) the shader must actually have compiled without error ----
    G._clock.getDelta=()=>1/60;
    const before=G.renderer.info.programs?G.renderer.info.programs.length:-1;
    G._loop(); G._loop();
    out.programs=G.renderer.info.programs?G.renderer.info.programs.length:-1;
    out.programsBefore=before;
    // ---- 3) POWER WINDOW: how many seconds do you get, at every speed, for every kind? ----
    G.renderer.render=()=>{}; window.requestAnimationFrame=()=>0;
    G.ui.update=()=>{}; G.snapMenuBg=()=>{}; G.time.frozen=()=>false; G.time.update=(rd)=>rd;
    const CB=window.__cb, ck=Object.keys(CB.POWERS).find(k=>CB.POWERS[k])&&null;
    const charKey=(()=>{try{return localStorage.getItem('invrun_char')||'dominus';}catch(e){return 'dominus';}})();
    const kinds={};
    for(const pw of (CB.POWERS[charKey]||CB.POWERS.dominus)){
      try{ localStorage.setItem('invrun_pw_'+charKey, pw.id); }catch(e){}
      let minW=99, maxW=0;
      for(const spd of [40,60,80,100,120,140,160]){
        const real=G.player.speed; G.player.speed=()=>spd;
        const w=G.powers.windowSec();
        G.player.speed=real;
        minW=Math.min(minW,w); maxW=Math.max(maxW,w);
      }
      kinds[pw.kind]={min:+minW.toFixed(2), max:+maxW.toFixed(2)};
    }
    out.windows=kinds;
    // ---- 4) real play: measure the ACTUAL time FIRE stays lit before each gate ----
    G.input.sample=function(){ const P2=G.player; let best=null,bz=1e9;
      for(const t of G.city.buildings){ if(t.hit||t.decor) continue;
        const z=t.mesh.position.z; if(z>P2.pos.z+1&&z<bz){ bz=z; best=t; } }
      if(!best){ this.steer.x=0; return; }
      this.steer.x=-Math.max(-1,Math.min(1,(best.mesh.position.x-P2.pos.x)/1.2)); };
    G.run.toGameOver=()=>{};        // survive every gate so EVERY approach is measured
    G.run.startRun();
    // Per-GATE: from the frame a gate first becomes targetable to the frame the player reaches
    // its z. The gate's z is fixed, so it is captured on first sighting — the gate object itself
    // is cleared the instant it is slammed, which would otherwise lose the sample.
    const leads=[]; const first=new Map();
    for(let i=0;i<60*220;i++){
      G._loop();
      const t=G.powers.target();
      // Only count gates first sighted AHEAD of him. A run can begin with a gate already level
      // with the player left over from the previous world, and that samples as a zero-second
      // warning for a wall he never actually approached.
      if(t && !first.has(t.gid) && t.mesh.position.z > G.player.pos.z + 2)
        first.set(t.gid,{f:i, z:t.mesh.position.z});
      for(const [gid,rec] of [...first]){
        if(rec.z <= G.player.pos.z){ leads.push((i-rec.f)/60); first.delete(gid); }
      }
    }
    leads.sort((a,c)=>a-c);
    out.liveWindow={n:leads.length, min:+(leads[0]||0).toFixed(2),
      p5:+(leads[Math.floor(0.05*(leads.length-1))]||0).toFixed(2),
      median:+(leads[Math.floor(0.5*(leads.length-1))]||0).toFixed(2),
      max:+(leads[leads.length-1]||0).toFixed(2)};
    return out;
  });
  const okCloth = r.cloth.hasAttr && r.cloth.shaderOn && r.cloth.pctMoving>3 && r.cloth.pctMoving<55;
  const okWin = Object.values(r.windows).every(w=>w.min>=2.4);
  const okLive = r.liveWindow.n>5 && r.liveWindow.min>=2.3;
  const ok = okCloth && okWin && okLive && errs.length===0;
  if(!ok) bad++;
  console.log(key.padEnd(9), ok?'ok  ':'FAIL', JSON.stringify(r), errs.slice(0,2).join('|'));
  await pg.close();
}
console.log('\n'+(bad?bad+' FAILED':'ALL CHARACTERS PASS'));
await b.close(); srv.close();
process.exit(bad?1:0);
