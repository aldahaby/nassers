// CITYBREAKER — the rail tower and the evade, end to end.
//
// A tower in the city charges and fires a beam straight across the map at the altitude the player
// is flying at. It spans the whole width; there is nowhere to steer to. The only answer is to leave
// that altitude — swipe UP to climb over it, DOWN to dive under it, or tap EVADE and he picks.
//
// Everything here is driven through REAL TouchEvents, because every input bug that has shipped in
// this game lived in the gesture layer, not in the mechanics behind it.
//
//   1. one finger-down to finger-up is exactly one command, and it commits DURING the move
//   2. up climbs, down dives, and a mostly-horizontal gesture falls through to the drag control
//   3. the beam locks his altitude, so both answers are always open
//   4. ignoring it costs you; either evade saves you; the earliest and the last-instant press work
//   5. he never leaves the frame — no clipping through the floor on a low-ceilinged map
//
//   node scripts/evade.mjs
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

const open = async (map, scheme)=>{
  const pg = await browser.newPage({viewport:{width:412,height:892},deviceScaleFactor:1});
  const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
  await pg.addInitScript(([m,sc])=>{ try{ localStorage.setItem('invrun_char','forged');
    localStorage.setItem('invrun_map',m); localStorage.setItem('invrun_tut','1');
    localStorage.setItem('invrun_scheme', sc||'drag'); }catch(e){} }, [map, scheme]);
  await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
  await pg.waitForFunction('!!window.__game',{timeout:200000});
  await pg.waitForTimeout(1800);
  return {pg, errs};
};

