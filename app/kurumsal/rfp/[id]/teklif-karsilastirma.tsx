import Link from 'next/link';
import { tarihMetni } from '@/app/lib/tarih';
import { TEKLIF_DURUM_ETIKETLERI } from '@/app/ajans/teklifler/teklif-data';
import {
  paraMetni,
  sayiya,
  type KarsilastirmaSutunu,
  type RfpDetay,
} from '../rfp-data';
import { OzetSerit } from '@/app/components/panel';
import { KarsilastirmaIslemleri } from './karsilastirma-islemleri';

/**
 * FAZ 7b / P2 — alici tarafi "Gelen teklifler" karsilastirmasi.
 *
 * Sunucu bileseni: veri sayfada RLS ile okundu, burada yalniz bicimlenir.
 * Istemci YALNIZ sutun altindaki islemler icin (`KarsilastirmaIslemleri`).
 *
 * GOSTERILEN HER SEY MUSTERIYE DONUK: `proposal_items` fiyatlari ve surum
 * toplamlari. Ic maliyet, marj, `internal.*` bu yuzeye HIC girmez — gizli
 * kalemleri RLS zaten vermez, ayrica filtre uygulanmaz.
 */

/**
 * Teklif durumunun RFP baglamindaki etiketi. Ortak harita (7a) yeniden
 * kullanilir; yalniz iki durum bu ekranda baska okunur: alici icin `viewed`
 * ile `sent` ayni seydir ("Gonderildi"), `approved` ise "Secildi".
 */
function durumEtiketi(status: string): string {
  if (status === 'sent' || status === 'viewed') return 'Gönderildi';
  if (status === 'approved') return 'Seçildi';
  return TEKLIF_DURUM_ETIKETLERI[status] ?? status;
}

/**
 * Bir sutunun bir rol icin hucre metni (ayni rolde birden cok kalem toplanir).
 *
 * Iki bicim doner: telefonda YALNIZ toplam, sm+ de ayrinti (adet, birim fiyat
 * ve toplam birlikte). Dar ekranda uzun bicim sutunlari tasiriyordu.
 */
function hucreMetinleri(
  sutun: KarsilastirmaSutunu,
  roleId: number
): { kisa: string; uzun: string } {
  const esl = sutun.kalemler.filter((k) => k.role_id === roleId);
  if (esl.length === 0) return { kisa: '—', uzun: '—' };

  const adet = esl.reduce((t, k) => t + sayiya(k.quantity), 0);
  const toplam = esl.reduce((t, k) => t + sayiya(k.total_client_price), 0);
  const birimler = new Set(esl.map((k) => sayiya(k.unit_client_price)));

  const toplamMetni = paraMetni(toplam, sutun.currency) ?? '—';
  if (birimler.size === 1) {
    const birim = paraMetni([...birimler][0], sutun.currency) ?? '—';
    return { kisa: toplamMetni, uzun: `${adet} × ${birim} = ${toplamMetni}` };
  }
  // Birim fiyatlar farkli: tek bir "adet × birim" yazmak yaniltici olurdu.
  return {
    kisa: toplamMetni,
    uzun: `${esl.length} kalem · ${toplamMetni}`,
  };
}

