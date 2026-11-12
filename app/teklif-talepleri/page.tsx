import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { PanelKabugu, PanelBaslik } from '@/app/components/panel';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
import { TalepKartiAksiyonlari } from './talep-karti-aksiyonlari';
import { getCachedUser } from '@/app/lib/auth';
import { talepButceleri } from '@/app/lib/talep-butcesi';
import { BriefEkButonu } from './brief-ek-butonu';
import { getBriefFields } from '@/app/lib/brief-config';
import { tarihMetni } from '@/app/lib/tarih';
import { formatPrice } from '@/app/lib/profile-helpers';
import { etiketle } from '@/app/lib/etkinlik-turu';
import { etkinlikTurleri, type EtkinlikTuru } from '@/app/lib/etkinlik-turleri';
import {
  BRIEF_ACIKLAMA_SONEKI,
  BRIEF_ESNEK_SONEKI,
  BRIEF_GIZLI_ANAHTARLAR,
  BRIEF_OZEL_ETIKETLER,
} from '@/app/lib/brief-anahtarlari';

export const metadata = {
  title: 'Teklif Talepleri — Kashe',
};

type BriefSatiri = { key: string; label: string; value: string };

/**
 * Ham `brief_data`'yi kategorinin brief tanimiyla eslestirir.
 *
 * Eskiden `Object.entries` ile YALNIZ deger basiliyordu ("birthday", "2027-06-15",
 * "fashion") — kullanici neye baktigini anlamiyordu. Artik anahtar alan ETIKETINE,
 * deger de secenek etiketine cevrilir. Tanimda olmayan anahtar ATLANIR; tarih ve
 * sayi alanlari Kashe bicimine girer.
 */
function briefSatirlari(
  brief: Record<string, string>,
  categorySlug: string | null,
  turler: EtkinlikTuru[]
): BriefSatiri[] {
  // FAZ 10b: `event_type` alaninin secenekleri calisma zamaninda dolar.
  const alanlar = getBriefFields(categorySlug, turler);
  const satirlar: BriefSatiri[] = [];

  for (const alan of alanlar) {
    // Duzeltme 10-E: ek anahtarlar ana alanla birlikte okunur ("Diger"
    // aciklamasi, "Tarih henuz belli degil"); ham anahtar arayuze dusmez.
    const esnek = brief[`${alan.key}${BRIEF_ESNEK_SONEKI}`] as unknown;
    const aciklama = brief[`${alan.key}${BRIEF_ACIKLAMA_SONEKI}`];
    const ham = brief[alan.key];
    if (ham === undefined || ham === null || String(ham).trim() === '') {
      if (esnek === true || esnek === '1' || esnek === 'true') {
        satirlar.push({ key: alan.key, label: alan.label, value: 'Esnek / belli değil' });
      }
      continue;
    }
    const metin = String(ham);

    let deger = metin;
    if (alan.options?.length) {
      const esles = alan.options.find((o) => o.value === metin)?.label;
      // Secenek listesinde yoksa etkinlik turu sozlugune bak: kategori
      // tanimlari zaman icinde ayrisabiliyor ('birthday' bir kategoride var,
      // otekinde yok) — ham ingilizce anahtar arayuze dusmesin.
      deger = esles ?? etiketle(turler, metin) ?? metin;
    } else if (alan.type === 'date') {
      deger = tarihMetni(metin) ?? metin;
    }
    satirlar.push({ key: alan.key, label: alan.label, value: deger });
    if (typeof aciklama === 'string' && aciklama.trim()) {
      satirlar.push({
        key: `${alan.key}${BRIEF_ACIKLAMA_SONEKI}`,
        label: `${alan.label} açıklaması`,
        value: aciklama.trim(),
      });
    }
  }

  /**
   * Duzeltme 11-B2: alan tanimi OLMAYAN ama anlami bilinen anahtarlar
   * ("Seçilen hizmet", "Tercih edilen ekip üyesi") sonda listelenir —
   * eskiden bu yuzeyde HIC gorunmuyordu. Ham kimlik (`tercih_uye`)
   * `BRIEF_OZEL_ETIKETLER`de olmadigi icin zaten dusuyor.
   */
  for (const [anahtar, etiket] of Object.entries(BRIEF_OZEL_ETIKETLER)) {
    if (BRIEF_GIZLI_ANAHTARLAR.has(anahtar)) continue;
    const ham = brief[anahtar];
    if (ham == null || String(ham).trim() === '') continue;
    satirlar.push({ key: anahtar, label: etiket, value: String(ham).trim() });
  }
  return satirlar;
}

