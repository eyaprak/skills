// maliyet.md üretir: gemini.mjs kaydındaki her çağrıyı resmi token fiyatlarıyla hesaplar, dosyaları sayar, süreyi yazar.
// Kullanım (proje kökünden):
//   node <skill>/scripts/maliyet.mjs [--fiyat uretim/fiyatlar.json] [--kayit uretim/cagrilar.jsonl]
//        [--hedef public/assets] [--onceki uretim/onceki.json] [--cikti maliyet.md]
//        [--baslangic 2026-10-23T14:36:00Z --bitis 2026-10-23T15:20:00Z] [--baslik "Proje adı"]
//
// Kesin: kayıtta ya da fiyat sayfasında sayısı belli olanlar (çıktı tokenı, parça, video saniyesi).
// Tahmini: sayfanın token sayısını vermediği girdiler (referans görsel, istem metni, denetimdeki ses girdisi, düşünme).
//
// --onceki: sarmalayıcı kurulmadan önce yapılmış çağrılar için elle yazılmış satırlar:
//   [{ "ne": "Müzik: menü", "komut": "gemini-api music \"…\"", "model": "lyria-3.5", "adet": "1 parça",
//      "kategori": "muzik|ses|gorsel|video|denetim", "kesin": 0.08, "tahmini": 0, "dosya": 1, "not": "" }]

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const priceFile = opt('fiyat', fs.existsSync('uretim/fiyatlar.json') ? 'uretim/fiyatlar.json' : path.join(HERE, 'fiyatlar.json'));
const logFile = opt('kayit', 'uretim/cagrilar.jsonl');
const target = opt('hedef', null);
const beforeFile = opt('onceki', null);
const outFile = opt('cikti', 'maliyet.md');
const title = opt('baslik', path.basename(process.cwd()));

const F = JSON.parse(fs.readFileSync(priceFile, 'utf8'));
const V = F.varsayimlar;
const M = 1e6;
const usd = (v) => `${v.toFixed(4).replace('.', ',')} $`;
const num = (v, d = 1) => v.toFixed(d).replace('.', ',');
const arg = (a, flag) => {
  const i = a.indexOf(flag);
  return i >= 0 ? a[i + 1] : undefined;
};
const inputsOf = (a) => a.flatMap((x, i) => (x === '-i' || x === '--input' ? [a[i + 1]] : []));
const promptOf = (a) => (a[1] && !a[1].startsWith('-') ? a[1] : '');
const textTokens = (s) => (s ? Math.ceil(s.length / V.karakter_token) : V.istem_token);

