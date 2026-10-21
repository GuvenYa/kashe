'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { teklifMusterisiniKisiYap } from '@/app/lib/crm-actions';
import {
  REZERVASYON_DURUM_ETIKETLERI,
  TEKLIF_DURUM_ETIKETLERI,
  zamanMetni,
  type RfpBaglami,
  type TeklifRezervasyonu,
  type SurumSatiri,
  type TeklifSatiri,
} from '../teklif-data';

/**
 * TEKLIF BASLIK KARTI (D1b-3 / madde 1).
 *
 * Tek satir: solda eyebrow + baslik + alt bilgi satiri, sagda durum rozeti ve
 * eylemler. RFP yaniti bandi KALKTI — ayni bilgi (talep adi, alici, son tarih)
 * alt satira indi; iki ayri kutu ayni seyi iki kez soyluyordu.
 *
 * Baslik KIRPILMAZ: `truncate` yerine `break-words`. Uzun teklif adlari
 * ("... RFP yaniti" gibi) uc nokta ile kesiliyordu ve ayirt edilemiyordu.
 *
 * EYLEM URETMEZ: gonderme, rezervasyon ve kaydetme islerini cagiranin verdigi
 * callback'ler yapar; onay kapilari (gonderim ekrani, rezervasyon onayi) editorde
 * kaldi. Bu bilesen yalniz yerlesim ve sunum.
 */
/**
 * FAZ 8b — alici satirindaki CRM kisi bagi.
 *
 * `bagli`: teklif bir kisiye bagli, adi ve baglantisi yazilir.
 * `eklenebilir`: kisi yok ama `client_email` dolu ve kullanici `crm.manage`
 * yetkili — tek dokunusla kisi acilir (ayni action oneri seridindekiyle).
 * `null`: RFP yaniti, modul kapali ya da yetki yok -> satir hic cizilmez.
 */
export type KisiBagi =
  | { tur: 'bagli'; kisiId: string; ad: string }
  | { tur: 'eklenebilir'; organizationId: string }
  | null;

const BTN_IKINCIL =
  'kashe-tap px-3 py-1.5 border border-line-strong text-ink rounded-lg font-display font-semibold text-xs hover:border-brand-ink hover:text-brand-ink transition-colors disabled:opacity-50';
const ALAN =
  'px-3 py-2 bg-paper border border-line rounded-lg text-sm text-ink focus:border-brand-ink focus:outline-none';

/**
 * "Kisi olarak ekle" — oneri seridiyle AYNI action.
 *
 * Ayri bir bilesen, cunku kendi bekleme ve hata durumunu tasiyor; baslik
 * bileseninin durumuna karismaz.
 */
