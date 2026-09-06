# 02 — Guvenlik Modeli

## Temel ilke: politikayla degil, insaatla guvenli

Ic maliyet ve marj gibi ticari sirlar, **musteri rolunun okuyabildigi hicbir tabloda bulunmaz.** Boylece hicbir sorgu onlari sizdiramaz. Bu, "erisimi engelleyen bir kural yazdik" degil, "erisilecek veri orada yok" yaklasimidir.

---

## 1. NEDEN RLS TEK BASINA YETMEZ

Satir duzeyi guvenlik **satirlari filtreler, sutunlari degil.**

Musteri bir teklif satirini gormek zorundadir; musteri fiyatini gorecektir. Ayni satirda `internal_cost` sutunu varsa RLS onu gizleyemez. `select *` yapan tek bir uc nokta veya yanlis yapilandirilmis tek bir gorunum, tum maliyet yapisini disari verir.

**Sutun duzeyi izin** (`GRANT SELECT (col)`) calisir ama kirilgandir: yeni sutun eklendiginde izin verilmezse sessizce erisilemez olur; `select *` hala tehlikelidir.

**Uygulama katmaninda filtreleme** en zayifidir. Unutulan tek bir uc nokta yeterlidir.

---

## 2. UC KATMANLI SAVUNMA

```
1. FIZIKSEL AYRIM
   internal semasi; PostgREST exposed_schemas listesinde YOK
   -> musteri veya profesyonel istese de sorgulayamaz

2. RLS + ROL
   internal semasindaki her tabloda organization_id bazli RLS
   + organization_memberships.role in ('owner','admin','finance')
   -> ayni kurulustaki satis personeli bile goremez

3. API PROJEKSIYONU
   Client ve Business portal uc noktalari internal semaya
   hicbir kod yolundan dokunmaz; ayri servis katmani
```

---

## 3. INTERNAL SEMA ERISIMI

`internal` semasina dogrudan erisim yoktur. Erisim yalniz **security definer** fonksiyonlarla olur ve her fonksiyon iki seyi kontrol eder: cagiran kullanici bu kurulusun uyesi mi, ve rolu yeterli mi.

```sql
create or replace function internal_api.get_proposal_with_costs(p_proposal_id uuid)
returns table (...)
language plpgsql
security definer
set search_path = internal, public
as $$
declare
  v_org_id uuid;
begin
  select seller_organization_id into v_org_id
  from public.proposals where id = p_proposal_id;

  if not public.has_org_permission(v_org_id, 'commercial.view') then
    raise exception 'yetkisiz erisim';
  end if;

  insert into internal.access_audit(organization_id, actor_user_id, action,
                                    target_table, target_id)
  values (v_org_id, auth.uid(), 'read', 'proposal_internal_items', p_proposal_id);

  return query select ...;
end;
$$;
```

**Her `internal` erisimi denetim kaydina dusar.**

---

## 4. YETKI MATRISI

| Rol | Marketplace profil | Events | Crew | Talent Pool | Commercial | Finance | Ayarlar |
|---|---|---|---|---|---|---|---|
| `owner` | tam | tam | tam | tam | tam | tam | tam |
| `admin` | tam | tam | tam | tam | tam | tam | kismi |
| `sales` | okur | tam | okur | okur | teklif olusturur, maliyet **gormez** | yok | yok |
| `project_manager` | okur | tam | tam | tam | okur, maliyet **gormez** | yok | yok |
| `crew_coordinator` | yok | okur | tam | tam | yok | yok | yok |
| `finance` | yok | okur | okur | okur | tam | tam | yok |
| `viewer` | okur | okur | okur | yok | yok | yok | yok |

**Kritik:** `sales` ve `project_manager` roller teklif hazirlayabilir ama **ic maliyeti goremez.** Musteri fiyatini girer, marj hesabini sistem yapar ve sonucu yalniz `finance`/`admin`/`owner` gorur.

Izin kontrolu tek fonksiyondan gecer:

```sql
has_org_permission(p_org_id uuid, p_permission text) returns boolean
```

Izin anahtarlari: `events.view`, `events.manage`, `crew.view`, `crew.manage`, `talent.manage`, `commercial.view`, `commercial.manage`, `finance.view`, `finance.manage`, `settings.manage`, `members.manage`

---

## 5. KIRACI IZOLASYONU

Her kurulus verisi mantiksal olarak izoledir. Kural:

**`organization_id` tasiyan her tabloda RLS zorunludur** ve politika `organization_memberships` uzerinden kontrol yapar.

```sql
create policy org_isolation on crm_leads
  for all
  using (
    exists (
      select 1 from organization_memberships om
      where om.organization_id = crm_leads.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
    )
  );
```

**Test edilebilirlik:** Kurulus A'nin jetonuyla kurulus B'nin her tablosuna erisim denenir; hepsi bos donmeli. Bu test surekli entegrasyonda calisir.

