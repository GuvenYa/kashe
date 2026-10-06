import { notFound } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { PortalIslemleri } from './portal-islemleri';
import {
  JETON_KALIBI,
  kdvYuzdesi,
  paraMetni,
  portalDurumMesaji,
  suresiDoldu,
  tarihMetni,
  zamanMetni,
  type PortalTeklif,
} from './portal-data';

/**
 * FAZ 7a / P2 — misafir portali: teklif gorunumu.
 *
 * Portal AYRI YUZEY (02 bolum 6): bu sayfa YALNIZ `portal_proposal_view`
 * RPC'sini cagirir. `proposals`/`proposal_versions`/`proposal_items`/
 * `portal_access_links` tablolarina sorgu YOK, `internal` YOK, yetki
 * fonksiyonu YOK; oturum gerekmez (RPC SECURITY DEFINER, anon'a acik).
 *
 * Jeton yalniz URL'den gelir ve yalniz RPC'ye verilir; loglanmaz.
 * `force-dynamic`: her acilis goruntuleme sayar (onbellek yok).
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Teklif — Kashe',
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};

function DurumSayfasi({ mesaj }: { mesaj: string }) {
  return (
    <div className="max-w-xl mx-auto text-center py-10">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72 mb-3">
        Teklif bağlantısı
      </p>
      <h1 className="font-display text-2xl md:text-3xl text-ink leading-tight">
        {mesaj}
      </h1>
      <p className="mt-4 text-sm text-ink-72">
        Sorun sürerse teklifi gönderen kuruluşla iletişime geç.
      </p>
    </div>
  );
}

export default async function PortalTeklifPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // Jeton bicimi yanlissa RPC'ye hic gitmez.
  if (!JETON_KALIBI.test(token)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('portal_proposal_view', {
    p_token: token,
  });

  if (error) {
    // Jeton loglanmaz: yalniz kod ve mesaj.
    console.error('[portal] gorunum', error.code, error.message);
    return <DurumSayfasi mesaj={portalDurumMesaji(error)} />;
  }
  if (!data) {
    return <DurumSayfasi mesaj="Teklif şu an görüntülenemiyor, tekrar dene." />;
  }

  const teklif = data as unknown as PortalTeklif;
  const scope = teklif.scope ?? [];
  const islemDurumu = teklif.status === 'sent' || teklif.status === 'viewed';
  const gecerlilikGecti = suresiDoldu(teklif.valid_until);
  const toplamMetni = paraMetni(teklif.total_amount, teklif.currency);
  const gecerlilikMetni = tarihMetni(teklif.valid_until);

  const etkinlikSatiri = teklif.event
    ? [
        teklif.event.title,
        teklif.event.event_type,
        teklif.event.start_date ? tarihMetni(teklif.event.start_date) : null,
        teklif.event.city,
        teklif.event.participant_count
          ? `${teklif.event.participant_count} kişi`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Ust blok */}
      <header className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brand-ink mb-2">
          {teklif.seller_name?.trim() || 'Kashe kuruluşu'} · teklif
        </p>
        {teklif.client_name && (
          <p className="text-sm text-ink-72 mb-2">
            Sayın {teklif.client_name},
          </p>
        )}
        <h1 className="font-display text-3xl md:text-4xl text-ink leading-tight">
          {teklif.title}
        </h1>
        <p className="text-sm text-ink-72 mt-2">
          Sürüm {teklif.version_no}
          {teklif.sent_at ? ` · gönderim ${zamanMetni(teklif.sent_at)}` : ''}
        </p>
        {etkinlikSatiri && (
          <p className="text-sm text-ink-72 mt-1">{etkinlikSatiri}</p>
        )}
      </header>

      {/* Durum bandi */}
      {teklif.status === 'approved' && (
        <div className="mb-6 px-4 py-3 bg-moss/10 border border-moss/40 rounded-lg">
          <p className="text-sm text-ink">
            Onaylandı
            {teklif.approved_by_name ? ` · ${teklif.approved_by_name}` : ''}
            {teklif.approved_at ? ` · ${zamanMetni(teklif.approved_at)}` : ''}
          </p>
        </div>
      )}
      {teklif.status === 'revision_requested' && (
        <div className="mb-6 px-4 py-3 bg-amber-500/10 border border-amber-500/40 rounded-lg">
          <p className="text-sm text-ink">
            Revizyon talebin iletildi
            {teklif.client_note ? `: ${teklif.client_note}` : '.'}
          </p>
        </div>
      )}
      {teklif.status === 'expired' && (
        <div className="mb-6 px-4 py-3 bg-paper-2 border border-line rounded-lg">
          <p className="text-sm text-ink-72">
            Bu teklifin geçerlilik süresi doldu; kuruluştan güncel teklif iste.
          </p>
        </div>
      )}
      {teklif.status === 'declined' && (
        <div className="mb-6 px-4 py-3 bg-paper-2 border border-line rounded-lg">
          <p className="text-sm text-ink-72">Bu teklif kapatıldı.</p>
        </div>
      )}

      {/* Kalem tablosu */}
      <div className="bg-card border border-line rounded-lg p-5 md:p-6">
        {teklif.items.length === 0 ? (
          <p className="text-sm text-ink-72">Teklifte kalem yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                  <th className="py-2 pr-3">Kalem</th>
                  <th className="py-2 pr-3">Adet</th>
                  <th className="py-2 pr-3">Birim</th>
                  <th className="py-2 text-right">Toplam</th>
                </tr>
              </thead>
              <tbody>
                {teklif.items.map((k, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-2.5 pr-3 text-ink">
                      {k.description}
                      {k.role && k.role !== k.description && (
                        <span className="text-ink-72"> · {k.role}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-ink-72">{k.quantity}</td>
                    <td className="py-2.5 pr-3 text-ink-72">
                      {paraMetni(k.unit_client_price, teklif.currency) ?? '—'}
                    </td>
                    <td className="py-2.5 text-right text-ink">
                      {paraMetni(k.total_client_price, teklif.currency) ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Toplamlar — DB'de hesaplandi */}
        <div className="mt-5 pt-5 border-t border-line space-y-1.5 text-sm text-right">
          <p className="text-ink-72">
            Ara toplam:{' '}
            <span className="text-ink">
              {paraMetni(teklif.subtotal, teklif.currency) ?? '—'}
            </span>
          </p>
          <p className="text-ink-72">
            KDV ({kdvYuzdesi(teklif.tax_rate)}%):{' '}
            <span className="text-ink">
              {paraMetni(teklif.tax_amount, teklif.currency) ?? '—'}
            </span>
          </p>
          <p className="font-display font-semibold text-lg text-ink">
            Genel toplam: {toplamMetni ?? '—'}
          </p>
        </div>

        {/* Gecerlilik */}
        {gecerlilikMetni && (
          <p
            className={
              gecerlilikGecti
                ? 'mt-4 text-sm text-danger'
                : 'mt-4 text-sm text-ink-72'
            }
          >
            {gecerlilikGecti
              ? `Geçerlilik: ${gecerlilikMetni} — süresi doldu`
              : `Geçerlilik: ${gecerlilikMetni}`}
          </p>
        )}

        {/* Satici notu */}
        {teklif.notes && (
          <div className="mt-5 pt-5 border-t border-line">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-2">
              Not
            </p>
            <p className="text-sm text-ink whitespace-pre-wrap">
              {teklif.notes}
            </p>
          </div>
        )}
      </div>

      {/* Islemler — yalniz sent/viewed */}
      {islemDurumu && (
        <div className="mt-6">
          <PortalIslemleri
            token={token}
            toplamMetni={toplamMetni}
            gecerlilikMetni={gecerlilikMetni}
            onaylanabilir={scope.includes('approve')}
            revizeIstenebilir={scope.includes('request_revision')}
          />
        </div>
      )}
    </div>
  );
}
