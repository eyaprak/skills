#!/usr/bin/env python3
"""fatura_kutusu.py: Belge akisi (Drive -> kontrol -> Sheets -> Telegram).

Hermes bu scripti cagirir, kendi script yazmaz. Her komut tek satir JSON basar.
Kontroller (tutar esitligi, zorunlu alan, mukerrer) BURADA yapilir; model yalnizca
belgeyi okuyup alanlari cikarir.

Komutlar:
  durum                            kurulum ve baglanti durumu (her calismada ILK komut)
  kur [--ana-klasor AD] [--tablo AD] [--yeniden]
                                   Drive klasorleri + Sheets tablosu olusturur, config yazar
  bicimle                          mevcut tabloya baslik ve tarih bicimi uygular (veri degismez)
  ayarla ANAHTAR=DEGER ...         config guncelle (orn. telegram_chat_id=123456789)
  anahtar mistral=<key>            anahtari dogrular, .env'e yazar (telegram=<token> de olur)
  telegram-test                    home kanalina deneme mesaji
  listele                          01-Gelen icindeki dosyalar
  oku FILE_ID                      dosyayi indirir, metnini cikarir (PDF metin katmani ya da Mistral OCR)
  kaydet FILE_ID --alanlar JSON    uc kontrol + yonlendirme + tablo + tasima + Telegram
  rapor [--ay YYYY-MM | --ay bu]   aylik ozet, Telegram'a gonderir

Config:  $HERMES_HOME/fatura-kutusu/config.json  (kurulumda uretilir; pakette yer almaz)
Anahtar: $HERMES_HOME/.env icinde MISTRAL_API_KEY ve TELEGRAM_BOT_TOKEN
Google:  google-workspace skill'inin urettigi google_token.json (ayni kimlik kullanilir)

"# DOGRULA:" ile isaretli yerler, ilk kurulumda sunucuda teyit edilmesi gereken varsayimlardir.
"""
import argparse
import base64
import datetime as dt
import io
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

# ---------------------------------------------------------------------------
# Ortam
# ---------------------------------------------------------------------------

def _hermes_home():
    h = os.environ.get("HERMES_HOME")
    if h:
        return h
    if os.path.isdir("/opt/data"):
        return "/opt/data"
    return os.path.expanduser("~/.hermes")


HERMES_HOME = _hermes_home()
CONFIG_DIR = os.path.join(HERMES_HOME, "fatura-kutusu")
CONFIG_PATH = os.path.join(CONFIG_DIR, "config.json")
ENV_PATH = os.path.join(HERMES_HOME, ".env")

SUTUNLAR = ["Islenme Tarihi", "Fatura No", "Fatura Tarihi", "Firma", "Vergi No",
            "Ara Toplam", "KDV", "Genel Toplam", "Vade", "Durum", "Belge"]
SURUM = "2.1.2"  # `durum` ciktisinda gorunur; sunucudaki kopya ile depo karsilastirilir
KAYITLI, KONTROL, MUKERRER = "Kayitli", "Kontrol Bekliyor", "Mukerrer"
# Tarih sutunlari (0 tabanli): A Islenme Tarihi, C Fatura Tarihi, I Vade.
# TUZAK: USER_ENTERED ile yazilan tarih hucreye tarih DEGERI olarak girer ama bicim
# "Automatic" kalabilir; o zaman ekranda 46273 gibi seri numara gorunur. Bu sutunlara
# acik tarih bicimi uygulanir: tablo kurulurken, mevcut tabloya `bicimle` ile ve her
# satir eklendikten sonra o satira.
TARIH_SUTUNLAR = (0, 2, 8)
TARIH_BICIMI = {"type": "DATE", "pattern": "dd.mm.yyyy"}
ALANLAR = ["fatura_no", "fatura_tarihi", "firma", "vergi_no",
           "ara_toplam", "kdv", "genel_toplam", "vade"]
ZORUNLU_VARSAYILAN = ["fatura_no", "fatura_tarihi", "firma", "genel_toplam"]
KLASOR_MIME = "application/vnd.google-apps.folder"
SHEET_MIME = "application/vnd.google-apps.spreadsheet"
AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
         "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]


# ---------------------------------------------------------------------------
# Cikti
# ---------------------------------------------------------------------------

def cikti(obj, kod=0):
    obj.setdefault("ok", kod == 0)
    print(json.dumps(obj, ensure_ascii=False))
    sys.exit(kod)


def hata(mesaj, **ek):
    d = {"ok": False, "hata": mesaj}
    d.update(ek)
    cikti(d, 1)


# ---------------------------------------------------------------------------
# Config ve .env
# ---------------------------------------------------------------------------

