// gemini-api ham çıktılarını projede kullanılacak biçime çevirir (ffmpeg gerekir).
// Kullanım:
//   node isle.mjs seffaf <girdi> <çıktı.webp> [boyut=192]        düz arka plan saydamlaşır, kenar halesi 2 px daraltılır
//   node isle.mjs gorsel <girdi> <çıktı.webp> <G:Y> [kirp]       ölçekle; "kirp" verilirse önce kenarlardan %5/%12 kırpar
//   node isle.mjs muzik  <girdi> <çıktı.mp3>                     128 kb/sn MP3
//   node isle.mjs ses    <girdi.wav> <çıktı.mp3>                 baş/son sessizliği kırpar, 64 kb/sn mono MP3
//   node isle.mjs video-dongu <girdi.mp4> <çıktı.mp4> [genişlik=1280]
//                                                               sesi atar, ileri+geri birleştirip dikişsiz döngü yapar
// Girdi ile çıktı aynı dosya olamaz; ham dosyaları uretim/ham altında tutun.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [cmd, input, output, a3, a4] = process.argv.slice(2);
const usage = () => {
  console.error('Kullanım: node isle.mjs seffaf|gorsel|muzik|ses|video-dongu <girdi> <çıktı> [...]');
  process.exit(2);
};
if (!cmd || !input || !output) usage();
if (path.resolve(input) === path.resolve(output)) {
  console.error('Girdi ve çıktı aynı dosya olamaz.');
  process.exit(2);
}
if (!fs.existsSync(input)) {
  console.error(`Girdi yok: ${input}`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
const ff = (...args) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: ['ignore', 'pipe', 'inherit'] });

/** Sol üst köşenin rengi: düz arka planın anahtar rengi (model tam #FF00FF vermeyebilir). */
function cornerColor(file) {
  const buf = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'crop=4:4:6:6,scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { stdio: ['ignore', 'pipe', 'inherit'] });
  return `0x${[...buf.subarray(0, 3)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

switch (cmd) {
  case 'seffaf': {
    const size = Number(a3 ?? 192);
    const key = cornerColor(input);
    const vf = `[0:v]colorkey=${key}:0.30:0.10,format=rgba,split[c][a];[a]alphaextract,erosion,erosion[m];[c][m]alphamerge,scale=${size}:${size}:flags=lanczos,format=yuva420p[v]`;
    ff('-i', input, '-filter_complex', vf, '-map', '[v]', '-c:v', 'libwebp', '-quality', '86', '-frames:v', '1', output);
    break;
  }
  case 'gorsel': {
    if (!a3) usage();
    const crop = a4 === 'kirp' ? 'crop=iw*0.95:ih*0.88,' : '';
    ff('-i', input, '-vf', `${crop}scale=${a3}:flags=lanczos`, '-c:v', 'libwebp', '-quality', '84', '-frames:v', '1', output);
    break;
  }
  case 'muzik':
    ff('-i', input, '-c:a', 'libmp3lame', '-b:a', '128k', output);
    break;
  case 'ses': {
    const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse';
    ff('-i', input, '-af', trim, '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', output);
    break;
  }
  case 'video-dongu': {
    const w = Number(a3 ?? 1280);
    const vf = `[0:v]scale=${w}:-2:flags=lanczos,split[a][b];[b]reverse,trim=start_frame=1[r];[a][r]concat=n=2:v=1[v]`;
    ff('-i', input, '-an', '-filter_complex', vf, '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output);
    break;
  }
  default:
    usage();
}
console.log(`OK ${output}`);