export function TeklifKarsilastirma({
  rfp,
  sutunlar,
  canManage,
  rezervasyon,
}: {
  rfp: RfpDetay;
  sutunlar: KarsilastirmaSutunu[];
  /** `events.manage` — Sec / Revizyon iste dugmeleri. */
  canManage: boolean;
  /** Secilen surumden acilmis rezervasyon (yoksa null). */
  rezervasyon: { id: string; tarih: string } | null;
}) {
  if (sutunlar.length === 0) return null;

  const secilenId = rfp.awarded_proposal_id;
  const secilen = sutunlar.find((s) => s.proposalId === secilenId) ?? null;

  // Islem yalniz talep acikken ve teklif henuz yanit bekler durumdayken.
  const talepAcik = ['sent', 'collecting', 'evaluating'].includes(rfp.status);

  // En dusuk genel toplam — yalniz 2+ yanitta vurgulanir (tek sutunda anlamsiz).
  let enUcuzId: string | null = null;
  if (sutunlar.length > 1) {
    let enAz = Number.POSITIVE_INFINITY;
    for (const s of sutunlar) {
      const t = sayiya(s.totalAmount);
      if (t > 0 && t < enAz) {
        enAz = t;
        enUcuzId = s.proposalId;
      }
    }
  }

  const kalemler = [...rfp.items].sort((a, b) => a.sort_order - b.sort_order);
  const talepRolleri = new Set(kalemler.map((k) => k.role_id));
  const ekVar = sutunlar.some((s) =>
    s.kalemler.some((k) => k.role_id === null || !talepRolleri.has(k.role_id))
  );

  // SECILI sutun pembe zemin (`brand-accent-soft`): secim bir KARAR, basari
  // degil — yesil (moss) "tamamlandi" anlamini tasiyor ve secimden sonra
  // rezervasyon henuz acilmamis oluyor. En ucuz sutun ise yalniz bir IPUCU,
  // o nedenle daha soluk kalir.
  const sutunSinifi = (s: KarsilastirmaSutunu) => {
    if (secilen && s.proposalId === secilen.proposalId) {
      return 'align-top p-3 border-l border-brand-accent/40 bg-brand-accent-soft';
    }
    if (!secilen && s.proposalId === enUcuzId) {
      return 'align-top p-3 border-l border-line bg-moss/5';
    }
    return 'align-top p-3 border-l border-line';
  };

  /** Seritte gosterilecek sutun: secim varsa o, yoksa en ucuz (ipucu). */
  const seritSutunu =
    secilen ?? sutunlar.find((x) => x.proposalId === enUcuzId) ?? sutunlar[0];
  const seritIslemVar =
    canManage &&
    !secilen &&
    talepAcik &&
    ['sent', 'viewed'].includes(seritSutunu.proposalStatus);

  return (
    <div className="bg-card border border-line rounded-2xl p-6 md:p-8">
      <p className="font-display font-semibold text-ink mb-1">
        Gelen teklifler ({sutunlar.length})
      </p>
      <p className="text-xs text-ink-50 mb-4">
        Tutarlar ajansın müşteriye sunduğu fiyatlardır.
      </p>

      {/* SECIM BANDI */}
      {secilen && (
        <div className="mb-4 px-4 py-3 bg-moss/10 border border-moss/40 rounded-lg">
          <p className="text-sm text-ink">
            Seçim yapıldı ·{' '}
            <strong>{secilen.saticiAdi}</strong> ·{' '}
            {paraMetni(secilen.totalAmount, secilen.currency) ?? '—'}
            {secilen.approvedAt ? ` · ${tarihMetni(secilen.approvedAt)}` : ''}
          </p>
          <p className="text-xs text-ink-72 mt-1">
            {rezervasyon ? (
              <Link
                href={`/rezervasyon/${rezervasyon.id}`}
                className="kashe-tap text-brand-ink hover:underline"
              >
                Rezervasyon oluşturuldu · {rezervasyon.tarih}
              </Link>
            ) : (
              'Rezervasyonu ajans oluşturur.'
            )}
          </p>
        </div>
      )}

      {/* md ALTI: her teklif bir KART. Pivot tablo (satir = rol, sutun =
          teklif) telefonda yatay kaydirmayi zorunlu kiliyordu; kartta
          karsilastirma dikey okunur. */}
      <div className="md:hidden space-y-3">
        {sutunlar.map((s) => {
          const buSecildi = secilen?.proposalId === s.proposalId;
          const islemVar =
            canManage &&
            !secilen &&
            talepAcik &&
            ['sent', 'viewed'].includes(s.proposalStatus);
          return (
            <div
              key={s.proposalId}
              className={
                buSecildi
                  ? 'border border-brand-accent/40 bg-brand-accent-soft rounded-lg p-4'
                  : 'border border-line rounded-lg p-4'
              }
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-ink break-words">
                    {s.saticiAdi}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72 mt-0.5">
                    {durumEtiketi(s.proposalStatus)}
                    {' · '}Sürüm {s.versionNo}
                  </p>
                </div>
                <p className="font-display font-semibold text-ink tabular-nums shrink-0">
                  {paraMetni(s.totalAmount, s.currency) ?? '—'}
                </p>
              </div>

              <dl className="mt-3 space-y-1 text-xs">
                {kalemler.map((k) => (
                  <div key={k.id} className="flex justify-between gap-3">
                    <dt className="text-ink-50 min-w-0">{k.role}</dt>
                    <dd className="text-ink-72 tabular-nums shrink-0">
                      {hucreMetinleri(s, k.role_id).kisa}
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3 pt-1 border-t border-line">
                  <dt className="text-ink-50">Ara toplam</dt>
                  <dd className="text-ink-72 tabular-nums">
                    {paraMetni(s.subtotal, s.currency) ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-50">KDV</dt>
                  <dd className="text-ink-72 tabular-nums">
                    {paraMetni(s.taxAmount, s.currency) ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-50">Geçerlilik</dt>
                  <dd className="text-ink-72">
                    {tarihMetni(s.validUntil) ?? '—'}
                  </dd>
                </div>
              </dl>

              {s.clientNote && (
                <p className="mt-2 text-xs text-ink-72">{s.clientNote}</p>
              )}

              {secilen ? (
                <p
                  className={
                    buSecildi
                      ? 'mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-brand-accent'
                      : 'mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-50'
                  }
                >
                  {buSecildi ? 'Seçili' : 'Seçilmedi'}
                </p>
              ) : islemVar ? (
                <KarsilastirmaIslemleri
                  rfpId={rfp.id}
                  proposalId={s.proposalId}
                  saticiAdi={s.saticiAdi}
                  toplamMetni={
                    paraMetni(s.totalAmount, s.currency) ?? '—'
                  }
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left align-bottom">
              <th className="p-3 font-normal font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 min-w-[160px]">
                İstenen rol
              </th>
              {sutunlar.map((s) => (
                <th
                  key={s.proposalId}
                  className={`${sutunSinifi(s)} sm:min-w-[190px]`}
                >
                  <p className="font-display font-semibold text-ink leading-tight break-words">
                    {s.saticiAdi}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72 mt-1">
                    {durumEtiketi(s.proposalStatus)}
                    {' · '}Sürüm {s.versionNo}
                  </p>
                  {secilen?.proposalId === s.proposalId && (
                    <span className="mt-1 inline-block font-mono text-[9px] uppercase tracking-[0.14em] text-brand-accent bg-card border border-brand-accent/40 px-1.5 py-0.5 rounded-full">
                      Seçili
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {kalemler.map((k) => (
              <tr key={k.id} className="border-t border-line">
                <td className="p-3 text-ink">
                  {k.role}
                  <span className="text-ink-72"> × {k.quantity}</span>
                  {!k.is_required && (
                    <span className="text-ink-50"> (isteğe bağlı)</span>
                  )}
                </td>
                {sutunlar.map((s) => (
                  <td key={s.proposalId} className={sutunSinifi(s)}>
                    <span className="text-ink-72">
                      <span className="sm:hidden">
                        {hucreMetinleri(s, k.role_id).kisa}
                      </span>
                      <span className="hidden sm:inline">
                        {hucreMetinleri(s, k.role_id).uzun}
                      </span>
                    </span>
                  </td>
                ))}
              </tr>
            ))}

            {ekVar && (
              <tr className="border-t border-line">
                <td className="p-3 text-ink-72">Ek kalemler</td>
                {sutunlar.map((s) => {
                  const ek = s.kalemler.filter(
                    (k) => k.role_id === null || !talepRolleri.has(k.role_id)
                  );
                  return (
                    <td key={s.proposalId} className={sutunSinifi(s)}>
                      {ek.length === 0 ? (
                        <span className="text-ink-72">—</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {ek.map((k) => (
                            <li key={k.id} className="text-ink-72">
                              {k.description} ·{' '}
                              {paraMetni(k.total_client_price, s.currency) ??
                                '—'}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  );
                })}
              </tr>
            )}

            <tr className="border-t border-line-strong">
              <td className="p-3 text-ink-72">Ara toplam</td>
              {sutunlar.map((s) => (
                <td key={s.proposalId} className={sutunSinifi(s)}>
                  <span className="text-ink-72">
                    {paraMetni(s.subtotal, s.currency) ?? '—'}
                  </span>
                </td>
              ))}
            </tr>
            <tr className="border-t border-line">
              <td className="p-3 text-ink-72">KDV</td>
              {sutunlar.map((s) => (
                <td key={s.proposalId} className={sutunSinifi(s)}>
                  <span className="text-ink-72">
                    {paraMetni(s.taxAmount, s.currency) ?? '—'}
                  </span>
                </td>
              ))}
            </tr>
            <tr className="border-t border-line">
              <td className="p-3 font-display font-semibold text-ink">
                Genel toplam (KDV dahil)
              </td>
              {sutunlar.map((s) => (
                <td key={s.proposalId} className={sutunSinifi(s)}>
                  <span className="font-display font-semibold text-ink tabular-nums">
                    {paraMetni(s.totalAmount, s.currency) ?? '—'}
                  </span>
                </td>
              ))}
            </tr>
            <tr className="border-t border-line">
              <td className="p-3 text-ink-72">Geçerlilik</td>
              {sutunlar.map((s) => (
                <td key={s.proposalId} className={sutunSinifi(s)}>
                  <span className="text-ink-72">
                    {tarihMetni(s.validUntil) ?? '—'}
                  </span>
                </td>
              ))}
            </tr>
            <tr className="border-t border-line">
              <td className="p-3 text-ink-72">Not</td>
              {sutunlar.map((s) => (
                <td key={s.proposalId} className={sutunSinifi(s)}>
                  {s.clientNote ? (
                    <span className="text-ink-72" title={s.clientNote}>
                      {s.clientNote.length > 70
                        ? `${s.clientNote.slice(0, 70)}…`
                        : s.clientNote}
                    </span>
                  ) : (
                    <span className="text-ink-72">—</span>
                  )}
                </td>
              ))}
            </tr>

            {/* ISLEMLER — secim yapildiysa dugme yok, durum yazisi var */}
            <tr className="border-t border-line">
              <td className="p-3" />
              {sutunlar.map((s) => {
                const buSecildi = secilen?.proposalId === s.proposalId;
                const islemVar =
                  canManage &&
                  !secilen &&
                  talepAcik &&
                  ['sent', 'viewed'].includes(s.proposalStatus);
                return (
                  <td key={s.proposalId} className={sutunSinifi(s)}>
                    {secilen ? (
                      <span
                        className={
                          buSecildi
                            ? 'font-mono text-[10px] uppercase tracking-[0.12em] text-moss'
                            : 'font-mono text-[10px] uppercase tracking-[0.12em] text-ink-50'
                        }
                      >
                        {buSecildi ? 'Seçildi' : 'Seçilmedi'}
                      </span>
                    ) : islemVar ? (
                      <KarsilastirmaIslemleri
                        rfpId={rfp.id}
                        proposalId={s.proposalId}
                        saticiAdi={s.saticiAdi}
                        toplamMetni={
                          paraMetni(s.totalAmount, s.currency) ?? '—'
                        }
                      />
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-50">
                        {s.proposalStatus === 'revision_requested'
                          ? 'Yanıt bekleniyor'
                          : '—'}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Yapiskan serit — YALNIZ `md` alti. Masaustunde ayni dugme tablonun
          icinde duruyor. Dugme MEVCUT onay kapisina girer: secim tek tikla
          olmaz (`KarsilastirmaIslemleri` kendi onayini sorar). */}
      {seritIslemVar ? (
        <OzetSerit
          etiket="En düşük teklif"
          deger={`${seritSutunu.saticiAdi} · ${
            paraMetni(seritSutunu.totalAmount, seritSutunu.currency) ?? '—'
          }`}
          altNot="Henüz seçim yapılmadı"
          aksiyon={
            <KarsilastirmaIslemleri
              rfpId={rfp.id}
              proposalId={seritSutunu.proposalId}
              saticiAdi={seritSutunu.saticiAdi}
              toplamMetni={
                paraMetni(seritSutunu.totalAmount, seritSutunu.currency) ?? '—'
              }
            />
          }
        />
      ) : secilen ? (
        <OzetSerit
          etiket="Seçili"
          deger={`${secilen.saticiAdi} · ${
            paraMetni(secilen.totalAmount, secilen.currency) ?? '—'
          }`}
          altNot="Seçim yapıldı"
        />
      ) : null}
    </div>
  );
}
