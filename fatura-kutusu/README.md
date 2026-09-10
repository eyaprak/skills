# fatura-kutusu

**Hermes Agent** skill'i. Google Drive'da bir klasöre attığın faturaları okur, kontrol eder, Google Sheets'e belgenin bağlantısıyla birlikte kaydeder, tutmayan belgeyi kaydetmeyip Telegram'dan sorar, ay sonunda özet gönderir. Bilgisayarın kapalıyken de çalışır, çünkü sunucudaki Hermes çalıştırır.

Bu bir Claude Code skill'i değil; sunucuda çalışan [Hermes Agent](https://github.com/NousResearch/hermes-agent) için yazıldı. Terminal yok, komut yok: Hermes'e tek bir mesaj yazıyorsun, gerisini o yapıyor.

## Ne yapar

```
Telefonundan 01-Gelen klasörüne fatura atarsın
        │
        ▼
Hermes belgeyi okur (PDF ise doğrudan, fotoğrafsa Mistral OCR ile)
        │
        ▼
Script üç kontrol yapar: tutar eşitliği · zorunlu alanlar · mükerrer
        │
   ┌────┴─────────────────────┐
   ▼                          ▼
Geçti                       Geçmedi
tabloya satır               kaydetmez
02-Islenen/2026-09 altına   03-Hatali klasörüne alır
adı: tarih_firma_tutar      Telegram'dan neyin tutmadığını söyler
Telegram'a "kaydedildi"
```

Kontroller modelin talimatı değil, `scripts/fatura_kutusu.py` içindeki kod. Model yalnızca belgeyi okuyup alanları çıkarır; tutarı düzeltmeye kalksa bile script belgedeki değeri alır ve farkı raporlar.

## Başlamadan önce

- Hermes sunucuda kurulu, bir model seçili, Telegram bağlı ve home kanalı ayarlı.
- Google hesabı (Drive ve Sheets için). İzin adımını Hermes tarif eder.
- İsteğe bağlı: fotoğrafla çekilmiş fatura kullanacaksan bir [Mistral](https://console.mistral.ai) API anahtarı. Yalnızca PDF kullanacaksan gerekmez.

Toplam süre yaklaşık 20 dakika; bunun 10 dakikası Google tarafındaki tek seferlik izin.

---

## 1. Tek mesajla kur

Hermes'e şunu yaz:

> Şu adresteki kurulum talimatını oku ve adımları sırayla uygula: https://raw.githubusercontent.com/eyaprak/skills/main/fatura-kutusu/INSTALL.md

Hermes talimat dosyasını okur, paketi indirip doğru yere koyar ve kurulumu hemen başlatır. Sırayla üç şey ister.

**Google izni.** Hermes beş adımlık bir yol tarif eder; hepsi tarayıcıda, Google Cloud Console'da:

1. Bir proje seç ya da oluştur
2. Drive, Sheets ve Docs API'lerini etkinleştir
3. OAuth client ID oluştur, tipi **Desktop app** olsun (Web seçersen çalışmaz)
4. JSON dosyasını indir, içeriğini kopyalayıp Hermes'e yapıştır
5. Kendi hesabını test kullanıcısı olarak ekle

Sonra Hermes bir izin bağlantısı verir. Tıkla, izin ver. Sayfa hata verir gibi görünecek, bu normal: adres çubuğundaki adresi kopyalayıp Hermes'e yapıştır.

**Mistral anahtarı.** console.mistral.ai adresinde API Keys bölümünden bir anahtar oluştur, Hermes'e yapıştır. Sadece PDF kullanacaksan "atla" de.

**Klasörler ve tablo.** Hermes Drive'da `Fatura-Kutusu` klasörünü, içinde `01-Gelen`, `02-Islenen`, `03-Hatali` klasörlerini ve `Fatura Kayitlari` tablosunu kurar; linklerini verir.

## 2. Test et

`01-Gelen` klasörüne bir fatura at (PDF ya da fotoğraf), sonra:

> Belgeleri işle

Tabloda yeni satırı, son sütundaki "Görüntüle" bağlantısını ve Telegram'a düşen raporu gör.

İkinci test olarak toplamı tutmayan bir belge at. Hermes kaydetmemeli, belgeyi `03-Hatali` klasörüne alıp Telegram'dan neyin tutmadığını söylemeli. Bu davranışı görmeden otomatiğe alma.

Telegram raporu gelmediyse:

> Telegram'a bağla

## 3. Otomatiğe al

> Otomatiğe al

Hermes iki zamanlanmış görev kurar: saat başı `01-Gelen` klasörüne bakar, her ayın 1'inde geçen ayın özetini gönderir.

---

## Tablo sütunları

| Sütun | Ne tutar |
|---|---|
| Islenme Tarihi | Belgenin sisteme işlendiği tarih |
| Fatura No | Mükerrer kontrolü bu sütundan yapılır |
| Fatura Tarihi · Firma · Vergi No | Belgeden okunan kimlik alanları |
| Ara Toplam · KDV · Genel Toplam | Tutar kontrolü bu üçünden yapılır |
| Vade | Varsa son ödeme tarihi |
| Durum | `Kayitli`, `Kontrol Bekliyor` ya da `Mukerrer` |
| Belge | Tıklanabilir "Görüntüle" bağlantısı, orijinal dosyayı açar |

## Sık takılınan yerler

**"Erişim engellendi" uyarısı.** Google tarafında kendi hesabını test kullanıcısı olarak eklemedin. Ekle, Hermes'e "Google iznini tekrar dene" de.

**İzin bağlantısı hata sayfasına düşüyor.** Normal. Adres çubuğundaki adresi kopyalayıp Hermes'e yapıştır.

**Hiç bağlanmıyor.** OAuth client tipi Web application olarak açılmış olabilir. Sil, Desktop app olarak yeniden oluştur, yeni JSON'u yapıştır.

**Zamanlanmış görev çalışıyor ama mesaj gelmiyor.** Telegram home kanalı ayarlanmamış. Telefondan bota bir mesaj at, gelen uyarıdaki bağlantıyla home kanalını ayarla, sonra "Telegram'a bağla" de.

**Belge işlenmiyor.** Dosyayı `01-Gelen` dışında bir klasöre atmış olabilirsin. Sistem yalnızca o klasöre bakar.

**Aynı belge iki kez kaydedildi.** Belgede fatura numarası okunamamış. Tabloda Fatura No sütunu boş olan satırları kontrol et.

## Başka belge türleri

Fiş, sözleşme ve sipariş belgeleri için [references/uyarlama.md](./references/uyarlama.md).

## Sınırlar

Bu sistem muhasebecinin yerini almaz; belgeleri toplayıp düzenli bir tabloya ve düzenli klasörlere çevirir. Bir faturanın tabloya düşmesi ödendiği anlamına gelmez, ödeme takibi bu akışta yok. Belgeler senin Google hesabında, kayıtlar senin tablonda, asistan senin sunucunda çalışır.

## Dosyalar

```
fatura-kutusu/
├── README.md              ← bu dosya
├── INSTALL.md             ← Hermes'in okuyup uyguladığı kurulum talimatı
├── SKILL.md               ← Hermes'in okuduğu talimat: aşamalar, komutlar, kurallar
├── scripts/fatura_kutusu.py       ← kurulum, okuma, kontroller, Sheets, Drive, Telegram, rapor
└── references/uyarlama.md ← başka belge türlerine uyarlama
```

Kurulumda üretilen `config.json` (klasör ve tablo kimlikleri) skill klasörünün dışında, `$HERMES_HOME/fatura-kutusu/` altında durur; paket temiz kalır.
