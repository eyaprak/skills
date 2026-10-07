#!/usr/bin/env node
/**
 * Ana listeden islenecek kaydi secer.
 *
 * Kullanim:
 *   node kayit-sec.js <teklif-ayarlari.json> <cikti.json>
 *
 * - Sutunlari BASLIK SATIRINDAN bulur, kolon numarasi varsaymaz.
 * - durum sutunu "Bekliyor" olan ILK satiri secer.
 * - Firma adiyla birden fazla satir eslesirse coklu=N doner; cagiran DURMALIDIR.
 * - Bekleyen yoksa bekleyen=0 doner; cagiran hicbir sey uretmemelidir.
 */
const fs = require('fs');
const { execFileSync } = require('child_process');

const [, , ayarYolu, ciktiYolu] = process.argv;
if (!ayarYolu || !ciktiYolu) {
  console.error('kullanim: node kayit-sec.js <teklif-ayarlari.json> <cikti.json>');
  process.exit(2);
}

const ayar = JSON.parse(fs.readFileSync(ayarYolu, 'utf8'));
const listeId = ayar?.ana_liste?.id;
const sekme = ayar?.ana_liste?.sekme;
if (!listeId || !sekme) {
  console.error('HATA: ayar dosyasinda ana_liste.id veya ana_liste.sekme yok.');
  process.exit(2);
}

// Windows'ta PATH'teki "gws" bir .cmd sarmalayicisidir ve Node 20+ guvenlik geregi
// .cmd dosyalarini shell'siz calistirmaz (EINVAL). Gercek gws.exe'yi PATH uzerinden
// cozumluyoruz - makineye ozel yol YAZILMAZ, boylece beceri tasinabilir kalir.
const path = require('path');
function gwsBul() {
  if (process.platform !== 'win32') return 'gws';
  const dizinler = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  for (const d of dizinler) {
    const dogrudan = path.join(d, 'gws.exe');
    if (fs.existsSync(dogrudan)) return dogrudan;
    const gomulu = path.join(d, 'node_modules', '@googleworkspace', 'cli', 'bin', 'gws.exe');
    if (fs.existsSync(gomulu)) return gomulu;
  }
  return 'gws.cmd'; // son care
}
const GWS = gwsBul();

// gws ciktisindaki "Using keyring backend: ..." gibi satirlari ayikla
function gws(args) {
  let ham;
  try {
    ham = execFileSync(GWS, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error('HATA: "' + GWS + '" bulunamadi. Google Workspace CLI kurulu mu?');
      console.error('  Kurulum: npm install -g @googleworkspace/cli');
      process.exit(2);
    }
    throw e;
  }
  const bas = ham.indexOf('{');
  if (bas < 0) throw new Error('gws JSON dondurmedi: ' + ham.slice(0, 200));
  return JSON.parse(ham.slice(bas));
}

const cevap = gws([
  'sheets', 'spreadsheets', 'values', 'get',
  '--params', JSON.stringify({ spreadsheetId: listeId, range: `${sekme}!A1:Z1000` })
]);

const satirlar = cevap.values || [];
if (satirlar.length < 2) {
  console.log('bekleyen: 0');
  console.log('Listede veri satiri yok.');
  fs.writeFileSync(ciktiYolu, JSON.stringify({ bekleyen: 0 }, null, 2));
  process.exit(0);
}

// --- sutun indeksleri: BASLIKTAN ---
const baslik = satirlar[0].map(h => (h || '').trim());
const bul = ad => baslik.findIndex(h => h.toLowerCase() === ad.toLowerCase());
const kolon = {
  firma: bul('firma'),
  yetkili: bul('yetkili'),
  eposta: bul('e-posta'),
  hizmet: bul('hizmet'),
  tutar: bul('tutar'),
  durum: bul('durum'),
  teklif_linki: bul('teklif_linki'),
  gonderim_tarihi: bul('gonderim_tarihi'),
  pdf: bul('pdf')
};
const eksik = Object.entries(kolon).filter(([, i]) => i < 0).map(([k]) => k);
if (eksik.length) {
  console.error('HATA: su basliklar listede bulunamadi: ' + eksik.join(', '));
  console.error('Mevcut basliklar: ' + baslik.join(', '));
  process.exit(2);
}