function duration(p) {
  if (!p || !fs.existsSync(p)) return null;
  try {
    return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], { encoding: 'utf8' }).trim());
  } catch {
    return null;
  }
}
/** Video süresi: istenen süre (--body duration), yoksa dosyadan, yoksa varsayım. */
function videoSeconds(e) {
  const body = arg(e.argumanlar, '--body') ?? '';
  const m = body.match(/"duration"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (m) return Number(m[1]);
  return duration(e.yol) ?? V.video_varsayilan_saniye;
}

const CAT = { tts: 'ses', music: 'muzik', image: 'gorsel', video: 'video' };
const CAT_NAME = { ses: 'Seslendirme (TTS)', muzik: 'Müzik', gorsel: 'Görsel', video: 'Video', denetim: 'Denetim (analiz/transkript)', diger: 'Diğer' };

function priceOf(e) {
  const modelName = e.model ?? arg(e.argumanlar, '-m') ?? arg(e.argumanlar, '--model') ?? F.varsayilan_modeller[e.komut];
  const P = F.modeller[modelName];
  const cat = CAT[e.komut] ?? (['analyze', 'transcribe'].includes(e.komut) ? 'denetim' : 'diger');
  if (e.cikis !== 0) return { cat, model: modelName, exact: 0, est: 0, unit: `hata: ${e.hata ?? '?'} (ücretlenmedi sayıldı)` };
  if (!P) return { cat, model: modelName, exact: 0, est: 0, unit: `fiyat tablosunda yok: ${modelName}` };
  const a = e.argumanlar;
  const u = e.kullanim;
  switch (P.tur) {
    case 'tts': {
      const out = u?.output_tokens ?? 0;
      return { cat, model: modelName, exact: ((u?.prompt_tokens ?? 0) * P.girdi + out * P.cikti) / M, est: 0, unit: `${num(out / P.token_saniye)} sn ses (${out} çıktı tokenı)` };
    }
    case 'parca':
      return { cat, model: modelName, exact: P.parca, est: 0, unit: '1 parça' };
    case 'gorsel':
    case 'gorsel_sabit': {
      const size = arg(a, '--image-size') ?? '1K';
      const refs = inputsOf(a).length;
      const exact = P.tur === 'gorsel' ? ((P.cikti_token[size] ?? P.cikti_token['1K']) * P.cikti) / M : P.gorsel[size] ?? P.gorsel['1K'];
      return { cat, model: modelName, exact, est: ((textTokens(promptOf(a)) + refs * V.referans_gorsel_token) * P.girdi) / M, unit: `1 görsel ${size}${refs ? `, ${refs} referans` : ''}` };
    }
    case 'video': {
      const sec = videoSeconds(e);
      return {
        cat,
        model: modelName,
        exact: (sec * P.token_saniye * P.cikti) / M,
        est: ((textTokens(promptOf(a)) + inputsOf(a).length * V.referans_gorsel_token) * P.girdi) / M,
        unit: `${num(sec)} sn video (${Math.round(sec * P.token_saniye)} çıktı tokenı)`,
      };
    }
    default: {
      if (u) return { cat, model: modelName, exact: ((u.prompt_tokens ?? 0) * P.girdi + ((u.output_tokens ?? 0) + (u.thoughts_tokens ?? 0)) * P.cikti) / M, est: 0, unit: 'token kaydından' };
      const ins = inputsOf(a);
      const sec = ins.reduce((s, f) => s + (duration(f) ?? 0), 0);
      return { cat, model: modelName, exact: 0, est: (sec * V.ses_girdi_token_saniye * P.girdi + Math.max(1, ins.length) * V.denetim_cikti_token * P.cikti) / M, unit: `${ins.length} girdi, ${num(sec)} sn ses (kullanım dönmedi)` };
    }
  }
}

const entries = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const rows = entries.map((e) => ({ e, ...priceOf(e) }));
const before = beforeFile && fs.existsSync(beforeFile) ? JSON.parse(fs.readFileSync(beforeFile, 'utf8')) : [];

const cats = new Map();
const addCat = (k, exact, est) => {
  const c = cats.get(k) ?? { exact: 0, est: 0 };
  c.exact += exact;
  c.est += est;
  cats.set(k, c);
};
for (const b of before) addCat(b.kategori ?? 'diger', b.kesin ?? 0, b.tahmini ?? 0);
for (const r of rows) addCat(r.cat, r.exact, r.est);
const totalExact = [...cats.values()].reduce((a, c) => a + c.exact, 0);
const totalEst = [...cats.values()].reduce((a, c) => a + c.est, 0);

// Dosyalar
const produced = rows.filter((r) => r.e.cikis === 0 && CAT[r.e.komut]);
const producedBy = {};
for (const r of produced) producedBy[CAT_NAME[r.cat]] = (producedBy[CAT_NAME[r.cat]] ?? 0) + 1;
for (const b of before) if (b.dosya) producedBy[CAT_NAME[b.kategori] ?? 'Diğer'] = (producedBy[CAT_NAME[b.kategori] ?? 'Diğer'] ?? 0) + b.dosya;
const producedTotal = Object.values(producedBy).reduce((a, b) => a + b, 0);
let targetBy = null;
if (target && fs.existsSync(target)) {
  targetBy = {};
  const walk = (d) => {
    for (const x of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, x.name);
      if (x.isDirectory()) walk(p);
      else {
        const ext = path.extname(x.name).slice(1).toLowerCase();
        const kind = /^(mp3|wav|ogg|m4a|opus)$/.test(ext) ? 'Ses (müzik + seslendirme)' : /^(mp4|webm)$/.test(ext) ? 'Video' : /^(webp|png|jpe?g|avif)$/.test(ext) ? 'Görsel' : null;
        if (kind) targetBy[kind] = (targetBy[kind] ?? 0) + 1;
      }
    }
  };
  walk(target);
}

// Süre
const fmt = (ms) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)} sa ` : ''}${Math.floor((s % 3600) / 60)} dk ${String(s % 60).padStart(2, '0')} sn`;
};
const first = entries[0] ? Date.parse(entries[0].zaman) : null;
const lastE = entries[entries.length - 1];
const last = lastE ? Date.parse(lastE.zaman) + (lastE.sure_ms ?? 0) : null;
const start = opt('baslangic', null);
const end = opt('bitis', null);

