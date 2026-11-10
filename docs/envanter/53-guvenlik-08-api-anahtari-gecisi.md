# Guvenlik 08 - API anahtari gecisi (uretim)

Tarih: 10 Kasim 2026. Durum: PLAN + kod hazir (dal `guvenlik-08`).

## 1. Neden

- 10 Kasim'da uretim projesinin (qydsooqmflrrwtgawhsv) **eski tip service_role anahtari**
  Sahne betigi calistirilirken yanlislikla sohbete ve PowerShell gecmisine girdi. Betik yalniz dala
  baglandigi icin uretime istek gitmedi (dal anahtari reddetti); gecmis dosyasi temizlendi. Anahtar
  yine de acikta sayilir.
- Supabase'e gore eski service_role anahtari TEK BASINA iptal edilemez: eski anahtarlar birlikte
  kapatilir (anon dahil) ve eski JWT secret da iptal edilmelidir. Eski anahtarlar 2026 sonunda zaten
  kullanimdan kalkiyor.
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

E. **Site:** Vercel > Production ortam degiskeni `NEXT_PUBLIC_SUPABASE_ANON_KEY` = publishable
   anahtar (Preview dal'da kalir), ardindan Production yeniden dagitim; `.env.local` da. Deneme:
   giris / cikis, mesaj gonderme ve canli bildirim, dosya yukleme, Kesfet, profil.

F. **Eski anahtarlari kapat:** Settings > API Keys > eski anahtarlari devre disi birak. Ayni denemeler
   tekrar; bildirim gorevi K5 200. Geri alinabilir (yeniden etkinlestirme), ama bu sizan anahtari da
   geri acar - yalniz acil durumda.

G. **Eski JWT secret:** Project Settings > JWT Keys > imzalama anahtarlarina gecis, "Rotate Keys",
   en az bir oturum jetonu suresi (1 saat) bekle, eski secret'i "Revoke". Beklemeden iptal edilirse
   acik oturumlar dusebilir; az trafikli saatte.

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
