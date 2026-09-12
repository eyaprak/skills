# Fatura Kutusu kurulum talimatı

Bu dosyayı okuyan sen Hermes'sin. Aşağıdaki adımları sırayla ve olduğu gibi uygula. Kullanıcıya komut gösterme, komutları sen çalıştır; her adımın sonunda tek cümleyle ne yaptığını söyle. Bir adım başarısız olursa dur ve hata çıktısını kullanıcıya sade dille aktar.

Bu talimat yalnızca `$HERMES_HOME/skills/productivity/fatura-kutusu` ve `/tmp/eyaprak-skills` dizinlerine dokunur. Başka dosya silme, başka skill'i değiştirme, burada yazmayan paket kurma.

## 1. Ortamı bul

```bash
H="${HERMES_HOME:-/opt/data}"; echo "HERMES_HOME=$H"; mkdir -p "$H/skills/productivity"; ls "$H/.venv/bin/python" 2>/dev/null || echo "venv yok, sistem python kullanılacak"
```

`H` değerini sonraki adımlarda kullan.

## 2. Paketi indir

`git` varsa yalnızca bu klasörü çek:

```bash
rm -rf /tmp/eyaprak-skills && git clone --depth 1 --filter=blob:none --sparse https://github.com/eyaprak/skills /tmp/eyaprak-skills && git -C /tmp/eyaprak-skills sparse-checkout set fatura-kutusu
```

`git` yoksa zip ile:

```bash
rm -rf /tmp/eyaprak-skills /tmp/eyaprak-skills.zip && curl -sL https://github.com/eyaprak/skills/archive/refs/heads/main.zip -o /tmp/eyaprak-skills.zip && unzip -q -o /tmp/eyaprak-skills.zip -d /tmp && mv /tmp/skills-main /tmp/eyaprak-skills
```

Doğrula: `/tmp/eyaprak-skills/fatura-kutusu/SKILL.md` var olmalı.

## 3. Yerleştir

```bash
H="${HERMES_HOME:-/opt/data}"; rm -rf "$H/skills/productivity/fatura-kutusu" && cp -r /tmp/eyaprak-skills/fatura-kutusu "$H/skills/productivity/" && rm -rf /tmp/eyaprak-skills /tmp/eyaprak-skills.zip && ls "$H/skills/productivity/fatura-kutusu"
```

Çıktıda `SKILL.md`, `scripts`, `references` görünmeli. Dosyaların sahibi Hermes'in çalıştığı kullanıcı değilse (`ls -l` ile bak) `chown -R` ile düzelt.

## 4. Python bağımlılıklarını kontrol et

```bash
H="${HERMES_HOME:-/opt/data}"; P="$H/.venv/bin/python"; [ -x "$P" ] || P=python3; "$P" -c "import googleapiclient, google.oauth2; print('google ok')" 2>&1; "$P" -c "import pypdf; print('pypdf ok')" 2>&1 | tail -1
```

- `google ok` çıkmıyorsa: `"$P" -m pip install -q google-api-python-client google-auth google-auth-oauthlib` çalıştır ve tekrar dene.
- `pypdf ok` çıkmıyorsa: `"$P" -m pip install -q pypdf` çalıştır. Bu paket PDF'lerin metnini OCR'a gitmeden okumaya yarar; kurulamazsa sorun değil, PDF'ler OCR ile okunur.

## 5. Beceriyi yükle ve kurulumu başlat

`skill_view` ile `fatura-kutusu` becerisini yükle. Oradaki komut kısaltmasını tanımla ve durum al:

```bash
H="${HERMES_HOME:-/opt/data}"; P="$H/.venv/bin/python"; [ -x "$P" ] || P=python3; "$P" "$H/skills/productivity/fatura-kutusu/scripts/fatura_kutusu.py" durum
```

Ardından aynı script'i `bicimle` komutuyla bir kez çalıştır: mevcut bir tablo varsa tarih sütunlarına görünüm biçimi uygular (eski sürümle kurulmuş tablolarda tarihler sayı görünüyordu); kurulum yoksa "atlandı" der, sorun değil.

`durum` çıktısı JSON'dur. `asama` alanına göre SKILL.md'deki ilgili bölüme geç ve zinciri sonuna kadar yürüt: `GOOGLE_GEREKLI` ise Google iznini, `MISTRAL_GEREKLI` ise Mistral anahtarını, `KURULUM_GEREKLI` ise klasörleri ve tabloyu kur. Her aşamanın bitiminde `durum` komutunu tekrar çalıştır.

Kullanıcıya bu noktada şunu söyle: "Fatura Kutusu paketi kuruldu. Şimdi bağlantıları sırayla kuruyoruz; ilk olarak Google izni gerekiyor."

## 6. Bitiş

`asama` `HAZIR` ya da `TELEGRAM_EKSIK` olduğunda kullanıcıya şunu söyle:

> Kurulum bitti. Test için 01-Gelen klasörüne bir fatura at (PDF ya da fotoğraf), sonra bana "belgeleri işle" de.

Bundan sonraki her şey (işleme, Telegram, otomatiğe alma) SKILL.md'de yazılıdır; bu dosyaya bir daha dönme.

## Güncelleme

Aynı talimat yeniden çalıştırıldığında 3. adım skill klasörünü silip depodaki güncel sürümle değiştirir. Sunucuda script'e elle yapılmış değişiklikler kaybolur; `$HERMES_HOME/fatura-kutusu/config.json` ve `.env` skill klasörünün dışında olduğu için korunur, kurulum ve Google izni tekrarlanmaz. `durum` çıktısındaki `surum` alanı hangi sürümün yüklü olduğunu söyler.
