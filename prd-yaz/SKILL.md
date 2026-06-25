---
name: prd-yaz
description: Bir fikri, kullanıcıyı adım adım sorgulayıp varsa kod tabanını keşfederek ve modülleri tasarlayarak net, uygulanabilir bir PRD'ye (ürün gereksinim belgesine) dönüştürür ve sonucu prd.md dosyasına yazar. Kullanıcı PRD ya da ürün gereksinim belgesi yazmak, yeni bir uygulama veya özellik planlamak, bir fikri hayata geçirmeden önce kapsamını netleştirmek, ya da yapay zekaya kod yazdırmadan önce işi spesifikasyona dökmek istediğinde MUTLAKA bu skill'i kullan. "Şöyle bir uygulama yapmak istiyorum", "nereden başlasam", "bunu planlayalım", "spec çıkar", "özellik planı", "kapsamı belirleyelim" gibi belirsiz başlangıç durumlarında da, kullanıcı "PRD" kelimesini hiç kullanmasa bile devreye gir. Yalnızca tek satırlık bir kod yazma ya da var olan bir PRD'yi sadece biçimlendirme gibi planlama gerektirmeyen işlerde kullanma.
---

Bu skill, kullanıcı bir PRD oluşturmak istediğinde devreye girer. Gerekli görmediğin adımları atlayabilirsin.

## Soru Sorma Biçimi (Agent'a Göre)

Bu skill boyunca kullanıcıya soru yöneltirken, içinde çalıştığın agent'ın yeteneklerine göre EN UYGUN soru sorma aracını kullan. Düz metinle "şunu da söyle" diye sormak yerine, ortam destekliyorsa yapılandırılmış/seçimli soru araçlarını tercih et:

- **Claude / Claude Code** (bu ortam): Birden çok şıkkı olan, mutually-exclusive ya da çoklu seçim gerektiren kararlar için `AskUserQuestion` aracını kullan. Her soruda 2-4 net şık sun, önerdiğin şıkkı ilk sıraya koyup etiketine "(Önerilen)" ekle ve `description` alanında her şıkkın sonucunu/ödünleşimini açıkla. Birden fazla bağımsız karar varsa tek çağrıda (en fazla 4) soru gruplayabilirsin; cevaplar birbirinden bağımsızsa `multiSelect: true` kullan. Tamamen açık uçlu, serbest metin gerektiren anlatımlar (örneğin "problemi uzun uzun anlat") için düz metin sorusu kullanmaya devam et — bunları şıkka sıkıştırmaya çalışma.
- **Diğer agent'lar / etkileşimli olmayan ortamlar**: Yapılandırılmış soru aracı yoksa, soruları net ve numaralı düz metin olarak sor; ya da etkileşimli kullanıcı yoksa makul varsayımlarla ilerleyip varsayımları Notlar bölümünde listele (bkz. Adım 3).

Genel kural: kararı sen netleştireceksen ve sınırlı sayıda makul seçenek varsa → seçimli soru aracı. Kullanıcının kendi cümleleriyle anlatması gerekiyorsa → açık uçlu metin.

1. Kullanıcıdan çözmek istediği problemi uzun ve detaylı anlatmasını iste, varsa çözüm fikirlerini de sor. (Bu açık uçlu bir anlatım olduğundan düz metin sorusu uygundur.)

2. Varsa projeyi (repoyu) keşfet; kullanıcının söylediklerini doğrula ve kod tabanının mevcut durumunu anla. Yeni ve boş bir proje ise bu adımı atla.