/** Butce araligi formatPrice ile; tek sinir varsa tek deger yazilir. */
function butceMetni(
  min: number | null | undefined,
  max: number | null | undefined
): string | null {
  const a = min != null ? formatPrice(min) : '';
  const b = max != null ? formatPrice(max) : '';
  if (a && b) return a === b ? a : `${a} – ${b}`;
  return a || b || null;
}

/**
 * FAZ 10d: sayfanin okudugu satir sekli — `any` yerine gercek tip.
 * Alanlar asagidaki `select()` listesiyle birebir.
 */
type TalepAlicisi = {
  id: string;
  status: string;
  conversation_id: string | null;
  created_at: string;
  quote_requests: {
    id: string;
    brief_data: Record<string, unknown> | null;
    event_date: string | null;
    event_type: string | null;
    // Guvenlik 04: butce select'te yok; paylasilan talepler icin RPC ile doldurulur.
    budget_min: number | null;
    budget_max: number | null;
    share_budget: boolean;
    response_deadline: string | null;
    status: string;
    attachment_path: string | null;
    attachment_name: string | null;
    attachment_type: string | null;
    service_categories: { name_tr: string; slug: string } | null;
    turkish_cities: { name: string } | null;
    customer: {
      full_name: string | null;
      company_name: string | null;
      role: string;
    } | null;
  } | null;
};