def env_oku():
    env = {}
    if not os.path.isfile(ENV_PATH):
        return env
    with open(ENV_PATH, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def config_yukle(zorunlu=True):
    if not os.path.isfile(CONFIG_PATH):
        if zorunlu:
            hata("Kurulum yapilmamis. Once `fatura_kutusu.py kur` calistir.", asama="KURULUM_GEREKLI")
        return None
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


def config_yaz(cfg):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def env_yaz(anahtar, deger):
    """$HERMES_HOME/.env icinde satiri ekler ya da gunceller. Degeri hicbir yere basmaz."""
    satirlar = []
    if os.path.isfile(ENV_PATH):
        with open(ENV_PATH, encoding="utf-8") as f:
            satirlar = f.read().splitlines()
    yeni = "%s=%s" % (anahtar, deger)
    bulundu = False
    for i, s in enumerate(satirlar):
        if s.strip().startswith(anahtar + "="):
            satirlar[i] = yeni
            bulundu = True
    if not bulundu:
        satirlar.append(yeni)
    with open(ENV_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(satirlar) + "\n")
    try:
        os.chmod(ENV_PATH, 0o600)
    except Exception:
        pass


def telegram_chat_id_kesfet():
    """Hermes'in kendi ayarlarindan home kanalinin chat_id'sini bulmaya calisir.

    # DOGRULA: Hermes config dosyasinin adi ve icindeki anahtar. Regex ile
    # 'home_channel' yakininda ya da 'chat_id' geceren ilk sayiyi aliyoruz.
    """
    env = env_oku()
    for k in ("TELEGRAM_HOME_CHAT_ID", "TELEGRAM_CHAT_ID", "TELEGRAM_ALLOWED_USERS"):
        v = env.get(k)
        if v:
            m = re.search(r"-?\d{5,}", v)
            if m:
                return m.group(0), ".env:" + k
    for ad in ("config.yaml", "config.yml", "config.json", "hermes.yaml", "settings.json"):
        p = os.path.join(HERMES_HOME, ad)
        if not os.path.isfile(p):
            continue
        try:
            t = open(p, encoding="utf-8").read()
        except Exception:
            continue
        m = re.search(r"home_channel[\s\S]{0,200}?chat_id[\"']?\s*[:=]\s*[\"']?(-?\d{5,})", t)
        if not m:
            m = re.search(r"chat_id[\"']?\s*[:=]\s*[\"']?(-?\d{5,})", t)
        if m:
            return m.group(1), ad
    return None, None


# ---------------------------------------------------------------------------
# Google kimligi ve servisler
# ---------------------------------------------------------------------------

def google_kimlik():
    """google-workspace skill'inin token dosyasini kullanir.

    # DOGRULA: setup.py'nin yazdigi google_token.json, google.oauth2 'authorized user'
    # formatinda mi? Degilse ikinci yol devreye girer: google_api.py icindeki kimlik
    # fonksiyonu import edilir. Hangisinin calistigini `durum` komutu raporlar.
    """
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

    adaylar = [
        os.path.join(HERMES_HOME, "google_token.json"),
        os.path.join(HERMES_HOME, "credentials", "google_token.json"),
        os.path.expanduser("~/.hermes/google_token.json"),
    ]
    for p in adaylar:
        if os.path.isfile(p):
            try:
                creds = Credentials.from_authorized_user_file(p)
                if creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                    with open(p, "w", encoding="utf-8") as f:
                        f.write(creds.to_json())
                return creds, p
            except Exception as e:  # format farkli olabilir, ikinci yola dus
                son_hata = "%s: %s" % (p, e)
                break
    else:
        son_hata = "google_token.json bulunamadi (%s)" % ", ".join(adaylar)

    # Ikinci yol: google_api.py'nin kendi kimlik fonksiyonu
    gws = os.path.join(HERMES_HOME, "skills", "productivity", "google-workspace", "scripts")
    if os.path.isdir(gws):
        sys.path.insert(0, gws)
        try:
            import google_api  # type: ignore
            for ad in ("get_credentials", "load_credentials", "get_creds", "_get_creds", "credentials"):
                fn = getattr(google_api, ad, None)
                if callable(fn):
                    return fn(), "google_api.%s()" % ad
        except Exception as e:
            son_hata += " | google_api import: %s" % e
    raise RuntimeError("Google kimligi yuklenemedi. Once google-workspace kurulumunu tamamla. " + son_hata)


def servisler():
    from googleapiclient.discovery import build
    creds, kaynak = google_kimlik()
    drive = build("drive", "v3", credentials=creds, cache_discovery=False)
    sheets = build("sheets", "v4", credentials=creds, cache_discovery=False)
    return drive, sheets, kaynak


# ---------------------------------------------------------------------------
# Drive yardimcilari
# ---------------------------------------------------------------------------

def _q(s):
    return s.replace("\\", "\\\\").replace("'", "\\'")


def drive_link(fid):
    return "https://drive.google.com/file/d/%s/view" % fid


def klasor_link(fid):
    return "https://drive.google.com/drive/folders/%s" % fid


def tablo_link(sid):
    return "https://docs.google.com/spreadsheets/d/%s" % sid


def klasor_bul(drive, ad, parent):
    q = "name='%s' and '%s' in parents and mimeType='%s' and trashed=false" % (_q(ad), parent, KLASOR_MIME)
    r = drive.files().list(q=q, fields="files(id,name)", pageSize=5).execute()
    f = r.get("files", [])
    return f[0]["id"] if f else None


def klasor_bul_veya_olustur(drive, ad, parent):
    fid = klasor_bul(drive, ad, parent)
    if fid:
        return fid, False
    body = {"name": ad, "mimeType": KLASOR_MIME, "parents": [parent]}
    return drive.files().create(body=body, fields="id").execute()["id"], True


def dosya_listele(drive, parent):
    q = "'%s' in parents and trashed=false and mimeType!='%s'" % (parent, KLASOR_MIME)
    r = drive.files().list(q=q, fields="files(id,name,mimeType,size,createdTime)",
                           orderBy="createdTime", pageSize=100).execute()
    return r.get("files", [])


def dosya_meta(drive, fid):
    return drive.files().get(fileId=fid, fields="id,name,mimeType,parents,size").execute()


def dosya_indir(drive, fid, mime):
    from googleapiclient.http import MediaIoBaseDownload
    if mime.startswith("application/vnd.google-apps."):
        raise RuntimeError("Google Docs/Sheets turunde dosya; fatura PDF ya da fotograf olarak atilmali.")
    buf = io.BytesIO()
    dl = MediaIoBaseDownload(buf, drive.files().get_media(fileId=fid))
    bitti = False
    while not bitti:
        _, bitti = dl.next_chunk()
    return buf.getvalue()


def dosya_tasi(drive, fid, hedef, yeni_ad=None):
    meta = dosya_meta(drive, fid)
    eski = ",".join(meta.get("parents", []))
    body = {"name": yeni_ad} if yeni_ad else {}
    # addParents / removeParents SORGU parametresidir, body'e koyulmaz.
    return drive.files().update(fileId=fid, addParents=hedef, removeParents=eski,
                                body=body, fields="id,name,parents").execute()


# ---------------------------------------------------------------------------
# Sheets yardimcilari
# ---------------------------------------------------------------------------

def tablo_bul(drive, ad, parent):
    q = "name='%s' and '%s' in parents and mimeType='%s' and trashed=false" % (_q(ad), parent, SHEET_MIME)
    r = drive.files().list(q=q, fields="files(id,name)", pageSize=5).execute()
    f = r.get("files", [])
    return f[0]["id"] if f else None


def tablo_olustur(drive, sheets, ad, parent, sayfa="Kayitlar"):
    body = {"properties": {"title": ad},
            "sheets": [{"properties": {"title": sayfa, "gridProperties": {"frozenRowCount": 1}}}]}
    ss = sheets.spreadsheets().create(body=body, fields="spreadsheetId,sheets.properties.sheetId").execute()
    sid = ss["spreadsheetId"]
    sheet_id = ss["sheets"][0]["properties"]["sheetId"]
    sheets.spreadsheets().values().update(
        spreadsheetId=sid, range="%s!A1:K1" % sayfa, valueInputOption="RAW",
        body={"values": [SUTUNLAR]}).execute()
    sheets.spreadsheets().batchUpdate(spreadsheetId=sid,
                                      body={"requests": bicim_istekleri(sheet_id)}).execute()
    # Tabloyu ana klasore tasi (create koku Drive'a koyar)
    meta = dosya_meta(drive, sid)
    drive.files().update(fileId=sid, addParents=parent, removeParents=",".join(meta.get("parents", [])),
                         fields="id").execute()
    return sid


def sayfa_adi_bul(sheets, sid):
    ss = sheets.spreadsheets().get(spreadsheetId=sid, fields="sheets.properties.title").execute()
    return ss["sheets"][0]["properties"]["title"]


def no_anahtar(v):
    """Fatura no karsilastirma anahtari. Eski satirlarda Sheets numarayi sayiya
    cevirmis olabilir (2026000147.0); bicimden bagimsiz esitlik icin normalize eder."""
    if v in (None, ""):
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return re.sub(r"\s+", "", str(v)).lstrip("'").upper()


def sheets_tarih(v):
    """Sheets hucresini YYYY-MM-DD metnine cevirir.

    TUZAK: USER_ENTERED ile yazilan '2026-09-10' Sheets'te TARIH hucresine donusur;
    UNFORMATTED_VALUE ile okununca seri numara gelir (46275 = 1899-12-30'dan gun sayisi).
    Ham hucreye startswith('2026-09') uygulanirsa hicbir satir eslesmez ve rapor 0 gosterir.
    Tarih hucreleri yalnizca bu fonksiyondan gecerek okunur.
    """
    if v in (None, ""):
        return ""
    if isinstance(v, bool):
        return ""
    if isinstance(v, (int, float)):
        try:
            return (dt.date(1899, 12, 30) + dt.timedelta(days=int(v))).strftime("%Y-%m-%d")
        except (OverflowError, ValueError):
            return ""
    return tarih_normalize(str(v)) or ""


def metin_zorla(v):
    """Fatura no ve vergi no gibi kimlik alanlarini Sheets'in sayiya cevirmesini engeller.

    TUZAK: USER_ENTERED ile yazilan '0001234' sayiya doner, bastaki sifirlar kaybolur;
    on haneli vergi no bilimsel gosterime kayabilir. Bastaki kesme isareti hucreyi metin
    yapar ve gorunmez. Okurken (UNFORMATTED_VALUE) kesme isareti gelmez.
    """
    if v in (None, ""):
        return ""
    v = str(v)
    return v if v.startswith("'") else "'" + v


def fatura_nolari(sheets, cfg):
    """Mukerrer kontrolu icin TAZE liste. Her cagri tabloyu yeniden okur."""
    r = sheets.spreadsheets().values().get(
        spreadsheetId=cfg["tablo_id"], range="%s!B2:B" % cfg["sayfa_adi"],
        valueRenderOption="UNFORMATTED_VALUE").execute()
    return set(no_anahtar(v[0]) for v in r.get("values", []) if v and no_anahtar(v[0]))


def bicim_istekleri(sheet_id, satir_bas=None, satir_son=None):
    """Tablo bicimi: baslik kalin, sutun genislikleri, tarih sutunlarina dd.mm.yyyy.

    satir_bas/satir_son verilirse yalnizca o satir araligina tarih bicimi uygulanir
    (0 tabanli, yari acik). Verilmezse basliktan sutunun sonuna kadar.
    """
    if satir_bas is None:
        istekler = [
            {"repeatCell": {"range": {"sheetId": sheet_id, "startRowIndex": 0, "endRowIndex": 1},
                            "cell": {"userEnteredFormat": {"textFormat": {"bold": True}}},
                            "fields": "userEnteredFormat.textFormat.bold"}},
            {"autoResizeDimensions": {"dimensions": {"sheetId": sheet_id, "dimension": "COLUMNS",
                                                     "startIndex": 0, "endIndex": 11}}},
        ]
        aralik = {"startRowIndex": 1}
    else:
        istekler = []
        aralik = {"startRowIndex": satir_bas, "endRowIndex": satir_son}
    for col in TARIH_SUTUNLAR:
        r = dict(aralik, sheetId=sheet_id, startColumnIndex=col, endColumnIndex=col + 1)
        istekler.append({"repeatCell": {"range": r,
                                        "cell": {"userEnteredFormat": {"numberFormat": TARIH_BICIMI}},
                                        "fields": "userEnteredFormat.numberFormat"}})
    return istekler


def sayfa_id_bul(sheets, cfg):
    ss = sheets.spreadsheets().get(spreadsheetId=cfg["tablo_id"],
                                   fields="sheets.properties.sheetId,sheets.properties.title").execute()
    for s in ss["sheets"]:
        if s["properties"]["title"] == cfg["sayfa_adi"]:
            return s["properties"]["sheetId"]
    return ss["sheets"][0]["properties"]["sheetId"]


def bicim_uygula(sheets, cfg, satir_bas=None, satir_son=None):
    sheet_id = sayfa_id_bul(sheets, cfg)
    sheets.spreadsheets().batchUpdate(
        spreadsheetId=cfg["tablo_id"],
        body={"requests": bicim_istekleri(sheet_id, satir_bas, satir_son)}).execute()


def _satir_no(updated_range):
    """'Kayitlar!A5:K5' -> 5 (1 tabanli). Bulunamazsa None."""
    m = re.search(r"![A-Z]+(\d+)", updated_range or "")
    return int(m.group(1)) if m else None


def satir_ekle(sheets, cfg, satir):
    r = sheets.spreadsheets().values().append(
        spreadsheetId=cfg["tablo_id"], range="%s!A1" % cfg["sayfa_adi"],
        valueInputOption="USER_ENTERED", insertDataOption="INSERT_ROWS",
        body={"values": [satir]}).execute()
    # Eklenen satirin tarih hucrelerine bicim uygula. Basarisiz olursa kayit yine tamamdir;
    # ekranda seri numara gorunur, `bicimle` komutu duzeltir.
    try:
        n = _satir_no(r.get("updates", {}).get("updatedRange"))
        if n:
            bicim_uygula(sheets, cfg, n - 1, n)
    except Exception:
        pass
    return r


def tum_satirlar(sheets, cfg):
    r = sheets.spreadsheets().values().get(
        spreadsheetId=cfg["tablo_id"], range="%s!A2:K" % cfg["sayfa_adi"],
        valueRenderOption="UNFORMATTED_VALUE").execute()
    return r.get("values", [])


# ---------------------------------------------------------------------------
# OCR ve metin cikarma
# ---------------------------------------------------------------------------

def mime_tahmin(ad, mime):
    if mime and mime != "application/octet-stream":
        return mime
    u = ad.lower().rsplit(".", 1)[-1] if "." in ad else ""
    return {"pdf": "application/pdf", "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "png": "image/png", "webp": "image/webp", "heic": "image/heic"}.get(u, "application/octet-stream")


def pdf_metin(data):
    """PDF'in metin katmani varsa onu dondurur; yoksa None (OCR'a dusulur)."""
    try:
        import pypdf
        r = pypdf.PdfReader(io.BytesIO(data))
        t = "\n".join((p.extract_text() or "") for p in r.pages)
        if len(t.strip()) > 40:
            return t
    except Exception:
        pass
    try:
        import pymupdf
        d = pymupdf.open(stream=data, filetype="pdf")
        t = "\n".join(p.get_text() for p in d)
        if len(t.strip()) > 40:
            return t
    except Exception:
        pass
    return None


def mistral_ocr(data, mime):
    key = env_oku().get("MISTRAL_API_KEY")
    if not key or key.lower() == "atla":
        raise RuntimeError("Mistral anahtari yok ya da atlandi; fotograf/taranmis belge okunamaz. PDF olarak at ya da anahtar ekle.")
    b64 = base64.b64encode(data).decode("ascii")
    tip = "document_url" if mime == "application/pdf" else "image_url"
    body = {"model": "mistral-ocr-latest",
            "document": {"type": tip, tip: "data:%s;base64,%s" % (mime, b64)}}
    req = urllib.request.Request(
        "https://api.mistral.ai/v1/ocr", data=json.dumps(body).encode("utf-8"),
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            j = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raise RuntimeError("Mistral OCR HTTP %s: %s" % (e.code, e.read()[:300].decode("utf-8", "ignore")))
    return "\n\n".join(p.get("markdown", "") for p in j.get("pages", []))


# ---------------------------------------------------------------------------
# Telegram
# ---------------------------------------------------------------------------

def tg_gonder(cfg, metin):
    """Duz metin gonderir; parse_mode kullanilmaz (ozel karakterler 400 uretir)."""
    token = env_oku().get("TELEGRAM_BOT_TOKEN") or env_oku().get("TELEGRAM")
    chat = (cfg or {}).get("telegram_chat_id")
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN %s icinde yok." % ENV_PATH)
    if not chat:
        raise RuntimeError("telegram_chat_id ayarlanmamis. `fatura_kutusu.py ayarla telegram_chat_id=<id>`")
    data = urllib.parse.urlencode({"chat_id": chat, "text": metin,
                                   "disable_web_page_preview": "true"}).encode()
    req = urllib.request.Request("https://api.telegram.org/bot%s/sendMessage" % token, data=data)
    with urllib.request.urlopen(req, timeout=30) as r:
        j = json.loads(r.read())
    if not j.get("ok"):
        raise RuntimeError("Telegram: %s" % j)
    return j


def tg_dene(cfg, metin):
    """Gonderim hatasi akisi durdurmaz; sonucu string olarak doner."""
    try:
        tg_gonder(cfg, metin)
        return "gonderildi"
    except Exception as e:
        return "gonderilemedi: %s" % e


# ---------------------------------------------------------------------------
# Normalizasyon
# ---------------------------------------------------------------------------

def tarih_normalize(s):
    if s in (None, ""):
        return None
    s = str(s).strip()
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d", "%Y.%m.%d"):
        try:
            return dt.datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def tutar_normalize(v):
    """'5.400,00 TL' -> 5400.0 ; '5400.00' -> 5400.0 ; 5400 -> 5400.0 ; bos -> None"""
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = re.sub(r"[^0-9,.\-]", "", str(v))
    if not s or s in ("-", ".", ","):
        return None
    if "," in s and "." in s:
        if s.rfind(",") > s.rfind("."):
            s = s.replace(".", "").replace(",", ".")
        else:
            s = s.replace(",", "")
    elif "," in s:
        s = s.replace(",", ".") if len(s.rsplit(",", 1)[1]) <= 2 else s.replace(",", "")
    elif "." in s:
        parcalar = s.split(".")
        if len(parcalar[-1]) == 3 and all(len(p) == 3 for p in parcalar[1:]):
            s = s.replace(".", "")
    try:
        return round(float(s), 2)
    except ValueError:
        return None


def tl(x):
    if x is None:
        return "boş"
    s = "{:,.2f}".format(x).replace(",", "#").replace(".", ",").replace("#", ".")
    return s + " TL"


_EKLER = {"ltd", "sti", "as", "san", "tic", "ve", "limited", "sirketi", "anonim", "a", "s"}


def firma_slug(ad):
    if not ad:
        return "Firma"
    t = unicodedata.normalize("NFKD", str(ad).replace("ı", "i").replace("İ", "I"))
    t = "".join(c for c in t if not unicodedata.combining(c))
    kelimeler = [re.sub(r"[^A-Za-z0-9]", "", k) for k in t.split()]
    kelimeler = [k for k in kelimeler if k and k.lower() not in _EKLER]
    return "".join(k[:1].upper() + k[1:] for k in kelimeler[:3]) or "Firma"


def alanlari_normalize(ham):
    a = {k: ham.get(k) for k in ALANLAR}
    notlar = []
    for k in ("fatura_tarihi", "vade"):
        if a[k] not in (None, ""):
            n = tarih_normalize(a[k])
            if n is None:
                notlar.append("%s okunamadi: '%s'" % (k, a[k]))
            a[k] = n
    for k in ("ara_toplam", "kdv", "genel_toplam"):
        if a[k] not in (None, ""):
            n = tutar_normalize(a[k])
            if n is None:
                notlar.append("%s okunamadi: '%s'" % (k, a[k]))
            a[k] = n
    for k in ("fatura_no", "firma", "vergi_no"):
        a[k] = str(a[k]).strip() if a[k] not in (None, "") else None
    return a, notlar


# ---------------------------------------------------------------------------
# Kontroller (modelin degil, kodun isi)
# ---------------------------------------------------------------------------

def kontrol_et(a, mevcut_nolar, cfg):
    zorunlu = cfg.get("zorunlu_alanlar", ZORUNLU_VARSAYILAN)
    tolerans = float(cfg.get("tolerans", 0.01))
    sonuc = {"mukerrer": False, "tutar_fark": None, "eksik": []}

    if a["fatura_no"] and no_anahtar(a["fatura_no"]) in mevcut_nolar:
        sonuc["mukerrer"] = True
        return MUKERRER, sonuc

    if a["ara_toplam"] is not None and a["kdv"] is not None and a["genel_toplam"] is not None:
        beklenen = round(a["ara_toplam"] + a["kdv"], 2)
        if abs(beklenen - a["genel_toplam"]) > tolerans:
            sonuc["tutar_fark"] = round(a["genel_toplam"] - beklenen, 2)
            sonuc["beklenen_genel"] = beklenen

    sonuc["eksik"] = [k for k in zorunlu if a.get(k) in (None, "")]

    if sonuc["tutar_fark"] is not None or sonuc["eksik"]:
        return KONTROL, sonuc
    return KAYITLI, sonuc


# ---------------------------------------------------------------------------
# Komutlar
# ---------------------------------------------------------------------------

def cmd_durum(args):
    d = {"surum": SURUM, "hermes_home": HERMES_HOME, "python": sys.executable, "config": os.path.isfile(CONFIG_PATH),
         "config_yolu": CONFIG_PATH, "uyarilar": []}
    env = env_oku()
    d["mistral_key"] = bool(env.get("MISTRAL_API_KEY"))
    d["telegram_token"] = bool(env.get("TELEGRAM_BOT_TOKEN") or env.get("TELEGRAM"))
    if not d["mistral_key"]:
        d["uyarilar"].append("MISTRAL_API_KEY yok: fotograf ve taranmis belgeler okunamaz, PDF'ler islenir.")

    try:
        import googleapiclient  # noqa
        d["googleapiclient"] = True
    except Exception:
        d["googleapiclient"] = False
        d["asama"] = "GOOGLE_GEREKLI"
        d["uyarilar"].append("googleapiclient bu python'da yok. Venv ile calistir ya da google-workspace kurulumunu yap.")
        cikti(d)

    try:
        drive, sheets, kaynak = servisler()
        hakkinda = drive.about().get(fields="user(emailAddress)").execute()
        d["google"] = {"ok": True, "hesap": hakkinda.get("user", {}).get("emailAddress"), "kimlik_kaynagi": kaynak}
    except Exception as e:
        d["google"] = {"ok": False, "hata": str(e)}
        d["asama"] = "GOOGLE_GEREKLI"
        cikti(d)

    if not d["mistral_key"]:
        d["asama"] = "MISTRAL_GEREKLI"
        cikti(d)

    cfg = config_yukle(zorunlu=False)
    if not cfg:
        d["asama"] = "KURULUM_GEREKLI"
        cikti(d)

    if not cfg.get("telegram_chat_id"):
        cid, kaynak = telegram_chat_id_kesfet()
        if cid:
            cfg["telegram_chat_id"] = cid
            config_yaz(cfg)
            d["telegram_chat_id_kaynagi"] = kaynak
    d["telegram_chat_id"] = bool(cfg.get("telegram_chat_id"))
    erisim = {}
    for k in ("ana_klasor_id", "gelen_id", "islenen_id", "hatali_id"):
        try:
            m = dosya_meta(drive, cfg[k])
            erisim[k] = m["name"]
        except Exception as e:
            erisim[k] = "ERISILEMIYOR: %s" % e
    try:
        erisim["tablo_id"] = sayfa_adi_bul(sheets, cfg["tablo_id"])
    except Exception as e:
        erisim["tablo_id"] = "ERISILEMIYOR: %s" % e
    d["erisim"] = erisim
    d["baglantilar"] = {"ana_klasor": klasor_link(cfg["ana_klasor_id"]), "gelen": klasor_link(cfg["gelen_id"]),
                        "tablo": tablo_link(cfg["tablo_id"])}
    if any(str(v).startswith("ERISILEMIYOR") for v in erisim.values()):
        d["asama"] = "KURULUM_BOZUK"
        d["uyarilar"].append("Config'deki bir klasor/tablo erisilemiyor. `kur --yeniden` ile yeniden kur.")
    elif not cfg.get("telegram_chat_id") or not d["telegram_token"]:
        d["asama"] = "TELEGRAM_EKSIK"
    else:
        d["asama"] = "HAZIR"
    cikti(d)


def cmd_kur(args):
    eski = config_yukle(zorunlu=False)
    if eski and not args.yeniden:
        cikti({"mesaj": "Zaten kurulu. Yeniden kurmak icin --yeniden.", "config": eski,
               "baglantilar": {"ana_klasor": klasor_link(eski["ana_klasor_id"]), "tablo": tablo_link(eski["tablo_id"])}})
    try:
        drive, sheets, _ = servisler()
    except Exception as e:
        hata(str(e), asama="GOOGLE_GEREKLI")

    olusan = []
    ana, y = klasor_bul_veya_olustur(drive, args.ana_klasor, "root")
    olusan.append((args.ana_klasor, y))
    gelen, y = klasor_bul_veya_olustur(drive, "01-Gelen", ana); olusan.append(("01-Gelen", y))
    islenen, y = klasor_bul_veya_olustur(drive, "02-Islenen", ana); olusan.append(("02-Islenen", y))
    hatali, y = klasor_bul_veya_olustur(drive, "03-Hatali", ana); olusan.append(("03-Hatali", y))

    tablo = tablo_bul(drive, args.tablo, ana)
    if tablo:
        sayfa = sayfa_adi_bul(sheets, tablo)
        olusan.append((args.tablo, False))
    else:
        sayfa = "Kayitlar"
        tablo = tablo_olustur(drive, sheets, args.tablo, ana, sayfa)
        olusan.append((args.tablo, True))

    cfg = {
        "surum": 1,
        "kurulum_tarihi": dt.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "ana_klasor_adi": args.ana_klasor, "ana_klasor_id": ana,
        "gelen_id": gelen, "islenen_id": islenen, "hatali_id": hatali,
        "tablo_adi": args.tablo, "tablo_id": tablo, "sayfa_adi": sayfa,
        "telegram_chat_id": (eski or {}).get("telegram_chat_id"),
        "hyperlink_ayirici": (eski or {}).get("hyperlink_ayirici", ";"),
        "zorunlu_alanlar": ZORUNLU_VARSAYILAN,
        "tolerans": 0.01,
    }
    config_yaz(cfg)
    if not olusan[-1][1]:
        # Tablo zaten vardi: eski surumle kurulmus olabilir, bicimi simdi uygula.
        try:
            bicim_uygula(sheets, cfg)
        except Exception:
            pass
    cikti({"mesaj": "Kurulum tamam.",
           "olusturulan": [ad for ad, yeni in olusan if yeni],
           "zaten_vardi": [ad for ad, yeni in olusan if not yeni],
           "baglantilar": {"ana_klasor": klasor_link(ana), "gelen": klasor_link(gelen),
                           "islenen": klasor_link(islenen), "hatali": klasor_link(hatali), "tablo": tablo_link(tablo)},
           "config_yolu": CONFIG_PATH,
           "sonraki_adim": "01-Gelen klasorune bir belge at ve 'belgeleri isle' de."})


def cmd_bicimle(args):
    """Mevcut tabloya baslik ve tarih bicimini uygular. Kurulum yoksa hata vermez."""
    cfg = config_yukle(zorunlu=False)
    if not cfg:
        cikti({"mesaj": "Kurulum yok, bicimleme atlandi.", "atlandi": True})
    _, sheets, _ = servisler()
    bicim_uygula(sheets, cfg)
    cikti({"mesaj": "Tablo bicimlendi: baslik kalin, tarih sutunlari dd.mm.yyyy. Veriler degismedi.",
           "tablo": tablo_link(cfg["tablo_id"])})


def cmd_ayarla(args):
    cfg = config_yukle()
    degisen = {}
    for cift in args.ciftler:
        if "=" not in cift:
            hata("Bicim: ANAHTAR=DEGER (%s)" % cift)
        k, v = cift.split("=", 1)
        k = k.strip()
        v = v.strip()
        if k == "zorunlu_alanlar":
            v = [x.strip() for x in v.split(",") if x.strip()]
        elif k == "tolerans":
            v = float(v)
        cfg[k] = v
        degisen[k] = v
    config_yaz(cfg)
    cikti({"mesaj": "Ayarlar guncellendi.", "degisen": degisen})


def cmd_anahtar(args):
    """Sohbetten gelen anahtari .env'e yazar ve dogrular. Anahtar ciktida gorunmez."""
    if "=" not in args.cift:
        hata("Bicim: mistral=<anahtar>")
    ad, deger = args.cift.split("=", 1)
    ad, deger = ad.strip().lower(), deger.strip().strip('"').strip("'")
    if not deger:
        hata("Anahtar bos.")
    if ad == "mistral":
        req = urllib.request.Request("https://api.mistral.ai/v1/models",
                                     headers={"Authorization": "Bearer " + deger})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                r.read()
        except urllib.error.HTTPError as e:
            hata("Mistral anahtari dogrulanamadi (HTTP %s). Anahtari kontrol et." % e.code)
        env_yaz("MISTRAL_API_KEY", deger)
        cikti({"mesaj": "Mistral anahtari kaydedildi ve dogrulandi.", "dosya": ENV_PATH})
    elif ad == "telegram":
        req = urllib.request.Request("https://api.telegram.org/bot%s/getMe" % deger)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                j = json.loads(r.read())
        except urllib.error.HTTPError as e:
            hata("Telegram bot token dogrulanamadi (HTTP %s)." % e.code)
        env_yaz("TELEGRAM_BOT_TOKEN", deger)
        cikti({"mesaj": "Telegram bot token kaydedildi.", "bot": j.get("result", {}).get("username")})
    else:
        hata("Bilinmeyen anahtar adi: %s (mistral ya da telegram)" % ad)


def cmd_telegram_test(args):
    cfg = config_yukle()
    try:
        tg_gonder(cfg, "✅ Fatura Kutusu bağlandı. Bu kanala her işlenen belge için rapor gelecek.")
    except Exception as e:
        hata(str(e))
    cikti({"mesaj": "Deneme mesaji gonderildi.", "chat_id": cfg.get("telegram_chat_id")})


def cmd_listele(args):
    cfg = config_yukle()
    drive, _, _ = servisler()
    dosyalar = dosya_listele(drive, cfg["gelen_id"])
    cikti({"adet": len(dosyalar),
           "dosyalar": [{"id": f["id"], "ad": f["name"], "mime": mime_tahmin(f["name"], f.get("mimeType", "")),
                         "boyut": int(f.get("size", 0) or 0), "eklenme": f.get("createdTime")} for f in dosyalar]})


def cmd_oku(args):
    cfg = config_yukle()
    drive, _, _ = servisler()
    try:
        meta = dosya_meta(drive, args.file_id)
        mime = mime_tahmin(meta["name"], meta.get("mimeType", ""))
        data = dosya_indir(drive, args.file_id, meta.get("mimeType", ""))
    except Exception as e:
        hata("Dosya indirilemedi: %s" % e, file_id=args.file_id)

    kaynak, metin = None, None
    if mime == "application/pdf":
        metin = pdf_metin(data)
        kaynak = "pdf-metin" if metin else None
    if metin is None:
        if not mime.startswith("image/") and mime != "application/pdf":
            hata("Desteklenmeyen tur: %s. PDF ya da fotograf (jpg/png) at." % mime, file_id=args.file_id, ad=meta["name"])
        try:
            metin = mistral_ocr(data, mime)
            kaynak = "ocr"
        except Exception as e:
            hata("OCR basarisiz: %s" % e, file_id=args.file_id, ad=meta["name"])

    cikti({"file_id": args.file_id, "ad": meta["name"], "mime": mime, "kaynak": kaynak,
           "metin": metin,
           "istenen_alanlar": ALANLAR,
           "not": "Alanlari bu metinden cikar. Emin olmadigini null birak; tutari kendin duzeltme."})


def cmd_kaydet(args):
    cfg = config_yukle()
    try:
        ham = json.loads(args.alanlar)
    except Exception as e:
        hata("--alanlar gecerli JSON degil: %s" % e)
    drive, sheets, _ = servisler()

    try:
        meta = dosya_meta(drive, args.file_id)
    except Exception as e:
        hata("Dosya bulunamadi: %s" % e, file_id=args.file_id)
    ad = meta["name"]
    uzanti = ("." + ad.rsplit(".", 1)[1]) if "." in ad else ""

    a, notlar = alanlari_normalize(ham)
    mevcut = fatura_nolari(sheets, cfg)          # her belgede taze sorgu
    durum, k = kontrol_et(a, mevcut, cfg)
    simdi = dt.datetime.now()
    islenme = simdi.strftime("%Y-%m-%d")
    ayirici = cfg.get("hyperlink_ayirici", ";")
    sonuc = {"file_id": args.file_id, "dosya": ad, "durum": durum, "alanlar": a, "kontrol": k, "notlar": notlar}

    if durum == KAYITLI:
        ay = (a["fatura_tarihi"] or islenme)[:7]
        ay_id, _ = klasor_bul_veya_olustur(drive, ay, cfg["islenen_id"])
        yeni_ad = "%s_%s_%dTL%s" % (a["fatura_tarihi"] or islenme, firma_slug(a["firma"]),
                                    int(round(a["genel_toplam"])), uzanti)
        dosya_tasi(drive, args.file_id, ay_id, yeni_ad)
        link = drive_link(args.file_id)
        satir = [islenme, metin_zorla(a["fatura_no"]), a["fatura_tarihi"], a["firma"], metin_zorla(a["vergi_no"]),
                 a["ara_toplam"] if a["ara_toplam"] is not None else "", a["kdv"] if a["kdv"] is not None else "",
                 a["genel_toplam"], a["vade"] or "", KAYITLI,
                 '=HYPERLINK("%s"%s "Görüntüle")' % (link, ayirici)]
        satir_ekle(sheets, cfg, satir)
        sonuc.update({"yeni_ad": yeni_ad, "klasor": "02-Islenen/%s" % ay, "belge": link})
        mesaj = ("📋 Fatura Kutusu\n\n🗂 Dosya: %s\n🕒 Zaman: %s\n🔢 Fatura No: %s\n🏢 Firma: %s\n"
                 "💰 Ara Toplam: %s | KDV: %s | Genel Toplam: %s\n\n📌 Sonuç: 🟢 Kayıtlı\n\n"
                 "• Yeni ad: %s\n• Klasör: 02-Islenen/%s\n• Belge: %s") % (
            ad, simdi.strftime("%d.%m.%Y %H:%M"), a["fatura_no"], a["firma"],
            tl(a["ara_toplam"]), tl(a["kdv"]), tl(a["genel_toplam"]), yeni_ad, ay, link)

    elif durum == KONTROL:
        dosya_tasi(drive, args.file_id, cfg["hatali_id"])
        link = drive_link(args.file_id)
        satir = [islenme, metin_zorla(a["fatura_no"]), a["fatura_tarihi"] or "", a["firma"] or "", metin_zorla(a["vergi_no"]),
                 a["ara_toplam"] if a["ara_toplam"] is not None else "", a["kdv"] if a["kdv"] is not None else "",
                 a["genel_toplam"] if a["genel_toplam"] is not None else "", a["vade"] or "", KONTROL,
                 '=HYPERLINK("%s"%s "Görüntüle")' % (link, ayirici)]
        satir_ekle(sheets, cfg, satir)
        sebepler = []
        if k["tutar_fark"] is not None:
            sebepler.append("Ara toplam + KDV = %s, belgede genel toplam %s yazıyor (fark %s)." % (
                tl(k["beklenen_genel"]), tl(a["genel_toplam"]), tl(abs(k["tutar_fark"]))))
        if k["eksik"]:
            sebepler.append("Eksik alanlar: %s." % ", ".join(k["eksik"]))
        sebepler += notlar
        sonuc.update({"klasor": "03-Hatali", "belge": link, "sebepler": sebepler})
        mesaj = ("📋 Fatura Kutusu\n\n🗂 Dosya: %s\n🕒 Zaman: %s\n🔢 Fatura No: %s\n🏢 Firma: %s\n"
                 "💰 Ara Toplam: %s | KDV: %s | Genel Toplam: %s\n\n📌 Sonuç: 🟡 Kontrol Bekliyor\n\n%s\n\n"
                 "Kaydetmedim, belgeyi 03-Hatali klasörüne aldım. Ne yapayım?\n• Belge: %s") % (
            ad, simdi.strftime("%d.%m.%Y %H:%M"), a["fatura_no"] or "boş", a["firma"] or "boş",
            tl(a["ara_toplam"]), tl(a["kdv"]), tl(a["genel_toplam"]),
            "\n".join("• " + s for s in sebepler), link)

    else:  # MUKERRER
        dosya_tasi(drive, args.file_id, cfg["hatali_id"])
        link = drive_link(args.file_id)
        sonuc.update({"klasor": "03-Hatali", "belge": link})
        mesaj = ("📋 Fatura Kutusu\n\n🗂 Dosya: %s\n🕒 Zaman: %s\n🔢 Fatura No: %s\n🏢 Firma: %s\n\n"
                 "📌 Sonuç: 🔴 Mükerrer\n\n• Bu fatura numarası tabloda zaten kayıtlı. İkinci satır açmadım, "
                 "dosyayı 03-Hatali klasörüne aldım.\n• Belge: %s") % (
            ad, simdi.strftime("%d.%m.%Y %H:%M"), a["fatura_no"], a["firma"] or "boş", link)

    sonuc["telegram"] = tg_dene(cfg, mesaj) if cfg.get("telegram_chat_id") else "atlandi: chat_id yok"
    cikti(sonuc)


def cmd_rapor(args):
    cfg = config_yukle()
    drive, sheets, _ = servisler()
    bugun = dt.date.today()
    if args.ay == "bu":
        ay = bugun.strftime("%Y-%m")
    elif args.ay:
        ay = args.ay
    else:
        ilk = bugun.replace(day=1)
        ay = (ilk - dt.timedelta(days=1)).strftime("%Y-%m")

    # Islenme Tarihi hucresi seri numara gelebilir; ham hucreye startswith uygulama.
    satirlar = [s for s in tum_satirlar(sheets, cfg) if s and sheets_tarih(s[0])[:7] == ay]

    def hucre(s, i):
        return s[i] if i < len(s) else ""

    kayitli = [s for s in satirlar if hucre(s, 9) == KAYITLI]
    bekleyen = [s for s in satirlar if hucre(s, 9) == KONTROL]
    toplam = sum(tutar_normalize(hucre(s, 7)) or 0 for s in kayitli)
    firmalar = {}
    for s in kayitli:
        firmalar[hucre(s, 3)] = firmalar.get(hucre(s, 3), 0) + (tutar_normalize(hucre(s, 7)) or 0)
    en_yuksek = sorted(firmalar.items(), key=lambda x: -x[1])[:3]
    hatali_adet = len(dosya_listele(drive, cfg["hatali_id"]))
    gelen_adet = len(dosya_listele(drive, cfg["gelen_id"]))

    yil, ayno = ay.split("-")
    baslik = "%s %s" % (AYLAR[int(ayno) - 1], yil)
    satirlar_m = ["📊 %s Özeti" % baslik, "",
                  "✅ İşlenen belge: %d, toplam %s" % (len(kayitli), tl(toplam)),
                  "🟡 Kontrol bekleyen kayıt: %d" % len(bekleyen),
                  "📁 03-Hatali klasöründe bekleyen dosya: %d" % hatali_adet]
    if gelen_adet:
        satirlar_m.append("📥 01-Gelen'de işlenmemiş dosya: %d" % gelen_adet)
    if en_yuksek:
        satirlar_m += ["", "🏢 En yüksek tutarlı firmalar:"] + \
                      ["• %s: %s" % (f or "boş", tl(t)) for f, t in en_yuksek]
    satirlar_m += ["", "🔗 Tablo: %s" % tablo_link(cfg["tablo_id"])]
    mesaj = "\n".join(satirlar_m)

    cikti({"ay": ay, "ay_adi": baslik, "islenen": len(kayitli), "toplam": round(toplam, 2), "kontrol_bekleyen": len(bekleyen),
           "hatali_klasoru": hatali_adet, "gelen_bekleyen": gelen_adet,
           "en_yuksek": [{"firma": f, "toplam": round(t, 2)} for f, t in en_yuksek],
           "mesaj": mesaj,
           "telegram": tg_dene(cfg, mesaj) if cfg.get("telegram_chat_id") else "atlandi: chat_id yok"})


# ---------------------------------------------------------------------------

def main():
    p = argparse.ArgumentParser(description="Belge akisi")
    sp = p.add_subparsers(dest="cmd", required=True)
    sp.add_parser("durum").set_defaults(fn=cmd_durum)
    k = sp.add_parser("kur")
    k.add_argument("--ana-klasor", default="Fatura-Kutusu")
    k.add_argument("--tablo", default="Fatura Kayitlari")
    k.add_argument("--yeniden", action="store_true")
    k.set_defaults(fn=cmd_kur)
    sp.add_parser("bicimle").set_defaults(fn=cmd_bicimle)
    a = sp.add_parser("ayarla")
    a.add_argument("ciftler", nargs="+")
    a.set_defaults(fn=cmd_ayarla)
    an = sp.add_parser("anahtar")
    an.add_argument("cift", help="mistral=<anahtar> ya da telegram=<bot token>")
    an.set_defaults(fn=cmd_anahtar)
    sp.add_parser("telegram-test").set_defaults(fn=cmd_telegram_test)
    sp.add_parser("listele").set_defaults(fn=cmd_listele)
    o = sp.add_parser("oku")
    o.add_argument("file_id")
    o.set_defaults(fn=cmd_oku)
    ky = sp.add_parser("kaydet")
    ky.add_argument("file_id")
    ky.add_argument("--alanlar", required=True, help="JSON: fatura_no, fatura_tarihi, firma, vergi_no, ara_toplam, kdv, genel_toplam, vade")
    ky.set_defaults(fn=cmd_kaydet)
    r = sp.add_parser("rapor")
    r.add_argument("--ay", default=None, help="YYYY-MM, 'bu' = bu ay; bos = gecen ay")
    r.set_defaults(fn=cmd_rapor)

    args = p.parse_args()
    try:
        args.fn(args)
    except SystemExit:
        raise
    except Exception as e:
        hata("%s: %s" % (type(e).__name__, e), komut=args.cmd)


if __name__ == "__main__":
    main()
