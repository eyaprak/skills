# teklif-kutusu

**Claude Code** skill'i. Google Tablolar'daki müşteri listende durumu **"Bekliyor"** olan ilk firmayı alır, Google Dokümanlar şablonundan o firmaya özel teklif belgesi üretir, PDF'ini çıkarır, ikisini de içinde bulunulan ayın klasörüne koyar, PDF ekli bir **taslak** mail hazırlar ve listedeki satırı günceller.

Mail **asla gönderilmez**; her zaman Gmail'de taslak olarak bekler. Son kontrol ve "Gönder" tuşu senin.

## Ne yapar

```
"sıradaki teklifi çıkar"
        │
        ▼
Listeyi okur, sütunları başlıktan bulur, ilk "Bekliyor" satırını seçer
        │
   ┌────┴──────────────────────┐
   ▼                           ▼
Bekleyen yok / aynı firma     Tek ve net bir kayıt
birden çok satırda            │
hiçbir şey üretmez, durur     ▼
                       Teklif Kutusu/2026-10 klasörü (yoksa açar)
                              │
                              ▼
                       Şablonun KOPYASINI çıkarır, {{boşlukları}} doldurur
                              │
                              ▼
                       PDF'ini alır, aynı ay klasörüne koyar
                              │
                              ▼
                       PDF ekli taslak mail (göndermez)
                              │
                              ▼
                       Listede: durum = "Taslak hazır", tarih, belge ve PDF linki
```

Bir çalıştırma tek firma işler. Birden fazla bekleyen varsa skill'i tekrar çağırırsın.

## Değişmez kurallar

Skill'in içine yazılı, kullanıcı aksini söylemedikçe çiğnenmeyen kurallar:

- **Mail gönderilmez**, yalnızca taslak oluşturulur.
- **Şablona dokunulmaz**; her teklif şablonun kopyasında doldurulur.
- **Tablo güncellenmeden iş bitmiş sayılmaz**; eksik kalırsa skill bunu açıkça söyler.
- **Dosyalar kök klasörde bırakılmaz**; her zaman `YYYY-MM` ay klasörüne gider.
- **Sütun numarası varsayılmaz**; her şey başlık satırındaki adlardan bulunur.
- **Bekleyen kayıt yoksa ya da aynı firma adı birden çok satırda geçiyorsa hiçbir şey yazılmaz.**
- **Dosya kimlikleri skill'e gömülmez**; hepsi `teklif-ayarlari.json` dosyasından okunur. Aynı skill'i herkes kendi ayar dosyasıyla kullanabilir.

## Başlamadan önce

- **Node.js** (18+)
- **Google Workspace CLI** (`gws`), PATH'te:

  ```bash
  npm install -g @googleworkspace/cli
  ```

- Google hesabının `gws`'ye bağlanmış olması:

  ```bash
  gws auth login --services drive,docs,sheets,gmail
  ```

  Bağlantıyı `gws auth status` ile kontrol et; çıktıda `token_valid: true` görmelisin.

## Kurulum

