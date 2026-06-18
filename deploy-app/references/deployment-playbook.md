# Deployment playbook (adim adim + gerekceler)

Hedef: yerel/GitHub'daki bir uygulamayi Hostinger VPS'te, kullanicinin alan adinda
HTTPS ile, tamamen Hostinger MCP uzerinden canliya almak.

## 0. Kesif
- `VPS_getVirtualMachinesV1` ile VPS'leri listele. Hedef VPS'in `state` ve `template`'ine bak.
- `domains_getDomainListV1` + `DNS_getDNSRecordsV1` ile alan adi hesapta mi, DNS Hostinger'da mi gor.
- Uygulamayi incele: dil/framework, dinleme portu, build/start komutlari, veritabani (varsa hangisi),
  build sirasinda DB'ye gidiliyor mu (gidiliyorsa sorun — asagi bak).

## 1. VPS'i Docker'a hazirla
- Docker Manager **yalniz Docker tabanli sablonlarda** calisir. `VPS_getProjectListV1` cagir:
  `[VPS:2044] ... does not support Docker Manager` donuyorsa sablon uygun degildir.
- Uygun degilse: kullaniciya **YIKICI** oldugunu (tum veri silinir) acikla, ONAY al, mumkunse
  `VPS_createSnapshotV1` ile yedekle, sonra `VPS_recreateVirtualMachineV1` ile **template_id 1210**
  ("Ubuntu 24.04 with Docker and Traefik") kur. IP degismez; recreate ~5-10 dk surer, `actions_lock`
  acilana kadar bekle (poll). Sonra `VPS_setHostnameV1` ile hostname'i geri ayarla.
- Bu sablonda zaten bir `traefik` projesi calisir; `VPS_getProjectContentsV1` ile dogrula:
  entrypoint'ler `web`(:80)/`websecure`(:443), `certificatesresolvers.letsencrypt`, http->https redirect,
  `exposedbydefault=false`, Traefik `network_mode: host`.

## 2. Uygulamayi paketle (yerelde dosya uret)
- `Dockerfile` (cok asamali; uygulamayi build + calisma imaji). Bkz. compose-dockerfile-templates.md.
- `.dockerignore` (node_modules, .next, .git, .env*).
- DB varsa `docker-entrypoint.sh`: once `migrate deploy` (idempotent), DB bossa seed (olumcul degil),
  sonra uygulamayi baslat. `PATH`'e `/app/node_modules/.bin` ekle (yoksa `tsx`/CLI bulunamaz).
- `.github/workflows/build-and-push.yml`: imaji **GHCR**'ye build+push (GITHUB_TOKEN ile, ek secret yok).
- `.gitattributes`: `*.sh text eol=lf` (Windows'ta CRLF shebang'i bozmasin).
- Gizli uretim compose'u (`docker-compose.prod.yml`) **gitignore**'a ekle.

## 3. Build'in DB'siz gecmesini garantile
Build CI'da olur ve o sirada DB YOKTUR. Build sirasinda veritabanina giden sayfa varsa build patlar.
- Next.js: DB kullanan sayfa/route'lari `export const dynamic = "force-dynamic"` yap (ya da dogrula
  ki zaten oyle). Statik uretimde DB sorgusu olmamali.
- Genel: build adimi yalniz kaynaktan derlesin; veriye runtime'da baglansin.

## 4. Kodu GitHub'a koy ve imaji yayinla
- `gh auth setup-git` + normal `git push` (force kullanma; uzak gecmis varsa
  `git pull --no-rebase --allow-unrelated-histories -X ours` ile birlestir).
- Repo **public** olmali (sunucu GHCR'den auth'suz cekecekse) — ya da private kalip sunucu GHCR'ye
  login olmali (zorlu; mumkunse public sec, kaynak zaten paylasiliyorsa risk yok).
- Actions calismasini `gh run watch <id> --exit-status` ile bekle.
- Imaj GHCR'de PRIVATE dogar; **public yap** ki sunucu auth'suz ceksin. (Bu adim kullanici onayi/yetki
  gerektirebilir — gerekirse paket ayarlari linkini ver: github.com/users/<user>/packages/container/<repo>/settings.)
- Public olup olmadigini anonim manifest sorgusuyla dogrula (HTTP 200 = cekiebilir).

## 5. MCP ile deploy
- `VPS_createNewProjectV1` cagir:
  - `project_name`: kisa ad (orn. uygulamanin adi).
  - `content`: uretim compose'u (image: ghcr.io/...:latest, `pull_policy: always`, DB servisi,
    Traefik etiketleri, `${POSTGRES_PASSWORD}` / `${ADMIN_PASSWORD}` placeholder'lari).
  - `environment`: random sirlar (KEY=VALUE satirlar). **Ilk deployda uret**; redeploy'da
    `VPS_getProjectContentsV1` ile mevcut env'i oku ve AYNISINI tekrar kullan (yoksa DB parolasi
    degisir, baglanti kopar — Postgres parolasi yalniz ilk init'te gecerlidir).
- Traefik etiketleri (servis adini ve portu uyarlamayi unutma):
  ```
  traefik.enable=true
  traefik.http.routers.<ad>.rule=Host(`ALANADI`) || Host(`www.ALANADI`)
  traefik.http.routers.<ad>.entrypoints=websecure
  traefik.http.routers.<ad>.tls.certresolver=letsencrypt
  traefik.http.services.<ad>.loadbalancer.server.port=<UYGULAMA_PORTU>
  ```

## 6. DNS
- `DNS_validateDNSRecordsV1` -> `DNS_updateDNSRecordsV1` (overwrite=true):
  A `@` -> VPS IPv4, AAAA `@` -> VPS IPv6, www icin CNAME (apex'e). TTL 300 (hizli yayilma).
- Traefik ACME HTTP-01 challenge'i 80 portundan dogrular; DNS yayilinca sertifika otomatik gelir.

## 7. Dogrulama
- `VPS_getProjectListV1`: tum konteynerler `running`/`healthy` mi? `restarting` varsa cokme dongusudur
  -> `VPS_getProjectLogsV1` oku, duzelt, yeni imaj/compose ile redeploy.
- curl ile: `http://ALAN` 301 mi, `https://ALAN` 200 mi, sertifika issuer **Let's Encrypt** mi,
  sayfa/veri geliyor mu. Sonucu kullaniciya sade rapor et + giris bilgileri (random parolalari ver).

## Guncelleme akisi (kullaniciya soyle)
Kodu `main`'e push et -> CI yeni imaji GHCR'ye atar -> MCP ile yeniden deploy (pull_policy: always
sayesinde guncel imaj gelir). DB env'i degismez (geri okunup tekrar kullanilir).
