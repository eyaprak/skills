# Üretimden önce sorulacak kurallar

Bu sorular **ilk üretim çağrısından önce** sorulur. Kural sonradan gelirse o kurala uymayan her çıktı yeniden üretilir; bu hem para hem zaman kaybıdır. Skill'in çıktığı oturumda "bütün görseller aynı stilde, bir örneğe referansla" kuralı 36 görsel üretildikten sonra geldi ve 23'ü yeniden üretildi. Rol sesleri de sonradan seçildiği için 26 satır yeniden okundu.

Kullanıcı bir kuralı zaten söylediyse yeniden sorma, uygula. Birden çok şıklı soruları `AskUserQuestion` ile, önerdiğin şık ilk sırada ve "(Önerilen)" etiketiyle sor. En fazla 4 soruyu tek çağrıda grupla.

## Görsel

| Soru | Neden | Öneri |
|---|---|---|
| Sanat stili ve palet | Bütün görseller tek bir stil örneğinden türeyecek | Projenin mevcut renklerinden ve havasından türet, 2–3 seçenek sun |
| Saydam arka plan gerekiyor mu (ikon, portre) | Model saydamlık vermiyor | Düz magenta (#FF00FF) zeminde üret, `isle.mjs seffaf` ile anahtarla. Yeşil ürün varsa magenta, macenta ürün varsa yeşil seç |
| Görselde yazı olacak mı | Modeller özellikle Türkçe harfleri bozabiliyor | Yazıyı kodla çiz (canvas, HTML); görselde "no text" iste. Yazı şartsa üretimden sonra `analyze` ile harf harf denetle |
| Boyut ve en-boy | Maliyet boyuta göre değişir (1K / 2K / 4K) | Ekranda küçük görünen ikon ve portre için 1K, tam ekran sahne için 2K |
| Karakter tutarlılığı | Aynı kişinin farklı ifadeleri, aynı mekânın farklı saatleri | İlk görseli ikinci referans olarak ver |

**Stil örneği akışı:**

1. Tek bir temsilî görsel üret (çoğunlukla bir ikon).
2. Kullanıcıya göster ve onay al.
3. Diğer her görselde stil örneğini ilk referans yap (`-i`) ve istemi "Use exactly the art style of the first reference image: …" diye başlat.
4. Düz/vektör gibi farklı türler (afiş, kamyon paneli) için de aynı referansı ver. Aksi hâlde stil kayar.

## Seslendirme

| Soru | Neden |
|---|---|
| Dil | `--language` ipucu (ör. `tr-TR`) ve metinlerin dili |
| Kimler konuşacak (roller) | Her rol ayrı ses alır: ör. müşteri, şoför, müdür, çalışan. Kadın/erkek alt grupları ayrıca seçilir |
| Hangi olaylar seslendirilecek, satır listesi | Satırları kullanıcıyla birlikte netleştir; dinamik metin (müşteri adı, şehir) önceden kaydedilemez, genel cümle kur |
| Ses seçimi | Her rol için **aynı cümleyi iki farklı sesle** üret (`uretim/ses-ornekleri/<rol>-<Ses>.wav`), yolları ver ve `AskUserQuestion` ile hangisini kullanacağını sor |

**Ses adları:** Önce `gemini-api tts --help` ile bak. Prebuilt seslerde cinsiyet kabaca şöyle:

- Kadın: Kore, Aoede, Leda, Zephyr, Despina, Erinome, Gacrux, Sulafat, Autonoe.
- Erkek: Charon, Puck, Fenrir, Orus, Iapetus, Umbriel, Algieba, Algenib, Alnilam, Schedar, Achird.

Seçilen sesleri `uretim/kurallar.md` dosyasına yaz.

## Müzik

| Soru | Varsayılan |
|---|---|
| Hangi bağlamlarda müzik çalacak | Menü, oyun içi (2–3 parça sırayla), gece/sakin, rapor/duraklama döngüsü |
| Sözsüz mü | Evet; promptta "Instrumental only, no vocals, no lyrics" yaz |
| Ses seviyesi | Arka plan, efektlerin altında. Kullanıcı "çok yüksek" derse çarpanı uygula (ör. ×0,6) ve hangi yorumu yaptığını söyle |
| Konuşma altında | Müzik kendi seviyesinin %30'una iner, konuşma bitince geri çıkar |
| Ses aç/kapa | Projedeki ana ses düğmesi müziği ve konuşmaları da kapatır; ayrıca ayarlara "Müzik" ve "Seslendirme" anahtarları eklenir |
| Var olan ses efektleri | Dokunulmaz |

## Video

- Hangi videolar üretilecek? Liste onayında çoğu zaman yalnız biri istenir; kullanıcı neyi seçtiyse yalnız onu üret.
- Süre, en-boy oranı ve çözünürlük. Fiyat sayfası 720p için token/sn veriyor; 1080p ve 4K büyütme olarak üretiliyor, varsayılan 720p.
- Döngü olacak mı? Olacaksa `isle.mjs video-dongu` kullan, ses atılır.
- Başlangıç karesi olarak hangi onaylı görsel verilecek?

## Klasör ve adlandırma

- Web projesinde varsayılan `public/assets/{audio/music,audio/vo,img/<tür>,video}`. Kullanıcı başka bir yer söylerse onu kullan.
- Ham çıktılar ve kayıtlar: `uretim/ham/`, `uretim/cagrilar.jsonl`, `uretim/fiyatlar.json`, `uretim/kurallar.md`.
- Dosya adları küçük harf ve tireli, Türkçe karakter yok (`stok-kupa.mp3`, `musteri-k-siparis-1.mp3`).
