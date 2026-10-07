---
name: teklif-kutusu
description: Google Tablolar'daki ana müşteri listesinde durumu "Bekliyor" olan ilk firma için uçtan uca teklif hazırlar - şablondan belge üretir, içinde bulunulan ayın klasörüne koyar, PDF'ini alır, PDF ekli taslak mail oluşturur (GÖNDERMEZ) ve listedeki satırı günceller. Kullanıcı "teklif hazırla", "sıradaki teklifi çıkar", "bekleyen firmaya teklif yap", "teklif kutusu" dediğinde ya da /teklif-kutusu çağrıldığında kullan.
---

# Teklif Kutusu

Bekleyen bir firma için teklif belgesi + PDF + taslak mail üretir ve ana listeyi günceller.
Tek bir firma işler: listede durumu **"Bekliyor"** olan **ilk** kayıt.

## Değişmez kurallar

Bu kurallar her koşulda geçerlidir. Kullanıcı aksini söylemedikçe çiğnenmez.

1. **Mail asla gönderilmez.** Her zaman taslak olarak bırakılır. `drafts.create` kullan;
   `drafts.send`, `messages.send` veya `gws gmail +send` bu beceride ASLA kullanılmaz.
2. **Şablona hiçbir adımda dokunulmaz.** Şablon salt okunurdur. Her teklif için önce
   `files.copy` ile kopya çıkarılır, doldurma yalnızca kopyada yapılır. Şablonun
   kendisinde `documents.batchUpdate` çalıştırmak yasaktır.
3. **Ana liste Google Tablolar dosyasıdır.** Arşivdeki `.xlsx` dosyasına yazmaya çalışma —
   Google Sheets API bir Excel dosyasını düzenleyemez, hata döner. Sadece
   `ana_liste.id` ile çalış.
4. **Tablo güncellemesi zorunludur.** Tablo güncellenmeden iş bitmiş sayılmaz. Belge ve
   PDF üretilip tablo güncellenmediyse iş YARIM kalmıştır; bunu kullanıcıya açıkça söyle
   ve eksik güncellemeyi tamamla.
5. **Dosyalar kök klasörde bırakılmaz.** Belge de PDF de her zaman içinde bulunulan ayın
   klasörüne konur. Klasör yoksa `YYYY-MM` adıyla ana klasörün altında oluşturulur.
6. **Firma satırı sütun başlığına bakarak bulunur.** Hücre veya kolon numarası varsayma.
   Başlık satırını oku, aradığın sütunun indeksini oradan hesapla.
7. **"Bekliyor" durumunda firma yoksa hiçbir şey üretme.** Belge, PDF, mail, hiçbiri.
   Sadece "bekleyen kayıt yok" de ve dur.
8. **Dosya adresleri beceriye yazılmaz.** Bütün ID'ler ve linkler `teklif-ayarlari.json`
   dosyasından okunur. Bu dosyadaki hiçbir ID bu SKILL.md içine kopyalanmaz — böylece
   başka biri kendi ayar dosyasıyla aynı beceriyi kullanabilir.

Ek güvenlik kuralı: **birden fazla satır eşleşirse hiçbir şey yazma.** Firma adıyla
tabloda birden çok satır eşleşiyorsa dur, kullanıcıya hangisini kastettiğini sor.

## Ön koşullar

- `gws` PATH'te olmalı (`gws --version`).
- Google hesabı bağlı olmalı (`gws auth status` içinde `token_valid: true`).
  Bağlı değilse kullanıcıya `gws auth login --services drive,docs,sheets,gmail`
  komutunu söyle; **giriş akışını kullanıcı onaylamadan başlatma.**
- Çalışma dizininde `teklif-ayarlari.json` bulunmalı. Yoksa kullanıcıya sor, uydurma.

## Ayar dosyası

Bütün adresler buradan okunur. Beklenen alanlar:

