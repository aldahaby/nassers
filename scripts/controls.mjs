// CITYBREAKER — control schemes and blast radius.
//
// CONTROLS. Two schemes share one steering channel:
//
//   'stick' — the on-screen joystick. #joy-base visible, drag input ignored.
//   'drag'  — put a finger anywhere on the playfield and the villain follows it. #joy-base gone,
//             joystick input ignored, and the anchor is RELATIVE to where the finger landed so
//             the villain never teleports to the touch point.
//
// The setting is persisted, and the two must not bleed into each other: whichever scheme is off
// contributes nothing to sample(), or a stale joystick value keeps steering forever.
//
// BLAST RADIUS. A power takes the armored gate and exactly ONE tower behind it — two made a
// single shot clear half a street and the run stopped being about flying.
//
//   node scripts/controls.mjs
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

const pg = await browser.newPage({viewport:{width:412,height:892},deviceScaleFactor:1});
const errs = []; pg.on('pageerror', e=>errs.push(e.message));
await pg.addInitScript(()=>{ try{ localStorage.setItem('invrun_char','dominus');
  localStorage.setItem('invrun_map','nyc'); localStorage.removeItem('invrun_scheme'); }catch(e){} });
await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
await pg.waitForFunction('!!window.__game',{timeout:200000});
await pg.waitForTimeout(2000);

// ---- controls -----------------------------------------------------------------------------
const ctl = await pg.evaluate(()=>{
  const G = window.__game, I = G.input, base = document.getElementById('joy-base');
  const btn = document.getElementById('scheme-btn');
  const vis = ()=> base.style.display !== 'none';
  const o = {};

  o.defaultScheme = I.scheme;                 // fresh install = joystick, the familiar one
  o.stickShowsBase = vis();
  o.btnSaysJoystick = btn.textContent.trim();

  // tapping the row flips it, persists it, and hides the stick without leaving Settings
  btn.onclick();
  o.afterTap = I.scheme;
  o.dragHidesBase = !vis();
  o.btnSaysDrag = btn.textContent.trim();
  o.persisted = localStorage.getItem('invrun_scheme');
  btn.onclick();                              // back to stick; the drag checks re-enter below

  // in DRAG, the joystick channel must be ignored entirely
  btn.onclick();                              // -> drag
  I.joy = 1; I.steer.x = 0; I.sample();
  o.dragIgnoresJoy = Math.abs(I.steer.x) < 1e-6;

  // and back in STICK, a leftover drag value must not keep steering
  btn.onclick();
  o.backToStick = I.scheme;
  I.joy = 0; I.drag = 1; I.steer.x = 0; I.sample();
  o.stickIgnoresDrag = Math.abs(I.steer.x) < 1e-6;
  I.joy = 0.6; I.drag = 0; I.steer.x = 0; I.sample();
  o.stickSteers = I.steer.x > 0.4;

  // flipping schemes must zero the live input, never leave the villain drifting
  I.joy = 1; I.dragPx = 99; I.setScheme('drag');
  o.flushOnSwitch = I.joy===0 && I.dragPx===0 && I._dragId===null;
  I.setScheme('stick');
  return o;
});

