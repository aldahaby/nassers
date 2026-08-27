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

const open = async (map)=>{
  const pg = await browser.newPage({viewport:{width:412,height:892},deviceScaleFactor:1});
  const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
  await pg.addInitScript(m=>{ try{ localStorage.setItem('invrun_char','forged');
    localStorage.setItem('invrun_map',m); localStorage.setItem('invrun_tut','1'); }catch(e){} }, map);
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
    ev('touchend', T(x0, y0-16, id)); }
  step(3); o.flickDir=P.evadeDir;                                // quick wrist, lifted early
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
      roll=Math.max(roll,Math.abs(P.evRoll||0)); }
    return { y:+y.toFixed(2), arm:+a.toFixed(2), leg:+l.toFixed(2), head:+h.toFixed(2),
             torso:+tt.toFixed(2), rollDeg:Math.round(roll*57.3), back:+P.pos.y.toFixed(1) }; };
  o.up=peak(1); o.down=peak(-1);
  // the button with no direction picks a side and works
  clear(); document.getElementById('btn-evade').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
  step(20); o.buttonMoved=Math.abs(P.pos.y-P.cruiseY)>2; o.buttonDir=P.evadeDir;
  return o;
});
await A.pg.close();

// ---- 3-4. THE ENCOUNTER ---------------------------------------------------------------------
// evadeMode: 'never' | 'up' | 'down' | 'early' | 'late'
const runAt = async (speed, mode)=>{
  const {pg, errs} = await open('nyc');
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
      if(st==='charge' && cur){
        if(cur.lead===undefined){ cur.lead=+((C.active.z-P.pos.z)/spd).toFixed(2);
                                  cur.hits0=hits; cur.lockErr=+Math.abs(SW.beamY-P.pos.y).toFixed(2); }
        if(vis(warnEl)&&vis(evEl)) cur.warnFrames++; else cur.warnAtCharge=false;
        if(mode==='early' && !cur.evaded) cur.evaded=P.evade(1);
        if((mode==='up'||mode==='down') && C.t>SW.chargeSec*0.7 && !cur.evaded)
          cur.evaded=P.evade(mode==='up'?1:-1);
      }
      if(st==='fire' && cur){
        if(mode==='late' && !cur.evaded && Math.abs(P.pos.z-C.active.z)<SW.beamDepth)
          cur.evaded=P.evade(1);
        cur.minDist=Math.min(cur.minDist, Math.abs(P.pos.z-C.active.z));
        if(cur.dAtFire===undefined) cur.dAtFire=+(C.active.z-P.pos.z).toFixed(1);
        cur.clearedBy=Math.max(cur.clearedBy, Math.abs(P.pos.y-SW.beamY));
        cur.lowY=Math.min(cur.lowY===undefined?9e9:cur.lowY, P.pos.y);
      }
      if(last!=='idle' && st==='idle' && cur && !cur.done){
        cur.hit = hits>cur.hits0; cur.minDist=+cur.minDist.toFixed(1);
        cur.clearedBy=+cur.clearedBy.toFixed(1); cur.done=true; enc.push(cur);
      }
      last=st;
    }
    return { spd, mode, n:enc.length, enc:enc.slice(0,6),
             chargeSec:SW.chargeSec, fireLead:SW.fireLead, beamHalf:SW.beamHalf };
  }, [speed, mode]);
  await pg.close();
  return {out, errs};
};
const N46=await runAt(46,'never'),  U46=await runAt(46,'up'),   D46=await runAt(46,'down');
const N95=await runAt(95,'never'),  U95=await runAt(95,'up');
const E46=await runAt(46,'early'),  L46=await runAt(46,'late'), L95=await runAt(95,'late');

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

const checks=[
  ['swipe UP asks for a climb',             ges.upDir===1],
  ['swipe DOWN asks for a dive',            ges.downDir===-1],
  ['a sideways gesture is not an evade',    ges.sidewaysDir===0],
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
  ['both roll a full revolution',           ges.up.rollDeg>=355 && ges.down.rollDeg>=355],

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
for(const [n,R] of [['46 ignore',N46],['46 up',U46],['46 down',D46],['95 ignore',N95],
                    ['95 up',U95],['46 early',E46],['46 late',L46],['95 late',L95]])
  console.log(n.padEnd(10),'n='+R.out.n, JSON.stringify(R.out.enc.slice(0,2)
    .map(e=>({lead:e.lead,d:e.minDist,clr:e.clearedBy,hit:e.hit,ev:e.evaded}))));
console.log('\n' + (bad.length ? 'FAIL — ' + bad.join('; ') : 'EVADE OK'));
await browser.close(); srv.close();
process.exit(bad.length?1:0);
