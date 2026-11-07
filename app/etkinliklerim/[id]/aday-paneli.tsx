'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DESTEK_EPOSTA,
  kosuZamani,
  sureMetni,
  type AdayKarti,
  type AdayKosu,
  type AdayRolGrubu,
  type AramaSonucu,
} from './aday-data';
import {
  kasheRolAra,
  markCandidateClicked,
  markCandidatesShown,
  rolIhtiyaciGuncelle,
  runEventMatch,
} from './aday-actions';
import { addCrewMemberFromCandidate, createCrew } from './ekip-actions';
import { KpiKutu, OzetSerit, UyumHalkasi } from '@/app/components/panel';
import { formatTL } from '@/app/lib/para';
import { IletisimButton } from '@/app/p/[id]/iletisim-button';
import type { OnBehalfBusiness } from '@/app/components/on-behalf-selector';

/**
 * FAZ 6 / P1 + D3 — "Adaylar" bolumu.
 *
 * Siralama ve puan DB'den gelir (`final_rank`, `match_score`); panel YENIDEN
 * SIRALAMAZ, puan hesaplamaz, gerekce kodu uretmez. Kartlar sunucuda kuruldu.
 * Segment kontrolu yalniz GORUNUMU suzer: yeni kosu acmaz, `run_event_match`
 * cagri imzasi ve stratejisi degismez (varsayilan `hybrid`).
 *
 * Isaretleme RPC'leri YALNIZ etkinlik sahibinde cagrilir (baskasinda 42501 donerdi).
 *
 * UYDURMA SAYAC YOK: videodaki iki sayac (kac profilin tarandigi ve eslesmenin
 * kac saniye surdugu) DB'de tutulmuyor, bu yuzden ARAYUZE GIRMEZ. Gosterilen
 * her sayi bir sutundan gelir (`candidate_count`, rol grubu sayisi, ajans
 * aday sayisi).
 */

const BTN_BIRINCIL =
  'kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50';

const BTN_SERIT =
  'kashe-tap px-4 py-2.5 bg-brand-accent text-paper rounded-lg font-display font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-40';

/** Segment kontrol — yalniz gorunum suzgeci. */
const SEGMENTLER = [
  { anahtar: 'tekil', etiket: 'Tekil profesyonellerden ekip' },
  { anahtar: 'ajans', etiket: 'Tüm işi ajansa ver' },
  { anahtar: 'hibrit', etiket: 'Hibrit ekip' },
] as const;
type Segment = (typeof SEGMENTLER)[number]['anahtar'];

export type EtkinlikKisitlari = {
  /** "14 Mayis 2027" — sunucuda bicimlendi; yoksa musaitlik satiri yazilmaz. */
  tarihEtiketi: string | null;
  sehirVar: boolean;
  butceMin: number | null;
  butceMax: number | null;
};

/** `IletisimButton`'in istedigi baglam — sunucudan gelir, panel uretmez. */
export type TeklifBaglami = {
  girisYapildi: boolean;
  kullaniciProfesyonel: boolean;
  kullaniciId: string;
  yazilabilirIsletmeler: OnBehalfBusiness[];
};

function Rozet({ metin }: { metin: string }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72 bg-paper border border-line px-2 py-0.5 rounded">
      {metin}
    </span>
  );
}

function BasHarfler({ ad }: { ad: string }) {
  const harfler = ad
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toLocaleUpperCase('tr-TR');
  return (
    <div className="w-10 h-10 rounded-lg bg-brand-ink text-paper flex items-center justify-center font-display font-semibold text-sm shrink-0">
      {harfler || '?'}
    </div>
  );
}

function Avatar({ aday }: { aday: AdayKarti }) {
  if (!aday.avatarUrl) return <BasHarfler ad={aday.ad} />;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={aday.avatarUrl}
      alt={aday.ad}
      className="w-10 h-10 rounded-lg object-cover border border-line shrink-0"
    />
  );
}

/**
 * KOMPAKT ADAY KARTI (D3) — rol sutunlarinda.
 *
 * Secim kartin TAMAMINA yayilan ortu dugmeyle yapilir; "Profili gor" baglantisi
 * onun USTUNDE durur (ic ice <a>/<button> gecersiz olurdu). Desen kesfet
 * kartindan: ortu + `relative z-*` baglanti.
 *
 * Duzeltme 13-A (bulgu 124, HATA): ad, fiyat ve puan YAN YANA oldugu icin dar
 * sutunda ad harf harf kiriliyordu ("Ca n U."). Duzen DIKEY: avatar + ad /
 * sehir / gerekce tam genislikte, fiyat ve uyum alt satirda.
 * Duzeltme 13-B (bulgu 125): "Onerilen" yalniz kucuk etiket (pembe cerceve
 * yok); SECILI kart belirgin (koyu cerceve + zemin + "Secili" isareti).
 */
