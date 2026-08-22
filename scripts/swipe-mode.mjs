// CITYBREAKER — swipe mode.
//
// A second way to play, alongside free flight. Three fixed lanes, a flick to change lane, and a
// rail cannon fired down the street that you duck under. The whole point of the mode is that it is
// a BRANCH through the existing systems — same maps, villains, powers and missions — so this suite
// checks both that swipe behaves like a swipe runner AND that free flight is untouched by it.
//
// What has to hold:
//   1. A flick is a STEP. The lane is an integer, clamped to [-1,1], and one flick moves one lane.
//   2. Targets sit exactly ON lanes — never between two — and fill the lane they are on.
//   3. An armored gate spans all three lanes, so a power is the only answer. A lane-dodgeable gate
//      would make powers decorative.
//   4. The rail cannon cycles charge -> fire -> idle, and EVADE actually drops him UNDER the beam
//      (the hit test reads pos.y, so an animation-only duck would be a lie).
//   5. Free flight still steers continuously and its towers are NOT lane-quantised.
//
//   node scripts/swipe-mode.mjs
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

const open = async (mode)=>{
  const pg = await browser.newPage({viewport:{width:412,height:892},deviceScaleFactor:1});
  const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
  await pg.addInitScript(m=>{ try{ localStorage.setItem('invrun_char','forged');
    localStorage.setItem('invrun_map','nyc'); localStorage.setItem('invrun_mode',m); }catch(e){} }, mode);
  await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
  await pg.waitForFunction('!!window.__game',{timeout:200000});
  await pg.waitForTimeout(2000);
  return {pg, errs};
};

