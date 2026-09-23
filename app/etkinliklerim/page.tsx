import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { TopNav } from '@/app/components/sections/top-nav';
import { getCachedUser } from '@/app/lib/auth';
import { createClient } from '@/app/lib/supabase-server';

export const metadata = {
  title: 'Etkinliklerim — Kashe',
};

/** `event_status` enum'unun tamami (7 deger). */
const DURUM_ETIKETLERI: Record<string, string> = {
  draft: 'Taslak',
  confirmed: 'Onaylandı',
  matching: 'Eşleştiriliyor',
  booked: 'Rezerve',
  running: 'Devam ediyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
};

type EtkinlikSatiri = {
  id: string;
  title: string | null;
  event_type: string;
  start_date: string | null;
  end_date: string | null;
  is_date_flexible: boolean;
  city_id: number | null;
  participant_count: number | null;
  status: string;
  confirmed_at: string | null;
  created_at: string;
  event_types: { name_tr: string } | null;
  turkish_cities: { name: string } | null;
  event_requirements: { id: string }[] | null;
};

function tarihMetni(satir: EtkinlikSatiri): string {
  if (!satir.start_date) return satir.is_date_flexible ? 'Tarih esnek' : 'Tarih belirtilmedi';
  const bicim = (g: string) =>
    new Date(g + 'T00:00:00Z').toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const bas = bicim(satir.start_date);
  const son = satir.end_date ? ` → ${bicim(satir.end_date)}` : '';
  return bas + son;
}

export default async function EtkinliklerimPage() {
  const supabase = await createClient();

  const user = await getCachedUser();
  if (!user) redirect('/giris?redirect=/etkinliklerim');

  // Suspension kontrolü — askıdaki kullanıcı etkinliklerini göremez
  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  // RLS: kendi etkinlikleri + kurulus events.view + admin
  const { data: events } = await supabase
    .from('events')
    .select(
      `
      id, title, event_type, start_date, end_date, is_date_flexible, city_id,
      participant_count, status, confirmed_at, created_at,
      event_types (name_tr),
      turkish_cities (name),
      event_requirements (id)
    `
    )
    .order('start_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  const liste = (events ?? []) as unknown as EtkinlikSatiri[];

  return (
    <>
      <TopNav />
      <div className="bg-paper min-h-screen">
        <div className="max-w-3xl mx-auto px-6 md:px-12 py-12">
          <div className="flex items-start justify-between gap-4 mb-10 flex-wrap">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-2">
                Etkinliklerim
              </p>
              <h1 className="font-display text-4xl text-ink leading-tight">
                <em className="text-brand-ink not-italic italic font-medium">
                  Planladığın
                </em>{' '}
                etkinlikler
              </h1>
              <p className="mt-2 text-ink-72 text-sm">
                Onayladığın etkinlikler ve ihtiyaç listeleri.
              </p>
            </div>
            <Link
              href="/etkinlik-sihirbazi"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all whitespace-nowrap"
            >
              <span className="text-base leading-none">+</span>
              Yeni etkinlik
            </Link>
          </div>

          {liste.length === 0 ? (
            <div className="bg-card border border-line rounded-lg p-12 text-center">
              <p className="font-display text-xl text-ink mb-2">
                Henüz etkinlik yok
              </p>
              <p className="text-ink-72 text-sm mb-6">
                Etkinliğini anlat ya da adım adım kur; ihtiyaç listesi hazır
                gelsin.
              </p>
              <Link
                href="/etkinlik-sihirbazi"
                className="inline-block px-6 py-3 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-ink)] transition-all"
              >
                Etkinlik sihirbazı ile oluştur
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {liste.map((e) => {
                const turAdi = e.event_types?.name_tr ?? e.event_type;
                const sehirAdi = e.turkish_cities?.name ?? null;
                const rolSayisi = (e.event_requirements ?? []).length;
                const gosterilenBaslik =
                  e.title ||
                  [turAdi, sehirAdi].filter(Boolean).join(' · ') ||
                  turAdi;
                return (
                  <Link
                    key={e.id}
                    href={`/etkinliklerim/${e.id}`}
                    className="block bg-card border border-line rounded-lg p-6 hover:border-brand-ink hover:shadow-[4px_4px_0_var(--color-brand-ink)] transition-all"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand-ink bg-brand-ink/8 px-2 py-0.5 rounded">
                            {turAdi}
                          </span>
                          {sehirAdi && (
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                              {sehirAdi}
                            </span>
                          )}
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                            {DURUM_ETIKETLERI[e.status] ?? e.status}
                          </span>
                          {e.is_date_flexible && (
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                              esnek
                            </span>
                          )}
                        </div>
                        <p className="font-display font-semibold text-lg text-ink mb-1">
                          {gosterilenBaslik}
                        </p>
                        <p className="text-sm text-ink-72">
                          {[
                            tarihMetni(e),
                            e.participant_count
                              ? `${e.participant_count} kişi`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-display text-3xl text-ink leading-none">
                          {rolSayisi}
                        </p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mt-1">
                          ihtiyaç
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