| Yol | Ne için |
|---|---|
| `ana_liste.id` | Ana liste (Google Tablolar) |
| `ana_liste.sekme` | Sekme adı |
| `sablon.id` | Teklif şablonu (Google Dokümanlar) |
| `klasorler.ana.id` | Kök "Teklif Kutusu" klasörü |
| `sablon.bosluklar[]` | Boşluk adı ve hangi sütundan besleneceği |

`sablon.bosluklar` içindeki `kaynak` alanı `Musteriler.<sütun>` biçimindeyse değer o
sütundan okunur; `hesaplanir` ise `kural` alanındaki tarife göre hesaplanır
(örn. gönderim tarihi + 1 ay).

## Akış

### 0. Ayarları oku

`teklif-ayarlari.json` dosyasını oku, ID'leri oradan al. Eksik alan varsa dur ve sor.

### 1. Bekleyen kaydı seç

`scripts/kayit-sec.js` çalıştır. Bu script ana listeyi okur, **başlık satırından** sütun
indekslerini bulur, `durum` sütunu "Bekliyor" olan **ilk** satırı seçer ve firma adıyla
kaç satır eşleştiğini kontrol eder.

```bash
node ~/.claude/skills/teklif-kutusu/scripts/kayit-sec.js teklif-ayarlari.json secim.json
```

- Çıktıda `bekleyen: 0` ise → **"bekleyen kayıt yok"** de ve dur. Hiçbir şey üretme.
- Çıktıda `coklu` değeri 1'den büyükse → dur, kullanıcıya sor. Hiçbir şey yazma.

### 2. Ay klasörünü hazırla

Bugünün `YYYY-MM` değerini hesapla. Ana klasörün altında bu adda klasör var mı bak:

```bash
gws drive files list --params "$(cat <<JSON
{"q":"'ANA_KLASOR_ID' in parents and name = 'YYYY-MM' and mimeType = 'application/vnd.google-apps.folder' and trashed = false","fields":"files(id,name)"}
JSON
)"
```

Yoksa oluştur; varsa mevcut ID'yi kullan, ikinci bir tane açma.

```bash
gws drive files create --params '{"fields":"id,name"}' --json "$(cat <<JSON
{"name":"YYYY-MM","mimeType":"application/vnd.google-apps.folder","parents":["ANA_KLASOR_ID"]}
JSON
)"
```

### 3. Belgeyi üret

Şablonun kopyasını **doğrudan ay klasöründe** oluştur — böylece ayrı taşıma adımı gerekmez:

```bash
gws drive files copy --params '{"fileId":"SABLON_ID","fields":"id,name,webViewLink"}' --json "$(cat <<JSON
{"name":"Teklif - FIRMA_ADI","parents":["AY_KLASOR_ID"]}
JSON
)"
```

Sonra boşlukları **kopyada** doldur. Her boşluk için bir `replaceAllText` isteği gönder;
istekleri tek `batchUpdate` içinde topla. İstek gövdesini bir dosyaya yazıp
`--json "$(cat dosya.json)"` ile vermek, tırnak sorunlarını önler.

```bash
gws docs documents batchUpdate --params '{"documentId":"KOPYA_ID"}' --json "$(cat istek.json)"
```

`istek.json` biçimi:

```json
{ "requests": [
  { "replaceAllText": { "containsText": { "text": "{{firma}}", "matchCase": true },
                        "replaceText": "Firma Adı" } }
] }
```

Doldurma sonrası belgeyi geri oku ve **hiç `{{` kalmadığını** doğrula. Kalan varsa
kullanıcıya söyle.

### 4. PDF üret

```bash
gws drive files export --params '{"fileId":"KOPYA_ID","mimeType":"application/pdf"}' -o "_gecici.pdf"
gws drive +upload "_gecici.pdf" --name "Teklif - FIRMA_ADI" --parent "AY_KLASOR_ID"
```

