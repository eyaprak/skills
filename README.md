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
| [**prd-yaz**](./prd-yaz) | Seni adım adım sorgulayarak, dağınık bir fikri net bir PRD'ye (ürün gereksinim belgesine) dönüştürür ve `prd.md` dosyasına yazar. Yapay zeka ile kod yazmadan önce işi netleştirmenin temeli. | *"prd yaz"*, *"ürün gereksinim belgesi oluştur"*, *"yeni özellik planla"* |
| [**seo-expert**](./seo-expert) | Uçtan uca SEO içerik üretim hattı: trend analizi → derin araştırma → önce taslak (outline) onayı → bölüm bölüm yazım → 18 kontrollü kalite kapısı (puan < 70 ise 2 kez otomatik yeniden dener) → yayına hazır temiz semantik **HTML** çıktısı. Sadece bir konu vermen yeterli; Claude Desktop, Web ve Code'da script/veritabanı gerektirmeden çalışır. | *"blog yazısı yaz"*, *"SEO içeriği oluştur"*, *"araştır ve yaz"*, *"şu konu hakkında makale yaz"*, *"/seo-expert"* |

> 🎬 Yeni videolarda gösterdikçe bu liste büyüyecek.

---

## 🚀 Kurulum

Skill'leri Claude Code'un tanıması için skill klasörünü `~/.claude/skills/` altına kopyalaman yeterli.

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

### Kullanım

Kurduktan sonra Claude Code'u aç ve doğal dilde isteğini yaz:

```
> uygulamamı yayına almak istiyorum
```

Claude doğru skill'i otomatik bulup devreye alır. Skill'in adıyla da çağırabilirsin (örn. `/deploy-app`).

> 💡 Bazı skill'ler (deploy-app gibi) ek araçlara ihtiyaç duyar — örneğin **Hostinger MCP**. Her skill'in kendi `SKILL.md` dosyasında gereksinimleri ve adımları yazılıdır; kurmadan önce göz at.

---

## 📂 Repo yapısı

```
.
├── README.md            ← buradasın
└── deploy-app/          ← bir skill = bir klasör
    ├── SKILL.md         ← skill'in beyni: ne yapacağını anlatan talimatlar
    └── references/      ← Claude'un gerektiğinde okuduğu detay dosyaları
```

Her yeni skill, kendi klasörü içinde bir `SKILL.md` ve (gerekirse) `references/` ile bu repoya eklenir.

---

## 🤝 Katkı & İletişim

- 🎥 **YouTube:** [@yprkemrullah](https://youtube.com/@yprkemrullah) — yeni skill'ler ve anlatımlar burada
- 🐛 Bir sorun mu buldun, önerin mi var? **Issue** aç ya da **Pull Request** gönder.

Skill'leri faydalı bulduysan kanala abone olup videolarda buluşalım. İyi kodlamalar! 🚀

---

<div align="center">
<sub>Bu skill'ler <a href="https://docs.claude.com/en/docs/claude-code">Claude Code</a> ile kullanılmak üzere hazırlanmıştır.</sub>
</div>
