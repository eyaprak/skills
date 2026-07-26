<div align="center">

# 🧩 yprkemrullah · Claude Code Skills

**YouTube videolarımda gösterdiğim [Claude Code](https://docs.claude.com/en/docs/claude-code) skill'lerinin toplandığı repo.**

Her skill, Claude'a yeni bir yetenek kazandıran küçük bir paket: bir görevi nasıl yapacağını adım adım anlatan talimatlar + gerektiğinde referans dosyaları. Aşağıdaki skill'leri kopyala, Claude Code sana o işi baştan sona yapsın.

[![YouTube](https://img.shields.io/badge/YouTube-@yprkemrullah-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtube.com/@yprkemrullah)

</div>

---

## 📺 Bu repo ne işe yarar?

YouTube kanalımda Claude Code ile neler yapılabileceğini anlatıyorum. Videolarda gösterdiğim **skill'leri** burada paylaşıyorum ki sen de kendi makinende birebir aynısını kullanabilesin.

> **Skill nedir?**
> Claude Code'a "şu işi şöyle yap" diye öğreten, içinde talimatların (`SKILL.md`) ve yardımcı dosyaların bulunduğu bir klasör. Sen normal dilde isteğini yazarsın (örn. *"uygulamamı yayına al"*), Claude ilgili skill'i otomatik devreye sokar ve işi yürütür.

---

## 🛠️ Mevcut skill'ler

| Skill | Ne yapar? | Tetikleyen ifadeler |
|-------|-----------|---------------------|
| [**deploy-app**](./deploy-app) | Kendi web uygulamanı (Next.js, Node, statik site, Python) ya da hazır bir açık kaynak uygulamayı (WordPress, n8n, Evolution API, Ghost, Metabase, Uptime Kuma…) Hostinger VPS'ine kurup kendi alan adında **HTTPS** ile canlıya alır. SSH/panel bilmene gerek yok. | *"uygulamamı yayına al"*, *"siteyi canlıya çıkar"*, *"deploy et"*, *"wordpress kur"*, *"n8n kur"* |
| [**hyperframes-studio**](./hyperframes-studio) | Ham konuşma klibini + transcript'ini (ya da düz bir içeriği) alıp [HyperFrames](https://www.npmjs.com/package/hyperframes) ile bitmiş bir video üretir: yatay **hook** (16:9 intro), dikey **Shorts** (9:16, altyazılı) ya da animasyonlu **slidedeck** (16:9 sunum). Koyu tema, tek marka rengi, self-hosted Manrope + JetBrains Mono; hook/shorts **1080p · 60fps** MP4'e render edilir, deck HTML sunum olarak teslim edilir. Paket içinde tak-çalıştır starter template'ler gelir. 📦 Tek dosyalık `.skill` paketi olarak dağıtılır. | *"hook oluştur"*, *"intro yap"*, *"shorts oluştur"*, *"dikey video"*, *"slidedeck oluştur"*, *"sunum yap"* |
| [**prd-yaz**](./prd-yaz) | Seni adım adım sorgulayarak, dağınık bir fikri net bir PRD'ye (ürün gereksinim belgesine) dönüştürür ve `prd.md` dosyasına yazar. Yapay zeka ile kod yazmadan önce işi netleştirmenin temeli. | *"prd yaz"*, *"ürün gereksinim belgesi oluştur"*, *"yeni özellik planla"* |
| [**seo-expert**](./seo-expert) | Uçtan uca SEO içerik üretim hattı: trend analizi → derin araştırma → önce taslak (outline) onayı → bölüm bölüm yazım → 18 kontrollü kalite kapısı (puan < 70 ise 2 kez otomatik yeniden dener) → yayına hazır temiz semantik **HTML** çıktısı. Sadece bir konu vermen yeterli; Claude Desktop, Web ve Code'da script/veritabanı gerektirmeden çalışır. | *"blog yazısı yaz"*, *"SEO içeriği oluştur"*, *"araştır ve yaz"*, *"şu konu hakkında makale yaz"*, *"/seo-expert"* |

> 🎬 Yeni videolarda gösterdikçe bu liste büyüyecek.

---

## 🚀 Kurulum

Bu repoda skill'ler **iki biçimde** dağıtılıyor. Hangisini kuracağını aşağıdaki tablodan seç:

| Biçim | Hangi skill'ler | Nasıl kurulur |
|-------|-----------------|---------------|
| 📁 **Klasör** — `SKILL.md` + `references/` | `deploy-app` · `prd-yaz` · `seo-expert` | Klasörü `~/.claude/skills/` altına kopyala → **Yöntem 1–2** |
| 📦 **`.skill` paketi** — tek dosya | `hyperframes-studio` | Claude Desktop'a yükle → **Yöntem 3**<br>Claude Code için paketi aç → **Yöntem 4** |

> **Neden bazı skill'ler tek dosya?** Claude Desktop bir skill'i klasör olarak kabul etmiyor, tek dosyalık bir **`.skill` paketi** bekliyor. `hyperframes-studio` ayrıca sadece talimat dosyalarından oluşmuyor: içinde üç mod için hazır starter template'ler ve self-hosted font dosyaları da var (39 dosya). Bu ikisi birleşince paketi tek dosya olarak dağıtmak en pratik yol oluyor — `.skill`, o klasörün zip'lenmiş hâlidir, hiçbir içerik eksilmez.

### Yöntem 1 — Repoyu klonla, istediğin skill'i kopyala

```bash
# Repoyu indir
git clone https://github.com/eyaprak/skills.git

# İstediğin skill'i kişisel skill klasörüne kopyala (örnek: deploy-app)
# macOS / Linux:
cp -r skills/deploy-app ~/.claude/skills/

# Windows (PowerShell):
Copy-Item -Recurse skills\deploy-app $HOME\.claude\skills\
```

### Yöntem 2 — Sadece tek bir skill istiyorsan

`deploy-app` klasörünü olduğu gibi indirip `~/.claude/skills/deploy-app` konumuna yerleştir. Klasör yapısı aynen korunmalı:

```
~/.claude/skills/
└── deploy-app/
    ├── SKILL.md
    └── references/
        ├── compose-dockerfile-templates.md
        ├── deployment-playbook.md
        ├── hostinger-mcp-tools.md
        ├── prebuilt-apps.md
        └── troubleshooting.md
```

### Yöntem 3 — Claude Desktop: `.skill` paketini yükle

Claude Desktop'ta klasör kopyalama işe yaramaz — Desktop bir skill'i tek dosyalık **`.skill` paketi** olarak ister. Paket repoda hazır duruyor:

| Skill | `.skill` paketi |
|-------|-----------------|
| **hyperframes-studio** | [`hyperframes-studio/hyperframes-studio.skill`](./hyperframes-studio/hyperframes-studio.skill) |

1. Yukarıdaki dosyaya tıkla, açılan sayfadan **Download raw file** ile indir (tüm repoyu indirmene gerek yok)
2. Claude Desktop'ta skill yükleme ekranını aç ve indirdiğin `.skill` dosyasını ekle
3. Skill listede göründükten sonra doğal dilde çağır (örn. *"hook oluştur"*)

### Yöntem 4 — Claude Code'a `.skill` paketi kurmak

Claude Code `.skill` dosyasını doğrudan okumaz; paketi açıp klasörü `~/.claude/skills/` altına koyman gerekir. `.skill` bir zip arşividir ve kökünde skill klasörünü taşır, dolayısıyla doğrudan hedefe açabilirsin:

```bash
# macOS / Linux
unzip hyperframes-studio.skill -d ~/.claude/skills/

# Windows (PowerShell) — Expand-Archive .zip uzantısı ister
Copy-Item hyperframes-studio.skill hyperframes-studio.zip
Expand-Archive hyperframes-studio.zip -DestinationPath $HOME\.claude\skills\
```

Sonuç `~/.claude/skills/hyperframes-studio/` altında `SKILL.md`, `references/`, `scripts/` ve `assets/templates/` olur.

### Kullanım

Kurduktan sonra Claude Code'u aç ve doğal dilde isteğini yaz:

```
> uygulamamı yayına almak istiyorum
```

Claude doğru skill'i otomatik bulup devreye alır. Skill'in adıyla da çağırabilirsin (örn. `/deploy-app`).

> 💡 Bazı skill'ler ek araçlara ihtiyaç duyar — `deploy-app` için **Hostinger MCP**, `hyperframes-studio` için **Node.js + npx** ve PATH'te **ffmpeg**. Her skill'in kendi `SKILL.md` dosyasında gereksinimleri ve adımları yazılıdır; kurmadan önce göz at.

---

## 📂 Repo yapısı

```
.
├── README.md                 ← buradasın
├── deploy-app/               ← 📁 klasör biçimi: bir skill = bir klasör
│   ├── SKILL.md              ← skill'in beyni: ne yapacağını anlatan talimatlar
│   └── references/           ← Claude'un gerektiğinde okuduğu detay dosyaları
└── hyperframes-studio/       ← 📦 paket biçimi
    ├── README.md             ← paketin içeriği, kurulumu ve gereksinimleri
    └── hyperframes-studio.skill
                              ← klasörün zip'lenmiş hâli: SKILL.md, references/,
                                scripts/ ve assets/templates/ (starter'lar +
                                self-hosted fontlar) hepsi bu tek dosyanın içinde
```

Her yeni skill, kendi klasörü içinde bir `SKILL.md` ve (gerekirse) `references/` ile bu repoya eklenir. Starter dosyası, font gibi ek varlıklar taşıyan skill'ler ise tek bir `.skill` paketi olarak dağıtılır — hem Claude Desktop bunu istediği için, hem de onlarca dosyayı tek tek indirmek zorunda kalmaman için.

---

## 🤝 Katkı & İletişim

- 🎥 **YouTube:** [@yprkemrullah](https://youtube.com/@yprkemrullah) — yeni skill'ler ve anlatımlar burada
- 🐛 Bir sorun mu buldun, önerin mi var? **Issue** aç ya da **Pull Request** gönder.

Skill'leri faydalı bulduysan kanala abone olup videolarda buluşalım. İyi kodlamalar! 🚀

---

<div align="center">
<sub>Bu skill'ler <a href="https://docs.claude.com/en/docs/claude-code">Claude Code</a> ile kullanılmak üzere hazırlanmıştır.</sub>
</div>