// Yaz
const L = [];
L.push(`# ${title} — gemini-api maliyet dökümü`);
L.push('');
L.push(`Güncelleme: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · Fiyatlar: [resmi fiyat sayfası](${F.kaynak}) (sayfanın son güncellemesi ${F.sayfa_guncelleme}, ${F.okundu} tarihinde okundu), ${F.katman} katman.`);
L.push('');
L.push('## Toplam');
L.push('');
L.push(`**${usd(totalExact + totalEst)}** = ${usd(totalExact)} kesin + ${usd(totalEst)} tahmini.`);
L.push('');
L.push('| Kalem | Kesin | Tahmini | Toplam |');
L.push('|---|---|---|---|');
for (const [k, c] of cats) L.push(`| ${CAT_NAME[k] ?? k} | ${usd(c.exact)} | ${usd(c.est)} | ${usd(c.exact + c.est)} |`);
L.push(`| **Toplam** | **${usd(totalExact)}** | **${usd(totalEst)}** | **${usd(totalExact + totalEst)}** |`);
L.push('');
L.push('- **Kesin:** çıktı tokenı, parça ve video saniyesi; sayısı kayıtta ya da fiyat sayfasında belli.');
L.push(`- **Tahmini:** fiyat sayfasının token sayısını vermediği girdiler. Varsayımlar: referans görsel ${V.referans_gorsel_token} token; istem metni karakter ÷ ${V.karakter_token} (yoksa ${V.istem_token} token); denetimde saniyede ${V.ses_girdi_token_saniye} ses tokenı ve istek başına ${V.denetim_cikti_token} çıktı/düşünme tokenı.`);
L.push('- Hata dönen istekler (ör. 429 hız sınırı) 0 sayıldı; yanıt üretilmedi.');
L.push('');
L.push('## Kullanılan fiyatlar (1M token başına $)');
L.push('');
L.push('| Model | Fiyat |');
L.push('|---|---|');
const used = new Set([...rows.map((r) => r.model), ...before.map((b) => b.model)].filter((m) => F.modeller[m]));
for (const m of used) {
  const P = F.modeller[m];
  const d =
    P.tur === 'tts' ? `girdi ${P.girdi}, çıktı ${P.cikti} (ses); ${P.token_saniye} token = 1 sn`
    : P.tur === 'parca' ? `${P.parca} $ / parça`
    : P.tur === 'gorsel' ? `girdi ${P.girdi}, görsel çıktısı ${P.cikti}; ${Object.entries(P.cikti_token).map(([k, v]) => `${k} = ${v} token`).join(', ')}`
    : P.tur === 'gorsel_sabit' ? `girdi ${P.girdi}; ${Object.entries(P.gorsel).map(([k, v]) => `${k} = ${v} $`).join(', ')}`
    : P.tur === 'video' ? `girdi ${P.girdi}, video çıktısı ${P.cikti}; saniyede ${P.token_saniye} token`
    : `girdi ${P.girdi}, çıktı ${P.cikti}`;
  L.push(`| ${m} | ${d.replaceAll('.', ',')}${P.not ? ` (${P.not})` : ''} |`);
}
L.push('');
L.push('## Dosyalar');
L.push('');
L.push(`gemini-api'nin döndürdüğü medya dosyası: **${producedTotal}**`);
L.push('');
L.push('| Tür | Adet |');
L.push('|---|---|');
for (const [k, v] of Object.entries(producedBy)) L.push(`| ${k} | ${v} |`);
if (targetBy) {
  L.push('');
  L.push(`Projede kullanılan (\`${target}\`): **${Object.values(targetBy).reduce((a, b) => a + b, 0)}**`);
  L.push('');
  L.push('| Tür | Adet |');
  L.push('|---|---|');
  for (const [k, v] of Object.entries(targetBy)) L.push(`| ${k} | ${v} |`);
}
L.push('');
L.push('## Süre');
L.push('');
if (start && end) L.push(`- İşin tamamı: ${start} → ${end} = **${fmt(Date.parse(end) - Date.parse(start))}**`);
if (first) L.push(`- İlk gemini-api çağrısı → son çağrının bitişi: ${new Date(first).toISOString().slice(0, 19)}Z → ${new Date(last).toISOString().slice(0, 19)}Z = **${fmt(last - first)}**`);
L.push(`- Çağrı sayısı: ${entries.length} kayıtlı (${entries.filter((e) => e.cikis === 0).length} başarılı, ${entries.filter((e) => e.cikis !== 0).length} hata)${before.length ? ` + ${before.length} kayıt öncesi satır` : ''}`);
L.push('');
if (before.length) {
  L.push('## Kayıt tutulmadan önceki çağrılar');
  L.push('');
  L.push('| Ne | Komut | Model | Adet / süre | Kesin | Tahmini |');
  L.push('|---|---|---|---|---|---|');
  for (const b of before) L.push(`| ${b.ne} | \`${b.komut}\` | ${b.model ?? '—'} | ${b.adet ?? ''}${b.not ? ` (${b.not})` : ''} | ${usd(b.kesin ?? 0)} | ${usd(b.tahmini ?? 0)} |`);
  L.push('');
}
L.push(`## Kayıtlı çağrılar (${rows.length})`);
L.push('');
L.push('| # | Zaman (UTC) | Komut | Model | Çıktı | Adet / süre | Kesin | Tahmini |');
L.push('|---|---|---|---|---|---|---|---|');
rows.forEach((r, i) => {
  const cmd = r.e.argumanlar
    .filter((x) => x !== '--output-format' && x !== 'json')
    .map((x) => (x.length > 70 ? `"${x.slice(0, 67)}…"` : x.includes(' ') ? `"${x}"` : x))
    .join(' ')
    .replaceAll('|', '\\|');
  L.push(`| ${i + 1} | ${r.e.zaman.slice(0, 19).replace('T', ' ')} | \`gemini-api ${cmd}\` | ${r.model ?? '—'} | ${r.e.yol ? path.basename(r.e.yol) : '—'} | ${r.unit} | ${usd(r.exact)} | ${usd(r.est)} |`);
});
L.push('');
fs.writeFileSync(outFile, L.join('\n'));
console.log(`${outFile} yazıldı: ${rows.length} kayıtlı çağrı; toplam ${usd(totalExact + totalEst)} (kesin ${usd(totalExact)} + tahmini ${usd(totalEst)})`);
