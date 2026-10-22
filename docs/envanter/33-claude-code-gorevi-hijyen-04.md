# Claude Code gorevi — Hijyen 04: FAZ 8 ve tasarim dili v2'den biriken kucuk kalemler (10 madde)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/20-faz8-event-os-modulleri.md` bolum 3 (8a kucuk bulgular), 4 (8b-P2),
5 (8c-P2), 7; `docs/envanter/22-tasarim-dili-v2.md` bolum 6-7 "Sonraya" ve "Acik kalanlar". DB tarafi (silinen kaydin bildirimi) AYRI
migration ile kapandi (`20261024120000_hijyen_04_bildirim_temizligi.sql`; uygulama degisikligi gerektirmez). Dal: `hijyen/04` (Guven acar).
**Migration/RPC YOK.** Her madde kucuk; buyuyen madde varsa yapma, raporda "sapma" olarak yaz.

---

Kashe reposundasin. Once `git status` (temiz; dal `hijyen/04`). Oku: `CLAUDE.md` (FAZ 8 paragraflari), `DESIGN.md` 9, ilgili dosyalar
madde basinda. Kirmizi cizgi: migration/RPC yok; kural kopyalama yok; fiyat `para.ts`, tarih `tarih.ts`; sapkali harf yok, yorumlar ASCII,
UI Turkce. Commit ATMA.

## A) Gorevler (8a kalanlari)

1. **Hizli ekle iyimser** (`app/components/gorevler/gorev-listesi.tsx` + hizli ekle bileseni): Enter'a basinca satir HEMEN listede
   ("kaydediliyor" rozeti, soluk), sunucu sonucu gelince gercek id/zaman yerine oturur; hata olursa satir kalkar + mesaj. Bugun
   "Kaydediliyor…" 6-8 sn bos bekleme. `useOptimistic` ya da yerel state; `revalidatePath` daraltma zaten yapildi.
2. **Hesap karti — cok kurulus uyesi** (`app/lib/panel-kabuk.ts` `hesapKarti`): secili kurulus varken kart "Sunucu Ajans · Ajans hesabi"
   gosteriyor, kisi adi yok. Kart: ad = kisi adi (profil), alt satir = "<kurulus adi> · Ajans|Kurumsal", rozet kalir. Tek kurulus ve
   kurulussuz dallar AYNEN (su an dogru).

## B) CRM (8b-P2)

3. **Secim etiketleri** — yeni ortak yardimci `app/lib/secim-etiketi.ts` (sunucu/istemci ortak, `'use client'` yok): `etkinlikEtiketi({
   title, start_date })` → "Baslik · 20 Kas 2026" (`tarih.ts` kisa tarih), `teklifEtiketi({ title, status, created_at })` → "Baslik · Taslak ·
   3 Eki" (durum etiketi mevcut teklif durum sozlugunden). Kullanim: `firsat-formu.tsx` ve `firsat-panosu.tsx` paneli (etkinlik + teklif
   select'leri; `SecimSecenegi.ad` sunucuda bu yardimciyla doldurulur — `app/ajans/musteriler/page.tsx`), kisa liste "Yeni liste" etkinlik
   secimi (`kisa-liste-yonetimi.tsx` / `app/kurumsal/kisa-liste/page.tsx`), gorev formu etkinlik secimi varsa o da. Ayni baslikli iki
   teklif artik ayirt edilir.
