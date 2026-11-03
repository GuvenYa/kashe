import { KASHE_SAAT_DILIMI } from '@/app/lib/tarih';
import { createClient } from '@/app/lib/supabase-server';
import { redirect } from 'next/navigation';
import { PanelKabugu, PanelBaslik } from '@/app/components/panel';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
import { getCachedUser } from '@/app/lib/auth';
import { calcCommission, formatTRY, COMMISSION_RATE } from '@/app/lib/premium';
import { etkinlikTuruEtiketi } from '@/app/lib/etkinlik-turu';

export const metadata = {
  title: 'Kazançlarım — Kashe',
};

/**
 * Kazanc satiri — IKI REZERVASYON SEKLI (CLAUDE.md FAZ 7c; A8).
 *
 * Teklif sekli (`proposal_version_id` dolu) `professional_id` TASIMAZ;
 * satici `seller_provider_id`de. O satirlarda tutar KDV DAHIL toplamdir ve
 * platform ucreti YOKTUR (Kashe teklif dosyasindan komisyon almiyor) — ucret
 * `satirUcreti` icinde acikca ayrilir, `calcCommission` oraya uygulanmaz.
 */
type BookingRow = {
  id: string;
  customer_id: string | null;
  /** A8: teklif dosyasindan dogan rezervasyon mu. */
  teklifSekli?: boolean;
  /** A8: teklif seklinde karsi tarafin adi. */
  karsiTarafAdi?: string | null;
  event_type: string | null;
  event_date: string | null;
  total_amount: number | null;
  status: string;
  completed_at: string | null;
  created_at: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('tr-TR', {
    timeZone: KASHE_SAAT_DILIMI,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default async function KazanclarimPage() {
  const supabase = await createClient();

  const user = await getCachedUser();

  if (!user) {
    redirect('/giris?redirect=/kazanclarim');
  }

  // Rol + suspension kontrolü — kazançlarım sadece profesyonel/ajans için
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, suspended_at')
    .eq('id', user.id)
    .single();

  if (profile?.suspended_at) {
    redirect('/askiya-alindi');
  }

  const isProvider =
    profile?.role === 'professional' || profile?.role === 'agency';

  // Bu sağlayıcının rezervasyonları
  const { data: bookingsData } = await supabase
    .from('bookings')
    .select(
      'id, customer_id, event_type, event_date, total_amount, status, completed_at, created_at'
    )
    .eq('professional_id', user.id)
    .order('event_date', { ascending: false });

  /**
   * A8 — TEKLIF SEKLI rezervasyonlar. `providers.id = profiles.id` (FAZ 2a)
   * oldugu icin kurulus sahibinin saglayici kimligi kendi kullanici kimligi;
   * kisisel kazanc sayfasi bu kapsamda dogru.
   */
  const { data: teklifData, error: teklifHatasi } = await supabase
    .from('bookings')
    .select(
      `
      id, customer_id, event_type, event_date, total_amount, status,
      completed_at, created_at,
      alici:organizations_public!bookings_buyer_organization_id_fkey (
        display_name
      ),
      surum:proposal_versions!bookings_proposal_version_id_fkey (
        proposal:proposals!proposal_versions_proposal_id_fkey (
          client_name
        )
      )
    `
    )
    .eq('seller_provider_id', user.id)
    .order('event_date', { ascending: false });
  if (teklifHatasi) console.error('[kazanclar] teklif sekli', teklifHatasi);

  type TeklifSatiri = BookingRow & {
    alici: { display_name: string | null } | null;
    surum: { proposal: { client_name: string | null } | null } | null;
  };

  const teklifSatirlari: BookingRow[] = (
    (teklifData ?? []) as unknown as TeklifSatiri[]
  ).map((t) => ({
    ...t,
    teklifSekli: true,
    karsiTarafAdi:
      t.surum?.proposal?.client_name?.trim() ||
      t.alici?.display_name?.trim() ||
      null,
  }));

  const bookings = [
    ...((bookingsData ?? []) as BookingRow[]),
    ...teklifSatirlari,
  ];

  /**
   * Satir basina brut / platform ucreti / net.
   *
   * Eski sekilde komisyon `calcCommission` ile; teklif seklinde ucret 0
   * (tutar zaten KDV dahil ve tahsilat ajansin kendi akisinda).
   */
  function satirUcreti(b: BookingRow) {
    const brut = b.total_amount ?? 0;
    if (b.teklifSekli) return { gross: brut, commission: 0, net: brut };
    return calcCommission(brut);
  }

  const completed = bookings.filter((b) => b.status === 'completed');
  const onayli = bookings.filter((b) => b.status === 'confirmed');
  // Tarihi gecmis ama tamamlanmamis kayitlar "Yaklasan" basligi altinda yaniltiyordu.
  // Olcut etkinlik gunu: bugunden ONCEyse gecmis kumesine gider (tarihsizler yaklasanda).
  const bugunGun = new Intl.DateTimeFormat('en-CA', {
    timeZone: KASHE_SAAT_DILIMI,
  }).format(new Date());
  const gecmisKalan = onayli.filter(
    (b) => !!b.event_date && b.event_date.slice(0, 10) < bugunGun
  );
  const upcoming = onayli.filter((b) => !gecmisKalan.includes(b));

  // Müşteri isimleri (toplu çek)
  const customerIds = Array.from(
    new Set(
      bookings
        .map((b) => b.customer_id)
        .filter((v): v is string => !!v)
    )
  );
  const customerMap = new Map<string, string>();
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('profiles')
      .select('id, full_name, company_name, role')
      .in('id', customerIds);
    (customers ?? []).forEach((c) => {
      const name =
        (c.role === 'business' || c.role === 'agency') && c.company_name
          ? c.company_name
          : c.full_name || 'Müşteri';
      customerMap.set(c.id, name);
    });
  }

  // Toplam ozet (yalniz completed = gerceklesmis kazanc). Ucret SATIR BASINA
  // hesaplanir: teklif sekli komisyonsuzdur, toplama 0 katar.
  const summary = completed.reduce(
    (t, b) => {
      const u = satirUcreti(b);
      return {
        gross: t.gross + u.gross,
        commission: t.commission + u.commission,
        net: t.net + u.net,
      };
    },
    { gross: 0, commission: 0, net: 0 }
  );

  // Beklenen (confirmed) brüt
  const upcomingGross = upcoming.reduce(
    (sum, b) => sum + (b.total_amount ?? 0),
    0
  );

  // D1b-2: calisma sayfasi panel kabugunda; menu ve hesap karti tek
  // yerden (app/lib/panel-kabuk.ts).
  const kabuk = await panelKabukProps();

  return (
    <PanelKabugu {...kabuk}>
      <div className="max-w-5xl">
          {/* Header */}
          <PanelBaslik
            eyebrow="Kazançlarım"
            altNot={
              <>
                Tamamlanan rezervasyonlardan elde ettiğin gelir. Platform
                komisyonu %{Math.round(COMMISSION_RATE * 100)} olarak hesaplanır.
              </>
            }
          >
            Kazançlarım
          </PanelBaslik>

          {!isProvider ? (
            <div className="bg-card border border-line rounded-2xl p-8 text-center">
              <p className="text-ink-72">
                Kazançlar yalnızca hizmet veren profesyonel ve ajans hesapları
                için görüntülenir.
              </p>
            </div>
          ) : (
            <>
              {/* Komisyon bilgi notu */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
                <p className="text-sm text-amber-800 leading-relaxed">
                  Ödeme sistemi (iyzico) entegrasyonu tamamlandığında ödemeler
                  otomatik tahsil edilip komisyon kesintisiyle hesabına
                  aktarılacaktır. Aşağıdaki tutarlar bilgilendirme amaçlıdır.
                </p>
              </div>

              {/* Özet kartları */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                <div className="bg-card border border-line rounded-2xl p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 mb-1.5">
                    Toplam brüt
                  </p>
                  <p className="font-display text-3xl text-ink tabular-nums leading-none">
                    {formatTRY(summary.gross)}
                  </p>
                </div>
                <div className="bg-card border border-line rounded-2xl p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 mb-1.5">
                    Komisyon (%{Math.round(COMMISSION_RATE * 100)})
                  </p>
                  <p className="font-display text-3xl text-brand-ink-deep tabular-nums leading-none">
                    −{formatTRY(summary.commission)}
                  </p>
                </div>
                <div className="bg-[#F0F7F0] border border-moss/30 rounded-2xl p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-moss mb-1.5">
                    Net kazanç
                  </p>
                  <p className="font-display text-3xl text-moss tabular-nums leading-none">
                    {formatTRY(summary.net)}
                  </p>
                </div>
              </div>

              {/* Tamamlanan rezervasyonlar */}
              <div className="mb-10">
                <h2 className="font-display font-medium text-xl text-ink mb-4">
                  Tamamlanan işler ({completed.length})
                </h2>
                {completed.length === 0 ? (
                  <div className="bg-card border border-line rounded-2xl p-8 text-center">
                    <p className="text-ink-72">
                      Henüz tamamlanmış rezervasyonun yok. İşler tamamlandıkça
                      kazançların burada görünecek.
                    </p>
                  </div>
                ) : (
                  <div className="bg-card border border-line rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-paper-2/50 border-b border-line">
                          <tr>
                            <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50">
                              Müşteri / Etkinlik
                            </th>
                            <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50 whitespace-nowrap">
                              Tarih
                            </th>
                            <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50">
                              Brüt
                            </th>
                            <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50">
                              Komisyon
                            </th>
                            <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-50">
                              Net
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {completed.map((b) => {
                            const c = satirUcreti(b);
                            return (
                              <tr key={b.id} className="hover:bg-paper-2/30">
                                <td className="px-4 py-3">
                                  <p className="text-sm text-ink font-medium">
                                    {b.teklifSekli
                                      ? b.karsiTarafAdi || 'Müşteri'
                                      : (b.customer_id &&
                                          customerMap.get(b.customer_id)) ||
                                        'Müşteri'}
                                  </p>
                                  {b.teklifSekli && (
                                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
                                      Teklif dosyası
                                    </p>
                                  )}
                                  {b.event_type && (
                                    <p className="text-[12px] text-ink-50">
                                      {etkinlikTuruEtiketi(b.event_type)}
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-[12px] text-ink-72 font-mono whitespace-nowrap">
                                  {formatDate(b.event_date)}
                                </td>
                                <td className="px-4 py-3 text-right text-sm text-ink tabular-nums whitespace-nowrap">
                                  {formatTRY(c.gross)}
                                </td>
                                <td className="px-4 py-3 text-right text-sm text-brand-ink-deep tabular-nums whitespace-nowrap">
                                  −{formatTRY(c.commission)}
                                </td>
                                <td className="px-4 py-3 text-right text-sm font-semibold text-moss tabular-nums whitespace-nowrap">
                                  {formatTRY(c.net)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Tarihi gecmis ama tamamlanmamis (confirmed) */}
              {gecmisKalan.length > 0 && (
                <div>
                  <h2 className="font-display font-medium text-xl text-ink mb-1">
                    Tarihi geçmiş, tamamlanmamış ({gecmisKalan.length})
                  </h2>
                  <p className="text-sm text-ink-72 mb-4">
                    Rezervasyon sayfasından tamamla.
                  </p>
                  <div className="bg-card border border-line rounded-2xl overflow-hidden">
                    <div className="divide-y divide-line">
                      {gecmisKalan.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-ink font-medium truncate">
                              {b.teklifSekli
                                ? b.karsiTarafAdi || 'Müşteri'
                                : (b.customer_id &&
                                    customerMap.get(b.customer_id)) ||
                                  'Müşteri'}
                            </p>
                            <p className="text-[12px] text-ink-50">
                              {etkinlikTuruEtiketi(b.event_type) ?? 'Etkinlik'} ·{' '}
                              {formatDate(b.event_date)}
                            </p>
                          </div>
                          <p className="text-sm text-ink tabular-nums whitespace-nowrap shrink-0">
                            {formatTRY(b.total_amount ?? 0)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Yaklaşan (confirmed) */}
              {upcoming.length > 0 && (
                <div>
                  <h2 className="font-display font-medium text-xl text-ink mb-1">
                    Yaklaşan işler ({upcoming.length})
                  </h2>
                  <p className="text-sm text-ink-72 mb-4">
                    Onaylı ama henüz tamamlanmamış rezervasyonlar. Beklenen brüt:{' '}
                    <span className="font-semibold text-ink">
                      {formatTRY(upcomingGross)}
                    </span>
                  </p>
                  <div className="bg-card border border-line rounded-2xl overflow-hidden">
                    <div className="divide-y divide-line">
                      {upcoming.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-ink font-medium truncate">
                              {b.teklifSekli
                                ? b.karsiTarafAdi || 'Müşteri'
                                : (b.customer_id &&
                                    customerMap.get(b.customer_id)) ||
                                  'Müşteri'}
                            </p>
                            <p className="text-[12px] text-ink-50">
                              {etkinlikTuruEtiketi(b.event_type) ?? 'Etkinlik'} ·{' '}
                              {formatDate(b.event_date)}
                            </p>
                          </div>
                          <p className="text-sm text-ink tabular-nums whitespace-nowrap shrink-0">
                            {formatTRY(b.total_amount ?? 0)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
    </PanelKabugu>
  );
}