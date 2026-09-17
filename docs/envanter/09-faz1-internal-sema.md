# 09 — FAZ 1: internal sema iskeleti

**Baslangic:** 15 Eylul 2026 (FAZ 0 01-03 uretime cikar cikmaz)
**Durum:** URETIMDE (17 Eylul 2026 kapanisi; commit `92e5be6`). Kapanis kaydi bolum 7.
**Kaynak belgeler:** `docs/architecture/02-guvenlik-modeli.md` bolum 1-3 ve 9, `01-veri-modeli.md` bolum 8,
`04-goc-plani.md` "FAZ 1", `CLAUDE.md` degismez kural 1.

---

## 1. Amac ve sinir

Ic maliyet, marj ve ozel notlar **musteri rolunun okuyabildigi hicbir tabloda bulunmayacak**; bunun icin
PostgREST'e acilmayan ayri bir `internal` semasi kurulur ("politikayla degil, insaatla guvenli").
FAZ 1 yalniz **iskeleti** kurar: sema, erisim kilidi, denetim tablosu ve erisim kalibi. Ic maliyet tasiyan
tablolar (`internal.organization_talent_rates`, `crew_member_commercials`, `proposal_internal_items`,
`margin_rules`) kendi fazlarinda (5, 6, 7) **bu kalipla** eklenir. Veri yok, uygulama degisikligi yok.

## 2. Kararlar (15 Eylul, Guven onayi)

| Konu | Karar | Gerekce |
|---|---|---|
| RPC'lerin semasi | `public` icinde `internal_` onekiyle (`public.internal_audit_recent`) | 02 ornekte `internal_api.` yaziyordu; o sema PostgREST'e Dashboard'dan acilmak zorundaydi (migration disi ayar, dal ve uretimde ayri). Guvenlik siniri sema adi degil: SECURITY DEFINER + `has_org_permission` + denetim |
| `service_role` | internal'a dogrudan erisemez | Uygulamada service-role istemcisi yok (14 Eylul taramasi). Gerekirse ileride tek satir `GRANT USAGE` |

Uygulama sirasinda alinan kararlar (belgelere islendi):

- **Reddedilen denemeler denetime yazilmaz.** `RAISE` ayni islemi geri alir; PostgREST hata donunce
  islem rollback olur, 'denied' satiri kalici olamaz. Reddetme 42501 hatasinin kendisiyle gorunur.
- **`access_audit` FK tasimaz** (`organization_id`, `actor_user_id` duz uuid): kurulus veya profil silinse de
  denetim kaydi kalir. Append-only: UPDATE/DELETE hic bir role verilmez.
- **Okuma da denetime duser**, denetim kaydini okuyan RPC dahil ("her internal erisimi denetim kaydina duser").
- **Denetimi kim gorur:** `settings.manage` (owner, admin).
- `internal` icin `ALTER DEFAULT PRIVILEGES ... REVOKE` yazildi, ama asil kilit sema **USAGE**'inin
  olmamasidir: USAGE olmayan rol, tablo GRANT'i olsa bile semadaki hicbir nesneye ulasamaz. Yine de her
  nesnede acik `REVOKE ALL` kural olarak yazilir (asama6 K4/K5 bunu sayar).

## 3. Dosyalar

| Dosya | Icerik |
|---|---|
| `supabase/migrations/20260915170000_faz1_01_internal_sema.sql` | `internal` semasi + USAGE kilidi + varsayilan yetki REVOKE'lari; `internal.access_audit` (RLS acik, append-only, FK'siz, 2 indeks); `internal.request_ip()`, `internal.log_access(...)`, `internal.assert_org_permission(...)`; `public.internal_audit_recent(p_org_id, p_limit)` (yalniz authenticated EXECUTE) |
| `docs/envanter/asama6-faz1-internal-kontrol.sql` | SALT OKUNUR, dal + uretim: 8 kontrol (K1-K8) — sema var, PostgREST'e acik degil (authenticator `pgrst.db_schemas`), USAGE yok, tablo/fonksiyon GRANT yok, RLS + append-only, RPC yetkisi yalniz authenticated, envanter |
| `docs/envanter/asama4-davranis-testi.sql` | T10 eklendi (dal): anon / sahip (dogrudan) / service_role 42501, `log_access` dogrudan 42501, sahip RPC okur + denetim satiri dogru, viewer / iliskisiz / anon RPC 42501, reddedilenler denetime yazilmadi, PostgREST'e acik degil; T0 denetim satirlarini da siler |

Yerel zincir (46 dosya + PII 2a/2b + faz0 01-04): faz1_01 iki kez kosuldu (idempotan), T0-T10 11/11 GECTI,
asama6 8/8 OK. T10 mutasyon testi: authenticated'a `USAGE` + tablo `SELECT` verildi -> HATA ("USAGE var");
RPC'den yetki kontrolu kaldirildi -> HATA ("viewer uye okudu"); dosya yeniden kosulunca GECTI.

## 4. Erisim kalibi — yeni internal_* fonksiyonu boyle yazilir

