# 00 — Genel Bakis

## Urun modeli

Kashe uc urun katmanindan olusur ve uculu ortak bir veri altyapisini kullanir.

```
                    KASHE VERI KATMANI
    talep · oneri · teklif · secim · fiyat · musaitlik · sonuc
                            |
        +-------------------+-------------------+
        |                   |                   |
   MARKETPLACE          EVENT AI          EVENT OS / CREW AI
   (bugun canli)      (gelistirilecek)     (gelistirilecek)
```

**Marketplace.** Dogrulanmis profesyonel ve firma profilleri, portfoy, musaitlik, teklif, rezervasyon, sozlesme, odeme, degerlendirme.

**Event AI.** Kullanici etkinligini serbest Turkce anlatir. Sistem yapilandirir, eksigi sorar, uc cozum stratejisi uretir: tekil profesyoneller, tam hizmet firma, hibrit ekip.

**Event OS / Crew AI.** Ajans ve organizatorler kendi musterilerini, etkinliklerini, ekiplerini, tedarikcilerini, tekliflerini ve butcelerini yonetir. Ozel yetenek havuzu, ic maliyet gizliligi ve ekip optimizasyonu buradadir.

---

## Kullanici rolleri

Dort rol vardir ve **degismez**. Arayuzde yalnizca bu dort rol gorunur.

| Taraf | Rol | Tanim |
|---|---|---|
| Hizmet alan | `client` | Bireysel hizmet alan |
| Hizmet alan | `business` | Kurumsal hizmet alan |
| Hizmet veren | `professional` | Bagimsiz profesyonel |
| Hizmet veren | `agency` | Organizasyon firmasi, ajans, menajer, produksiyon sirketi |

**`organization` besinci bir rol degildir.** Cok kullanicili kurumsal hesabi temsil eden teknik kiraci yapisidir. `business` ve `agency` hesaplari bu yapiyi kullanir; `client` ve `professional` kullanmaz.

---

## Hangi rol neye erisir

```
business (kurumsal hizmet alan)
  -> Marketplace
  -> Event AI
  -> Buyer Workspace (Events, RFP, Tedarikci Arama, Teklif Karsilastirma,
                      Butce, Onaylar, Sozlesmeler, Raporlama)

agency (kurumsal hizmet veren)
  -> Marketplace (saglayici olarak)
  -> Event OS (CRM, Events, Crew, Talent Pool, Suppliers,
               Commercial, Operations, Finance, Insights)
  -> Crew AI
```

---

## Modul acma: rolle degil, yetenekle

`account_type` yalnizca **varsayilan modul setini** belirler. Gercek erisim `organization_modules` tablosundan okunur.

| account_type | Varsayilan acik moduller |
|---|---|
| `agency` | crm, events, crew, talent_pool, suppliers, commercial, proposals, tasks, run_of_show, finance, reporting |
| `business` | events, rfp, supplier_search, proposal_compare, budget, approvals, contracts, reporting |

**Neden boyle:** Bazi kurumsal alicilarin kendi etkinlik ekibi vardir ve Tasks, Run of Show gibi moduller isterler. Bunlar acilabilir. Ancak **`commercial`, `crew_commercial` ve `talent_pool` modulleri `business` hesaplarda asla acilmaz** — bunlar satici tarafina ozgudur.

---

## Karar zinciri

Event AI'in ucdan uca akisi:

```
Serbest metin talebi
  -> Event Understanding      (EventSpec cikarimi, eksik bilgi sorusu)
  -> Provider/Candidate Retrieval  (profesyonel + firma ortak aday uzayi)
  -> Match & Coverage Scoring (uygunluk, guven, kapsam)
  -> Crew Composition         (kisit altinda ekip kurma)
  -> Commercial Optimization  (ic maliyet, musteri fiyati, marj)
  -> Recommendation           (gerekceli oneri)
  -> Event Operations         (gorev, takvim, run of show)
  -> Outcome Learning         (sonucun modele geri beslenmesi)
```

Her adim ayri bir servis sinirimidir ve kendi surumunu tasir.

---

## Ar-Ge is paketleri

Proje Ocak 2027 - Aralik 2027, bes is paketi:

| IP | Ad | Ay |
|---|---|---|
| IP1 | Veri Taksonomisi ve Event Understanding | 1-4 |
| IP2 | Match, Trust ve Provider Retrieval | 3-6 |
| IP3 | Crew AI ve Commercial Optimization | 4-8 |
| IP4 | Event OS, Copilot ve Entegrasyon | 2-10 |
| IP5 | Pilot, Guvenlik ve Teknolojik Dogrulama | 8-12 |

Gelistirme sirasi: **Event Understanding -> Match V0 -> Crew AI -> Event OS V1 -> Copilot**

---

## Temel ilkeler

**Once calisan ve olculen surum.** Pahali model veya ozellik, basit yaklasim yetersiz kaldiginda devreye alinir. Ilk surumler kural tabanli ve olculebilir olur.

**Olcmeden tutma.** Bir yapay zeka ozelligi "etkileyici" oldugu icin degil, olculebilir bir gostergeyi iyilestirdigi icin uründe kalir. Iyilestiremezse kaldirilir.

**Veri dongusu asil varlik.** Brief, gosterim, teklif, secim, gerceklesen fiyat ve performans sonucu modelleri besler. Bu veri satin alinamaz.

**Adalet olculur.** Gorunurluk dagilimi ve yeni profesyonellerin gorunurluk payi izlenen basari olcutudur, iyi niyetli bir tercih degil.