// ---- SWIPE ---------------------------------------------------------------------------------
const A = await open('swipe');
const sw = await A.pg.evaluate(()=>{
  const G=window.__game, SW=window.__cb.SW, P=G.player;
  G._clock.getDelta=()=>1/60; G.renderer.render=()=>{}; window.requestAnimationFrame=()=>0;
  G.ui.update=()=>{}; G.snapMenuBg=()=>{}; G.time.frozen=()=>false; G.time.update=rd=>rd;
  // _pathX scales the road's swing by difficulty.level, so a tower placed at one amplitude and
  // measured at another reads as off-lane through no fault of the placement. Freeze it.
  G.difficulty.update=()=>{};
  const o={mode:G.mode, laneX:SW.laneX};
  G.run.startRun();
  const step=n=>{ for(let i=0;i<n;i++){ G.momentum.value=G.momentum.MAX; G._loop(); } };
  const off=()=>P.pos.x-G.city._pathX(P.pos.z);

  step(30);                     o.centre=+off().toFixed(2);
  // laneSteps is in FINGER direction: +1 is a swipe to the right, which must take him to the
  // right of the screen — and screen-right is world -X under this camera.
  G.input.laneSteps=1;  step(40); o.right=+off().toFixed(2); o.laneR=P.lane;
  G.input.laneSteps=-2; step(60); o.left =+off().toFixed(2); o.laneL=P.lane;
  G.input.laneSteps=-5; step(30); o.clamped=P.lane;          // cannot walk off the road
  G.input.laneSteps=9;  step(30); o.clampedHi=P.lane;

  // and the assertion that cannot be vacuous: where he is ON SCREEN
  const scr=()=>{ const v=new (P.pos.constructor)(P.pos.x,P.pos.y,P.pos.z);
                  v.project(G.camera.cam); return v.x; };
  // Read each direction as a fresh TRANSIENT. The chase camera tracks his x, so a few tenths after
  // the move he is back near the middle of frame and the sign washes out.
  G.input.laneSteps=0; P.lane=0; step(50);
  const sA=scr(); G.input.laneSteps=1;  step(12); o.screenRight=+(scr()-sA).toFixed(3);
  G.input.laneSteps=0; P.lane=0; step(50);
  const sB=scr(); G.input.laneSteps=-1; step(12); o.screenLeft =+(scr()-sB).toFixed(3);
  G.input.laneSteps=0; P.lane=0; step(30);

  const lanes=new Set(), gateSpans=new Set();
  for(let i=0;i<900;i++){ G.momentum.value=G.momentum.MAX; G._loop();
    for(const b of G.city.buildings){
      if(b.decor||b.hit) continue;
      const rel=(b.mesh.position.x-G.city._pathX(b.mesh.position.z))/SW.laneX;
      if(b.gate) gateSpans.add(Math.round(rel)); else lanes.add(Math.round(rel*100)/100);
    } }
  o.towerLanes=[...lanes].sort((a,b)=>a-b);
  o.gateLanes =[...gateSpans].sort((a,b)=>a-b);

  // The laser tower. The lane-sampling loop above runs 900 frames of live world, which is long
  // enough for a whole cannon cycle to have happened already — reset it so the sequence being
  // observed starts from the beginning.
  G.cannon.reset();
  G.cannon.nextZ=P.pos.z+260;
  const seen=[]; let evaded=false;
  o.duckY=9e9;
  for(let i=0;i<60*22;i++){
    G.momentum.value=Math.min(G.momentum.MAX,G.momentum.value+2);
    G._loop();
    if(G.cannon.state!==seen[seen.length-1]) seen.push(G.cannon.state);
    if(G.cannon.state==='charge' && !evaded && G.cannon.t>1.2){ evaded=true; P.evade(); }
    if(G.cannon.state==='fire'){
      o.duckY=Math.min(o.duckY, P.pos.y);
      // THE BUG THIS CATCHES: the tower used to charge on a timer from the moment it spawned, up
      // to 560 m ahead, so it fired into an empty street long before the player arrived. Record
      // how far away he was while the beam was actually up.
      const d=Math.abs(P.pos.z-G.cannon.active.z);
      o.nearest=Math.min(o.nearest===undefined?9e9:o.nearest, d);
    }
  }
  o.states=seen.filter(v=>v!=='idle').slice(0,3); o.beamY=SW.beamY;
  // THE DODGE ITSELF. It is a manoeuvre, not a lift shaft: down fast, a full revolution held at
  // the low point, then back to cruise. The height is what the hit test reads; the roll is what
  // sells it; neither may break the other.
  // No tower in play for this one. With a beam charging or live nearby the dive is deliberately
  // HELD until it has passed (see laser-tower.mjs), so measuring the bare manoeuvre needs a clear
  // street or the recovery never comes.
  { G.cannon.reset(); G.cannon.nextZ=P.pos.z+90000;
    const t=[]; P.duckT=0; P.evRoll=0; step(10); P.evade();
    for(let i=0;i<80;i++){ step(1); t.push({y:P.pos.y, r:P.evRoll||0}); }
    o.dodgeMinY=+Math.min(...t.map(v=>v.y)).toFixed(2);
    o.dodgeMaxRoll=Math.round(Math.max(...t.map(v=>v.r))*57.3);
    o.dodgeRecovers=Math.abs(t[t.length-1].y-P.cruiseY)<0.6; }
  o.underBeam=o.duckY < SW.beamY-3.2;
  o.nearest=+((o.nearest===undefined?9e9:o.nearest)).toFixed(1);
  o.duckY=+o.duckY.toFixed(2);
  o.evadeBtn=!!document.getElementById('btn-evade');
  o.warnEl=!!document.getElementById('beam-warn');
  o.joyHidden=getComputedStyle(document.getElementById('joy-base')).display==='none';
  return o;
});
await A.pg.close();

