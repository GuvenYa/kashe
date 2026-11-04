# 46 - Claude Code gorevi: Duzeltme 05 - Fahri bulgulari (Kesfet, arama, ad gosterimi, ekip daveti)

Hazirlayan: Claude (Cowork), 5 Kasim 2026. Kaynak: `docs/sahne/bulgular.md` 63, 66, 67 (Fahri'nin Sahne sheet'i satir 1, 4, 5).
Urun kararlari (Guven, 5 Kasim): ad gosterimi "Ad S." (tam ad rezervasyondan sonra); "Ajanslar" -> "Kurumsal hizmet saglayicilar".
Girissiz AI (bulgu 64) ve tek AI girisi (65) BU GOREVDE DEGIL (Duzeltme 06, veritabani gerektirir).
Yalniz uygulama; veritabani degismez. 45 (10c-1 P1) commit'lendikten sonra, `main`'den acilan `duzeltme-05` dalinda.
Kullanim: Claude Code'a "`docs/envanter/46-claude-code-gorevi-duzeltme-05.md` dosyasini oku, "---" cizgisinin altindaki gorevi
uygula" denir.

---

## Gorev

Dort kucuk bolum. Turkce arayuz metinleri, ASCII kod yorumlari, yeni dosyalarda sapkali harf (inceltme isareti) yok. Commit ATMA.

### A) Ekip daveti geri bildirimi (bulgu 63) - `app/profil/ekibim/`

Davet basariyla gidince: form temizlenir ve kapanir (form acilir-kapanir bir panelse kapanir; degilse alanlar bosalir),
listenin USTUNDE gorunur bir basari mesaji cikar: "Davet gönderildi: <e-posta> (<rol>)". Kullanici asagi kaydirmadan gorur.
Hata mesajlari bugunku gibi formun yaninda kalir. Ayni deseni kurum ekibi davetinde de (`/profil/kurumsal-ekip`, ayni bilesen
kullaniliyorsa otomatik) uygula.

### B) Kesfet karti okunurlugu (bulgu 66 b) - `app/kesfet/profile-card.tsx` (+ ana sayfa one cikanlar ayni karti kullaniyorsa)

- Kategori cipi kesilmesin ("Terc..." degil "Tercüman"): `max-w-[130px] truncate` kaldirilir; cok uzun adlar (20+ karakter)
  icin cip satira sigmazsa ikinci satira duser, kart tasmaz.
- Ad tek satirda kesilmesin: `truncate` yerine en fazla 2 satir (`line-clamp-2`).
- Kart metin yogunlugu: kart basliginin boyutunu bir kademe kucult (masaustu ve mobil), aciklama satiri tek satir kalir.
  Fotograf oranina ve "Teklif Al" dugmesine DOKUNMA (bulgu 66 a/c/e ayri tasarim turu).

### C) "Ajanslar" -> "Kurumsal hizmet saglayicilar" (bulgu 66 f)

Yalniz HIZMET ALAN'in gordugu kesif yuzeylerinde: Kesfet "Kim" suzgeci (`Ajanslar` -> `Kurumsal hizmet sağlayıcılar`; altina
kucuk aciklama "Ajans, menajer, organizatör, organizasyon firması"), kart ustu rozet (`AJANS` -> `KURUMSAL`), `/p/[id]` profil
tur etiketi, ana sayfa bolum basligi ve footer baglantisi, SSS sorusu metni. URL parametresi (`?tip=ajans`) ve kod adlari
DEGISMEZ. Ajans hesabinin kendi paneli ("Ajans paneli", kayit formundaki hesap turu, admin) DEGISMEZ. Raporda degisen her
metni dosya:satir ile listele.

### D) Arama (bulgu 67) - `app/kesfet/page.tsx` (+ gerekirse `app/lib/arama.ts` yeni)

