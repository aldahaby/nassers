// CITYBREAKER — swipe feel, driven by REAL gestures.
//
// swipe-mode.mjs checks the mechanics by poking `laneSteps` directly. That proves the geometry and
// misses every bug that has actually shipped, because all of them were in the GESTURE layer:
// inverted axis, decided on the wrong event, one drag firing a stream of steps. So this suite
// dispatches genuine TouchEvents and measures what the villain does.
//
// The contract, which is the one every lane runner uses:
//
//   * one finger-down to finger-up is EXACTLY ONE command, whatever happens in between
//   * the command commits the instant the threshold is crossed, not on release
//   * a quick wrist that lifts early still counts, on velocity
//   * the axis is whichever displacement is larger, so a diagonal still does what you meant
//   * DOWN is evade; UP is nothing
//   * anything starting on a button is not a swipe
//
//   node scripts/swipe-feel.mjs
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
const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
await pg.addInitScript(()=>{ try{ localStorage.setItem('invrun_char','forged');
  localStorage.setItem('invrun_map','nyc'); localStorage.setItem('invrun_mode','swipe');
  localStorage.setItem('invrun_tut','1'); }catch(e){} });
await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
await pg.waitForFunction('!!window.__game',{timeout:200000});
await pg.waitForTimeout(2000);