function KisiOlarakEkle({
  organizationId,
  proposalId,
}: {
  organizationId: string;
  proposalId: string;
}) {
  const router = useRouter();
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  function ekle() {
    setHata(null);
    basla(async () => {
      const res = await teklifMusterisiniKisiYap(organizationId, proposalId);
      if (!res.ok) {
        setHata(res.hata);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={ekle}
        disabled={bekliyor}
        className="kashe-tap text-brand-ink hover:underline disabled:opacity-50"
      >
        {bekliyor ? 'Ekleniyor…' : 'Kişi olarak ekle'}
      </button>
      {hata && <span className="text-danger"> · {hata}</span>}
    </>
  );
}

export function TeklifBaslik({
  teklif,
  gecerliSurum,
  rfpBaglami,
  rezervasyon,
  canManage,
  baslik,
  setBaslik,
  basligiKaydet,
  musteriAdi,
  setMusteriAdi,
  musteriEposta,
  setMusteriEposta,
  musteriKaydet,
  kaydediliyor,
  kaydedildi,
  gonderilebilir,
  onGonder,
  rezervasyonIstenebilir,
  onRezervasyonIste,
  musteriGorunumu,
  setMusteriGorunumu,
  isPending,
  kisiBagi,
}: {
  teklif: TeklifSatiri;
  gecerliSurum: SurumSatiri | null;
  rfpBaglami: RfpBaglami | null;
  rezervasyon: TeklifRezervasyonu | null;
  canManage: boolean;
  baslik: string;
  setBaslik: (v: string) => void;
  basligiKaydet: () => void;
  musteriAdi: string;
  setMusteriAdi: (v: string) => void;
  musteriEposta: string;
  setMusteriEposta: (v: string) => void;
  musteriKaydet: () => void;
  kaydediliyor: string | null;
  kaydedildi: string | null;
  /** Taslak + gonderilmemis surum + yetki. */
  gonderilebilir: boolean;
  onGonder: () => void;
  rezervasyonIstenebilir: boolean;
  onRezervasyonIste: () => void;
  musteriGorunumu: boolean;
  setMusteriGorunumu: (v: boolean) => void;
  isPending: boolean;
  /** FAZ 8b: CRM kisi bagi; null ise satir cizilmez. */
  kisiBagi: KisiBagi;
}) {
  // Alt satir: alici · etkinlik · son tarih — yalniz dolu parcalar.
  const aliciMetni = rfpBaglami
    ? `Alıcı: ${rfpBaglami.buyerName ?? teklif.client_name ?? 'Kuruluş'}`
    : teklif.client_name || teklif.client_email
      ? `Alıcı: ${teklif.client_name || teklif.client_email}`
      : 'Alıcı girilmedi';

  const altSatir = [
    aliciMetni,
    rfpBaglami ? `Talep: ${rfpBaglami.title}` : null,
    rfpBaglami?.deadline
      ? `son tarih ${zamanMetni(rfpBaglami.deadline)}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="bg-card border border-line rounded-lg p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {/* `basis-80`: sol sutun 20 rem'in altina inmez; yer kalmayinca sag grup
            ikinci satira sarar (flex-1 tek basina sifira kadar daralirdi). */}
        <div className="min-w-0 flex-1 basis-80">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brand-ink">
            Teklif
            {gecerliSurum ? ` · Sürüm ${gecerliSurum.version_no}` : ''}
          </p>

          {/* Baslik girdisi TEXTAREA: tek satirlik `input` telefonda uzun
              teklif adlarini goruntunun disina kaydiriyordu (metin duruyor ama
              gorunmuyordu). `field-sizing-content` ile icerige gore buyur (destek
              yoksa tek satir kalir), Enter ENGELLENIR — alan
              tek satirlik bir baslik, satir sonu tasimaz. Kaydetme AYNI
              (`onBlur` -> `basligiKaydet`). */}
          {canManage ? (
            <textarea
              value={baslik}
              rows={1}
              onChange={(e) => setBaslik(e.target.value.slice(0, 200))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
              onBlur={basligiKaydet}
              aria-label="Teklif başlığı"
              className="mt-2 w-full resize-none field-sizing-content font-display text-2xl text-ink leading-tight bg-transparent border-b border-transparent hover:border-line focus:border-brand-ink focus:outline-none"
            />
          ) : (
            <h1 className="mt-2 font-display text-2xl text-ink break-words">
              {teklif.title}
            </h1>
          )}

          <p className="mt-2 text-sm text-ink-72 break-words">
            {altSatir}
            {rfpBaglami && (
              <>
                {' · '}
                <Link
                  href={`/ajans/rfp/${rfpBaglami.id}`}
                  className="kashe-tap text-brand-ink hover:underline"
                >
                  Talebi gör
                </Link>
              </>
            )}
          </p>

          {/* Musteri alanlari yalniz DOGRUDAN teklifte duzenlenir: RFP yanitinda
              alici bir kurulustur, adi talepten gelir (FAZ 7b). */}
          {canManage && !rfpBaglami && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl">
              <input
                type="text"
                value={musteriAdi}
                onChange={(e) => setMusteriAdi(e.target.value.slice(0, 200))}
                onBlur={musteriKaydet}
                placeholder="Müşteri adı"
                className={ALAN}
              />
              <input
                type="email"
                value={musteriEposta}
                onChange={(e) => setMusteriEposta(e.target.value.slice(0, 200))}
                onBlur={musteriKaydet}
                placeholder="Müşteri e-postası"
                className={ALAN}
              />
            </div>
          )}

          {/* FAZ 8b — CRM kisi bagi. RFP yanitinda `kisiBagi` null gelir. */}
          {kisiBagi && (
            <p className="mt-3 text-sm text-ink-72">
              {kisiBagi.tur === 'bagli' ? (
                <>
                  Kişi:{' '}
                  <Link
                    href={`/ajans/musteriler/${kisiBagi.kisiId}`}
                    className="kashe-tap text-brand-ink hover:underline"
                  >
                    {kisiBagi.ad} →
                  </Link>
                </>
              ) : (
                <KisiOlarakEkle organizationId={kisiBagi.organizationId} proposalId={teklif.id} />
              )}
            </p>
          )}
        </div>

        {/* Sag grup — `md` altinda ikinci satira sarar */}
        <div className="flex items-center gap-2 flex-wrap md:justify-end">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 bg-paper-2 border border-line px-2 py-1 rounded-full">
            {TEKLIF_DURUM_ETIKETLERI[teklif.status] ?? teklif.status}
          </span>

          <button
            type="button"
            onClick={() => setMusteriGorunumu(!musteriGorunumu)}
            aria-pressed={musteriGorunumu}
            className={
              musteriGorunumu
                ? 'kashe-tap px-3 py-1.5 border border-brand-ink bg-brand-ink-08 text-brand-ink rounded-lg font-display font-semibold text-xs transition-colors'
                : BTN_IKINCIL
            }
          >
            Müşteri görünümü
          </button>

          {/* PDF: FAZ 9. Dugme GORUNUR ama devre disi — kullanicinin "bu nerede"
              diye aramasindansa "yakinda" demek daha dogru. */}
          <button
            type="button"
            disabled
            title="Yakında"
            className={`${BTN_IKINCIL} cursor-not-allowed`}
          >
            PDF indir
          </button>

          {gonderilebilir && (
            <button
              type="button"
              onClick={onGonder}
              disabled={isPending}
              className="kashe-tap px-4 py-2 bg-brand-accent text-paper rounded-lg font-display font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Teklifi gönder →
            </button>
          )}
        </div>
      </div>

      {/* Kaydetme geri bildirimi + onay / rezervasyon satiri */}
      <div className="mt-3 flex items-center gap-3 flex-wrap text-xs">
        {kaydediliyor === 'ust' ? (
          <span className="text-ink-50">Kaydediliyor…</span>
        ) : kaydedildi === 'ust' ? (
          <span className="text-moss">Kaydedildi</span>
        ) : null}

        {teklif.status === 'approved' && gecerliSurum?.approved_at && (
          <span className="text-moss">
            Onaylandı · {gecerliSurum.approved_by_name ?? 'Müşteri'} ·{' '}
            {zamanMetni(gecerliSurum.approved_at)}
          </span>
        )}

        {rezervasyon ? (
          <span className="inline-flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72">
              Rezervasyon:{' '}
              {REZERVASYON_DURUM_ETIKETLERI[rezervasyon.status] ??
                rezervasyon.status}
            </span>
            <Link
              href={`/rezervasyon/${rezervasyon.id}`}
              className="kashe-tap text-brand-ink hover:underline"
            >
              Rezervasyona git
            </Link>
          </span>
        ) : (
          rezervasyonIstenebilir && (
            <button
              type="button"
              onClick={onRezervasyonIste}
              disabled={isPending}
              className={BTN_IKINCIL}
            >
              Rezervasyon oluştur
            </button>
          )
        )}
      </div>
    </div>
  );
}