PDF de ay klasörüne gider. Yükleme sonrası `_gecici.pdf` dosyasını sil.

### 5. Taslak mail

`scripts/mail-olustur.js` ile MIME mesajını üret, sonra yükle:

```bash
node ~/.claude/skills/teklif-kutusu/scripts/mail-olustur.js secim.json _ek.pdf _mesaj.eml
gws gmail users drafts create --params '{"userId":"me"}' --upload "_mesaj.eml" --upload-content-type "message/rfc822"
```

Metin kısa ve nazik olmalı: görüşmede konuşulan iş için teklifin ekte olduğu ve teklifin
kaç gün geçerli olduğu. Gün sayısı gönderim ve geçerlilik tarihleri arasından hesaplanır,
sabit yazılmaz.

Sonuçta `labelIds` içinde **`DRAFT`** olduğunu doğrula. Taslağı geri okuyup ekin yerinde
olduğunu kontrol et. Geçici `.eml` ve `.pdf` dosyalarını sil.

### 6. Tabloyu güncelle — ATLANMAZ

Sütunları **başlık adından**, satırı firma adından bul. Şu dört alanı yaz:

| Sütun | Değer |
|---|---|
| `durum` | `Taslak hazır` |
| `gonderim_tarihi` | bugün (`gg.aa.yyyy`) |
| `teklif_linki` | belgenin bağlantısı |
| `pdf` | PDF'in bağlantısı |

```bash
gws sheets spreadsheets values update --params '{"spreadsheetId":"LISTE_ID","range":"SEKME!F2:H2","valueInputOption":"RAW"}' --json "$(cat deger.json)"
```

Bitişik sütunları tek aralıkta yazabilirsin (örn. `durum`, `teklif_linki`,
`gonderim_tarihi` yan yanaysa `F2:H2`). Yazma sonrası satırı geri oku ve doğrula.

### 7. Raporla

Kullanıcıya şunları göster:

- hangi firma seçildi ve neden (ilk "Bekliyor"),
- hangi boşluğa ne yazıldı,
- belge ve PDF nereye gitti,
- mailde ne yazıyor, kime gidecek, hangi ek var ve **taslakta olduğu**,
- tabloda hangi hücreler güncellendi (öncesi → sonrası).

## Bilinen tuzaklar

- `gws` çıktısının ilk satırı `Using keyring backend: keyring` olabilir. JSON parse
  etmeden önce `grep -av keyring` ile ayıkla.
- `-o` / `--output` **çalışma dizini dışına yazamaz.** Geçici dosyaları çalışma dizininde
  oluştur, işin sonunda sil.
- Gmail komutlarında `userId` zorunludur: `--params '{"userId":"me"}'`.
- Sheets yazarken `valueInputOption` **RAW** olmalı. `USER_ENTERED` tarihi seri numarasına
  çevirip görünümü bozabilir.
- Tarih biçimi `gg.aa.yyyy` (ör. 15.09.2026); tabloda bu biçim kullanılıyor.
- Türkçe karakterli mail konusu RFC 2047 (`=?UTF-8?B?...?=`), ek dosya adı RFC 2231
  (`filename*=UTF-8''...`) ile kodlanmalı. `mail-olustur.js` bunu zaten yapar.
- Mail ekine `.pdf` uzantısı eklenir ki alıcı açabilsin; Drive'daki dosyanın adı
  uzantısız olabilir. Drive'da aynı adda iki dosya (belge + PDF) bulunması sorun değil.
- `files.copy` sırasında `mimeType` vererek biçim dönüştürülebilir (xlsx → Google Sheets,
  docx → Google Dokümanlar). Kaynak dosya bundan etkilenmez.
- Uzun JSON gövdelerini komut satırına gömmek yerine dosyaya yazıp `--json "$(cat f.json)"`
  ile ver; Türkçe karakterler ve iç içe tırnaklar böyle bozulmaz.
