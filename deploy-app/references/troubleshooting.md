# Sorun giderme (bu surecte GERCEKTEN yasanan hatalar ve cozumleri)

## 1. `Skipped - No image to be pulled` / `No such image: <proj>-app:latest` -> deploy failed
- **Sebep:** Hostinger Docker Manager compose'u pull eder, `build:` ile BUILD ETMEZ.
- **Cozum:** `build:` kullanma. Imaji CI'da (GitHub Actions) build edip GHCR'ye push et,
  compose'da `image: ghcr.io/<user>/<repo>:latest` kullan. (Bu, tum akisin temel sebebi.)

## 2. `[VPS:2044] ... does not support Docker Manager`
- **Sebep:** VPS Docker tabanli bir OS sablonunda degil (orn. CloudPanel/Coolify/duz Ubuntu).
- **Cozum:** `VPS_recreateVirtualMachineV1` ile template **1210** (Ubuntu 24.04 + Docker & Traefik).
  YIKICI — onay + snapshot. Sonra Docker Manager calisir.

## 3. `Error: Command failed with ENOENT: tsx prisma/seed.ts` / `spawn tsx ENOENT` (konteyner restart dongusu)
- **Sebep:** `prisma db seed` tsx'i PATH'te ariyor; `node_modules/.bin` PATH'te degil. `set -e`
  yuzunden entrypoint cokuyor -> konteyner surekli restart.
- **Cozum:** entrypoint'te `export PATH="/app/node_modules/.bin:$PATH"` + seed'i dogrudan
  `tsx prisma/seed.ts` ile cagir + hatayi yut (`|| echo ...`) ki cokme dongusu olmasin.

## 4. Build CI'da DB baglanti hatasiyla patliyor
- **Sebep:** Build sirasinda DB yok ama bir sayfa/route build-time'da DB sorguluyor.
- **Cozum:** O sayfalari dinamik yap (Next.js: `export const dynamic = "force-dynamic"`).
  `prisma generate` DB gerektirmez; sorun statik uretimdeki sorgulardir.

## 5. GHCR'den pull yetkisiz (private paket)
- **Sebep:** GHCR paketleri PRIVATE dogar; sunucu auth'suz cekemez.
- **Cozum:** Paketi **public** yap (github.com/users/<user>/packages/container/<repo>/settings ->
  Danger Zone -> Change visibility -> Public). Anonim manifest sorgusu HTTP 200 donerse hazir.
  Not: `gh` token'inda `packages` scope yoksa API ile degistiremezsin; kullaniciya UI'dan yaptir.

## 6. Yeni imaji push ettim ama sunucu eski imaji calistiriyor
- **Sebep:** `:latest` yerelde cache'li.
- **Cozum:** compose'da `pull_policy: always`; createNewProject yeniden cagrildiginda guncel cekilir.

## 7. Random DB parolasini degistirdim ama uygulama DB'ye baglanamiyor
- **Sebep:** `POSTGRES_PASSWORD` yalniz veritabani ILK init edilirken gecerli. Mevcut volume'de
  parola degismez; app yeni parolayla baglanmaya calisip basarisiz olur.
- **Cozum:** Ya volume adini degistir (orn `-pgdata-v2`) -> temiz init (VERI SILINIR, seed yeniden),
  ya da eski parolayi koru. Redeploy'da env'i `getProjectContents` ile geri okuyup AYNISINI kullan.

## 8. Tarayicida `400 Bad Request: The plain HTTP request was sent to HTTPS port` (nginx/panel)
- **Sebep:** HTTPS bekleyen bir porta (orn. panel 8443) `http://` ile baglanildi.
- **Cozum:** `https://` ile baglan. (Uygulama hatasi degil, protokol uyusmazligi.)

## 9. Push reddedildi (force kullanma!)
- **Sebep:** Uzak repoda baslangic commit'i (README) var; force-push gecmisi ezer ve engellenebilir.
- **Cozum:** `git pull --no-rebase origin main --allow-unrelated-histories --no-edit -X ours` ile
  birlestir, sonra normal `git push`. `--force` kullanma.

## 10. Windows'ta `.sh` shebang bozuk / CRLF
- **Cozum:** `.gitattributes` -> `*.sh text eol=lf`, ayrica Dockerfile'da `sed -i 's/\r$//'` yedegi.

