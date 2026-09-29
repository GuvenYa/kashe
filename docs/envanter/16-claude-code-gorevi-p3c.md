# Claude Code gorevi — FAZ 4c / P3c: teklif verme akisinda sohbet guncellemesi sessizce dusuyor (budget_range CHECK)

Asagidaki metni oldugu gibi Claude Code'a ver. Kaynak: P3 canli turu (29 Eylul). Test Pro bagli talebe teklif verdi
(`quote_request_recipients.status = quoted`) ama Test Musteri-Test Pro sohbetinde `event_type`/`event_date`/`event_id`
guncellenmedi; `last_message_at` guncellendi (sistem mesaji girdi). Kok neden asagida.

---

Kashe reposundasin. `app/teklif-topla/actions.ts` icindeki `submitOffer`'i (sohbet acma/guncelleme bolumu),
`app/mesajlar/data.ts` (`BUDGET_RANGES`) ve `app/mesajlar/actions.ts` `startConversation`'i oku.

**Hata:** `submitOffer`, talep butcesi paylasiliyorsa (`share_budget`, formda varsayilan ACIK) sohbete
`budget_range = "20000 - 30000 TL"` gibi SERBEST METIN yaziyor. `conversations.budget_range` sutununda
`conversations_budget_range_check` var: yalniz `under_5k | 5k_15k | 15k_30k | 30k_50k | over_50k | open`. Mevcut sohbet
UPDATE'i 23514 ile dusuyor, kod `error`'a bakmiyor -> tarih/tur/brief/`event_id` hicbiri yazilmiyor; yeni sohbet
gerekirse INSERT de dusuyor ve pro "sohbet acilamadi" turu hata goruyor. Bu, P3'ten ONCE de vardi; P3 gorunur kildi.

Yapilacaklar (yalniz uygulama kodu; migration yok; CHECK degismez — enum dogru kaynak):

1. `app/mesajlar/data.ts`: `export function budgetToRangeKey(min: number | null | undefined, max: number | null | undefined): BudgetRangeKey | null`
   — ikisi de bos -> `null`; deger = `max ?? min`; `<= 5000` -> `under_5k`; `<= 15000` -> `5k_15k`; `<= 30000` -> `15k_30k`;
   `<= 50000` -> `30k_50k`; ustu -> `over_50k`. Ayrica `export const BUDGET_RANGE_KEYS = BUDGET_RANGES.map(b => b.key)`
   ve `export function isBudgetRangeKey(v: unknown): v is BudgetRangeKey`.
2. `submitOffer`: `budgetRange` = `request.share_budget ? (budgetToRangeKey(request.budget_min, request.budget_max) ?? 'open') : null`.
   Paylasim acik ama tutar yoksa `open`. Mevcut sohbet UPDATE'inde `error` yakalanir: `console.error('[teklif] sohbet guncelleme', error)`;
   akis KESILMEZ (teklif yine gider) — ama hata varsa `event_id` bagini korumak icin ikinci, dar bir deneme yapilir:
   `update({ ...(request.event_id ? { event_id: request.event_id } : {}) })` (bos nesne ise deneme yapilmaz). INSERT dali
   zaten hatayi donuyor; mesaji koru.
3. `startConversation` (`mesajlar/actions.ts`): `data.budget_range` gelirse `isBudgetRangeKey` degilse `null` yazilir
   (savunma; modal zaten enum gonderiyor). UPDATE'inde `error` loglanir (`console.error('[mesaj] sohbet guncelleme', error)`).
4. Baska yerde `conversations.budget_range`'e serbest metin yazan var mi tara: `grep -rn "budget_range" app --include=*.ts --include=*.tsx`
   -> yazma noktalari yalniz `teklif-topla/actions.ts` (2) ve `mesajlar/actions.ts` (2); `rezervasyon-button.tsx` `null` yaziyor (dokunma). Raporla.
5. Sohbet cubugunda butce gosterimi (`mesajlar/[id]/page.tsx` `budgetRange`) enum etiketini `BUDGET_RANGES`'tan cozuyor mu kontrol et; cozmuyorsa dokunma, raporla.

Dogrulama:
- `npx tsc --noEmit` bos; `npm run build` -> cikti sonunda route tablosu + hata yok + `.next/BUILD_ID` var (exit kodu kanit degil).
- `grep -n "budgetToRangeKey\|isBudgetRangeKey" app -r` -> data.ts tanimi + iki action.
- Sapkali harf: dokunulan dosyalarda yeni ekleme 0.
- Canli (Guven): Test Musteri bagli etkinlikten YENI bir teklif talebi acar (butce paylasimi acik, 20000-30000); Test Pro
  teklif verir; SQL: sohbette `event_type = birthday`, `event_date = 2027-06-15`, `budget_range = 15k_30k`, `event_id` dolu.

Yapilmayacaklar: CHECK kisiti, teklif/talep formlari, mesaj metinleri degismez. Migration yok.

Rapor: degisen dosyalar, tsc/build (BUILD_ID), grep, sapma. Commit ATMA.
