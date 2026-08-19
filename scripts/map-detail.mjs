// CITYBREAKER — roadside detail, one map at a time.
//
// Renders a map's six prop kinds side by side on its own ground under its own lighting, so each
// can be judged against the era it is meant to belong to. Chasing the in-game camera is hopeless
// for this: props sit beside the road and are seen at a grazing angle for a fraction of a second.
//
//   MAPS=aero node scripts/map-detail.mjs
//   MAPS=medieval,metro,inferno,synth NIGHT=1 node scripts/map-detail.mjs
//
// Three failures this has caught, all invisible in a stats dump:
//   * metalness:1 with no environment map resolves to SOLID BLACK — every "chrome" prop was a
//     black silhouette. Metal here has to be faked with a bright base plus a little emissive.
//   * a blade box centred on its hub extends BOTH ways, so three turbine blades drew six spokes.
//   * a solid disc laid over a lava pool hides it completely; order and height matter.
//
// The printed stats are the second half of the check: `belowGround` catches anything sunk or
// floating, and `h` catches anything tall enough to punch through a tunnel ceiling.
//
import { chromium } from 'playwright';
import http from 'http'; import fs from 'fs'; import path from 'path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'), OUT='/tmp/claude-0/-home-user-nassers/b3bc857b-beed-5faf-b80d-53827eff6ffa/scratchpad';
const MIME={'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary','.png':'image/png','.wasm':'application/wasm','.json':'application/json'};
const srv=http.createServer((q,r)=>{ const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(p,(e,d)=>{ if(e){r.writeHead(404);r.end();return;} r.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(d); }); });
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
for(const MP of (process.env.MAPS||'aero').split(',')){
  const pg=await b.newPage({viewport:{width:1200,height:420},deviceScaleFactor:1});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(m=>{ try{ localStorage.setItem('invrun_map',m); }catch(e){} },MP);
  await pg.goto(`http://127.0.0.1:${port}/game.html`,{waitUntil:'load'});
  await pg.waitForFunction('!!window.__game',{timeout:150000});
  await pg.waitForTimeout(3000);
  const info=await pg.evaluate(async (night)=>{
    const THREE=await import('three');
    const G=window.__game, T=G.theme;
    if(night!==G.maps.night) G.maps.setNight(night);
    // one clean scene, the six prop kinds laid out in a row on a ground plane
    const scene=new THREE.Scene();
    scene.background=new THREE.Color(T.fog);
    scene.add(new THREE.HemisphereLight(T.hemiSky,T.hemiGround,1.9));
    const dl=new THREE.DirectionalLight(T.sunColor,T.sunInt*1.1); dl.position.set(12,20,10); scene.add(dl);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(300,300),
      new THREE.MeshStandardMaterial({color:T.ground,roughness:.95}));
    ground.rotation.x=-Math.PI/2; scene.add(ground);
    const stats=[];
    for(let k=0;k<6;k++){
      const src=(G.city.props||[]).find(p=>p.kind===k);
      if(!src){ stats.push({k,missing:true}); continue; }
      const c=src.grp.clone(true); c.visible=true;
      c.position.set((k-2.5)*15, 0, 0); scene.add(c);
      const bb=new THREE.Box3().setFromObject(c), sz=new THREE.Vector3(); bb.getSize(sz);
      let meshes=0; c.traverse(o=>{ if(o.isMesh) meshes++; });
      stats.push({k, meshes, h:+sz.y.toFixed(1), w:+sz.x.toFixed(1),
                  belowGround:+(bb.min.y).toFixed(2)});
    }
    const cam=new THREE.PerspectiveCamera(40,1200/420,0.1,600);
    cam.position.set(0,11,60); cam.lookAt(0,4,0);
    if(window.__R2){ window.__R2.dispose(); }
    const R=new THREE.WebGLRenderer({antialias:true}); window.__R2=R;
    R.setSize(1200,420); R.setPixelRatio(1);
    document.body.innerHTML=''; document.body.style.margin='0';
    document.body.appendChild(R.domElement);
    R.render(scene,cam);
    return { style:T.building.style, stats };
  }, process.env.NIGHT==='1');
  await pg.waitForTimeout(1400);
  await pg.screenshot({path:`${OUT}/props_${MP}${process.env.NIGHT==='1'?'_night':''}.png`, timeout:120000});
  console.log(MP.padEnd(10), JSON.stringify(info), errs.slice(0,2).join('|'));
  await pg.close();
}
await b.close(); srv.close();
