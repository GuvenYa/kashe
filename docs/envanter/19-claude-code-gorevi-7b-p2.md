# Claude Code gorevi — FAZ 7b / P2: alici karsilastirma, secim, revizyon, degerlendirme; satici secildi/secilmedi

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/19-faz7-ticari-katman.md` bolum 12 (7b-P2 plani + P1 kapanis notu).
ON KOSUL: 7b-P1 + P1-ek deploy'da (19 Ekim turu tamam). **Migration YOK** — tum islemler mevcut RPC'lerle (`rfp_award`, `rfp_request_revision`,
`rfp_close`, `rfp_cancel`); veri okuma RLS ile (alici kurulus gonderilmis surumleri ve gorunur kalemleri okur: `proposals_select`,
`proposal_versions_select`, `proposal_items_select` 7b surumu).

---

Kashe reposundasin. Once `git status` (temiz olmali). Oku: `app/kurumsal/rfp/[id]/page.tsx` + `rfp-editoru.tsx` (gonderilmis durumda davet
listesi "Yanıtladı · Sürüm n · toplam" ve "karşılaştırma ... sonraki sürümde" yer tutucusu), `app/kurumsal/rfp/rfp-actions.ts` (mevcut RPC
sarmalayicilari), `app/kurumsal/rfp/rfp-data.ts` (`RfpDetay`, `RFP_DURUM_ETIKETLERI`, `paraMetni`), `app/ajans/rfp/[id]/page.tsx` (satici:
`awarded` / `not_selected` dallari ~87-89, 193, 217), `app/ajans/teklifler/[id]/page.tsx` + `teklif-editoru.tsx` (revizyon istenmis teklifte
"Yeni sürüm" ve RFP dalinda gonderim; onayli teklifte "Rezervasyon oluştur" — 7c-P1), `app/lib/tarih.ts`, `supabase/migrations/20261009120000_faz7b_01_rfp.sql`
(RPC on kosullari: `rfp_award` rfps sent/collecting/evaluating + teklif sent/viewed + gonderilmis surum; `rfp_request_revision` not 2-4000;
`rfp_close` sent/collecting), `CLAUDE.md`.

Kurallar: alici yuzeyi `is_buyer` ile kapili (sayfa zaten `/ajans/rfp/[id]`'ye yonlendiriyor). Ic maliyet/marj HICBIR ZAMAN aliciya
gitmez (yalniz `proposal_items` musteri fiyatlari; `internal.*` okunmaz). Butce ipucu yalniz alicida (zaten `rfp_detail`). Kritik islemde
onay kapisi (`05-arayuz-modeli.md`). Tarih/saat `app/lib/tarih.ts` ile Istanbul. Sapkali harf yok; yorumlar ASCII; UI Turkce.

## Yapilacaklar

### 1) Alici: "Gelen teklifler" karsilastirma — `app/kurumsal/rfp/[id]/page.tsx` (+ yeni `teklif-karsilastirma.tsx`, istemci yalniz islemler icin)

- Veri (sunucu bileseni, RLS): `proposals` WHERE `rfp_id = id` (satici kurulus adi: `providers` -> `organizations.display_name`; `status`;
  `seller_organization_id`), her teklifin **son gonderilmis surumu** (`proposal_versions` WHERE `proposal_id` IN … AND `sent_at IS NOT NULL`
  ORDER BY `version_no` DESC, ilk satir; `subtotal`, `vat_rate`/`vat_amount` (adlari tabloya gore), `total_amount`, `valid_until`,
  `client_note`, `approved_at`, `approved_by_name`) ve o surumun kalemleri (`proposal_items`: `role_id`, `description`, `quantity`,
  `unit_client_price`, `total_client_price`, `sort_order`; RLS gorunur olanlari verir — `is_visible_to_client` ayrica filtrelenmez).
  Surum sayisi (gonderilmis) de okunur ("Sürüm 2").
- Yerlesim: davet listesinin ALTINDA, yer tutucu paragrafin YERINE, yalniz **en az bir yanit varsa**. Baslik `Gelen teklifler (n)`.
  **Karsilastirma tablosu** (`overflow-x-auto`): satirlar = talebin kalemleri (`rfp_detail.items`: rol adi + adet, sirali) + teklifte olup
  talepte rolu eslesmeyen kalemler icin alt bolum "Ek kalemler"; sutunlar = yanit veren her ajans (baslik: ajans adi + durum rozeti +
  "Sürüm n"). Hucre: `adet × birim = toplam` (ornek `1 × 2.000 TL = 2.000 TL`); eslesen kalem yoksa `—`. Eslestirme `role_id` ile; ayni rolde
  birden cok kalem varsa toplanir. Alt satirlar: **Ara toplam**, **KDV**, **Genel toplam (KDV dahil)** (kalin), **Geçerlilik** (`tarihMetni`),
  **Not** (client_note kisaltilmis, tam metin `title`). En dusuk genel toplam sutunu hafif vurgulanir (`bg-moss/5`) — yalniz 2+ yanit varsa.
- Tek yanit varsa tablo yine gosterilir (tek sutun); mobilde sutunlar yatay kaydirilir.
- Durum rozetleri teklif durumuna gore: `sent`/`viewed` "Gönderildi", `revision_requested` "Revizyon istendi", `approved` "Seçildi",
  `rejected`/diger mevcut etiketler (teklif durum etiketleri `teklif-data.ts`'te varsa oradan import et; yoksa `rfp-data.ts`'e ekle).

### 2) Alici islemleri — `rfp-actions.ts` + istemci bileseni

- **Seç** (her sutunun altinda, yalniz RFP `sent|collecting|evaluating` ve teklif `sent|viewed` iken): onay kapisi modal —
  `"<ajans>" teklifi (<genel toplam>) seçilecek. Teklif onaylanır, diğer davetler "seçilmedi" olur; bu işlem geri alınamaz.` →
  `rfp_award(p_rfp_id, p_proposal_id)` → `revalidatePath`. Basari mesaji `Seçim yapıldı.`
- **Revizyon iste** (ayni kosullar): modal, zorunlu not (2-4000; sayac) → `rfp_request_revision(p_proposal_id, p_note)`. Teklif rozeti
  "Revizyon istendi"; ajans yeni surum gonderince (mevcut `proposal_send` RFP dali) tablo yeni surumu gosterir.
- **Değerlendirmeye al** (RFP basliginin yanindaki islem alaninda; yalniz `sent|collecting`): kisa onay —
  `Yeni yanıt alınmaz; mevcut tekliflerle değerlendirme yapılır.` → `rfp_close`. Rozet "Değerlendirmede".
- **İptal et** mevcut (`rfp_cancel`) — `awarded` sonrasi gizlenir (RPC zaten reddeder).
- Hata mesajlari RPC `RAISE` metinleriyle anlasilir Turkce (`teklif bu durumda secilemez` → `Bu teklif şu an seçilemez (durumu değişmiş olabilir).`).
- `awarded` sonrasi: ust bantta `Seçim yapıldı · <ajans> · <genel toplam> · <approved_at tarih>`; secili sutun `border-moss` vurgulu, diger
  sutunlarda "Seçilmedi"; Seç/Revizyon dugmeleri kalkar. Rezervasyon bilgisi: `bookings` WHERE `proposal_version_id` = secili surum (alici
  kurulus `can_access_booking_row` ile okur) varsa `Rezervasyon oluşturuldu · <tarih>`; yoksa `Rezervasyonu ajans oluşturur.` — baglanti
  YOK (alici tarafi rezervasyon sayfasi 7c-b acik kalem; `app/rezervasyon/[id]` alici kurulus icin dogrulanmadi).

### 3) Satici tarafi — kontrol + kucuk dokunuslar

- `app/ajans/rfp/[id]/page.tsx`: `awarded` + kendi teklifi secildi → "Teklifin seçildi." (var) + teklife baglanti; `not_selected` →
  "Bu talep başka bir teklife verildi." (var, metni kontrol et); `evaluating` → `Değerlendirmede — yeni yanıt alınmıyor.` notu;
  `cancelled` → mevcut.
- `app/ajans/teklifler/[id]`: RFP yaniti `revision_requested` iken ust bantta alicinin notu (`client_note`) gorunur ve "Yeni sürüm" akisi
  calisir (7a'da portal icin vardi; RFP dalinda da ayni oldugunu dogrula, eksikse ekle). `approved` RFP yanitinda "Rezervasyon oluştur"
  (7c-P1) gorunur ve `booking_from_proposal` calisir (teklif `event_id` ve `buyer_organization_id` tasir; rezervasyon alici kurulusla acilir).
- Bildirim etiketleri (`app/bildirimler`): `rfp`/`proposal` tipleri 7b-P1'de eklendi; award/revizyon/kapanis metinleri RPC'den geliyor —
  degisiklik gerekmez, kontrol et.

### 4) Menu/liste

- `/kurumsal/rfp` listesinde durum rozeti `evaluating` "Değerlendirmede", `awarded` "Seçim yapıldı" (etiketler `rfp-data.ts`'te var) ve
  yanit sayisi ("2 yanıt") sutunu.

## Dogrulama

- `npx tsc --noEmit` bos; `npm run build` → route tablosu + hata yok + `.next/BUILD_ID`.
- `grep -rn "rpc('rfp_award\|rpc('rfp_request_revision\|rpc('rfp_close\|rpc('rfp_cancel" app` → yalniz `rfp-actions.ts`.
- `grep -rn "internal\.\|proposal_internal\|margin\|marj" app/kurumsal` → 0 (aliciya ic maliyet yok).
- `grep -rn "budget_hint" app/ajans` → 0 (degismedi).
- `grep -rn "from('proposal_items')" app/kurumsal` → yalniz karsilastirma veri dosyasi; `is_visible_to_client` filtrelenmiyor (RLS).
- Sapkali harf 0; yorumlar ASCII.
- **Canli (Guven, mevcut test verisiyle — RFP `6e337b47…`, Sunucu Ajans yaniti 24.000 TL):**
  1. Test Pro: talepte "Gelen teklifler (1)" tablosu: 5 satir (Sunucu, Hostes, DJ, Etkinlik Koordinatörleri, Sunucu — ayni rol toplanir →
     4 satir + Sunucu 2 adet), KDV ve 24.000 TL; **Revizyon iste** → not "DJ fiyatını yeniden değerlendirir misiniz?" → rozet "Revizyon istendi".
  2. fbguvenfb (Sunucu Ajans): bildirim "revizyon istendi"; teklifte alici notu; **Yeni sürüm** → DJ 3.500 → **Gönder** → "alıcıya iletildi".
  3. Test Pro: tablo Sürüm 2, yeni toplam; **Değerlendirmeye al** → rozet "Değerlendirmede"; **Seç** → onay → "Seçim yapıldı" banti;
     bildirimler.
  4. fbguvenfb: `/ajans/rfp/<id>` "Teklifin seçildi."; `/ajans/teklifler/<id>` onayli → **Rezervasyon oluştur** → `/rezervasyonlarim` Kuruluş sekmesi.
  5. Test Pro: talepte `Rezervasyon oluşturuldu · <tarih>`.
  6. SQL: `asama17` K8-K11 0, K12 101, K13 **0**; `asama16` K11 0 (onayli teklif rezervasyonsuz degil), K12 +1.

## Yapilmayacaklar

Migration/RPC/politika YOK. Alici tarafinda rezervasyon sayfasi/baglantisi YOK (7c-b). E-posta YOK. Ic maliyet, marj, `internal.*` alici
yuzeyinde YOK. Portal dosyalarina DOKUNMA. Commit ATMA.

Rapor: yeni/degisen dosyalar, tsc/build (BUILD_ID), grep sonuclari, sapma ve nedeni. Commit ATMA.
