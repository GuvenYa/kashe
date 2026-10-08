import { notFound } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { PortalIslemleri } from './portal-islemleri';
import {
  JETON_KALIBI,
  PORTAL_DURUM_ETIKETLERI,
  PORTAL_DURUM_SINIFLARI,
  kdvYuzdesi,
  paraMetni,
  portalDurumMesaji,
  suresiDoldu,
  tarihMetni,
  zamanMetni,
  type PortalTeklif,
} from './portal-data';

/**
 * FAZ 7a / P2 — misafir portali: teklif gorunumu (P2-cila: belge duzeni).
 *
 * Portal AYRI YUZEY (02 bolum 6): bu sayfa YALNIZ `portal_proposal_view`
 * RPC'sini cagirir. `proposals`/`proposal_versions`/`proposal_items`/
 * `portal_access_links` tablolarina sorgu YOK, `internal` YOK, yetki
 * fonksiyonu YOK; oturum gerekmez (RPC SECURITY DEFINER, anon'a acik).
 *
 * Jeton yalniz URL'den gelir ve yalniz RPC'ye verilir; loglanmaz.
 * `force-dynamic`: her acilis goruntuleme sayar (onbellek yok).
 *
 * P2-cila: icerik ve alanlar AYNI; yalniz dizilis belge gibi (tek kart,
 * rozet, etiketli etkinlik kutusu, mobilde kalem kutulari).
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Teklif — Kashe',
  robots: { index: false, follow: false },
  referrer: 'no-referrer' as const,
};

const EYEBROW =
  'font-mono text-[10px] uppercase tracking-[0.22em] text-brand-ink';
const KART = 'bg-card border border-line rounded-2xl p-6 md:p-8';

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

/** Etkinlik ozeti satiri — yalniz dolu alanlar. */
function OzetSatiri({
  etiket,
  deger,
}: {
  etiket: string;
  deger: string | null;
}) {
  if (!deger) return null;
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
        {etiket}
      </dt>
      <dd className="text-sm text-ink text-right">{deger}</dd>
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
  const durumEtiketi =
    PORTAL_DURUM_ETIKETLERI[teklif.status] ?? teklif.status;
  const durumSinifi =
    PORTAL_DURUM_SINIFLARI[teklif.status] ?? 'bg-paper-2 border-line text-ink-72';

  return (
    <div className="max-w-3xl mx-auto">
      {/* Durum bandi — kartin USTUNDE, rozetle ayni dil */}
      {teklif.status === 'approved' && (
        <div className="mb-4 px-4 py-3 bg-moss/10 border border-moss/40 rounded-lg">
          <p className="text-sm text-ink">
            Onaylandı
            {teklif.approved_by_name ? ` · ${teklif.approved_by_name}` : ''}
            {teklif.approved_at ? ` · ${zamanMetni(teklif.approved_at)}` : ''}
          </p>
          {/* FAZ 7c: rezervasyon acildiysa musteri bunu gorur */}
          {teklif.has_booking && (
            <p className="text-sm text-ink mt-1">
              Rezervasyon oluşturuldu; kuruluş sizinle iletişime geçecek.
            </p>
          )}
        </div>
      )}
      {teklif.status === 'revision_requested' && (
        <div className="mb-4 px-4 py-3 bg-amber-500/10 border border-amber-500/40 rounded-lg">
          <p className="text-sm text-ink">
            Revizyon talebin iletildi
            {teklif.client_note ? `: ${teklif.client_note}` : '.'}
          </p>
        </div>
      )}
      {teklif.status === 'expired' && (
        <div className="mb-4 px-4 py-3 bg-paper-2 border border-line rounded-lg">
          <p className="text-sm text-ink-72">
            Bu teklifin geçerlilik süresi doldu; kuruluştan güncel teklif iste.
          </p>
        </div>
      )}
      {teklif.status === 'declined' && (
        <div className="mb-4 px-4 py-3 bg-paper-2 border border-line rounded-lg">
          <p className="text-sm text-ink-72">Bu teklif kapatıldı.</p>
        </div>
      )}

      {/* BELGE KARTI */}
      <article className={KART}>
        {/* Kart ustu: satici + durum rozeti */}
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className={EYEBROW}>Teklif</p>
            <h1 className="mt-2 font-display text-2xl md:text-3xl text-ink leading-tight">
              {teklif.seller_name?.trim() || 'Kashe kuruluşu'}
            </h1>
          </div>
          <span
            className={`font-mono text-[10px] uppercase tracking-[0.14em] border px-2.5 py-1 rounded-full shrink-0 ${durumSinifi}`}
          >
            {durumEtiketi}
          </span>
        </header>

        <div className="mt-5 pt-5 border-t border-line">
          {teklif.client_name && (
            <p className="text-sm text-ink-72">Sayın {teklif.client_name},</p>
          )}
          <p className="mt-1 font-display text-lg md:text-xl text-ink leading-snug">
            {teklif.title}
          </p>
          <p className="mt-1.5 text-xs text-ink-72">
            Sürüm {teklif.version_no}
            {teklif.sent_at ? ` · gönderim ${zamanMetni(teklif.sent_at)}` : ''}
          </p>
        </div>

        {/* Etkinlik ozeti — etiketli, yalniz dolu alanlar */}
        {teklif.event && (
          <div className="mt-6 bg-paper border border-line rounded-xl p-4 md:p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-3">
              Etkinlik
            </p>
            <dl className="space-y-2">
              <OzetSatiri etiket="Etkinlik" deger={teklif.event.title} />
              <OzetSatiri etiket="Tür" deger={teklif.event.event_type} />
              <OzetSatiri
                etiket="Tarih"
                deger={tarihMetni(teklif.event.start_date)}
              />
              <OzetSatiri etiket="Şehir" deger={teklif.event.city} />
              <OzetSatiri
                etiket="Katılımcı"
                deger={
                  teklif.event.participant_count
                    ? `${teklif.event.participant_count} kişi`
                    : null
                }
              />
            </dl>
          </div>
        )}

        {/* KALEMLER */}
        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-3">
            Kalemler
          </p>

          {teklif.items.length === 0 ? (
            <p className="text-sm text-ink-72">Teklifte kalem yok.</p>
          ) : (
            <>
              {/* Masaustu: tablo */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 border-b border-line-strong">
                      <th className="py-2 pr-3 font-normal">Kalem</th>
                      <th className="py-2 pr-3 font-normal">Adet</th>
                      <th className="py-2 pr-3 font-normal">Birim fiyat</th>
                      <th className="py-2 text-right font-normal">Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teklif.items.map((k, i) => (
                      <tr key={i} className="border-b border-line">
                        <td className="py-3 pr-3 text-ink">
                          {k.description}
                          {k.role && k.role !== k.description && (
                            <span className="text-ink-72"> · {k.role}</span>
                          )}
                        </td>
                        <td className="py-3 pr-3 text-ink-72">{k.quantity}</td>
                        <td className="py-3 pr-3 text-ink-72">
                          {paraMetni(k.unit_client_price, teklif.currency) ??
                            '—'}
                        </td>
                        <td className="py-3 text-right text-ink">
                          {paraMetni(k.total_client_price, teklif.currency) ??
                            '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobil: her kalem bir kutu */}
              <div className="sm:hidden space-y-2">
                {teklif.items.map((k, i) => (
                  <div
                    key={i}
                    className="border border-line rounded-lg p-3 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-ink">{k.description}</p>
                      {k.role && k.role !== k.description && (
                        <p className="text-xs text-ink-72 mt-0.5">{k.role}</p>
                      )}
                      <p className="text-xs text-ink-72 mt-1">
                        {k.quantity} adet · birim{' '}
                        {paraMetni(k.unit_client_price, teklif.currency) ?? '—'}
                      </p>
                    </div>
                    <p className="text-sm text-ink shrink-0">
                      {paraMetni(k.total_client_price, teklif.currency) ?? '—'}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* TOPLAMLAR — DB'de hesaplandi */}
        <div className="mt-6 pt-5 border-t border-line">
          <div className="sm:ml-auto sm:max-w-xs space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-ink-72">Ara toplam</span>
              <span className="text-ink">
                {paraMetni(teklif.subtotal, teklif.currency) ?? '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-ink-72">
                KDV ({kdvYuzdesi(teklif.tax_rate)}%)
              </span>
              <span className="text-ink">
                {paraMetni(teklif.tax_amount, teklif.currency) ?? '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 pt-2 border-t border-line">
              <span className="font-display font-semibold text-ink">
                Genel toplam
              </span>
              <span className="font-display font-semibold text-lg text-ink">
                {toplamMetni ?? '—'}
              </span>
            </div>

            {gecerlilikMetni && (
              <p
                className={
                  gecerlilikGecti
                    ? 'pt-2 text-xs text-danger'
                    : 'pt-2 text-xs text-ink-72'
                }
              >
                {gecerlilikGecti
                  ? `Geçerlilik: ${gecerlilikMetni} — süresi doldu`
                  : `Geçerlilik: ${gecerlilikMetni}`}
              </p>
            )}
          </div>
        </div>

        {/* Satici notu */}
        {teklif.notes && (
          <div className="mt-6 bg-paper border border-line rounded-xl p-4 md:p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-2">
              Not
            </p>
            <p className="text-sm text-ink whitespace-pre-wrap">
              {teklif.notes}
            </p>
          </div>
        )}
      </article>

      {/* Islemler — kartin ALTINDA, yalniz sent/viewed */}
      {islemDurumu && (
        <div className="mt-5">
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