const r = await pg.evaluate(()=>{
  const G=window.__game, P=G.player, I=G.input, SW=window.__cb.SW;
  G._clock.getDelta=()=>1/60; G.renderer.render=()=>{}; window.requestAnimationFrame=()=>0;
  G.ui.update=()=>{}; G.snapMenuBg=()=>{}; G.time.frozen=()=>false; G.time.update=rd=>rd;
  G.difficulty.update=()=>{};                 // keep the road a pure function of z
  G.impact.smash=()=>{}; G.run.toGameOver=()=>{};
  G.run.startRun();
  const step=n=>{ for(let i=0;i<n;i++){ G.momentum.value=G.momentum.MAX; G._loop(); } };

  // --- a real gesture, dispatched as real events, with real time between the samples -----------
  let idc=1;
  const T=(x,y,id)=>new Touch({identifier:id,target:document.body,clientX:x,clientY:y});
  const ev=(type,t)=>dispatchEvent(new TouchEvent(type,{
    changedTouches:[t], touches:type==='touchend'?[]:[t], bubbles:true, cancelable:false}));
  // `hold` is wall-clock milliseconds to burn between samples, so the velocity path sees real dt
  const swipe=(dx,dy,samples=6,hold=8,target=null)=>{
    const id=idc++, x0=200, y0=520;
    const el=target||document.body;
    const t0=new Touch({identifier:id,target:el,clientX:x0,clientY:y0});
    // dispatch ON the element, so e.target is what a real browser reports and the control guard
    // is actually exercised
    el.dispatchEvent(new TouchEvent('touchstart',{changedTouches:[t0],touches:[t0],bubbles:true,cancelable:false}));
    for(let i=1;i<=samples;i++){
      const k=i/samples;
      const spin=performance.now()+hold; while(performance.now()<spin){}
      ev('touchmove', T(x0+dx*k, y0+dy*k, id));
    }
    ev('touchend', T(x0+dx, y0+dy, id));
  };
  const lane=()=>P.lane|0;
  const reset=()=>{ I.laneSteps=0; I._evade=false; P.lane=0; P.duckT=0; P.duck=0; step(30); };

  const o={ laneX:SW.laneX, swipePx:SW.swipePx };

  // 1. ONE swipe is ONE lane, and a LONG drag is still one lane
  reset(); swipe(90,0);           step(2); o.shortRight=lane();
  reset(); swipe(340,0,14,6);     step(2); o.longRight=lane();
  reset(); swipe(-340,0,14,6);    step(2); o.longLeft=lane();

  // 2. two separate swipes are two lanes
  reset(); swipe(90,0); step(20);                 // to lane -1 first, so there is room for two
  swipe(-90,0); step(20); swipe(-90,0); step(2); o.twoSwipes=lane();

  // 3. a slow, deliberate swipe counts (no time limit on the move path)
  reset(); swipe(80,0,10,40); step(2); o.slowSwipe=lane();

  // 4. a quick wrist that lifts before the threshold counts, on velocity
  reset(); { const id=idc++, x0=200,y0=520;
    const a=new Touch({identifier:id,target:document.body,clientX:x0,clientY:y0});
    dispatchEvent(new TouchEvent('touchstart',{changedTouches:[a],touches:[a],bubbles:true,cancelable:false}));
    ev('touchend', T(x0+16, y0, id)); }
  step(2); o.flick=lane();

  // 5. a slow nudge under the threshold does NOTHING
  reset(); { const id=idc++, x0=200,y0=520;
    const a=new Touch({identifier:id,target:document.body,clientX:x0,clientY:y0});
    dispatchEvent(new TouchEvent('touchstart',{changedTouches:[a],touches:[a],bubbles:true,cancelable:false}));
    const spin=performance.now()+220; while(performance.now()<spin){}
    ev('touchmove', T(x0+9, y0, id)); ev('touchend', T(x0+9, y0, id)); }
  step(2); o.nudge=lane();

  // 6. the axis is the LARGER displacement — a diagonal still does what you meant
  reset(); swipe(70,26);  step(2); o.diagRight=lane();
  reset(); swipe(26,70);  step(4); o.diagDownLane=lane(); o.diagDownDucked=P.duckT>0;

  // 7. DOWN is evade, UP is nothing
  reset(); swipe(0,90);   step(4); o.downDucks=P.duckT>0; o.downLane=lane();
  reset(); swipe(0,-90);  step(4); o.upDucks=P.duckT>0;   o.upLane=lane();

  // 8. a gesture that starts on a control is not a swipe
  reset(); swipe(120,0,6,8, document.getElementById('btn-power')); step(2); o.onButton=lane();

  // 9. LATENCY: the lane must commit on the frame the threshold is crossed
  reset();
  { const id=idc++, x0=200,y0=520;
    const a=new Touch({identifier:id,target:document.body,clientX:x0,clientY:y0});
    dispatchEvent(new TouchEvent('touchstart',{changedTouches:[a],touches:[a],bubbles:true,cancelable:false}));
    ev('touchmove', T(x0-SW.swipePx-2, y0, id));
    o.commitBeforeLift = I.laneSteps!==0;      // decided already, finger still down
    step(1); o.laneAfterOneFrame=lane();
    ev('touchend', T(x0-SW.swipePx-2, y0, id));
    o.noExtraOnLift = (lane()===o.laneAfterOneFrame); }

  // 10. SETTLE TIME: how long the villain takes to arrive in the new lane
  reset();
  { swipe(-90,0); step(1);                       // the player reads the queue on the next frame
    const want=P.lane*SW.laneX; let f=1;
    for(; f<180; f++){ step(1);
      if(Math.abs((P.pos.x-G.city._pathX(P.pos.z))-want)<0.35) break; }
    o.settleFrames=f; o.settleTarget=want; }

  // 10b. THE MOTION CURVE. This is the difference between a swipe and a stiff drag, and it is
  // measurable: a critically damped spring never overshoots and reads as something sliding along a
  // rail. A phone home screen tips a few percent past the mark and settles. He also has to LEAN,
  // and the lean has to be exactly symmetric or a left change and a right change look like two
  // different moves.
  const curve=(dir)=>{
    I.laneSteps=0; P.lane=0; P.vel.x=0; P.laneLean=0; step(40);
    swipe(dir*90,0); const tr=[];
    for(let i=0;i<90;i++){ step(1);
      tr.push({o:P.pos.x-G.city._pathX(P.pos.z),
               lean:P.laneLean||0, rz:P.villainModel?P.villainModel.rotation.z:0}); }
    const T=P.lane*SW.laneX;          // signed target; dividing by it normalises BOTH directions
    const rel=tr.map(t=>t.o/T);
    let settle=-1;
    for(let i=0;i<rel.length;i++){ let good=true;
      for(let j=i;j<rel.length;j++) if(Math.abs(rel[j]-1)>0.01){ good=false; break; }
      if(good){ settle=i; break; } }
    return { overshoot:+(((Math.max(...rel))-1)*100).toFixed(1),
             settle, at100ms:+rel[5].toFixed(2),
             peakRoll:+(Math.max(...tr.map(t=>Math.abs(t.rz)))*57.3).toFixed(0),
             endLean:+Math.abs(tr[89].lean).toFixed(3) };
  };
  o.curveL=curve(-1); o.curveR=curve(1);

  // 11. DIRECTION, in screen pixels, as a fresh transient each way
  const scr=()=>{ const v=new (P.pos.constructor)(P.pos.x,P.pos.y,P.pos.z); v.project(G.camera.cam); return v.x; };
  reset(); const sA=scr(); swipe(90,0);  step(12); o.screenRight=+(scr()-sA).toFixed(3);
  reset(); const sB=scr(); swipe(-90,0); step(12); o.screenLeft =+(scr()-sB).toFixed(3);

  // 12. the lane clamps, and swiping into the wall does not queue up
  reset(); swipe(-90,0); step(20); swipe(-90,0); step(20); swipe(-90,0); step(20);
  o.clampL=lane(); swipe(90,0); step(20); o.unclamp=lane();

  reset();
  return o;
});

