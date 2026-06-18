# Hostinger MCP arac haritasi (deploy icin yonlendirici referans)

Bu, tum MCP datasinin dokumu DEGIL; deploy akisinda gercekten ise yarayan araclarin
"hangi is icin hangi arac" haritasidir. Araclar bu ortamda deferred'dir: cagirmadan once
`ToolSearch` ile yukle, orn: `ToolSearch "select:mcp__hostinger-vps__VPS_getProjectListV1"`.

## 1) VPS kesfi ve durum (salt-okunur — guvenli)
- `VPS_getVirtualMachinesV1` — tum VPS'leri listeler (id, state, plan, ipv4, template). **Ilk adim.**
- `VPS_getVirtualMachineDetailsV1` — tek VPS detayi (IP, template, kilit durumu).
- `VPS_getMetricsV1` — CPU/RAM/disk/ag/uptime gecmisi (tarih araligi ile).
- `VPS_getDataCenterListV1` / `VPS_getTemplatesV1` / `VPS_getTemplateDetailsV1` — DC ve OS sablonlari.

## 2) VPS yasam dongusu (DIKKAT: bazilari YIKICI)
- `VPS_startVirtualMachineV1` / `VPS_stopVirtualMachineV1` / `VPS_restartVirtualMachineV1`.
- `VPS_recreateVirtualMachineV1` — **YIKICI**. VPS'i bir template ile sifirdan kurar (TUM VERI SILINIR).
  Docker Manager icin gereken Docker sablonuna gecmek burada yapilir. Onay + yedek sart.
  Parola kurallari: 12+ karakter, buyuk/kucuk harf, rakam, sizdirilmamis. Panel template'leri
  ek `panel_password` ister (orn. CloudPanel `#%+:?@` sembollerinden biri zorunlu).
- `VPS_setHostnameV1` — hostname ayarlar (recreate sonrasi sifirlanir).
- `VPS_setRootPasswordV1`, `VPS_setNameserversV1`, `VPS_createPTRRecordV1` — diger ayarlar.

## 3) Docker Manager = DEPLOY MEKANIZMASI (yalniz Docker tabanli sablonlarda calisir)
> Onemli: Bu grup compose imajlarini **PULL eder, build ETMEZ**. Imaj registry'de hazir olmali.
- `VPS_getProjectListV1` — VPS'teki Docker Compose projelerini + konteyner durumlarini listeler.
  (Docker desteklemeyen OS'ta `[VPS:2044] ... does not support Docker Manager` doner.)
- `VPS_createNewProjectV1` — **ANA DEPLOY ARACI.** compose'u (ham YAML / URL / GitHub repo) deploy eder.
  `project_name`, `content` (compose), `environment` (compose .env'i — sirlar burada) alir.
  Ayni isimde proje varsa degistirir. `${VAR}` placeholder'lari `environment`'tan interpolate olur.
- `VPS_getProjectContentsV1` — projenin compose'unu **ve env'ini** geri okur (redeploy'da sirlari
  tekrar kullanmak icin sart).
- `VPS_getProjectLogsV1` — tum servislerin son ~300 log satiri (hata ayiklama icin ilk basvuru).
- `VPS_getProjectContainersV1` — konteyner detaylari (port, health, stats).
- `VPS_startProjectV1` / `VPS_stopProjectV1` / `VPS_restartProjectV1` / `VPS_updateProjectV1` / `VPS_deleteProjectV1`.

## 4) Yedek / snapshot (yikici islemden ONCE kullan)
- `VPS_getBackupsV1` — mevcut otomatik yedekler.
- `VPS_createSnapshotV1` / `VPS_getSnapshotV1` / `VPS_restoreSnapshotV1` / `VPS_restoreBackupV1`.

## 5) DNS (alan adini sunucuya baglamak icin)
- `DNS_getDNSRecordsV1` — mevcut kayitlar (once oku, neyin var oldugunu gor).
- `DNS_validateDNSRecordsV1` — degisiklik oncesi dogrula (422 = hata).
- `DNS_updateDNSRecordsV1` — A/AAAA/CNAME ekле/guncelle. `overwrite=true` ayni ad+tip'i degistirir,
  digerlerine dokunmaz. Apex icin `name: "@"`. **Deploy'da: A(@)->VPS IPv4, AAAA(@)->IPv6, www CNAME.**
- `DNS_getDNSSnapshotListV1` / `DNS_restoreDNSSnapshotV1` — DNS geri alma.

## 6) Domain / Firewall (gerekirse)
- `domains_getDomainListV1` / `domains_getDomainDetailsV1` — alan adi hesapta mi, DNS Hostinger'da mi.
- `domains_updateDomainNameserversV1` — NS Hostinger'da degilse yonlendir.
- `VPS_getFirewallListV1` / `VPS_createNewFirewallV1` / `VPS_createFirewallRuleV1` / `VPS_activateFirewallV1`
  — 80/443 portlarinin acik oldugundan emin ol (Traefik sablonunda genelde firewall grubu yok = acik).

## Tipik cagri sirasi (mutlu yol)
getVirtualMachines -> (gerekirse recreate=1210 + setHostname) -> getProjectList (Docker var mi)
-> createNewProject(image+traefik+env) -> getProjectList/Logs (dogrula) -> DNS_updateDNSRecords
-> curl ile son dogrulama.
