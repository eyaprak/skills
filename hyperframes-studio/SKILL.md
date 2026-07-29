---
name: hyperframes-studio
description: >-
  HyperFrames ile bir açılış hook'u (yatay 16:9 intro), dikey 9:16 Shorts ya da 16:9 animasyonlu slidedeck
  üretmek için hepsi bir arada studio. Ham konuşma klibini ve transcript'i (ya da bir konu/slide içeriğini) alır; koyu
  tema, tek marka rengi, self-hosted Manrope + JetBrains Mono fontlar ile bitmiş, oynatılabilir bir kompozisyon
  çıkarır (hook/shorts ayrıca 1080p/60fps MP4'e render edilir). Paket içinde tak-çalıştır starter template'ler gelir. ŞU DURUMLARDA
  MUTLAKA KULLAN, HyperFrames adı geçmese bile TETİKLE: hook oluştur, intro yap, video başına giriş, insanları
  hookta tutsun; shorts oluştur, dikey video, bu klibi shorts yap, reels; slidedeck oluştur, sunum yap, bu
  içeriği slide'la, yeni bir deck; ya da kullanıcı bir "-hook", "-shorts" veya "-slidedeck" klasörü açıp içine
  ham klip, transcript veya içerik koyduğunda. Başta AskUserQuestion ile hangi mod ve marka rengi sorulur,
  gerisi paketteki hazır starter'dan kurulur. Yalnızca bu üç HyperFrames video türü için kullan.
license: MIT
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
  - WebSearch
  - WebFetch
metadata:
  version: 1.2.0
  argument-hint: "[mod: hook|shorts|slidedeck] [klasör] [transcript|video|content] [renk]"
  fonts-license: "Manrope + JetBrains Mono — SIL OFL 1.1 (assets/templates/*/fonts/OFL.txt)"
compatibility: "Node.js + npx (hyperframes@0.6.16) ve ffmpeg PATH'te gerekir."
---

# HyperFrames Studio

Üç HyperFrames çıktısından **birini** üretiyorsun: yatay bir **hook** (intro), dikey bir **shorts**, ya da 16:9 bir
**slidedeck**. Üçü de aynı motoru, fontları, brand-derivation formülünü ve render preset'ini paylaşır — sadece en-boy
oranı, altyazı olup olmaması ve çerçeveleme değişir. Önce **modu belirle**, sonra paketteki hazır starter'ı kopyalayıp
düzenle. Boş sayfadan kompozisyon yazma.

Motorun tamamı `references/engine.md` içinde; mod farkları `references/{hook,shorts,slidedeck}.md` içinde; transkripsiyon
ve re-encode `references/transcription.md` içinde. Starter template'ler `assets/templates/<mode>/` altında — nötr indigo
placeholder paletiyle (`--brand:#6366f1`) çalışır durumda gelir; kullanıcının rengiyle yeniden renklendirilir.

## Adım 0 — Modu belirle (Q0, ilk eşleşen kazanır)
1. **İstek/argümanlarda açık mod** — `mod:hook|shorts|slidedeck` ya da net ifade (intro/hook → hook; shorts/dikey/reels
   → shorts; slidedeck/sunum/slide → slidedeck). Kilitle.
2. **Klasör adı** — çalışılan/hedef klasör `-hook` / `-shorts` / `-slidedeck` ile bitiyorsa o mod.
3. **En-boy niyeti** — "yatay giriş" → hook; "dikey" → shorts; "sunum/deck" → slidedeck.
4. **Hiçbiri değilse** AskUserQuestion ile sor: *"Ne üreteceğiz? Hook (yatay 16:9 intro) / Shorts (dikey 9:16) /
   Slidedeck (16:9 sunum)"*.

Mod belli olunca ilgili `references/<mode>.md` dosyasını oku ve onun adımlarını izle.

## Standing rules — her koşuda baked-in, sorma, atlama
1. **Self-host fontlar** — Manrope + JetBrains Mono, 4 lokal `fonts/*.woff2`, Türkçe unicode-range. Asla CDN/built-in
   font kullanma (Türkçe glyph'ler düşer). Her starter bunları + `OFL.txt`'yi taşır; `fonts/`'u kompozisyonla birlikte kopyala.
2. **Yalnız lokal `assets/`** — asla `../assets` veya üst dizin yolu (preview/render üst dizine erişemez, medya boş çıkar).
3. **Koyu tema + tek marka rengi** — near-black bg, near-white text; her aksan tek `--brand`'den türetilir (engine.md §4).
4. **Transkript kullanıcıdan gelir** — hook/shorts'ta transkript kullanıcının girdisidir. İstekle birlikte
   yapıştırılmadıysa ve **bu projenin kendi klasöründe** bir `transcript.txt` yoksa, **dur ve kullanıcıdan iste** —
   kompozisyonu kurmadan, AskUserQuestion'a geçmeden önce. Başka bir klasörde/projede bulduğun transkripti bu klibe ait
   varsayma (aynı adı taşısa bile) ve kendiliğinden `transcribe` çalıştırma. Kullanıcı açıkça "sen çıkar" derse
   transcription.md'yi izle. Detay: transcription.md §Transkripti al.
5. **RAW klipleri önce re-encode et** — `node scripts/reencode.mjs <klip>.mp4` (yoğun keyframe); re-encode edilen
   `-src.mp4`'yi referansla, ham dosyayı değil (transcription.md).
6. **Deterministik timeline** — `gsap.timeline({paused:true})`, `window.__timelines["main"]=tl`, literal-saniye position'lar;
   `Math.random`/`Date.now`/`repeat:-1`/`setTimeout` yok (engine.md §8, §11).
7. **Sponsor görünümü yok** — sabit köşe logosu yok; marka işareti zamanlı bir animasyondur (ya da ops. ortalı topmark).
8. **Render yalnızca hook + shorts** — bu iki modun teslimatı bir MP4'tür; preset (varsayılan, override edilebilir):
   1080p · 60fps · 16 Mbps · quality high, pinned `hyperframes@0.6.16`. **Slidedeck render EDİLMEZ ve render sorulmaz** —
   deck'in teslimatı `presentation/presentation.html`'dir (kullanıcı açıkça video isterse istisna; kural: slidedeck.md).
9. **Tam kaynağı kapsa** — `data-duration` = gerçek klip/içerik uzunluğu; hook/shorts'ta render sonrası `ffprobe` ile
   doğrula, deck'te süreyi `N × slayt` aritmetiğiyle teyit et.

## Adım 1 — Gerçek seçimleri bir kez sor (AskUserQuestion, Türkçe)
Argümanlarla veya Adım 0 tespitiyle çözülen her soruyu düş. Sonra **tek bir AskUserQuestion çağrısında** ortak soruları
o modun 2–3 özel sorusuyla birleştir (round-trip'i azalt). **Option 1 daima önerilen/tespit edilen değerdir.** Hiçbir
soru kalmazsa çağrıyı atla ve çözülen değerleri tek satırlık Türkçe önsözde belirt.

Ortak sorular (her modda):
- **Renk** (header "Renk") — Option 1 = tespit edilen hex "(önerilen)" varsa; yoksa nötr varsayılan. 2–3 nötr **örnek
  palet** + Other = özel hex. Tema Dark kalır.
- **Template kaynağı** (header "Şablon") — "Paketteki hazır **{mode}** starter'ı kullan (önerilen)" · workspace'te
  algılanırsa "Kendi önceki -{mode} projemi klonla".

Moda özel sorular ilgili `references/<mode>.md`'den eklenir (hook: Demo/Logolar/Kapanış · shorts: Marka/Kapanış/Thumbnail
· slidedeck: Slaytlar/Tempo).

**Asla sorma:** slidedeck modunda "render alayım mı / MP4 üreteyim mi / hangi çıktıları üreteyim". Deck bir HTML
sunumdur; `presentation/presentation.html` her koşuda üretilir ve render gündeme gelmez.

**Mutlaka sor:** hook/shorts'ta transkript ortada yoksa (standing rule 4). Bu, AskUserQuestion'dan **önce** gelen düz
bir istektir — "Bu klibin transkriptini `[MM.SS - MM.SS]` formatında paylaşır mısın?" — çünkü transkript olmadan caption
`{in,out}`'ları, `HOOK_END`/`CLOSE` ve sahne sınırları uydurma olur.

## Adım 2 — Kur (handoff)
1. `assets/templates/<mode>/` klasörünü hedef projeye kopyala (index.html, fonts/, hyperframes.json, meta.json,
   package.json, assets/; deck'te ayrıca `presentation/` — daima, sormadan). `meta.json`/`package.json` adını güncelle.
2. `references/<mode>.md` build adımlarını izleyerek `index.html`'i işle: medyayı bağla, `data-duration`'ı gerçek
   uzunluğa ayarla, paleti uygula, sahneleri/altyazıları/slaytları içerikle doldur.
3. **Doğrula:** `npx --yes hyperframes@0.6.16 lint` → `inspect` (deck'te ayrıca `validate`) → `preview`. Anahtar beat'lerde
   frame çıkarıp görsel QA yap (engine.md §11'deki tuzaklara dikkat: literal position, yorumda medya etiketi yok, WCAG
   false-positive, tek root composition).
4. **Teslim et — moda göre:**
   - **hook / shorts →** `render --quality high --fps 60 --video-bitrate 16M --output "renders/<ad>.mp4"`, sonra
     `ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 renders/<ad>.mp4` ile süreyi teyit et; bir
     orta frame + audio stream'i kontrol et. Çıktı yolunu ve süreyi düz bildir.
   - **slidedeck →** render YOK. `presentation/presentation.html`'i teslim et, slidedeck.md'deki iki satırlık çıktı
     tablosunu ver ve `index.html`'in neden çift tıklanmadığını açıkla. Render'ı ne yap ne de öner.

## İlk kullanım notları
- **Node.js + npx** ve **ffmpeg PATH'te** gerekir. HyperFrames araç zinciri `npx` ile on-demand iner.
- `hyperframes transcribe` ilk kullanımda whisper model'ini indirir (büyük, dakikalar); Türkçe için `.en` değil
  `medium`/`large-v3` (transcription.md).
- Fontlar SIL OFL 1.1 (`fonts/OFL.txt`); skill kodu MIT.
- Motorun CLI/GSAP iç detayı için base `hyperframes` skill'ine defer et — burada tekrarlama.