const C=[
  ['one swipe is one lane',                 r.shortRight===-1],
  ['a LONG drag is still one lane',         r.longRight===-1 && r.longLeft===1],
  ['two swipes are two lanes',              r.twoSwipes===1],
  ['a slow deliberate swipe counts',        r.slowSwipe===-1],
  ['a quick wrist counts on velocity',      r.flick===-1],
  ['a nudge under the threshold does nothing', r.nudge===0],
  ['a diagonal picks the larger axis',      r.diagRight===-1],
  ['a down-diagonal ducks, not steers',     r.diagDownLane===0 && r.diagDownDucked],
  ['swipe DOWN evades',                     r.downDucks && r.downLane===0],
  ['swipe UP does nothing',                 !r.upDucks && r.upLane===0],
  ['a gesture on a button is ignored',      r.onButton===0],
  ['it commits before the finger lifts',    r.commitBeforeLift],
  ['and the lift adds nothing extra',       r.noExtraOnLift],
  ['he arrives in the lane inside 0.35s',   r.settleFrames>0 && r.settleFrames<=21],
  ['and he aimed at a real lane centre',    Math.abs(Math.abs(r.settleTarget)-r.laneX)<0.01],
  ['swipe RIGHT moves him right on screen', r.screenRight>0.02],
  ['swipe LEFT moves him left on screen',   r.screenLeft<-0.02],
  ['the lane clamps at the edge',           r.clampL===1],
  ['and unclamps on the way back',          r.unclamp===0],
  ['it springs PAST the lane and settles',  r.curveL.overshoot>3 && r.curveL.overshoot<13
                                         && r.curveR.overshoot>3 && r.curveR.overshoot<13],
  ['settled inside a quarter second',       r.curveL.settle>0 && r.curveL.settle<=16 && r.curveR.settle<=16],
  ['most of the way there in 100ms',        r.curveL.at100ms>0.75 && r.curveR.at100ms>0.75],
  ['he LEANS into the change',              r.curveL.peakRoll>14 && r.curveL.peakRoll<38],
  ['the lean is symmetric left and right',  Math.abs(r.curveL.peakRoll-r.curveR.peakRoll)<=2],
  ['and it straightens out afterwards',     r.curveL.endLean<0.03 && r.curveR.endLean<0.03],
  ['no page errors',                        errs.length===0],
];
const bad=C.filter(c=>!c[1]).map(c=>c[0]);
console.log(JSON.stringify(r,null,1));
console.log('errs', errs.slice(0,3));
console.log('\n' + (bad.length ? 'FAIL — ' + bad.join('; ') : 'SWIPE FEEL OK'));
await browser.close(); srv.close();
process.exit(bad.length?1:0);
