---
name: medya-tamamla
description: Bir projeyi (oyun, web uygulaması, site) inceleyip eksik müzik, seslendirme (TTS), görsel (ikon, portre, sahne, doku) ve kısa videoyu gemini-api CLI ile üretir. Önce her kalemin nerede kullanılacağını, komutunu, adedini ve resmi fiyatla maliyetini listeleyip onay alır; üretimden önce stil, ses ve müzik kurallarını sorar. Seslendirmeyi dakikada 10 istek sınırına uyarak üretir, çıktıları gemini-api ile denetler, projeye bağlar ve her çağrıyı maliyet.md'ye yazar. Kullanıcı "projeye müzik/ses/seslendirme/görsel/video ekle", "eksik medyayı tamamla", "gemini-api ile asset üret", "oyunun sesleri ve görselleri olsun", "Türkçe seslendirme koy", "SVG ikonları gerçek görsellerle değiştir", "menüye arka plan videosu" ya da "/medya-tamamla" dediğinde, "gemini" demese bile MUTLAKA kullan. Tek görsel düzenleme, video kurgusu (hyperframes, shorts-editor), 3D model ya da kısa ses efekti için kullanma.
---

# medya-tamamla

Bir projenin eksik müzik, seslendirme, görsel ve videolarını gemini-api ile üretip projeye bağlar. Akış dört kapıdan geçer: **liste onayı → kurallar → stil örneği onayı → üretim**. Kapılar boşuna değil: kurallar üretimden sonra gelirse iş baştan yapılır. Bu skill'in çıktığı oturumda stil kuralı geç verildiği için 23 görsel yeniden üretildi. Rol sesleri de sonradan seçildiği için 26 seslendirme satırı yeniden okundu.

Kullanıcıya soru sorarken birden çok şıklı kararlar için `AskUserQuestion` kullan (2–4 şık, önerdiğin şık ilk sırada ve "(Önerilen)" etiketli). Açık uçlu konularda düz metinle sor.

## Gereken araçlar

- **gemini-api CLI:** `gemini-api version` ile bak. PATH'te değilse kullanıcıya yolunu sor ve `GEMINI_API_BIN` ortam değişkeniyle ver.
- **Kimlik doğrulama:** `gemini-api whoami` ile yalnızca anahtarın tanımlı olduğuna bak. Anahtarı ya da maskeli hâlini hiçbir dosyaya, maliyet.md'ye ya da mesaja yazma. Yoksa kullanıcıdan `gemini-api configure` çalıştırmasını iste; anahtarı sohbete yapıştırmasını isteme.
- **ffmpeg ve ffprobe:** İşleme ve süre ölçümü için gerekli.
- **Node.js:** Bu skill'in `scripts/` betikleri için gerekli.

Komut biçimi için önce `gemini-api <komut> --help` ile bak. `--body` kullanacaksan `--schema` ile alanı doğrula, ilk çağrıyı `--dry-run` ile önizle.

## 1. İncele ve listele (hiçbir şey üretme)

1. **Projeyi oku:** giriş dosyası, arayüz metinleri, ses kodu, varlık klasörleri, README/PRD. Her eksik için oyunda ya da sayfada tam olarak nerede görüneceğini ya da duyulacağını bul: dosya ve satır, olay, ekran.
2. **Fiyatları güncel sayfadan oku:** https://ai.google.dev/gemini-api/docs/pricing (WebFetch). Fiyatlar ve tarih geçişleri değişiyor. Okuduğun değerleri ve sayfanın "Last updated" tarihini `scripts/fiyatlar.json` biçiminde projenin `uretim/fiyatlar.json` dosyasına yaz. Skill'deki `scripts/fiyatlar.json` yalnızca son bilinen örnek.
3. **Model ve sınırları gör:** `gemini-api music|tts|image|video --help` ve `gemini-api models`. Modellerin hız sınırlarını da not et; ilk 429 hatasında mesajdaki sınırı kaydet.
4. **Listeyi kategori kategori ver:** müzik, seslendirme, görsel, video. Her kalemde dört bilgi olsun:
   - oyunda tam olarak nerede kullanılacağı,
   - hangi gemini-api komutu ve modeliyle üretileceği,
   - adet ya da saniye,
   - resmi fiyatla tahmini maliyet.

   Sonuna toplam ekle, ayrıca yeniden denemelerle (×2–3) bir aralık ver. 3D model ve kısa ses efektlerini listeye koyma; gerekirse tek satırla bu araçla üretilmediğini söyle.