// ---- 1-2. THE GESTURE -----------------------------------------------------------------------
const A = await open('nyc');
const ges = await A.pg.evaluate(()=>{
  const G=window.__game, P=G.player, I=G.input, SW=window.__cb.SW;
  G._clock.getDelta=()=>1/60; G.renderer.render=()=>{}; window.requestAnimationFrame=()=>0;
  G.ui.update=()=>{}; G.snapMenuBg=()=>{}; G.time.frozen=()=>false; G.time.update=rd=>rd;
  G.difficulty.update=()=>{}; G.impact.smash=()=>{}; G.run.toGameOver=()=>{};
  G.run.startRun();
  const step=n=>{ for(let i=0;i<n;i++){ G.momentum.value=G.momentum.MAX; G._loop(); } };
  let idc=1;
  const T=(x,y,id)=>new Touch({identifier:id,target:document.body,clientX:x,clientY:y});
  const ev=(type,t)=>dispatchEvent(new TouchEvent(type,{changedTouches:[t],
    touches:type==='touchend'?[]:[t],bubbles:true,cancelable:false}));
  const swipe=(dx,dy,samples=6,hold=8,target=null)=>{
    const id=idc++, x0=200, y0=500, el=target||document.body;
    const t0=new Touch({identifier:id,target:el,clientX:x0,clientY:y0});
    el.dispatchEvent(new TouchEvent('touchstart',{changedTouches:[t0],touches:[t0],bubbles:true,cancelable:false}));
    for(let i=1;i<=samples;i++){ const k=i/samples;
      const spin=performance.now()+hold; while(performance.now()<spin){}
      ev('touchmove', T(x0+dx*k, y0+dy*k, id)); }
    ev('touchend', T(x0+dx, y0+dy, id));
  };
  const clear=()=>{ I._evadeDir=0; P.evadeT=0; P.evadeDir=0; P.evade01=0; step(30); };
  const o={ cruise:P.cruiseY, rise:P.riseRoom(), drop:P.dropRoom() };

  clear(); G.cannon.reset(); G.cannon.nextZ=P.pos.z+90000;   // no beam: nothing holds the manoeuvre
  clear(); swipe(0,-90); step(3); o.upDir=P.evadeDir;
  clear(); swipe(0, 90); step(3); o.downDir=P.evadeDir;
  clear(); swipe(120,0); step(3); o.sidewaysDir=P.evadeDir;      // belongs to the drag control
  clear(); swipe(26,-70); step(3); o.diagUpDir=P.evadeDir;       // dominant axis wins
  clear(); swipe(0,-9,4,60); step(3); o.nudgeDir=P.evadeDir;     // under the threshold, slow
  clear(); { const id=idc++, x0=200,y0=500;
    const a=new Touch({identifier:id,target:document.body,clientX:x0,clientY:y0});
    dispatchEvent(new TouchEvent('touchstart',{changedTouches:[a],touches:[a],bubbles:true,cancelable:false}));
    ev('touchend', T(x0, y0-30, id)); }
  step(3); o.flickDir=P.evadeDir;                                // quick wrist, lifted early
  // ---- THE PREFIRE. Both controls read the SAME touch. A thumb steering left ARCS downward —
  // that is just what a thumb does — and the evade used to fire on its own from exactly this.
  const swipe2=(pts,hold=7)=>{                      // a path, not a straight line
    const id=idc++, x0=200, y0=500;
    const t0=new Touch({identifier:id,target:document.body,clientX:x0,clientY:y0});
    document.body.dispatchEvent(new TouchEvent('touchstart',{changedTouches:[t0],touches:[t0],bubbles:true,cancelable:false}));
    for(const [dx,dy] of pts){ const spin=performance.now()+hold; while(performance.now()<spin){}
      ev('touchmove', T(x0+dx, y0+dy, id)); }
    const l=pts[pts.length-1]; ev('touchend', T(x0+l[0], y0+l[1], id));
  };
  // steer left, then let the thumb sag: the classic false positive
  clear(); swipe2([[-30,2],[-70,10],[-110,26],[-140,52],[-160,78]]);
  step(3); o.arcDrag=P.evadeDir;
  // steer right and flick off the screen on the release
  clear(); swipe2([[40,0],[95,4],[150,10]],6);
  { const id=idc++, x=350, y=520;
    ev('touchend', T(x, y-34, id)); }
  step(3); o.dragLift=P.evadeDir;
  // a long horizontal hold that then goes vertical — still steering, still not a command
  clear(); swipe2([[-120,0],[-120,-20],[-120,-55],[-120,-95]]);
  step(3); o.dragThenUp=P.evadeDir;
  // but a clean vertical from a fresh touch still commits...
  clear(); swipe(0,-90); step(3); o.cleanUp=P.evadeDir;
  // ...and so does a real thumb's vertical swipe, which is never perfectly straight
  clear(); swipe2([[4,-16],[9,-34],[15,-56],[21,-78],[24,-96]]); step(3); o.wobblyUp=P.evadeDir;
  // and a gesture queued while the menu is up must be drained by the run, not spent as a command
  clear(); G.run.toMenu&&G.run.toMenu(); swipe(0,-100); G.run.startRun(); step(3);
  o.menuLeak=P.evadeDir; G.cannon.reset(); G.cannon.nextZ=P.pos.z+90000;

  clear(); swipe(0,-140,12,6); step(3); o.longDir=P.evadeDir; o.longQueued=I._evadeDir;
  clear(); swipe(0,-90,6,8, document.getElementById('btn-power')); step(3); o.onButtonDir=P.evadeDir;

  // it commits before the finger lifts
  clear();
  { const id=idc++, x0=200,y0=500;
    const a=new Touch({identifier:id,target:document.body,clientX:x0,clientY:y0});
    dispatchEvent(new TouchEvent('touchstart',{changedTouches:[a],touches:[a],bubbles:true,cancelable:false}));
    ev('touchmove', T(x0, y0-SW.swipePx-3, id));
    o.commitBeforeLift = I._evadeDir===1;
    ev('touchend', T(x0, y0-SW.swipePx-3, id)); }

  // ---- the shapes. A climb and a dive must be OPPOSITE, not one animation played twice.
  const partsOf=()=>{ let m=P.villainModel; while(m && !(m.userData&&m.userData.parts)) m=m.children[0];
                      return m?m.userData.parts:null; };
  const PT=partsOf();
  const peak=(dir)=>{ clear();
    const rest={a:PT.armL.rotation.x, l:PT.legL.rotation.x, h:PT.headG.rotation.x, t:PT.torso.rotation.x};
    P.evade(dir);
    let y=dir>0?-9e9:9e9, a=0,l=0,h=0,tt=0, roll=0;
    for(let i=0;i<80;i++){ step(1);
      y = dir>0 ? Math.max(y,P.pos.y) : Math.min(y,P.pos.y);
      const da=PT.armL.rotation.x-rest.a, dl=PT.legL.rotation.x-rest.l,
            dh=PT.headG.rotation.x-rest.h, dt2=PT.torso.rotation.x-rest.t;
      if(Math.abs(da)>Math.abs(a)) a=da;
      if(Math.abs(dl)>Math.abs(l)) l=dl;
      if(Math.abs(dh)>Math.abs(h)) h=dh;
      if(Math.abs(dt2)>Math.abs(tt)) tt=dt2;
      if(Math.abs(P.evRoll||0)>Math.abs(roll)) roll=P.evRoll||0; }
    return { y:+y.toFixed(2), arm:+a.toFixed(2), leg:+l.toFixed(2), head:+h.toFixed(2),
             torso:+tt.toFixed(2), rollDeg:Math.round(roll*57.3),
             endRollDeg:Math.round((P.evRoll||0)*57.3), back:+P.pos.y.toFixed(1) }; };
  o.up=peak(1); o.down=peak(-1);
  // the button with no direction picks a side and works
  clear(); document.getElementById('btn-evade').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
  step(20); o.buttonMoved=Math.abs(P.pos.y-P.cruiseY)>2; o.buttonDir=P.evadeDir;
  return o;
});
await A.pg.close();