1. **Guvenlik:** `q` bugun `.or()` icine ham giriyor (`full_name.ilike.%${q}%`); virgul / parantez / yildiz sorguyu bozar.
   PostgREST filtre sozdizimini kiran karakterleri (`,()*:%\`) temizle; bos kalirsa arama yok sayilir.
2. **Kapsam:** ad, sirket adi ve kategori adina ek olarak `headline` ve `bio` da aranir (`v_providers_public` sutunlari).
3. **Es anlamli sozluk** `app/lib/arama.ts`: kucuk bir harita, terim -> etkinlik turu anahtari ve/veya kategori slug'i.
   En az: açılış / acilis / mağaza açılışı -> `launch`; nikah / nikah töreni -> `wedding`; doğum günü partisi -> `birthday`;
   kına -> `henna`; organizasyon firması / organizatör / etkinlik firması -> kategori `organizasyon`; menajer -> ajans tipi
   (Kurumsal hizmet saglayicilar). Eslesme varsa sonuca (VEYA ile) o etkinlik turunu beyan edenler
   (`category_attributes @> {"etkinlik_turleri":["launch"]}`) ve/veya o kategori eklenir. Etkinlik turu etiketleri tablodan
   (`etkinlikTurleri()`), kod icinde tur listesi YAZILMAZ; sozluk yalniz es anlamlilari tutar.
4. **Sonuc yoksa:** "Tam eşleşme bulamadık — yakın sonuçlar" basligiyla, aramayi dusurup diger suzgecler (sehir, tip) korunarak
   en fazla 12 sonuc gosterilir; yaninda "Kashe AI'a anlat" baglantisi (`/kashe-ai`). Bos durum metni bugunku gibi kalir
   (yakin sonuc da yoksa).

### E) Ad gosterimi "Ad S." (urun karari, bulgu 66 d)

Kural: BIREYSEL profesyonelin (rol `professional`) tam adi, iliskisi olmayan herkese "Ad S." olarak gosterilir (soyadin ilk
harfi + nokta; tek kelimelik ad oldugu gibi; birden fazla kelimede ilk kelime + SON kelimenin ilk harfi: "Ayse Nur Kaya" ->
"Ayse K."). Tam ad yalniz: kendisi, admin, ve bu profesyonelle ONAYLI/TAMAMLANMIS rezervasyonu olan karsi
taraf. Ajans/kurulus adlari (`company_name`) degismez.

1. Yardimci `app/lib/kamu-adi.ts`: `kamuAdi(fullName: string | null): string` (saf fonksiyon) ve sunucuda
   `tamAdGorebilirMi(...)` (mevcut rezervasyon sorgularini yeniden kullan; yeni DB nesnesi yok).
2. Uygulanacak yuzeyler (once envanter cikar, raporda tablo): Kesfet karti, ana sayfa one cikanlar, `/p/[id]` (baslik,
   `generateMetadata` title/OG dahil), sihirbaz aday listesi, ilan basvuru listeleri, teklif topla alici/aday listeleri,
   mesaj listesi ve konusma basligi (rezervasyon yoksa "Ad S."), bildirim metinleri (yeni yazilanlar; eski kayitlar degismez).
   Rezervasyon sayfalari, takvim, teklif belgesi gibi rezervasyon SONRASI yuzeyler tam ad kalir.
3. Arama tam adla calismaya devam eder (Kesfet `q`).
4. Not (rapora yaz, kod degil): bu UI duzeyinde bir gizlemedir; `v_providers_public.full_name` anon'a hala acik. API duzeyi
   gizleme 10c-2 sonrasi ayri karar.

### Kabul olcutleri

- `npx tsc --noEmit`, degisen dosyalarda `npx eslint`, `npm run build` temiz.
- Rapor: bolum bazinda degisen dosyalar; C ve E icin dosya:satir tablolari; D icin ornek sorgular (acilis, nikah, "a,b" gibi
  bozuk girdi). Smoke icin acik sunucu birakma.

### Onizleme turu (Claude yapacak)

Kesfet: "açılış" -> Lansman beyanli saglayicilar; "xyzqw" -> yakin sonuclar; "a,b" hata vermez; kartta tam kategori ve iki
satir ad; "Kurumsal hizmet sağlayıcılar" suzgeci. Anonim `/p/<pro>` "Kerem Ö."; rezervasyonu olan musteri hesabiyla tam ad.
Ajans hesabiyla ekip daveti -> form kapanir + basari mesaji.