5. **Onay al:** Kullanıcı hangi kalemleri istediğini söylemeden üretime geçme. Listeyi ayrıca bir dosyaya yazmak gerekmiyor; kullanıcı isterse yaz.

## 2. Kuralları üretimden ÖNCE sor

Onaydan sonra, tek bir üretim çağrısı yapmadan önce kuralları topla. Kullanıcı bir kuralı zaten söylediyse yeniden sorma, uygula. Sorulacaklar ve nedenleri `references/kurallar.md` dosyasında; kısaca:

- **Görsel stil:** sanat stili, palet, arka plan (saydam gerekiyorsa düz magenta üzerinde üretip anahtarlarız), görselde yazı olup olmayacağı. Yazıyı kodla çizmek önerilir, çünkü modeller Türkçe harfleri bozabiliyor.
- **Stil örneği:** önce tek bir stil örneği üretilecek ve diğer her görsel onu ilk referans olarak alacak. Örneği kullanıcıya göster, onay al, sonra devam et.
- **Seslendirme:** dil, konuşan roller (ör. müşteri, şoför, müdür, çalışan), satır listesi.
  - Her rol için **aynı cümleyi iki farklı sesle** üret, dosya yollarını ver ve hangisini kullanacağını `AskUserQuestion` ile sor.
  - Kadın ve erkek gibi alt gruplar varsa her grup için ayrı sor.
- **Müzik:** her bağlamın havası (menü, oyun içi, gece, rapor), sözsüz olup olmayacağı, ses seviyesi, konuşma altında ne kadar kısılacağı.
  - Varsayılan: konuşma sırasında müzik kendi seviyesinin %30'una iner.
  - Varsayılan: projedeki ses aç/kapa düğmesi müziği ve konuşmaları da kapatır.
- **Var olan ses efektleri:** projede zaten sentezlenmiş ya da hazır ses efektleri varsa, onlara dokunulmayacağını varsay ve öyle söyle.
- **Klasör:** dosyalar nereye konacak? Web projesinde varsayılan `public/assets/{audio,img,video}`; ham çıktılar `uretim/ham/` altında.
- **Video:** hangi videolar, süre, en-boy oranı, döngü olacak mı.

Kurallar netleşince bunları projede `uretim/kurallar.md` dosyasına kısa maddelerle yaz. Sonraki adımlar ve olası sonraki oturumlar buna bakar.

## 3. Üret

Bütün çağrılar `scripts/gemini.mjs` sarmalayıcısından geçer. Sarmalayıcı her çağrıyı (komut, model, çıktı yolu, token kullanımı, hata) projenin `uretim/cagrilar.jsonl` dosyasına yazar. maliyet.md bu kayıttan üretilir; sarmalayıcıyı atlayan çağrı maliyetten kaybolur. Betikleri skill klasöründen çalıştır, çalışma dizini projenin kökü olsun:

```bash
node <skill>/scripts/gemini.mjs tts "Merhaba" --voice Kore --language tr-TR --out public/assets/audio/vo/merhaba.wav
```

Sıra ve kurallar:

1. **Stil örneği:** tek görsel üret ve kullanıcıya göster (Read ile bak, yolu ver). Onay gelmeden diğer görsellere geçme.
2. **Görseller:** `scripts/toplu.mjs gorsel <liste.json>` ile **sırayla** üret. Her görselin ilk referansı stil örneği olsun. Karakter tutarlılığı gerekiyorsa ikinci referans o karakterin ilk görseli olsun. Listeyi `references/listeler.md` biçimine göre hazırla.
   - **Dosya uzantısı:** çıktının uzantısı modelin döndürdüğü biçime uyar; `--out x.png` istense de `x.jpg` yazılabilir. Referans verirken gerçek dosya adını kullan.
   - **Saydam ikon ve portre:** istemde "perfectly flat solid pure magenta background (#FF00FF), no shadow" iste.
   - **Yazı:** istemde "no text, no letters" iste; yazıyı kodda çiz.