// ---- 3-4. THE ENCOUNTER ---------------------------------------------------------------------
// evadeMode: 'never' | 'up' | 'down' | 'early' | 'late'
const runAt = async (speed, mode, map, scheme)=>{
  const {pg, errs} = await open(map||'nyc', scheme);
  const out = await pg.evaluate(([spd,mode])=>{
    const G=window.__game, P=G.player, SW=window.__cb.SW;
    G._clock.getDelta=()=>1/60; G.renderer.render=()=>{}; window.requestAnimationFrame=()=>0;
    G.ui.update=()=>{}; G.snapMenuBg=()=>{}; G.time.frozen=()=>false; G.time.update=rd=>rd;
    G.impact.smash=()=>{}; G.run.toGameOver=()=>{}; G.difficulty.baseSpeed=()=>spd;
    G.run.startRun();
    let hits=0; const oSlam=P.onGateSlam.bind(P); P.onGateSlam=()=>{ hits++; oSlam(); };
    const warnEl=document.getElementById('beam-warn'), evEl=document.getElementById('btn-evade');
    const vis=e=>e && !e.classList.contains('hidden');
    const enc=[]; let cur=null, last='idle';
    for(let i=0;i<60*230;i++){
      G.momentum.value=G.momentum.MAX; P.fwdNow=spd;
      G._loop();
      const C=G.cannon, st=C.state;
      if(C.parked && (!cur || cur.done))
        cur={ dParked:+(C.parked.z-P.pos.z).toFixed(0),
              sParked:+((C.parked.z-P.pos.z)/spd).toFixed(2), warnFrames:0, hits0:hits,
              minDist:9e9, hit:false, evaded:false, done:false, warnAtCharge:true,
              lockErr:0, clearedBy:0 };
      // NO DOUBLE-BIND. An armored gate needs a power; a beam needs an evade. If they ever land on
      // the same stretch of road you can lose without making a mistake.
      if((st==='charge'||st==='fire') && C.active){
        let near=0;
        for(const bl of G.city.buildings)
          if(bl && bl.gate && bl.mesh && bl.mesh.visible
             && Math.abs(bl.mesh.position.z-C.active.z) < SW.beamDepth+30) near++;
        if(cur) cur.gateNear=Math.max(cur.gateNear||0, near);
      }
      if(st==='charge' && cur){
        if(cur.lead===undefined){ cur.lead=+((C.active.z-P.pos.z)/spd).toFixed(2);
                                  cur.hits0=hits; cur.lockErr=+Math.abs(SW.beamY-P.pos.y).toFixed(2); }
        if(vis(warnEl)) cur.warnFrames++; else cur.warnAtCharge=false;
        cur.btnShown = vis(evEl);
        if(cur.bar===undefined){ cur.bar=SW.barOn;
          cur.barVis = SW.barOn>0 ? C.active.barT.visible : SW.barOn<0 ? C.active.barB.visible : true;
          cur.warnTxt=(warnEl.querySelector('span')||{}).textContent||'';
          cur.arrow=(document.getElementById('beam-arrow')||{}).textContent||''; }
        // CAN HE ACTUALLY SEE IT? `visible===true` proved nothing — the first barrier was a thin
        // slab out at the far edge of the corridor and the player simply never noticed it. Project
        // its box through the live camera and measure the share of the screen it covers.
        if(SW.barOn){
          const bg=SW.barOn>0?C.active.barT:C.active.barB, cam=G.camera.cam;
          // ⚠️ The renderer is stubbed in this harness, so NOTHING updates world matrices — every
          // projection would silently read an identity matrix and measure nothing. Force them.
          G.scene.updateMatrixWorld(true);
          cam.updateMatrixWorld(true); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
          const V3=cam.position.constructor;
          let x0=9,x1=-9,y0=9,y1=-9, anyFront=false;
          bg.traverse(o=>{
            if(!o.isMesh) return;
            if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
            const bb=o.geometry.boundingBox;
            for(let k=0;k<8;k++){
              const v=new V3(k&1?bb.max.x:bb.min.x, k&2?bb.max.y:bb.min.y, k&4?bb.max.z:bb.min.z);
              v.applyMatrix4(o.matrixWorld);
              const lv=v.clone().applyMatrix4(cam.matrixWorldInverse);
              if(lv.z>-0.5) continue;                  // behind the camera: not on screen
              v.project(cam); anyFront=true;
              x0=Math.min(x0,v.x); x1=Math.max(x1,v.x); y0=Math.min(y0,v.y); y1=Math.max(y1,v.y);
            }
          });
          if(anyFront && x1>x0){
            const w=Math.min(1,x1)-Math.max(-1,x0), h=Math.min(1,y1)-Math.max(-1,y0);
            if(w>0&&h>0) cur.barPct=Math.max(cur.barPct||0, +((w*h)/4*100).toFixed(1));
          }
        }
        if(mode==='early' && !cur.evaded) cur.evaded=P.evade(SW.barOn>0?-1:1);
        if((mode==='up'||mode==='down') && C.t>SW.chargeSec*0.7 && !cur.evaded){
          const want = mode==='up'?1:-1;
          cur.evaded = P.evade(want);
          if(!cur.evaded){ cur.refused=true; cur.evaded=P.evade(-want); }   // plated: take the other
        }
        // HUMAN: a real thumb, with a real reaction time. The warning appears, and somewhere
        // between a fifth of a second and most of the window later the swipe lands — sometimes on
        // the plated side first, which a person under pressure absolutely will do. If ANY of that
        // can kill you, the encounter is unfair.
        if(mode==='human' && !cur.evaded){
          if(cur._rt===undefined){ cur._rt=0.20+Math.random()*(SW.chargeSec-0.34);
                                   cur._slip=Math.random()<0.35; }
          if(C.t>=cur._rt){
            const safeD = SW.barOn ? -SW.barOn : (Math.random()<0.5?1:-1);
            if(cur._slip && SW.barOn){ cur._slip=false; if(P.evade(SW.barOn)) cur.blockFailed=true;
                                       cur.bounced=true; cur._rt=C.t+0.10; }
            else cur.evaded=P.evade(safeD);
          }
        }
        // SAFE always plays the side the game is telling you to. WRONG deliberately swipes into
        // the plate first, then corrects — the one thing that must never be a death.
        if(mode==='safe' && C.t>SW.chargeSec*0.55 && !cur.evaded)
          cur.evaded=P.evade(SW.barOn>0?-1:SW.barOn<0?1:(Math.random()<0.5?1:-1));
        if(mode==='wrong' && C.t>SW.chargeSec*0.50 && !cur.evaded){
          if(SW.barOn){ if(P.evade(SW.barOn)) cur.blockFailed=true; else cur.bounced=true;
                        cur.evaded=P.evade(-SW.barOn); }
          else cur.evaded=P.evade(1);
        }
        // the button, in stick mode, must always pick an OPEN side
        if(mode==='button' && C.t>SW.chargeSec*0.6 && !cur.evaded){
          cur.evaded=P.evade(0); cur.btnDir=P.evadeDir;
        }
      }
      // CAMERA. A hard-snapped follow teleported with him on an 11 m climb and threw the whole city
      // out of frame. Track the per-frame jump, and how much of the manoeuvre he keeps for himself.
      // NOTHING may put him inside a plate, through a roof, or under the deck — at ANY time,
      // not just while the beam is lit.
      if(cur){
        if(SW.barOn>0) cur.intoPlate=Math.max(cur.intoPlate||0, P.pos.y-(SW.beamY+SW.beamHalf+0.9));
        if(SW.barOn<0) cur.intoPlate=Math.max(cur.intoPlate||0, (SW.beamY-SW.beamHalf-0.9)-P.pos.y);
        cur.roofOver=Math.max(cur.roofOver||0, P.ceilY?(P.pos.y-(P.ceilY-1.0)):-9);
        cur.underDeck=Math.max(cur.underDeck||0, 1.0-P.pos.y);
      }
      // CAMERA. A hard-snapped follow teleported with him on an 11 m climb and threw the whole city
      // out of frame. Track the per-frame jump, and how much of the manoeuvre he keeps for himself.
      const camY=G.camera.cam.position.y;
      // and the camera's PITCH must not move: it is the pitch, not the height, that decides how
      // much sky and empty ground come into frame.
      { const cm=G.camera.cam; cm.updateMatrixWorld(true); const e=cm.matrixWorld.elements;
        const pitch=Math.asin(Math.max(-1,Math.min(1, e[9])));   // +Z row of the camera basis
        cur && (cur.pitchLo=Math.min(cur.pitchLo===undefined?pitch:cur.pitchLo,pitch),
                cur.pitchHi=Math.max(cur.pitchHi===undefined?pitch:cur.pitchHi,pitch),
                cur.pitchRange=+((cur.pitchHi-cur.pitchLo)*57.3).toFixed(2)); }
      if(cur){ if(cur._cy!==undefined) cur.camJump=Math.max(cur.camJump||0, Math.abs(camY-cur._cy));
               cur._cy=camY;
               // How far he travels IN FRAME: his height relative to the camera's, over the whole
               // encounter. Absolute distance is the wrong metric — a climb moves him toward the
               // camera, so |p-cam| shrinks even as he visibly rises up the screen.
               const rel=P.pos.y-camY;
               cur.relLo=Math.min(cur.relLo===undefined?rel:cur.relLo, rel);
               cur.relHi=Math.max(cur.relHi===undefined?rel:cur.relHi, rel);
               cur.sep=+(cur.relHi-cur.relLo).toFixed(1); }
      if(st==='fire' && cur){
        if(mode==='late' && !cur.evaded && Math.abs(P.pos.z-C.active.z)<SW.beamDepth)
          cur.evaded=P.evade(SW.barOn>0?-1:1);
        cur.minDist=Math.min(cur.minDist, Math.abs(P.pos.z-C.active.z));
        if(cur.dAtFire===undefined) cur.dAtFire=+(C.active.z-P.pos.z).toFixed(1);
        cur.clearedBy=Math.max(cur.clearedBy, Math.abs(P.pos.y-SW.beamY));
        cur.lowY=Math.min(cur.lowY===undefined?9e9:cur.lowY, P.pos.y);
        cur.hiY=Math.max(cur.hiY===undefined?-9e9:cur.hiY, P.pos.y);
      }
      if(last!=='idle' && st==='idle' && cur && !cur.done){
        cur.hit = hits>cur.hits0; cur.minDist=+cur.minDist.toFixed(1);
        cur.clearedBy=+cur.clearedBy.toFixed(1); cur.done=true; enc.push(cur);
      }
      last=st;
    }
    // GEOMETRY. The spire must straddle the road dead ahead, not be parked off to one side, and
    // its opening must be wider than the box the player is clamped inside.
    const anyC=G.cannon.list.find(c=>c.live) || G.cannon.list[0];
    const geo={ offAxis:+Math.abs(anyC.grp.position.x - G.city._pathX(anyC.z)).toFixed(1),
                leg:anyC.LEG, gunOnLeg:+Math.abs(Math.abs(anyC.gun.position.x)-anyC.LEG).toFixed(2),
                clearW:+(anyC.LEG-9.6).toFixed(1), xBox:window.__cb.PLAY.xBox,
                hasEye:!!anyC.eye, hasAim:!!anyC.aim };
    return { spd, mode, n:enc.length,
             hitN:enc.filter(e=>e.hit).length,
             badN:enc.filter(e=>e.blockFailed || e.intoPlate>0.15 || e.roofOver>0
                                || e.underDeck>0 || e.gateNear>0 || e.pitchRange>1.2).length,
             enc:enc.slice(0,6), geo,
             chargeSec:SW.chargeSec, fireLead:SW.fireLead, beamHalf:SW.beamHalf };
  }, [speed, mode]);
  await pg.close();
  return {out, errs};
};
const N46=await runAt(46,'never'),  U46=await runAt(46,'up'),   D46=await runAt(46,'down');
const N95=await runAt(95,'never'),  U95=await runAt(95,'up');
const E46=await runAt(46,'early'),  L46=await runAt(46,'late'), L95=await runAt(95,'late');
// the PLATE: play the side you are told to, then deliberately play the wrong one and correct.
const S46=await runAt(46,'safe'),   S95=await runAt(95,'safe');
const W46=await runAt(46,'wrong'),  W95=await runAt(95,'wrong');
// the same, on the two maps with a ceiling or a floor tight enough to remove an answer
const SBR=await runAt(52,'safe','backrooms'), SMT=await runAt(52,'safe','metro');
const WBR=await runAt(52,'wrong','backrooms');
// and the button, which only exists on the stick
const BST=await runAt(46,'button','nyc','stick');
// ---- THE SOAK. A real thumb, a real reaction time, sometimes the wrong way first — on every map,
// slow and fast. Hundreds of encounters, and not one of them may kill a player who answered.
const HUM=[];
for(const map of ['nyc','metro','backrooms','aero'])
  for(const spd of [42, 78, 108])
    HUM.push([map, spd, await runAt(spd,'human',map)]);
