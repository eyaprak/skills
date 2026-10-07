#!/usr/bin/env node
/**
 * PDF ekli, gonderilmeye hazir MIME mesaji uretir (.eml).
 * Mesaji GONDERMEZ - sadece dosyaya yazar. Yukleme cagiran tarafta:
 *   gws gmail users drafts create --params '{"userId":"me"}' \
 *       --upload <cikti.eml> --upload-content-type "message/rfc822"
 *
 * Kullanim:
 *   node mail-olustur.js <secim.json> <ek.pdf> <cikti.eml>
 *
 * Turkce karakterler: konu RFC 2047 (=?UTF-8?B?..?=), ek adi RFC 2231
 * (filename*=UTF-8''..), govde base64/UTF-8 ile kodlanir.
 */
const fs = require('fs');

const [, , secimYolu, pdfYolu, ciktiYolu] = process.argv;
if (!secimYolu || !pdfYolu || !ciktiYolu) {
  console.error('kullanim: node mail-olustur.js <secim.json> <ek.pdf> <cikti.eml>');
  process.exit(2);
}

const s = JSON.parse(fs.readFileSync(secimYolu, 'utf8'));
const { firma, yetkili, eposta, hizmet } = s.veri;
const { gun, gecerlilik } = s.tarih;
const gonderen = s.gonderen;

if (!eposta) { console.error('HATA: secimde e-posta yok.'); process.exit(2); }
if (!gonderen) { console.error('HATA: gonderen adresi yok (ayar dosyasindaki "hesap" alani).'); process.exit(2); }

// "Kurumsal web sitesi yenileme" -> cumle icinde kucuk harfle baslasin
const hizmetCumle = hizmet ? hizmet.charAt(0).toLocaleLowerCase('tr-TR') + hizmet.slice(1) : '';

const konu = `${hizmet} – Fiyat Teklifimiz`;
const govde = `Sayın ${yetkili},

Görüşmemizde konuştuğumuz ${hizmetCumle} işine ilişkin fiyat teklifimizi ekte iletiyoruz.

Teklifimiz ${gun} gün geçerlidir; son geçerlilik tarihi ${gecerlilik}'dır.

Değerlendirmeniz için şimdiden teşekkür ederiz.

Saygılarımızla,
Satış ve Teklif Birimi
`;

// Drive'daki dosya adi uzantisiz olabilir; ek MUTLAKA .pdf uzantili gitsin
const ekAdi = `Teklif - ${firma}.pdf`;

const b64 = metin => Buffer.from(metin, 'utf8').toString('base64');
const sar = metin => metin.replace(/(.{76})/g, '$1\r\n');
const url = metin => encodeURIComponent(metin).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

const pdfB64 = sar(fs.readFileSync(pdfYolu).toString('base64'));
const sinir = '===teklif_' + Date.now() + '===';

const mime = [
  'From: ' + gonderen,
  'To: ' + eposta,
  'Subject: =?UTF-8?B?' + b64(konu) + '?=',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="' + sinir + '"',
  '',
  '--' + sinir,
  'Content-Type: text/plain; charset="UTF-8"',
  'Content-Transfer-Encoding: base64',
  '',
  sar(b64(govde)),
  '',
  '--' + sinir,
  "Content-Type: application/pdf; name*=UTF-8''" + url(ekAdi),
  "Content-Disposition: attachment; filename*=UTF-8''" + url(ekAdi),
  'Content-Transfer-Encoding: base64',
  '',
  pdfB64,
  '',
  '--' + sinir + '--',
  ''
].join('\r\n');

fs.writeFileSync(ciktiYolu, mime, 'utf8');

console.log('--- KIME ---');
console.log(eposta + '  (' + yetkili + ')');
console.log('');
console.log('--- KONU ---');
console.log(konu);
console.log('');
console.log('--- GOVDE ---');
console.log(govde);
console.log('--- EK ---');
console.log(ekAdi + '  (' + fs.statSync(pdfYolu).size + ' bayt)');
console.log('');
console.log('mesaj yazildi: ' + ciktiYolu + '  (' + fs.statSync(ciktiYolu).size + ' bayt)');
console.log('NOT: Bu dosya sadece TASLAK olarak yuklenir. Gonderme yok.');
