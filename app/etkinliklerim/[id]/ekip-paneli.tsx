'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  EKIP_DURUM_ETIKETLERI,
  KAYNAK_ETIKETLERI,
  MALIYET_BIRIM_ETIKETLERI,
  MALIYET_BIRIM_SECENEKLERI,
  MALIYET_KAYNAK_ETIKETLERI,
  UYE_DURUM_ETIKETLERI,
  UYE_DURUM_SECENEKLERI,
  marjYuzdesi,
  tutarMetni,
  type EkipRolBloku,
  type EkipSatiri,
  type KapsamSatiri,
  type MaliyetBirimi,
  type MaliyetSatiri,
  type UyeDurum,
  type UyeKarti,
} from './ekip-data';
import {
  addCrewMemberFromCandidate,
  addCrewMemberFromPool,
  createCrew,
  removeCrewMember,
  setCrewStatus,
  updateCrewMember,
} from './ekip-actions';
import {
  listCrewCommercials,
  snapshotCrewCommercial,
  upsertCrewCommercial,
} from './ekip-maliyet-actions';

/**
 * FAZ 6 / P2 — "Ekip" bolumu.
 *
 * Yazim RLS ile dogrudan tabloya (action'lar); `pool_origin`/`created_by`
 * GONDERILMEZ (tetikleyici). Ekip `confirmed` kapisi DB'de — panel ayni kontrolu
 * ONCEDEN kapsam ozetiyle gosterir ama karar DB'nin.
 *
 * Ic maliyet karti yalniz kurulus ekibinde ve `canSeeRates` ise RENDER EDILIR;
 * aksi halde DOM'da da yoktur (sunucu `maliyetGorulur` false gonderir).
 */

const BTN_BIRINCIL =
  'kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50';
const BTN_IKINCIL =
  'kashe-tap px-3 py-1.5 border border-line-strong text-ink rounded-lg font-display font-semibold text-xs hover:border-brand-ink hover:text-brand-ink transition-colors disabled:opacity-50';
const ALAN =
  'px-3 py-2 bg-paper border border-line rounded-lg text-sm text-ink focus:border-brand-ink focus:outline-none';

type Onay =
  | { tur: 'uyeCikar'; id: string; ad: string }
  | { tur: 'ekipIptal' }
  | null;