const humTot=HUM.reduce((a,[,,R])=>a+R.out.n,0);
const humHit=HUM.reduce((a,[,,R])=>a+R.out.hitN,0);
const humBad=HUM.filter(([,,R])=>R.out.hitN>0 || R.out.badN>0).map(([m,sp,R])=>`${m}@${sp}:${R.out.hitN}/${R.out.badN}`);

// ---- 5. EVERY MAP ---------------------------------------------------------------------------
const heights = {};
for(const map of ['nyc','metro','backrooms','aero']){
  const {pg, errs} = await open(map);
  heights[map] = await pg.evaluate(()=>{
    const G=window.__game, P=G.player;
    G._clock.getDelta=()=>1/60; G.renderer.render=()=>{}; window.requestAnimationFrame=()=>0;
    G.ui.update=()=>{}; G.snapMenuBg=()=>{}; G.time.frozen=()=>false; G.time.update=rd=>rd;
    G.impact.smash=()=>{}; G.run.toGameOver=()=>{};
    G.run.startRun();
    const step=n=>{ for(let i=0;i<n;i++){ G.momentum.value=G.momentum.MAX; G._loop(); } };
    step(40); G.cannon.reset(); G.cannon.nextZ=P.pos.z+90000;
    const go=(d)=>{ P.evadeT=0; P.evade01=0; step(20); P.evade(d);
      let m=d>0?-9e9:9e9; for(let i=0;i<80;i++){ step(1); m=d>0?Math.max(m,P.pos.y):Math.min(m,P.pos.y); }
      return {peak:+m.toFixed(2), back:+P.pos.y.toFixed(1)}; };
    return { cruise:P.cruiseY, up:go(1), down:go(-1) };
  });
  await pg.close();
  if(errs.length) A.errs.push(map+': '+errs[0]);
}
const everyMap=f=>Object.values(heights).every(f);
const ok=(R,f)=> R.out.enc.length>0 && R.out.enc.every(f);
const every2=(Rs,f)=> Rs.every(R=>ok(R,f));

