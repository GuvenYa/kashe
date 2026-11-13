import { KASHE_SAAT_DILIMI } from '@/app/lib/tarih';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase-server';
import { gosterilecekAd } from '@/app/lib/kamu-adi';
import { TopNav } from '@/app/components/sections/top-nav';
import {
  formatQuoteAmount,
  formatExpiresIn,
  getQuoteStatusLabel,
} from '@/app/mesajlar/quotes-data';
import { getBriefFields, type BriefField } from '@/app/lib/brief-config';
import { etkinlikTurleri } from '@/app/lib/etkinlik-turleri';
import {
  BRIEF_ACIKLAMA_SONEKI,
  BRIEF_ESNEK_SONEKI,
  BRIEF_GIZLI_ANAHTARLAR,
  BRIEF_OZEL_ETIKETLER,
} from '@/app/lib/brief-anahtarlari';
import { getTeamContext } from '@/app/lib/business-write';
import { musteriMerkeziAcik, MERKEZ_YOLU } from '@/app/lib/musteri-merkezi';
import { talepTeklifleriniEsle } from '@/app/lib/talep-teklifleri';
import type { QuoteStatus } from '@/app/mesajlar/quotes-data';

// brief_data değerini config alanına göre insan-okur hale getir (select→label, date→tr-TR)
function formatBriefValue(field: BriefField, value: string): string {
  if (field.type === 'select') {
    return field.options?.find((o) => o.value === value)?.label ?? value;
  }
  if (field.type === 'date') {
    const d = new Date(value);
    return isNaN(d.getTime())
      ? value
      : d.toLocaleDateString('tr-TR', {
          timeZone: KASHE_SAAT_DILIMI,
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
  }
  return value;
}

// Config'te tanımı olmayan key'i insan-okur etiket yap (alt çizgi → boşluk, baş harf büyük)
// Duzeltme 11-B2: anlami bilinen anahtarlar ("hizmet", "tercih_uye_adi") TEK
// KAYNAKTAN gelir — "Hizmet" gibi yarim etiketler kalkti.
function humanizeKey(key: string): string {
  const ozel = BRIEF_OZEL_ETIKETLER[key];
  if (ozel) return ozel;
  const s = key.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const metadata = {
  title: 'Teklif Karşılaştır — Kashe',
};

/**
 * FAZ 10d: sayfanin okudugu satir sekilleri — `any` yerine GERCEK tipler.
 * Alanlar yukaridaki `select()` listeleriyle birebir; bir alan secimden
 * cikarsa TypeScript burada uyarir.
 */
type AliciSatiri = {
  id: string;
  conversation_id: string | null;
  responded_at: string | null;
  professional: {
    id: string;
    full_name: string | null;
    company_name: string | null;
    avatar_url: string | null;
    role: string;
    slug: string | null;
  } | null;
};

type TeklifSatiri = {
  id: string;
  conversation_id: string;
  total_amount: number;
  currency: string;
  services_description: string | null;
  expires_at: string;
  status: string;
  created_at: string;
  event_date: string | null;
  request_no: number | null;
};

/** Ayni sohbetlerde yanitlanmis talepler (eslestirme icin; Duzeltme 16-C). */
type YanitSatiri = {
  request_id: string;
  conversation_id: string | null;
  responded_at: string | null;
  quote_requests: { id: string; created_at: string } | null;
};

/** Teklif kartindaki durum satiri (sinif adlari TAM yazilir). */
const DURUM_NOTR =
  'font-mono text-[10px] uppercase tracking-[0.14em] mt-1 text-ink-72';
const DURUM_UYARI =
  'font-mono text-[10px] uppercase tracking-[0.14em] mt-1 text-danger';
const DURUM_OLUMLU =
  'font-mono text-[10px] uppercase tracking-[0.14em] mt-1 text-moss';

type PuanSatiri = {
  professional_id: string;
  average_rating: number | string | null;
  total_reviews: number | null;
};

export default async function TeklifKarsilastirPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/giris?redirect=/teklif-taleplerim/${id}`);

  // Kurumsal ekip bağlamı — tek sorgu (getTeamContext). teamBusinessIds = üyesi
  // olunan tüm kurumlar; üye kurum talebini görebilsin.
  const { teamBusinessIds } = await getTeamContext();

  // Talep + sahiplik/üyelik kontrolü
  const { data: request } = await supabase
    .from('quote_requests')
    .select(
      `
      id, customer_id, status, recipient_count, brief_data, created_at,
      response_deadline, share_budget,
      service_categories (name_tr, slug),
      turkish_cities (name)
    `
    )
    .eq('id', id)
    .single();

  if (!request) notFound();
  const isOwn = request.customer_id === user.id;
  const isTeam = teamBusinessIds.includes(request.customer_id);
  // Sahip ya da üyesi olunan kurumun talebi değilse → engelle
  if (!isOwn && !isTeam) redirect('/teklif-taleplerim');

  // Kurum adı (isTeam banner + read-only gösterim için)
  let ownerBusinessName = 'Kurum';
  if (isTeam) {
    const { data: bp } = await supabase
      .from('profiles')
      .select('full_name, company_name')
      .eq('id', request.customer_id)
      .single();
    ownerBusinessName = bp?.company_name || bp?.full_name || 'Kurum';
  }

  // Bu talebe teklif veren recipient'lar (quoted)
  const { data: quotedRecipients, error: recError } = await supabase
    .from('quote_request_recipients')
    .select(
      `
      id, conversation_id, responded_at,
      professional:profiles!quote_request_recipients_professional_id_fkey (
        id, full_name, company_name, avatar_url, role, slug
      )
    `
    )
    .eq('request_id', id)
    .eq('status', 'quoted');

  if (recError) console.error('[teklif-detay] alicilar', recError);

  const recipients = (quotedRecipients || []) as unknown as AliciSatiri[];

  // Her alicinin sohbetinden BU TALEBE ait teklif (Duzeltme 16-C).
  // Eskiden sohbetteki en yeni teklif gosteriliyordu; ayni profesyonel sonradan
  // baska bir talebe ya da dogrudan bir talebe teklif verdiyse bu sayfada o
  // teklif gorunuyordu (yanlis tutar ve kapsam, yanlis siralama). Eslestirme
  // merkezle ayni kuralda: app/lib/talep-teklifleri.ts.
  const conversationIds = recipients
    .map((r) => r.conversation_id)
    .filter((v): v is string => !!v);

  const quotesByConv: Record<string, TeklifSatiri> = {};
  if (conversationIds.length > 0) {
    const [{ data: quotes, error: teklifHatasi }, { data: yanitlar, error: yanitHatasi }] =
      await Promise.all([
        supabase
          .from('quotes')
          .select(
            'id, conversation_id, total_amount, currency, services_description, expires_at, status, created_at, event_date, request_no'
          )
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false }),
        // Ayni sohbetlerde yanitlanmis BUTUN talepler: bir teklif iki talebe
        // baglanmaz, bu yuzden eslestirme hepsini birlikte gorur.
        supabase
          .from('quote_request_recipients')
          .select(
            'request_id, conversation_id, responded_at, quote_requests (id, created_at)'
          )
          .in('conversation_id', conversationIds),
      ]);
    if (teklifHatasi) console.error('[teklif-detay] teklifler', teklifHatasi);
    if (yanitHatasi) console.error('[teklif-detay] yanitlar', yanitHatasi);

    const teklifListesi = (quotes || []) as TeklifSatiri[];
    const eslesme = talepTeklifleriniEsle({
      talepId: request.id,
      talepAcilis: request.created_at,
      sohbetIdleri: conversationIds,
      teklifler: teklifListesi.map((q) => ({
        id: q.id,
        conversation_id: q.conversation_id,
        total_amount: q.total_amount,
        currency: q.currency,
        status: q.status as QuoteStatus,
        created_at: q.created_at,
        expires_at: q.expires_at,
        event_date: q.event_date,
        request_no: q.request_no,
      })),
      yanitlar: ((yanitlar || []) as unknown as YanitSatiri[])
        .filter((y) => !!y.quote_requests)
        .map((y) => ({
          talepId: y.request_id,
          talepAcilis: y.quote_requests!.created_at,
          conversationId: y.conversation_id,
          respondedAt: y.responded_at,
        })),
    });
    const teklifById = new Map(teklifListesi.map((q) => [q.id, q]));
    for (const [sohbetId, teklifId] of eslesme) {
      const teklif = teklifById.get(teklifId);
      if (teklif) quotesByConv[sohbetId] = teklif;
    }
  }

  // Kabul edilip rezervasyonu IPTAL olan teklif "Onaylandi" gorunmesin
  // (merkez kartiyla ayni soz: "Iptal edildi"). Aktif bir rezervasyonu varsa
  // iptal sayilmaz (iptal sonrasi yeniden anlasma).
  const secilenTeklifIdleri = Object.values(quotesByConv).map((q) => q.id);
  const iptalTeklifler = new Set<string>();
  if (secilenTeklifIdleri.length > 0) {
    const { data: rezler, error: rezHatasi } = await supabase
      .from('bookings')
      .select('quote_id, status')
      .in('quote_id', secilenTeklifIdleri);
    if (rezHatasi) console.error('[teklif-detay] rezervasyonlar', rezHatasi);
    const aktif = new Set<string>();
    for (const r of (rezler ?? []) as { quote_id: string | null; status: string }[]) {
      if (!r.quote_id) continue;
      if (r.status === 'cancelled') iptalTeklifler.add(r.quote_id);
      else aktif.add(r.quote_id);
    }
    for (const id of aktif) iptalTeklifler.delete(id);
  }

  // Profesyonel puanlarını ayrı sorguyla çek (nested join satır eliyordu)
  const proIds = recipients
    .map((r) => r.professional?.id)
    .filter((v): v is string => !!v);
  const ratingByPro: Record<string, { avg: number; count: number }> = {};
  if (proIds.length > 0) {
    const { data: ratings } = await supabase
      .from('professional_rating_summary')
      .select('professional_id, average_rating, total_reviews')
      .in('professional_id', proIds);
    ((ratings || []) as PuanSatiri[]).forEach((r) => {
      ratingByPro[r.professional_id] = {
        avg: Number(r.average_rating),
        count: Number(r.total_reviews ?? 0),
      };
    });
  }

  // Duzeltme 15-A (bulgu 128): musteri hesabinda talepler "Etkinliklerim"de.
  const merkezeDon = await musteriMerkeziAcik();

  // Gomme alanlari TEK YERDE cozulur (ucu de ayni iki nesneyi okuyordu).
  const kategoriEmbed = request.service_categories as unknown as
    | { name_tr: string; slug: string }
    | null;
  const sehirEmbed = request.turkish_cities as unknown as {
    name: string;
  } | null;
  const categoryName = kategoriEmbed?.name_tr;
  const cityName = sehirEmbed?.name;

  // Teklifleri fiyata göre sırala (düşükten yükseğe)
  const offers = recipients
    .map((r) => ({
      recipient: r,
      quote: r.conversation_id ? quotesByConv[r.conversation_id] : null,
    }))
    .filter(
      (o): o is { recipient: AliciSatiri; quote: TeklifSatiri } => !!o.quote
    )
    .sort((a, b) => Number(a.quote.total_amount) - Number(b.quote.total_amount));

  const cheapest = offers.length > 0 ? offers[0].quote.total_amount : null;

  // Talep detayları — brief_data'yı kategori config'iyle çevir (config sırasıyla)
  const categorySlug = kategoriEmbed?.slug ?? null;
  // FAZ 10b: `event_type` secenek etiketleri tablodan (pasifler dahil) —
  // aksi halde brief satirinda ham anahtar ("wedding") gorunurdu.
  const briefFields = getBriefFields(
    categorySlug,
    await etkinlikTurleri({ hepsi: true })
  );
  const briefData = (request.brief_data ?? {}) as Record<string, string>;
  const configKeys = new Set(briefFields.map((f) => f.key));

  const briefItems: { label: string; value: string; wide: boolean }[] = [];
  // 1) Config sırasına göre (formdaki sırayla tanıdık)
  for (const f of briefFields) {
    // Duzeltme 10-E: ek anahtarlar ana alanla birlikte ("Diger" aciklamasi,
    // "Tarih henuz belli degil"); asagidaki 2. dongu bunlari ATLAR.
    const esnek = briefData[`${f.key}${BRIEF_ESNEK_SONEKI}`] as unknown;
    const aciklama = briefData[`${f.key}${BRIEF_ACIKLAMA_SONEKI}`];
    const raw = briefData[f.key];
    if (raw == null || String(raw).trim() === '') {
      if (esnek === true || esnek === '1' || esnek === 'true') {
        briefItems.push({ label: f.label, value: 'Esnek / belli değil', wide: false });
      }
      continue;
    }
    briefItems.push({
      label: f.label,
      value: formatBriefValue(f, String(raw)),
      wide: f.type === 'textarea',
    });
    if (typeof aciklama === 'string' && aciklama.trim()) {
      briefItems.push({
        label: `${f.label} açıklaması`,
        value: aciklama.trim(),
        wide: false,
      });
    }
  }
  // 2) Config'te olmayan (eski/kalkan) key'ler — kullanıcı verisi kaybolmasın
  for (const [k, v] of Object.entries(briefData)) {
    if (configKeys.has(k)) continue;
    // Ic anahtar (ham kimlik) gosterilmez — Duzeltme 11-B2.
    if (BRIEF_GIZLI_ANAHTARLAR.has(k)) continue;
    // Ek anahtarlar yukarida ana alanla yazildi.
    if (k.endsWith(BRIEF_ACIKLAMA_SONEKI) || k.endsWith(BRIEF_ESNEK_SONEKI)) {
      const ana = k.endsWith(BRIEF_ACIKLAMA_SONEKI)
        ? k.slice(0, -BRIEF_ACIKLAMA_SONEKI.length)
        : k.slice(0, -BRIEF_ESNEK_SONEKI.length);
      if (configKeys.has(ana)) continue;
    }
    if (v == null || String(v).trim() === '') continue;
    briefItems.push({
      label: humanizeKey(k),
      value: String(v),
      wide: String(v).length > 80,
    });
  }

  return (
    <>
    <TopNav />
    <div className="bg-paper min-h-screen">
      <div className="max-w-4xl mx-auto px-6 md:px-12 py-12">
        
        <Link
          href={merkezeDon ? MERKEZ_YOLU : '/teklif-taleplerim'}
          className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.1em] text-ink-72 hover:text-brand-ink mb-8 transition-colors"
        >
          <span>←</span> {merkezeDon ? 'Etkinliklerim' : 'Taleplerim'}
        </Link>

        {isTeam && (
          <div className="mb-6 bg-card border border-line rounded-lg px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72">
              Kurum: {ownerBusinessName} adına — teklifleri görüntülüyorsun
            </p>
          </div>
        )}

        <header className="mb-8">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {categoryName && (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand-ink bg-brand-ink/8 px-2 py-0.5 rounded">
                {categoryName}
              </span>
            )}
            {cityName && (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                {cityName}
              </span>
            )}
          </div>

          {/* Talep detayları — müşterinin girdiği brief (sahip + kurum üyesi aynı görür) */}
          {briefItems.length > 0 && (
            <div className="bg-card border border-line rounded-lg p-5 mb-6 mt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-4">
                Talep detayları
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {briefItems.map((item, i) => (
                  <div key={i} className={item.wide ? 'md:col-span-2' : ''}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72 mb-1">
                      {item.label}
                    </p>
                    <p className="text-sm text-ink whitespace-pre-wrap">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h1 className="font-display text-3xl text-ink leading-tight">
            Gelen teklifler{' '}
            <span className="text-ink-72">({offers.length})</span>
          </h1>
          <p className="mt-2 text-ink-72 text-sm">
            {request.recipient_count} profesyonele gönderildi, {offers.length}{' '}
            teklif geldi. En uygun teklifi seç, mesajlaşmaya devam et.
          </p>
        </header>

        {offers.length === 0 ? (
          <div className="bg-card border border-line rounded-lg p-12 text-center">
            <p className="font-display text-xl text-ink mb-2">
              Henüz teklif gelmedi
            </p>
            <p className="text-ink-72 text-sm">
              Profesyoneller talebini inceliyor. Teklif geldiğinde burada
              karşılaştırabilirsin.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {offers.map(({ recipient, quote }) => {
              const pro = recipient.professional;
              // Duzeltme 05-E: teklif veren bireysel profesyonelin adi
              // "Ad S." gorunur; rezervasyon sonrasi yuzeylerde tam ad kalir.
              const proName =
                pro?.company_name ||
                gosterilecekAd(pro?.role, pro?.full_name, false) ||
                'Profesyonel';
              const isCheapest = quote.total_amount === cheapest;
              const expired = new Date(quote.expires_at) < new Date();
              // Duzeltme 16-C: karar verilmis teklifte DURUM yazar. Eskiden
              // yalniz sure yaziyordu; reddedilen ya da onaylanan teklif de
              // "suresi doldu" gorunuyordu.
              const iptal = iptalTeklifler.has(quote.id);
              const durumMetni = iptal
                ? 'İptal edildi'
                : quote.status !== 'pending'
                  ? getQuoteStatusLabel(quote.status as QuoteStatus)
                  : expired
                    ? 'Süresi doldu'
                    : formatExpiresIn(quote.expires_at);
              const durumSinifi =
                !iptal && quote.status === 'accepted'
                  ? DURUM_OLUMLU
                  : quote.status === 'expired' ||
                      (quote.status === 'pending' && expired)
                    ? DURUM_UYARI
                    : DURUM_NOTR;

              return (
                <div
                  key={recipient.id}
                  className={`bg-card border rounded-lg p-6 ${
                    isCheapest ? 'border-moss' : 'border-line'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    {/* Sol: profesyonel */}
                    <div className="flex items-start gap-3 min-w-0">
                      {pro?.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={pro.avatar_url}
                          alt={proName}
                          className="w-12 h-12 rounded-full object-cover border border-line shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-brand-ink/10 flex items-center justify-center text-brand-ink font-display font-semibold shrink-0">
                          {proName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display text-lg text-ink">
                            {proName}
                          </h3>
                          {isCheapest && (
                            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-moss bg-moss/10 px-1.5 py-0.5 rounded">
                              En uygun
                            </span>
                          )}
                        </div>
                        {pro?.id && ratingByPro[pro.id] && ratingByPro[pro.id].count > 0 && (
                          <p className="text-xs text-ink-72 mt-0.5">
                            ★ {ratingByPro[pro.id].avg.toFixed(1)} (
                            {ratingByPro[pro.id].count} değerlendirme)
                          </p>
                        )}
                        {pro?.slug && (
                            <a
                          
                            href={`/p/${pro.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-brand-ink hover:text-ink transition-colors"
                          >
                            Profili gör →
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Sağ: fiyat */}
                    <div className="text-right shrink-0">
                      <p className="font-display text-2xl text-ink leading-none">
                        {formatQuoteAmount(
                          Number(quote.total_amount),
                          quote.currency
                        )}
                      </p>
                      <p className={durumSinifi}>{durumMetni}</p>
                    </div>
                  </div>

                  {/* Hizmet açıklaması */}
                  {quote.services_description && (
                    <p className="text-sm text-ink-72 mt-4 line-clamp-3 whitespace-pre-wrap">
                      {quote.services_description}
                    </p>
                  )}

                  {/* Aksiyon — /mesajlar artık kurum üyesini pasif gözlemci olarak kabul ediyor */}
                  <div className="mt-4 pt-4 border-t border-line">
                    <Link
                      href={`/mesajlar/${recipient.conversation_id}`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink text-paper rounded-lg font-mono text-[11px] uppercase tracking-[0.1em] hover:bg-ink/90 transition"
                    >
                      Teklifi incele &amp; mesajlaş →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </>
  );
}