const hucre = (satir, i) => (satir[i] || '').trim();
const veriSatirlari = satirlar.map((s, n) => ({ s, satir: n + 1 })).slice(1);

// --- ilk "Bekliyor" ---
const bekleyenler = veriSatirlari.filter(x => hucre(x.s, kolon.durum).toLowerCase() === 'bekliyor');
console.log('bekleyen: ' + bekleyenler.length);

if (bekleyenler.length === 0) {
  console.log('bekleyen kayit yok');
  fs.writeFileSync(ciktiYolu, JSON.stringify({ bekleyen: 0 }, null, 2));
  process.exit(0);
}

const secilen = bekleyenler[0];
const firma = hucre(secilen.s, kolon.firma);

// --- coklu eslesme kontrolu ---
const ayniAd = veriSatirlari.filter(
  x => hucre(x.s, kolon.firma).toLowerCase() === firma.toLowerCase()
);
console.log('coklu: ' + ayniAd.length);
if (ayniAd.length > 1) {
  console.log('DUR: "' + firma + '" adiyla ' + ayniAd.length + ' satir eslesiyor (satirlar: ' +
    ayniAd.map(x => x.satir).join(', ') + '). Kullaniciya sor, hicbir sey yazma.');
  fs.writeFileSync(ciktiYolu, JSON.stringify({
    bekleyen: bekleyenler.length, coklu: ayniAd.length, firma,
    satirlar: ayniAd.map(x => x.satir)
  }, null, 2));
  process.exit(0);
}

// --- tarihler ---
const ik = n => String(n).padStart(2, '0');
const bicim = d => `${ik(d.getDate())}.${ik(d.getMonth() + 1)}.${d.getFullYear()}`;
const bugun = new Date();
bugun.setHours(0, 0, 0, 0);
const gecerlilik = new Date(bugun);
gecerlilik.setMonth(gecerlilik.getMonth() + 1);
const gun = Math.round((gecerlilik - bugun) / 86400000);

const sonuc = {
  bekleyen: bekleyenler.length,
  coklu: 1,
  satir: secilen.satir,
  kolon,
  baslik,
  liste: { id: listeId, sekme },
  veri: {
    firma,
    yetkili: hucre(secilen.s, kolon.yetkili),
    eposta: hucre(secilen.s, kolon.eposta),
    hizmet: hucre(secilen.s, kolon.hizmet),
    tutar: hucre(secilen.s, kolon.tutar),
    durum: hucre(secilen.s, kolon.durum)
  },
  tarih: {
    bugun: bicim(bugun),
    gecerlilik: bicim(gecerlilik),
    gun,
    ay_klasoru: `${bugun.getFullYear()}-${ik(bugun.getMonth() + 1)}`
  },
  gonderen: ayar.hesap || '',
  belge_adi: 'Teklif - ' + firma
};

fs.writeFileSync(ciktiYolu, JSON.stringify(sonuc, null, 2));

const H = n => String.fromCharCode(65 + n);
console.log('');
console.log('=== SECILEN KAYIT ===');
console.log('  sheet satiri : ' + sonuc.satir);
console.log('  firma        : ' + sonuc.veri.firma);
console.log('  yetkili      : ' + sonuc.veri.yetkili);
console.log('  e-posta      : ' + sonuc.veri.eposta);
console.log('  hizmet       : ' + sonuc.veri.hizmet);
console.log('  tutar        : ' + sonuc.veri.tutar);
console.log('');
console.log('=== TARIHLER ===');
console.log('  bugun        : ' + sonuc.tarih.bugun);
console.log('  gecerlilik   : ' + sonuc.tarih.gecerlilik + '  (' + sonuc.tarih.gun + ' gun)');
console.log('  ay klasoru   : ' + sonuc.tarih.ay_klasoru);
console.log('');
console.log('=== YAZILACAK HUCRELER (basliktan bulundu) ===');
console.log('  durum           -> ' + H(kolon.durum) + sonuc.satir);
console.log('  teklif_linki    -> ' + H(kolon.teklif_linki) + sonuc.satir);
console.log('  gonderim_tarihi -> ' + H(kolon.gonderim_tarihi) + sonuc.satir);
console.log('  pdf             -> ' + H(kolon.pdf) + sonuc.satir);
console.log('');
console.log('secim yazildi: ' + ciktiYolu);