const ALL=[N46,U46,D46,N95,U95,E46,L46,L95,S46,S95,W46,W95,SBR,SMT,WBR,BST];
const every=(f)=>ALL.every(R=>R.out.enc.length===0 || R.out.enc.every(f));

const checks=[
  // ---- THE PLATE ------------------------------------------------------------------------------
  // Play the side you are told to and you live. Every time, at both speeds, on every map.
  // ---- THE SOAK: hundreds of encounters, a human thumb, every map, every speed --------------
  ['a human thumb is never killed',         humHit===0 && humBad.length===0],
  ['and the soak actually ran',             humTot>=150],
  ['obeying the plate always saves',        ok(S46,e=>!e.hit) && ok(S95,e=>!e.hit)
                                         && ok(SBR,e=>!e.hit) && ok(SMT,e=>!e.hit)],
  // Swipe INTO the plate and it is refused, not spent — correcting still saves you.
  ['a plated swipe is refused, not spent',  ok(W46,e=>!e.blockFailed) && ok(W95,e=>!e.blockFailed)
                                         && ok(WBR,e=>!e.blockFailed)],
  ['and correcting after it still saves',   ok(W46,e=>!e.hit) && ok(W95,e=>!e.hit) && ok(WBR,e=>!e.hit)],
  ['the plate is up for the whole warning', every(e=>e.barVis!==false)],
  ['and it is big on screen, not a hairline',
        [S46,S95,W46,SBR,SMT,WBR].every(R=>R.out.enc.filter(e=>e.bar).every(e=>e.barPct>=6))],
  ['a HUD arrow names the way out',        [S46,SBR,BST].every(R=>R.out.enc.filter(e=>e.bar)
        .every(e=>e.arrow===(e.bar>0?'\u25bc':'\u25b2')))],
  ['the warning names the side to take',    ok(S46,e=>!e.bar || /UP|DOWN/.test(e.warnTxt||''))],
  ['it plates at most one side',            every(e=>e.bar===0||e.bar===1||e.bar===-1)],
  // Backrooms' deck is 2m under the cruise line: a dive there cannot clear the beam, so the game
  // must never offer one. This is the exact shape of an unfair death.
  ['a map with no room below never asks for a dive',
                                            ok(SBR,e=>e.bar===-1) && ok(WBR,e=>e.bar===-1)],
  // ---- NOTHING MAY PUT HIM SOMEWHERE ILLEGAL ---------------------------------------------------
  ['no beam ever fires over a gate',        every(e=>!(e.gateNear>0))],
  ['he never gets inside a plate',          every(e=>!(e.intoPlate>0.15))],
  ['he never goes through a roof',          every(e=>!(e.roofOver>0))],
  ['he never goes under the deck',          every(e=>!(e.underDeck>0))],
  // ---- THE CAMERA CANNOT LOOK OUT OF THE MAP ---------------------------------------------------
  // It is the PITCH that decides how much sky and empty ground come into frame. Holding it fixed
  // is what makes "you cannot see out of the map" true by construction rather than by tuning.
  ['the camera pitch never moves',          every(e=>!(e.pitchRange>1.2))],
  // ---- THE BUTTON ------------------------------------------------------------------------------
  ['no EVADE button on drag',               every2([N46,U46,S46,W46], e=>e.btnShown===false)],
  ['the EVADE button is there on stick',    ok(BST,e=>e.btnShown===true)],
  ['and it always picks an open side',      ok(BST,e=>!e.bar || e.btnDir===-e.bar)],
  ['tapping it saves you',                  ok(BST,e=>!e.hit)],

  // the camera must GLIDE, and he must visibly leave it behind — this is the whole animation
  ['the camera never teleports',            ok(U46,e=>e.camJump<3.2) && ok(U95,e=>e.camJump<3.6)],
  ['he visibly moves inside the frame',     ok(U46,e=>e.sep>3.6) && ok(D46,e=>e.sep>3.2)],
  // the spire straddles the road ahead, and the opening clears the player's own x-box
  ['the spire is dead ahead, not aside',    U46.out.geo.offAxis<0.5],
  ['the gun sits on one of its legs',       U46.out.geo.gunOnLeg<0.01],
  ['the opening clears the player box',     U46.out.geo.clearW > U46.out.geo.xBox],
  ['it has a face and an aim line',         U46.out.geo.hasEye && U46.out.geo.hasAim],

  ['swipe UP asks for a climb',             ges.upDir===1],
  ['swipe DOWN asks for a dive',            ges.downDir===-1],
  ['a sideways gesture is not an evade',    ges.sidewaysDir===0],
  // ---- THE PREFIRE ---------------------------------------------------------------------------
  ['a steering drag that arcs is not a swipe',   ges.arcDrag===0],
  ['nor is the flick off the end of one',        ges.dragLift===0],
  ['nor a steer that then goes vertical',        ges.dragThenUp===0],
  ['but a clean vertical still commits',         ges.cleanUp===1],
  ['and so does a wobbly real-thumb one',        ges.wobblyUp===1],
  ['a gesture made on a menu never fires',       ges.menuLeak===0],
  ['a diagonal picks the dominant axis',    ges.diagUpDir===1],
  ['a slow nudge does nothing',             ges.nudgeDir===0],
  ['a quick wrist counts on velocity',      ges.flickDir===1],
  ['a long drag is still ONE command',      ges.longDir===1 && ges.longQueued===0],
  ['a gesture on a button is ignored',      ges.onButtonDir===0],
  ['it commits before the finger lifts',    ges.commitBeforeLift],
  ['the EVADE button picks a side',         ges.buttonMoved && ges.buttonDir!==0],
  ['a climb goes UP, a dive goes DOWN',     ges.up.y>ges.cruise+ges.rise*0.85
                                         && ges.down.y<ges.cruise-ges.drop*0.85],
  ['both come back to the flight line',     Math.abs(ges.up.back-ges.cruise)<0.6
                                         && Math.abs(ges.down.back-ges.cruise)<0.6],
  ['they are OPPOSITE shapes, not one',     Math.sign(ges.up.arm)!==Math.sign(ges.down.arm)
                                         && Math.sign(ges.up.leg)!==Math.sign(ges.down.leg)
                                         && Math.sign(ges.up.head)!==Math.sign(ges.down.head)
                                         && Math.sign(ges.up.torso)!==Math.sign(ges.down.torso)],
  // He BANKS. A full 360 barrel roll reads as a log rolling downhill and looks identical whichever
  // way he went; a break onto one shoulder that comes back level is what evasion actually is.
  ['he banks hard, but never wraps',        Math.abs(ges.up.rollDeg)>50 && Math.abs(ges.up.rollDeg)<130
                                         && Math.abs(ges.down.rollDeg)>50 && Math.abs(ges.down.rollDeg)<130],
  ['the two banks are opposite',            Math.sign(ges.up.rollDeg)!==Math.sign(ges.down.rollDeg)],
  ['and he ends level',                     Math.abs(ges.up.endRollDeg)<12 && Math.abs(ges.down.endRollDeg)<12],

  ['encounters happen',                     N46.out.n>=3 && N95.out.n>=3],
  // it must be on screen and idle for a beat BEFORE it starts charging, at ANY speed — the gap is
  // metres, and the player eats most of it during the previous encounter.
  ['parked far out and visible first',      ok(N46,e=>e.dParked>=300) && ok(N95,e=>e.dParked>=300)],
  ['and idle on screen before charging',    ok(N46,e=>e.sParked>=N46.out.chargeSec+N46.out.fireLead+1.2)
                                         && ok(N95,e=>e.sParked>=N95.out.chargeSec+N95.out.fireLead+1.2)],
  ['the warning is the same at any speed',  ok(N46,e=>Math.abs(e.lead-N46.out.chargeSec-N46.out.fireLead)<0.35)
                                         && ok(N95,e=>Math.abs(e.lead-N95.out.chargeSec-N95.out.fireLead)<0.35)],
  ['it locks his altitude',                 ok(N46,e=>e.lockErr<0.01)],
  ['the beam is up before he arrives',      ok(N46,e=>e.dAtFire>2) && ok(N95,e=>e.dAtFire>6)],
  ['warning + EVADE for the whole charge',  ok(N46,e=>e.warnAtCharge && e.warnFrames>40)],
  ['ignoring it costs you, every time',     ok(N46,e=>e.hit) && ok(N95,e=>e.hit)],
  ['climbing over it saves you',            ok(U46,e=>!e.hit) && ok(U95,e=>!e.hit)],
  ['diving under it saves you',             ok(D46,e=>!e.hit)],
  ['and it really clears the band',         ok(U46,e=>e.clearedBy>U46.out.beamHalf)
                                         && ok(D46,e=>e.clearedBy>D46.out.beamHalf)],
  ['the earliest possible press works',     ok(E46,e=>e.evaded && !e.hit)],
  ['the last-instant press works',          ok(L46,e=>e.evaded && !e.hit) && ok(L95,e=>e.evaded && !e.hit)],

  ['no map dives through the floor',        everyMap(h=>h.down.peak>=1.9)],
  ['every map can climb',                   everyMap(h=>h.up.peak>h.cruise+6)],
  ['and every map returns to cruise',       everyMap(h=>Math.abs(h.up.back-h.cruise)<0.6
                                                     && Math.abs(h.down.back-h.cruise)<0.6)],
  ['no page errors', [A,N46,U46,D46,N95,U95,E46,L46,L95].every(r=>(r.errs||[]).length===0)],
];
const bad=checks.filter(c=>!c[1]).map(c=>c[0]);
console.log('gesture', JSON.stringify(ges));
console.log('heights', JSON.stringify(heights));
console.log('geo    ', JSON.stringify(U46.out.geo));
console.log('soak   ', humTot+' encounters, '+humHit+' hits, '+humBad.length+' illegal',
            humBad.length?JSON.stringify(humBad):'',
            JSON.stringify(HUM.map(([m,sp,R])=>m[0]+sp+':'+R.out.n)));
