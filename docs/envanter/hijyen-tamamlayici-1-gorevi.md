# Claude Code gorevi — Tamamlayici 1: RFP/teklif e-posta bildirimleri + alici kurulusun rezervasyonu gormesi

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/19-faz7-ticari-katman.md` bolum 12 sonundaki acik kalemler (a) ve (b).
ON KOSUL: migration `20261019120000_hijyen_01_bildirim_eposta.sql` dal + uretimde (Guven; `notifications.email_notified_at`).

Tasarim notu (neden boyle): uygulama kodu baska kullanicilarin e-postasini OKUMAZ (PII kurali; `get_notification_email` yalniz ayni sohbeti
paylasanlara acik). Uretimde zaten her 5 dakikada `send-message-notification` Edge Function'i (service_role; `auth.admin.getUserById`
ile e-posta) mesajlari e-postaliyor. Ayni fonksiyon `notifications` tablosundaki `rfp` / `proposal` bildirimlerini de isler; yeni cron YOK,
yeni anahtar YOK. Deploy Guven'de (`supabase functions deploy`).

---

Kashe reposundasin. Once `git status` (temiz olmali). Oku: `supabase/functions/send-message-notification/index.ts` (tamami, 258 satir:
`sendEmail`, `buildEmailHtml`, mesaj dongusu, `email_notified_at` isaretleme), `supabase/migrations/20261019120000_hijyen_01_bildirim_eposta.sql`,
`supabase/migrations/20261009120000_faz7b_01_rfp.sql` (`fn_faz7b_notify_org` govde/link bicimleri; `notifications.type` rfp/proposal),
`app/rezervasyonlarim/page.tsx` (+ `kurulus-karti.tsx`; "Kuruluş rezervasyonları" satici dali ~201-330), `app/rezervasyon/[id]/page.tsx`
(taraf tespiti ~206-230: customer / professional / isSellerOrg) ve `actions.ts` (iptal/tamamlama), `app/kurumsal/rfp/[id]/page.tsx`
(rezervasyon tarihi okunan yer ~183), `app/etkinliklerim/[id]/page.tsx` ("Bağlı kayıtlar"), `app/lib/org-context.ts` (`canViewEvents`,
`canManageEvents`), `app/lib/tarih.ts`, `CLAUDE.md`.

## A) E-posta — `supabase/functions/send-message-notification/index.ts`

1. Mesaj dongusunden SONRA ikinci bir blok: `notifications` WHERE `type IN ('rfp','proposal')` AND `email_notified_at IS NULL`
   AND `created_at < now() - 2 dk` ORDER BY `created_at` LIMIT 50. (2 dk: ayni islemden dogan birden cok bildirim tek taramada gelsin.)
2. Alici e-postasi: mevcut `emailMap` deseni (`auth.admin.getUserById`). Alici adi: `profiles.full_name` / `company_name` (mevcut `getName`).
   Cevrimici kontrolu YOK (mesajdan farkli: seyrek ve onemli); `read_at` dolu olsa da gonder (kullanici uygulamada okumus olabilir ama
   e-posta kaydi kalsin — tek istisna: `read_at` doluysa ve 24 saatten eskiyse gonderme, yalniz isaretle).
3. Konu ve govde `type` + `body`'den: `rfp` → konu `Teklif talebi · <body'nin ilk 80 karakteri>`; `proposal` → konu `Teklif · <ilk 80>`.
   HTML: mevcut `buildEmailHtml` ile ayni kabuk (logo/renkler), tek paragraf `body`, dugme `Kashe'de aç` → `${APP_URL}${link}`
   (`link` zaten `/ajans/rfp/<id>`, `/kurumsal/rfp/<id>`, `/ajans/teklifler/<id>` bicimli; `APP_URL` mevcut). Alt satir:
   `Bu e-posta Kashe bildirimi. Ayarlar: ${APP_URL}/bildirimler`. Yeni sablon fonksiyonu `buildNotificationHtml` (ayni dosyada).
