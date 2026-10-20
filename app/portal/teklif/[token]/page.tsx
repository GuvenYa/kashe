import { notFound } from 'next/navigation';
import { createClient } from '@/app/lib/supabase-server';
import { PortalIslemleri } from './portal-islemleri';
import { TeklifBelgesi } from '@/app/components/teklif/teklif-belgesi';
import {
  JETON_KALIBI,
  PORTAL_DURUM_ETIKETLERI,
  PORTAL_DURUM_SINIFLARI,
  paraMetni,
  portalDurumMesaji,
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

      {/* BELGE KARTI — ortak bilesen (app/components/teklif/teklif-belgesi.tsx).
          Ayni sunum teklif editorundeki "Musteri gorunumu" anahtarinda da
          kullanilir; iki yerde iki kopya tutmak bicimlerin kaymasina yol
          aciyordu. Ic maliyet bu bilesene GECIRILEMEZ: prop tanimi yok. */}
      <TeklifBelgesi
        teklif={{
          seller_name: teklif.seller_name,
          client_name: teklif.client_name,
          title: teklif.title,
          version_no: teklif.version_no,
          sent_at: teklif.sent_at,
          status: teklif.status,
          durumEtiketi,
          durumSinifi,
          event: teklif.event,
          items: teklif.items,
          subtotal: teklif.subtotal,
          tax_rate: teklif.tax_rate,
          tax_amount: teklif.tax_amount,
          total_amount: teklif.total_amount,
          currency: teklif.currency,
          valid_until: teklif.valid_until,
          notes: teklif.notes,
        }}
      />

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
