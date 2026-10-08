'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { tarihMetni, zamanMetni } from '@/app/lib/tarih';
import {
  DAVET_DURUM_ETIKETLERI,
  RFP_DURUM_ETIKETLERI,
  RFP_DURUM_SINIFLARI,
  ipucuMetni,
  paraMetni,
  sonTarihGecti,
  type RfpDetay,
  type RolSecenegi,
} from '../rfp-data';
import {
  addRfpItem,
  cancelRfp,
  deleteRfpItem,
  inviteRfp,
  searchAgencies,
  sendRfp,
  updateRfpFields,
  updateRfpItem,
} from '../rfp-actions';

/**
 * FAZ 7b / P1 — alici tarafi teklif talebi (RFP) ekrani.
 *
 * Talep/davet/durum YALNIZ RPC ile; taslak alanlari ve kalemler RLS ile
 * dogrudan yazilir (7a kalem editoru deseni). Butce ipucu YALNIZ bu ekranda
 * gorunur — degerler `rfp_detail` JSON'undan gelir, `rfp_items`'tan okunmaz.
 *
 * P2'de gelecek (Karsilastir / Sec / Revizyon iste / Degerlendirmeye al)
 * dugmeleri BU ISTE YOK.
 */

const BTN_BIRINCIL =
  'kashe-tap px-4 py-2 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50';
const BTN_IKINCIL =
  'kashe-tap px-3 py-1.5 border border-line-strong text-ink rounded-lg font-display font-semibold text-xs hover:border-brand-ink hover:text-brand-ink transition-colors disabled:opacity-50';
const ALAN =
  'px-3 py-2 bg-paper border border-line rounded-lg text-sm text-ink focus:border-brand-ink focus:outline-none';

type Onay =
  | { tur: 'kalemSil'; id: string }
  | { tur: 'gonder' }
  | { tur: 'iptal' }
  | null;