export function EkipPaneli({
  eventId,
  sahip,
  ekip,
  uyeler,
  kapsam,
  rolBloklari,
  rolAdlari,
  kurulusSecenekleri,
  yazabilir,
  havuzdanEklenebilir,
  maliyetGorulur,
  maliyetYazilir,
}: {
  eventId: string;
  /** `events.owner_user_id === user.id` — ekip kurma yalniz sahipte. */
  sahip: boolean;
  ekip: EkipSatiri | null;
  uyeler: UyeKarti[];
  kapsam: KapsamSatiri[];
  rolBloklari: EkipRolBloku[];
  /** slug -> Turkce rol adi (DB hata mesajini cevirmek icin). */
  rolAdlari: Record<string, string>;
  /** `crew.manage` yetkili kuruluslar (ekip kurarken secim). */
  kurulusSecenekleri: { id: string; name: string }[];
  /** Uye ekleme/cikarma ve durum degistirme yetkisi. */
  yazabilir: boolean;
  havuzdanEklenebilir: boolean;
  maliyetGorulur: boolean;
  maliyetYazilir: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [onay, setOnay] = useState<Onay>(null);
  const [kurulusSecimi, setKurulusSecimi] = useState<string>(
    kurulusSecenekleri[0]?.id ?? ''
  );
  const [havuzSecimi, setHavuzSecimi] = useState<Record<number, string>>({});
  const [notDuzenlenen, setNotDuzenlenen] = useState<string | null>(null);
  const [notMetni, setNotMetni] = useState('');

  // Ic maliyet karti — tembel yukleme (acilinca tek RPC, tum ekip).
  const [maliyetAcik, setMaliyetAcik] = useState(false);
  const [maliyetler, setMaliyetler] = useState<MaliyetSatiri[] | null>(null);
  const [maliyetHatasi, setMaliyetHatasi] = useState<string | null>(null);
  const [maliyetForm, setMaliyetForm] = useState<{
    memberId: string;
    cost: string;
    basis: MaliyetBirimi;
    clientPrice: string;
    note: string;
  } | null>(null);

  function mesajlariTemizle() {
    setHata(null);
    setBilgi(null);
  }

  // Ekip durumu `confirmed`/`cancelled` ise uye ekleme/cikarma UI'da kilitlenir
  // (DB engellemez; kilit yalniz arayuzde).
  const duzenlenebilir =
    yazabilir && !!ekip && ekip.status !== 'confirmed' && ekip.status !== 'cancelled';

  const eksikZorunlu = kapsam.filter(
    (k) => k.zorunlu && k.onaylanan < k.gereken
  );
  const tamHizmet =
    kapsam.some((k) => k.zorunlu) && eksikZorunlu.length === 0;

  function ekipKur() {
    mesajlariTemizle();
    const orgId =
      kurulusSecenekleri.length > 0
        ? kurulusSecimi || kurulusSecenekleri[0].id
        : null;
    startTransition(async () => {
      const res = await createCrew({ eventId, organizationId: orgId });
      if (!res.success) setHata(res.error);
      else setBilgi('Ekip kuruldu.');
    });
  }

  function durumDegistir(yeni: 'proposed' | 'confirmed' | 'cancelled') {
    if (!ekip) return;
    mesajlariTemizle();
    startTransition(async () => {
      const res = await setCrewStatus({
        crewId: ekip.id,
        eventId,
        status: yeni,
        rolAdlari,
      });
      if (!res.success) setHata(res.error);
      else setBilgi('Ekip durumu güncellendi.');
    });
  }

  function adaydanEkle(blok: EkipRolBloku, candidateId: string, providerId: string) {
    if (!ekip) return;
    mesajlariTemizle();
    startTransition(async () => {
      const res = await addCrewMemberFromCandidate({
        crewId: ekip.id,
        eventId,
        roleId: blok.roleId,
        providerId,
        matchCandidateId: candidateId,
        sortOrder: uyeler.length,
      });
      if (!res.success) setHata(res.error);
      else setBilgi('Üye ekibe eklendi.');
    });
  }

  function havuzdanEkle(blok: EkipRolBloku) {
    if (!ekip) return;
    const recordId = havuzSecimi[blok.roleId] ?? '';
    if (!recordId) {
      setHata('Havuzdan bir kişi seç.');
      return;
    }
    mesajlariTemizle();
    startTransition(async () => {
      const res = await addCrewMemberFromPool({
        crewId: ekip.id,
        eventId,
        roleId: blok.roleId,
        talentRecordId: recordId,
        sortOrder: uyeler.length,
      });
      if (!res.success) setHata(res.error);
      else {
        setHavuzSecimi((o) => ({ ...o, [blok.roleId]: '' }));
        setBilgi('Üye ekibe eklendi.');
      }
    });
  }

  function uyeDurumu(memberId: string, durum: UyeDurum) {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await updateCrewMember({ memberId, eventId, status: durum });
      if (!res.success) setHata(res.error);
    });
  }

  function kilitDegistir(memberId: string, kilitli: boolean) {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await updateCrewMember({
        memberId,
        eventId,
        isLocked: !kilitli,
      });
      if (!res.success) setHata(res.error);
    });
  }

  function notKaydet(memberId: string) {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await updateCrewMember({ memberId, eventId, note: notMetni });
      if (!res.success) setHata(res.error);
      else {
        setNotDuzenlenen(null);
        setBilgi('Not kaydedildi.');
      }
    });
  }

  function uyeCikar(memberId: string) {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await removeCrewMember({ memberId, eventId });
      if (!res.success) setHata(res.error);
      else setBilgi('Üye ekipten çıkarıldı.');
    });
  }

  function maliyetKartiAc() {
    if (!ekip?.organization_id) return;
    setMaliyetHatasi(null);
    if (maliyetAcik) {
      setMaliyetAcik(false);
      return;
    }
    setMaliyetAcik(true);
    startTransition(async () => {
      const res = await listCrewCommercials({
        crewId: ekip.id,
        organizationId: ekip.organization_id!,
      });
      if (res.success) setMaliyetler(res.data ?? []);
      else setMaliyetHatasi(res.error);
    });
  }

  async function maliyetTazele() {
    if (!ekip?.organization_id) return;
    const res = await listCrewCommercials({
      crewId: ekip.id,
      organizationId: ekip.organization_id,
    });
    if (res.success) setMaliyetler(res.data ?? []);
  }

  function varsayilandanAl(memberId: string) {
    if (!ekip?.organization_id) return;
    setMaliyetHatasi(null);
    startTransition(async () => {
      const res = await snapshotCrewCommercial({
        memberId,
        crewId: ekip.id,
        eventId,
        organizationId: ekip.organization_id!,
      });
      if (!res.success) {
        setMaliyetHatasi(res.error);
        return;
      }
      await maliyetTazele();
    });
  }

  function maliyetKaydet() {
    if (!ekip?.organization_id || !maliyetForm) return;
    const tutar = Number(maliyetForm.cost.replace(',', '.'));
    if (!Number.isFinite(tutar) || tutar < 0) {
      setMaliyetHatasi('Maliyet 0 veya daha büyük olmalı.');
      return;
    }
    let musteri: number | null = null;
    if (maliyetForm.clientPrice.trim() !== '') {
      const m = Number(maliyetForm.clientPrice.replace(',', '.'));
      if (!Number.isFinite(m) || m < 0) {
        setMaliyetHatasi('Müşteri fiyatı 0 veya daha büyük olmalı.');
        return;
      }
      musteri = m;
    }
    setMaliyetHatasi(null);
    const girdi = maliyetForm;
    startTransition(async () => {
      const res = await upsertCrewCommercial({
        memberId: girdi.memberId,
        crewId: ekip.id,
        eventId,
        organizationId: ekip.organization_id!,
        agreedCost: tutar,
        basis: girdi.basis,
        clientPrice: musteri,
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

  // ---- Ekip yok ----
  if (!ekip) {
    return (
      <div className="bg-card border border-line rounded-lg p-5">
        <p className="text-sm text-ink-72">
          Bu etkinlik için henüz ekip kurulmadı.
        </p>
        {hata && <p className="text-sm text-danger mt-2">{hata}</p>}
        {sahip && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {kurulusSecenekleri.length > 1 && (
              <select
                value={kurulusSecimi}
                onChange={(e) => setKurulusSecimi(e.target.value)}
                className={ALAN}
              >
                {kurulusSecenekleri.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={ekipKur}
              disabled={isPending}
              className={BTN_BIRINCIL}
            >
              {isPending ? 'Kuruluyor…' : 'Ekip kur'}
            </button>
            {kurulusSecenekleri.length === 1 && (
              <span className="text-xs text-ink-50">
                {kurulusSecenekleri[0].name} adına kurulacak
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  const maliyetMap = new Map(
    (maliyetler ?? []).map((m) => [m.crew_member_id, m])
  );

  return (
    <div className="space-y-4">
      {/* Ust satir: ekip durumu + gecisler */}
      <div className="bg-card border border-line rounded-lg p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm text-ink">
              {ekip.name} ·{' '}
              {EKIP_DURUM_ETIKETLERI[ekip.status] ?? ekip.status} ·{' '}
              {ekip.organization_id ? 'Kuruluş ekibi' : 'Bireysel ekip'}
            </p>
            <p className="text-sm text-ink-72 mt-1">
              {uyeler.length} üye
              {tamHizmet ? '' : eksikZorunlu.length > 0 ? ' · zorunlu roller eksik' : ''}
            </p>
          </div>

          {yazabilir && (
            <div className="flex items-center gap-2 flex-wrap">
              {ekip.status === 'draft' && (
                <button
                  type="button"
                  onClick={() => durumDegistir('proposed')}
                  disabled={isPending}
                  className={BTN_IKINCIL}
                >
                  Öneriye çevir
                </button>
              )}
              {ekip.status !== 'confirmed' && ekip.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => durumDegistir('confirmed')}
                  disabled={isPending}
                  className={BTN_BIRINCIL}
                >
                  Onayla
                </button>
              )}
              {ekip.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => setOnay({ tur: 'ekipIptal' })}
                  disabled={isPending}
                  className={BTN_IKINCIL}
                >
                  İptal et
                </button>
              )}
            </div>
          )}
        </div>

        {hata && <p className="text-sm text-danger mt-3">{hata}</p>}
        {bilgi && <p className="text-sm text-moss mt-3">{bilgi}</p>}

        {onay?.tur === 'ekipIptal' && (
          <div className="mt-3 px-4 py-3 bg-paper border border-line-strong rounded-lg flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-ink">
              Ekip iptal edilecek. Emin misin?
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setOnay(null);
                  durumDegistir('cancelled');
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
      </div>

      {/* Kapsam ozeti */}
      {kapsam.length > 0 && (
        <div className="bg-card border border-line rounded-lg p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
              Kapsam
            </p>
            {tamHizmet ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper bg-brand-ink px-2 py-0.5 rounded">
                Tam hizmet
              </span>
            ) : (
              eksikZorunlu.length > 0 && (
                <span className="text-xs text-ink-72">
                  Eksik: {eksikZorunlu.map((k) => k.rolAdi).join(', ')}
                </span>
              )
            )}
          </div>
          <ul className="space-y-1.5 text-sm">
            {kapsam
              .filter((k) => k.zorunlu)
              .map((k) => (
                <li key={k.roleId} className="flex items-center gap-2">
                  <span className="text-ink">
                    {k.rolAdi} {k.onaylanan}/{k.gereken}
                  </span>
                  {k.onaylanan >= k.gereken && (
                    <span className="text-moss" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </li>
              ))}
            {kapsam.some((k) => !k.zorunlu) && (
              <li className="text-ink-72 pt-1">
                İsteğe bağlı:{' '}
                {kapsam
                  .filter((k) => !k.zorunlu)
                  .map((k) => `${k.rolAdi} ${k.onaylanan}/${k.gereken}`)
                  .join(', ')}
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Uyeler */}
      <div className="space-y-3">
        {uyeler.length === 0 ? (
          <div className="bg-card border border-line rounded-lg p-5 text-sm text-ink-72">
            Ekipte henüz üye yok.
          </div>
        ) : (
          uyeler.map((u) => (
            <div key={u.id} className="bg-card border border-line rounded-lg p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-ink">
                    {u.ad}
                    {u.kilitli && (
                      <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72">
                        Kilitli
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-ink-72 mt-0.5">
                    {u.rolAdi} · {KAYNAK_ETIKETLERI[u.kaynak] ?? u.kaynak}
                    {u.sehir ? ` · ${u.sehir}` : ''}
                  </p>
                  {u.not && (
                    <p className="text-sm text-ink-72 mt-1">Not: {u.not}</p>
                  )}
                  {u.providerId && (
                    <Link
                      href={`/p/${u.providerId}`}
                      className="kashe-tap text-sm text-brand-ink hover:underline inline-block mt-1"
                    >
                      Profili gör
                    </Link>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {yazabilir ? (
                    <select
                      value={u.durum}
                      onChange={(e) =>
                        uyeDurumu(u.id, e.target.value as UyeDurum)
                      }
                      disabled={isPending}
                      className={ALAN}
                    >
                      {UYE_DURUM_SECENEKLERI.map((d) => (
                        <option key={d} value={d}>
                          {UYE_DURUM_ETIKETLERI[d]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72">
                      {UYE_DURUM_ETIKETLERI[u.durum] ?? u.durum}
                    </span>
                  )}

                  {yazabilir && (
                    <>
                      <button
                        type="button"
                        onClick={() => kilitDegistir(u.id, u.kilitli)}
                        disabled={isPending}
                        className={BTN_IKINCIL}
                      >
                        {u.kilitli ? 'Kilidi aç' : 'Kilitle'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNotDuzenlenen(u.id);
                          setNotMetni(u.not ?? '');
                        }}
                        className={BTN_IKINCIL}
                      >
                        Not
                      </button>
                    </>
                  )}
                  {duzenlenebilir && (
                    <button
                      type="button"
                      onClick={() =>
                        setOnay({ tur: 'uyeCikar', id: u.id, ad: u.ad })
                      }
                      disabled={isPending}
                      className={BTN_IKINCIL}
                    >
                      Çıkar
                    </button>
                  )}
                </div>
              </div>

              {notDuzenlenen === u.id && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={notMetni}
                    onChange={(e) => setNotMetni(e.target.value.slice(0, 2000))}
                    rows={2}
                    placeholder="Üye notu (isteğe bağlı)"
                    className={`${ALAN} w-full`}
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => notKaydet(u.id)}
                      disabled={isPending}
                      className={BTN_BIRINCIL}
                    >
                      Notu kaydet
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotDuzenlenen(null)}
                      className={BTN_IKINCIL}
                    >
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}

              {onay?.tur === 'uyeCikar' && onay.id === u.id && (
                <div className="mt-3 px-4 py-3 bg-paper border border-line-strong rounded-lg flex items-center justify-between gap-4 flex-wrap">
                  <p className="text-sm text-ink">
                    {onay.ad} ekipten çıkarılacak. Emin misin?
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        setOnay(null);
                        uyeCikar(u.id);
                      }}
                      className={BTN_BIRINCIL}
                    >
                      Çıkar
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
          ))
        )}
      </div>

      {/* Uye ekleme — rol basina adaylardan / havuzdan */}
      {duzenlenebilir && rolBloklari.length > 0 && (
        <div className="space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
            Üye ekle
          </p>
          {rolBloklari.map((blok) => (
            <div
              key={blok.roleId}
              className="bg-card border border-line rounded-lg p-5"
            >
              <p className="font-display font-semibold text-ink mb-2">
                {blok.rolAdi} · {blok.gereken} kişi
                {blok.zorunlu ? '' : ' (isteğe bağlı)'}
              </p>

              {blok.adaylar.length === 0 ? (
                <p className="text-sm text-ink-72">
                  Bu rol için aday yok; önce eşleştirme çalıştır.
                </p>
              ) : (
                <ul className="space-y-2">
                  {blok.adaylar.map((a) => (
                    <li
                      key={a.candidateId}
                      className="flex items-center justify-between gap-3 flex-wrap text-sm"
                    >
                      <span className="text-ink">
                        {a.ad} · %{a.uyum}
                      </span>
                      {a.ekipte ? (
                        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-50">
                          Ekipte
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            adaydanEkle(blok, a.candidateId, a.providerId)
                          }
                          disabled={isPending}
                          className={BTN_IKINCIL}
                        >
                          Ekibe ekle
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {havuzdanEklenebilir && (
                <div className="mt-3 pt-3 border-t border-line flex items-center gap-2 flex-wrap">
                  <select
                    value={havuzSecimi[blok.roleId] ?? ''}
                    onChange={(e) =>
                      setHavuzSecimi((o) => ({
                        ...o,
                        [blok.roleId]: e.target.value,
                      }))
                    }
                    className={ALAN}
                  >
                    <option value="">Havuzdan seç</option>
                    {blok.havuz.map((h) => (
                      <option key={h.recordId} value={h.recordId}>
                        {h.ad}
                        {h.roldeVar ? '' : ' — rolü yok'}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => havuzdanEkle(blok)}
                    disabled={isPending || blok.havuz.length === 0}
                    className={BTN_IKINCIL}
                  >
                    Havuzdan ekle
                  </button>
                  {blok.havuz.length === 0 && (
                    <span className="text-xs text-ink-50">
                      Havuzda kayıt yok
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
          <p className="text-xs text-ink-50">
            Ajans adayları ekibe eklenmez; ajansla tam hizmet teklifi FAZ 7.
          </p>
        </div>
      )}

      {/* Gizli ic maliyet — yalniz kurulus ekibi + commercial.view */}
      {maliyetGorulur && ekip.organization_id && (
        <div className="bg-card border border-line rounded-lg p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="font-display font-semibold text-ink">İç maliyet</p>
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
              {maliyetler === null ? (
                <p className="text-sm text-ink-72">Yükleniyor…</p>
              ) : uyeler.length === 0 ? (
                <p className="text-sm text-ink-72">Ekipte üye yok.</p>
              ) : (
                uyeler.map((u) => {
                  const m = maliyetMap.get(u.id);
                  const marj = marjYuzdesi(m?.margin_rate);
                  return (
                    <div
                      key={u.id}
                      className="border border-line rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm text-ink">
                            {u.ad} · {u.rolAdi}
                          </p>
                          {m ? (
                            <p className="text-sm text-ink-72 mt-0.5">
                              {tutarMetni(m.agreed_cost, m.currency)} ·{' '}
                              {MALIYET_BIRIM_ETIKETLERI[m.cost_basis] ??
                                m.cost_basis}
                              {m.client_price != null
                                ? ` · müşteri ${tutarMetni(m.client_price, m.currency)}`
                                : ''}
                              {marj !== null ? ` · marj %${marj}` : ''}
                              {m.markup_amount != null
                                ? ` (${tutarMetni(m.markup_amount, m.currency)})`
                                : ''}
                              {' · '}
                              {MALIYET_KAYNAK_ETIKETLERI[m.rate_source] ??
                                m.rate_source}
                            </p>
                          ) : (
                            <p className="text-sm text-ink-72 mt-0.5">
                              Maliyet girilmedi.
                            </p>
                          )}
                          {m?.private_note && (
                            <p className="text-sm text-ink-72 mt-1">
                              Not: {m.private_note}
                            </p>
                          )}
                        </div>

                        {maliyetYazilir && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {u.havuzKaydiVar && (
                              <button
                                type="button"
                                onClick={() => varsayilandanAl(u.id)}
                                disabled={isPending}
                                className={BTN_IKINCIL}
                              >
                                Varsayılan orandan al
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setMaliyetForm({
                                  memberId: u.id,
                                  cost: m ? String(m.agreed_cost) : '',
                                  basis: (MALIYET_BIRIM_SECENEKLERI.includes(
                                    (m?.cost_basis ?? '') as MaliyetBirimi
                                  )
                                    ? m!.cost_basis
                                    : 'per_job') as MaliyetBirimi,
                                  clientPrice:
                                    m?.client_price != null
                                      ? String(m.client_price)
                                      : '',
                                  note: m?.private_note ?? '',
                                })
                              }
                              className={BTN_IKINCIL}
                            >
                              Elle gir / güncelle
                            </button>
                          </div>
                        )}
                      </div>

                      {maliyetYazilir && maliyetForm?.memberId === u.id && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                            placeholder="Maliyet (TL)"
                            className={ALAN}
                          />
                          <select
                            value={maliyetForm.basis}
                            onChange={(e) =>
                              setMaliyetForm({
                                ...maliyetForm,
                                basis: e.target.value as MaliyetBirimi,
                              })
                            }
                            className={ALAN}
                          >
                            {MALIYET_BIRIM_SECENEKLERI.map((b) => (
                              <option key={b} value={b}>
                                {MALIYET_BIRIM_ETIKETLERI[b]}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={maliyetForm.clientPrice}
                            onChange={(e) =>
                              setMaliyetForm({
                                ...maliyetForm,
                                clientPrice: e.target.value,
                              })
                            }
                            placeholder="Müşteri fiyatı (isteğe bağlı)"
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
                          <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2 flex-wrap">
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
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
