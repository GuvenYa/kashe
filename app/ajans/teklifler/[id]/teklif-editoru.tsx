'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  IC_KALEM_KAYNAK_ETIKETLERI,
  REZERVASYON_DURUM_ETIKETLERI,
  TEKLIF_DURUM_ETIKETLERI,
  kdvYuzdesi,
  marjYuzdesi,
  paraMetni,
  tarihAlani,
  tarihMetni,
  zamanMetni,
  type IcKalemSatiri,
  type KalemSatiri,
  type PortalBaglantisi,
  type SurumSatiri,
  type TeklifRezervasyonu,
  type TeklifSatiri,
} from '../teklif-data';
import {
  addProposalItem,
  closeProposal,
  createBookingFromProposal,
  deleteDraftProposal,
  deleteProposalItem,
  newProposalVersion,
  revokeProposalLink,
  sendProposal,
  updateProposalFields,
  updateProposalItem,
  updateVersionFields,
} from '../teklif-actions';
import {
  listProposalInternalItems,
  upsertProposalItemCost,
} from '../teklif-maliyet-actions';

/**
 * FAZ 7a / P1 — teklif editoru.
 *
 * Toplamlar DB'den gelir (`subtotal/tax_amount/total_amount`; gizli kalem toplama
 * girmez) — istemci HESAPLAMAZ. Dondurulmus surumde (sent_at dolu) alanlar kilitli;
 * kapi DB tetikleyicisinde, UI yalniz onden engeller.
 *
 * Ham portal jetonu YALNIZ gonderim donusunde bir kez gosterilir; saklanmaz.
 * Ic maliyet karti yalniz `maliyetGorulur` ise render edilir (DOM'da da yok).
 */

const BTN_BIRINCIL =
  'kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50';
const BTN_IKINCIL =
  'kashe-tap px-3 py-1.5 border border-line-strong text-ink rounded-lg font-display font-semibold text-xs hover:border-brand-ink hover:text-brand-ink transition-colors disabled:opacity-50';
const ALAN =
  'px-3 py-2 bg-paper border border-line rounded-lg text-sm text-ink focus:border-brand-ink focus:outline-none';

type Onay =
  | { tur: 'kalemSil'; id: string }
  | { tur: 'kapat' }
  | { tur: 'taslakSil' }
  | { tur: 'rezervasyon' }
  | { tur: 'baglantiIptal'; id: string }
  | null;