export default async function TeklifTalepleriPage() {
  const supabase = await createClient();
  // FAZ 10b: etkinlik turu etiketleri `event_types` tablosundan
  // (pasif turler dahil; onbellekli tek okuma).
  const turler = await etkinlikTurleri({ hepsi: true });

  const user = await getCachedUser();
  if (!user) redirect('/giris?redirect=/teklif-talepleri');

  // Rol + suspension kontrolü — sadece professional/agency
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, suspended_at')
    .eq('id', user.id)
    .single();

  // Suspension kontrolü
  if (profile?.suspended_at) return <SuspendedNotice />;

  if (profile?.role !== 'professional' && profile?.role !== 'agency') {
    redirect('/profil');
  }

  // Bana gelen recipient kayıtları + talep + müşteri bilgisi
  const { data: recipients } = await supabase
    .from('quote_request_recipients')
    .select(
      `
      id, status, conversation_id, created_at,
      quote_requests (
        id, brief_data, event_date, event_type,
        share_budget, response_deadline, status,
        attachment_path, attachment_name, attachment_type,
        service_categories (name_tr, slug),
        turkish_cities (name),
        customer:profiles!quote_requests_customer_id_fkey (full_name, company_name, role)
      )
    `
    )
    .eq('professional_id', user.id)
    .order('created_at', { ascending: false });

  // Gomme alanlari supabase tipinde dizi gorunuyor (tek satir donuyor):
  // iki adimli donusum repo deseni.
  const list = ((recipients || []) as unknown as TalepAlicisi[]).filter(
    (r): r is TalepAlicisi & { quote_requests: NonNullable<TalepAlicisi['quote_requests']> } =>
      !!r.quote_requests
  );

  // Guvenlik 04 (bulgu 104): butce tablodan okunmaz; yalniz musterinin
  // paylastigi talepler icin RPC ile alinir (paylasilmayan butce bos kalir).
  const butceler = await talepButceleri(
    supabase,
    list.filter((r) => r.quote_requests.share_budget).map((r) => r.quote_requests.id)
  );
  for (const r of list) {
    const b = butceler.get(r.quote_requests.id);
    r.quote_requests.budget_min = b?.budget_min ?? null;
    r.quote_requests.budget_max = b?.budget_max ?? null;
  }

  // Bekleyen (sent/viewed) sayısı
  const pendingCount = list.filter(
    (r) => r.status === 'sent' || r.status === 'viewed'
  ).length;

  // D1b-2: calisma sayfasi panel kabugunda; menu ve hesap karti tek
  // yerden (app/lib/panel-kabuk.ts).
  const kabuk = await panelKabukProps();

  return (
    <PanelKabugu {...kabuk}>
      <div className="max-w-3xl">
        <PanelBaslik
          eyebrow="Teklif Talepleri"
          altNot={
            <>
              {pendingCount > 0
              ? `${pendingCount} talep yanıtını bekliyor. Teklif ver, müşteriyle mesajlaşma açılsın.`
              : 'Müşterilerin sana özel gönderdiği talepler burada görünür.'}
            </>
          }
        >
          Sana gelen{' '}
          <em className="not-italic font-medium text-brand-accent">
          teklif talepleri
          </em>
        </PanelBaslik>

        {list.length === 0 ? (
          <div className="bg-card border border-line rounded-lg p-12 text-center">
            <p className="font-display text-xl text-ink mb-2">
              Henüz teklif talebin yok
            </p>
            <p className="text-ink-72 text-sm">
              Profilin yayında ve onaylıysa, sana uygun talepler buraya düşer.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {list.map((r) => {
              const req = r.quote_requests;
              const customer = req.customer;
              const customerName =
                customer?.company_name || customer?.full_name || 'Müşteri';
              const categoryName = req.service_categories?.name_tr;
              const cityName = req.turkish_cities?.name;
              // Brief alanlari kategorinin tanimindan okunur: anahtar -> etiket,
              // deger -> secenek etiketi. Tanimda olmayan anahtar atlanir (ham
              // "event_type: birthday" gibi satirlar arayuze dusmesin).
              const brief = (req.brief_data || {}) as Record<string, string>;
              const briefEntries = briefSatirlari(
                brief,
                req.service_categories?.slug ?? null,
                turler
              ).slice(0, 4);

              const budget =
                req.share_budget && (req.budget_min || req.budget_max)
                  ? butceMetni(req.budget_min, req.budget_max)
                  : null;

              return (
                <div
                  key={r.id}
                  className="bg-card border border-line rounded-lg p-6"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
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
                        {r.status === 'sent' && (
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand-ink">
                            • Yeni
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-lg text-ink">
                        {customerName}
                      </h3>
                    </div>
                    {budget && (
                      <span className="font-mono text-[11px] text-ink-72">
                        Bütçe: {budget}
                      </span>
                    )}
                  </div>

                  {/* Brief özeti */}
                  {briefEntries.length > 0 && (
                    <div className="bg-paper rounded-lg p-3 mb-3 space-y-1">
                      {briefEntries.map((satir) => (
                        <p key={satir.key} className="text-sm text-ink-72">
                          {satir.label}: <span className="text-ink">{satir.value}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Müşterinin eklediği dosya */}
                  {req.attachment_path && (
                    <BriefEkButonu
                      requestId={req.id}
                      attachmentName={req.attachment_name}
                      attachmentType={req.attachment_type}
                    />
                  )}

                  <div className="pt-3 border-t border-line">
                    <TalepKartiAksiyonlari
                      recipientId={r.id}
                      customerName={customerName}
                      alreadyResponded={
                        r.status === 'quoted' || r.status === 'declined'
                      }
                      conversationId={r.conversation_id}
                      status={r.status}
                      budgetMax={req.share_budget ? req.budget_max : null}
                      shareBudget={!!req.share_budget}
                      responseDeadline={req.response_deadline}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PanelKabugu>
  );
}