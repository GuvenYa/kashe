# 48 - Claude Code gorevi: FAZ 10c-2 / P2 - bes tabloda sahip kimligi provider_id (uygulama)

Hazirlayan: Claude (Cowork), 5 Kasim 2026. Kaynak: `docs/envanter/38-faz10-temizlik.md` bolum 10c (10c-2).
On kosul: `supabase/migrations/20261105160000_faz10c_04_provider_id_kesimi.sql` dalda ve uretimde (iki yonlu tetikleyici:
istemci yalniz `provider_id` gonderirse eski sahip sutunu ondan dolar; eski uygulama da aynen calisir).
`main`'den acilan `faz10c/p2` dalinda.
Kullanim: Claude Code'a "`docs/envanter/48-claude-code-gorevi-10c2-p2-provider-id.md` dosyasini oku, "---" cizgisinin altindaki
gorevi uygula" denir.

---

## Gorev

Bes tabloda sahip kimligi icin uygulama `provider_id` kullanir. Eski sutunlar (`profile_id`, `professional_id`) veritabaninda
FAZ 11'e kadar kalir ve tetikleyiciyle dolar; bu gorev yalniz uygulamanin OKUMA SUZGECI ve YAZMA YUKUNU tasir. Davranis degismez.
Turkce arayuz metinleri, ASCII kod yorumlari, yeni dosyalarda sapkali harf yok. Commit ATMA.

### Veritabani (hazir, dokunma)

| Tablo | Eski sahip sutunu | Yeni | Not |
|---|---|---|---|
| `services` | `profile_id` | `provider_id` | |
| `portfolio_items` | `profile_id` | `provider_id` | |
| `profile_experiences` | `profile_id` | `provider_id` | indeks `(provider_id, kind, sort_order)` |
| `reviews` | `professional_id` | `provider_id` | indeks `(provider_id, created_at DESC)`; `customer_id` DEGISMEZ |
| `favorites` | `professional_id` | `provider_id` | TEKIL `(user_id, provider_id)` (upsert hedefi); `user_id` DEGISMEZ |

- `provider_id` bes tabloda NOT NULL; deger her zaman eski sutunla AYNI kimlik (providers.id = profiles.id).
- INSERT'te yalniz `provider_id` gonderilir; eski sutun tetikleyicide dolar. RLS politikalari eski sutunla yazili ve tetikleyiciden
  SONRA denetlenir - baskasi adina satir acilamaz (42501). Saglayici olmayan sahip (musteri / isletme) icin satir acilamaz: 42501,
  mesaj "Bu kayit yalniz saglayici hesaplarinda acilabilir (...)".

### Yapilacaklar

1. **Envanter once:** bes tabloya giden her sorguyu bul (`.from('<tablo>')` ve gomme `tablo(...)` / `tablo!fk(...)`). Raporda
   dosya:satir tablosu: once / sonra.
2. **Suzgec:** bu bes tabloda sahibe gore suzen her kosul (`.eq` / `.in` / `.match` / `.or` icindeki `profile_id` /
   `professional_id`) -> `provider_id`.
3. **Yazma:** INSERT / upsert yukunde eski sahip sutunu yerine `provider_id`; `favorites` upsert hedefi `onConflict:
   'user_id,provider_id'`. UPDATE / DELETE sahiplik kosullari -> `provider_id`. Eski sutunu yuke YAZMA (tetikleyici doldurur).
4. **Okunan alan:** bu tablolardan secilen `profile_id` / `professional_id` (sahip kimligi olarak kullanilan) -> `provider_id`;
   tipler (`app/lib/types.ts` ya da yerel tipler) `provider_id: string` ile guncellenir, eski alan tipten DUSMEZ (veri hala geliyor)
   ama yeni kod onu okumaz.
5. **DEGISMEYENLER:**
   - PostgREST gomme ipuclari (`profiles!reviews_professional_id_fkey(...)`, `services!services_profile_id_fkey(...)` vb.) AYNEN
     kalir - yabanci anahtarlar duruyor; ipucu degisimi FAZ 11'de eski sutunlarla birlikte.
   - Baska tablolarin ayni adli sutunlari: `conversations.professional_id`, `bookings.professional_id`, `listings`, `quote_requests`,
     `listing_applications`, `talents` vb. DOKUNULMAZ.
   - `reviews.customer_id`, `favorites.user_id`, admin listelerinin musteri tarafi.
   - Veritabani fonksiyonlari / RPC'ler, Sahne betikleri, asama dosyalari.
6. `CLAUDE.md` "`provider_id` sutunlari istemciden yazilmaz (FAZ 2b)" paragrafini guncelle: FAZ 10c-2 sonrasi bes tabloda sahip
   kimligi `provider_id` (yazma ve suzgec); eski sutunlar tetikleyiciyle dolar ve FAZ 11'de duser; gomme ipuclari o zamana kadar eski
   anahtarla.

### Kabul olcutleri

- `npx tsc --noEmit`, degisen dosyalarda `npx eslint`, `npm run build` temiz.
- Bes tabloya giden sorgu zincirlerinde eski sahip sutunu suzgec / yuk olarak 0 (yalniz gomme ipuclari ve yorumlar kalir). Raporda
  bunu gosteren arama komutu ve ciktisi.
- Rapor: envanter tablosu (dosya:satir, once / sonra), degismeyen gomme ipuclari listesi, sapmalar. Smoke icin acik sunucu birakma.

### Onizleme turu (Claude yapacak)

Profesyonel (Sahne): portfoy ekle / sil, hizmet ekle / duzenle / pasife al / sil, deneyim ekle / sil -> `/p/[id]` ve Kesfet fiyat
ozeti; musteri: favori ekle / cikar, `/favoriler`; yorum listeleri (`/p/[id]`, `/yorumlar`); admin yorumlar / sikayetler; ana sayfa
one cikanlar. asama9 (FAZ 2b tutarlilik) ve asama20 K10 ESIT kalir.