4. Gonderim sonrasi `email_notified_at = now()`; hata olursa isaretleme (bir sonraki taramada tekrar denenir; `errors[]`'a yaz).
   Yanit JSON'una `notificationsProcessed`, `notificationsSent` eklenir.
5. Deno tip uyumu: `notifications` satir tipi (`id, user_id, type, link, body, read_at, created_at`). `deno.json` degismez.
6. Yerel kosum yok; `deno check supabase/functions/send-message-notification/index.ts` makinede deno varsa calistir, yoksa raporda belirt.

## B) Alici kurulus rezervasyonu gorur

1. **`app/rezervasyon/[id]/page.tsx`**: taraf tespitine `isBuyerOrg` eklenir — `teklifSekli && booking.buyer_organization_id` ve
   `getCrewContext().orgs` icinde o kurulus `canViewEvents`; `buyerOrgManage = canManageEvents`. `notFound` kosulu `!isBuyerOrg` ile
   genisler. Gorunum: alici kurulus uyesi icin karsi taraf = satici kurulus adi (`teklif.seller.display_name`), baslik satirinda
   "Kuruluşunuz adına · <alici kurulus adi>" notu, teklif/surum ozeti ve toplam (KDV dahil) ayni; satici-only bloklar (ic maliyet, "Teklifi
   gör" satici baglantisi ~495) GIZLI. Geri baglantisi `/rezervasyonlarim`.
2. **`actions.ts`**: iptal — teklif seklinde alici kurulus `events.manage` uyesi de iptal edebilir (RLS `can_access_booking_row` manage
   dali zaten izin veriyor; action'daki taraf kontrolune ekle; `cancelled_by = auth.uid()`). Tamamlama satici-only kalir.
3. **`app/rezervasyonlarim/page.tsx`**: "Kuruluş rezervasyonları" bolumune ikinci liste: `getCrewContext().orgs.filter(canViewEvents)`
   kuruluslari icin `bookings` WHERE `buyer_organization_id IN (...)` (ayni select; RLS). Baslik `Kuruluşunuz adına alınan` ; kart
   `KurulusKarti`'ye `taraf: 'satici' | 'alici'` prop'u — alici tarafinda karsi ad satici kurulus. Ayni kurulus hem satici hem alici olabilir
   (ajans); iki listede de gorunebilir, tekrar sorun degil (etiket farkli).
4. **`app/kurumsal/rfp/[id]/page.tsx`**: `Rezervasyon oluşturuldu · <tarih>` metni `/rezervasyon/<booking.id>` baglantisi olur
   (`bookings.id` zaten okunuyor; degilse select'e ekle).
5. **`app/etkinliklerim/[id]/page.tsx`** "Bağlı kayıtlar": `bookings` WHERE `event_id = etkinlik.id` (RLS) → `Rezervasyon · <satici> · <toplam> ·
   <durum>` satiri, `/rezervasyon/<id>` baglantili. Kayit yoksa mevcut "Henüz bağlı …" metni aynen.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu + `.next/BUILD_ID`.
- `grep -n "email_notified_at" supabase/functions/send-message-notification/index.ts` → mesaj + bildirim dallari (≥ 3).
- `grep -rn "auth.admin\|service_role\|SERVICE_ROLE" app` → 0 (e-posta cozumu yalniz Edge'de).
- `grep -n "isBuyerOrg\|buyerOrgManage" app/rezervasyon/\[id\]/page.tsx app/rezervasyon/\[id\]/actions.ts` → her ikisinde var.
- `grep -n "internal\.\|marj\|maliyet" app/rezervasyon/\[id\]/page.tsx` → alici dalinda render edilmiyor (kosul `isSellerOrg`).
- Sapkali harf 0; yorumlar ASCII.
- **Canli (Guven):** (1) `supabase functions deploy send-message-notification --project-ref qydsooqmflrrwtgawhsv`; (2) Test Pro ile
  mevcut talepte islem yok (awarded) → yeni bir RFP ac, Sunucu Ajans'i davet et, Gönder → 5-10 dk icinde fbguvenfb'ye "Teklif talebi ·
  …" e-postasi; (3) fbguvenfb yanitlar → Test Pro'ya "Teklif · …" e-postasi; (4) Test Pro `/rezervasyonlarim` → "Kuruluşunuz adına alınan"
  altinda 23.400 TL rezervasyon → `/rezervasyon/<id>` acilir, satici "Sunucu Ajans", ic maliyet yok; (5) `/etkinliklerim/<id>` Bagli
  kayitlar'da rezervasyon; (6) SQL: `select type, count(*) filter (where email_notified_at is not null) as epostali, count(*) from notifications
  where type in ('rfp','proposal') group by type` → epostali > 0.

## Yapilmayacaklar

Yeni cron / yeni secret / yeni Edge Function YOK. Uygulamaya service_role YOK. Mesaj e-posta davranisi DEGISMEZ. Tamamlama satici-only.
Portal dosyalarina DOKUNMA. Commit ATMA.

Rapor: degisen dosyalar, tsc/build (BUILD_ID), grep sonuclari, deno check sonucu (ya da yok), sapma ve nedeni. Commit ATMA.
