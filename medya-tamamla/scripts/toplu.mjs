// Toplu üretim: görselleri ve seslendirme satırlarını sırayla, hız sınırına uyarak üretir.
// Kullanım (proje kökünden):
//   node <skill>/scripts/toplu.mjs gorsel <liste.json> [--aralik 2] [--deneme 5] [--bekle 20]
//   node <skill>/scripts/toplu.mjs ses <liste.json> [--aralik 7] [--deneme 6] [--bekle 15]
// Liste biçimleri: references/listeler.md. Var olan çıktıyı atlar, böylece yarıda kalan iş yeniden başlatılabilir.
// Her çağrı gemini.mjs üzerinden gider ve kayda yazılır.
//
// Seslendirme varsayılanı dakikada 10 istek sınırı içindir: çağrılar arasında 7 sn, 429'da 15 sn bekleyip yeniden dener.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GEMINI = path.join(HERE, 'gemini.mjs');
const [mode, listFile, ...rest] = process.argv.slice(2);
const opt = (name, def) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? Number(rest[i + 1]) : def;
};
if (!['gorsel', 'ses'].includes(mode) || !listFile) {
  console.error('Kullanım: node toplu.mjs gorsel|ses <liste.json> [--aralik sn] [--deneme n] [--bekle sn]');
  process.exit(2);
}
const isVoice = mode === 'ses';
const gap = opt('aralik', isVoice ? 7 : 2) * 1000;
const tries = opt('deneme', isVoice ? 6 : 5);
const wait = opt('bekle', isVoice ? 15 : 20) * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const items = JSON.parse(fs.readFileSync(listFile, 'utf8'));
const stem = (p) => p.replace(/\.(png|jpe?g|webp|wav|mp3)$/i, '');
/** Model çıktı uzantısını kendi seçer (ör. .png istenip .jpg yazılabilir); aynı adla herhangi biri varsa atla. */
const existing = (p) => ['.png', '.jpg', '.jpeg', '.webp', '.wav', '.mp3'].map((e) => stem(p) + e).find((f) => fs.existsSync(f));

function argsFor(it) {
  if (isVoice) {
    const a = ['tts', it.metin, '--voice', it.ses, '--out', `${stem(it.cikti)}.wav`];
    if (it.dil) a.push('--language', it.dil);
    if (it.model) a.push('-m', it.model);
    return a;
  }
  const a = ['image', it.istem];
  for (const r of it.referanslar ?? []) {
    const f = existing(r) ?? r;
    if (!fs.existsSync(f)) throw new Error(`Referans yok: ${r} (önce onu üretin)`);
    a.push('-i', f);
  }
  a.push('--aspect-ratio', it.en_boy ?? '1:1', '--image-size', it.boyut ?? '1K', '--out', `${stem(it.cikti)}.png`);
  if (it.model) a.push('-m', it.model);
  return a;
}

let ok = 0;
let fail = 0;
for (const it of items) {
  const done = existing(it.cikti);
  if (done) {
    console.log(`ATLA ${done}`);
    continue;
  }
  fs.mkdirSync(path.dirname(it.cikti), { recursive: true });
  let success = false;
  for (let i = 1; i <= tries && !success; i++) {
    const r = spawnSync(process.execPath, [GEMINI, ...argsFor(it)], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (r.status === 0) {
      success = true;
      ok++;
      console.log(`OK ${existing(it.cikti) ?? it.cikti}`);
    } else {
      const msg = (r.stdout + r.stderr).match(/"message":\s*"([^"]+)"/)?.[1] ?? (r.stderr || r.stdout).slice(0, 200);
      console.log(`  deneme ${i}/${tries} başarısız: ${msg}`);
      if (i < tries) await sleep(wait);
    }
  }
  if (!success) {
    fail++;
    console.log(`HATA ${it.cikti}`);
  }
  await sleep(gap);
}
console.log(`BİTTİ: ${ok} üretildi, ${fail} hata`);
process.exit(fail ? 1 : 0);