// ---- FREE FLIGHT, unchanged ----------------------------------------------------------------
const B = await open('free');
const fr = await B.pg.evaluate(()=>{
  const G=window.__game, SW=window.__cb.SW, P=G.player;
  G._clock.getDelta=()=>1/60; G.renderer.render=()=>{}; window.requestAnimationFrame=()=>0;
  G.ui.update=()=>{}; G.snapMenuBg=()=>{}; G.time.frozen=()=>false; G.time.update=rd=>rd;
  G.difficulty.update=()=>{};
  const o={mode:G.mode};
  G.run.startRun();
  const step=n=>{ for(let i=0;i<n;i++){ G.momentum.value=G.momentum.MAX; G._loop(); } };
  const off=()=>P.pos.x-G.city._pathX(P.pos.z);
  // a flick must do nothing at all here
  // Free flight DRAINS the flick queue and acts on none of it. Draining matters: the listeners are
  // global, so without it a session's worth of stale gestures would be spent in one frame the
  // moment the player switched to swipe mode. Acting on it would teleport the villain.
  // (A small drift against the road centre is expected — the stick is a velocity control and does
  // not feed the road curve forward.)
  step(20); const a=off(); G.input.laneSteps=1; step(40);
  o.flickMoved=+(off()-a).toFixed(2); o.queueDrained=(G.input.laneSteps===0); o.lane=P.lane|0;
  // and the stick must still steer continuously
  G.input.setScheme('stick'); G.input.sample=function(){ this.steer.x=-1; };
  const b=off(); step(30); o.stickMoved=+(off()-b).toFixed(2);
  const lanes=new Set();
  for(let i=0;i<400;i++){ G.momentum.value=G.momentum.MAX; G._loop();
    for(const t of G.city.buildings){ if(t.decor||t.hit||t.gate) continue;
      lanes.add(Math.round((t.mesh.position.x-G.city._pathX(t.mesh.position.z))/SW.laneX*100)/100); } }
  // The property that matters is not "many values" — a short sample can be unlucky — it is that
  // free flight places towers BETWEEN lanes, which swipe mode never does.
  o.distinctOffsets=lanes.size;
  o.offLane=[...lanes].filter(v=>Math.abs(v-Math.round(v))>0.06).length;
  o.cannonIdle=(G.cannon.state==='idle' && !G.cannon.active);
  return o;
});
await B.pg.close();

const checks = [
  ['swipe: lane centres are exactly one laneX apart',
                                    Math.abs(sw.right+sw.laneX)<0.4 && Math.abs(sw.left-sw.laneX)<0.4],
  ['swipe: one flick is one lane',  sw.laneR===-1 && sw.laneL===1],
  ['swipe: the lane clamps at ±1',  sw.clamped===1 && sw.clampedHi===-1],
  ['swipe RIGHT moves him right ON SCREEN', sw.screenRight > 0.02],
  ['swipe LEFT moves him left ON SCREEN',   sw.screenLeft  < -0.02],
  ['swipe: towers sit ON lanes',    sw.towerLanes.length<=3 && sw.towerLanes.every(v=>v===-1||v===0||v===1)],
  ['swipe: a gate spans all three', sw.gateLanes.length===3],
  ['swipe: the joystick is hidden', sw.joyHidden],
  ['swipe: EVADE and the warning exist', sw.evadeBtn && sw.warnEl],
  // 'cool' is the iris closing again. A weapon that just stops looks broken.
  ['cannon: charge -> fire -> cool',  sw.states.join('>')==='charge>fire>cool'],
  ['cannon: it fires WHERE HE IS, not into an empty street', sw.nearest < 30],
  ['cannon: EVADE gets him UNDER the beam', sw.underBeam],
  ['dodge: he goes well clear of the beam', sw.dodgeMinY < sw.beamY-6],
  ['dodge: a FULL barrel roll',             sw.dodgeMaxRoll >= 355],
  ['dodge: and he comes back to cruise',    sw.dodgeRecovers],
  ['free: the flick queue is drained', fr.queueDrained],
  ['free: but no lane is ever taken',  fr.lane===0],
  ['free: a flick moves nobody',    Math.abs(fr.flickMoved)<2.0],
  ['free: the stick still steers',  Math.abs(fr.stickMoved)>4],
  ['free: towers are NOT lane-quantised', fr.offLane>0],
  ['free: no rail cannon at all',   fr.cannonIdle],
  ['no page errors',                A.errs.length===0 && B.errs.length===0],
];
const failed = checks.filter(c=>!c[1]).map(c=>c[0]);
console.log('swipe', JSON.stringify(sw));
console.log('free ', JSON.stringify(fr));
console.log('errs ', A.errs.slice(0,2), B.errs.slice(0,2));
console.log('\n' + (failed.length ? 'FAIL — ' + failed.join('; ') : 'SWIPE MODE OK'));
await browser.close(); srv.close();
process.exit(failed.length ? 1 : 0);
