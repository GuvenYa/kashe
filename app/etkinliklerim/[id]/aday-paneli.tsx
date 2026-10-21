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
  type AdayKarti,
  type AdayKosu,
  type AdayRolGrubu,
} from './aday-data';
import {
  markCandidateClicked,
  markCandidatesShown,
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
  const kenar = aday.onerilen
    ? 'border-brand-accent/60'
    : secili
      ? 'border-brand-ink/40'
      : 'border-line';
  const halka = secili ? 'ring-2 ring-brand-ink' : 'ring-0';

  return (
    <div
      className={`relative bg-card border rounded-xl p-3 transition-colors ${kenar} ${halka}`}
    >
      <button
        type="button"
        onClick={onSecim}
        aria-pressed={secili}
        aria-label={`${aday.ad} seçimini değiştir`}
        className="kashe-tap absolute inset-0 z-0 rounded-xl"
      />

      <div className="relative z-10 pointer-events-none">
        {aday.onerilen && (
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-brand-accent mb-2">
            Önerilen
          </p>
        )}

        <div className="flex items-start gap-3">
          <Avatar aday={aday} />

          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-ink text-sm leading-tight break-words">
              {aday.ad}
            </p>
            <p className="text-xs text-ink-72 mt-1 break-words">
              {[aday.sehir, ...aday.gerekceler.slice(0, 2)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {aday.baslangicFiyati !== null && (
              <span className="font-mono text-[10px] text-ink-72 tabular-nums text-right leading-tight">
                {formatTL(aday.baslangicFiyati)}
                <br />
                &apos;den
              </span>
            )}
            <UyumHalkasi yuzde={aday.uyum} />
          </div>
        </div>

        {aday.musaitlikEtiketi && (
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-moss bg-moss/10 border border-moss/25 px-2 py-0.5 rounded inline-block mt-2.5">
            {aday.musaitlikEtiketi} müsait
          </p>
        )}

        <div className="mt-2.5 pointer-events-auto">
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

  /** Secili adaylarin kart nesneleri (rol bilgisiyle; serit ve ekip kurma icin). */
  const seciliAdaylar = useMemo(() => {
    const liste: { roleId: number; aday: AdayKarti }[] = [];
    for (const g of rolGruplari) {
      for (const id of secim[g.roleId] ?? []) {
        const a = g.adaylar.find((x) => x.id === id);
        if (a) liste.push({ roleId: g.roleId, aday: a });
      }
    }
    return liste;
  }, [rolGruplari, secim]);

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
          matchCandidateId: s.aday.id,
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
  const rolSutunlariGorunur = segment === 'tekil' || segment === 'hibrit';
  const ajansGorunur = segment === 'ajans' || segment === 'hibrit';
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

            <div className="grid grid-cols-3 gap-3 min-w-0 flex-1 basis-72">
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

          {/* ── ROL SUTUNLARI ── */}
          {rolSutunlariGorunur &&
            (rolGruplari.length === 0 ? (
              <div className="bg-card border border-line rounded-lg p-5 text-sm text-ink-72">
                Bu etkinlikte ihtiyaç kaydı yok.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {rolGruplari.map((g) => {
                  const seciliSayi = (secim[g.roleId] ?? []).length;
                  return (
                    <div key={g.roleId} className="min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 min-w-0 break-words">
                          {g.rolAdi}
                          {g.zorunlu ? '' : ' (isteğe bağlı)'}
                        </p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 shrink-0">
                          {g.adaylar.length} aday
                        </p>
                      </div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50 mt-1 mb-2">
                        {seciliSayi} / {g.ihtiyac} seçili
                      </p>

                      {g.adaylar.length === 0 ? (
                        <div className="bg-card border border-line rounded-lg p-4 text-sm text-ink-72">
                          Bu rol için aday yok.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {g.adaylar.map((a) => (
                            <RolAdayKarti
                              key={a.id}
                              aday={a}
                              secili={(secim[g.roleId] ?? []).includes(a.id)}
                              onSecim={() =>
                                secimDegistir(g.roleId, g.ihtiyac, a.id)
                              }
                              onProfil={profilTiklandi}
                            />
                          ))}
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
              etiket={`Önerilen ekip · ${seciliAdaylar.length} tekil profesyonel`}
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