function sayi(v: string): number | null {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function TeklifEditoru({
  teklif,
  gecerliSurum,
  surumler,
  kalemler,
  baglantilar,
  canManage,
  maliyetGorulur,
  maliyetYazilir,
  silinebilir,
  rezervasyon,
}: {
  teklif: TeklifSatiri;
  gecerliSurum: SurumSatiri | null;
  surumler: SurumSatiri[];
  kalemler: KalemSatiri[];
  baglantilar: PortalBaglantisi[];
  canManage: boolean;
  maliyetGorulur: boolean;
  maliyetYazilir: boolean;
  /** FAZ 7a/P2: hicbir surumu gonderilmemis taslak -> "Taslagi sil" (DB politikasi ayni kurali uygular). */
  silinebilir: boolean;
  /** FAZ 7c: gecerli surumun rezervasyonu (varsa); yalniz RPC acar. */
  rezervasyon: TeklifRezervasyonu | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [onay, setOnay] = useState<Onay>(null);

  // Kaydetme geri bildirimi: alandan cikinca kaydedildigi anlasilsin.
  // Deger kalem id'si (satir yaninda gosterilir) ya da 'ust' (baslik/musteri/surum).
  const [kaydedildi, setKaydedildi] = useState<string | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState<string | null>(null);

  // Yeni kalem eklenince aciklama girdisine odak + metin secili (P2-cila).
  // Bayrak state DEGIL ref: efekt govdesinde setState cagirmak repo lint
  // kuralini (react-hooks/set-state-in-effect) ihlal ederdi.
  const aciklamaRefleri = useRef<Record<string, HTMLInputElement | null>>({});
  const yeniKalemBekliyor = useRef(false);
  useEffect(() => {
    if (!yeniKalemBekliyor.current) return;
    const son = kalemler[kalemler.length - 1];
    const girdi = son ? aciklamaRefleri.current[son.id] : null;
    if (!girdi) return;
    yeniKalemBekliyor.current = false;
    girdi.focus();
    girdi.select();
  }, [kalemler]);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bilesen soklerse bekleyen zamanlayici kalmasin.
  useEffect(
    () => () => {
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
    },
    []
  );

  function kaydedildiGoster(anahtar: string) {
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    setKaydedildi(anahtar);
    zamanlayici.current = setTimeout(() => setKaydedildi(null), 2000);
  }

  // Baslik / musteri
  const [baslik, setBaslik] = useState(teklif.title);
  const [musteriAdi, setMusteriAdi] = useState(teklif.client_name ?? '');
  const [musteriEposta, setMusteriEposta] = useState(teklif.client_email ?? '');

  // Surum alanlari
  const [kdv, setKdv] = useState(
    gecerliSurum ? String(kdvYuzdesi(gecerliSurum.tax_rate)) : '20'
  );
  const [gecerlilik, setGecerlilik] = useState(
    tarihAlani(gecerliSurum?.valid_until)
  );
  const [notlar, setNotlar] = useState(gecerliSurum?.notes ?? '');

  // Gonderim onay ekrani + baglanti kutusu
  const [gonderOnayi, setGonderOnayi] = useState(false);
  const [gecerlilikGun, setGecerlilikGun] = useState('14');
  const [baglantiKutusu, setBaglantiKutusu] = useState<string | null>(null);
  const [mailNotu, setMailNotu] = useState<string | null>(null);
  const [kopyalandi, setKopyalandi] = useState(false);

  // Ic maliyet karti (tembel)
  const [maliyetAcik, setMaliyetAcik] = useState(false);
  const [icKalemler, setIcKalemler] = useState<IcKalemSatiri[] | null>(null);
  const [maliyetHatasi, setMaliyetHatasi] = useState<string | null>(null);
  const [maliyetForm, setMaliyetForm] = useState<{
    itemId: string;
    cost: string;
    note: string;
  } | null>(null);

  const dondurulmus = !!gecerliSurum?.sent_at;
  const duzenlenebilir = canManage && !!gecerliSurum && !dondurulmus;
  const aktifBaglanti = baglantilar.find((b) => !b.revoked_at) ?? null;

  function mesajlariTemizle() {
    setHata(null);
    setBilgi(null);
  }

  function basligiKaydet() {
    if (!canManage) return;
    if (baslik.trim() === teklif.title) return;
    mesajlariTemizle();
    setKaydediliyor('ust');
    startTransition(async () => {
      const res = await updateProposalFields({
        proposalId: teklif.id,
        title: baslik,
      });
      setKaydediliyor(null);
      if (!res.success) setHata(res.error);
      else kaydedildiGoster('ust');
    });
  }

  function musteriKaydet() {
    if (!canManage) return;
    if (
      musteriAdi.trim() === (teklif.client_name ?? '') &&
      musteriEposta.trim() === (teklif.client_email ?? '')
    ) {
      return;
    }
    mesajlariTemizle();
    setKaydediliyor('ust');
    startTransition(async () => {
      const res = await updateProposalFields({
        proposalId: teklif.id,
        clientName: musteriAdi,
        clientEmail: musteriEposta,
      });
      setKaydediliyor(null);
      if (!res.success) setHata(res.error);
      else kaydedildiGoster('ust');
    });
  }

  function surumKaydet(alan: 'kdv' | 'gecerlilik' | 'notlar') {
    if (!duzenlenebilir || !gecerliSurum) return;
    mesajlariTemizle();
    setKaydediliyor('ust');
    startTransition(async () => {
      const girdi: Parameters<typeof updateVersionFields>[0] = {
        versionId: gecerliSurum.id,
        proposalId: teklif.id,
      };
      if (alan === 'kdv') {
        const n = sayi(kdv);
        if (n === null) {
          // Erken cikis: "Kaydediliyor…" isareti asili kalmasin.
          setKaydediliyor(null);
          setHata('KDV oranı geçersiz.');
          return;
        }
        girdi.taxPercent = n;
      }
      if (alan === 'gecerlilik') girdi.validUntil = gecerlilik;
      if (alan === 'notlar') girdi.notes = notlar;
      const res = await updateVersionFields(girdi);
      setKaydediliyor(null);
      if (!res.success) setHata(res.error);
      else kaydedildiGoster('ust');
    });
  }

  function kalemEkle() {
    if (!duzenlenebilir || !gecerliSurum) return;
    mesajlariTemizle();
    yeniKalemBekliyor.current = true;
    startTransition(async () => {
      const res = await addProposalItem({
        versionId: gecerliSurum.id,
        proposalId: teklif.id,
        sortOrder: kalemler.length + 1,
      });
      if (!res.success) setHata(res.error);
    });
  }

  function kalemGuncelle(
    itemId: string,
    alan: Partial<{
      description: string;
      quantity: number;
      unitPrice: number;
      isVisible: boolean;
    }>
  ) {
    if (!duzenlenebilir) return;
    mesajlariTemizle();
    setKaydediliyor(itemId);
    startTransition(async () => {
      const res = await updateProposalItem({
        itemId,
        proposalId: teklif.id,
        ...alan,
      });
      setKaydediliyor(null);
      if (!res.success) setHata(res.error);
      else kaydedildiGoster(itemId);
    });
  }

  function kalemSil(itemId: string) {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await deleteProposalItem({ itemId, proposalId: teklif.id });
      if (!res.success) setHata(res.error);
    });
  }

  function yeniSurum() {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await newProposalVersion(teklif.id);
      if (!res.success) setHata(res.error);
      else setBilgi('Yeni sürüm açıldı; kalemler kopyalandı.');
    });
  }

  function kapat() {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await closeProposal(teklif.id);
      if (!res.success) setHata(res.error);
      else setBilgi('Teklif kapatıldı.');
    });
  }

  function rezervasyonOlustur() {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await createBookingFromProposal(teklif.id);
      if (!res.success) {
        setHata(res.error);
        return;
      }
      setBilgi('Rezervasyon oluşturuldu.');
      router.refresh();
    });
  }

  function taslakSil() {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await deleteDraftProposal(teklif.id);
      if (!res.success) {
        setHata(res.error);
        return;
      }
      router.push('/ajans/teklifler');
    });
  }

  function baglantiIptal(linkId: string) {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await revokeProposalLink({ linkId, proposalId: teklif.id });
      if (!res.success) setHata(res.error);
      else setBilgi('Bağlantı iptal edildi.');
    });
  }

  function gonder() {
    const gun = sayi(gecerlilikGun);
    if (gun === null || gun < 1 || gun > 365) {
      setHata('Geçerlilik 1-365 gün olmalı.');
      return;
    }
    mesajlariTemizle();
    startTransition(async () => {
      const res = await sendProposal({
        proposalId: teklif.id,
        validDays: Math.trunc(gun),
      });
      if (!res.success) {
        setHata(res.error);
        return;
      }
      setGonderOnayi(false);
      setBaglantiKutusu(res.data!.link);
      setMailNotu(res.data!.mailReason ?? null);
      setBilgi(
        res.data!.mailSent
          ? 'Teklif gönderildi; e-posta müşteriye ulaştı.'
          : 'Teklif gönderildi.'
      );
    });
  }

  function maliyetKartiAc() {
    if (!gecerliSurum) return;
    setMaliyetHatasi(null);
    if (maliyetAcik) {
      setMaliyetAcik(false);
      return;
    }
    setMaliyetAcik(true);
    startTransition(async () => {
      const res = await listProposalInternalItems({
        versionId: gecerliSurum.id,
        organizationId: teklif.seller_organization_id,
      });
      if (res.success) setIcKalemler(res.data ?? []);
      else setMaliyetHatasi(res.error);
    });
  }

  async function maliyetTazele() {
    if (!gecerliSurum) return;
    const res = await listProposalInternalItems({
      versionId: gecerliSurum.id,
      organizationId: teklif.seller_organization_id,
    });
    if (res.success) setIcKalemler(res.data ?? []);
  }

  function maliyetKaydet() {
    if (!maliyetForm) return;
    const n = sayi(maliyetForm.cost);
    if (n === null || n < 0) {
      setMaliyetHatasi('Maliyet 0 veya daha büyük olmalı.');
      return;
    }
    setMaliyetHatasi(null);
    const girdi = maliyetForm;
    startTransition(async () => {
      const res = await upsertProposalItemCost({
        itemId: girdi.itemId,
        proposalId: teklif.id,
        organizationId: teklif.seller_organization_id,
        internalCost: n,
        note: girdi.note,
      });
      if (!res.success) {
        setMaliyetHatasi(res.error);
        return;
      }
      setMaliyetForm(null);
      await maliyetTazele();
    });
  }

  const icToplamMaliyet = (icKalemler ?? []).reduce((acc, k) => {
    const m = Number(k.internal_cost);
    const adet = Number(k.quantity);
    return acc + (Number.isFinite(m) && Number.isFinite(adet) ? m * adet : 0);
  }, 0);
  const icToplamMarkup = (icKalemler ?? []).reduce((acc, k) => {
    const m = Number(k.markup_amount);
    return acc + (Number.isFinite(m) ? m : 0);
  }, 0);

  return (
    <div className="space-y-5">
      {/* Baslik satiri */}
      <div className="bg-card border border-line rounded-lg p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            {canManage ? (
              <input
                type="text"
                value={baslik}
                onChange={(e) => setBaslik(e.target.value.slice(0, 200))}
                onBlur={basligiKaydet}
                className="w-full font-display text-2xl text-ink bg-transparent border-b border-transparent hover:border-line focus:border-brand-ink focus:outline-none"
              />
            ) : (
              <p className="font-display text-2xl text-ink">{teklif.title}</p>
            )}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl">
              {canManage ? (
                <>
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
                    onChange={(e) =>
                      setMusteriEposta(e.target.value.slice(0, 200))
                    }
                    onBlur={musteriKaydet}
                    placeholder="Müşteri e-postası"
                    className={ALAN}
                  />
                </>
              ) : (
                <p className="text-sm text-ink-72">
                  {teklif.client_name || teklif.client_email || 'Müşteri girilmedi'}
                </p>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
              {TEKLIF_DURUM_ETIKETLERI[teklif.status] ?? teklif.status}
            </p>
            {kaydediliyor === 'ust' ? (
              <p className="text-xs text-ink-50 mt-1">Kaydediliyor…</p>
            ) : kaydedildi === 'ust' ? (
              <p className="text-xs text-moss mt-1">Kaydedildi</p>
            ) : null}
            {gecerliSurum && (
              <p className="font-display font-semibold text-ink mt-1">
                Sürüm {gecerliSurum.version_no}
              </p>
            )}
            {teklif.status === 'approved' && gecerliSurum?.approved_at && (
              <p className="text-xs text-moss mt-1">
                Onaylandı · {gecerliSurum.approved_by_name ?? 'Müşteri'} ·{' '}
                {zamanMetni(gecerliSurum.approved_at)}
              </p>
            )}

            {/* FAZ 7c — rezervasyon: varsa rozet + baglanti, yoksa olusturma */}
            {rezervasyon ? (
              <div className="mt-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72">
                  Rezervasyon:{' '}
                  {REZERVASYON_DURUM_ETIKETLERI[rezervasyon.status] ??
                    rezervasyon.status}
                </p>
                <Link
                  href={`/rezervasyon/${rezervasyon.id}`}
                  className="kashe-tap text-sm text-brand-ink hover:underline"
                >
                  Rezervasyona git
                </Link>
              </div>
            ) : (
              canManage &&
              teklif.status === 'approved' && (
                <button
                  type="button"
                  onClick={() => setOnay({ tur: 'rezervasyon' })}
                  disabled={isPending}
                  className={`${BTN_IKINCIL} mt-2`}
                >
                  Rezervasyon oluştur
                </button>
              )
            )}
          </div>
        </div>

        {/* Rezervasyon onayi — kritik islem, tek tikla gecilmez */}
        {onay?.tur === 'rezervasyon' && gecerliSurum && (
          <div className="mt-3 px-4 py-3 bg-paper border border-line-strong rounded-lg flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-ink">
              {teklif.title} için{' '}
              {paraMetni(gecerliSurum.total_amount, gecerliSurum.currency) ??
                '—'}{' '}
              tutarında rezervasyon oluşturulacak. Emin misin?
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setOnay(null);
                  rezervasyonOlustur();
                }}
                className={BTN_BIRINCIL}
              >
                Oluştur
              </button>
              <button
                type="button"
                onClick={() => setOnay(null)}
                className={BTN_IKINCIL}
              >
                Vazgeç
              </button>
            </div>
          </div>
        )}

        {hata && <p className="text-sm text-danger mt-3">{hata}</p>}
        {bilgi && <p className="text-sm text-moss mt-3">{bilgi}</p>}

        {teklif.status === 'revision_requested' && gecerliSurum?.client_note && (
          <div className="mt-3 px-4 py-3 bg-amber-500/10 border border-amber-500/40 rounded-lg">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-1">
              Müşterinin revizyon notu
            </p>
            <p className="text-sm text-ink whitespace-pre-wrap">
              {gecerliSurum.client_note}
            </p>
          </div>
        )}

        {surumler.length > 1 && (
          <details className="mt-4">
            <summary className="kashe-tap text-sm text-brand-ink cursor-pointer">
              Eski sürümler ({surumler.length - 1})
            </summary>
            <ul className="mt-2 space-y-1 text-sm text-ink-72">
              {surumler
                .filter((s) => s.id !== gecerliSurum?.id)
                .map((s) => (
                  <li key={s.id}>
                    Sürüm {s.version_no} · {tarihMetni(s.created_at)} ·{' '}
                    {paraMetni(s.total_amount, s.currency) ?? '—'} ·{' '}
                    {s.sent_at
                      ? `gönderildi ${tarihMetni(s.sent_at)}`
                      : 'gönderilmedi'}
                    {s.approved_by_name ? ` · onay: ${s.approved_by_name}` : ''}
                  </li>
                ))}
            </ul>
          </details>
        )}
      </div>

      {/* Kalemler */}
      {gecerliSurum && (
        <div className="bg-card border border-line rounded-lg p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
            <p className="font-display font-semibold text-ink">Kalemler</p>
            {dondurulmus && (
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72">
                Gönderildi — kilitli
              </span>
            )}
          </div>
          {/* Kaydet dugmesi yok: alandan cikinca kaydedilir (P2-ek bulgusu) */}
          {duzenlenebilir && (
            <p className="text-xs text-ink-50 mb-3">
              Değişiklikler alandan çıkınca kaydedilir.
            </p>
          )}
          {!duzenlenebilir && <div className="mb-3" />}

          {kalemler.length === 0 ? (
            <p className="text-sm text-ink-72">Henüz kalem yok.</p>
          ) : (
            <div className="space-y-2">
              {/* Sutun basliklari — mobilde her girdinin ustunde kendi etiketi var */}
              <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
                <span className="sm:col-span-5">Açıklama</span>
                <span className="sm:col-span-2">Adet</span>
                <span className="sm:col-span-2">Birim fiyat (TL)</span>
                <span className="sm:col-span-2 text-right">Toplam</span>
                <span className="sm:col-span-1" />
              </div>
              {kalemler.map((k) => (
                <div
                  key={k.id}
                  className={
                    k.is_visible_to_client
                      ? 'border border-line rounded-lg p-3'
                      : 'border border-line rounded-lg p-3 opacity-60'
                  }
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-5">
                      {duzenlenebilir ? (
                        <>
                          <label className="sm:hidden block text-[10px] uppercase tracking-[0.14em] font-mono text-ink-72 mb-1">
                            Açıklama
                          </label>
                        <input
                          ref={(el) => {
                            aciklamaRefleri.current[k.id] = el;
                          }}
                          type="text"
                          defaultValue={k.description}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== k.description) {
                              kalemGuncelle(k.id, { description: v });
                            }
                          }}
                          className={`${ALAN} w-full`}
                        />
                        </>
                      ) : (
                        <p className="text-sm text-ink">{k.description}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      {duzenlenebilir ? (
                        <>
                          <label className="sm:hidden block text-[10px] uppercase tracking-[0.14em] font-mono text-ink-72 mb-1">
                            Adet
                          </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          defaultValue={String(k.quantity)}
                          onBlur={(e) => {
                            const n = sayi(e.target.value);
                            if (n !== null && n !== Number(k.quantity)) {
                              kalemGuncelle(k.id, { quantity: n });
                            }
                          }}
                          placeholder="Adet"
                          className={`${ALAN} w-full`}
                        />
                        </>
                      ) : (
                        <p className="text-sm text-ink-72">{k.quantity} adet</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      {duzenlenebilir ? (
                        <>
                          <label className="sm:hidden block text-[10px] uppercase tracking-[0.14em] font-mono text-ink-72 mb-1">
                            Birim fiyat (TL)
                          </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          /* 0 ise bos gelir ki placeholder gorunsun; bos birakilirsa 0 kalir */
                          defaultValue={
                            Number(k.unit_client_price) === 0
                              ? ''
                              : String(k.unit_client_price)
                          }
                          onBlur={(e) => {
                            const n = sayi(e.target.value);
                            if (n !== null && n !== Number(k.unit_client_price)) {
                              kalemGuncelle(k.id, { unitPrice: n });
                            }
                          }}
                          placeholder="Birim fiyat (TL)"
                          className={`${ALAN} w-full`}
                        />
                        </>
                      ) : (
                        <p className="text-sm text-ink-72">
                          {paraMetni(k.unit_client_price) ?? '—'}
                        </p>
                      )}
                    </div>
                    <div className="sm:col-span-2 sm:text-right">
                      <p className="text-sm font-display font-semibold text-ink">
                        <span className="sm:hidden font-body font-normal text-ink-72">
                          Toplam:{' '}
                        </span>
                        {paraMetni(k.total_client_price) ?? '—'}
                      </p>
                    </div>
                    <div className="sm:col-span-1 flex items-center justify-end gap-1">
                      {duzenlenebilir && (
                        <button
                          type="button"
                          onClick={() => setOnay({ tur: 'kalemSil', id: k.id })}
                          disabled={isPending}
                          className={BTN_IKINCIL}
                        >
                          Sil
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                    <label className="inline-flex items-center gap-2 text-xs text-ink-72">
                      <input
                        type="checkbox"
                        checked={k.is_visible_to_client}
                        disabled={!duzenlenebilir || isPending}
                        onChange={(e) =>
                          kalemGuncelle(k.id, { isVisible: e.target.checked })
                        }
                      />
                      Müşteriye görünür
                    </label>
                    <span className="inline-flex items-center gap-3">
                      {!k.is_visible_to_client && (
                        <span className="text-xs text-ink-50">
                          Gizli kalem — toplama girmez
                        </span>
                      )}
                      {kaydediliyor === k.id ? (
                        <span className="text-xs text-ink-50">Kaydediliyor…</span>
                      ) : kaydedildi === k.id ? (
                        <span className="text-xs text-moss">Kaydedildi</span>
                      ) : null}
                    </span>
                  </div>

                  {onay?.tur === 'kalemSil' && onay.id === k.id && (
                    <div className="mt-2 px-3 py-2 bg-paper border border-line-strong rounded-lg flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-sm text-ink">
                        Bu kalem silinecek. Emin misin?
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            setOnay(null);
                            kalemSil(k.id);
                          }}
                          className={BTN_BIRINCIL}
                        >
                          Sil
                        </button>
                        <button
                          type="button"
                          onClick={() => setOnay(null)}
                          className={BTN_IKINCIL}
                        >
                          Vazgeç
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {duzenlenebilir && (
            <button
              type="button"
              onClick={kalemEkle}
              disabled={isPending}
              className={`${BTN_IKINCIL} mt-3`}
            >
              Kalem ekle
            </button>
          )}

          {/* Surum alanlari + toplamlar (toplamlar DB'den) */}
          <div className="mt-5 pt-5 border-t border-line grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs text-ink-72 w-28">KDV oranı (%)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={kdv}
                  disabled={!duzenlenebilir}
                  onChange={(e) => setKdv(e.target.value)}
                  onBlur={() => surumKaydet('kdv')}
                  className={`${ALAN} w-24`}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs text-ink-72 w-28">Geçerlilik</label>
                <input
                  type="date"
                  value={gecerlilik}
                  disabled={!duzenlenebilir}
                  onChange={(e) => setGecerlilik(e.target.value)}
                  onBlur={() => surumKaydet('gecerlilik')}
                  className={`${ALAN} w-44`}
                />
              </div>
              <div>
                <label className="block text-xs text-ink-72 mb-1">
                  Müşteri notu
                </label>
                <textarea
                  value={notlar}
                  disabled={!duzenlenebilir}
                  rows={3}
                  onChange={(e) => setNotlar(e.target.value.slice(0, 4000))}
                  onBlur={() => surumKaydet('notlar')}
                  className={`${ALAN} w-full`}
                />
              </div>
            </div>

            <div className="space-y-1.5 text-sm lg:text-right">
              <p className="text-ink-72">
                Ara toplam:{' '}
                <span className="text-ink">
                  {paraMetni(gecerliSurum.subtotal, gecerliSurum.currency) ?? '—'}
                </span>
              </p>
              <p className="text-ink-72">
                KDV ({kdvYuzdesi(gecerliSurum.tax_rate)}%):{' '}
                <span className="text-ink">
                  {paraMetni(gecerliSurum.tax_amount, gecerliSurum.currency) ??
                    '—'}
                </span>
              </p>
              <p className="font-display font-semibold text-lg text-ink">
                Genel toplam:{' '}
                {paraMetni(gecerliSurum.total_amount, gecerliSurum.currency) ??
                  '—'}
              </p>
              <p className="text-xs text-ink-50">
                Toplamlar sunucuda hesaplanır; gizli kalemler toplama girmez.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Durum islemleri */}
      {canManage && gecerliSurum && (
        <div className="bg-card border border-line rounded-lg p-5">
          <div className="flex items-center gap-2 flex-wrap">
            {teklif.status === 'draft' && !dondurulmus && (
              <button
                type="button"
                onClick={() => setGonderOnayi(true)}
                disabled={isPending}
                className={BTN_BIRINCIL}
              >
                Gönder
              </button>
            )}
            {['sent', 'viewed', 'revision_requested', 'expired'].includes(
              teklif.status
            ) && (
              <>
                <button
                  type="button"
                  onClick={yeniSurum}
                  disabled={isPending}
                  className={BTN_BIRINCIL}
                >
                  Yeni sürüm
                </button>
                <button
                  type="button"
                  onClick={() => setOnay({ tur: 'kapat' })}
                  disabled={isPending}
                  className={BTN_IKINCIL}
                >
                  Kapat
                </button>
              </>
            )}
            {teklif.status === 'approved' && (
              <p className="text-sm text-ink-72">
                Onaylanmış teklifte değişiklik yapılamaz.
              </p>
            )}
            {silinebilir && (
              <button
                type="button"
                onClick={() => setOnay({ tur: 'taslakSil' })}
                disabled={isPending}
                className={BTN_IKINCIL}
              >
                Taslağı sil
              </button>
            )}
          </div>

          {onay?.tur === 'taslakSil' && (
            <div className="mt-3 px-4 py-3 bg-paper border border-line-strong rounded-lg flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm text-ink">
                {teklif.title} silinecek. Emin misin?
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setOnay(null);
                    taslakSil();
                  }}
                  className={BTN_BIRINCIL}
                >
                  Sil
                </button>
                <button
                  type="button"
                  onClick={() => setOnay(null)}
                  className={BTN_IKINCIL}
                >
                  Vazgeç
                </button>
              </div>
            </div>
          )}

          {onay?.tur === 'kapat' && (
            <div className="mt-3 px-4 py-3 bg-paper border border-line-strong rounded-lg flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm text-ink">
                Teklif kapatılacak ve bağlantılar iptal edilecek. Emin misin?
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setOnay(null);
                    kapat();
                  }}
                  className={BTN_BIRINCIL}
                >
                  Kapat
                </button>
                <button
                  type="button"
                  onClick={() => setOnay(null)}
                  className={BTN_IKINCIL}
                >
                  Vazgeç
                </button>
              </div>
            </div>
          )}

          {/* Gonderim onay ekrani — tek tikla gecilmez (05) */}
          {gonderOnayi && (
            <div className="mt-3 px-4 py-4 bg-paper border border-line-strong rounded-lg space-y-3">
              <p className="font-display font-semibold text-ink">
                Teklifi gönder
              </p>
              <ul className="text-sm text-ink-72 space-y-1">
                <li>
                  Görünür kalem:{' '}
                  {kalemler.filter((k) => k.is_visible_to_client).length}
                </li>
                <li>
                  Toplam (KDV dahil):{' '}
                  {paraMetni(gecerliSurum.total_amount, gecerliSurum.currency) ??
                    '—'}
                </li>
                <li>
                  Alıcı e-posta:{' '}
                  {teklif.client_email || 'yok — bağlantıyı elle iletmen gerekir'}
                </li>
              </ul>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-xs text-ink-72">Geçerlilik (gün)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={gecerlilikGun}
                  onChange={(e) => setGecerlilikGun(e.target.value)}
                  className={`${ALAN} w-20`}
                />
              </div>
              <p className="text-xs text-ink-50">
                Gönderdikten sonra bu sürüm kilitlenir; değişiklik için yeni
                sürüm açman gerekir.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={gonder}
                  disabled={isPending}
                  className={BTN_BIRINCIL}
                >
                  {isPending ? 'Gönderiliyor…' : 'Onayla ve gönder'}
                </button>
                <button
                  type="button"
                  onClick={() => setGonderOnayi(false)}
                  className={BTN_IKINCIL}
                >
                  Vazgeç
                </button>
              </div>
            </div>
          )}

          {/* Ham jeton: YALNIZ bir kez, yalniz ekranda */}
          {baglantiKutusu && (
            <div className="mt-3 px-4 py-4 bg-brand-ink-08 border border-brand-ink/25 rounded-lg space-y-2">
              <p className="font-display font-semibold text-ink">
                Müşteri bağlantısı
              </p>
              <p className="text-sm text-ink break-all font-mono">
                {baglantiKutusu}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(baglantiKutusu)
                      .then(() => setKopyalandi(true))
                      .catch(() => setKopyalandi(false));
                  }}
                  className={BTN_IKINCIL}
                >
                  {kopyalandi ? 'Kopyalandı' : 'Kopyala'}
                </button>
              </div>
              <p className="text-xs text-ink-72">
                Bu bağlantı bir daha gösterilmez. Yeniden göndermek için yeni
                sürüm aç.
              </p>
              {mailNotu && <p className="text-xs text-danger">{mailNotu}</p>}
            </div>
          )}
        </div>
      )}

      {/* Portal baglantilari */}
      {baglantilar.length > 0 && (
        <div className="bg-card border border-line rounded-lg p-5">
          <p className="font-display font-semibold text-ink mb-3">
            Müşteri bağlantıları
          </p>
          <ul className="space-y-2">
            {baglantilar.map((b) => (
              <li key={b.id} className="border border-line rounded-lg p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm text-ink">
                      {b.revoked_at ? 'İptal edildi' : 'Bağlantı gönderildi'}:{' '}
                      {b.recipient_email ?? 'e-posta yok'} · {b.view_count}{' '}
                      görüntüleme
                    </p>
                    <p className="text-xs text-ink-72 mt-0.5">
                      {b.last_viewed_at
                        ? `Son görüntüleme: ${zamanMetni(b.last_viewed_at)} · `
                        : ''}
                      Geçerlilik: {tarihMetni(b.expires_at) ?? '—'}
                    </p>
                  </div>
                  {canManage && !b.revoked_at && (
                    <button
                      type="button"
                      onClick={() => setOnay({ tur: 'baglantiIptal', id: b.id })}
                      disabled={isPending}
                      className={BTN_IKINCIL}
                    >
                      Bağlantıyı iptal et
                    </button>
                  )}
                </div>

                {onay?.tur === 'baglantiIptal' && onay.id === b.id && (
                  <div className="mt-2 px-3 py-2 bg-paper border border-line-strong rounded-lg flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm text-ink">
                      Bağlantı iptal edilecek; müşteri bir daha açamaz. Emin
                      misin?
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          setOnay(null);
                          baglantiIptal(b.id);
                        }}
                        className={BTN_BIRINCIL}
                      >
                        İptal et
                      </button>
                      <button
                        type="button"
                        onClick={() => setOnay(null)}
                        className={BTN_IKINCIL}
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!aktifBaglanti && (
            <p className="text-xs text-ink-50 mt-3">
              Bağlantı yalnızca gönderim anında görüntülenir; yeniden göndermek
              için yeni sürüm aç.
            </p>
          )}
        </div>
      )}

      {/* Gizli ic maliyet ve marj */}
      {maliyetGorulur && gecerliSurum && (
        <div className="bg-card border border-line rounded-lg p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="font-display font-semibold text-ink">
              İç maliyet ve marj
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 bg-paper-2 border border-line px-2 py-0.5 rounded">
                Gizli — yalnız ticari yetkililer görür
              </span>
              <button
                type="button"
                onClick={maliyetKartiAc}
                className={BTN_IKINCIL}
              >
                {maliyetAcik ? 'Kapat' : 'Aç'}
              </button>
            </div>
          </div>

          {maliyetAcik && (
            <div className="mt-4 space-y-3">
              {maliyetHatasi && (
                <p className="text-sm text-danger">{maliyetHatasi}</p>
              )}
              {icKalemler === null ? (
                <p className="text-sm text-ink-72">Yükleniyor…</p>
              ) : icKalemler.length === 0 ? (
                <p className="text-sm text-ink-72">Kalem yok.</p>
              ) : (
                <>
                  {icKalemler.map((k) => {
                    const marj = marjYuzdesi(k.margin_rate);
                    return (
                      <div
                        key={k.item_id}
                        className="border border-line rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-sm text-ink">
                              {k.description}
                              {!k.is_visible_to_client && (
                                <span className="ml-2 text-xs text-ink-50">
                                  (gizli kalem)
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-ink-72 mt-0.5">
                              Müşteri: {paraMetni(k.total_client_price) ?? '—'}
                              {k.internal_cost != null
                                ? ` · iç maliyet ${paraMetni(k.internal_cost)} (birim)`
                                : ' · iç maliyet girilmedi'}
                              {k.markup_amount != null
                                ? ` · markup ${paraMetni(k.markup_amount)}`
                                : ''}
                              {marj !== null ? ` · marj %${marj}` : ''}
                              {k.source
                                ? ` · ${IC_KALEM_KAYNAK_ETIKETLERI[k.source] ?? k.source}`
                                : ''}
                            </p>
                            {k.private_note && (
                              <p className="text-sm text-ink-72 mt-1">
                                Not: {k.private_note}
                              </p>
                            )}
                          </div>
                          {maliyetYazilir && !dondurulmus && (
                            <button
                              type="button"
                              onClick={() =>
                                setMaliyetForm({
                                  itemId: k.item_id,
                                  cost:
                                    k.internal_cost != null
                                      ? String(k.internal_cost)
                                      : '',
                                  note: k.private_note ?? '',
                                })
                              }
                              className={BTN_IKINCIL}
                            >
                              Maliyeti düzenle
                            </button>
                          )}
                        </div>

                        {maliyetForm?.itemId === k.item_id && (
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={maliyetForm.cost}
                              onChange={(e) =>
                                setMaliyetForm({
                                  ...maliyetForm,
                                  cost: e.target.value,
                                })
                              }
                              placeholder="Birim iç maliyet (TL)"
                              className={ALAN}
                            />
                            <input
                              type="text"
                              value={maliyetForm.note}
                              onChange={(e) =>
                                setMaliyetForm({
                                  ...maliyetForm,
                                  note: e.target.value,
                                })
                              }
                              placeholder="Not (isteğe bağlı)"
                              className={ALAN}
                            />
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={maliyetKaydet}
                                disabled={isPending}
                                className={BTN_BIRINCIL}
                              >
                                Kaydet
                              </button>
                              <button
                                type="button"
                                onClick={() => setMaliyetForm(null)}
                                className={BTN_IKINCIL}
                              >
                                Vazgeç
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="pt-3 border-t border-line text-sm text-ink-72">
                    Toplam iç maliyet:{' '}
                    <span className="text-ink">
                      {paraMetni(icToplamMaliyet) ?? '—'}
                    </span>{' '}
                    · toplam marj:{' '}
                    <span className="text-ink">
                      {paraMetni(icToplamMarkup) ?? '—'}
                    </span>
                  </div>
                </>
              )}
              {dondurulmus && (
                <p className="text-xs text-ink-50">
                  Sürüm gönderildi; iç maliyet salt okunur.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
