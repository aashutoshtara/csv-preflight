import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const target = resolve(root, 'docs');
const marker = resolve(target, '.generated-pages');
const html = await readFile(resolve(dist, 'index.html'), 'utf8');
if (/\b(?:src|href)=["']\/assets\//.test(html)) throw new Error('The build contains root-only asset paths; rebuild with the relative GitHub Pages base.');
let entries = [];
try { entries = await readdir(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (entries.length) {
  try { await readFile(marker, 'utf8'); }
  catch { throw new Error('Refusing to replace an existing docs folder that this script did not generate.'); }
  await rm(target, { recursive: true });
}
await mkdir(target, { recursive: true });
await cp(dist, target, { recursive: true });
await writeFile(resolve(target, '.nojekyll'), '');
await writeFile(resolve(target, 'CNAME'), 'csv.nakshatraveda.tech\n');
await writeFile(marker, 'Generated from the reviewed application build by scripts/prepare-pages.mjs.\n');
console.log('Prepared docs/ for GitHub Pages branch publishing. No repository was created or published.');
