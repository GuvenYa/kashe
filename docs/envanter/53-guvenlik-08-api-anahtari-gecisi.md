# Guvenlik 08 - API anahtari gecisi (uretim)

Tarih: 10 Kasim 2026. Durum: TAMAM (A-G uretimde, 10-12 Kas). Kalan: bolum 5 (Sahne gecisi, fonksiyondaki eski anahtar yedegi).

## 1. Neden

- 10 Kasim'da uretim projesinin (qydsooqmflrrwtgawhsv) **eski tip service_role anahtari**
  Sahne betigi calistirilirken yanlislikla sohbete ve PowerShell gecmisine girdi. Betik yalniz dala
  baglandigi icin uretime istek gitmedi (dal anahtari reddetti); gecmis dosyasi temizlendi. Anahtar
  yine de acikta sayilir.
- Supabase'e gore eski service_role anahtari TEK BASINA iptal edilemez: eski anahtarlar birlikte
  kapatilir (anon dahil) ve eski JWT secret da iptal edilmelidir. Dashboard: "Legacy API keys will be
  retired in early 2027".
- `foto-yukle.mjs` artik dal disi JWT anahtari istek atmadan reddeder (proje ve rol anahtarin icinde).

## 2. Eski anahtari kullanan yerler (repo + uretim)

