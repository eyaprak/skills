---
name: fatura-kutusu
description: "Drive'a atılan faturaları okur, kontrol eder, Sheets'e kaydeder, Telegram'a raporlar. Kurulumu sohbetten adım adım kendisi yürütür."
version: 2.1.0
metadata:
  hermes:
    tags: [fatura, kutu, belge, invoice, drive, sheets, telegram, ocr, isleme, kurulum]
    related_skills: [google-workspace]
required_environment_variables:
  - MISTRAL_API_KEY
  - TELEGRAM_BOT_TOKEN
---

# Fatura Kutusu

Kullanıcı `01-Gelen` klasörüne belge atar. Sen belgeyi okur, alanları çıkarırsın. Geri kalan her şeyi (üç kontrol, tabloya yazma, dosya taşıma, adlandırma, Telegram raporu) `scripts/fatura_kutusu.py` yapar.

Kullanıcı kod bilmiyor ve terminal görmeyecek. Her adımı sen sohbetten yürütürsün: komutu sen çalıştırırsın, sonucu sade Türkçe ile anlatırsın. Kullanıcıya hiçbir zaman "şu komutu çalıştır" deme.

**Kendi script'ini yazma. Subagent açma. Bu dosyadaki komutlar dışında Drive, Sheets ya da Telegram'a dokunma.** İhtiyacın olan her işlem için komut var; yoksa kullanıcıya söyle, kendin üretme.

## Komut kısaltması

```bash
KUTU="${HERMES_HOME:-/opt/data}/.venv/bin/python ${HERMES_HOME:-/opt/data}/skills/productivity/fatura-kutusu/scripts/fatura_kutusu.py"
```

Her komut tek satır JSON döner. `"ok": false` gelirse `hata` alanını kullanıcıya sade dille aktar; komutu değiştirerek yeniden deneme.

## Her çağrıda ilk iş

```bash
$KUTU durum
```

`asama` alanına göre aşağıdaki bölüme git. Aşamalar sıralıdır; biri bitince `durum` komutunu tekrar çalıştırıp sıradakine geç. Kullanıcı "fatura kutusunu kur" derse bu zinciri baştan sona, her aşamada ne yaptığını tek cümleyle söyleyerek yürüt.

| asama | Bölüm |
|---|---|
| `GOOGLE_GEREKLI` | 1. Google bağlantısı |
| `MISTRAL_GEREKLI` | 2. Mistral anahtarı |
| `KURULUM_GEREKLI` | 3. Klasörler ve tablo |
| `KURULUM_BOZUK` | Kullanıcıya hangi klasörün erişilemediğini söyle; onaylarsa `$KUTU kur --yeniden` |
| `TELEGRAM_EKSIK` | 4. İşleme yapılabilir; rapor için 5. Telegram |
| `HAZIR` | 4. İşleme, ya da kullanıcı isterse 6. Otomatiğe alma |

## 1. Google bağlantısı

`google-workspace` becerisini yükle ve oradaki First-Time Setup akışını **şu farklarla** yürüt:

- Setup'ın "hangi servisler" ve "Advanced Protection" sorularını kullanıcıya **sorma**. Servisler: `drive,sheets,docs`. Advanced Protection: hayır varsay.
- Cloud Console adımlarını Türkçe, kısa ve numaralı ver:
  1. console.cloud.google.com adresine gir, bir proje seç ya da oluştur.
  2. "APIs & Services" içinde "Library" bölümünden Google Drive API, Google Sheets API ve Google Docs API'yi etkinleştir.
  3. "Credentials" bölümünde "Create credentials", "OAuth client ID" seç. Uygulama tipi **Desktop app** olsun; Web application seçilirse çalışmaz.
  4. Oluşan istemcinin JSON dosyasını indir.
  5. "OAuth consent screen", "Audience" bölümünde kendi Google hesabını test kullanıcısı olarak ekle.
- JSON'u dosya yolu olarak değil **içerik olarak** iste: "İndirdiğin JSON dosyasını bir metin düzenleyicide aç, içindekilerin tamamını kopyalayıp buraya yapıştır." Gelen içeriği `$HERMES_HOME/google_client_secret.json` olarak kaydet ve setup'a ver.
- Yetkilendirme bağlantısını ver. Önceden söyle: "İzin verdikten sonra sayfa hata verecek, bu normal. Adres çubuğundaki adresin tamamını kopyalayıp bana yapıştır."
- Bitince kullanıcıya "Google bağlandı" de, `$KUTU durum` çalıştır, 2. aşamaya geç.

