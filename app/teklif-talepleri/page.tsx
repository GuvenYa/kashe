import { redirect } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { PanelKabugu } from '@/app/components/panel';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
import { TalepKartiAksiyonlari } from './talep-karti-aksiyonlari';
import { getCachedUser } from '@/app/lib/auth';
import { BriefEkButonu } from './brief-ek-butonu';
import { getBriefFields } from '@/app/lib/brief-config';
import { tarihMetni } from '@/app/lib/tarih';
import { formatPrice } from '@/app/lib/profile-helpers';
import { etkinlikTuruEtiketi } from '@/app/lib/etkinlik-turu';

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
  categorySlug: string | null
): BriefSatiri[] {
  const alanlar = getBriefFields(categorySlug);
  const satirlar: BriefSatiri[] = [];

  for (const alan of alanlar) {
    const ham = brief[alan.key];
    if (ham === undefined || ham === null || String(ham).trim() === '') continue;
    const metin = String(ham);

    let deger = metin;
    if (alan.options?.length) {
      const esles = alan.options.find((o) => o.value === metin)?.label;
      // Secenek listesinde yoksa etkinlik turu sozlugune bak: kategori
      // tanimlari zaman icinde ayrisabiliyor ('birthday' bir kategoride var,
      // otekinde yok) — ham ingilizce anahtar arayuze dusmesin.
      deger = esles ?? etkinlikTuruEtiketi(metin) ?? metin;
    } else if (alan.type === 'date') {
      deger = tarihMetni(metin) ?? metin;
    }
    satirlar.push({ key: alan.key, label: alan.label, value: deger });
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

export default async function TeklifTalepleriPage() {
  const supabase = await createClient();

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
        id, brief_data, event_date, event_type, budget_min, budget_max,
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

  const list = (recipients || []).filter((r: any) => r.quote_requests);

  // Bekleyen (sent/viewed) sayısı
  const pendingCount = list.filter(
    (r: any) => r.status === 'sent' || r.status === 'viewed'
  ).length;

  // D1b-2: calisma sayfasi panel kabugunda; menu ve hesap karti tek
  // yerden (app/lib/panel-kabuk.ts).
  const kabuk = await panelKabukProps();

  return (
    <PanelKabugu {...kabuk}>
      <div className="max-w-3xl">
        <header className="mb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
            Teklif Talepleri
          </p>
          <h1 className="font-display text-4xl text-ink leading-tight">
            Sana gelen{' '}
            <em className="not-italic font-medium text-brand-accent">
              teklif talepleri
            </em>
          </h1>
          <p className="mt-3 text-ink-72 text-base">
            {pendingCount > 0
              ? `${pendingCount} talep yanıtını bekliyor. Teklif ver, müşteriyle mesajlaşma açılsın.`
              : 'Müşterilerin sana özel gönderdiği talepler burada görünür.'}
          </p>
        </header>

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
            {list.map((r: any) => {
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
                req.service_categories?.slug ?? null
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