3. Ortak bir anlayışa varana kadar kullanıcıyı planın her yönüyle ilgili sorgula. Tasarımın her dalını tek tek gez, kararlar arasındaki bağımlılıkları sırayla çöz. Belirsiz kalan hiçbir nokta bırakma. Sınırlı seçenekli kararları (örn. teknoloji seçimi, mimari yaklaşım, kapsam sınırı) yukarıdaki "Soru Sorma Biçimi" bölümüne göre seçimli soru aracıyla (Claude Code'da `AskUserQuestion`) sor.

**Kritik kararlarda kaçış kapısı YOKTUR.** Etkileşimli bir kullanıcı varken — kullanıcı "sen varsay", "bana sorma", "sen karar ver", "uygun gördüğünü yap" dese bile — teknoloji seçimi, mimari yaklaşım, veri modeli, kapsam sınırı, kimlik doğrulama/ödeme gibi geri dönüşü zor ya da kritik kararları tek başına karara bağlayıp doğrudan PRD'ye veya koda ATLAMA. "Sen varsay" talimatını sessizce varsayma izni olarak DEĞİL, "kararı benim önerimle yönlendir" olarak yorumla:

- Kararı, önerinle yönlendirilmiş seçimli bir `AskUserQuestion` sorusuna dönüştür.
- En güçlü gördüğün seçeneği ilk sıraya koy ve etiketine "(Önerilen)" ekle; `description` alanında neden önerdiğini ve ödünleşimini kısaca açıkla.
- Böylece kullanıcı önerini tek seçimle onaylayıp hızla ilerleyebilir, ama karar yine de ona ait kalır. Hız, "hiç sormamakla" değil, "iyi bir varsayılanı en üste koyup tek tıkla onaylatmakla" sağlanır.
- Birden çok kritik karar varsa bunları tek `AskUserQuestion` çağrısında (en fazla 4) gruplayabilirsin; her biri için yine önerilen şık en üstte olsun.

Yalnızca karşında GERÇEKTEN etkileşimli bir kullanıcı yoksa (otomatik/headless bir ortam: cron, CI, batch çalıştırma vb.): soruları kendi makul varsayımlarınla yanıtla ve bu varsayımları PRD'nin Notlar bölümünde tek tek açıkça listele ki sonradan teyit edilebilsin. Bu sessiz-varsayım yolu SADECE bu ortama özeldir; "kullanıcı varsaymamı istedi" gerekçesi bu yolu açmaz.

4. İnşa edilecek ya da değiştirilecek ana modülleri (parçaları) taslak halinde çıkar. İzole olarak test edilebilen derin modüller bulmaya çalış.

Derin modül (sığ modülün tersi): çok sayıda işlevi sade, test edilebilir ve nadiren değişen bir arayüzün arkasında toplayan modüldür.

Bu modüllerin kullanıcının beklentisiyle örtüşüp örtüşmediğini teyit et. Hangi modüller için test yazılmasını istediğini kullanıcıya sor — modül listesi belli olduğundan bunu seçimli/çoklu seçim soru aracıyla (Claude Code'da `AskUserQuestion`, `multiSelect: true`) sormak en uygunudur.

5. Problemi ve çözümü tam anladığında, aşağıdaki şablonu kullanarak PRD'yi YAZ ve `prd.md` dosyasına kaydet. Önce PRD'nin tam gövdesini dosyaya yaz, sonra dur. Sadece "yazıyorum" deyip durma, gerçekten içeriği üret. (İstenirse PRD ayrıca bir GitHub issue olarak da açılabilir.)

<prd-sablonu>

## Problem

Kullanıcının yaşadığı problem, kullanıcının gözünden.

## Çözüm

Probleme önerilen çözüm, kullanıcının gözünden.

## Kullanıcı Hikayeleri

UZUN, numaralı bir kullanıcı hikayeleri listesi. Her hikaye şu biçimde olsun:

1. Bir <aktör> olarak, bir <özellik> istiyorum, böylece <fayda>.

<ornek>
1. Bir mobil banka müşterisi olarak, hesaplarımdaki bakiyeyi görmek istiyorum, böylece harcamalarım hakkında daha bilinçli karar verebilirim.
</ornek>

Bu liste çok kapsamlı olsun ve özelliğin bütün yönlerini kapsasın.

## Uygulama Kararları

Alınan uygulama kararlarının listesi. Şunları içerebilir:

- İnşa edilecek ya da değiştirilecek modüller
- Bu modüllerin değişecek arayüzleri
- Geliştiriciden gelen teknik netleştirmeler
- Mimari kararlar
- Şema (veri tabanı) değişiklikleri
- API sözleşmeleri
- Belirli etkileşimler

Belirli dosya yolları ya da kod parçaları EKLEME. Bunlar çok hızlı eskiyebilir.

## Test Kararları

Alınan test kararlarının listesi. Şunları içersin:

- İyi bir testin tanımı (yalnızca dışa dönük davranışı test et, iç ayrıntıları değil)
- Hangi modüllerin test edileceği
- Projedeki benzer testlerden örnekler (varsa)

## Kabul Kriterleri

Bu özelliğin "tamamlandı" sayılması için sağlanması gereken somut, ölçülebilir ve doğrulanabilir koşullar. "Güzel olsun" gibi belirsiz değil, "şu akış uçtan uca çalışır ve build hatasız geçer" gibi net yaz. Bu kriterler, /goal gibi hedefe kilitleyen araçlarla doğrudan kullanılabilecek açıklıkta olmalı, çünkü modelin "bitti gibi" deyip yarım bırakmasını ölçülebilir bir bitiş çizgisi engeller.

## Kapsam Dışı

Bu PRD için kapsam dışı olan şeylerin açıklaması.

## Notlar

Özellikle ilgili başka notlar.

</prd-sablonu>
