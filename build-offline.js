// build-offline.js — bundles VEER 5 into ONE self-contained offline HTML masterfile.
//
// Usage:  node build-offline.js
// Output: Veer5-offline.html  (~1.6 MB, zero network requests, works from file://)
//
// It inlines: CSS + three.js r160 + all game modules, strips ESM import/export
// (single-file scope), and replaces the CDN boot loader with a direct boot call.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const fail = (m) => { console.error('BUILD FAILED: ' + m); process.exit(1); };
const esc = (s) => s.replace(/<\/script/gi, '<\\/script'); // keep bundle parse-safe

console.log('--- VEER 5 offline masterfile build ---');

// ---------- 1. HTML shell + CSS ----------
let html = read('index.html');
const css = read('css/style.css');
const linkTag = '<link rel="stylesheet" href="css/style.css">';
if (!html.includes(linkTag)) fail('CSS link tag not found in index.html');
html = html.replace(linkTag, '<style>\n' + css + '\n</style>');
html = html.replace(
  '<title>VEER 5 — Open-World City Sandbox</title>',
  '<title>VEER 5 — Open-World City Sandbox (Offline Masterfile)</title>'
);
console.log('OK  inlined CSS (' + css.length + ' chars)');

// ---------- 2. three.js ----------
let three = read('js/vendor/three.module.js');
const expCount = (three.match(/^\s*export\s+/m) || []).length;
if (expCount !== 1) fail(`expected 1 top-level export in three.module.js, found ${expCount}`);
if (/^\s*import\s+/m.test(three)) fail('unexpected import in three.module.js');
three = three.replace(/^export \{/m, 'const THREE = {');
if (!three.includes('const THREE = {')) fail('three export rewrite failed');
console.log('OK  three.js r160 vendored (' + three.length + ' chars)');

// ---------- 3. game modules (single-scope concat, ESM keywords stripped) ----------
const files = [
  'js/input.js', 'js/audio.js', 'js/world.js', 'js/character.js',
  'js/vehicles.js', 'js/peds.js', 'js/activities.js', 'js/ui.js', 'js/main.js',
];
let game = '';
for (const f of files) {
  let code = read(f);
  code = code.split('\n').filter((l) => !/^\s*import\s/.test(l)).join('\n');
  code = code.replace(/^export async function /m, 'async function ');
  code = code.replace(/^export function /m, 'function ');
  if (/^\s*(import|export)\s/m.test(code)) fail(`leftover import/export in ${f}`);
  game += '\n// ================= ' + f + ' =================\n' + code;
  console.log('OK  bundled ' + f);
}
if (!/\basync function boot\(/.test(game)) fail('boot() missing from bundle');

// ---------- 4. offline boot stub (no CDN, localStorage-safe) ----------
const bootStub = `
/* ===== offline boot (no network) ===== */
;(function () {
  try { localStorage.setItem('__veer5t', '1'); localStorage.removeItem('__veer5t'); }
  catch (e) {
    try {
      Object.defineProperty(window, 'localStorage', { value: {
        _m: {},
        getItem: function (k) { return (k in this._m) ? this._m[k] : null; },
        setItem: function (k, v) { this._m[k] = String(v); },
        removeItem: function (k) { delete this._m[k]; }
      }, configurable: true });
    } catch (e2) { /* storage unavailable; game still runs */ }
  }
  var fill = document.getElementById('load-fill');
  var text = document.getElementById('load-text');
  fill.style.width = '70%';
  text.textContent = 'Building city...';
  boot(function (p, msg) {
    fill.style.width = Math.round(70 + p * 30) + '%';
    if (msg) text.textContent = msg;
  }).then(function () {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
  }).catch(function (err) {
    fill.style.background = '#ef4444';
    text.style.color = '#ff9a9a';
    text.textContent = 'Error starting game: ' + (err && err.message ? err.message : err);
    setTimeout(function () { throw err; }, 0);
  });
})();
`;

// ---------- 5. assemble ----------
const sIdx = html.indexOf('<script type="module">');
const eIdx = html.lastIndexOf('</script>');
if (sIdx === -1 || eIdx === -1 || eIdx <= sIdx) fail('boot script block markers not found');
const bundle =
  '<script type="module">\n' +
  '/* ===== three.js r160 — MIT License, https://threejs.org ===== */\n' +
  esc(three) + '\nwindow.THREE = THREE;\n' +
  esc(game) + '\n' + bootStub + '\n';
html = html.slice(0, sIdx) + bundle + html.slice(eIdx);

// ---------- 6. sanity checks ----------
if (html.includes('unpkg.com') || html.includes('jsdelivr.net') || html.includes('cdnjs.cloudflare.com'))
  fail('CDN URL leaked into offline bundle');
const scriptCount = (html.match(/<script/g) || []).length;
if (scriptCount !== 1) fail(`expected exactly 1 script tag, found ${scriptCount}`);

const outPath = path.join(root, 'Veer5-offline.html');
fs.writeFileSync(outPath, html);
const kb = Math.round(fs.statSync(outPath).size / 1024);
console.log('OK  wrote Veer5-offline.html (' + kb + ' KB, fully offline)');
console.log('--- build complete ---');
