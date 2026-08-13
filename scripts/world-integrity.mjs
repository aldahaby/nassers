// CITYBREAKER — world integrity.
//
// Guards the three things that made the city unreadable, all of which were caused by state
// leaking through the building object pool:
//
//   1. A recycled gate kept the shared gate texture, so ORDINARY towers came back looking armored.
//   2. _place re-tiled whatever texture the material happened to be holding. When that was the
//      SHARED gate texture, every armored tower already on screen changed at the same time —
//      which is what "buildings change the closer you get" actually was.
//   3. Hittable towers carried a random colour jitter, so "normal" was not one recognisable thing.
//
// Plus: drones must not exist until the run has earned them.
//
//   node scripts/world-integrity.mjs
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

const MAPS = ['nyc','aero','medieval','metro','backrooms'];
let bad = 0;

for(const map of MAPS){
  const pg = await browser.newPage({viewport:{width:412,height:892},deviceScaleFactor:1});
  const errs = []; pg.on('pageerror', e=>errs.push(e.message));
  await pg.addInitScript(m=>{ try{
    localStorage.setItem('invrun_char','dominus'); localStorage.setItem('invrun_map',m); }catch(e){} }, map);
  await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
  await pg.waitForFunction('!!window.__game',{timeout:120000});
  await pg.waitForTimeout(2500);

  const r = await pg.evaluate(()=>{
    const G = window.__game, DR = window.__cb.DRONES;
    G._clock.getDelta = ()=>1/60;
    G.renderer.render = ()=>{};                       // MUST stub: live renders lock the page
    window.requestAnimationFrame = ()=>0;
    G.ui.update = ()=>{}; G.snapMenuBg = ()=>{};
    G.time.frozen = ()=>false; G.time.update = (rd)=>rd;

    const out = { gateTexRepeat:new Set(), normalWearingGateTex:0, gateWearingFacade:0,
                  normalColours:new Set(), gateColours:new Set(), capOnNormal:0, capOnGate:0,
                  gatesSeen:0, normalsSeen:0, recycledGates:0, droneSpawns:[], deaths:0 };

    // count how often a pool entry that WAS a gate gets reused — the leak only shows after reuse
    const oPlace = G.city._place.bind(G.city);
    G.city._place = (b,...rest)=>{ if(b.wasGate) out.recycledGates++; return oPlace(b,...rest); };

    const oDrone = G.drones._spawn.bind(G.drones);
    G.drones._spawn = ()=>{ out.droneSpawns.push({score:Math.round(G.score.total),
      dist:Math.round(G.score.distance), t:+G.difficulty.elapsed.toFixed(1)}); oDrone(); };

    // a competent pilot that also fires its power, so the run lasts and gates keep cycling
    G.input.sample = function(){
      const P = G.player; let best=null, bz=1e9;
      for(const t of G.city.buildings){ if(t.hit||t.decor) continue;
        const z = t.mesh.position.z; if(z>P.pos.z+1 && z<bz){ bz=z; best=t; } }
      if(!best){ this.steer.x=0; return; }
      this.steer.x = -Math.max(-1,Math.min(1,(best.mesh.position.x-P.pos.x)/1.2));
    };

    G.run.startRun();
    for(let i=0;i<60*240;i++){
      G._loop();
      if(i%6===0 && G.powers.target()) G.powers.press();
      if(G.run.state==='GameOver'){ out.deaths++; G.run.startRun(); }

      if(i%20) continue;
      // the shared gate textures must never be re-tiled after creation
      for(const k of Object.keys(G.city._gateTex||{})){
        const t = G.city._gateTex[k];
        out.gateTexRepeat.add(k+':'+t.repeat.x.toFixed(3)+','+t.repeat.y.toFixed(3));
      }
      const gateTex = new Set(Object.values(G.city._gateTex||{}));
      for(const b of G.city.buildings){
        if(b.hit) continue;
        const wearingGate = gateTex.has(b.mesh.material.map);
        if(b.gate){
          out.gatesSeen++;
          if(!wearingGate) out.gateWearingFacade++;
          out.gateColours.add(b.mesh.material.color.getHexString());
          if(b.cap.visible) out.capOnGate++;
        } else if(!b.decor){
          out.normalsSeen++;
          if(wearingGate) out.normalWearingGateTex++;
          out.normalColours.add(b.mesh.material.color.getHexString());
        }
      }
    }
    return { gateTexRepeat:[...out.gateTexRepeat], normalWearingGateTex:out.normalWearingGateTex,
             gateWearingFacade:out.gateWearingFacade, normalColours:[...out.normalColours],
             gateColours:[...out.gateColours], gatesSeen:out.gatesSeen, normalsSeen:out.normalsSeen,
             capOnGate:out.capOnGate, recycledGates:out.recycledGates, deaths:out.deaths,
             droneCfg:DR, drones:out.droneSpawns.length, firstDrone:out.droneSpawns[0]||null };
  });

  // one repeat value per texture key, for the whole run
  const keys = new Set(r.gateTexRepeat.map(x=>x.split(':')[0]));
  const repeatStable = keys.size === r.gateTexRepeat.length;

  const checks = [
    ['no normal tower wears the gate texture', r.normalWearingGateTex === 0],
    ['every gate wears the gate texture',      r.gateWearingFacade === 0],
    ['gate texture tiling never changes',      repeatStable],
    ['exactly ONE normal tower colour',        r.normalColours.length === 1],
    ['exactly ONE gate body colour',           r.gateColours.length === 1],
    ['every gate carries a roof beacon',       r.capOnGate > 0],
    ['pool actually recycled gates',           r.recycledGates > 0],
    ['gates were seen at all',                 r.gatesSeen > 0],
    ['no drone before its score gate',         !r.firstDrone || r.firstDrone.score >= r.droneCfg.minScore],
    ['no drone before its time gate',          !r.firstDrone || r.firstDrone.t >= r.droneCfg.minTime],
    ['no page errors',                         errs.length === 0],
  ];
  const failed = checks.filter(c=>!c[1]).map(c=>c[0]);
  if(failed.length) bad++;
  console.log(map.padEnd(10),
    failed.length ? 'FAIL  ' + failed.join('; ') : 'ok    ',
    JSON.stringify({ gates:r.gatesSeen, normals:r.normalsSeen, recycled:r.recycledGates,
                     normalCols:r.normalColours, gateCols:r.gateColours,
                     tiling:r.gateTexRepeat, drones:r.drones, firstDrone:r.firstDrone }),
    errs.slice(0,2).join('|'));
  await pg.close();
}

console.log('\n' + (bad ? bad + ' MAP(S) FAILED' : 'ALL MAPS CLEAN'));
await browser.close(); srv.close();
process.exit(bad ? 1 : 0);
