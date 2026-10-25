# hyperframes-studio

> HyperFrames ile **hook** (yatay 16:9 intro), **Shorts** (dikey 9:16) ya da animasyonlu **slidedeck** (16:9 sunum) üretir. Ham konuşma klibini + transcript'ini (ya da düz bir içeriği) verirsin; koyu tema, tek marka rengi ve self-hosted fontlarla bitmiş bir kompozisyon çıkar.

Bu klasörün kendisi skill'dir — olduğu gibi skill dizinine kopyalanır. Claude Desktop klasör kabul etmediği için aynı içeriğin paketlenmiş hâli ayrıca [`dist/hyperframes-studio.skill`](../dist/hyperframes-studio.skill) altında duruyor.

## Videoda izle

<a href="https://youtu.be/Bt9X1AUXk80"><img src="https://img.youtube.com/vi/Bt9X1AUXk80/maxresdefault.jpg" alt="Claude Code ile Video Editi: Tek Komutla Hook, Shorts ve Sunum" width="560"></a>

Kurmadan önce üç modun nasıl çalıştığını bu videoda görebilirsin:

- [2:36](https://youtu.be/Bt9X1AUXk80?t=156) Gereksinimler ve üç mod: hook, Shorts, slidedeck
- [3:47](https://youtu.be/Bt9X1AUXk80?t=227) HyperFrames kurulumu ve skill'i Claude'a yükleme
- [7:36](https://youtu.be/Bt9X1AUXk80?t=456) Tek komutla sunum dosyası
- [9:34](https://youtu.be/Bt9X1AUXk80?t=574) Ham Shorts videosunu editleme
- [12:28](https://youtu.be/Bt9X1AUXk80?t=748) Gerçek maliyet (token ve dolar)

## Klasörde ne var?

| Yol | Ne işe yarar |
|-----|--------------|
| `SKILL.md` | Skill'in beyni: mod tespiti, standing rules, adım adım akış |
| `references/engine.md` | Ortak motor: timeline, palet türetme, tipografi, bilinen tuzaklar |
| `references/{hook,shorts,slidedeck}.md` | Mod farkları: çerçeveleme, altyazı, sahne yapısı |
| `references/transcription.md` | Transkript alma ve RAW klip re-encode akışı |
| `scripts/reencode.mjs` | Ham klibi yoğun keyframe'li `-src.mp4`'e çevirir |
| `assets/templates/{hook,shorts,slidedeck}/` | Tak-çalıştır starter kompozisyonlar + self-hosted Manrope & JetBrains Mono |

## Kurulum

**Claude Code** — klasörü olduğu gibi skill dizinine kopyala:

```bash
# macOS / Linux
cp -r hyperframes-studio ~/.claude/skills/

# Windows (PowerShell)
Copy-Item -Recurse hyperframes-studio $HOME\.claude\skills\
```

**SKILL.md okuyan diğer araçlar** (Codex, Antigravity vb.) — aynı klasörü o aracın kendi skill dizinine kopyala. Klasör adı `hyperframes-studio` kalmalı, skill adıyla eşleşiyor.

**Claude Desktop** — Desktop klasör kabul etmez, tek dosyalık paketi ister: [`dist/hyperframes-studio.skill`](../dist/hyperframes-studio.skill) dosyasını indirip skill yükleme ekranından ekle.

## Gereksinimler

- **Node.js + npx** — HyperFrames araç zinciri `npx hyperframes@0.6.16` ile on-demand iner
- PATH'te **ffmpeg** — klip re-encode ve render sonrası süre doğrulama için
- İlk `transcribe` çağrısı whisper modelini indirir (büyük, dakikalar sürebilir)

## Ne üretir?

| Mod | Çıktı | Altyazı |
|-----|-------|---------|
| **hook** | 1080p · 60fps MP4 — yatay 16:9 intro | yok |
| **shorts** | 1080p · 60fps MP4 — dikey 9:16 | var |
| **slidedeck** | `presentation/presentation.html` — render edilmez | — |

## Lisans

Skill kodu MIT. Paketteki Manrope ve JetBrains Mono fontları SIL OFL 1.1 (`assets/templates/*/fonts/OFL.txt`).