// DRAG is a POSITION control, and these are the properties that make it feel like a finger and
// not like ice:
//   - landing a finger does not move him
//   - he tracks the finger, roughly 1:1 through dragWorldPerPx
//   - holding the finger STILL stops him dead (the old version kept sliding)
//   - lifting the finger leaves him exactly where he is (recentring would ruin every power tap)
//   - the next touch re-anchors from there instead of jumping back
//   - a flick across the whole glass cannot push him outside the playfield
const drag = await pg.evaluate(async ()=>{
  const G = window.__game, I = G.input, P = G.player, XBOX = window.__cb.PLAY.xBox;
  G._clock.getDelta = ()=>1/60;
  G.renderer.render = ()=>{}; window.requestAnimationFrame = ()=>0;
  G.ui.update = ()=>{}; G.snapMenuBg = ()=>{};
  G.time.frozen = ()=>false; G.time.update = (rd)=>rd;
  I.setScheme('drag'); I.moveSens = 1;
  // Nobody is steering here, so he flies blind into gate after gate. Each slam bleeds momentum and
  // speed, and a death re-anchors the whole control — either would make a position reading
  // meaningless. This measurement is about the control, not about survival, so the collision
  // resolution is stubbed out and the run is asserted to have stayed alive.
  let deaths = 0, smashes = 0;
  const oGO=G.run.toGameOver.bind(G.run), oSm=G.impact.smash.bind(G.impact),
        oDiff=G.difficulty.update.bind(G.difficulty);
  G.run.toGameOver = ()=>{ deaths++; };
  G.impact.smash = ()=>{ smashes++; };
  // _pathX scales the road's lateral swing by difficulty.level, so as a run progresses the SAME z
  // maps to a different road centre. A villain holding his world position therefore drifts
  // relative to the road through no fault of the control. Freeze the difficulty so the road is a
  // pure function of z and what is left to measure is the control alone.
  G.difficulty.update = ()=>{};
  G.run.startRun();
  // Momentum is the health bar and it drains unless you are smashing things, which he is not
  // doing here. Hold it full so the run cannot time out under the measurement.
  const step=(n)=>{ for(let i=0;i<n;i++){ G.momentum.value=G.momentum.MAX; G._loop(); } };
  const rc =()=> G.city._pathX(P.pos.z);
  const off=()=> P.pos.x - rc();
  const fire=(type,x)=>{ const t=new Touch({identifier:7,target:document.body,clientX:x,clientY:600});
    dispatchEvent(new TouchEvent(type,{changedTouches:[t],touches:type==='touchend'?[]:[t],
      bubbles:true,cancelable:false})); };

  step(30);
  const start=off();
  fire('touchstart', 340);                    // land far to the RIGHT of centre
  step(12);
  const onLand=off()-start;                   // relative anchoring: landing must not move him

  const PX=-90;                               // sweep left, short of the playfield edge
  fire('touchmove', 340+PX);
  step(60);
  const moved=off()-start;
  const wantMoved=-PX*I.dragWorldPerPx();   // screen-left is world +X: the camera looks down +Z

  const held=off(); step(60);
  const drift=off()-held;                     // finger still => he must be still

  fire('touchend', 340+PX);
  step(60);
  const afterLift=off()-held;                 // lifting must not recentre him
  // ...and whatever residual there is must be a fixed lag, not a creep. The target is anchored to
  // the road centre one frame behind where it is sampled, so on a curving road there is a constant
  // sub-centimetre offset; four times the wait must not give four times the number.
  const lift1=off(); step(240);
  const creep=Math.abs(off()-lift1);

  const before2=off();
  fire('touchstart', 100); step(6);
  const reanchor=off()-before2;               // a new touch must not jump him
  fire('touchend', 100);

  // THE ONE THAT CANNOT BE WRONG: where he is ON SCREEN. World +X is screen LEFT under this
  // camera, so a world-space assertion happily passes on an inverted control — which is exactly
  // how drag shipped backwards. Project him and check the pixels.
  // The chase camera tracks his x, so once he settles he is back near the middle of the frame —
  // read the TRANSIENT, a few frames in, while the camera is still catching up. The sign is the
  // whole assertion; the magnitude only has to clear the noise.
  const scr=()=>{ const c=G.camera.cam;
                  const v=new (P.pos.constructor)(P.pos.x,P.pos.y,P.pos.z);
                  v.project(c); return v.x; };
  fire('touchstart', 200); step(30);
  const sx0=scr();
  fire('touchmove', 200+170); step(10);            // finger to the RIGHT
  const sRight=scr()-sx0;
  fire('touchmove', 200-170); step(20);            // finger back to the LEFT, past the start
  const sLeft=scr()-sx0;
  fire('touchend', 30); step(4);

  // a flick the full width of the glass, twice over — he must stop at the edge
  fire('touchstart', 20); fire('touchmove', 20+4000); step(90);
  const flung=off(); fire('touchend', 4020);
  I.setScheme('stick');
  G.run.toGameOver=oGO; G.impact.smash=oSm; G.difficulty.update=oDiff;   // the blast pass needs all three
  return { onLand:+onLand.toFixed(3), moved:+moved.toFixed(2), wantMoved:+wantMoved.toFixed(2),
           drift:+drift.toFixed(3), afterLift:+afterLift.toFixed(3), reanchor:+reanchor.toFixed(3),
           creep:+creep.toFixed(3), flung:+flung.toFixed(2), xbox:XBOX, deaths, smashes, sRight:+sRight.toFixed(3), sLeft:+sLeft.toFixed(3) };
});

