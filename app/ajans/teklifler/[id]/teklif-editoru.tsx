'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TEKLIF_DURUM_ETIKETLERI,
  kdvYuzdesi,
  paraMetni,
  tarihAlani,
  tarihMetni,
  zamanMetni,
  type IcKalemSatiri,
  type KalemSatiri,
  type PortalBaglantisi,
  type RfpBaglami,
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
import { takvimiAc } from '@/app/lib/tarih-girdisi';
import { OzetSerit } from '@/app/components/panel';
import { TeklifBelgesi } from '@/app/components/teklif/teklif-belgesi';
import { TeklifBaslik, type KisiBagi } from './teklif-baslik';
import {
  TeklifKalemTablosu,
  type IcMaliyetYazma,
} from './teklif-kalem-tablosu';
import { TeklifOzet } from './teklif-ozet';

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
  rfpBaglami,
  etkinlikOzeti,
  kurulusAdi,
  kisiBagi,
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
  /** FAZ 7b: RFP yaniti baglami; null ise dogrudan teklif (portal akisi). */
  rfpBaglami: RfpBaglami | null;
  /**
   * D1b-3: "Musteri gorunumu" belgesindeki etkinlik ozeti.
   *
   * Sayfa bunu YALNIZ erisim varsa doldurur (ayni RLS sorgusu); yoksa null
   * gecer ve belgede etkinlik bolumu hic cizilmez. Yeni bir okuma yolu YOK.
   */
  etkinlikOzeti: {
    title: string | null;
    event_type: string | null;
    start_date: string | null;
    city: string | null;
    participant_count: number | null;
  } | null;
  /**
   * D1b-4: satici kurulusun gorunen adi — musteri gorunumu belgesinin
   * basligi. Sayfa kurulusu `getCrewContext` ile zaten biliyor; belge
   * "Kashe kurulusu" yazmasin diye prop olarak gelir.
   */
  kurulusAdi: string | null;
  /** FAZ 8b: alici satirindaki CRM kisi bagi (RFP yanitinda null). */
  kisiBagi: KisiBagi;
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

  /** Ustteki Gecerlilik tarihi dolu mu — gonderim kutusu buna gore degisir. */
  const gecerlilikTarihiVar = gecerlilik.trim() !== '';

  // Gonderim onay ekrani + baglanti kutusu
  const [gonderOnayi, setGonderOnayi] = useState(false);
  // Baslik kartindaki dugme onay ekranini sayfanin altinda acar; kullanici
  // bir sey olmadigini sanmasin diye acilinca gorunur alana kaydirilir.
  const gonderOnayiRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (gonderOnayi) {
      gonderOnayiRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [gonderOnayi]);
  const [gecerlilikGun, setGecerlilikGun] = useState('14');
  const [baglantiKutusu, setBaglantiKutusu] = useState<string | null>(null);
  const [mailNotu, setMailNotu] = useState<string | null>(null);
  const [kopyalandi, setKopyalandi] = useState(false);

  // Ic maliyet — TEMBEL: tablo sutunu "Yukle" ile doldurulur, RPC o ana
  // kadar hic cagrilmaz (akordeon kalkti, davranis ayni).
  const [icKalemler, setIcKalemler] = useState<IcKalemSatiri[] | null>(null);
  const [maliyetYukleniyor, setMaliyetYukleniyor] = useState(false);
  const [maliyetHatasi, setMaliyetHatasi] = useState<string | null>(null);

  // Musteri gorunumu: editor govdesi yerine portalin gordugu belge.
  const [musteriGorunumu, setMusteriGorunumu] = useState(false);

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
    // Gecerlilik TEK YERDEN: ustteki tarih alani doluysa gun sorulmaz.
    // RPC `valid_until = COALESCE(valid_until, now() + days)` — tarih doluyken
    // gun zaten YOK SAYILIR; tip zorunlu oldugu icin 14 gonderilir.
    let gunDegeri = 14;
    if (!gecerlilikTarihiVar) {
      const gun = sayi(gecerlilikGun);
      if (gun === null || gun < 1 || gun > 365) {
        setHata('Geçerlilik 1-365 gün olmalı.');
        return;
      }
      gunDegeri = Math.trunc(gun);
    }
    mesajlariTemizle();
    startTransition(async () => {
      const res = await sendProposal({
        proposalId: teklif.id,
        validDays: gunDegeri,
      });
      if (!res.success) {
        setHata(res.error);
        return;
      }
      setGonderOnayi(false);
      // FAZ 7b: RFP yanitinda portal baglantisi YOK (action null doner).
      setBaglantiKutusu(res.data!.link);
      setMailNotu(res.data!.mailReason ?? null);
      setBilgi(
        res.data!.link === null
          ? 'Teklif alıcıya iletildi.'
          : res.data!.mailSent
            ? 'Teklif gönderildi; e-posta müşteriye ulaştı.'
            : 'Teklif gönderildi.'
      );
    });
  }

  /** Ic maliyet sutunlarini doldurur (tek seferlik; tembel). */
  function maliyetYukle() {
    if (!gecerliSurum) return;
    setMaliyetHatasi(null);
    setMaliyetYukleniyor(true);
    startTransition(async () => {
      const res = await listProposalInternalItems({
        versionId: gecerliSurum.id,
        organizationId: teklif.seller_organization_id,
      });
      setMaliyetYukleniyor(false);
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

  /**
   * Hucreden gelen ic maliyet yazimi. Ayni action, ayni argumanlar
   * (`upsertProposalItemCost` -> `internal_proposal_item_upsert`); degisen
   * yalniz girdinin karttan hucreye tasinmasi.
   */
  function maliyetYaz(girdi: IcMaliyetYazma) {
    if (girdi.internalCost < 0) {
      setMaliyetHatasi('Maliyet 0 veya daha büyük olmalı.');
      return;
    }
    setMaliyetHatasi(null);
    startTransition(async () => {
      const res = await upsertProposalItemCost({
        itemId: girdi.itemId,
        proposalId: teklif.id,
        organizationId: teklif.seller_organization_id,
        internalCost: girdi.internalCost,
        note: girdi.note,
      });
      if (!res.success) {
        setMaliyetHatasi(res.error);
        return;
      }
      await maliyetTazele();
    });
  }

  // Maliyet/marj TOPLAMLARI `TeklifOzet` icinde turetilir (yalniz gosterim).
  const gonderilebilir =
    canManage && teklif.status === 'draft' && !dondurulmus && !!gecerliSurum;

  return (
    <div className="space-y-5">
      <TeklifBaslik
        teklif={teklif}
        gecerliSurum={gecerliSurum}
        rfpBaglami={rfpBaglami}
        rezervasyon={rezervasyon}
        canManage={canManage}
        kisiBagi={kisiBagi}
        baslik={baslik}
        setBaslik={setBaslik}
        basligiKaydet={basligiKaydet}
        musteriAdi={musteriAdi}
        setMusteriAdi={setMusteriAdi}
        musteriEposta={musteriEposta}
        setMusteriEposta={setMusteriEposta}
        musteriKaydet={musteriKaydet}
        kaydediliyor={kaydediliyor}
        kaydedildi={kaydedildi}
        gonderilebilir={gonderilebilir}
        onGonder={() => setGonderOnayi(true)}
        rezervasyonIstenebilir={canManage && teklif.status === 'approved'}
        onRezervasyonIste={() => setOnay({ tur: 'rezervasyon' })}
        musteriGorunumu={musteriGorunumu}
        setMusteriGorunumu={setMusteriGorunumu}
        isPending={isPending}
      />

      {/* Rezervasyon onayi — kritik islem, tek tikla gecilmez */}
      {onay?.tur === 'rezervasyon' && gecerliSurum && (
        <div className="px-4 py-3 bg-paper border border-line-strong rounded-lg flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-ink">
            {teklif.title} için{' '}
            {paraMetni(gecerliSurum.total_amount, gecerliSurum.currency) ?? '—'}{' '}
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

      {hata && <p className="text-sm text-danger">{hata}</p>}
      {bilgi && <p className="text-sm text-moss">{bilgi}</p>}

      {teklif.status === 'revision_requested' && gecerliSurum?.client_note && (
        <div className="px-4 py-3 bg-amber-500/10 border border-amber-500/40 rounded-lg">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-1">
            Müşterinin revizyon notu
          </p>
          <p className="text-sm text-ink whitespace-pre-wrap">
            {gecerliSurum.client_note}
          </p>
        </div>
      )}

      {/* MUSTERI GORUNUMU — editor govdesi yerine portalin gordugu belge.
          Ic maliyet bu yola HIC girmez: `TeklifBelgesi` prop tipinde boyle bir
          alan yok, yani yanlislik derleme hatasi olur. */}
      {musteriGorunumu && gecerliSurum ? (
        <>
          <div className="px-4 py-3 bg-brand-ink-08 border border-brand-ink/25 rounded-lg flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-ink">
              Müşterinin göreceği görünüm — düzenlemek için anahtarı kapat.
            </p>
            <button
              type="button"
              onClick={() => setMusteriGorunumu(false)}
              className={BTN_IKINCIL}
            >
              Düzenlemeye dön
            </button>
          </div>
          <TeklifBelgesi
            teklif={{
              seller_name: kurulusAdi,
              client_name: rfpBaglami
                ? (rfpBaglami.buyerName ?? teklif.client_name)
                : teklif.client_name,
              title: teklif.title,
              version_no: gecerliSurum.version_no,
              sent_at: gecerliSurum.sent_at,
              status: teklif.status,
              durumEtiketi:
                TEKLIF_DURUM_ETIKETLERI[teklif.status] ?? teklif.status,
              durumSinifi: 'bg-paper-2 border-line text-ink-72',
              event: etkinlikOzeti,
              items: kalemler
                .filter((k) => k.is_visible_to_client)
                .map((k) => ({
                  description: k.description,
                  role: null,
                  quantity: k.quantity,
                  unit_client_price: k.unit_client_price,
                  total_client_price: k.total_client_price,
                })),
              subtotal: gecerliSurum.subtotal,
              tax_rate: gecerliSurum.tax_rate,
              tax_amount: gecerliSurum.tax_amount,
              total_amount: gecerliSurum.total_amount,
              currency: gecerliSurum.currency,
              valid_until: gecerliSurum.valid_until,
              notes: gecerliSurum.notes,
            }}
          />
        </>
      ) : (
        <>

      {/* Kalemler — tablo + surum alanlari + ozet kutular */}
      {gecerliSurum && (
        <TeklifKalemTablosu
          kalemler={kalemler}
          icKalemler={icKalemler}
          duzenlenebilir={duzenlenebilir}
          dondurulmus={dondurulmus}
          maliyetGorulur={maliyetGorulur}
          maliyetYazilir={maliyetYazilir}
          maliyetYukleniyor={maliyetYukleniyor}
          maliyetHatasi={maliyetHatasi}
          onMaliyetYukle={maliyetYukle}
          onMaliyetYaz={maliyetYaz}
          kalemGuncelle={kalemGuncelle}
          kalemEkle={kalemEkle}
          silmeIstegi={(id) => setOnay({ tur: 'kalemSil', id })}
          silOnayi={onay?.tur === 'kalemSil' ? onay.id : null}
          silOnayla={(id) => {
            setOnay(null);
            kalemSil(id);
          }}
          silVazgec={() => setOnay(null)}
          aciklamaRefleri={aciklamaRefleri}
          kaydediliyor={kaydediliyor}
          kaydedildi={kaydedildi}
          isPending={isPending}
        />
      )}

      {/* Ozet kutular — toplamlar DB surum alanlarindan */}
      {gecerliSurum && (
        <TeklifOzet
          gecerliSurum={gecerliSurum}
          icKalemler={icKalemler}
          maliyetGorulur={maliyetGorulur}
        />
      )}

      {/* Surum alanlari — KDV, gecerlilik, musteri notu */}
      {gecerliSurum && (
        <div className="bg-card border border-line rounded-lg p-5 space-y-3">
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
              onClick={takvimiAc}
              value={gecerlilik}
              disabled={!duzenlenebilir}
              onChange={(e) => setGecerlilik(e.target.value)}
              onBlur={() => surumKaydet('gecerlilik')}
              className={`${ALAN} w-44`}
            />
            <span className="text-xs text-ink-50 w-full sm:w-auto">
              Boş bırakılırsa gönderirken gün sayısı sorulur.
            </span>
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
          <p className="text-xs text-ink-50">
            Toplamlar sunucuda hesaplanır; gizli kalemler toplama girmez.
          </p>
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
            <div
              ref={gonderOnayiRef}
              className="mt-3 px-4 py-4 bg-paper border border-line-strong rounded-lg space-y-3"
            >
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
                  {rfpBaglami
                    ? `Alıcı: ${rfpBaglami.buyerName ?? 'alıcı kuruluş'} (Kashe içinde görür)`
                    : `Alıcı e-posta: ${teklif.client_email || 'yok — bağlantıyı elle iletmen gerekir'}`}
                </li>
              </ul>
              {/* Gecerlilik TEK YERDEN: tarih doluysa gun girdisi gosterilmez
                  (RPC tarihi kullanir, gunu yok sayar) — iki yerde soru sorulup
                  biri sessizce yok sayilmasin. */}
              {gecerlilikTarihiVar ? (
                <p className="text-sm text-ink-72">
                  Geçerlilik: {tarihMetni(gecerlilik) ?? gecerlilik} ·{' '}
                  <span className="text-ink-50">
                    Üstteki Geçerlilik alanından değiştirilir.
                  </span>
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs text-ink-72">
                      Geçerlilik (gün)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={gecerlilikGun}
                      onChange={(e) => setGecerlilikGun(e.target.value)}
                      className={`${ALAN} w-20`}
                    />
                  </div>
                  <p className="text-xs text-ink-50">
                    Tarih girilmediği için gönderimden itibaren gün sayısı
                    kullanılır.
                  </p>
                </>
              )}
              <p className="text-xs text-ink-50">
                {rfpBaglami
                  ? 'Teklif alıcı kuruluşa iletilecek. Gönderdikten sonra bu sürüm kilitlenir; değişiklik için yeni sürüm açman gerekir.'
                  : 'Gönderdikten sonra bu sürüm kilitlenir; değişiklik için yeni sürüm açman gerekir.'}
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

      {/* Portal baglantilari — RFP yanitinda YOK (baglanti acilmaz) */}
      {!rfpBaglami && baglantilar.length > 0 && (
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

      {/* Eski gizli maliyet KARTI KALDIRILDI (D1b-3): ayni kalemler
          iki listede iki kez duruyordu. Veri ayni RPC yoluyla, artik kalem
          tablosunun son iki sutununda. */}

      {/* Eski surumler */}
      {surumler.length > 1 && (
        <details>
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
        </>
      )}

      {/* Telefonda yapiskan serit — masaustunde baslik kartindaki dugmeler
          ayni isi yapiyor, serit orada YOK. Dugme ayni akislara girer. */}
      {gecerliSurum && !musteriGorunumu && (
        <OzetSerit
          etiket="Genel toplam"
          deger={paraMetni(gecerliSurum.total_amount, gecerliSurum.currency) ?? '—'}
          altNot={`KDV %${kdvYuzdesi(gecerliSurum.tax_rate)} dahil`}
          aksiyon={
            gonderilebilir ? (
              <button
                type="button"
                onClick={() => setGonderOnayi(true)}
                disabled={isPending}
                className="kashe-tap px-4 py-2 bg-brand-accent text-paper rounded-lg font-display font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Teklifi gönder →
              </button>
            ) : canManage && ['sent', 'viewed', 'revision_requested', 'expired'].includes(teklif.status) ? (
              <button
                type="button"
                onClick={yeniSurum}
                disabled={isPending}
                className={BTN_BIRINCIL}
              >
                Yeni sürüm
              </button>
            ) : rezervasyon ? (
              <Link
                href={`/rezervasyon/${rezervasyon.id}`}
                className={BTN_BIRINCIL}
              >
                Rezervasyona git
              </Link>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
