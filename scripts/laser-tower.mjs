// CITYBREAKER — the laser tower, encounter by encounter.
//
// The failure this suite exists to prevent is the one the game actually shipped with: the tower
// charged on a timer from the moment it spawned, up to 560 m ahead, so it fired into an empty
// street long before the player got there. From the cockpit that is "attacked by something I never
// saw" — the beam had already been and gone.
//
// So the checks are all about WHERE THE PLAYER IS at each moment of the sequence, measured over a
// long run at several speeds:
//
//   1. the tower is parked and visible for seconds before anything happens
//   2. the charge starts when he is ~one charge away, in TIME, so it is speed-independent
//   3. the beam is live while he is passing through it, not before and not after
//   4. the warning and the EVADE button are up for the whole charge and gone at the shot
//   5. ignoring it costs you; evading it does not
//   6. and none of that changes when the run gets fast
//
//   node scripts/laser-tower.mjs
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

// evadeMode: 'never' | 'always' — always evades on the warning, or ignores it entirely
const runAt = async (speed, evadeMode)=>{
  const pg = await browser.newPage({viewport:{width:412,height:892},deviceScaleFactor:1});
  const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
  await pg.addInitScript(()=>{ try{ localStorage.setItem('invrun_char','forged');
    localStorage.setItem('invrun_map','nyc'); localStorage.setItem('invrun_mode','swipe');
    localStorage.setItem('invrun_tut','1'); }catch(e){} });
  await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
  await pg.waitForFunction('!!window.__game',{timeout:200000});
  await pg.waitForTimeout(1800);
  const out = await pg.evaluate(([spd, mode])=>{
    const G=window.__game, P=G.player, SW=window.__cb.SW;
    G._clock.getDelta=()=>1/60; G.renderer.render=()=>{}; window.requestAnimationFrame=()=>0;
    G.ui.update=()=>{}; G.snapMenuBg=()=>{}; G.time.frozen=()=>false; G.time.update=rd=>rd;
    G.impact.smash=()=>{}; G.run.toGameOver=()=>{};
    G.difficulty.baseSpeed=()=>spd;
    G.run.startRun();
    // The loop refills momentum every frame so survival is not what is under test — which also
    // erases the damage. Count the hits at the source instead.
    let hits=0; const oSlam=P.onGateSlam.bind(P); P.onGateSlam=()=>{ hits++; oSlam(); };

    const enc=[]; let cur=null, last='idle';
    const warnEl=document.getElementById('beam-warn');
    const evEl=document.getElementById('btn-evade');
    const vis=e=>e && !e.classList.contains('hidden');

    for(let i=0;i<60*260;i++){
      G.momentum.value=G.momentum.MAX;       // survival is not what is under test
      P.fwdNow=spd;
      G._loop();
      const C=G.cannon, st=C.state;

      // a tower has been parked and is visible, dormant
      if(C.parked && (!cur || cur.done)){
        cur={ z:C.parked.z, dParked:+(C.parked.z-P.pos.z).toFixed(0),
              warnFrames:0, chargeFrames:0, fireFrames:0,
              minDist:9e9, hits0:hits, hit:false, evaded:false, done:false,
              warnAtCharge:true, warnAtFire:false };
      }
      if(st==='charge'){
        if(cur && cur.dChargeStart===undefined){
          cur.dChargeStart=+(C.active.z-P.pos.z).toFixed(1);
          cur.chargeLead=+((C.active.z-P.pos.z)/spd).toFixed(2);
          cur.hits0=hits;
        }
        if(cur){ cur.chargeFrames++;
          if(vis(warnEl)&&vis(evEl)) cur.warnFrames++; else cur.warnAtCharge=false; }
        if(mode==='always' && C.t>SW.chargeSec*0.72 && cur && !cur.evaded){ cur.evaded=P.evade(); }
        // 'early' presses the instant the warning appears — the duck must still be under the beam
        // a whole charge later, or the most natural reaction in the game is punished.
        if(mode==='early' && cur && !cur.evaded){ cur.evaded=P.evade(); }
      }
      if(st==='fire' && cur){
        cur.fireFrames++;
        // 'late' is the last-instant save: press only once the beam is already up and he is a few
        // metres from it. A reaction game has to honour this.
        // pressed at the very edge of the lethal slab — the last frame at which a human could
        // possibly react. If this does not save you, evading stops working at speed.
        if(mode==='late' && !cur.evaded && Math.abs(P.pos.z-C.active.z) < SW.beamDepth)
          cur.evaded=P.evade();
        cur.minDist=Math.min(cur.minDist, Math.abs(P.pos.z-C.active.z));
        if(cur.dAtFire===undefined) cur.dAtFire=+(C.active.z-P.pos.z).toFixed(1);
        cur.warnAtFire=(vis(warnEl)&&vis(evEl));   // EVADE must stay live THROUGH the beam
        cur.lowY=Math.min(cur.lowY===undefined?9e9:cur.lowY, P.pos.y);
      }
      if(st==='cool' && cur && cur.uiAfter===undefined) cur.uiAfter=(vis(warnEl)||vis(evEl));
      if(last!=='idle' && st==='idle' && cur && !cur.done){
        cur.hit = hits > cur.hits0;
        cur.minDist=+cur.minDist.toFixed(1);
        cur.done=true; enc.push(cur);
      }
      last=st;
    }
    return { spd, mode, beamY:SW.beamY, beamDepth:SW.beamDepth, chargeSec:SW.chargeSec,
             n:enc.length, enc:enc.slice(0,6) };
  }, [speed, evadeMode]);
  await pg.close();
  return {out, errs};
};

