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

  // in DRAG, the joystick channel must be ignored entirely
  I.joy = 1; I.drag = 0; I.steer.x = 0; I.sample();
  o.dragIgnoresJoy = Math.abs(I.steer.x) < 1e-6;
  I.joy = 0; I.drag = -0.7; I.steer.x = 0; I.sample();
  o.dragSteers = I.steer.x < -0.5;

  // and back in STICK, a leftover drag value must not keep steering
  btn.onclick();
  o.backToStick = I.scheme;
  I.joy = 0; I.drag = 1; I.steer.x = 0; I.sample();
  o.stickIgnoresDrag = Math.abs(I.steer.x) < 1e-6;
  I.joy = 0.6; I.drag = 0; I.steer.x = 0; I.sample();
  o.stickSteers = I.steer.x > 0.4;

  // flipping schemes must zero the live input, never leave the villain drifting
  I.joy = 1; I.drag = 1; I.setScheme('drag');
  o.flushOnSwitch = I.joy===0 && I.drag===0 && I._dragId===null;
  I.setScheme('stick');
  return o;
});

// a real finger drag on the playfield steers, and it is RELATIVE — the villain does not jump to
// wherever the finger landed
const drag = await pg.evaluate(async ()=>{
  const G = window.__game, I = G.input;
  I.setScheme('drag'); I.moveSens = 1;
  const fire=(type,x)=>{ const t=new Touch({identifier:7,target:document.body,clientX:x,clientY:600});
    dispatchEvent(new TouchEvent(type,{changedTouches:[t],touches:type==='touchend'?[]:[t],
      bubbles:true,cancelable:false})); };
  fire('touchstart', 340);                    // land far to the RIGHT of centre
  const onLand = I.drag;                      // must still be 0 — relative, not absolute
  fire('touchmove', 340 - 200);               // sweep left
  const afterLeft = I.drag;
  fire('touchend', 140);
  const onRelease = I.drag;
  I.setScheme('stick');
  return { onLand, afterLeft, onRelease };
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
  ['drag actually steers',                   ctl.dragSteers],
  ['tapping again returns to joystick',      ctl.backToStick==='stick'],
  ['joystick ignores a stale drag value',    ctl.stickIgnoresDrag],
  ['joystick actually steers',               ctl.stickSteers],
  ['switching schemes flushes live input',   ctl.flushOnSwitch],
  ['a finger landing does not jerk the run', Math.abs(drag.onLand)<1e-6],
  ['sweeping left steers left',              drag.afterLeft < -0.4],
  ['lifting the finger centres the villain', drag.onRelease===0],
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
