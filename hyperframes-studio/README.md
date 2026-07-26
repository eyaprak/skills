# hyperframes-studio

> HyperFrames ile **hook** (yatay 16:9 intro), **Shorts** (dikey 9:16) ya da animasyonlu **slidedeck** (16:9 sunum) üretir. Ham konuşma klibini + transcript'ini (ya da düz bir içeriği) verirsin; koyu tema, tek marka rengi ve self-hosted fontlarla bitmiş bir kompozisyon çıkar.

Bu klasörde skill'in **paketlenmiş hâli** duruyor: [`hyperframes-studio.skill`](./hyperframes-studio.skill) — 39 dosyalık skill klasörünün zip'lenmiş hâli. Açılmış dosyalar repoda ayrıca tutulmuyor; böylece tek bir kaynak oluyor ve paketle içerik zamanla birbirinden ayrı düşmüyor.

## Paketin içinde ne var?

| Yol | Ne işe yarar |
|-----|--------------|
| `SKILL.md` | Skill'in beyni: mod tespiti, standing rules, adım adım akış |
| `references/engine.md` | Ortak motor: timeline, palet türetme, tipografi, bilinen tuzaklar |
| `references/{hook,shorts,slidedeck}.md` | Mod farkları: çerçeveleme, altyazı, sahne yapısı |
| `references/transcription.md` | Transkript alma ve RAW klip re-encode akışı |
| `scripts/reencode.mjs` | Ham klibi yoğun keyframe'li `-src.mp4`'e çevirir |
| `assets/templates/{hook,shorts,slidedeck}/` | Tak-çalıştır starter kompozisyonlar + self-hosted Manrope & JetBrains Mono |

## Kurulum

**Claude Desktop** — `hyperframes-studio.skill` dosyasını indir ve skill yükleme ekranından ekle. Desktop klasör kabul etmez, paketi ister.

**Claude Code** — paketi açıp klasörü skill dizinine koy:

```bash
# macOS / Linux
unzip hyperframes-studio.skill -d ~/.claude/skills/

# Windows (PowerShell) — Expand-Archive .zip uzantısı ister
Copy-Item hyperframes-studio.skill hyperframes-studio.zip
Expand-Archive hyperframes-studio.zip -DestinationPath $HOME\.claude\skills\
```

Zip kökünde `hyperframes-studio/` klasörü bulunduğu için doğrudan `~/.claude/skills/hyperframes-studio/` altına açılır — yeniden adlandırmaya gerek yok.

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