| Yer | Bugun | Yeni |
|---|---|---|
| Site (Vercel Production + `.env.local`) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` = eski anon JWT | publishable anahtar `web_sitesi` (`sb_publishable_...`); supabase-js 2.105 destekler |
| Edge Function `send-message-notification` | `SUPABASE_SERVICE_ROLE_KEY`, supabase-js 2.45 | secret anahtar `bildirim_fonksiyonu` (`SUPABASE_SECRET_KEYS` icinden; yoksa `default`), supabase-js 2.105.4; gecis suresince eski anahtar yedek |
| pg_cron `send-message-notifications` (*/5 dk, yalniz uretim) | `Authorization: Bearer <eski anon>`, fonksiyonda `verify_jwt = true` | `x-kashe-cron: <Vault bildirim_cron_anahtari>`, `verify_jwt = false`, fonksiyon basligi kendisi dogrular |
| Sahne betikleri (dal) | dal anahtari | etkilenmez (dal anahtari acilmadi); dal gecisi ayri (bolum 5) |

Dashboard'da ayrica bakilacak: Database Webhooks, Integrations, varsa dis servisler (eski anahtari
kullanan baska bir sey kalmamali; adim F'den once).

## 3. Tasarim kararlari

- **Zamanlanmis cagri icin ayri anahtar.** Supabase ornegi secret anahtari Vault'a koyup `apikey`
  basligiyla gonderiyor; ama pg_net cozulmus anahtari istek kuyruguna yazar ve secret anahtar tum
  veritabanina yetkilidir. Kashe'de cagriyi yalniz bu fonksiyonu tetikleyen rastgele bir anahtar
  (`BILDIRIM_CRON_ANAHTARI` / Vault `bildirim_cron_anahtari`) dogrular; sizarsa en fazla bildirim
  taramasi tetiklenir. Fonksiyon sir tanimli degilse kapali kalir (401).
- **Kesintisiz sira.** Yeni anahtarlar eskilerle birlikte calisir: once her yer yenisine gecer,
  eskiler en son kapanir. Tek kisa bosluk: fonksiyon dagitimi ile migration arasi (en fazla bir
  5 dakikalik tur kacar; e-postalar kuyrukta bekler, sonraki turda gider).

## 4. Adimlar (uretim)

A. **Yeni anahtarlar:** Dashboard (uretim) > Settings > API Keys > "Publishable and secret API keys".
   Bilesen basina ayri anahtar (biri sizarsa yalniz o degisir): publishable `web_sitesi` (site),
   secret `bildirim_fonksiyonu` (Edge Function). Eski anahtarlar silinmez. Anahtarlar sohbete yazilmaz.

B. **Cagri anahtari:** PowerShell'de rastgele deger uret, iki yere ayni degeri gir:
   1. Edge Functions > Secrets ("Edge Function Secrets"): `BILDIRIM_CRON_ANAHTARI`
   2. Vault (Dashboard'daki Vault ekrani): ad `bildirim_cron_anahtari`

C. **Dal:** `db push` (migration dalda is olmadigi icin bir sey yapmaz; gecmis esit kalsin).

D. **Uretim, arka arkaya:** fonksiyon dagitimi (`functions deploy`, `verify_jwt = false`
   config.toml'dan) ve `db push` (gorev yeni basliga gecer). Kontrol: `asama33` K1-K3 ESIT;
   5-10 dk sonra K4 `succeeded`, K5 `200 {"processed":..}`. 401 `yetkisiz` = iki yerdeki deger farkli.

   SONUC (10 Kas): asama33 uretimde K1-K3 ESIT; 12:45 / 12:50 / 12:55 kosulari `succeeded`, HTTP 200
   `{"processed":0,"sent":0,...}` (hata yok: fonksiyon veritabanini okuyabiliyor). Anahtarsiz istek
   401 `{"error":"yetkisiz"}` (yeni kod yayinda, eski `verify_jwt` cevabi degil).

E0. **Once Sahne (onizleme):** Sahne projesinde publishable `web_sitesi`; Vercel Preview
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Sahne publishable; `guvenlik-08` onizlemesini onbelleksiz yeniden
   dagit; Sahne hesaplariyla giris, Kesfet, profil, mesajlar (canli kanal), dosya / gorsel denenir.
   Boylece uygulamanin yeni anahtarla calistigi uretimden once gorulur (Sahne'nin gecisi de baslar).
   SONUC (10 Kas): `guvenlik-08` onizlemesinin paketinde yalniz `sb_publishable_` (eski anon yok);
   Kesfet 351 kart; Kaan ile giris, mesajlar; Ilker'in (eski anahtarli sahne derlemesi) mesaji Kaan'in
   acik sohbetine sayfa yenilenmeden geldi (canli kanal); Kaan'in gorsel eki tarayicidan Storage'a
   yuklendi ve Ilker'de gorundu; konsol hatasiz.

E. **Site:** Vercel > Production ortam degiskeni `NEXT_PUBLIC_SUPABASE_ANON_KEY` = publishable
   anahtar (Preview dal'da kalir), ardindan Production yeniden dagitim; `.env.local` da. Deneme:
   giris / cikis, mesaj gonderme ve canli bildirim, dosya yukleme, Kesfet, profil.

   SONUC (10 Kas): ilk derlemede Production degiskenine yanlislikla Sahne'nin publishable anahtari
   girildi; uretim "Invalid API key" aldi (Kesfet "Bir sorun olustu", profiller 404) - main birlestirmesinden
   duzeltilmis yeniden derlemeye kadar. Dogru anahtar (`sb_publishable_atf...`) ve onbelleksiz yeniden
   derlemeyle duzeldi: paket yalniz uretim publishable anahtarini tasiyor, uretime 200, Kesfet 102 kart,
   profil ve ana sayfa acik; `.env.local` da uretim anahtarinda. Ders: publishable anahtar herkese acik
   oldugu icin kaydetmeden once onekiyle hangi projeye ait oldugu kontrol edilir (Sahne `sb_publishable_-9e...`).

   F oncesi tarama (10 Kas, uretim SQL Editor, salt okuma): veritabani webhook'u yok; 5 cron isinde eski
   anahtar izi yok; fonksiyon govdelerinde gomulu JWT yok; Edge Function yalniz send-message-notification.
   Vault'ta ESKI bir `service_role_key` sirri var (eski anahtarin kopyasi olabilir): kullanan bir sey yoksa
   F'den sonra Vault'tan silinir. Dashboard dugmesi: "Disable JWT-based API keys".

F. **Eski anahtarlari kapat:** Settings > API Keys > eski anahtarlari devre disi birak. Ayni denemeler
   tekrar; bildirim gorevi K5 200. Geri alinabilir (yeniden etkinlestirme), ama bu sizan anahtari da
   geri acar - yalniz acil durumda.

   SONUC (10 Kas): `service_role_key` Vault sirrini kullanan fonksiyon / cron / tetikleyici yok (olusturma
   2026-05-16); "Disable JWT-based API keys" yapildi. Sonra: Kesfet 102 kart, uretime publishable 200;
   asama33 K1-K3 ESIT, 17:25-17:35 kosulari 200 (fonksiyon yeni secret anahtarla calisiyor).
   Vault'taki eski `service_role_key` kopyasi silinir.

G. **Eski JWT secret:** Project Settings > JWT Keys > "JWT Signing Keys": (gerekirse "Migrate JWT
   secret") > "Rotate Keys" (yeni anahtar imzalar, eski secret "Previously used keys"e gecer ve eski
   oturumlari dogrulamaya devam eder) > EN AZ bir erisim jetonu suresi (1 saat) bekle > eski secret'i
   "Revoke". Bekleme F'den degil Rotate'ten sonra sayilir; beklemeden iptal edilirse acik oturumlar duser.
   DURUM (10 Kas): proje 6 ay once imzalama anahtarlarina gecmis ve donmus: "Current" ECC (P-256),
   "Previously used keys" altinda eski HS256 paylasimli secret. Kullanici jetonlari 6 aydir ECC ile
   imzalandigi icin bekleme gerekmez. Eski secret hala dogrulamada oldugu icin sizan service_role JWT'si
   `Authorization` basliginda (herkese acik publishable anahtarla birlikte) gecerli kalabilir: "Revoke"
   bu yuzden zorunlu. Repoda kendi JWT imzalayan kod yok (JWT_SECRET / jose / jsonwebtoken taramasi bos).
   Vault'taki eski `service_role_key` silindi (kalan yalniz `bildirim_cron_anahtari`).
   SONUC (12 Kas): eski HS256 secret "Revoke" edildi; sizan service_role JWT'si ve eski anon anahtar
   kalici olarak gecersiz. Sonra: asama33 K1-K3 ESIT, 11:50-12:00 kosulari 200; Kesfet 102 kart,
   publishable 200, profil acik. asama33'e K6 / K7 (e-posta bekleyen mesaj / bildirim sayisi) eklendi:
   sifirdan buyukken K5 hep processed 0 diyorsa fonksiyon satirlari goremiyor demektir.

## 5. Sonra

- Dal (Sahne) de 2026 sonundan once ayni gecisi yapar: Vercel Preview anahtari, Sahne betikleri
  (`SAHNE_SERVICE_ROLE_KEY` yerine dal secret anahtari; koruma `sb_secret_` bicimini kabul eder).
- Eski anahtarlar kapandiktan sonra fonksiyondaki `SUPABASE_SERVICE_ROLE_KEY` yedegi kaldirilir.

## 6. Dosyalar

- `supabase/functions/send-message-notification/index.ts` (secret anahtar, `x-kashe-cron`)
- `supabase/config.toml` (`verify_jwt = false`)
- `supabase/migrations/20261110120000_guvenlik_08_bildirim_cron_anahtari.sql` (harness: pg_cron yok /
  is yok / Vault yok / anahtar yok / tam / tekrar - 6 durum beklenen gibi; komut calistirilinca
  baslik `x-kashe-cron`, Bearer yok)
- `docs/envanter/asama33-guvenlik08-kontrol.sql` (yalniz uretim, salt okuma)