function sayi(v: string): number | null {
  const t = v.trim();
  if (t === '') return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function RfpEditoru({
  rfp,
  roller,
  canManage,
  datetimeLocal,
}: {
  rfp: RfpDetay;
  roller: RolSecenegi[];
  /** `events.manage` — taslak duzenleme, davet, gonderme, iptal. */
  canManage: boolean;
  /** Son tarihin `<input type="datetime-local">` degeri (sunucuda Istanbul'a cevrildi). */
  datetimeLocal: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [onay, setOnay] = useState<Onay>(null);

  const [baslik, setBaslik] = useState(rfp.title);
  const [aciklama, setAciklama] = useState(rfp.description ?? '');
  const [sonTarih, setSonTarih] = useState(datetimeLocal);

  const [kaydedildi, setKaydedildi] = useState<string | null>(null);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Yeni kalem
  const [yeniRol, setYeniRol] = useState<string>('');

  // Ajans arama
  const [aramaTerimi, setAramaTerimi] = useState('');
  const [sonuclar, setSonuclar] = useState<
    { id: string; name: string; cityId: number | null }[] | null
  >(null);

  const taslak = rfp.status === 'draft';
  const duzenlenebilir = canManage && taslak;
  const davetEklenebilir =
    canManage && ['draft', 'sent', 'collecting'].includes(rfp.status);
  const iptalEdilebilir =
    canManage && ['draft', 'sent', 'collecting', 'evaluating'].includes(rfp.status);
  const davetler = rfp.invites ?? [];

  function mesajlariTemizle() {
    setHata(null);
    setBilgi(null);
  }

  function alanKaydet(alan: 'baslik' | 'aciklama' | 'sonTarih') {
    if (!duzenlenebilir) return;
    mesajlariTemizle();
    startTransition(async () => {
      const girdi: Parameters<typeof updateRfpFields>[0] = { rfpId: rfp.id };
      if (alan === 'baslik') girdi.title = baslik;
      if (alan === 'aciklama') girdi.description = aciklama;
      if (alan === 'sonTarih') girdi.deadline = sonTarih;
      const res = await updateRfpFields(girdi);
      if (!res.success) setHata(res.error);
      else kaydedildiGoster('ust');
    });
  }

  function kalemEkle() {
    const rol = Number(yeniRol);
    if (!Number.isInteger(rol) || rol <= 0) {
      setHata('Rol seç.');
      return;
    }
    mesajlariTemizle();
    startTransition(async () => {
      const res = await addRfpItem({
        rfpId: rfp.id,
        roleId: rol,
        sortOrder: rfp.items.length + 1,
      });
      if (!res.success) setHata(res.error);
      else {
        setYeniRol('');
        kaydedildiGoster('kalem');
      }
    });
  }

  function kalemGuncelle(
    itemId: string,
    alan: Partial<{
      roleId: number;
      quantity: number;
      isRequired: boolean;
      budgetMin: number | null;
      budgetMax: number | null;
      notes: string | null;
    }>
  ) {
    if (!duzenlenebilir) return;
    mesajlariTemizle();
    startTransition(async () => {
      const res = await updateRfpItem({ itemId, rfpId: rfp.id, ...alan });
      if (!res.success) setHata(res.error);
      else kaydedildiGoster(itemId);
    });
  }

  function kalemSil(itemId: string) {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await deleteRfpItem({ itemId, rfpId: rfp.id });
      if (!res.success) setHata(res.error);
    });
  }

  function ara() {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await searchAgencies(aramaTerimi);
      if (!res.success) {
        setHata(res.error);
        return;
      }
      setSonuclar(res.data ?? []);
    });
  }

  function davetEt(providerId: string) {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await inviteRfp({ rfpId: rfp.id, providerId });
      if (!res.success) {
        setHata(res.error);
        return;
      }
      setSonuclar(null);
      setAramaTerimi('');
      setBilgi('Ajans davet edildi.');
      router.refresh();
    });
  }

  function gonder() {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await sendRfp(rfp.id);
      if (!res.success) {
        setHata(res.error);
        return;
      }
      setBilgi('Teklif talebi gönderildi.');
      router.refresh();
    });
  }

  function iptalEt() {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await cancelRfp(rfp.id);
      if (!res.success) {
        setHata(res.error);
        return;
      }
      setBilgi('Teklif talebi iptal edildi.');
      router.refresh();
    });
  }

  const etkinlikSatiri = rfp.event
    ? [
        rfp.event.title?.trim() || null,
        rfp.event.event_type,
        tarihMetni(rfp.event.start_date),
        [rfp.event.city, rfp.event.district].filter(Boolean).join(' / ') || null,
        rfp.event.participant_count ? `${rfp.event.participant_count} kişi` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <div className="space-y-5">
      {/* Ust blok */}
      <div className="bg-card border border-line rounded-2xl p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brand-ink">
              Teklif talebi (RFP)
            </p>
            {duzenlenebilir ? (
              <input
                type="text"
                value={baslik}
                onChange={(e) => setBaslik(e.target.value.slice(0, 200))}
                onBlur={() => {
                  if (baslik.trim() !== rfp.title) alanKaydet('baslik');
                }}
                className="mt-2 w-full font-display text-2xl text-ink bg-transparent border-b border-transparent hover:border-line focus:border-brand-ink focus:outline-none"
              />
            ) : (
              <h1 className="mt-2 font-display text-2xl md:text-3xl text-ink leading-tight">
                {rfp.title}
              </h1>
            )}
            {etkinlikSatiri && (
              <p className="text-sm text-ink-72 mt-2">{etkinlikSatiri}</p>
            )}
          </div>

          <div className="text-right shrink-0">
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.14em] border px-2.5 py-1 rounded-full ${RFP_DURUM_SINIFLARI[rfp.status] ?? 'bg-paper-2 border-line text-ink-72'}`}
            >
              {RFP_DURUM_ETIKETLERI[rfp.status] ?? rfp.status}
            </span>
            {kaydedildi === 'ust' && (
              <p className="text-xs text-moss mt-1">Kaydedildi</p>
            )}
          </div>
        </div>

        {hata && <p className="text-sm text-danger mt-3">{hata}</p>}
        {bilgi && <p className="text-sm text-moss mt-3">{bilgi}</p>}

        <div className="mt-5 pt-5 border-t border-line grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-ink-72 mb-1">
              Son tarih (yanıt için)
            </label>
            {duzenlenebilir ? (
              <input
                type="datetime-local"
                value={sonTarih}
                onChange={(e) => setSonTarih(e.target.value)}
                onBlur={() => alanKaydet('sonTarih')}
                className={`${ALAN} w-full`}
              />
            ) : (
              <p
                className={
                  sonTarihGecti(rfp.deadline)
                    ? 'text-sm text-danger'
                    : 'text-sm text-ink'
                }
              >
                {zamanMetni(rfp.deadline) ?? 'Belirtilmedi'}
                {sonTarihGecti(rfp.deadline) ? ' — süresi geçti' : ''}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs text-ink-72 mb-1">Açıklama</label>
            {duzenlenebilir ? (
              <textarea
                value={aciklama}
                onChange={(e) => setAciklama(e.target.value.slice(0, 4000))}
                onBlur={() => {
                  if (aciklama.trim() !== (rfp.description ?? '')) {
                    alanKaydet('aciklama');
                  }
                }}
                rows={3}
                placeholder="Ajanslara iletmek istediğin notlar"
                className={`${ALAN} w-full`}
              />
            ) : (
              <p className="text-sm text-ink whitespace-pre-wrap">
                {rfp.description || 'Açıklama girilmedi.'}
              </p>
            )}
          </div>
        </div>
        {duzenlenebilir && (
          <p className="text-xs text-ink-50 mt-2">
            Değişiklikler alandan çıkınca kaydedilir.
          </p>
        )}
      </div>

      {/* KALEMLER */}
      <div className="bg-card border border-line rounded-2xl p-6 md:p-8">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <p className="font-display font-semibold text-ink">İstenen roller</p>
          {!taslak && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72">
              Gönderildi — kilitli
            </span>
          )}
        </div>
        {duzenlenebilir && (
          <p className="text-xs text-ink-50 mb-3">
            Bütçe ipucu <strong>yalnız size görünür</strong>; ajanslar görmez.
          </p>
        )}

        {rfp.items.length === 0 ? (
          <p className="text-sm text-ink-72">Henüz kalem yok.</p>
        ) : (
          <div className="space-y-2">
            {/* Sutun basliklari */}
            <div className="hidden sm:grid sm:grid-cols-12 gap-2 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72">
              <span className="sm:col-span-3">Rol</span>
              <span className="sm:col-span-1">Adet</span>
              <span className="sm:col-span-2">Bütçe ipucu (TL)</span>
              <span className="sm:col-span-4">Not</span>
              <span className="sm:col-span-2 text-right">Zorunlu</span>
            </div>

            {rfp.items.map((k) => (
              <div key={k.id} className="border border-line rounded-lg p-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-3">
                    {duzenlenebilir ? (
                      <select
                        defaultValue={String(k.role_id)}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (n !== k.role_id) kalemGuncelle(k.id, { roleId: n });
                        }}
                        className={`${ALAN} w-full`}
                      >
                        {roller.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name_tr}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-ink">{k.role}</p>
                    )}
                  </div>
                  <div className="sm:col-span-1">
                    {duzenlenebilir ? (
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
                    ) : (
                      <p className="text-sm text-ink-72">{k.quantity}</p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    {duzenlenebilir ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          defaultValue={
                            k.budget_hint_min != null
                              ? String(k.budget_hint_min)
                              : ''
                          }
                          onBlur={(e) =>
                            kalemGuncelle(k.id, {
                              budgetMin: sayi(e.target.value),
                            })
                          }
                          placeholder="min"
                          className={`${ALAN} w-full`}
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          defaultValue={
                            k.budget_hint_max != null
                              ? String(k.budget_hint_max)
                              : ''
                          }
                          onBlur={(e) =>
                            kalemGuncelle(k.id, {
                              budgetMax: sayi(e.target.value),
                            })
                          }
                          placeholder="max"
                          className={`${ALAN} w-full`}
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-ink-72">
                        {ipucuMetni(k.budget_hint_min, k.budget_hint_max) ?? '—'}
                      </p>
                    )}
                  </div>
                  <div className="sm:col-span-4">
                    {duzenlenebilir ? (
                      <input
                        type="text"
                        defaultValue={k.notes ?? ''}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v !== (k.notes ?? '')) {
                            kalemGuncelle(k.id, { notes: v });
                          }
                        }}
                        placeholder="Not (isteğe bağlı)"
                        className={`${ALAN} w-full`}
                      />
                    ) : (
                      <p className="text-sm text-ink-72">{k.notes ?? '—'}</p>
                    )}
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-end gap-2">
                    <label className="inline-flex items-center gap-1.5 text-xs text-ink-72">
                      <input
                        type="checkbox"
                        checked={k.is_required}
                        disabled={!duzenlenebilir || isPending}
                        onChange={(e) =>
                          kalemGuncelle(k.id, { isRequired: e.target.checked })
                        }
                      />
                      Zorunlu
                    </label>
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

                {kaydedildi === k.id && (
                  <p className="text-xs text-moss mt-1">Kaydedildi</p>
                )}

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
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <select
              value={yeniRol}
              onChange={(e) => setYeniRol(e.target.value)}
              className={ALAN}
            >
              <option value="">Rol seç</option>
              {roller.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name_tr}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={kalemEkle}
              disabled={isPending || !yeniRol}
              className={BTN_IKINCIL}
            >
              Kalem ekle
            </button>
          </div>
        )}
      </div>

      {/* DAVETLER */}
      <div className="bg-card border border-line rounded-2xl p-6 md:p-8">
        <p className="font-display font-semibold text-ink mb-3">
          Davet edilen ajanslar ({davetler.length})
        </p>

        {davetler.length === 0 ? (
          <p className="text-sm text-ink-72">Henüz ajans davet edilmedi.</p>
        ) : (
          <ul className="space-y-2">
            {davetler.map((d) => (
              <li key={d.id} className="border border-line rounded-lg p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm text-ink">
                      {d.seller_name?.trim() || 'İsimsiz kuruluş'}
                    </p>
                    {d.status === 'responded' && d.version_no != null && (
                      <p className="text-sm text-ink-72 mt-0.5">
                        Sürüm {d.version_no} ·{' '}
                        {paraMetni(d.total_amount) ?? '—'}
                        {d.sent_at
                          ? ` · gönderim ${tarihMetni(d.sent_at)}`
                          : ''}
                      </p>
                    )}
                    {d.status === 'viewed' && d.viewed_at && (
                      <p className="text-xs text-ink-50 mt-0.5">
                        Görüntüledi: {zamanMetni(d.viewed_at)}
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-72 shrink-0">
                    {DAVET_DURUM_ETIKETLERI[d.status] ?? d.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {davetEklenebilir && (
          <div className="mt-4 pt-4 border-t border-line">
            <label className="block text-xs text-ink-72 mb-1">
              Ajans ara (en az 2 harf)
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={aramaTerimi}
                onChange={(e) => setAramaTerimi(e.target.value.slice(0, 80))}
                placeholder="Ajans adı"
                className={ALAN}
              />
              <button
                type="button"
                onClick={ara}
                disabled={isPending || aramaTerimi.trim().length < 2}
                className={BTN_IKINCIL}
              >
                Ara
              </button>
            </div>

            {sonuclar !== null && (
              <div className="mt-3 space-y-2">
                {sonuclar.length === 0 ? (
                  <p className="text-sm text-ink-72">Ajans bulunamadı.</p>
                ) : (
                  sonuclar.map((a) => {
                    const ekli = davetler.some((d) => d.provider_id === a.id);
                    return (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-3 flex-wrap text-sm border border-line rounded-lg px-3 py-2"
                      >
                        <span className="text-ink">{a.name}</span>
                        {ekli ? (
                          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-50">
                            Davetli
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => davetEt(a.id)}
                            disabled={isPending}
                            className={BTN_IKINCIL}
                          >
                            Davet et
                          </button>
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

      {/* DURUM ISLEMLERI */}
      {canManage && (taslak || iptalEdilebilir) && (
        <div className="bg-card border border-line rounded-2xl p-6 md:p-8">
          <div className="flex items-center gap-2 flex-wrap">
            {taslak && (
              <button
                type="button"
                onClick={() => setOnay({ tur: 'gonder' })}
                disabled={isPending}
                className={BTN_BIRINCIL}
              >
                Gönder
              </button>
            )}
            {iptalEdilebilir && (
              <button
                type="button"
                onClick={() => setOnay({ tur: 'iptal' })}
                disabled={isPending}
                className={BTN_IKINCIL}
              >
                İptal et
              </button>
            )}
          </div>

          {onay?.tur === 'gonder' && (
            <div className="mt-3 px-4 py-3 bg-paper border border-line-strong rounded-lg flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm text-ink">
                {davetler.length} ajansa gönderilecek; gönderildikten sonra
                kalemler değişmez. Emin misin?
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setOnay(null);
                    gonder();
                  }}
                  className={BTN_BIRINCIL}
                >
                  Gönder
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

          {onay?.tur === 'iptal' && (
            <div className="mt-3 px-4 py-3 bg-paper border border-line-strong rounded-lg flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm text-ink">
                Teklif talebi iptal edilecek; davetli ajanslar bilgilendirilir.
                Emin misin?
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setOnay(null);
                    iptalEt();
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
      )}

      <p className="text-xs text-ink-50">
        Gelen tekliflerin kalemlerini karşılaştırma ve seçim ekranı sonraki
        sürümde.{' '}
        <Link href="/kurumsal/rfp" className="text-brand-ink hover:underline">
          Tüm talepler
        </Link>
      </p>
    </div>
  );
}
