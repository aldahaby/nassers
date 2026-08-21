// CITYBREAKER — the tutorial.
//
// It is coached over a LIVE run, not a slideshow: each step states one thing and then waits for the
// player to actually do it. So the things that matter are that it appears for a first-time player,
// that a step CLEARS when the action is performed (and not before), that it is skippable, that it
// never comes back once seen, and that Settings can bring it back on demand.
//
//   node scripts/tutorial.mjs
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

const run = async (mode, seen)=>{
  const pg = await browser.newPage({viewport:{width:412,height:892},deviceScaleFactor:1});
  const errs=[]; pg.on('pageerror', e=>errs.push(e.message));
  await pg.addInitScript(([m,sn])=>{ try{
    localStorage.setItem('invrun_char','forged'); localStorage.setItem('invrun_map','nyc');
    localStorage.setItem('invrun_mode',m);
    if(sn) localStorage.setItem('invrun_tut','1'); else localStorage.removeItem('invrun_tut');
  }catch(e){} }, [mode, seen]);
  await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
  await pg.waitForFunction('!!window.__game',{timeout:200000});
  await pg.waitForTimeout(1800);
  const r = await pg.evaluate(()=>{
    const G=window.__game, T=G.tutorial;
    G._clock.getDelta=()=>1/60; G.renderer.render=()=>{}; window.requestAnimationFrame=()=>0;
    G.ui.update=()=>{}; G.snapMenuBg=()=>{}; G.time.frozen=()=>false; G.time.update=rd=>rd;
    const vis=()=>!document.getElementById('tut').classList.contains('hidden');
    const step=n=>{ for(let i=0;i<n;i++){ G.momentum.value=G.momentum.MAX; G._loop(); } };
    const o={};
    // The run is LIVE, so he will smash things on his own inside 120 frames. Stub the collision so
    // step one can be proven to wait for the event rather than for the clock.
    G.impact.smash=()=>{};
    G.run.startRun();
    o.opens=vis(); o.stepsTotal=T.steps.length; o.title0=document.getElementById('tut-title').textContent;
    o.hasSwipeStep=T.steps.some(s=>/RAIL CANNON/.test(s.t));

    // step 1 waits for a smash and nothing else
    step(120); o.stuckWithoutSmash = (T.i===0);
    T.note('smash'); step(4); o.advancedOnSmash = (T.i===1);

    // every remaining step must be satisfiable by its own action
    T.note('lane'); T.note('lane'); step(4);
    for(let k=0;k<4;k++) T.note('smash');
    step(4); T.note('power'); step(4); T.note('evade'); step(4);
    step(60*6);
    o.completes = !T.on;
    o.persisted = localStorage.getItem('invrun_tut')==='1';

    // and it must not come back on the next run
    G.run.startRun(); o.repeats = T.on;
    // Settings brings it back on demand
    document.getElementById('tut-btn').onclick();
    o.replays = T.on;

    return o;
  });
  // the card animates out on a real timer, so the DOM check has to happen in wall-clock time
  await pg.waitForTimeout(600);
  r.closed = await pg.evaluate(()=>document.getElementById('tut').classList.contains('hidden'));
  await pg.close();
  return {r, errs};
};

const A = await run('free', false);
const B = await run('swipe', false);
const C = await run('free', true);

const skip = await (async ()=>{
  const pg = await browser.newPage({viewport:{width:412,height:892}});
  await pg.addInitScript(()=>{ try{ localStorage.setItem('invrun_char','forged');
    localStorage.removeItem('invrun_tut'); }catch(e){} });
  await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
  await pg.waitForFunction('!!window.__game',{timeout:200000});
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate(()=>{
    const G=window.__game;
    G.renderer.render=()=>{}; window.requestAnimationFrame=()=>0;
    G.run.startRun();
    const before=G.tutorial.on;
    document.getElementById('tut-skip').click();
    return { before, after:G.tutorial.on, persisted:localStorage.getItem('invrun_tut')==='1' };
  });
  await pg.close(); return r;
})();

const checks = [
  ['it opens for a first-time player',        A.r.opens && B.r.opens],
  ['it does not open once seen',              C.r.opens===false],
  ['step one waits for an actual smash',      A.r.stuckWithoutSmash && A.r.advancedOnSmash],
  ['every step can be completed',             A.r.completes && B.r.completes],
  ['it closes itself when done',              A.r.closed && B.r.closed],
  ['it records that it was seen',             A.r.persisted && B.r.persisted],
  ['it never repeats on the next run',        A.r.repeats===false && B.r.repeats===false],
  ['Settings can replay it',                  A.r.replays!==false],
  ['swipe mode adds the rail-cannon step',    B.r.hasSwipeStep && !A.r.hasSwipeStep],
  ['SKIP ends it and records it',             skip.before && !skip.after && skip.persisted],
  ['no page errors',                          A.errs.length===0 && B.errs.length===0 && C.errs.length===0],
];
const failed = checks.filter(c=>!c[1]).map(c=>c[0]);
console.log('free ', JSON.stringify(A.r));
console.log('swipe', JSON.stringify(B.r));
console.log('seen ', JSON.stringify(C.r), 'skip', JSON.stringify(skip));
console.log('\n' + (failed.length ? 'FAIL — ' + failed.join('; ') : 'TUTORIAL OK'));
await browser.close(); srv.close();
process.exit(failed.length ? 1 : 0);