function RolAdayKarti({
  aday,
  secili,
  onSecim,
  onProfil,
}: {
  aday: AdayKarti;
  secili: boolean;
  onSecim: () => void;
  onProfil: (candidateId: string) => void;
}) {
  const gorunum = secili
    ? 'border-brand-ink bg-brand-ink/[0.05] ring-2 ring-brand-ink'
    : 'border-line bg-card hover:border-brand-ink/40';

  return (
    <div
      className={`relative border rounded-xl p-3 transition-colors ${gorunum}`}
    >
      <button
        type="button"
        onClick={onSecim}
        aria-pressed={secili}
        aria-label={`${aday.ad} ${secili ? 'seçimini kaldır' : 'seç'}`}
        className="kashe-tap absolute inset-0 z-0 rounded-xl"
      />

      <div className="relative z-10 pointer-events-none">
        {(aday.onerilen || aday.ajans || aday.aramadan || secili) && (
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              {aday.onerilen && (
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-brand-accent">
                  Önerilen
                </span>
              )}
              {aday.ajans && (
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper bg-brand-ink px-1.5 py-0.5 rounded">
                  Ajans
                </span>
              )}
              {aday.aramadan && (
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-72 bg-paper-2 border border-line px-1.5 py-0.5 rounded">
                  Kashe araması
                </span>
              )}
            </div>
            {secili && (
              <span className="shrink-0 inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-paper bg-brand-ink px-1.5 py-0.5 rounded">
                <span aria-hidden="true">✓</span> Seçili
              </span>
            )}
          </div>
        )}

        <div className="flex items-start gap-2.5 min-w-0">
          <Avatar aday={aday} />
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-ink text-sm leading-snug [overflow-wrap:anywhere]">
              {aday.ad}
            </p>
            {(aday.sehir || aday.gerekceler.length > 0 || aday.kapsam !== null) && (
              <p className="text-xs text-ink-72 mt-0.5 leading-snug">
                {[
                  aday.sehir,
                  aday.ajans && aday.kapsam !== null ? `Kapsam %${aday.kapsam}` : null,
                  ...aday.gerekceler.slice(0, 2),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-ink-72 tabular-nums">
            {aday.baslangicFiyati !== null
              ? `${formatTL(aday.baslangicFiyati)}'den`
              : ''}
          </span>
          {!aday.aramadan && <UyumHalkasi yuzde={aday.uyum} boyut={34} />}
        </div>

        {aday.musaitlikEtiketi && (
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-moss bg-moss/10 border border-moss/25 px-2 py-0.5 rounded inline-block mt-2">
            {aday.musaitlikEtiketi} müsait
          </p>
        )}

        <div className="mt-2 pointer-events-auto">
          <Link
            href={`/p/${aday.providerId}`}
            onClick={() => onProfil(aday.id)}
            className="kashe-tap relative z-20 text-xs text-brand-ink hover:underline"
          >
            Profili gör
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Duzeltme 13-C: rol sutununda "Kashe'den ara ve ekle". Sonuc secilince
 * sutuna "Kashe aramasi" kartiyla SECILI olarak eklenir; ekip "Ekibi
 * olustur" ile ayni yoldan kurulur.
 */
function KasheArama({
  eventId,
  roleId,
  mevcutIdler,
  onSec,
}: {
  eventId: string;
  roleId: number;
  mevcutIdler: Set<string>;
  onSec: (sonuc: AramaSonucu) => void;
}) {
  const [acik, setAcik] = useState(false);
  const [sorgu, setSorgu] = useState('');
  const [sonuclar, setSonuclar] = useState<AramaSonucu[] | null>(null);
  const [aranan, setAranan] = useState('');
  const [hata, setHata] = useState<string | null>(null);
  const [araniyor, startAra] = useTransition();

  function ara() {
    setHata(null);
    startAra(async () => {
      const res = await kasheRolAra({
        eventId,
        roleId,
        sorgu,
        haric: [...mevcutIdler],
      });
      if (!res.success) {
        setHata(res.error);
        setSonuclar(null);
        return;
      }
      setSonuclar(res.sonuclar);
      setAranan(sorgu.trim());
    });
  }

  if (!acik) {
    return (
      <button
        type="button"
        onClick={() => {
          setAcik(true);
          if (sonuclar === null) ara();
        }}
        className="kashe-tap text-xs text-brand-ink hover:underline"
      >
        Kashe&apos;den ara ve ekle
      </button>
    );
  }

  const gorunen = (sonuclar ?? []).filter((r) => !mevcutIdler.has(r.providerId));

  return (
    <div className="bg-paper-2 border border-line rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={sorgu}
          onChange={(e) => setSorgu(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              ara();
            }
          }}
          placeholder="Ad ile ara (boş: bu roldeki herkes)"
          maxLength={60}
          className="min-w-0 flex-1 px-2.5 py-1.5 bg-card border border-line rounded-lg text-xs text-ink focus:outline-none focus:border-brand-ink"
        />
        <button
          type="button"
          onClick={ara}
          disabled={araniyor}
          className="kashe-tap shrink-0 px-2.5 py-1.5 bg-brand-ink text-paper rounded-lg text-xs font-display font-semibold disabled:opacity-50"
        >
          {araniyor ? '…' : 'Ara'}
        </button>
        <button
          type="button"
          onClick={() => setAcik(false)}
          aria-label="Aramayı kapat"
          className="kashe-tap shrink-0 w-7 h-7 rounded-full border border-line text-ink-72 hover:text-brand-ink text-base leading-none"
        >
          ×
        </button>
      </div>
      {hata && <p className="text-xs text-danger">{hata}</p>}
      {sonuclar !== null && gorunen.length === 0 && !araniyor && (
        <p className="text-xs text-ink-72">
          {aranan
            ? `“${aranan}” için listede olmayan sonuç yok.`
            : 'Bu rolde listede olmayan başka profesyonel yok.'}
        </p>
      )}
      {gorunen.length > 0 && (
        <ul className="space-y-1.5">
          {gorunen.map((r) => (
            <li
              key={r.providerId}
              className="flex items-center justify-between gap-2 bg-card border border-line rounded-lg px-2.5 py-2"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink [overflow-wrap:anywhere]">
                  {r.ad}
                  {r.ajans && (
                    <span className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-paper bg-brand-ink px-1 py-0.5 rounded align-middle">
                      Ajans
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-ink-72">
                  {[
                    r.sehir,
                    r.baslangicFiyati !== null ? `${formatTL(r.baslangicFiyati)}'den` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <Link
                  href={`/p/${r.providerId}`}
                  className="kashe-tap text-[11px] text-brand-ink hover:underline"
                >
                  Profil
                </Link>
                <button
                  type="button"
                  onClick={() => onSec(r)}
                  className="kashe-tap px-2 py-1 border border-brand-ink text-brand-ink rounded-md text-[11px] font-display font-semibold hover:bg-brand-ink hover:text-paper transition-colors"
                >
                  Seç
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** AJANS KARTI — tam hizmet yolu. Secim YOK: ajans yolu teklif/RFP ile yurur. */
function AjansAdayKarti({
  aday,
  eventId,
  rfpYolu,
  teklifBaglami,
  onProfil,
}: {
  aday: AdayKarti;
  eventId: string;
  /** Etkinlik kurulusa ait ve kullanici `events.manage` ise RFP yolu; yoksa null. */
  rfpYolu: string | null;
  teklifBaglami: TeklifBaglami;
  onProfil: (candidateId: string) => void;
}) {
  return (
    <div className="bg-card border border-line rounded-xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1 basis-64">
          <Avatar aday={aday} />
          <div className="min-w-0">
            <p className="font-display font-semibold text-ink break-words">
              {aday.ad}
            </p>
            <p className="text-sm text-ink-72 mt-0.5">
              {[
                aday.sehir,
                aday.kapsam !== null ? `Kapsam %${aday.kapsam}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {aday.headline && (
              <p className="text-sm text-ink-72 mt-1 break-words">
                {aday.headline}
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-3">
          {aday.baslangicFiyati !== null && (
            <span className="font-mono text-[11px] text-ink-72 tabular-nums">
              {formatTL(aday.baslangicFiyati)}&apos;den
            </span>
          )}
          <UyumHalkasi yuzde={aday.uyum} boyut={48} />
        </div>
      </div>

      {aday.tamHizmet === false && (
        <p className="text-sm text-ink-72 mt-2">
          Kısmi kapsam — bazı zorunlu roller karşılanmıyor
        </p>
      )}

      {(aday.tamHizmet === true || aday.gerekceler.length > 0) && (
        <div className="flex items-center gap-1.5 flex-wrap mt-3">
          {aday.tamHizmet === true && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper bg-brand-ink px-2 py-0.5 rounded">
              Tam hizmet
            </span>
          )}
          {aday.gerekceler.map((g) => (
            <Rozet key={g} metin={g} />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        {rfpYolu ? (
          <Link href={rfpYolu} className={BTN_BIRINCIL}>
            Teklif talebi aç →
          </Link>
        ) : (
          <IletisimButton
            professionalId={aday.providerId}
            professionalName={aday.ad}
            categorySlug={aday.kategoriSlug}
            isLoggedIn={teklifBaglami.girisYapildi}
            currentUserIsProfessional={teklifBaglami.kullaniciProfesyonel}
            isOwnProfile={teklifBaglami.kullaniciId === aday.providerId}
            writableBusinesses={teklifBaglami.yazilabilirIsletmeler}
            etkinlikId={eventId}
          />
        )}
        <Link
          href={`/p/${aday.providerId}`}
          onClick={() => onProfil(aday.id)}
          className="kashe-tap text-sm text-brand-ink hover:underline"
        >
          Profili gör
        </Link>
      </div>
    </div>
  );
}

export function AdayPaneli({
  eventId,
  sahip,
  durumUygun,
  sonKosu,
  oncekiKosular,
  ajansAdaylari,
  rolGruplari,
  eslestirIstegi,
  kisitlar,
  mevcutEkipId,
  ekipKurulusId,
  ekipYazilir,
  ihtiyacDuzenlenir,
  havuzYolu,
  rfpYolu,
  teklifBaglami,
  panelKabugunda,
}: {
  eventId: string;
  /** `events.owner_user_id === user.id` — dugme ve isaretleme yalniz sahipte. */
  sahip: boolean;
  /** Etkinlik durumu `confirmed` ya da `matching`. */
  durumUygun: boolean;
  sonKosu: AdayKosu | null;
  oncekiKosular: AdayKosu[];
  ajansAdaylari: AdayKarti[];
  rolGruplari: AdayRolGrubu[];
  /** `?eslestir=1` — sihirbaz onayindan geldiyse ilk kosu kendiliginden baslar. */
  eslestirIstegi: boolean;
  kisitlar: EtkinlikKisitlari;
  mevcutEkipId: string | null;
  /** Ekip kurulurken yazilacak kurulus; bireysel ekipte null. */
  ekipKurulusId: string | null;
  ekipYazilir: boolean;
  /** Duzeltme 13-B: "Bu rolden kac kisi?" duzenlenebilir mi (sahip / events.manage). */
  ihtiyacDuzenlenir: boolean;
  /** Duzeltme 13-C: havuz (sistem disi kisi) Ekip sekmesinde; yoksa null. */
  havuzYolu: string | null;
  rfpYolu: string | null;
  teklifBaglami: TeklifBaglami;
  /** Kurulus etkinligi `PanelKabugu` icinde; serit sol sutuna binmesin. */
  panelKabugunda: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [segment, setSegment] = useState<Segment>('hibrit');
  const [ekipKuruluyor, setEkipKuruluyor] = useState(false);

  // "Az once eslestirildi": cift tiklama ve yenileme ile gereksiz kosu uretimini onler.
  // Saat ILK RENDER'da okunmaz (sunucu/istemci farki = hidrasyon uyarisi); zamanlayici
  // mount sonrasi gunceller, o ana kadar deger null (sunucu ile ayni).
  const [simdi, setSimdi] = useState<number | null>(null);
  useEffect(() => {
    const tik = () => setSimdi(Date.now());
    const hemen = setTimeout(tik, 0);
    const araliksiz = setInterval(tik, 1000);
    return () => {
      clearTimeout(hemen);
      clearInterval(araliksiz);
    };
  }, []);

  const gosterilecekIdler = useMemo(
    () =>
      [...ajansAdaylari, ...rolGruplari.flatMap((g) => g.adaylar)]
        .filter((a) => !a.wasShown)
        .map((a) => a.id),
    [ajansAdaylari, rolGruplari]
  );

  // Gosterim isareti: KOSU basina bir kez. Muhafiz boolean DEGIL kosu id'si:
  // "yeniden eslestir" sonrasi sayfa tazelenir ama panel ayni ornekte kalir;
  // boolean olsa yeni kosunun adaylari hic isaretlenmezdi. State guncellemesi yok.
  const isaretlenenKosu = useRef<string | null>(null);
  const runId = sonKosu?.id ?? null;
  useEffect(() => {
    if (!sahip || !runId || gosterilecekIdler.length === 0) return;
    if (isaretlenenKosu.current === runId) return;
    isaretlenenKosu.current = runId;
    void markCandidatesShown(runId, gosterilecekIdler);
  }, [sahip, runId, gosterilecekIdler]);

  // `useCallback`: kimligi KARARLI kalir (bagimliliklari sabit), boylece
  // asagidaki otomatik kosu etkisinin bagimlilik listesine girebilir.
  const eslestir = useCallback(() => {
    setHata(null);
    // router.refresh() AYNI transition icinde: dugme, yeni liste gelene kadar pasif kalir.
    startTransition(async () => {
      const res = await runEventMatch(eventId);
      if (!res.success) {
        setHata(res.error);
        return;
      }
      router.refresh();
    });
  }, [eventId, router, startTransition]);

  /**
   * D3 — sihirbaz onayindan gelen ILK kosu. Dort kapi birlikte: istek var,
   * kullanici sahip, etkinlik onayli ve HENUZ kosu yok. `ref` ayni oturumda
   * ikinci cagriyi, `sonKosu !== null` ise yenilemeyi engeller.
   *
   * URL'deki `eslestir` `history.replaceState` ile silinir: `router.replace`
   * bir sunucu gezintisi daha baslatirdi, bu ise adres cubugunu sessizce
   * temizler. Dogruluk buna BAGLI DEGIL — kapilar zaten tekrari onluyor.
   */
  const otoKosuldu = useRef(false);
  useEffect(() => {
    if (!eslestirIstegi || !sahip || !durumUygun || sonKosu !== null) return;
    if (otoKosuldu.current) return;
    otoKosuldu.current = true;

    const p = new URLSearchParams(window.location.search);
    p.delete('eslestir');
    const qs = p.toString();
    window.history.replaceState(
      null,
      '',
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    );

    eslestir();
  }, [eslestirIstegi, sahip, durumUygun, sonKosu, eslestir]);

  // Son kosu 10 saniyeden yeni mi (yalniz mount sonrasi bilinir).
  const azOnce =
    !!sonKosu &&
    simdi !== null &&
    simdi - new Date(sonKosu.created_at).getTime() < 10000;

  function profilTiklandi(candidateId: string) {
    if (!sahip) return;
    startTransition(() => {
      void markCandidateClicked(candidateId);
    });
  }

  // ---- Rol ihtiyaci (Duzeltme 13-B) ----
  // Sunucudaki sayi `g.ihtiyac`; kullanici degistirdiyse yerel deger (kayit
  // basarisiz olursa geri alinir).
  const [yerelIhtiyac, setYerelIhtiyac] = useState<Record<number, number>>({});
  const [ihtiyacKaydediliyor, startIhtiyac] = useTransition();
  const ihtiyacOf = (g: AdayRolGrubu) => yerelIhtiyac[g.roleId] ?? g.ihtiyac;

  // ---- Kashe aramasindan eklenenler (Duzeltme 13-C) ----
  const [ekAdaylar, setEkAdaylar] = useState<Record<number, AdayKarti[]>>({});

  /**
   * Rol sutununun kartlari: eslestirme adaylari + (hibritte) o rolu kapsayan
   * ajanslar + aramadan eklenenler. Secim ve ekip kurma YALNIZ gorunen
   * kartlari sayar (tekil gorunumde secili ajans ekibe girmez).
   */
  const sutunKartlari = useCallback(
    (g: AdayRolGrubu): AdayKarti[] => [
      ...g.adaylar,
      ...(segment === 'hibrit' ? g.ajanslar : []),
      ...(ekAdaylar[g.roleId] ?? []),
    ],
    [ekAdaylar, segment]
  );

  // ---- Secim ----
  // Rol basina secili aday kimlikleri. Ilk acilista her rolun ONERILENI secili.
  const varsayilanSecim = useMemo(() => {
    const m: Record<number, string[]> = {};
    for (const g of rolGruplari) {
      const onerilen = g.adaylar.filter((a) => a.onerilen).slice(0, g.ihtiyac);
      if (onerilen.length > 0) m[g.roleId] = onerilen.map((a) => a.id);
    }
    return m;
  }, [rolGruplari]);

  const [secim, setSecim] = useState<Record<number, string[]>>(varsayilanSecim);

  // Yeni kosu geldiginde eski kosunun aday kimlikleri gecersiz: varsayilana don.
  const secimKosusu = useRef<string | null>(runId);
  useEffect(() => {
    if (secimKosusu.current === runId) return;
    secimKosusu.current = runId;
    setSecim(varsayilanSecim);
    setEkAdaylar({});
  }, [runId, varsayilanSecim]);

  /**
   * Secim degistir. Rol basina en cok `ihtiyac` kadar secilir.
   * `ihtiyac === 1` ise yeni secim eskisinin YERINE gecer (tek kisilik rolde
   * once bosaltmak gerekmesin); coklu rolde tavan dolunca tiklama bir sey
   * yapmaz — sutun basligindaki "<secili> / <ihtiyac> secili" tavani gosterir.
   */
  function secimDegistir(roleId: number, ihtiyac: number, candidateId: string) {
    setSecim((onceki) => {
      const mevcut = onceki[roleId] ?? [];
      if (mevcut.includes(candidateId)) {
        return { ...onceki, [roleId]: mevcut.filter((v) => v !== candidateId) };
      }
      if (mevcut.length >= ihtiyac) {
        if (ihtiyac === 1) return { ...onceki, [roleId]: [candidateId] };
        return onceki;
      }
      return { ...onceki, [roleId]: [...mevcut, candidateId] };
    });
  }

  /**
   * Duzeltme 13-B: kisi sayisini degistir. Azalinca fazla secimler sondan
   * birakilir. Kayit sunucuda (RLS: sahip / events.manage); hata olursa
   * yerel sayi geri alinir.
   */
  function ihtiyacDegistir(g: AdayRolGrubu, yeni: number) {
    if (yeni < 1 || yeni > 100) return;
    const onceki = ihtiyacOf(g);
    setHata(null);
    setYerelIhtiyac((m) => ({ ...m, [g.roleId]: yeni }));
    setSecim((m) => {
      const mevcut = m[g.roleId] ?? [];
      return mevcut.length > yeni ? { ...m, [g.roleId]: mevcut.slice(0, yeni) } : m;
    });
    startIhtiyac(async () => {
      const res = await rolIhtiyaciGuncelle({
        eventId,
        roleId: g.roleId,
        adet: yeni,
      });
      if (!res.success) {
        setHata(res.error);
        setYerelIhtiyac((m) => ({ ...m, [g.roleId]: onceki }));
      }
    });
  }

  /** Duzeltme 13-C: aramadan secilen saglayici sutuna eklenir ve secilir. */
  function aramadanEkle(g: AdayRolGrubu, r: AramaSonucu) {
    const kart: AdayKarti = {
      id: `ara-${g.roleId}-${r.providerId}`,
      providerId: r.providerId,
      ad: r.ad,
      sehir: r.sehir,
      headline: null,
      uyum: 0,
      kapsam: null,
      tamHizmet: null,
      gerekceler: [],
      wasShown: true,
      baslangicFiyati: r.baslangicFiyati,
      avatarUrl: r.avatarUrl,
      kategoriSlug: null,
      musaitlikEtiketi: null,
      onerilen: false,
      ajans: r.ajans,
      aramadan: true,
    };
    setEkAdaylar((m) => ({ ...m, [g.roleId]: [...(m[g.roleId] ?? []), kart] }));
    const ihtiyac = ihtiyacOf(g);
    setSecim((m) => {
      const mevcut = m[g.roleId] ?? [];
      if (mevcut.length < ihtiyac) return { ...m, [g.roleId]: [...mevcut, kart.id] };
      if (ihtiyac === 1) return { ...m, [g.roleId]: [kart.id] };
      return m;
    });
  }

  /** Secili adaylarin kart nesneleri (rol bilgisiyle; serit ve ekip kurma icin). */
  const seciliAdaylar = useMemo(() => {
    const liste: { roleId: number; aday: AdayKarti }[] = [];
    for (const g of rolGruplari) {
      const kartlar = sutunKartlari(g);
      for (const id of secim[g.roleId] ?? []) {
        const a = kartlar.find((x) => x.id === id);
        if (a) liste.push({ roleId: g.roleId, aday: a });
      }
    }
    return liste;
  }, [rolGruplari, secim, sutunKartlari]);

  /**
   * Butce blogu — etkinligin butcesi VE secili adaylarin HEPSINDE baslangic
   * fiyati varsa. Biri bile eksikse blok YOK: yarim toplam yanlis bir "butceye
   * sigiyor" izlenimi verir. Toplam BASLANGIC fiyatlarinin toplamidir, teklif
   * degil (bu yuzden "~" ile yazilir).
   */
  const butceTavani = kisitlar.butceMax ?? kisitlar.butceMin;
  const butceBlogu = useMemo(() => {
    if (butceTavani === null || butceTavani <= 0) return null;
    if (seciliAdaylar.length === 0) return null;
    if (seciliAdaylar.some((s) => s.aday.baslangicFiyati === null)) return null;
    const toplam = seciliAdaylar.reduce(
      (t, s) => t + (s.aday.baslangicFiyati ?? 0),
      0
    );
    return {
      toplam,
      oran: Math.round((toplam / butceTavani) * 100),
      tavan: butceTavani,
    };
  }, [seciliAdaylar, butceTavani]);

  /**
   * "Ekibi olustur" — ekip yoksa kurar, sonra her secili adayi uye olarak ekler.
   * Sira onemli: hata olursa DURUR (yarim ekip birakmak yerine mesaj verir).
   * `createCrew` ve `addCrewMemberFromCandidate` imzalari DEGISMEZ; ekip adi
   * action'in kendi varsayilani ("Ekip") kalir.
   */
  function ekibiOlustur() {
    if (seciliAdaylar.length === 0) return;
    setHata(null);
    setEkipKuruluyor(true);
    void (async () => {
      let crewId = mevcutEkipId;
      if (!crewId) {
        const res = await createCrew({
          eventId,
          organizationId: ekipKurulusId,
        });
        if (!res.success) {
          setHata(res.error);
          setEkipKuruluyor(false);
          return;
        }
        crewId = res.data?.id ?? null;
      }
      if (!crewId) {
        setHata('Ekip kurulamadı, tekrar dene.');
        setEkipKuruluyor(false);
        return;
      }

      let sira = 0;
      for (const s of seciliAdaylar) {
        const res = await addCrewMemberFromCandidate({
          crewId,
          eventId,
          roleId: s.roleId,
          providerId: s.aday.providerId,
          // Aramadan eklenenin eslestirme adayi yok (action UUID degilse null yazar)
          matchCandidateId: s.aday.aramadan ? '' : s.aday.id,
          sortOrder: sira,
        });
        if (!res.success) {
          setHata(res.error);
          setEkipKuruluyor(false);
          return;
        }
        sira += 1;
      }

      setEkipKuruluyor(false);
      router.push(`/etkinliklerim/${eventId}?sekme=ekip`);
    })();
  }

  // ---- Gorunum ----
  const eslestirmeSuruyor = isPending && !sonKosu;
  // Sure YALNIZ sutun doluysa; eski kosularda kutu hic cizilmez.
  const sureKutusu = sureMetni(sonKosu?.latency_ms);
  const rolSutunlariGorunur = segment === 'tekil' || segment === 'hibrit';
  // Duzeltme 13-C: hibritte ajanslar rol sutunlarinda (rozetle); tam hizmet
  // listesi yalniz "Tum isi ajansa ver" yolunda.
  const ajansGorunur = segment === 'ajans';
  const toplamAday =
    ajansAdaylari.length +
    rolGruplari.reduce((t, g) => t + g.adaylar.length, 0);

  /**
   * "Eslesme hazir" karti — ✓ satirlari YALNIZ gecerli olanlar. Etkinlikte
   * tarih yoksa musaitlik satiri yazilmaz (musaitlik elemesi de yapilmadi:
   * `run_event_match` tarih bilinmiyorsa `availability_blocks` kontrolunu
   * atlar). Yani her satir gerceklesmis bir ise karsilik gelir.
   */
  const kontrolSatirlari = [
    kisitlar.tarihEtiketi
      ? `${kisitlar.tarihEtiketi} için müsaitlik kontrol edildi`
      : null,
    kisitlar.sehirVar ? 'Aynı şehir puanlandı' : null,
    butceTavani !== null ? 'Bütçe uyumu hesaplandı' : null,
    'Uyum puanı ile sıralandı',
  ].filter((v): v is string => v !== null);

  return (
    <div className="space-y-5">
      {/* ── KOSU DURUMU ── */}
      {sonKosu || eslestirmeSuruyor ? (
        <div className="bg-card border border-line rounded-xl p-5">
          <div className="flex items-start justify-between gap-5 flex-wrap">
            <div className="min-w-0 flex-1 basis-72">
              <p className="font-display font-semibold text-ink flex items-center gap-2">
                <span
                  className={
                    eslestirmeSuruyor ? 'text-brand-accent' : 'text-moss'
                  }
                  aria-hidden="true"
                >
                  ●
                </span>
                {eslestirmeSuruyor
                  ? 'Profesyoneller taranıyor'
                  : 'Eşleşme hazır'}
              </p>

              <div className="w-full h-1.5 bg-paper-2 border border-line rounded-full overflow-hidden mt-3">
                <div
                  className="h-full bg-gradient-brand transition-all"
                  style={{ width: eslestirmeSuruyor ? '35%' : '100%' }}
                />
              </div>

              {!eslestirmeSuruyor && (
                <ul className="mt-3 space-y-1">
                  {kontrolSatirlari.map((s) => (
                    <li
                      key={s}
                      className="text-sm text-ink-72 flex items-start gap-2"
                    >
                      <span className="text-moss shrink-0" aria-hidden="true">
                        ✓
                      </span>
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Sayac sayisi SURE kutusuna gore degisir: sutun bos olan eski
                kosularda uc kutu kalir (uydurma sure yazilmaz). */}
            <div
              className={
                sureKutusu
                  ? 'grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-0 flex-1 basis-72'
                  : 'grid grid-cols-3 gap-3 min-w-0 flex-1 basis-72'
              }
            >
              <KpiKutu
                etiket="Rol"
                deger={eslestirmeSuruyor ? '—' : rolGruplari.length}
              />
              <KpiKutu
                etiket="Uygun aday"
                deger={
                  eslestirmeSuruyor ? '—' : (sonKosu?.candidate_count ?? 0)
                }
              />
              <KpiKutu
                etiket="Ajans"
                deger={eslestirmeSuruyor ? '—' : ajansAdaylari.length}
              />
              {sureKutusu && (
                <KpiKutu
                  etiket="Süre"
                  deger={eslestirmeSuruyor ? '—' : sureKutusu}
                />
              )}
            </div>
          </div>

          {/* Kosu bilgisi ve yeniden eslestirme — kucuk satir (AYNEN). */}
          <div className="mt-4 pt-4 border-t border-line flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              {sonKosu && (
                <p className="text-sm text-ink-72">
                  Son eşleştirme: {kosuZamani(sonKosu.created_at)} ·{' '}
                  {sonKosu.algorithm_version} · {sonKosu.candidate_count} aday
                </p>
              )}
              {oncekiKosular.length > 0 && (
                <p className="text-sm text-ink-72 mt-1">
                  Önceki eşleştirmeler: {oncekiKosular.length} —{' '}
                  {oncekiKosular
                    .map(
                      (k) =>
                        `${kosuZamani(k.created_at)} (${k.candidate_count})`
                    )
                    .join(', ')}
                </p>
              )}
            </div>
            {sahip && durumUygun && (
              <button
                type="button"
                onClick={eslestir}
                disabled={isPending || azOnce}
                className={BTN_BIRINCIL}
              >
                {isPending
                  ? 'Eşleştiriliyor…'
                  : azOnce
                    ? 'Az önce eşleştirildi'
                    : 'Yeniden eşleştir'}
              </button>
            )}
          </div>

          {hata && <p className="text-sm text-danger mt-3">{hata}</p>}
        </div>
      ) : (
        /* Kosu yok — bugunku ust kart ve "Aday oner" dugmesi. */
        <div className="bg-card border border-line rounded-lg p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm text-ink">Henüz eşleştirme yapılmadı.</p>
              {sahip && !durumUygun && (
                <p className="text-sm text-ink-72 mt-1">
                  Eşleştirme için etkinliğin onaylı olması gerekir.
                </p>
              )}
            </div>
            {sahip && durumUygun && (
              <button
                type="button"
                onClick={eslestir}
                disabled={isPending}
                className={BTN_BIRINCIL}
              >
                {isPending ? 'Eşleştiriliyor…' : 'Aday öner'}
              </button>
            )}
          </div>
          {hata && <p className="text-sm text-danger mt-3">{hata}</p>}
        </div>
      )}

      {sonKosu && (
        <>
          {/* ── BASLIK + SEGMENT ── */}
          <div className="flex items-start justify-between gap-5 flex-wrap">
            <div className="min-w-0 flex-1 basis-80">
              <div className="flex items-center gap-2.5 mb-2">
                <span
                  className="h-0.5 w-6 rounded-full bg-brand-accent shrink-0"
                  aria-hidden="true"
                />
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-72">
                  Kashe AI · Eşleşme sonucu
                </p>
              </div>
              <h3 className="font-display font-semibold text-2xl text-ink tracking-tight break-words">
                Üç yol:{' '}
                <em className="not-italic text-brand-accent">ekibini kur</em>,
                işi firmaya ver ya da birleştir.
              </h3>
              <p className="text-sm text-ink-72 mt-2">
                {rolGruplari.length} rol · {toplamAday} aday · tarih, şehir ve
                bütçe kısıtına göre puanlandı, uyum puanına göre sıralı.
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Eşleşme yolu"
              className="max-w-full inline-flex items-center gap-1 bg-paper-2 border border-line rounded-xl p-1 flex-wrap"
            >
              {SEGMENTLER.map((s) => {
                const etkin = segment === s.anahtar;
                return (
                  <button
                    key={s.anahtar}
                    type="button"
                    role="tab"
                    aria-selected={etkin}
                    onClick={() => setSegment(s.anahtar)}
                    className={
                      etkin
                        ? 'kashe-tap px-3 py-1.5 rounded-lg text-xs font-display font-semibold bg-card border border-line-strong text-ink'
                        : 'kashe-tap px-3 py-1.5 rounded-lg text-xs font-display font-semibold text-ink-72 hover:text-ink'
                    }
                  >
                    {s.etiket}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── ROL SUTUNLARI ──
              Duzeltme 13-A: sutun en az 260 px; sigmazsa yatay kaydirma
              (4'lu izgarada kartlar sikisiyordu). */}
          {rolSutunlariGorunur &&
            (rolGruplari.length === 0 ? (
              <div className="bg-card border border-line rounded-lg p-5 text-sm text-ink-72">
                Bu etkinlikte ihtiyaç kaydı yok.
              </div>
            ) : (
              <div className="grid grid-flow-col auto-cols-[minmax(260px,1fr)] gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
                {rolGruplari.map((g) => {
                  const ihtiyac = ihtiyacOf(g);
                  const kartlar = sutunKartlari(g);
                  const seciliSayi = (secim[g.roleId] ?? []).filter((id) =>
                    kartlar.some((k) => k.id === id)
                  ).length;
                  const mevcutIdler = new Set(kartlar.map((k) => k.providerId));
                  return (
                    <div key={g.roleId} className="min-w-0 snap-start">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 min-w-0 break-words">
                          {g.rolAdi}
                          {g.zorunlu ? '' : ' (isteğe bağlı)'}
                        </p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 shrink-0">
                          {kartlar.length} aday
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1 mb-2 flex-wrap">
                        <p
                          className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                            seciliSayi >= ihtiyac ? 'text-moss' : 'text-ink-50'
                          }`}
                        >
                          {seciliSayi} / {ihtiyac} seçili
                        </p>
                        {ihtiyacDuzenlenir ? (
                          <div
                            className="inline-flex items-center gap-1.5"
                            aria-label={`${g.rolAdi}: bu rolden kaç kişi`}
                          >
                            <span className="text-[10px] text-ink-50">Kaç kişi?</span>
                            <button
                              type="button"
                              onClick={() => ihtiyacDegistir(g, ihtiyac - 1)}
                              disabled={ihtiyac <= 1 || ihtiyacKaydediliyor}
                              aria-label="Bir azalt"
                              className="kashe-tap w-6 h-6 rounded-md border border-line text-ink-72 hover:border-brand-ink hover:text-brand-ink disabled:opacity-40 leading-none"
                            >
                              −
                            </button>
                            <span className="font-mono text-xs text-ink tabular-nums w-5 text-center">
                              {ihtiyac}
                            </span>
                            <button
                              type="button"
                              onClick={() => ihtiyacDegistir(g, ihtiyac + 1)}
                              disabled={ihtiyac >= 100 || ihtiyacKaydediliyor}
                              aria-label="Bir artır"
                              className="kashe-tap w-6 h-6 rounded-md border border-line text-ink-72 hover:border-brand-ink hover:text-brand-ink disabled:opacity-40 leading-none"
                            >
                              +
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {kartlar.length === 0 ? (
                        <div className="bg-card border border-line rounded-lg p-4 text-sm text-ink-72">
                          Bu rol için aday yok.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {kartlar.map((a) => (
                            <RolAdayKarti
                              key={a.id}
                              aday={a}
                              secili={(secim[g.roleId] ?? []).includes(a.id)}
                              onSecim={() =>
                                secimDegistir(g.roleId, ihtiyac, a.id)
                              }
                              onProfil={profilTiklandi}
                            />
                          ))}
                        </div>
                      )}

                      {ekipYazilir && (
                        <div className="mt-3 space-y-2">
                          <KasheArama
                            eventId={eventId}
                            roleId={g.roleId}
                            mevcutIdler={mevcutIdler}
                            onSec={(r) => aramadanEkle(g, r)}
                          />
                          {havuzYolu && (
                            <Link
                              href={havuzYolu}
                              className="kashe-tap block text-xs text-brand-ink hover:underline"
                            >
                              Havuzdan ekle (Ekip sekmesi) →
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

          {/* ── AJANS LISTESI ── */}
          {ajansGorunur && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-2">
                Tüm işi ajansa ver
              </p>
              {ajansAdaylari.length === 0 ? (
                <div className="bg-card border border-line rounded-lg p-5 text-sm text-ink-72">
                  Bu etkinlik için uygun ajans bulunamadı.
                </div>
              ) : (
                <div className="space-y-3">
                  {ajansAdaylari.map((a) => (
                    <AjansAdayKarti
                      key={a.id}
                      aday={a}
                      eventId={eventId}
                      rfpYolu={rfpYolu}
                      teklifBaglami={teklifBaglami}
                      onProfil={profilTiklandi}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* KVKK — aciklanabilirlik ve itiraz hakki (02) */}
          <p className="text-xs text-ink-50 leading-relaxed">
            Bu liste kurallara göre otomatik sıralanır; gerekçeler her kartta
            yazar. Sıralamaya itiraz etmek veya inceleme istemek için{' '}
            <a
              href={`mailto:${DESTEK_EPOSTA}`}
              className="text-brand-ink hover:underline"
            >
              bize yaz
            </a>
            .
          </p>

          {/* ── YAPISKAN SERIT ── */}
          {rolSutunlariGorunur && rolGruplari.length > 0 && (
            <OzetSerit
              koyu
              herGenislik
              panelKabugunda={panelKabugunda}
              etiket={`Seçilen ekip · ${seciliAdaylar.length} seçim`}
              deger={`${rolGruplari.length} rol · ${seciliAdaylar.length} seçili`}
              orta={
                butceBlogu ? (
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-paper-50">
                      Bütçe kullanımı
                    </p>
                    <div className="h-1.5 bg-paper-14 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={
                          butceBlogu.oran > 100
                            ? 'h-full bg-danger'
                            : 'h-full bg-gradient-brand'
                        }
                        style={{ width: `${Math.min(100, butceBlogu.oran)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-paper-72 mt-1 tabular-nums">
                      Başlangıç fiyatları toplamı ~
                      {formatTL(butceBlogu.toplam)} · bütçe{' '}
                      {formatTL(butceBlogu.tavan)} (%{butceBlogu.oran})
                    </p>
                  </div>
                ) : undefined
              }
              aksiyon={
                <button
                  type="button"
                  onClick={ekibiOlustur}
                  disabled={
                    !ekipYazilir || seciliAdaylar.length === 0 || ekipKuruluyor
                  }
                  className={BTN_SERIT}
                >
                  {ekipKuruluyor ? 'Ekip kuruluyor…' : 'Ekibi oluştur →'}
                </button>
              }
            />
          )}
        </>
      )}
    </div>
  );
}
