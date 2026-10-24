# Üretilen medyayı projeye bağlama ilkeleri

Bağlama her projede farklıdır. Önce projenin mevcut kalıplarını oku (ses nasıl çalınıyor, ayarlar nerede tutuluyor, arayüz nasıl kuruluyor) ve onlara uy. Aşağıdakiler tarayıcıda çalışan bir oyunda denenmiş ilkeler.

## Adresler

Bütün dosya adreslerini tek bir yardımcıdan geçir:

```ts
export const asset = (path: string): string => `${import.meta.env.BASE_URL}assets/${path}`;
```

Böylece klasör değişirse tek satır değişir, derlemede `base` ayarı da korunur.

## Müzik ve seslendirme modülü

Var olan ses efekti kodunu değiştirme; müzik ve seslendirme için ayrı bir modül yaz.

- **Müzik:** iki `HTMLAudioElement` arasında yumuşak geçiş (~1,4 sn). Bağlama göre ruh hâli seç: menü, gündüz, gece, rapor penceresi. Gündüz parçaları sırayla çalar, diğerleri döngüdedir.
- **Konuşma altında kısma (ducking):** seslendirme başlarken müzik `seviye × 0,3`'e iner, bitince geri çıkar.
- **Ana ses düğmesi:** projedeki ses aç/kapa düğmesi müziği durdurur, çalan konuşmayı keser ve yenisini başlatmaz.
- **Ayrı tercihler:** "Müzik" ve "Seslendirme" anahtarları. Bunları kayıt şemasına eklemek yerine ayrı bir `localStorage` anahtarında tut; kayıt doğrulamasını bozmaz.
- **Otomatik oynatma:** tarayıcı ilk kullanıcı etkileşiminden önce sesi engeller. Menü müziğini hemen dene, reddedilirse ilk tıklama ya da tuşta başlat.
- **Öncelik:**
  - kullanıcı eylemine cevap (ör. "Emredersin sahip") = 3, çalanı keser;
  - ipucu ve karşılama = 2, bir ses sürerken atlanmaz, sıraya girer (en yenisi);
  - olay anonsları = 1, bir ses sürerken atlanır.
- **Bekleme süreleri:** sık olaylara bekleme süresi koy (ör. yeni sipariş 45 sn, stok bitti ürün başına 60 sn). Aynı anonsun üst üste çalması çabuk bıktırır. Hızlı ileri sarma ya da yüksek oyun hızında anonsları sustur.
- **Çeşitler:** aynı olayın 2–3 çeşidi varsa sırayla döndür.
- **Konuşan ile görsel aynı kişi olsun:** ör. müşterinin cinsiyeti hem portreyi hem sesi aynı fonksiyondan seçsin.

## Görseller

- **İkonlar:** var olan fonksiyonların imzasını koru (ör. `productIcon(p, size)` artık `<img>` döner); çağıranlar değişmez.
- **Dokular (3B sahnede):** önce kodla çizilen hâli göster, görsel yüklenince yeniden çiz ve `texture.needsUpdate = true` yap. Görsel gelmezse oyun eski hâliyle çalışır.
- **Görsel üstüne yazı:** firma adı, afiş başlığı gibi yazıları kodla çiz; açık desen üstünde okunsun diye koyu kenarlık (`strokeText`) ekle.
- **Video arka plan:** `<video autoplay muted loop playsinline poster="…">`. Poster olarak aynı sahnenin görselini ver ki yüklenirken boş kalmasın.

## Projedeki denetimler ve metinler

- Projede "dışarıdan medya dosyası yok" gibi bir denetim betiği ya da test varsa, üretilmiş klasörü (`public/assets`) istisna yap, ham klasörü taramadan çıkar ve bunu kullanıcıya söyle.
- Arayüzde "tüm sesler kodla üretildi" gibi artık doğru olmayan bir metin varsa düzelt.
- Paylaşım görseli (`og:image`) için göreli adres yazıldıysa, yayında tam adres gerektiğini söyle.

## Doğrulama için teşhis kancası

Tarayıcı testinde sesin gerçekten çaldığını görmek için modüle küçük bir durum fonksiyonu ekle:

```ts
snapshot() { return { mood, track, musicPlaying, musicVolume, voicePlaying, master }; }
```

Bunu ve çalınan dosyaların sayacını projenin varsa teşhis API'sine bağla. Playwright ile bir rafa tıklayıp sayaçta beklenen satırı görmek, "çalışıyor" demenin tek güvenilir yolu.