3. **Seslendirme:** `scripts/toplu.mjs ses <liste.json>` ile üret. Betik dakikada 10 istek sınırına uyar: çağrılar sırayla gider, aralarında 7 sn beklenir, 429 hatasında 15 sn bekleyip yeniden dener ve var olan dosyayı atlar.
   - **Paralel çalıştırma:** aynı modele paralel istek gönderme. Bu oturumda paralel deneme 37 isteğin 25'ini 429 ile düşürdü.
   - **Çıktı:** WAV, 24 kHz mono.
   - **Metin:** TTS metni kelimesi kelimesine okur. Kalıpları sade tut ("Rafta kupa kalmadı!"). İki kelimelik ürün adlarını ("oyuncak ayı") cümle başına koyma; birleşip yanlış okunabiliyor.
4. **Müzik:** her parça için `music` komutunu çalıştır. Promptta "Instrumental only, no vocals, no lyrics" yaz, yoksa Lyria 3.5 söz yazabiliyor. Süreyi promptta iste ("about 2 minutes"). 30 sn'lik döngü için `-m lyria-3-clip-preview` kullan. Az sayıda parça varsa paralel çalışabilir.
5. **Video:** süre `--body '{"response_format":{"type":"video","aspect_ratio":"16:9","duration":"10s"}}'` ile verilir. Bu durumda `--aspect-ratio` bayrağını ayrıca verme. Başlangıç karesi olarak onaylı sahne görselini `-i` ile ver.

Uzun toplu işleri arka planda çalıştır ve bitişini bekle; dosya yoklamak için uyuma.

## 4. Denetle (gemini-api ile)

Her çıktıyı projeye bağlamadan önce denetle. Sorunlu olanı düzeltilmiş istemle yeniden üret.

- **Seslendirme:** `node <skill>/scripts/gemini.mjs transcribe -i a.wav -i b.wav … --format text --no-speakers --out <geçici-klasör>/` ile hepsini metne dök. Her metni satırın yazılı hâliyle karşılaştır. Yanlış okunan ya da soru tonlamasına dönen satırları yeniden yaz ve yeniden üret.
- **Müzik:** `gemini-api analyze -i parca.mp3 "Answer in one short line: does this track contain any sung vocals or spoken words (yes/no), and describe its mood in 5 words."`. Burada `analyze` için `--stream` bayrağı yok.
- **Görseller:** ffmpeg ile bir temas sayfası yap (xstack) ve Read ile bak. Stil örneğine uymayanları, yazısı bozuk olanları, kenarında taşma olanları ayıkla. Yazı içeren görseller için `analyze` ile yazının harf harf doğruluğunu sor.
- **Video:** ilk, orta ve son kareyi yan yana koyup bak. Döngü olacaksa son kare ilkine uymuyorsa işlemede ileri-geri (ping-pong) yap.

## 5. İşle

Ham çıktıları `scripts/isle.mjs` ile kullanılacak biçime çevir; ham dosyaları `uretim/ham/` altında sakla. Alt komutlar:

| Alt komut | Ne yapar |
|---|---|
| `seffaf <girdi> <çıktı.webp> [boyut]` | Sol üst köşe renginden anahtar alır, saydamlaştırır, kenardaki renk halesini 2 piksel daraltır |
| `gorsel <girdi> <çıktı.webp> <genişlik:yükseklik> [kırp]` | Ölçekler ve WebP'ye çevirir |
| `muzik <girdi> <çıktı.mp3>` | 128 kb/sn MP3 |
| `ses <girdi.wav> <çıktı.mp3>` | Baş ve sondaki sessizliği kırpar, 64 kb/sn mono MP3 |
| `video-dongu <girdi> <çıktı.mp4> [genişlik]` | Sesi atar, ileri-geri birleştirip dikişsiz döngü yapar, faststart |