## 2. Mistral anahtarı

Fotoğrafla çekilmiş ve taranmış belgeler Mistral OCR ile okunur. Kullanıcıya şunu söyle:

> Fotoğrafları okuyabilmem için bir Mistral anahtarı gerekiyor. console.mistral.ai adresine gir, "API Keys" bölümünden yeni bir anahtar oluştur ve buraya yapıştır.

Anahtar gelince:

```bash
$KUTU anahtar mistral=<anahtar>
```

Komut anahtarı doğrular ve `.env` dosyasına yazar. Anahtarı sohbette tekrar etme, loglama, özetleme. Sonra `$KUTU durum`, 3. aşamaya geç.

Kullanıcı "fotoğraf kullanmayacağım, atla" derse: PDF'lerin işleneceğini, fotoğrafların işlenmeyeceğini söyle ve `.env` dosyasına `MISTRAL_API_KEY=atla` yaz; script bu değeri anahtar yok sayar ama aşama geçilir.

## 3. Klasörler ve tablo

Kullanıcıya "Drive'da klasörleri ve kayıt tablosunu kuruyorum" de. Sonra:

```bash
$KUTU kur
```

Çıktıdaki `baglantilar` alanından ana klasör ve tablo bağlantısını ver. Sonra şunu söyle:

> Kurulum bitti. Test için 01-Gelen klasörüne bir fatura at (PDF ya da fotoğraf), sonra bana "belgeleri işle" de.

Klasör ve tablo adlarını değiştirmek isterse: `$KUTU kur --ana-klasor "Muhasebe" --tablo "Faturalar"`.

Config `$HERMES_HOME/fatura-kutusu/config.json` içinde durur; elle düzenleme, `$KUTU ayarla` kullan.

## 4. İşleme

```bash
$KUTU listele
```

`adet` sıfırsa: sohbette "yeni belge yok" de. Zamanlanmış görevden çalışıyorsan hiçbir şey söyleme, sessiz bitir.

Her dosya için sırayla, biri bitmeden diğerine geçmeden:

**4a. Oku**

```bash
$KUTU oku <file_id>
```

`metin` alanı belgenin ham metnidir. `kaynak` ya `pdf-metin` ya `ocr` olur; ikisine de aynı davran.

**4b. Alanları çıkar**

Metinden şu sekiz alanı çıkar ve JSON yap:

```json
{"fatura_no": "2026000147", "fatura_tarihi": "2026-09-08", "firma": "Mavi Ofis Bilişim Ltd. Şti.",
 "vergi_no": "1234567890", "ara_toplam": 4500.00, "kdv": 900.00, "genel_toplam": 5400.00, "vade": "2026-10-08"}
```

Kurallar:
- Belgede **açıkça yazan** değeri al. Yazmıyorsa ya da emin değilsen `null` bırak. Tahmin etme, hesaplama, "muhtemelen" deme.
- Tutarları düz sayı olarak ver (`5400.00`). TL yazma, binlik ayırıcı koyma. Belgede `5.400,00 TL` yazıyorsa `5400.00`.
- Tarihleri `YYYY-MM-DD` biçimine çevir. Belgede `08.09.2026` yazıyorsa `2026-09-08`.
- Ara toplam ile KDV'nin toplamı genel toplamı vermiyorsa **hiçbirini düzeltme**. Üçünü belgede yazdığı gibi ver; tutarsızlığı script yakalar ve kullanıcıya sorar. Bu, sistemin en önemli kuralıdır.
- Fiş, dekont, sipariş formu gibi fatura olmayan bir belgeyse alanları zorlama; olmayanları `null` bırak, kaydet komutuna ver. Script "kontrol bekliyor" olarak işaretler.

**4c. Kaydet**

```bash
$KUTU kaydet <file_id> --alanlar '<json>'
```

Script şunları yapar: mükerrer kontrolü (tabloyu her seferinde taze okur), tutar eşitliği, zorunlu alanlar; sonuca göre tabloya satır, dosyayı doğru klasöre taşıma ve adlandırma, Telegram raporu. `durum` üç değerden biridir: `Kayitli`, `Kontrol Bekliyor`, `Mukerrer`.

