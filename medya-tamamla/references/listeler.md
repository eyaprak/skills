# toplu.mjs liste biçimleri

Listeleri projede `uretim/` altına JSON olarak yaz; böylece kesilen iş aynı listeyle kaldığı yerden sürer (var olan çıktılar atlanır).

## Görsel listesi (`toplu.mjs gorsel`)

```json
[
  {
    "cikti": "uretim/ham/img/urun/kupa",
    "en_boy": "1:1",
    "boyut": "1K",
    "istem": "Game inventory icon of a red ceramic mug. Stylized 3D clay render, soft warm studio lighting, centered, object fills about 80% of the frame. Perfectly flat solid pure magenta background (#FF00FF), no floor, no shadow, no text."
  },
  {
    "cikti": "uretim/ham/img/urun/termos",
    "en_boy": "1:1",
    "boyut": "1K",
    "istem": "Use exactly the art style of the first reference image: … The object is: a stainless steel thermos with a teal cap.",
    "referanslar": ["uretim/ham/img/urun/kupa"]
  }
]
```

| Alan | Açıklama |
|---|---|
| `cikti` | Uzantısız ya da uzantılı yol. Model uzantıyı biçime göre seçer; aynı adda `.png`/`.jpg` varsa atlanır |
| `referanslar` | Uzantısız yazılabilir, betik var olan dosyayı bulur. Referans henüz yoksa betik durur, bu yüzden sıra önemli: stil örneği ve karakterin ilk görseli listede önce gelir |
| `en_boy` | `1:1`, `16:9`, `3:4`, `21:9` … |
| `boyut` | `512`, `1K`, `2K`, `4K` |
| `model` | İsteğe bağlı; varsayılan model yerine |

Ham çıktıyı `uretim/ham/` altına üretip `isle.mjs` ile `public/assets/` altına yazmak, ham ile işlenmişi karıştırmamanın en kolay yolu.

## Seslendirme listesi (`toplu.mjs ses`)

```json
[
  { "cikti": "uretim/ham/audio/vo/emredersin-1.wav", "ses": "Puck", "dil": "tr-TR", "metin": "Emredersin sahip!" },
  { "cikti": "uretim/ham/audio/vo/stok-kupa.wav", "ses": "Charon", "dil": "tr-TR", "metin": "Rafta kupa kalmadı!" }
]
```

- Aynı cümlenin tonlama çeşitleri için noktalamayı değiştir (`!`, `,`, `.`). Kelimeleri değiştirme; kullanıcı belli bir cümle istediyse birebir o cümle okunmalı.
- Dakikada 10 istek sınırı için varsayılan aralık 7 sn. 30 satır yaklaşık 4 dakika sürer; işi arka planda çalıştır.
- Çıktı WAV, 24 kHz mono. Projeye koymadan önce `isle.mjs ses` ile kırp ve MP3'e çevir.
