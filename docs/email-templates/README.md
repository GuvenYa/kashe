# E-posta Şablonları

Kashe'nin gönderdiği e-postalar **iki kanaldan** çıkar. Her kanalın **tek bir
kaynağı** vardır; ikinci bir kopya tutulmaz (drift eder).

## Kanal 1 — Supabase Auth · kaynak: bu dizindeki HTML

| Dosya | Supabase konumu |
|---|---|
| `supabase-auth/confirm-signup.html` | Authentication → Emails → **Confirm signup** |
| `supabase-auth/recovery.html` | Authentication → Emails → **Reset Password** |

Bu iki HTML **tek kaynaktır** — kod tarafında karşılıkları yoktur.
`{{ .ConfirmationURL }}` gibi Supabase değişkenleri içerirler. Değişiklik
**Supabase Dashboard'a elle yapıştırılarak** yayına alınır.

## Kanal 2 — Resend (uygulama içi) · kaynak: TypeScript

**Bu dizinde HTML kopyası YOKTUR.** Şablonlar koddan üretilir:

| Dosya | Ürettiği e-postalar |
|---|---|
| `app/lib/email/account-emails.ts` | hoş geldin · profil onaylandı · profil revizyon |
| `app/lib/email/templates.ts` | yeni mesaj · yeni konuşma · yeni teklif · teklif kabul · rezervasyon iptal (müşteri) · rezervasyon iptal (profesyonel) · rezervasyon tamamlandı |

Daha önce burada 3 HTML kopyası duruyordu (`hosgeldin` · `profil-onaylandi` ·
`profil-revizyon`). **Silindi:** kod onları okumuyordu, 10 mailin yalnız 3'ünü
kapsıyorlardı ve palet değişiminde ayrı ayrı güncellenmeleri gerekiyordu —
klasik drift kaynağı. Geçmiş git'te duruyor.

## Kanal 3 — Edge Function (ayrı, bu dizinde değil)

`supabase/functions/send-message-notification/index.ts` — mesaj bildirimi.
Şablon fonksiyonun içinde gömülü. Yayına alma:

```
supabase functions deploy send-message-notification --project-ref qydsooqmflrrwtgawhsv
```

## Palet kuralı — mailde `rgba()` YOK

E-postalarda **katı hex** kullanılır. Outlook masaüstü `rgba()` değerlerini
düşürür ve metin görünmez olabilir. Uygulama CSS'inde `rgba` serbesttir; bu
kural **yalnız mail HTML'i** içindir.

| Rol | Değer | Not |
|---|---|---|
| Zemin (paper) | `#F7F9FC` | |
| İkincil zemin (paper-2) | `#EDF2FA` | |
| Kart | `#FFFFFF` | |
| Gövde + başlık (ink) | `#040D26` | Hiyerarşi **punto ve ağırlıkla** kurulur, renkle değil |
| İkincil metin (ink-72) | `#4A5163` | `rgba(4,13,38,.72)`'nin beyaz üstü düzleştirilmiş hâli |
| Soluk metin (ink-50) | `#828693` | |
| Çizgi (line) | `#E1E2E5` | |
| Buton / aksan | `#FA0B96` | |
| Başarı (moss) | `#1F8A5F` | |

Güncel palet için tek kaynak: `DESIGN.md` → Renk Paleti.