Saydamlaştırılan görseli açık ve koyu zeminde bir kez gözle kontrol et.

## 6. Projeye bağla

Bağlama projeye özgüdür; ilkeler `references/baglama.md` dosyasında. Özetle:

- **Adres:** dosya adresleri tek bir yardımcıdan geçsin (ör. `asset(path)`).
- **Ses modülü:** müzik ve seslendirme ayrı bir modülde olsun:
  - konuşma sırasında müzik kısılır,
  - ana ses düğmesi her şeyi kapatır,
  - müzik ve seslendirme tercihleri ayrıdır,
  - önemli satırlar (ipucu, karşılama) atlanmaz, sıraya girer; sık olaylara bekleme süresi konur,
  - tarayıcının otomatik oynatma kuralına uyulur (ilk tıklamada açılır).
- **Var olan ses efektleri:** değiştirilmez.
- **Görseller:** yüklenmezse kodla çizilen eski hâl kalır.
- **Testler ve denetimler:** projede "dışarıdan medya yok" gibi bir denetim ya da test varsa üretilmiş klasörü istisna yap ve bunu söyle.

## 7. Kontrol et

- **Projenin kendi kontrolleri:** typecheck, birim testleri ve derlemeyi çalıştır.
- **Uygulamayı aç:** Playwright ya da sistem tarayıcısıyla (Playwright'ın tarayıcısı kurulu değilse `channel: 'msedge'` ya da `'chrome'`) sırayla bak:
  - üretilen dosyalar yükleniyor mu (ağ yanıtları),
  - müzik ve seslendirme gerçekten çalıyor mu,
  - ses düğmesi hepsini susturuyor mu,
  - görseller yerinde mi (ekran görüntüsü alıp Read ile bak).
- **Teşhis kancası:** Ses durumunu dışarıdan okumak için projeye küçük bir teşhis kancası eklemek işe yarar; bu oturumda `audio()` ve `media()` buna örnek.
- **Gözlem:** Kontrolde gördüğün sorunu düzelt ve yeniden bak.

## 8. Maliyeti yaz

```bash
node <skill>/scripts/maliyet.mjs --fiyat uretim/fiyatlar.json --hedef public/assets --cikti maliyet.md
```

Betik `uretim/cagrilar.jsonl` dosyasını resmi token fiyatlarıyla hesaplar ve maliyet.md'ye şunları yazar:

- **Kesin ve tahmini tutar ayrı ayrı:**
  - kesin olanlar: çıktı tokenı, parça, saniye;
  - tahmini olanlar: referans görsel ve istem girdisi, denetimlerdeki ses girdisi.
- **Kategori özeti** ve her çağrının satırı.
- **Dosya sayıları:** API'nin döndürdüğü ve projede kullanılan.
- **Süre:** ilk ve son çağrının zamanı. İşin tamamının süresi için `--baslangic` ve `--bitis` ver.
- **Kayıt dışı çağrılar:** kayıttan önce sarmalayıcısız yapılmış çağrı varsa `--onceki onceki.json` ile ekle (biçimi betiğin başında).

maliyet.md'de anahtar, kullanıcı adı ya da kişisel klasör yolu olmasın. Komutlar proje köküne göre göreli yollarla yazılır.

## Kapanış mesajı

Kullanıcıya şunları kısaca söyle:

- ne üretildiğini ve nereye bağlandığını,
- denetimde ne bulunup düzeltildiğini,
- kontrollerin sonucunu,
- toplam maliyeti (kesin ve tahmini) ve boşa giden kısmı,
- yapılmayan ya da doğrulanamayan şeyleri (ör. kurulu olmadığı için çalışmayan tarayıcı testleri, kulakla denenmeyen ses seviyesi).

Commit yalnızca kullanıcı isterse yapılır.