for(const [n,R] of [['safe46',S46],['wrong46',W46],['safeBR',SBR],['safeMT',SMT],['button',BST]])
  console.log(n.padEnd(9), 'n='+R.out.enc.length, 'tot='+R.out.n, 'err='+(R.errs[0]||'-').slice(0,60),
    JSON.stringify(R.out.enc.slice(0,2).map(e=>({bar:e.bar,hit:e.hit,ev:e.evaded,
      bnc:!!e.bounced,pct:e.barPct,arw:e.arrow,pit:e.pitchRange,btn:e.btnShown,
      clr:e.clearedBy,txt:(e.warnTxt||'').slice(0,18)}))));
for(const [n,R] of [['46 ignore',N46],['46 up',U46],['46 down',D46],['95 ignore',N95],
                    ['95 up',U95],['46 early',E46],['46 late',L46],['95 late',L95]])
  console.log(n.padEnd(10),'n='+R.out.n, JSON.stringify(R.out.enc.slice(0,2)
    .map(e=>({lead:e.lead,d:e.minDist,clr:e.clearedBy,hit:e.hit,ev:e.evaded}))));
console.log('\n' + (bad.length ? 'FAIL — ' + bad.join('; ') : 'EVADE OK'));
await browser.close(); srv.close();
process.exit(bad.length?1:0);
