# Başka belge türlerine uyarlama

Akış faturaya özel değil. İki şey değişir: modelin çıkardığı alanlar ve script'in zorunlu saydığı alanlar. Kontrol mantığı aynı kalır: her belge bir kontrolden geçer, geçemeyen sessizce kaydedilmez.

## Fiş (market, yemek, taksi)

Fişte fatura numarası, ayrı KDV ve vade genellikle yoktur; tek bir toplam olur.

- Zorunlu alanları daralt: `$KUTU ayarla zorunlu_alanlar=fatura_tarihi,firma,genel_toplam`
- Alan çıkarırken `ara_toplam` ve `kdv` alanlarını `null` bırak; script tutar kontrolünü üç alan da doluysa yapar, boşsa atlar.
- `fatura_no` yerine fişin üstündeki fiş numarasını yaz; yoksa `null`. Mükerrer kontrolü bu alan boşsa çalışmaz, bunu kullanıcıya söyle.

## Sözleşme

Tutar kontrolü yerine tarih kontrolü gerekir. Script bunu şu an yapmıyor; iki yol var:

1. Basit: `fatura_tarihi` alanına başlangıç tarihini, `vade` alanına bitiş tarihini yaz. Zorunlu alanlar: `$KUTU ayarla zorunlu_alanlar=fatura_no,fatura_tarihi,firma,vade`. Aylık raporda vade alanı bitişe 30 gün kalanları gösterecek şekilde genişletilebilir.
2. Tam: `fatura_kutusu.py` içine `kontrol_et` fonksiyonuna tarih kuralı eklenir. Bu, kullanıcının değil paketi geliştirenin işidir.

## Sipariş belgeleri

- `fatura_no` alanına sipariş numarasını yaz; mükerrer kontrolü aynı şekilde çalışır.
- Tabloya teslim durumu sütunu eklemek istenirse `SUTUNLAR` listesi ve `kaydet` içindeki satır dizilimi birlikte değişmeli. Sütun eklemeden önce tablodaki mevcut başlıkları değiştirmemek gerekir.

## Değişmeyen üç kural

1. Emin olunmayan alan tahmin edilmez, boş bırakılır.
2. Kontrolü geçemeyen belge tabloya "Kayitli" olarak yazılmaz; kullanıcıya sorulur.
3. Tutmayan tutar düzeltilmez.

Bu üçü modelin talimatı değil, script'in davranışıdır. Belge türü değişse de burası değişmez.
