'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
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

/**
 * FAZ 6 / P1 — "Adaylar" bolumu.
 *
 * Siralama ve puan DB'den gelir (`final_rank`, `match_score`); panel YENIDEN
 * SIRALAMAZ, puan hesaplamaz, gerekce kodu uretmez. Kartlar sunucuda kuruldu.
 *
 * Isaretleme RPC'leri YALNIZ etkinlik sahibinde cagrilir (baskasinda 42501 donerdi).
 */

const BTN_BIRINCIL =
  'kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50';

function Rozet({ metin }: { metin: string }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72 bg-paper border border-line px-2 py-0.5 rounded">
      {metin}
    </span>
  );
}

function AdayKartiGovde({
  aday,
  onProfil,
}: {
  aday: AdayKarti;
  onProfil: (candidateId: string) => void;
}) {
  return (
    <div className="bg-card border border-line rounded-lg p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="font-display font-semibold text-ink">{aday.ad}</p>
          <p className="text-sm text-ink-72 mt-0.5">
            {aday.sehir ?? 'Şehir belirtilmemiş'}
            {aday.kapsam !== null ? ` · Kapsam %${aday.kapsam}` : ''}
          </p>
          {aday.headline && (
            <p className="text-sm text-ink-72 mt-1">{aday.headline}</p>
          )}
        </div>
        <span className="font-display font-semibold text-brand-ink text-lg shrink-0">
          %{aday.uyum}
        </span>
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

      <div className="mt-3">
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
}) {
  const [isPending, startTransition] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

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

  function eslestir() {
    setHata(null);
    startTransition(async () => {
      const res = await runEventMatch(eventId);
      if (!res.success) setHata(res.error);
    });
  }

  function profilTiklandi(candidateId: string) {
    if (!sahip) return;
    startTransition(() => {
      void markCandidateClicked(candidateId);
    });
  }

  return (
    <div className="space-y-4">
      {/* Ust satir: son kosu bilgisi + dugme */}
      <div className="bg-card border border-line rounded-lg p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm text-ink">
              {sonKosu
                ? `Son eşleştirme: ${kosuZamani(sonKosu.created_at)} · ${sonKosu.algorithm_version} · ${sonKosu.candidate_count} aday`
                : 'Henüz eşleştirme yapılmadı.'}
            </p>
            {oncekiKosular.length > 0 && (
              <p className="text-sm text-ink-72 mt-1">
                Önceki eşleştirmeler: {oncekiKosular.length} —{' '}
                {oncekiKosular
                  .map(
                    (k) => `${kosuZamani(k.created_at)} (${k.candidate_count})`
                  )
                  .join(', ')}
              </p>
            )}
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
              {isPending
                ? 'Eşleştiriliyor…'
                : sonKosu
                  ? 'Yeniden eşleştir'
                  : 'Aday öner'}
            </button>
          )}
        </div>

        {hata && <p className="text-sm text-danger mt-3">{hata}</p>}
      </div>

      {sonKosu && (
        <>
          {/* Tam hizmet: ajanslar (role_id NULL adaylar) */}
          <div>
            <p className="font-display font-semibold text-ink mb-2">
              Tam hizmet: ajanslar
            </p>
            {ajansAdaylari.length === 0 ? (
              <div className="bg-card border border-line rounded-lg p-5 text-sm text-ink-72">
                Bu etkinlik için uygun ajans bulunamadı.
              </div>
            ) : (
              <div className="space-y-3">
                {ajansAdaylari.map((a) => (
                  <AdayKartiGovde
                    key={a.id}
                    aday={a}
                    onProfil={profilTiklandi}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Rol bazinda profesyoneller */}
          <div>
            <p className="font-display font-semibold text-ink mb-2">
              Rol bazında profesyoneller
            </p>
            {rolGruplari.length === 0 ? (
              <div className="bg-card border border-line rounded-lg p-5 text-sm text-ink-72">
                Bu etkinlikte ihtiyaç kaydı yok.
              </div>
            ) : (
              <div className="space-y-5">
                {rolGruplari.map((g) => (
                  <div key={g.roleId}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mb-2">
                      {g.rolAdi} · {g.ihtiyac} kişi
                      {g.zorunlu ? '' : ' (isteğe bağlı)'}
                    </p>
                    {g.adaylar.length === 0 ? (
                      <div className="bg-card border border-line rounded-lg p-5 text-sm text-ink-72">
                        Bu rol için aday yok.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {g.adaylar.map((a) => (
                          <AdayKartiGovde
                            key={a.id}
                            aday={a}
                            onProfil={profilTiklandi}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

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
        </>
      )}
    </div>
  );
}