// ---- blast radius -------------------------------------------------------------------------
const blast = await pg.evaluate(()=>{
  const G = window.__game, PWR = window.__cb.PWR;
  G._clock.getDelta = ()=>1/60;
  G.renderer.render = ()=>{};                   // MUST stub: live renders lock the page
  window.requestAnimationFrame = ()=>0;
  G.ui.update = ()=>{}; G.snapMenuBg = ()=>{};
  G.time.frozen = ()=>false; G.time.update = (rd)=>rd;

  const shots = [];
  const oFire = G.powers.fire.bind(G.powers);
  G.powers.fire = function(){
    const tgt = G.powers.target();
    const before = G.city.buildings.filter(b=>!b.hit).map(b=>b);
    const gid = tgt ? tgt.gid : null;
    const r = oFire();
    if(!r) return r;
    const killed = before.filter(b=>b.hit);
    shots.push({ total:killed.length,
                 gates:killed.filter(b=>b.gid===gid).length,
                 extra:killed.filter(b=>b.gid!==gid).length });
    return r;
  };

  // a competent pilot, so runs last and gates keep arriving
  G.input.sample = function(){
    const P = G.player; let best=null, bz=1e9;
    for(const t of G.city.buildings){ if(t.hit||t.decor) continue;
      const z = t.mesh.position.z; if(z>P.pos.z+1 && z<bz){ bz=z; best=t; } }
    if(!best){ this.steer.x=0; return; }
    this.steer.x = -Math.max(-1,Math.min(1,(best.mesh.position.x-P.pos.x)/1.2));
  };
  G.run.startRun();
  for(let i=0;i<60*180;i++){
    G._loop();
    if(i%4===0 && G.powers.target()) G.powers.press();
    if(G.run.state==='GameOver') G.run.startRun();
  }
  return { cfg:{blastAfter:PWR.blastAfter, blastRange:PWR.blastRange},
           shots:shots.length,
           extras:[...new Set(shots.map(s=>s.extra))].sort(),
           maxExtra:Math.max(0,...shots.map(s=>s.extra)) };
});

const checks = [
  ['fresh install defaults to the joystick', ctl.defaultScheme==='stick'],
  ['joystick scheme shows #joy-base',        ctl.stickShowsBase],
  ['Settings row reads JOYSTICK',            ctl.btnSaysJoystick==='JOYSTICK'],
  ['tapping the row selects drag',           ctl.afterTap==='drag'],
  ['Settings row reads DRAG',                ctl.btnSaysDrag==='DRAG'],
  ['drag scheme hides #joy-base',            ctl.dragHidesBase],
  ['the choice is persisted',                ctl.persisted==='drag'],
  ['drag ignores the joystick channel',      ctl.dragIgnoresJoy],
  ['tapping again returns to joystick',      ctl.backToStick==='stick'],
  ['joystick ignores a stale drag value',    ctl.stickIgnoresDrag],
  ['joystick actually steers',               ctl.stickSteers],
  ['switching schemes flushes live input',   ctl.flushOnSwitch],
  ['a finger landing does not move him',     Math.abs(drag.onLand)<0.08],
  ['he tracks the finger about 1:1',         Math.abs(drag.moved-drag.wantMoved)<1.2],
  ['holding the finger still stops him',     Math.abs(drag.drift)<0.05],
  ['lifting the finger does not recentre',   Math.abs(drag.afterLift)<0.03],
  ['the hold is a fixed lag, not a creep',   drag.creep < 0.03],
  ['a new touch re-anchors, never jumps',    Math.abs(drag.reanchor)<0.08],
  ['finger right moves him right ON SCREEN', drag.sRight >  0.02],
  ['finger left moves him left ON SCREEN',   drag.sLeft  < -0.02],
  ['a flick cannot leave the playfield',     Math.abs(drag.flung)<=drag.xbox+0.01],
  ['the run never ended mid-measurement',    drag.deaths===0],
  ['powers actually fired',                  blast.shots > 20],
  // never MORE than one. 0 is legitimate — sometimes nothing has spawned yet inside blastRange.
  ['a shot never takes a 2nd extra tower',   blast.extras.every(e=>e<=1)],
  ['the follow-through does happen',         blast.maxExtra===1],
  ['no page errors',                         errs.length===0],
];
const failed = checks.filter(c=>!c[1]).map(c=>c[0]);
console.log('controls', JSON.stringify(ctl));
console.log('drag    ', JSON.stringify(drag));
console.log('blast   ', JSON.stringify(blast));
console.log('errs    ', errs.slice(0,3));
console.log('\n' + (failed.length ? 'FAIL — ' + failed.join('; ') : 'CONTROLS + BLAST RADIUS OK'));
await browser.close(); srv.close();
process.exit(failed.length ? 1 : 0);