const A = await runAt(46,'never');    // cruise
const B = await runAt(46,'always');
const C2= await runAt(95,'never');    // late-run speed
const D = await runAt(95,'always');
const E = await runAt(46,'late');     // pressed once the beam is already up
const F = await runAt(95,'late');
const H = await runAt(46,'early');    // pressed the instant the warning appeared

const ok = (R,f)=> R.out.enc.length>0 && R.out.enc.every(f);
const checks=[
  ['encounters happened at all',            A.out.n>=3 && C2.out.n>=3],
  ['parked far out and visible first',      ok(A,e=>e.dParked>=400) && ok(C2,e=>e.dParked>=400)],
  ['charge starts about one charge away',   ok(A,e=>Math.abs(e.chargeLead-A.out.chargeSec)<0.35)
                                         && ok(C2,e=>Math.abs(e.chargeLead-C2.out.chargeSec)<0.35)],
  ['warning lead is the same at any speed', Math.abs(A.out.enc[0].chargeLead - C2.out.enc[0].chargeLead)<0.3],
  ['the beam is live AS he passes',         ok(A,e=>e.minDist<=A.out.beamDepth+6)
                                         && ok(C2,e=>e.minDist<=C2.out.beamDepth+14)],
  ['warning + EVADE up for the whole charge', ok(A,e=>e.warnAtCharge && e.warnFrames>40)],
  ['EVADE stays live while the beam is up', ok(A,e=>e.warnAtFire)],
  ['and it is gone once the beam has passed', ok(A,e=>e.uiAfter===false)],
  ['ignoring it costs you, every time',     ok(A,e=>e.hit) && ok(C2,e=>e.hit)],
  ['evading it costs you nothing, ever',    ok(B,e=>!e.hit) && ok(D,e=>!e.hit)],
  ['the evade really goes under the beam',  ok(B,e=>e.lowY < B.out.beamY-4)],
  ['a LAST-INSTANT evade still saves you', ok(E,e=>e.evaded && !e.hit) && ok(F,e=>e.evaded && !e.hit)],
  ['and so does the earliest possible one', ok(H,e=>e.evaded && !e.hit)],
  ['no page errors', [A,B,C2,D,E,F,H].every(R=>R.errs.length===0)],
];
const bad=checks.filter(c=>!c[1]).map(c=>c[0]);
for(const [n,R] of [['46 ignore',A],['46 evade',B],['95 ignore',C2],['95 evade',D],
                    ['46 late',E],['95 late',F],['46 early',H]])
  console.log(n.padEnd(10), 'n='+R.out.n,
    JSON.stringify(R.out.enc.slice(0,3).map(e=>({lead:e.chargeLead, d:e.minDist, hit:e.hit, ev:e.evaded, lowY:+(e.lowY||0).toFixed(1)}))));
console.log('\n' + (bad.length ? 'FAIL — ' + bad.join('; ') : 'LASER TOWER OK'));
await browser.close(); srv.close();
process.exit(bad.length?1:0);