1. `teklif-kutusu` klasörünü kişisel skill dizinine kopyala (ayrıntı için kökteki [README](../README.md#-kurulum)):

   ```bash
   cp -r skills/teklif-kutusu ~/.claude/skills/
   ```

   Skill, script'leri `~/.claude/skills/teklif-kutusu/scripts/` altından çağırır; klasör adını ve yerini değiştirme.

2. Google Drive'da şunları hazırla:

   | Ne | Ayrıntı |
   |---|---|
   | Ana klasör | Örn. `Teklif Kutusu`. Ay klasörlerini (`2026-10` gibi) skill kendisi açar. |
   | Müşteri listesi | **Google Tablolar** dosyası (`.xlsx` değil — Sheets API Excel dosyasına yazamaz). Başlıklar aşağıda. |
   | Teklif şablonu | **Google Dokümanlar** dosyası; değişecek yerlerde `{{firma}}` gibi boşluklar. |

3. Çalışacağın klasörde `teklif-ayarlari.ornek.json` dosyasını `teklif-ayarlari.json` adıyla kopyala ve `BURAYA_...` alanlarını doldur. Kimlik, Drive linkindeki uzun kısımdır: `docs.google.com/document/d/`**`<kimlik>`**`/edit`.

## Müşteri listesi sütunları

Sıra önemli değil, skill sütunları başlık adından bulur. Başlıklar birebir şöyle olmalı:

| Sütun | Ne tutar |
|---|---|
| `firma` | Firma adı; belge ve PDF adı buradan gelir |
| `yetkili` | Mailde hitap edilen kişi |
| `e-posta` | Taslak mailin alıcısı |
| `hizmet` | Teklif konusu; mail konusu buradan gelir |
| `tutar` | Teklif tutarı |
| `durum` | `Bekliyor` olan satırlar işlenir; iş bitince `Taslak hazır` yazılır |
| `teklif_linki` | Skill doldurur: belgenin bağlantısı |
| `gonderim_tarihi` | Skill doldurur: bugünün tarihi (`gg.aa.yyyy`) |
| `pdf` | Skill doldurur: PDF'in bağlantısı |

## Şablon boşlukları

Şablonda kullanabileceğin boşluklar ve ayar dosyasındaki karşılıkları:

| Boşluk | Değer |
|---|---|
| `{{firma}}`, `{{yetkili}}`, `{{hizmet}}`, `{{tutar}}` | Listedeki ilgili sütun |
| `{{gonderim_tarihi}}` | Bugün |
| `{{gonderim_tarihi+1ay}}` | Bugünden bir ay sonrası (teklifin geçerlilik tarihi) |

Doldurmadan sonra skill belgeyi geri okur; içinde `{{` kalmışsa sana söyler. Yeni bir boşluk eklersen ayar dosyasındaki `sablon.bosluklar` listesine de ekle.

## Kullanım

Ayar dosyasının bulunduğu klasörde Claude Code'u aç ve yaz:

```
> sıradaki teklifi çıkar
```

ya da `/teklif-kutusu`. Sonunda skill şunları raporlar: hangi firma seçildi, hangi boşluğa ne yazıldı, belge ve PDF nereye gitti, taslak mailin alıcısı, konusu ve eki, tabloda hangi hücrelerin öncesi ve sonrası.

## Sık takılınan yerler

**`gws` bulunamadı.** Google Workspace CLI kurulu değil ya da PATH'te değil. `gws --version` ile kontrol et.

**"Şu başlıklar listede bulunamadı".** Tablodaki başlıklar yukarıdaki adlarla birebir eşleşmiyor. Hata mesajı mevcut başlıkları da listeler; farkı oradan gör.

**Tabloya yazarken hata.** Ayar dosyasındaki `ana_liste.id` bir `.xlsx` dosyasını gösteriyor olabilir. Dosyayı Drive'da *Google E-Tablolar olarak kaydet* ile dönüştür ve yeni kimliği yaz. Sekme adının (`ana_liste.sekme`) da birebir doğru olduğundan emin ol.

**Gönderen adresi yok.** Ayar dosyasında `hesap` alanı boş. `gws`'ye bağladığın Gmail adresini yaz.

## Dosyalar

```
teklif-kutusu/
├── README.md                  ← bu dosya
├── SKILL.md                   ← Claude'un okuduğu talimat: kurallar, akış, komutlar, tuzaklar
├── teklif-ayarlari.ornek.json ← kendi ayar dosyan için kalıp
└── scripts/
    ├── kayit-sec.js           ← listeyi okur, ilk "Bekliyor" satırını seçer, tarihleri hesaplar
    └── mail-olustur.js        ← PDF ekli, Türkçe karakter güvenli taslak mail (.eml) üretir
```

Senin `teklif-ayarlari.json` dosyan skill klasörünün dışında, çalıştığın klasörde durur; paket temiz kalır.
