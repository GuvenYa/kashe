# 05 — Arayuz Modeli

## Temel karar: tek hesap, tek kurulus, iki uygulama yuzeyi

Bir ajansin iki farkli yuzu vardir ve bunlar **ayni menu icinde karistirilmaz.**

```
XYZ Events
  |
  +-- Marketplace                  (disariya gorunen satis kimligi)
  |     Profil · Hizmetler · Portfoy · Yorumlar
  |     Gelen Talepler · Marketplace Ayarlari
  |
  +-- Event OS                     (sirketin ic operasyon alani)
        CRM · Events · Crew · Talent Pool · Suppliers
        Commercial · Operations · Finance
```

**Neden ayri:** Marketplace disariya donuk satis kimligidir, Event OS ic operasyondur. Ikisini tek kenar cubugunda toplamak; CRM, Crew ve Finance gibi ic modullerle Portfolio, Reviews ve Marketplace Ayarlari gibi dis profil modullerini ayni zihinsel modelde karistirir.

---

## Baglam anahtari

Sol ust kosede kurulus adiyla birlikte bir baglam anahtari bulunur:

```
XYZ Events  v
  o Event OS
  o Marketplace Profile
```

**Baglam degistiginde kenar cubugu tamamen degisir.** Ust bar kurulus adini ve aktif baglami gosterir:

```
XYZ Events / Event OS
XYZ Events / Marketplace
```

### Iki yuzey arasinda hizli baglantilar

Baglamlar ayri olsa da gecis kolay olmalidir:

- "Marketplace profilimi goruntule"
- "Marketplace'ten profesyonel bul"
- "Eksik ekibi Kashe'den tamamla"

Bu baglantilar baglam degistirir ama kullanicinin nerede oldugunu kaybettirmez.

---

## Veri modelindeki karsiligi

```
organization                       -- XYZ Events sirket hesabi
  |
  +-- Event OS calisma alani       -- organization_id ile filtrelenen her sey
  |
  +-- provider                     -- Marketplace'teki hizmet veren kimligi
        |
        +-- Marketplace profili    -- providers + organization_profiles
```

`organizations` ve `providers` **ayri varliklardir.** Bir kurulus pazaryerinde gorunmek zorunda degildir; goruniyorsa bir `providers` satiri vardir.

---

## Rol bazli yuzeyler

| Rol | Gordugu yuzeyler |
|---|---|
| `client` | Marketplace (alici) · Event AI · Kendi talepleri |
| `professional` | Marketplace (satici profili) · Gelen talepler · Takvim · Teklifler |
| `business` | Marketplace (alici) · Event AI · **Buyer Workspace** |
| `agency` | Marketplace (satici profili) · **Event OS** · Crew AI |

`client` ve `professional` icin baglam anahtari **yoktur** — tek yuzeyleri vardir.

---

## Buyer Workspace (business)

```
ABC Holding / Buyer Workspace
  Events
  RFP
  Tedarikci Arama
  Teklif Karsilastirma
  Butce
  Onaylar
  Sozlesmeler
  Raporlama
```

Event OS ile ortak altyapiyi kullanir (events, contacts, files, approvals, tasks) ama **asla su modulleri gormez:** Talent Pool, Internal Cost, Margin, Markup, Crew Commercial.

Kendi etkinlik ekibi olan kurumsal alici, `tasks` ve `run_of_show` modullerini acabilir. Bu `organization_modules` uzerinden yonetilir, rolle sabitlenmez.

---

## Musteri portali

Ajansin musterisi Kashe kullanicisi olmayabilir. Varsayilan davranis **imzali misafir portalidir.**

```
[Teklif baglantisi]  ->  Musteri portali
                           Teklif goruntuleme
                           Onay / Revizyon talebi
                           Belgeler
                           Zaman planı
                           Mesajlar
```

Kapsam sinirlidir ve `portal_access_links.scope` alaninda tanimlidir. Musteri isterse sonradan `client` veya `business` hesabina donusebilir; gecmis teklif ve onaylari korunur.

---

## Ic maliyet gorunurlugu

Arayuz tarafinda kritik kural: **ic maliyet ve marj alanlari, yetkisi olmayan role hic render edilmez.**

Gizlemek yetmez — veri istemciye hic gonderilmez. `sales` rolundeki bir kullanicinin tarayicisinda `internal_cost` degeri bulunmaz.

Teklif ekraninda:

```
sales rolu gorur:        Aciklama · Adet · Musteri fiyati · Toplam
finance rolu gorur:      + Ic maliyet · Markup · Marj orani
musteri portali gorur:   Aciklama · Adet · Musteri fiyati · Toplam
                         (yalniz is_visible_to_client = true satirlar)
```

---

## Yapay zeka arayuz ilkeleri

**Varsayimlar isaretlenir.** EventSpec'te `provenance.source = 'derived'` olan alanlar arayuzde farkli gosterilir ve kullanici duzeltebilir.

**Gerekce gosterilir.** Her oneri, hangi nedenle geldigini kisa etiketlerle belirtir: "15 Eylul'de musait", "ayni sehir", "butceye uygun", "tum roller kapsaniyor".

**Kritik islemde onay kapisi.** Odeme, rezervasyon, teklif gonderimi ve iade icin acik onay ekrani gosterilir; tek tikla gecilmez.

**Sponsorlu ayri etiketlenir.** Organik siralama ile ucretli gorunurluk arayuzde acikca ayrilir.
