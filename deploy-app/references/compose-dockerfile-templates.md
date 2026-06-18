# Hazir sablonlar (uyarlayarak kullan)

Asagidakiler Next.js 16 + Prisma/PostgreSQL ornegidir; baska stack icin mantik ayni kalir
(build->image->registry->compose+traefik). Servis adi, port ve komutlari uygulamaya gore degistir.

## Dockerfile (cok asamali; tam node_modules ile — migration/seed araclari hazir olsun)
```dockerfile
FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat   # Prisma motoru icin
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
RUN npx prisma generate        # DB GEREKTIRMEZ
RUN npm run build              # tum DB sayfalari force-dynamic ise DB'siz gecer

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/prisma ./prisma
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
```

## docker-entrypoint.sh (migration + kosullu, OLUMCUL OLMAYAN seed)
```sh
#!/bin/sh
set -e
export PATH="/app/node_modules/.bin:$PATH"   # tsx/prisma/next bulunabilsin (yoksa ENOENT)

echo "[entrypoint] migrate deploy..."
prisma migrate deploy

SERVICE_COUNT=$(node -e 'const{PrismaClient}=require("@prisma/client");const p=new PrismaClient();p.service.count().then(n=>{console.log(n);return p.$disconnect()}).catch(()=>{console.log(0)})' 2>/dev/null || echo 0)
if [ "$SERVICE_COUNT" = "0" ]; then
  echo "[entrypoint] DB bos -> seed..."
  tsx prisma/seed.ts || echo "[entrypoint] UYARI: seed basarisiz, app yine de basliyor."
else
  echo "[entrypoint] DB dolu -> seed atlandi."
fi

echo "[entrypoint] uygulama basliyor..."
exec npm run start
```
> Not: `node_modules/.bin`'i PATH'e eklemek kritik. `prisma db seed` tsx'i PATH'te arar; bulamazsa
> `spawn tsx ENOENT` ile coker. Bunun yerine dogrudan `tsx prisma/seed.ts` cagir ve hatayi yut.

## .github/workflows/build-and-push.yml (GHCR'ye build+push)
```yaml
name: Build and push image to GHCR
on:
  push: { branches: [main] }
  workflow_dispatch:
permissions: { contents: read, packages: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with: { registry: ghcr.io, username: ${{ github.actor }}, password: ${{ secrets.GITHUB_TOKEN }} }
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ghcr.io/<KULLANICI>/<REPO>:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## Uretim compose'u (createNewProject `content`) — placeholder'li parolalar
```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: <ad>-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: <ad>
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?env ile verilmeli}
      POSTGRES_DB: <ad>
    volumes:
      - <ad>-pgdata:/var/lib/postgresql/data    # DB sifirlamak gerekirse volume adini degistir (orn -v2)
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U <ad> -d <ad>"]
      interval: 5s
      timeout: 3s
      retries: 10
  app:
    image: ghcr.io/<KULLANICI>/<REPO>:latest
    container_name: <ad>-app
    pull_policy: always
    restart: unless-stopped
    depends_on:
      db: { condition: service_healthy }
    environment:
      DATABASE_URL: "postgresql://<ad>:${POSTGRES_PASSWORD}@db:5432/<ad>?schema=public"
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:?env ile verilmeli}
      NODE_ENV: "production"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.<ad>.rule=Host(`ALANADI`) || Host(`www.ALANADI`)"
      - "traefik.http.routers.<ad>.entrypoints=websecure"
      - "traefik.http.routers.<ad>.tls.certresolver=letsencrypt"
      - "traefik.http.services.<ad>.loadbalancer.server.port=3000"
volumes:
  <ad>-pgdata:
```

## createNewProject `environment` (random sirlar — ilk deployda uret, redeploy'da geri oku & tekrarla)
```
POSTGRES_PASSWORD=<openssl rand -hex 24>
ADMIN_PASSWORD=<openssl rand -hex 12>
```
Uretim: `openssl rand -hex 24` (URL-guvenli hex). Redeploy'da `VPS_getProjectContentsV1`'in dondurdugu
`environment` icinden ayni degerleri al — Postgres parolasi yalniz ilk init'te gecerli oldugundan
degistirirsen DB hacmini (volume) sifirlaman gerekir.

## Statik site / DB'siz uygulama
DB servisini ve entrypoint'i atla; compose'da yalniz `app` servisi + Traefik etiketleri yeterli.
Imaji yine GHCR'ye build+push edip MCP ile deploy et.
