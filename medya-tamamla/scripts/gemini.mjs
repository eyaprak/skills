// gemini-api'yi çalıştırır ve her çağrıyı kayda yazar; maliyet.mjs maliyeti bu kayıttan hesaplar.
// Kullanım (proje kökünden): node <skill>/scripts/gemini.mjs <gemini-api argümanları...>
//
// - gemini-api ikilisi: GEMINI_API_BIN ortam değişkeni, yoksa PATH'teki "gemini-api".
// - Kayıt dosyası: MEDYA_KAYIT ortam değişkeni, yoksa ./uretim/cagrilar.jsonl.
// - Çıktı JSON istenir (--output-format json); stdout aynen geçirilir, çıkış kodu gemini-api'ninkidir.
// - Kayda anahtar yazılmaz (--api-key / --access-token değerleri gizlenir); dosya yolları proje köküne göre göreli tutulur.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BIN = process.env.GEMINI_API_BIN || 'gemini-api';
const LOG = path.resolve(process.env.MEDYA_KAYIT || path.join('uretim', 'cagrilar.jsonl'));
const SECRET_FLAGS = new Set(['--api-key', '--access-token']);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Kullanım: node gemini.mjs <gemini-api argümanları...>');
  process.exit(2);
}
if (!args.includes('--output-format') && !args.includes('--help') && !args.includes('--schema')) args.push('--output-format', 'json');

/** Hata metinlerindeki ev ve proje yollarını gizler (kayıtta kişisel klasör yolu kalmasın). */
const scrub = (s) => s.split(process.cwd()).join('.').split(os.homedir()).join('~');
const rel = (p) => {
  if (typeof p !== 'string' || !path.isAbsolute(p)) return p;
  const r = path.relative(process.cwd(), p);
  return (r.startsWith('..') ? path.basename(p) : r).replaceAll('\\', '/');
};
const safeArgs = args.map((a, i) => (i > 0 && SECRET_FLAGS.has(args[i - 1]) ? '***' : rel(a)));

const t0 = Date.now();
const r = spawnSync(BIN, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, shell: false });
if (r.error) {
  console.error(`gemini-api çalıştırılamadı (${BIN}): ${r.error.message}. PATH'e ekleyin ya da GEMINI_API_BIN verin.`);
  process.exit(1);
}
let result = null;
try {
  result = JSON.parse(r.stdout);
} catch {
  result = null;
}
const dryRun = args.includes('--dry-run');
if (!dryRun && !args.includes('--help') && !args.includes('--schema')) {
  const entry = {
    zaman: new Date(t0).toISOString(),
    sure_ms: Date.now() - t0,
    komut: args[0],
    argumanlar: safeArgs,
    cikis: r.status,
    model: result?.model ?? null,
    yol: rel(result?.path ?? null),
    kullanim: result?.usage ?? null,
    hata: r.status === 0 ? null : scrub(String(result?.error?.code ?? result?.error_type ?? (r.stderr ?? '').slice(0, 300))),
  };
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.appendFileSync(LOG, `${JSON.stringify(entry)}\n`);
}
process.stdout.write(r.stdout ?? '');
process.stderr.write(r.stderr ?? '');
process.exit(r.status ?? 1);
