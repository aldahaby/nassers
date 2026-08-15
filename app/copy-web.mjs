// Copies the game into www/ for Capacitor. game.html becomes index.html; everything else is
// taken as-is. Run by `npm run sync`, so the app always ships whatever is in the repo right now.
import fs from 'fs';
import path from 'path';

const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, '..');
const www  = path.join(here, 'www');

fs.rmSync(www, { recursive:true, force:true });
fs.mkdirSync(www, { recursive:true });

fs.copyFileSync(path.join(repo,'game.html'), path.join(www,'index.html'));
for(const dir of ['assets','vendor']){
  const src = path.join(repo, dir);
  if(fs.existsSync(src)) fs.cpSync(src, path.join(www, dir), { recursive:true });
}
const n = fs.readdirSync(www).length;
console.log(`www/ built from ${repo} — ${n} top-level entries`);
