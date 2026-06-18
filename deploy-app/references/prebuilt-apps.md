# Hazir / acik kaynak uygulamalar (CI'siz, dogrudan deploy)

Bu dosya, **kendi kodun olmayan** hazir uygulamalar icindir (WordPress, n8n, Evolution API, Ghost,
Metabase, Uptime Kuma...). Bunlarin resmi imajlari **public registry'de** (Docker Hub / GHCR) zaten
hazirdir; bu yuzden **GitHub repo, CI ve GHCR build adimi GEREKMEZ** — Docker Manager imaji dogrudan
pull eder. Sadece compose'u `VPS_createNewProjectV1` ile gonderirsin.

## Iki yol — hangisi?
- **Kendi kodun** (Next.js, kendi API'n...): build gerekir -> `compose-dockerfile-templates.md` (GHCR akisi).
- **Hazir imaj** (asagidakiler): build YOK -> bu dosyadaki tarifi al, `ALANADI`/port/env'i uyarla, deploy et.

## Her tarif icin ortak adimlar
1. **DNS:** alt alan adi icin A kaydi -> VPS IPv4 (`DNS_updateDNSRecordsV1`, overwrite=true, ttl 300).
   Orn. `n8n` / `evo` / `blog` adli A kaydi.
2. **Sirlari uret** (yerelde): `openssl rand -hex 24`. Repoya yazma; `createNewProject`'in
   `environment` parametresiyle ver. **Redeploy'da `getProjectContents` ile geri okuyup AYNISINI kullan**
   (DB parolasi yalniz ilk init'te gecerli; n8n sifreleme anahtari degisirse kayitli kimlik bilgileri kaybolur).
3. **Deploy:** `VPS_createNewProjectV1` (`project_name`, `content`, `environment`).
4. **Dogrula:** `VPS_getProjectListV1` (running/healthy?) + `VPS_getProjectLogsV1`; sonra curl ile
   http->https (301), https 200/302, sertifika Let's Encrypt mi.

> Traefik etiketleri her tarifte ayni desen: `entrypoints=websecure`, `tls.certresolver=letsencrypt`,
> `loadbalancer.server.port=<UYGULAMA_PORTU>`. Router/servis adini benzersiz yap.

---

## Genel sablon (tek servis, herhangi bir public imaj)
```yaml
services:
  app:
    image: <ORG/IMAGE:TAG>          # Docker Hub / GHCR public imaj
    container_name: <ad>-app
    pull_policy: always
    restart: unless-stopped
    environment:
      KEY: ${SECRET:?env ile verilmeli}   # sirlari environment ile ver
    volumes:
      - <ad>-data:/data             # kalici veri yolu (imajin dokumanina bak!)
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.<ad>.rule=Host(`ALANADI`)"
      - "traefik.http.routers.<ad>.entrypoints=websecure"
      - "traefik.http.routers.<ad>.tls.certresolver=letsencrypt"
      - "traefik.http.services.<ad>.loadbalancer.server.port=<UYGULAMA_PORTU>"
volumes:
  <ad>-data:
```
> Yeni bir uygulama eklerken kontrol et: (a) dinledigi **port**, (b) **kalici veri** yolu(lari),
> (c) zorunlu **env**'ler, (d) **DB/Redis** gerekiyor mu, (e) ters proxy/HTTPS icin ozel env var mi.

---

## WordPress (MariaDB) — blog/site
- Port **80**, imaj `wordpress:latest` (+ `mariadb:11`). Kalici: `wp-data:/var/www/html`, `wp-dbdata:/var/lib/mysql`.
- Sirlar: `MYSQL_ROOT_PASSWORD`, `WORDPRESS_DB_PASSWORD` (= DB kullanici parolasi).
- **Ters proxy zorunlu duzeltmesi:** `WORDPRESS_CONFIG_EXTRA` ile HTTPS algilat (yoksa sonsuz yonlendirme dongusu).

```yaml
services:
  db:
    image: mariadb:11
    container_name: wordpress-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:?env ile verilmeli}
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: ${WORDPRESS_DB_PASSWORD:?env ile verilmeli}
    volumes:
      - wp-dbdata:/var/lib/mysql
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 10
  wordpress:
    image: wordpress:latest
    container_name: wordpress-app
    restart: unless-stopped
    depends_on:
      db: { condition: service_healthy }
    environment:
      WORDPRESS_DB_HOST: db:3306
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: ${WORDPRESS_DB_PASSWORD:?env ile verilmeli}
      WORDPRESS_DB_NAME: wordpress
      WORDPRESS_CONFIG_EXTRA: |
        if (isset($$_SERVER['HTTP_X_FORWARDED_PROTO']) && $$_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
            $$_SERVER['HTTPS'] = 'on';
        }
    volumes:
      - wp-data:/var/www/html
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.wordpress.rule=Host(`ALANADI`)"
      - "traefik.http.routers.wordpress.entrypoints=websecure"
      - "traefik.http.routers.wordpress.tls.certresolver=letsencrypt"
      - "traefik.http.services.wordpress.loadbalancer.server.port=80"
volumes:
  wp-dbdata:
  wp-data:
```
`environment`: `MYSQL_ROOT_PASSWORD=<hex24>` + `WORDPRESS_DB_PASSWORD=<hex24>`. (`$$` -> compose kacisi, troubleshooting #13.)
- **Sonra:** kullaniciya kurulumu tamamlat: `https://ALANADI/wp-admin/install.php` (dil + site basligi +
  guclu admin sifre). Kurulum ekrani public; botlar hemen tarar -> HEMEN tamamlat (troubleshooting'e bagli).
- **Eklenti kurma (otomatik):** compose'a tek-seferlik bir servis ekle, calistir, sonra cikar (volume kalir):
  ```yaml
  wpcli:
    image: wordpress:cli
    container_name: wordpress-cli
    user: "33:33"                    # Debian www-data; dosya sahipligi uyumu
    environment:                     # cli env'i PAYLASMAZ -> ayrica ver (troubleshooting #14)
      HOME: /tmp
      WORDPRESS_DB_HOST: db:3306
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: ${WORDPRESS_DB_PASSWORD:?env ile verilmeli}
      WORDPRESS_DB_NAME: wordpress
    depends_on:
      db: { condition: service_healthy }
      wordpress: { condition: service_started }
    volumes:
      - wp-data:/var/www/html
    command: ["sh","-c","wp db check && wp plugin install contact-form-7 wordpress-seo --activate; wp plugin list"]
    restart: "no"
  ```
  Loglardan "Plugin ... activated" gor; sonra wpcli'siz compose ile redeploy et (sade hale dondur).

---

## n8n (otomasyon) — Postgres + ters proxy
- Port **5678**, imaj `docker.n8n.io/n8nio/n8n:latest`. Kalici: `n8n-data:/home/node/.n8n` (sifreleme anahtari + veri).
- Sirlar: `POSTGRES_PASSWORD`, `N8N_ENCRYPTION_KEY` (**redeploy'da AYNISINI koru** — degisirse kayitli kimlik bilgileri okunamaz).
- Ters proxy: `N8N_PROTOCOL=https`, `WEBHOOK_URL` ve `N8N_HOST` public adres; `N8N_PROXY_HOPS=1`.

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: n8n-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: n8n
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?env ile verilmeli}
      POSTGRES_DB: n8n
    volumes:
      - n8n-dbdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U n8n -d n8n"]
      interval: 5s
      timeout: 3s
      retries: 10
  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    container_name: n8n-app
    restart: unless-stopped
    depends_on:
      db: { condition: service_healthy }
    environment:
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: db
      DB_POSTGRESDB_PORT: 5432
      DB_POSTGRESDB_DATABASE: n8n
      DB_POSTGRESDB_USER: n8n
      DB_POSTGRESDB_PASSWORD: ${POSTGRES_PASSWORD:?env ile verilmeli}
      N8N_HOST: ALANADI
      N8N_PORT: 5678
      N8N_PROTOCOL: https
      N8N_PROXY_HOPS: 1
      WEBHOOK_URL: https://ALANADI/
      N8N_EDITOR_BASE_URL: https://ALANADI/
      GENERIC_TIMEZONE: Europe/Istanbul
      N8N_ENCRYPTION_KEY: ${N8N_ENCRYPTION_KEY:?env ile verilmeli}
    volumes:
      - n8n-data:/home/node/.n8n
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.n8n.rule=Host(`ALANADI`)"
      - "traefik.http.routers.n8n.entrypoints=websecure"
      - "traefik.http.routers.n8n.tls.certresolver=letsencrypt"
      - "traefik.http.services.n8n.loadbalancer.server.port=5678"
volumes:
  n8n-dbdata:
  n8n-data:
```
`environment`: `POSTGRES_PASSWORD=<hex24>` + `N8N_ENCRYPTION_KEY=<hex24>`.
- **Sonra:** ilk ziyarette n8n sahip (owner) hesabini kurdurur (e-posta + sifre). Webhook'lar `WEBHOOK_URL`'i kullanir.

---

## Evolution API (WhatsApp API) — Postgres + Redis
- Port **8080**, imaj `evoapicloud/evolution-api:latest`. **Postgres + Redis ZORUNLU.** Kalici: `evolution-instances:/evolution/instances`.
- Sirlar: `POSTGRES_PASSWORD`, `EVOLUTION_API_KEY` (global admin anahtari; istek basliginda `apikey:` ile kullanilir).

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: evolution-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: evolution
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?env ile verilmeli}
      POSTGRES_DB: evolution
    volumes:
      - evolution-dbdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U evolution -d evolution"]
      interval: 5s
      timeout: 3s
      retries: 10
  redis:
    image: redis:7-alpine
    container_name: evolution-redis
    restart: unless-stopped
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - evolution-redis:/data
  evolution:
    image: evoapicloud/evolution-api:latest
    container_name: evolution-app
    restart: unless-stopped
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_started }
    environment:
      SERVER_URL: https://ALANADI
      AUTHENTICATION_API_KEY: ${EVOLUTION_API_KEY:?env ile verilmeli}
      DATABASE_ENABLED: "true"
      DATABASE_PROVIDER: postgresql
      DATABASE_CONNECTION_URI: "postgresql://evolution:${POSTGRES_PASSWORD}@db:5432/evolution?schema=evolution_api"
      DATABASE_CONNECTION_CLIENT_NAME: evolution_exchange
      DATABASE_SAVE_DATA_INSTANCE: "true"
      DATABASE_SAVE_DATA_NEW_MESSAGE: "true"
      DATABASE_SAVE_MESSAGE_UPDATE: "true"
      DATABASE_SAVE_DATA_CONTACTS: "true"
      DATABASE_SAVE_DATA_CHATS: "true"
      CACHE_REDIS_ENABLED: "true"
      CACHE_REDIS_URI: "redis://redis:6379/6"
      CACHE_REDIS_PREFIX_KEY: evolution
      CACHE_LOCAL_ENABLED: "false"
    volumes:
      - evolution-instances:/evolution/instances
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.evolution.rule=Host(`ALANADI`)"
      - "traefik.http.routers.evolution.entrypoints=websecure"
      - "traefik.http.routers.evolution.tls.certresolver=letsencrypt"
      - "traefik.http.services.evolution.loadbalancer.server.port=8080"
volumes:
  evolution-dbdata:
  evolution-redis:
  evolution-instances:
```
`environment`: `POSTGRES_PASSWORD=<hex24>` + `EVOLUTION_API_KEY=<hex24>`.
- **Sonra:** yonetim arayuzu `https://ALANADI/manager` (apikey ile giris). `SERVER_URL` public https adres olmali
  (QR/webhook URL'leri buradan uretilir). Env adlari surume gore degisebilir — supheliyse imajin
  guncel `.env.example`'ina bak (`github.com/EvolutionAPI/evolution-api`).

---

## Hizli kontrol listesi (yeni hazir uygulama icin)
- [ ] Imaj public registry'de mi? (Docker Hub/GHCR) -> CI yok, dogrudan deploy.
- [ ] Dinledigi port -> Traefik `loadbalancer.server.port`.
- [ ] Kalici veri yolu(lari) -> named volume.
- [ ] DB/Redis bagimliligi -> ayni compose'a ekle, `depends_on` + healthcheck.
- [ ] Ters proxy/HTTPS env'i (WEBHOOK_URL / SERVER_URL / N8N_PROTOCOL / WORDPRESS_CONFIG_EXTRA).
- [ ] Sirlar `environment` ile, redeploy'da geri okunup AYNISI.
- [ ] Alt alan adi A kaydi -> VPS IP.