---

## 6. MUSTERI PORTALI

Musteri portali **ayri bir erisim yuzeyidir** ve ayni sorgu yolunu kullanmaz.

- Musteri Kashe kullanicisi olmayabilir (ajansin son musterisi)
- Erisim, kaynak basina uretilen **imzali ve suresi sinirli baglanti** ile saglanir
- Portal yalniz `is_visible_to_client = true` olan satirlari ve onaylanmis surumleri gorur
- Portal sorgusu `internal` semasina **hicbir yoldan** ulasamaz

```
portal_access_links
  token_hash    -- ham jeton saklanmaz, yalniz ozeti
  scope         -- ['view','approve','request_revision','comment','download']
  expires_at, max_views, view_count, revoked_at
```

Jeton dogrulama sunucu tarafinda yapilir; istemciye hicbir kurulus kimligi sizmaz.

---

## 7. YAPAY ZEKA YETKI SINIRLARI

### Uc kademeli yetki

| Kademe | Ornek |
|---|---|
| **Asla kendi basina yapamaz** | Odeme aktarimi, iade, hesap kapatma, rol degisikligi, kesin rezervasyon onayi, profesyonel dislama |
| **Sinirli yetkiyle yapabilir** | Musaitlik okuma, aday arama, taslak gorev/teklif/mesaj hazirlama, ozet uretme |
| **Kullanici onayiyla yapabilir** | Teklif gonderme, rezervasyon, takvime kaydetme, odeme baslatma |

### Uydurmayi engelleme

Uc katmanli:

1. **Yapilandirilmis cikti.** Model serbest metin degil, sema kisitli JSON uretir.
2. **Kimlik dogrulamasi.** Cikti yalniz veritabanindaki gecerli kategori, rol ve saglayici kimliklerini icerebilir. Model yeni bir kategori adi uretemez.
3. **Sunucu tarafi kurallar.** Fiyat, butce, marj, musaitlik ve durum gecisleri deterministik servislerde hesaplanir; model bunlara dokunmaz.

### Guvenilmeyen icerik

Kullanicinin yukledigi brief ve dosyalar **untrusted content** sayilir. Icindeki metin komut degil **veri** olarak islenir. Prompt injection ve tool abuse senaryolari duzenli test edilir; hedef yetkisiz islem sayisi sifirdir.

### Aciklanabilirlik

Oneriler serbest hayal degil, **gerekce kodlarindan** uretilir:

```
date_available · same_city · budget_fit · coverage_full
high_trust · new_talent · fast_response · style_match
```

Model bu kodlari ve hesaplanmis skorlari cumleye cevirir; yeni bir iddia uretemez.

### Itiraz hakki

KVKK'nin otomatik analiz sonucuna itiraz hakki geregi, gorunurlugu etkileyen otomatik kararlar icin **insan incelemesi ve itiraz kanali** sunulur.

---

## 8. KVKK VE VERI KORUMA

**Yurt disina aktarim.** Bulut ve iletisim hizmetleri yurt disinda yerlesik saglayicilardan alindigi icin bazi kisisel veriler yurt disinda islenmektedir. Hangi verinin hangi ulkeye ve hangi hukuki mekanizmayla aktarildigini gosteren **veri aktarim kutugu** tutulur.

**Model cagrisi oncesi temizleme.** Hassas musteri dokumanlari gereksiz yere dil modeline gonderilmez; alan bazli minimizasyon ve redaksiyon uygulanir.

**Harici kisi ekleme.** Kashe hesabi olmayan bir kisi kurulusun havuzuna eklenirken veri minimizasyonu, bilgilendirme ve ekleyen kurulusun hukuki dayanagi urun tasariminda yer alir.

**Takvim entegrasyonu.** Kullanici izniyle baglanan takvimden **yalniz mesgul/bos bilgisi** okunur; etkinlik icerigi hicbir kosulda alinmaz.

**Arastirma verisi ayri.** Anket ve mulakat verisi, urun operasyon verisinden amac ve erisim bakimindan ayristirilir.

---

## 9. GUVENLIK TEST SENARYOLARI

Bunlar surekli entegrasyonda calisir:

| Test | Beklenen |
|---|---|
| Musteri jetonuyla `internal` semadaki her tablo | Tumu reddedilir |
| Kurulus A jetonuyla kurulus B verileri | Tumu bos doner |
| `sales` rolu ile `internal.crew_member_commercials` | Reddedilir |
| Portal jetonu ile `is_visible_to_client=false` satirlar | Gorunmez |
| Suresi dolmus portal jetonu | Reddedilir |
| Prompt injection: dosya icinde "onceki talimatlari yoksay" | Islem yapilmaz |
| Tool abuse: modelden odeme baslatmasi istenir | Reddedilir |
| IDOR: baska kurulusun kaynak kimligi ile istek | Reddedilir |
