'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  GOREV_DURUMLARI,
  ACIK_DURUMLAR,
  gorevDurumEtiketi,
  type GorevDurumu,
} from '@/app/lib/gorevler';
import { gorevOlustur } from '@/app/lib/gorev-actions';
import { GorevSatiri } from './gorev-satiri';
import { GorevFormu } from './gorev-formu';
import type { Atanabilir, GorevSatiri as Gorev } from '@/app/lib/gorev-data';

/**
 * FAZ 8a — gorev listesi: hizli ekle + filtreler + satirlar.
 *
 * SUZME ISTEMCIDE: satirlar sunucudan siralanmis gelir (en cok 300) ve filtreler
 * o kume uzerinde calisir. Neden: her filtre tiklamasinda sunucuya gitmek
 * listeyi yanip sondurur; kurulus basina gorev sayisi bu siniri asinca filtre
 * sunucuya tasinir (veri katmani `durum`/`atanan`/`banaAtanan` parametrelerini
 * zaten destekliyor).
 *
 * Yetki: `yazabilir` false ise hizli ekle, duzenle ve sil HIC render edilmez —
 * salt okunur liste. RLS ayni kurali DB'de uyguluyor.
 */
export function GorevListesi({
  organizationId,
  gorevler,
  yazabilir,
  sabitEventId,
  atanabilirler,
  etkinlikSecenekleri,
  kullaniciId,
  vurgulananGorevId,
}: {
  organizationId: string;
  gorevler: Gorev[];
  yazabilir: boolean;
  /** Etkinlik sekmesinde dolu: etkinlik sutunu ve secicisi gizlenir. */
  sabitEventId?: string | null;
  atanabilirler: Atanabilir[];
  etkinlikSecenekleri: { id: string; ad: string }[];
  kullaniciId: string | null;
  /** `/kurulus/gorevler?gorev=<id>` — bildirimden gelen satir vurgulanir. */
  vurgulananGorevId?: string | null;
}) {
  const [durumSuzgeci, setDurumSuzgeci] = useState<GorevDurumu[]>([]);
  const [atananSuzgeci, setAtananSuzgeci] = useState('');
  const [banaAtanan, setBanaAtanan] = useState(false);
  const [etkinlikSuzgeci, setEtkinlikSuzgeci] = useState('');
  const [yalnizKilometre, setYalnizKilometre] = useState(false);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<Gorev | null>(null);
  const [hizliBaslik, setHizliBaslik] = useState('');
  const [hizliHata, setHizliHata] = useState<string | null>(null);
  // Bekleme gostergesi artik `bekleyenler` satirlari; transition bayragi
  // kullanilmiyor (iyimser satir zaten "kaydediliyor" diyor).
  const [, basla] = useTransition();

  /**
   * IYIMSER HIZLI EKLE (hijyen 04): Enter tusuna basilinca satir HEMEN listede
   * gorunur, sunucu yanitini beklemez. Eskiden kullanici alti sekiz saniye bos
   * bir alana bakiyor ve gorevin eklendigini anlamiyordu.
   *
   * `useOptimistic` DEGIL yerel state: iyimser satirin kaynagi bir action
   * donusu degil, kullanicinin yazdigi basliktir. Sunucu tazelenince satir
   * KALDIRILIR ve gercek kayit `gorevler` listesinden gelir. Hata olursa satir
   * kalkar ve mesaj yazilir; sessiz kayip olmaz.
   */
  const [bekleyenler, setBekleyenler] = useState<
    { gecici: string; baslik: string }[]
  >([]);

  const etkinlikSutunu = !sabitEventId;

  const suzulmus = useMemo(() => {
    return gorevler.filter((g) => {
      if (durumSuzgeci.length > 0 && !durumSuzgeci.includes(g.status as GorevDurumu)) {
        return false;
      }
      if (banaAtanan && g.assignee_user_id !== kullaniciId) return false;
      if (!banaAtanan && atananSuzgeci) {
        const [tur, kimlik] = atananSuzgeci.split(':');
        if (tur === 'user' && g.assignee_user_id !== kimlik) return false;
        if (tur === 'talent' && g.assignee_talent_record_id !== kimlik) return false;
      }
      if (etkinlikSuzgeci) {
        if (etkinlikSuzgeci === 'genel' && g.event_id) return false;
        if (etkinlikSuzgeci !== 'genel' && g.event_id !== etkinlikSuzgeci) {
          return false;
        }
      }
      if (yalnizKilometre && !g.is_milestone) return false;
      return true;
    });
  }, [
    gorevler,
    durumSuzgeci,
    atananSuzgeci,
    banaAtanan,
    etkinlikSuzgeci,
    yalnizKilometre,
    kullaniciId,
  ]);

  const acikSayisi = gorevler.filter((g) =>
    ACIK_DURUMLAR.includes(g.status as never)
  ).length;

  function hizliEkle() {
    const baslik = hizliBaslik.trim();
    if (baslik.length < 2) {
      setHizliHata('Başlık 2–200 karakter olmalı.');
      return;
    }
    setHizliHata(null);

    // Satir ve bos girdi ANINDA: kullanici bir sonrakini yazmaya baslayabilir.
    const gecici =
      'bekleyen-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    setBekleyenler((o) => [...o, { gecici, baslik }]);
    setHizliBaslik('');

    basla(async () => {
      const sonuc = await gorevOlustur({
        organizationId,
        title: baslik,
        eventId: sabitEventId ?? null,
      });
      // Basaride de satir KALDIRILIR: `revalidatePath` gercek kaydi
      // `gorevler` listesine getiriyor, iki satir gorunmesin.
      setBekleyenler((o) => o.filter((b) => b.gecici !== gecici));
      if (!sonuc.ok) {
        setHizliHata(sonuc.hata);
        // Yazilan baslik kaybolmasin: girdi bossa geri konur.
        setHizliBaslik((mevcut) => mevcut || baslik);
      }
    });
  }

  const CIP = 'font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-full border transition-colors';
  const SECIM =
    'px-2.5 py-1.5 bg-card border border-line rounded-lg text-[12px] text-ink focus:outline-none focus:border-brand-ink';

  return (
    <div className="space-y-4">
      {/* Hizli ekle */}
      {yazabilir && (
        <div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={hizliBaslik}
              onChange={(e) => setHizliBaslik(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  hizliEkle();
                }
              }}
              maxLength={200}
              placeholder="Görev ekle… (Enter)"
              aria-label="Hızlı görev ekle"
              className="flex-1 min-w-0 px-3 py-2 bg-card border border-line rounded-lg text-sm text-ink focus:outline-none focus:border-brand-ink"
            />
            <button
              type="button"
              onClick={() => {
                setDuzenlenen(null);
                setFormAcik(true);
              }}
              className="kashe-tap shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-brand-ink hover:underline"
            >
              Ayrıntılı →
            </button>
          </div>
          {hizliHata && (
            <p className="mt-1.5 text-[12px] text-danger">{hizliHata}</p>
          )}
        </div>
      )}

      {/* Form */}
      {yazabilir && (formAcik || duzenlenen) && (
        <GorevFormu
          organizationId={organizationId}
          gorev={duzenlenen}
          sabitEventId={sabitEventId}
          atanabilirler={atanabilirler}
          etkinlikSecenekleri={etkinlikSecenekleri}
          bagliSecenekleri={gorevler.map((g) => ({ id: g.id, ad: g.title }))}
          onKapat={() => {
            setFormAcik(false);
            setDuzenlenen(null);
          }}
        />
      )}

      {/* Filtreler */}
      <div className="flex items-center gap-2 flex-wrap">
        {GOREV_DURUMLARI.map((d) => {
          const secili = durumSuzgeci.includes(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() =>
                setDurumSuzgeci((onceki) =>
                  onceki.includes(d)
                    ? onceki.filter((x) => x !== d)
                    : [...onceki, d]
                )
              }
              aria-pressed={secili}
              className={
                secili
                  ? `${CIP} bg-brand-ink border-brand-ink text-paper`
                  : `${CIP} bg-card border-line text-ink-72 hover:border-brand-ink`
              }
            >
              {gorevDurumEtiketi(d)}
            </button>
          );
        })}

        <select
          value={banaAtanan ? '' : atananSuzgeci}
          onChange={(e) => {
            setAtananSuzgeci(e.target.value);
            setBanaAtanan(false);
          }}
          aria-label="Atanan"
          className={SECIM}
        >
          <option value="">Tüm atananlar</option>
          {/* Etiket FORMDAKIYLE AYNI ("Test Pro — Izleyici"): ayni kisi iki
              listede iki farkli yazilirsa kullanici ayni kaydi iki sani. */}
          {atanabilirler.map((a) => (
            <option key={`${a.tur}:${a.id}`} value={`${a.tur}:${a.id}`}>
              {a.ad} — {a.altNot}
            </option>
          ))}
        </select>

        {kullaniciId && (
          <label className="flex items-center gap-1.5 cursor-pointer text-[12px] text-ink-72">
            <input
              type="checkbox"
              checked={banaAtanan}
              onChange={(e) => setBanaAtanan(e.target.checked)}
              className="w-3.5 h-3.5 accent-brand-ink"
            />
            Bana atanan
          </label>
        )}

        {etkinlikSutunu && etkinlikSecenekleri.length > 0 && (
          <select
            value={etkinlikSuzgeci}
            onChange={(e) => setEtkinlikSuzgeci(e.target.value)}
            aria-label="Etkinlik"
            className={SECIM}
          >
            <option value="">Tüm etkinlikler</option>
            <option value="genel">Kuruluş geneli</option>
            {etkinlikSecenekleri.map((e) => (
              <option key={e.id} value={e.id}>
                {e.ad}
              </option>
            ))}
          </select>
        )}

        <label className="flex items-center gap-1.5 cursor-pointer text-[12px] text-ink-72">
          <input
            type="checkbox"
            checked={yalnizKilometre}
            onChange={(e) => setYalnizKilometre(e.target.checked)}
            className="w-3.5 h-3.5 accent-brand-ink"
          />
          Yalnız kilometre taşları
        </label>
      </div>

      {/* Bekleyen (iyimser) satirlar — listenin USTUNDE, soluk ve rozetli.
          `GorevSatiri` ile cizilmez: o bilesen gercek bir kayit bekliyor
          (durum, atanan, eylemler); yarim bir nesne uydurmak yerine hafif bir
          satir cizilir. */}
      {bekleyenler.length > 0 && (
        <div className="bg-card border border-line rounded-xl px-4">
          {bekleyenler.map((b) => (
            <div
              key={b.gecici}
              className="flex items-center justify-between gap-3 py-3 border-b border-line last:border-b-0 opacity-60"
            >
              <p className="text-sm text-ink min-w-0 break-words">{b.baslik}</p>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-50 bg-paper border border-line px-2 py-0.5 rounded">
                Kaydediliyor
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Liste */}
      {suzulmus.length === 0 && bekleyenler.length === 0 ? (
        <p className="text-sm text-ink-72 py-4">
          {gorevler.length === 0
            ? yazabilir
              ? 'Henüz görev yok. Yukarıdaki alandan ilkini ekle.'
              : 'Henüz görev yok.'
            : 'Bu filtrelere uyan görev yok.'}
        </p>
      ) : (
        <div className="bg-card border border-line rounded-xl px-4">
          {suzulmus.map((g) => (
            <GorevSatiri
              key={g.id}
              gorev={g}
              yazabilir={yazabilir}
              etkinlikSutunu={etkinlikSutunu}
              vurgulu={!!vurgulananGorevId && g.id === vurgulananGorevId}
              onDuzenle={(hedef) => {
                setFormAcik(false);
                setDuzenlenen(hedef);
              }}
            />
          ))}
        </div>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
        {suzulmus.length} / {gorevler.length} görev · {acikSayisi} açık
        {bekleyenler.length > 0 ? ` · ${bekleyenler.length} kaydediliyor` : ''}
      </p>
    </div>
  );
}
