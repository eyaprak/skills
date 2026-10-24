# medya-tamamla

**Claude Code** skill'i. Bitmiş ama "çiğ" duran bir projeyi (oyun, web uygulaması, site) inceler, eksik **müzik**, **Türkçe seslendirme**, **görsel** ve **kısa videoyu** Google'ın [gemini-api](https://github.com/google-gemini/gemini-api-cli) aracıyla üretir ve projeye bağlar.

Videoda Kargola adlı tarayıcı oyununa bu süreçle 6 müzik, 42 seslendirme, 37 görsel ve bir menü videosu eklendi. Fatura 3,79 $ (188 ₺) oldu. Skill o oturumun son mesajında, takılınan yerlerle birlikte bu klasöre çevrildi.

## Ne yapar

```
"projeye müzik ve seslendirme ekle"
        │
        ▼
1. İncele ve listele: her kalem için nerede kullanılacak, hangi komut, kaç adet, kaça mal olur
        │   (hiçbir şey üretmez, onay bekler)
        ▼
2. Kuralları sor: görsel stil, roller ve sesler, müziğin seviyesi, klasör
        ▼
3. Stil örneği: tek görsel üretir, onay alınca diğerlerini onu referans vererek üretir
        ▼
4. Üret: seslendirmede dakikada 10 istek sınırına uyar, her çağrıyı kayda yazar
        ▼
5. Denetle: müzikte söz var mı, seslendirme yazıldığı gibi okunmuş mu (yine gemini-api ile)
        ▼
6. Bağla ve kontrol et: ses modülü, ses düğmesi, testler, uygulamayı açıp bakma
        ▼
7. maliyet.md: her çağrı resmi fiyatla, toplam, dosya sayısı ve süre
```

## Değişmez kurallar

- **Onaysız üretim yok.** Görsel, müzik ve video para yazıyor. Liste onaylanmadan tek çağrı yapılmaz.
- **Kurallar üretimden önce.** Kaynak oturumda stil kuralı geç verildiği için 23 görsel yeniden üretildi. Skill bu yüzden kuralları baştan sorar.
- **Var olan ses efektlerine dokunmaz.** 3D model ve kısa ses efekti üretmez, bu araç ikisini de üretmiyor.
- **Anahtar hiçbir yere yazılmaz.** Ne dosyaya ne maliyet.md'ye ne sohbete. Skill yalnız `gemini-api whoami` ile anahtarın tanımlı olduğuna bakar.

## Gereksinimler

| Araç | Neden |
|------|-------|
| [gemini-api CLI](https://github.com/google-gemini/gemini-api-cli) | Üretim ve denetim. PATH'te değilse yolunu `GEMINI_API_BIN` ortam değişkeniyle ver. |
| Gemini API anahtarı | `gemini-api configure` ile verilir. Görsel, müzik ve video için faturalandırma açık olmalı. |
| Node.js | `scripts/` altındaki betikler için. |
| ffmpeg ve ffprobe | Ses ve görsel işleme, süre ölçümü. |

gemini-api kurulumu (Windows PowerShell):

```powershell
iwr -useb https://raw.githubusercontent.com/google-gemini/gemini-api-cli/main/scripts/install.ps1 | iex
```

macOS ve Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/google-gemini/gemini-api-cli/main/scripts/install.sh | bash
```

Kurulumdan sonra terminali, Claude'un masaüstü uygulamasını kullanıyorsan onu da tamamen kapatıp aç. Yoksa Claude Code komutu bulamıyor.

## Kurulum ve kullanım

Klasörü `~/.claude/skills/medya-tamamla` konumuna kopyala (ayrıntı: [kök README](../README.md#-kurulum)). Sonra Claude Code'u projenin klasöründe aç:

```
> /medya-tamamla
```

ya da doğal dilde: *"projeye müzik ve seslendirme ekle"*, *"eksik medyayı tamamla"*, *"SVG ikonları gerçek görsellerle değiştir"*.

## Klasör yapısı

```
medya-tamamla/
├── SKILL.md              ← akış: listele, kuralları sor, üret, denetle, bağla, maliyeti yaz
├── references/
│   ├── kurallar.md       ← üretimden önce sorulacaklar ve nedenleri
│   ├── listeler.md       ← toplu üretim listelerinin biçimi
│   └── baglama.md        ← üretilen dosyaları projeye bağlama ilkeleri
└── scripts/
    ├── gemini.mjs        ← her çağrıyı uretim/cagrilar.jsonl dosyasına yazan sarmalayıcı
    ├── toplu.mjs         ← sıralı görsel ve seslendirme üretimi (hız sınırına uyar)
    ├── isle.mjs          ← saydamlaştırma, WebP, MP3, dikişsiz video döngüsü
    ├── maliyet.mjs       ← cagrilar.jsonl dosyasından maliyet.md
    └── fiyatlar.json     ← son bilinen fiyat örneği (her işte resmi sayfadan tazelenir)
```

## Fiyatlar

`scripts/fiyatlar.json` yalnız örnek (fiyat sayfası, 22 Ekim 2026). Skill her işte [resmi fiyat sayfasını](https://ai.google.dev/gemini-api/docs/pricing) yeniden okur ve güncel değerleri projenin `uretim/fiyatlar.json` dosyasına yazar. Fiyatların çoğu 1 Ocak 2027'de iki katına çıkıyor.
