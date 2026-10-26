# Claude Code gorevi — FAZ 9c / P1: Guven dokumu ve itiraz (`/profil` + `/ajans` karti, itiraz formu/durumu) ve admin `/admin/zeka` Blok 5 (skor dagilimi, bilesen ortalamalari, itiraz kuyrugu + karar)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: `docs/envanter/34-faz9-zeka-katmani.md` bolum 1 (kararlar 3, 5, 6, 8) ve bolum 4 +
`supabase/migrations/20261027120000_faz9c_01_trust_score.sql` (DB dalda ve uretimde). Dal: `faz9c/p1` (Guven acar). **Migration/RPC YOK;
`trust_score_snapshots` istemciden/sunucudan DOGRUDAN OKUNMAZ** — okuma yolu `my_trust_breakdown(p_provider)`; itiraz `trust_appeals`'a
DOGRUDAN INSERT (RLS; 8a deseni: yazma tabloya, kurallar DB'de); admin karari `trust_appeal_review(p_appeal, p_status, p_note)`; admin
ozeti `trust_score_summary()`. **Musteri yuzeyinde skor YOK** (`/p/[slug]`, Kesfet, portal: HICBIR degisiklik). Kesfet siralamasi DEGISMEZ.

---

Kashe reposundasin. Once `git status` (temiz; dal `faz9c/p1`). Oku: `CLAUDE.md`, `DESIGN.md` bolum 9, migration dosyasi (RPC donusleri
asagida), `app/profil/page.tsx` (`isPro`, `isAgencyUser` → `/ajans`'a yonlendirme, FAZ 9b "Pazar araligi" karti — yeni kart onun ALTINA),
`app/ajans/page.tsx` (ajans paneli; `kurulus.canManageSettings`, `kurulus.legacyProfileId`), `app/lib/org-context.ts` (`CrewOrg`),
`app/profil/hizmetlerim/actions.ts` (server action deseni: `'use server'`, `createClient`, `revalidatePath`), `app/admin/zeka/page.tsx`
(Blok 1-4 deseni; `hataMetni`; `Promise.all`; `KpiSatir`, `VeriTablosu`, recharts) + `app/lib/zeka.ts` + `app/lib/grafik-tema.ts`,
`app/components/panel/*`, `app/lib/tarih.ts` (`tarihMetni`, `zamanMetni`).

**Kirmizi cizgi:** migration/RPC YOK; `from('trust_score_snapshots')` HICBIR dosyada gecmez; skor UYDURULMAZ, yuvarlanmaz (RPC degeri);
itiraz formu kullanicinin metnini oldugu gibi yazar (20-2000 karakter; DB CHECK ile ayni sinir UI'da da); musteriye donuk hicbir yuzeye
dokunulmaz; sapkali harf yok, yorumlar ASCII, UI Turkce. Commit ATMA.

## 0) RPC donusleri

`my_trust_breakdown(p_provider uuid default auth.uid())` → `{ provider_id, visible: bool, snapshot: null | { id, score (0-100, 2 ondalik),
computed_at, algorithm_version, components: { verification: {points, level}, profile: {points, approved, bio_ok, avatar, active_role,
portfolio_count}, completed: {points, count}, cancel: {points, rate, seller_cancelled, total_12m}, reviews: {points, avg, cnt},
response: {points, median_h} } }, appeal: null | { id, status ('open'|'reviewed'|'closed'), message, admin_note, created_at, reviewed_at,
snapshot_id } }`. Yetkisiz → 42501. `visible = false` → saglayici yayinda degil (skor hesaplanmaz).

`trust_appeals` INSERT (RLS): `{ provider_id, message }` — `created_by` ve `snapshot_id` tetikleyiciyle dolar. Ikinci acik itiraz → 23505;
kisa/uzun mesaj → 23514; yetkisiz → 42501. UPDATE/DELETE hakki YOK.

`trust_appeal_review(p_appeal uuid, p_status 'reviewed'|'closed', p_note text)` → guncel satir jsonb; admin degilse 42501; gecersiz durum 22023.

`trust_score_summary()` → `{ last_computed_at, high_threshold: 70, distribution: { low, mid, high, scored, avg, not_computed, invisible },
appeals: { open, reviewed, closed }, appeal_queue: [{ id, provider_id, provider_name, provider_type, status, message, admin_note,
created_at, reviewed_at, snapshot_id, snapshot_score, current_score }] (<= 50; acik once), component_avgs: { verification, profile,
completed, cancel, reviews, response, providers } }`. Admin degilse 42501.

## 1) Ortak katman

- **`app/lib/guven.ts`** (istemci/sunucu ortak; React/DB yok): `BILESENLER: { anahtar, etiket, maks, nasilArtar }[]` SIRA SABIT:
  verification "Doğrulama" 25 "Kimlik ve belge doğrulamasını tamamla (e-posta 10, belge 20, tam 25)." · profile "Profil onayı ve tamlığı" 15
  "Onaylı profil 5; en az 120 karakterlik tanıtım 3; profil fotoğrafı 2; en az bir aktif rol 2; en az üç portföy öğesi 3." · completed
  "Tamamlanan iş" 25 "Kashe üzerinden tamamlanan iş: 1–2 → 10, 3–9 → 18, 10 ve üzeri → 25." · cancel "İptal" 0 (araligi `-15..0`; `min: -15`)
  "Son 12 ayda senin iptal ettiğin rezervasyon oranı düşük kalsın (hiç yok 0, %10 altı −5, %25 altı −10, üzeri −15)." · reviews
  "Değerlendirme" 20 "Üçten az değerlendirme nötr 8; 3 ve üzeri: ortalama 4,7+ → 20, 4,3+ → 15, 3,8+ → 10." · response "Yanıt süresi" 15
  "Müşterinin ilk mesajına yanıt medyanı: 2 saat içinde 15, 24 saat 10, 72 saat 5; veri yoksa nötr 7.";
  `hamDeger(anahtar, c)` → bilesenin ham degeri Turkce tek satir (ornek: verification → "Düzey: belge" (`level` esleme none "yok" · email
  "e-posta" · document "belge" · full "tam"); completed → "{count} tamamlanan iş"; cancel → "{seller_cancelled}/{total_12m} iptal (%{rate*100,
  1 ondalik})"; reviews → cnt<3 ? "{cnt} değerlendirme (nötr)" : "{cnt} değerlendirme · ort. {avg}"; response → median_h null ? "Veri yok
  (nötr)" : "Medyan {median_h} sa"; profile → "{bio_ok ? 'tanıtım ✓' : 'tanıtım —'} · {avatar ? 'fotoğraf ✓' : 'fotoğraf —'} · {active_role ?
  'rol ✓' : 'rol —'} · portföy {portfolio_count}"); `ITIRAZ_DURUMU: Record<status, { etiket, sinif }>` open "Açık" `text-brand-accent` ·
  reviewed "İncelendi" `text-moss` · closed "Kapatıldı" `text-ink-50`; `skorSinifi(score)` → >= 70 `text-moss`, >= 40 `text-ink`, altinda
  `text-brand-accent`; `ITIRAZ_MIN = 20`, `ITIRAZ_MAX = 2000`; `GUVEN_ESIGI = 70`.
- **`app/lib/guven-data.ts`** (SUNUCU; `import 'server-only'`): `guvenDokumu(providerId?: string): Promise<GuvenDokumu | null>` —
  `rpc('my_trust_breakdown', providerId ? { p_provider } : {})`; 42501/hata → `null` (kart cizilmez, konsola gurultu yok); donus tipi
  `GuvenDokumu` (yukaridaki sekil, `score: number`).
- **`app/lib/guven-actions.ts`** (`'use server'`): `itirazAc(providerId: string, message: string): Promise<{ ok: true } | { ok: false; error: string }>`
  — kirpilmis metin 20-2000 degilse DB'ye gitmeden hata metni ("İtiraz metni 20–2000 karakter olmalı."); `from('trust_appeals').insert({
  provider_id, message })`; hata eslemesi: 23505 → "Zaten açık bir itirazın var; sonucu bekle.", 23514 → uzunluk metni, 42501 → "Bu döküm
  için itiraz yetkin yok."; basarida `revalidatePath('/profil')` ve `revalidatePath('/ajans')`.

## 2) Kart: `app/components/guven/guven-dokumu-karti.tsx` (sunucu bileseni) + `itiraz-formu.tsx` (istemci)

- Prop'lar: `dokum: GuvenDokumu`, `providerId: string`, `itirazEdebilir: boolean`. `PanelKart baslik="Güven dökümü"`.
- `visible = false` → kart icinde tek satir: "Profilin yayında değilken güven puanı hesaplanmaz." (baska bir sey yok).
- `snapshot = null` (yayinda ama henuz hesap yok) → "Puanın ilk gece hesaplamasında oluşacak." (hesap gunluk 03:45).
- Dolu: ust satir eyebrow mono "Trust Score V0 · {tarihMetni(computed_at)} · günlük hesaplanır"; buyuk skor `font-display text-4xl tabular-nums`
  `{score}` (2 ondalik degil — RPC `numeric(5,2)`; tam sayiysa "62", degilse "62,5" → `toLocaleString('tr-TR', { maximumFractionDigits: 1 })`)
  + "/100" (`text-ink-50`); yaninda ince ilerleme cubugu (`h-1.5 rounded-full bg-paper-2`, dolu kisim `skorSinifi` rengiyle `bg-*`
  esdegeri: moss / brand-ink / brand-accent; genislik `score%`). Altinda `text-xs text-ink-50`: "70 ve üzeri eşleştirmede 'yüksek güven'
  olarak işaretlenir. Puan yalnız sana görünür; müşteriler sayıyı görmez."
- **Bilesen tablosu** (`VeriTablosu`): satir = `BILESENLER` sirasi; sutunlar "Bileşen" (etiket; altinda mono 10px `nasilArtar` DEGIL —
  o ayri sutun), "Puan" (`sayisal`; "{points} / {maks}", iptal icin "{points} / 0 (en az −15)"), "Değer" (`hamDeger`), "Nasıl artar"
  (`dar`; `text-ink-72 text-sm`). Kart modunda (telefon) dort alan alt alta; etiketler `VeriSutunu.baslik`'tan.
- **Itiraz blogu** (kartin alti, `border-t border-line pt-4`):
  - `appeal` yoksa ve `itirazEdebilir`: `ItirazFormu` (istemci): "Bu değerlendirmeye itiraz et" baslik satiri + `textarea` (placeholder
    "Hangi bileşenin neden hatalı olduğunu yaz; inceleyip not düşeceğiz.", `minLength 20 maxLength 2000`, sayac "{n}/2000"), dugme "İtirazı
    gönder" (`useTransition`; basarida form kapanir ve sayfa yenilenir — `revalidatePath` yeterli; hata metni dugmenin altinda).
  - `appeal` varsa: durum rozeti (`ITIRAZ_DURUMU`) + "{tarihMetni(created_at)}" + kullanicinin mesaji (`whitespace-pre-wrap text-sm`);
    `admin_note` varsa alt kutu (`bg-paper-2 rounded-lg p-3`): eyebrow "Kashe notu · {tarihMetni(reviewed_at)}" + not. Durum `open` ise
    altinda "İtirazın inceleniyor." ve yeni form YOK; `reviewed`/`closed` ise altinda yeniden "Yeni itiraz aç" (ayni form, kapali baslar,
    dugmeyle acilir).
  - `itirazEdebilir = false` (ajansta `settings.manage` yok): form yok; `appeal` varsa yine gosterilir (salt okunur).

## 3) Yerlesim

- **`/profil`** (`app/profil/page.tsx`, yalniz `isPro`): `dokum = await guvenDokumu()`; `dokum` varsa kart "Pazar aralığı" kartinin HEMEN
  ALTINA (o yoksa ayni yere), `itirazEdebilir = true`. `dokum` null (RPC hatasi) → kart yok.
- **`/ajans`** (`app/ajans/page.tsx`): kurulusun saglayicisi `kurulus.legacyProfileId` (providers.id = legacy profil); `dokum = await
  guvenDokumu(legacyProfileId)` yalniz `legacyProfileId` doluysa; kart mevcut kartlarin ALTINDA, tam genislik; `itirazEdebilir =
  kurulus.canManageSettings`. RPC yetki vermezse (uye `settings.manage` degil → 42501 → null) kart cizilmez: dokum yalniz yetkililere.
- Baska yuzey YOK (`/p/[slug]`, Kesfet, portal, kurumsal panel: dokunulmaz).

## 4) Admin `/admin/zeka` — Blok 5 "Güven puanı · Trust Score V0"

- Ilk `Promise.all`'a `rpc('trust_score_summary')` (pencere seciciden bagimsiz; `price_benchmarks_summary` ile ayni kalip: paralel baslar).
  Hata → `hataMetni`.
- `PanelKart baslik="Güven puanı · Trust Score V0"`; `KpiSatir` 4: "Puanlı sağlayıcı" (`distribution.scored`; altNot "{invisible} yayında
  değil"), "Ortalama" (`avg`, 1 ondalik; altNot `last_computed_at` `zamanMetni`), "Yüksek güven (70+)" (`high`, `vurgu="moss"` > 0 ise;
  altNot "eşleştirmede işaretlenir"), "Açık itiraz" (`appeals.open`, `vurgu="accent"` > 0 ise; altNot "{reviewed} incelendi · {closed} kapalı").
  `not_computed > 0` ise KPI satirinin altinda `text-xs text-brand-accent`: "{not_computed} yayındaki sağlayıcı henüz hesaplanmadı."
- **Grafik 1 — dagilim:** `BarChart` (yukseklik 180) uc cubuk "0–39", "40–69", "70+" (`low/mid/high`); renkler `C.brandAccent`,
  `C.brandInk`, `C.moss` (`Cell`); `LabelList position="top"`. Hepsi 0 → "Henüz puan yok."
- **Tablo 1 — bilesen ortalamalari** (`VeriTablosu`; `component_avgs`): satir = `BILESENLER` sirasi; "Bileşen", "Ortalama puan" (`sayisal`,
  1 ondalik), "Maksimum" (`sayisal`; iptal "0 (−15)"), "Doluluk" (`sayisal`, `dar`; ortalama/maks yuzde — iptal icin "—"). `providers` 0 → tablo
  bos metni "Henüz döküm yok."
- **Tablo 2 — itiraz kuyrugu** (`VeriTablosu`; `appeal_queue`): "Sağlayıcı" (`provider_name` + altinda mono `provider_type` Turkce:
  professional "profesyonel" · organization "kuruluş"), "Puan" (`sayisal`; "{snapshot_score} → {current_score}" farkliysa, aksi halde tek
  sayi), "Mesaj" (ilk 140 karakter + "…"; tam metin `title`), "Durum" (`ITIRAZ_DURUMU` rozeti + `tarihMetni(created_at)` alt satir),
  "Karar" (yalniz `status = 'open'` satirlarda; `dar` DEGIL): iki kucuk dugme "İncelendi" / "Kapat" + not girdisi (tek satir `input`,
  placeholder "Kısa not (sağlayıcı görür)", `maxLength 2000`) → `supabase.rpc('trust_appeal_review', { p_appeal, p_status, p_note })`;
  basarida yalniz `trust_score_summary` yeniden cekilir (tum sayfa degil); hata metni satirin altinda. `reviewed`/`closed` satirda karar
  yerine `admin_note` (varsa; `text-ink-72 text-xs`). Bos → "İtiraz yok."
- Yerlesim: Blok 4'un altinda tam genislik; Blok 2-3 gridi en altta kalir. Blok sirasi: 1 Gunluk olaylar → 4 Fiyat kiyaslari → 5 Guven
  puani → (2 Huni | 3 Adalet).
- `app/lib/zeka.ts`: `TRUST_ARALIK_ETIKETI = ['0–39', '40–69', '70+']` (grafik ekseni).

## 5) Dogrulama

- `node node_modules/typescript/lib/tsc.js --noEmit -p tsconfig.json`; degisen/yeni dosyalarda `npx eslint <dosyalar>`; `npm run build`.
- `grep -rn "from('trust_score_snapshots')" app` BOS; `grep -rn "from('trust_appeals')" app` yalniz `guven-actions.ts` INSERT;
  `grep -rn "trust_appeal_review\|trust_score_summary\|my_trust_breakdown" app` yalniz RPC cagrilari.
- `grep -rnP '[âîûÂÎÛ]' <yeni/degisen dosyalar>` bos. Istemci → sunucu import yok (`guven-data.ts` yalniz sunucu sayfalari).
- `/p/[slug]`, `app/kesfet/*`, `app/portal/*` `git diff`'te YOK.
- Uretimde: profesyoneller `/profil`'de kartlarini gorur (skor dolu — migration ilk hesabi kostu); itiraz formu 20 karakter alti dugmeyi
  kilitler; admin Blok 5 dagilimi gosterir; itiraz kuyrugu bos ("İtiraz yok.").

## 6) Rapor

Bitince kisa rapor: yeni/degisen dosyalar, kartin uc durumu (yayinda degil / hesap yok / dolu) ve itiraz akisinin durumlari, admin Blok 5
icerigi, sapmalar (gerekcesiyle). Commit ATMA.