4. **Panel sonundaki asama rozeti** (`firsat-panosu.tsx` `FirsatPaneli` — dialog'un en altinda tek basina duran "YENI"/"ILETISIMDE" rozeti):
   kaldir; rozet panel basligina (eyebrow "FIRSAT" satirinin sagina) tasinir.

## C) Tedarikci / kisa liste (8c-P2)

5. **`/p/[id]` "Kisa listeye ekle"** (`app/p/[id]/page.tsx` + yeni `app/p/[id]/kisa-listeye-ekle.tsx`; `havuza-ekle.tsx` kalibi): kullanicinin
   `shortlistEnabled && canManageEvents` kurulusu varsa kimlik satirinin altinda (havuz bandiyla ayni yerde, ayri bant) "Kisa listeye ekle"
   — birden cok kurulus varsa select; eklenince "Kisa listede" rozeti (`kisaListeDurumu` tek sorgu). Kullanicinin kendi profili / kendi
   kurulusunun saglayicisi icin bant YOK. Action `kisaListeyeHizliEkle` (var).

## D) Tasarim dili v2 acik kalanlar

6. **Ajans profili kimlik satiri** (`app/p/[id]/page.tsx` ajans dali; D2-ek sapmasi): profesyonel daldaki kimlik satiri bileseniyle AYNI
   (72 px `rounded-2xl` avatar, `text-3xl` ad, alt satir sehir · kategori/ajans turu, guven cipleri altinda). Eski blok kalkar.
7. **Ajans dalinda tamamlanmis is sayisi** (`guven-cipleri.tsx` girdisi, `page.tsx` ajans dali): profesyonel dalinda `dealRows` =
   `bookings` `professional_id = profil` + `status = 'completed'`. Ajans icin ayni sayim: `bookings.seller_provider_id = profile.id`
   (FAZ 7c sutunu; `providers.id = profiles.id`) OR `professional_id = profile.id`, `status = 'completed'` — tek sorgu `.or(...)`. Cip
   "N tamamlanmis is" ajansta da cikar (0 ise cip yok — mevcut kural); tekrar-tercih (`dealCounts`) ajans dalinda da ayni veriden.
8. **"Sure" sayaci** (`aday-paneli.tsx` ozet seridi, D3 "Eslesme hazir" kutulari): `match_runs.latency_ms` zaten var (`aday-data.ts`'ye
   alan eklenir) → "SURE 0,8 sn" kutusu (ms < 1000 ise "0,8 sn", degilse "1,4 sn"; `tr-TR` bicimi). "Taranan profil" FAZ 9'a (algoritma
   surumuyle) — YAPMA.
9. **Ekip kapsami onerilenleri de gostersin** (`app/etkinliklerim/[id]/page.tsx` `kapsam` hesabi + `ekip-paneli.tsx` kapsam satiri):
   `KapsamSatiri`'na `onerilen` (status `proposed`) eklenir; satir "DJ 0/1 · 1 onerildi" (onerilen > 0 ise). Zorunlu rol eksigi karari
   DEGISMEZ (onayli sayilir; DB kurali).
10. **`/bildirimler` anonim dal** (`app/bildirimler/page.tsx`): girissiz kullanici `redirect('/giris?redirect=/bildirimler')` (diger panel
    sayfalariyla ayni); vitrin icindeki `PanelBaslik` dali kalkar.

## Yapilmayacaklar

Migration/RPC YOK; `run_event_match` degismez ("Taranan profil" FAZ 9); Kesfet sorgusu degismez; teklif kalemine tedarikci maliyeti YOK;
bildirim temizligi uygulamada TEKRAR EDILMEZ (DB tetikleyicisi yapiyor). Commit ATMA.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu + `.next/BUILD_ID`.
- `grep -rn "₺" app` → 0; sapkali harf 0; yorumlar ASCII; `grep -rn "secim-etiketi" app -l` → en az 3 dosya.
- **Canli tur (Claude, onizlemede):** gmail — `/kurulus/gorevler` hizli ekle aninda satir; hesap karti "Guven Yapicioglu · Sunucu Ajans ·
  Ajans"; `/ajans/musteriler?yeni=firsat` teklif secimi "Ankara'da 250… · Onaylandi · 14 May" iki satir ayri; panel altinda rozet yok;
  lansman Adaylar sekmesinde "SURE" kutusu; Ekip sekmesinde "DJ 0/1 · 1 onerildi"; `/p/<Sunucu Ajans>` kimlik satiri yeni duzen +
  "N tamamlanmis is" cipi. testguven — `/p/<Test Pro>` "Kisa listeye ekle" banti → "Kisa listede"; anonim `/bildirimler` → giris. Konsol 0.

Rapor: degisen/yeni dosyalar, satir sayilari, tsc/build (BUILD_ID), grep sonuclari, sapma ve nedeni. Commit ATMA.