## 11. Deploy `delayed`da takildi, calismiyor (ama hata da vermiyor)
- **Sebep:** VPS'te o an baska bir VM islemi calisiyor — ozellikle **otomatik `backup_create`** — ve
  `actions_lock: locked`. Yeni `docker_compose_up` kuyrukta `delayed` bekler.
- **Teshis:** `VPS_getActionsV1` -> listede `state:"started"` bir `backup_create`/`ct_recreate` var mi?
  `VPS_getVirtualMachinesV1` -> hedef VM'de `actions_lock` "locked" mi?
- **Cozum:** HATA DEGIL, bekle. Yedek ~20-30 dk surer; bitince deploy KENDILIGINDEN calisir.
  Iptal etme/yeniden gonderme. `VPS_getActionDetailsV1` ile durumu izle (delayed -> started -> success).

## 12. Proxy arkasi uygulamada sonsuz http<->https dongusu / karisik icerik (WordPress vb.)
- **Sebep:** Traefik TLS'i sonlandirip uygulamaya **http (port 80)** yonlendirir; uygulama kendini
  http sanip URL'leri http uretir -> Traefik https'e geri atar -> dongu.
- **Cozum (WordPress):** `WORDPRESS_CONFIG_EXTRA` ile `X-Forwarded-Proto`'yu HTTPS yap:
  ```
  if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO']==='https') { $_SERVER['HTTPS']='on'; }
  ```
  (Compose icinde `$` -> `$$`; madde 13.) **n8n:** `N8N_PROTOCOL=https` + `WEBHOOK_URL=https://...` +
  `N8N_PROXY_HOPS=1`. **Genel:** uygulamaya "https arkasindayim" dedirten env/ayari bul.

## 13. Compose `command`/`environment` icindeki `$VAR` / `$_SERVER` / `$(...)` bozuluyor
- **Sebep:** Docker Manager compose'u interpolate eder; literal `$i`, `$_SERVER`, `$(cmd)` ifadelerini
  kendi degiskeni sanip BOSALTIR (`level=warning msg="The \"i\" variable is not set"`).
- **Cozum:** Compose'a giden **her literal `$`'i `$$`** yap (orn. `$$_SERVER`, `$$i`).
  Bizim sir placeholder'larimiz `${POSTGRES_PASSWORD}` ise BILEREK interpolate edilir — onlar tek `$` kalir.

## 14. Yan arac konteyneri (orn. `wordpress:cli`) "Error establishing a database connection"
- **Sebep:** Bazi resmi imajlar (wordpress) DB ayarlarini `wp-config.php` icinden **runtime'da
  ENV'den** okur (`getenv('WORDPRESS_DB_HOST')`). Ana servise ENV verilmistir; ama ayni volume'u
  paylasan yan/cli servisine `WORDPRESS_DB_*` vermezsen varsayilana (`mysql`) dusup baglanamaz.
- **Cozum:** Yan/cli servisine de **ayni** `WORDPRESS_DB_HOST/USER/PASSWORD/NAME` env'lerini ver.
  Ayrica cli'yi `user: "33:33"` (Debian www-data) ile calistir (dosya sahipligi uyumu) ve `HOME=/tmp` ver.
- **Genel ders:** Ayni volume = ayni dosyalar, AMA env otomatik PAYLASILMAZ. Env-tabanli config kullanan
  imajlarda her konteynere env'i ayrica ver. (Eklenti kurma: tek-seferlik `wordpress:cli` servisi +
  `wp plugin install <slug...> --activate`; bittikten sonra compose'u sade hale geri al, volume kalir.)

## 15. GHCR paketi public mi? (genelde otomatik olur)
- **Public** bir GitHub reposundan Actions ile push edilen GHCR paketi cogu zaman dogrudan **public
  dogar** — anonim manifest sorgusu 200 doner, ekstra "make public" adimi gerekmez.
- Yine de private dogarsa madde 5'i uygula. Her halukarda **deploy oncesi anonim manifest 200 ile DOGRULA**:
  `curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $(curl -s "https://ghcr.io/token?scope=repository:<user>/<repo>:pull" | grep -o '"token":"[^"]*"' | sed 's/.*://;s/"//g')" https://ghcr.io/v2/<user>/<repo>/manifests/latest`

## Genel refleks
Bir sey calismadiginda: `VPS_getProjectListV1` (durum: running/restarting/created?) ->
`VPS_getProjectLogsV1` (servis loglari) -> kok sebebi gor -> imaj/compose/env'i duzelt -> redeploy ->
curl ile dogrula. Tahminle redeploy etme; once logu oku.