**4d. Özetle**

Bütün dosyalar bitince kullanıcıya kısa bir liste ver: dosya adı, durum, varsa sebep. Telegram'a giden raporu sohbette tekrar etme.

İlk test başarılıysa kullanıcıya şunu söyle: "Sistem çalışıyor. İstersen 'otomatiğe al' de, ben saat başı klasöre bakıp işleyeyim, ay sonunda da özet göndereyim."

## 5. Telegram

`durum` komutu chat_id'yi Hermes'in kendi ayarlarından bulmaya çalışır ve bulursa kaydeder (`telegram_chat_id_kaynagi` alanına bak). Bulduysa yalnızca deneme mesajı at:

```bash
$KUTU telegram-test
```

Bulamadıysa:
- Sen Hermes olarak home kanalının chat_id'sini biliyorsan `$KUTU ayarla telegram_chat_id=<id>` ile yaz, sonra `telegram-test`.
- Bilmiyorsan kullanıcıya: "Telegram'da @userinfobot adlı bota herhangi bir mesaj at, sana bir 'Id' numarası verecek, onu buraya yapıştır." Gelen sayıyı `ayarla` ile yaz, `telegram-test` ile dene.
- `.env` içinde `TELEGRAM_BOT_TOKEN` yoksa: Hermes'in Telegram gateway'i için kullanılan bot token'ı aynı anahtardır. Bulamıyorsan kullanıcıdan iste ve `$KUTU anahtar telegram=<token>` ile kaydet. Token'ı sohbete yazma.

Deneme mesajı düştüyse "Telegram bağlandı, artık her işlenen belge için oraya rapor gelecek" de.

## 6. Otomatiğe alma

Kullanıcı "otomatiğe al", "artık kendisi çalışsın" ya da benzeri bir şey derse: önce `$KUTU durum` çalıştır, `asama` `HAZIR` değilse eksik aşamayı tamamla. Sonra iki zamanlanmış görev oluştur.

**Görev 1, her saat başı:**

> fatura-kutusu becerisini yükle. durum komutunu çalıştır; aşama HAZIR değilse hiçbir şey yapma. listele ile 01-Gelen klasörüne bak. Dosya yoksa sessizce bitir, mesaj gönderme. Dosya varsa her birini beceride yazdığı gibi oku, alanları çıkar, kaydet. Telegram raporlarını script gönderir; sen ayrıca mesaj atma.

**Görev 2, her ayın 1'i saat 09:00:**

> fatura-kutusu becerisini yükle ve rapor komutunu çalıştır. Geçen ayın özeti Telegram'a gider. Sen ayrıca mesaj atma.

Kurduktan sonra kullanıcıya söyle: "İki görev kurdum: saat başı klasöre bakıyorum, her ayın 1'inde özet gönderiyorum. Bilgisayarın kapalıyken de çalışır."

## Yapmayacakların

- Drive API, Sheets API ya da Telegram API'yi doğrudan çağırma. Komutlar var.
- Tutarları düzeltme, eksik alanı doldurma, tarih tahmin etme.
- Mükerrer için "az önce işlendi" hafızana güvenme; kontrol script'te.
- Birden fazla dosya için subagent açma, toplu döngü kurma. Sırayla: oku, alan çıkar, kaydet.
- `config.json` ya da `.env` dosyasını elle düzenleme; `ayarla` ve `anahtar` komutları var.
- Kullanıcıya terminal komutu verme. Komutları sen çalıştırırsın.

## Sorun giderme

- `oku` OCR hatası veriyorsa: `durum` çıktısındaki `mistral_key` alanına bak; anahtar geçersiz olabilir, 2. aşamayı tekrar et.
- `kaydet` içinde `telegram: gonderilemedi` görürsen işlem tamamlanmıştır, yalnızca rapor gitmemiştir. Kullanıcıya söyle, 5. aşamayı çalıştır.
- `durum` `GOOGLE_GEREKLI` diyorsa ve Google daha önce bağlandıysa: `google.hata` metnini kullanıcıya sade dille aktar; genelde token süresi dolmuştur, 1. aşamayı tekrar et.

## Başka belge türleri

`references/uyarlama.md` dosyasına bak. Zorunlu alanlar `$KUTU ayarla zorunlu_alanlar=fatura_no,firma,genel_toplam` ile değiştirilebilir.