```sql
CREATE OR REPLACE FUNCTION public.internal_<isim>(p_org_id uuid, ...)
RETURNS ... LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, internal AS $$
BEGIN
  PERFORM internal.assert_org_permission(p_org_id, '<izin.anahtari>', '<internal_tablo>', <hedef_id>);
  PERFORM internal.log_access(p_org_id, 'read' | 'write', '<internal_tablo>', <hedef_id>, '<detail jsonb>');
  -- sorgu / yazma
END $$;
REVOKE ALL ON FUNCTION public.internal_<isim>(...) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.internal_<isim>(...) TO authenticated;
```

Kurallar: izin anahtari `org_role_permissions` listesinden secilir (`commercial.view` = ic maliyeti gorme;
`sales` ve `project_manager` bunu ALMAZ); kurulus kimligi hedef satirdan turetilir, cagirandan alinmaz
(Kural 9: iliskiyi dogrula); `internal`'a yeni tablo = ayni migration'da `ENABLE ROW LEVEL SECURITY` +
`REVOKE ALL ... FROM PUBLIC, anon, authenticated, service_role` + sequence REVOKE; asama6 K4/K5 sifir kalmali;
T-testlerine "kurulus A jetonuyla kurulus B verisi" senaryosu eklenir.

## 5. Uretim sirasi (adim adim)

On kosul: FAZ 0 01-03 uretimde (15 Eylul), `git status` temiz, dal `ukqhgspaallzjscjodbb`.

1. Commit: `git add -A` / `git commit -m "FAZ 1: internal sema iskeleti - access_audit, erisim kalibi, T10, asama6"`.
2. **Dal:** `supabase link --project-ref ukqhgspaallzjscjodbb` -> `supabase db push` (1 dosya; 2b'yi de listelerse normal).
3. **Dalda test** (SQL Editor, adres cubugunda dal ref'i): `asama4-davranis-testi.sql` -> 11 satir, T10 `GECTI`
   (T9 `ATLANDI` normal). Sonra `asama6-faz1-internal-kontrol.sql` -> 8 satir `OK`. K2: Supabase
   `pgrst.db_schemas`'i rol ayari olarak tutmaz, veritabanindan okunamaz; K2 bu durumda "elle dogrula" der —
   Dashboard > Project Settings > API > **Exposed schemas** listesine bakilir, `internal` orada OLMAMALI
   (varsayilan: public, graphql_public; storage da olabilir). Bu kontrol dal ve uretimde bir kez goze yapilir.
4. **Uretim:** `supabase link --project-ref qydsooqmflrrwtgawhsv` -> `supabase db push` (1 dosya).
5. **Uretimde dogrulama:** yalniz `asama6-faz1-internal-kontrol.sql` -> 8 satir `OK`, K8 denetim satiri 0;
   Dashboard > Project Settings > API > Exposed schemas: `internal` yok. asama4 uretimde KOSULMAZ
   (uretim korumasi var, yine de). Not: asama6, push'tan ONCE kosulursa `schema "internal" does not exist`
   verir — bu "hata" degil, sira hatasidir.
6. `git push`.

Geri alma: `DROP SCHEMA internal CASCADE; DROP FUNCTION public.internal_audit_recent(uuid, integer);`
(veri yok, uygulama bagimliligi yok).

## 6. Acik noktalar

- Dashboard > API ayarinda "Exposed schemas" listesi asla `internal` icermemeli; asama6 K2 bunu her kosuda dogrular.
- Denetim tablosu buyumesi: FAZ 7'de (ticari katman) saklama suresi ve arsivleme kurali kararlastirilir; simdilik sinirsiz.
- `internal.margin_rules` (01 bolum 8) FAZ 7'de; `role_id` icin `roles` tablosu FAZ 3'te gelir.

## 7. Kapanis kaydi (17 Eylul 2026)

**Dal (`ukqhgspaallzjscjodbb`):** `db push` -> asama4 T0-T10: T10 GECTI (T9 ATLANDI, 04 bekliyor);
asama6 8/8 OK.

**Uretim (`qydsooqmflrrwtgawhsv`):** faz1_01 uygulandi (`Success. No rows returned`); asama6 **8/8 OK**,
K8 "denetim satiri: 0". Dashboard > Project Settings > API > Exposed schemas: `public`, `graphql_public`
isaretli; `storage` listede ama isaretsiz; **`internal` yok** (goz kontrolu). `git push` -> `e8aa20e..92e5be6 main`.

**Notlar:**
- asama6 bir kez push'tan once kosuldu ve `schema "internal" does not exist` verdi; sira hatasi, bolum 5
  adim 5'e not eklendi.
- K2 ogrenimi: Supabase `pgrst.db_schemas`'i `authenticator` rol ayarinda tutmuyor; kontrol veritabaninin
  icinden yapilamiyor, Dashboard'dan goz kontrolu gerekiyor (K2 metni buna gore duzeltildi).
- Uretimde `supabase migration list` ile `20260915170000` satirinin Remote sutununda gorundugu dogrulanir;
  dosya SQL Editor'dan uygulanmissa `supabase migration repair --status applied 20260915170000` gerekir
  (CLAUDE.md migration akisi kurali).

**Sonraki:** FAZ 0 / 04 (tutarlilik izlemesi sonrasi), ardindan FAZ 2 on kosullari (tip tekillestirme, Claude Code).
