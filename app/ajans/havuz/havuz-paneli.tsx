'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  DAVET_ETIKETLERI,
  DURUM_ETIKETLERI,
  DURUM_SECENEKLERI,
  ILISKI_ETIKETLERI,
  ILISKI_SECENEKLERI,
  type HavuzDurum,
  type HavuzIliskiTuru,
  type HavuzKaydi,
  type HavuzRolGirdisi,
  type HavuzRolSecenegi,
  type HavuzSaglayici,
  type HavuzSehir,
} from './havuz-data';
import {
  addTalentRecord,
  deleteTalentRecord,
  lookupTalentByContact,
  sendTalentInvitation,
  setTalentRecordRoles,
  updateTalentRecord,
} from './havuz-actions';

const ALAN =
  'w-full px-4 py-3 bg-paper border border-line rounded-lg text-ink text-sm focus:outline-none focus:border-brand-ink focus:ring-2 focus:ring-brand-ink-08 transition';
const ETIKET = 'block text-xs font-mono uppercase tracking-[0.14em] text-ink-72 mb-1.5';
const BTN_BIRINCIL =
  'kashe-tap px-5 py-2.5 bg-brand-ink text-paper rounded-lg font-display font-semibold text-sm hover:bg-brand-ink-deep transition-colors disabled:opacity-50';
const BTN_IKINCIL =
  'kashe-tap px-4 py-2 border border-line-strong text-ink rounded-lg font-display font-semibold text-sm hover:border-brand-ink hover:text-brand-ink transition-colors disabled:opacity-50';
const ETIKET_CIP =
  'font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded';

type FormDurumu = {
  name: string;
  email: string;
  phone: string;
  cityId: string;
  instagram: string;
  notes: string;
  relationshipType: HavuzIliskiTuru;
  status: HavuzDurum;
};

const BOS_FORM: FormDurumu = {
  name: '',
  email: '',
  phone: '',
  cityId: '',
  instagram: '',
  notes: '',
  relationshipType: 'regular_freelancer',
  status: 'active',
};

function tarih(v: string | null): string {
  if (!v) return '';
  return new Date(v).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function HavuzPaneli({
  organizationId,
  canManage,
  kayitlar,
  roller,
  sehirler,
  saglayicilar,
}: {
  organizationId: string;
  canManage: boolean;
  kayitlar: HavuzKaydi[];
  roller: HavuzRolSecenegi[];
  sehirler: HavuzSehir[];
  saglayicilar: HavuzSaglayici[];
}) {
  const [isPending, startTransition] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  // Filtreler — yerel state (sayfa tek kurulus, liste kucuk; URL'de tutulmaz).
  const [arama, setArama] = useState('');
  const [kaynakFiltre, setKaynakFiltre] = useState<'' | 'kashe' | 'harici'>('');
  const [rolFiltre, setRolFiltre] = useState('');
  const [iliskiFiltre, setIliskiFiltre] = useState('');
  const [durumFiltre, setDurumFiltre] = useState('');

  // Ekleme formu
  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState<FormDurumu>(BOS_FORM);
  const [formRolleri, setFormRolleri] = useState<HavuzRolGirdisi[]>([]);
  const [eslesme, setEslesme] = useState<{ talentId: string; matchKind: string } | null>(
    null
  );
  const [baglaSecili, setBaglaSecili] = useState(false);

  // Duzenleme
  const [duzenlenen, setDuzenlenen] = useState<string | null>(null);
  const [duzForm, setDuzForm] = useState<FormDurumu>(BOS_FORM);
  const [rolDuzenlenen, setRolDuzenlenen] = useState<string | null>(null);
  const [rolSecimi, setRolSecimi] = useState<HavuzRolGirdisi[]>([]);

  const saglayiciHaritasi = useMemo(() => {
    const m = new Map<string, HavuzSaglayici>();
    for (const s of saglayicilar) m.set(s.id, s);
    return m;
  }, [saglayicilar]);

  const sayaclar = useMemo(() => {
    let kashe = 0;
    let harici = 0;
    let bekleyen = 0;
    for (const k of kayitlar) {
      if (k.talent_id) kashe++;
      else harici++;
      if (k.invitation_status === 'sent') bekleyen++;
    }
    return { kashe, harici, bekleyen };
  }, [kayitlar]);

  const suzulmus = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr');
    return kayitlar.filter((k) => {
      if (q && !k.name.toLocaleLowerCase('tr').includes(q)) return false;
      if (kaynakFiltre === 'kashe' && !k.talent_id) return false;
      if (kaynakFiltre === 'harici' && k.talent_id) return false;
      if (iliskiFiltre && k.relationship_type !== iliskiFiltre) return false;
      if (durumFiltre && k.status !== durumFiltre) return false;
      if (rolFiltre) {
        const varMi = (k.organization_talent_record_roles ?? []).some(
          (r) => String(r.role_id) === rolFiltre
        );
        if (!varMi) return false;
      }
      return true;
    });
  }, [kayitlar, arama, kaynakFiltre, iliskiFiltre, durumFiltre, rolFiltre]);

  function mesajlariTemizle() {
    setHata(null);
    setBilgi(null);
  }

  function rolDegistir(
    liste: HavuzRolGirdisi[],
    setter: (v: HavuzRolGirdisi[]) => void,
    roleId: number
  ) {
    const varMi = liste.some((r) => r.roleId === roleId);
    if (varMi) setter(liste.filter((r) => r.roleId !== roleId));
    else setter([...liste, { roleId, isPrimary: liste.length === 0 }]);
  }

  function birincilYap(
    liste: HavuzRolGirdisi[],
    setter: (v: HavuzRolGirdisi[]) => void,
    roleId: number
  ) {
    setter(liste.map((r) => ({ ...r, isPrimary: r.roleId === roleId })));
  }

  /** E-posta/telefon alanindan cikildiginda kimlik esleme (yalniz RPC). */
  function eslemeAra() {
    if (!canManage) return;
    const email = form.email.trim();
    const phone = form.phone.trim();
    if (!email && !phone) {
      setEslesme(null);
      return;
    }
    startTransition(async () => {
      const res = await lookupTalentByContact({
        organizationId,
        email: email || null,
        phone: phone || null,
      });
      if (res.success) setEslesme(res.data ?? null);
      else setEslesme(null);
    });
  }

  function kaydet() {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await addTalentRecord({
        organizationId,
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        cityId: form.cityId ? Number(form.cityId) : null,
        instagram: form.instagram || null,
        notes: form.notes || null,
        relationshipType: form.relationshipType,
        talentId: baglaSecili && eslesme ? eslesme.talentId : null,
        roles: formRolleri,
      });
      if (res.success) {
        setForm(BOS_FORM);
        setFormRolleri([]);
        setEslesme(null);
        setBaglaSecili(false);
        setFormAcik(false);
        setBilgi('Kişi havuza eklendi.');
      } else {
        setHata(res.error);
      }
    });
  }

  function duzenlemeyiAc(k: HavuzKaydi) {
    mesajlariTemizle();
    setDuzenlenen(k.id);
    setRolDuzenlenen(null);
    setDuzForm({
      name: k.name,
      email: k.email ?? '',
      phone: k.phone ?? '',
      cityId: k.city_id ? String(k.city_id) : '',
      instagram: k.instagram ?? '',
      notes: k.notes ?? '',
      relationshipType: (k.relationship_type as HavuzIliskiTuru) ?? 'regular_freelancer',
      status: (k.status as HavuzDurum) ?? 'active',
    });
  }

  function duzenlemeyiKaydet(recordId: string) {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await updateTalentRecord({
        recordId,
        organizationId,
        name: duzForm.name,
        email: duzForm.email || null,
        phone: duzForm.phone || null,
        cityId: duzForm.cityId ? Number(duzForm.cityId) : null,
        instagram: duzForm.instagram || null,
        notes: duzForm.notes || null,
        relationshipType: duzForm.relationshipType,
        status: duzForm.status,
      });
      if (res.success) {
        setDuzenlenen(null);
        setBilgi('Kayıt güncellendi.');
      } else setHata(res.error);
    });
  }

  function durumDegistir(k: HavuzKaydi, yeni: HavuzDurum) {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await updateTalentRecord({
        recordId: k.id,
        organizationId,
        name: k.name,
        email: k.email,
        phone: k.phone,
        cityId: k.city_id,
        instagram: k.instagram,
        notes: k.notes,
        relationshipType: (k.relationship_type as HavuzIliskiTuru) ?? 'regular_freelancer',
        status: yeni,
      });
      if (res.success) setBilgi('Durum güncellendi.');
      else setHata(res.error);
    });
  }

  function rolleriAc(k: HavuzKaydi) {
    mesajlariTemizle();
    setRolDuzenlenen(k.id);
    setDuzenlenen(null);
    setRolSecimi(
      (k.organization_talent_record_roles ?? []).map((r) => ({
        roleId: r.role_id,
        isPrimary: r.is_primary,
      }))
    );
  }

  function rolleriKaydet(recordId: string) {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await setTalentRecordRoles({
        recordId,
        organizationId,
        roles: rolSecimi,
      });
      if (res.success) {
        setRolDuzenlenen(null);
        setBilgi('Roller güncellendi.');
      } else setHata(res.error);
    });
  }

  function davetGonder(recordId: string) {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await sendTalentInvitation({ recordId, organizationId });
      if (res.success) setBilgi('Davet e-postası gönderildi.');
      else setHata(res.error);
    });
  }

  function sil(recordId: string) {
    mesajlariTemizle();
    startTransition(async () => {
      const res = await deleteTalentRecord({ recordId, organizationId });
      if (res.success) setBilgi('Kayıt silindi.');
      else setHata(res.error);
    });
  }

  function rolSeciciler(
    liste: HavuzRolGirdisi[],
    setter: (v: HavuzRolGirdisi[]) => void
  ) {
    return (
      <div>
        <span className={ETIKET}>Roller</span>
        <div className="flex flex-wrap gap-2">
          {roller.map((r) => {
            const secili = liste.find((x) => x.roleId === r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => rolDegistir(liste, setter, r.id)}
                className={
                  secili
                    ? 'kashe-tap px-3 py-1.5 rounded-full border text-xs font-medium bg-brand-ink border-brand-ink text-paper'
                    : 'kashe-tap px-3 py-1.5 rounded-full border text-xs font-medium bg-card border-line text-ink-72 hover:border-brand-ink transition-colors'
                }
              >
                {r.name_tr}
              </button>
            );
          })}
        </div>
        {liste.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="text-xs text-ink-72">Birincil:</span>
            {liste.map((r) => {
              const rol = roller.find((x) => x.id === r.roleId);
              return (
                <label
                  key={r.roleId}
                  className="text-xs text-ink flex items-center gap-1.5 cursor-pointer"
                >
                  <input
                    type="radio"
                    name={`birincil-${liste.length}`}
                    checked={r.isPrimary}
                    onChange={() => birincilYap(liste, setter, r.roleId)}
                    className="accent-brand-ink"
                  />
                  {rol?.name_tr ?? r.roleId}
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sayaclar */}
      <div className="flex flex-wrap gap-3">
        <div className="bg-card border border-line rounded-lg px-4 py-3">
          <p className="font-display text-2xl text-ink leading-none">
            {sayaclar.kashe}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mt-1">
            Kashe üyesi
          </p>
        </div>
        <div className="bg-card border border-line rounded-lg px-4 py-3">
          <p className="font-display text-2xl text-ink leading-none">
            {sayaclar.harici}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mt-1">
            Harici
          </p>
        </div>
        <div className="bg-card border border-line rounded-lg px-4 py-3">
          <p className="font-display text-2xl text-ink leading-none">
            {sayaclar.bekleyen}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-72 mt-1">
            Davet bekleyen
          </p>
        </div>
      </div>

      {/* Filtreler */}
      <div className="bg-card border border-line rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input
          type="text"
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Ada göre ara"
          className={ALAN}
        />
        <select
          value={kaynakFiltre}
          onChange={(e) =>
            setKaynakFiltre(e.target.value as '' | 'kashe' | 'harici')
          }
          className={ALAN}
        >
          <option value="">Tüm kaynaklar</option>
          <option value="kashe">Kashe üyesi</option>
          <option value="harici">Harici</option>
        </select>
        <select
          value={rolFiltre}
          onChange={(e) => setRolFiltre(e.target.value)}
          className={ALAN}
        >
          <option value="">Tüm roller</option>
          {roller.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name_tr}
            </option>
          ))}
        </select>
        <select
          value={iliskiFiltre}
          onChange={(e) => setIliskiFiltre(e.target.value)}
          className={ALAN}
        >
          <option value="">Tüm ilişki türleri</option>
          {ILISKI_SECENEKLERI.map((v) => (
            <option key={v} value={v}>
              {ILISKI_ETIKETLERI[v]}
            </option>
          ))}
        </select>
        <select
          value={durumFiltre}
          onChange={(e) => setDurumFiltre(e.target.value)}
          className={ALAN}
        >
          <option value="">Tüm durumlar</option>
          {DURUM_SECENEKLERI.map((v) => (
            <option key={v} value={v}>
              {DURUM_ETIKETLERI[v]}
            </option>
          ))}
        </select>
      </div>

      {hata && (
        <p className="text-sm text-danger bg-danger/8 border border-danger/25 rounded-lg px-4 py-2.5">
          {hata}
        </p>
      )}
      {bilgi && (
        <p className="text-sm text-ink bg-brand-ink-08 border border-brand-ink/25 rounded-lg px-4 py-2.5">
          {bilgi}
        </p>
      )}

      {/* Harici kisi ekle */}
      {canManage && !formAcik && (
        <div className="bg-card border border-line rounded-lg p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-display text-lg text-ink">Harici kişi ekle</p>
            <p className="text-sm text-ink-72 mt-0.5">
              Kashe hesabı olmayan kişileri de havuzda tutabilirsin.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              mesajlariTemizle();
              setFormAcik(true);
            }}
            className={BTN_BIRINCIL}
          >
            + Kişi ekle
          </button>
        </div>
      )}

      {canManage && formAcik && (
        <div className="bg-card border border-line rounded-lg p-5 space-y-4">
          <p className="font-display text-lg text-ink">Harici kişi ekle</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="havuz-ad" className={ETIKET}>
                Ad <span className="text-danger">*</span>
              </label>
              <input
                id="havuz-ad"
                type="text"
                maxLength={200}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={ALAN}
              />
            </div>
            <div>
              <label htmlFor="havuz-eposta" className={ETIKET}>
                E-posta
              </label>
              <input
                id="havuz-eposta"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                onBlur={eslemeAra}
                className={ALAN}
              />
            </div>
            <div>
              <label htmlFor="havuz-telefon" className={ETIKET}>
                Telefon
              </label>
              <input
                id="havuz-telefon"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                onBlur={eslemeAra}
                className={ALAN}
              />
            </div>
            <div>
              <label htmlFor="havuz-sehir" className={ETIKET}>
                Şehir
              </label>
              <select
                id="havuz-sehir"
                value={form.cityId}
                onChange={(e) => setForm({ ...form, cityId: e.target.value })}
                className={ALAN}
              >
                <option value="">Belirtilmedi</option>
                {sehirler.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="havuz-instagram" className={ETIKET}>
                Instagram
              </label>
              <input
                id="havuz-instagram"
                type="text"
                maxLength={100}
                value={form.instagram}
                onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                className={ALAN}
              />
            </div>
            <div>
              <label htmlFor="havuz-iliski" className={ETIKET}>
                İlişki türü
              </label>
              <select
                id="havuz-iliski"
                value={form.relationshipType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    relationshipType: e.target.value as HavuzIliskiTuru,
                  })
                }
                className={ALAN}
              >
                {ILISKI_SECENEKLERI.map((v) => (
                  <option key={v} value={v}>
                    {ILISKI_ETIKETLERI[v]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {eslesme && (
            <div className="px-4 py-3 bg-brand-ink-08 border border-brand-ink/25 rounded-lg">
              <p className="text-sm text-ink">
                Bu kişi Kashe üyesi olabilir ({eslesme.matchKind === 'email' ? 'e-posta' : 'telefon'} eşleşmesi).
              </p>
              <label className="mt-2 flex items-center gap-2 text-sm text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={baglaSecili}
                  onChange={(e) => setBaglaSecili(e.target.checked)}
                  className="w-4 h-4 accent-brand-ink"
                />
                Kashe üyesi olarak bağla
              </label>
            </div>
          )}

          {rolSeciciler(formRolleri, setFormRolleri)}

          <div>
            <label htmlFor="havuz-not" className={ETIKET}>
              Not
            </label>
            <textarea
              id="havuz-not"
              rows={3}
              maxLength={4000}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={`${ALAN} resize-none`}
            />
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={kaydet}
              disabled={isPending || form.name.trim().length === 0}
              className={BTN_BIRINCIL}
            >
              {isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormAcik(false);
                setForm(BOS_FORM);
                setFormRolleri([]);
                setEslesme(null);
                setBaglaSecili(false);
              }}
              className={BTN_IKINCIL}
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      {suzulmus.length === 0 ? (
        <div className="bg-card border border-line rounded-lg p-12 text-center">
          <p className="font-display text-xl text-ink mb-2">Kayıt yok</p>
          <p className="text-ink-72 text-sm">
            Filtreleri değiştir ya da harici kişi ekle.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {suzulmus.map((k) => {
            const kullaniciId = k.talents?.user_id ?? null;
            const saglayici = kullaniciId
              ? saglayiciHaritasi.get(kullaniciId)
              : undefined;
            const gosterilenAd =
              saglayici?.display_name?.trim() || k.name || 'İsimsiz';
            const kayitRolleri = k.organization_talent_record_roles ?? [];

            return (
              <div
                key={k.id}
                className="bg-card border border-line rounded-lg p-5"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {k.talent_id ? (
                        <span
                          className={`${ETIKET_CIP} text-brand-ink bg-brand-ink/8`}
                        >
                          Kashe üyesi
                        </span>
                      ) : (
                        <span className={`${ETIKET_CIP} text-ink-72 bg-paper-2`}>
                          Harici
                        </span>
                      )}
                      <span className={`${ETIKET_CIP} text-ink-72`}>
                        {DURUM_ETIKETLERI[k.status] ?? k.status}
                      </span>
                      {!k.talent_id && (
                        <span className={`${ETIKET_CIP} text-ink-72`}>
                          {DAVET_ETIKETLERI[k.invitation_status] ??
                            k.invitation_status}
                          {k.invitation_status === 'sent' && k.invitation_sent_at
                            ? ` · ${tarih(k.invitation_sent_at)}`
                            : ''}
                        </span>
                      )}
                    </div>

                    <p className="font-display font-semibold text-lg text-ink">
                      {kullaniciId ? (
                        <Link
                          href={`/p/${kullaniciId}`}
                          className="hover:text-brand-ink hover:underline"
                        >
                          {gosterilenAd}
                        </Link>
                      ) : (
                        gosterilenAd
                      )}
                    </p>

                    <p className="text-sm text-ink-72 mt-1">
                      {[
                        ILISKI_ETIKETLERI[k.relationship_type] ??
                          k.relationship_type,
                        k.turkish_cities?.name ?? null,
                        k.email,
                        k.phone,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>

                    {kayitRolleri.length > 0 && (
                      <p className="text-sm text-ink-72 mt-1">
                        {kayitRolleri
                          .map(
                            (r) =>
                              `${r.service_roles?.name_tr ?? r.role_id}${r.is_primary ? ' (birincil)' : ''}`
                          )
                          .join(', ')}
                      </p>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => duzenlemeyiAc(k)}
                        className={BTN_IKINCIL}
                      >
                        Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => rolleriAc(k)}
                        className={BTN_IKINCIL}
                      >
                        Roller
                      </button>
                      {!k.talent_id &&
                        !!k.email &&
                        (k.invitation_status === 'none' ||
                          k.invitation_status === 'declined') && (
                          <button
                            type="button"
                            onClick={() => davetGonder(k.id)}
                            disabled={isPending}
                            className={BTN_IKINCIL}
                          >
                            Davet gönder
                          </button>
                        )}
                      {k.status !== 'passive' && (
                        <button
                          type="button"
                          onClick={() => durumDegistir(k, 'passive')}
                          disabled={isPending}
                          className={BTN_IKINCIL}
                        >
                          Pasife al
                        </button>
                      )}
                      {k.status !== 'active' && (
                        <button
                          type="button"
                          onClick={() => durumDegistir(k, 'active')}
                          disabled={isPending}
                          className={BTN_IKINCIL}
                        >
                          Aktife al
                        </button>
                      )}
                      {k.status !== 'blocked' && (
                        <button
                          type="button"
                          onClick={() => durumDegistir(k, 'blocked')}
                          disabled={isPending}
                          className={BTN_IKINCIL}
                        >
                          Engelle
                        </button>
                      )}
                      {k.talent_id ? (
                        <span className="text-xs text-ink-50">
                          Ekibim&apos;den yönetilir
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => sil(k.id)}
                          disabled={isPending}
                          className={BTN_IKINCIL}
                        >
                          Sil
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Duzenleme formu */}
                {duzenlenen === k.id && (
                  <div className="mt-5 pt-5 border-t border-line space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={ETIKET}>Ad</label>
                        <input
                          type="text"
                          maxLength={200}
                          value={duzForm.name}
                          onChange={(e) =>
                            setDuzForm({ ...duzForm, name: e.target.value })
                          }
                          className={ALAN}
                        />
                      </div>
                      <div>
                        <label className={ETIKET}>E-posta</label>
                        <input
                          type="email"
                          value={duzForm.email}
                          onChange={(e) =>
                            setDuzForm({ ...duzForm, email: e.target.value })
                          }
                          className={ALAN}
                        />
                      </div>
                      <div>
                        <label className={ETIKET}>Telefon</label>
                        <input
                          type="tel"
                          value={duzForm.phone}
                          onChange={(e) =>
                            setDuzForm({ ...duzForm, phone: e.target.value })
                          }
                          className={ALAN}
                        />
                      </div>
                      <div>
                        <label className={ETIKET}>Şehir</label>
                        <select
                          value={duzForm.cityId}
                          onChange={(e) =>
                            setDuzForm({ ...duzForm, cityId: e.target.value })
                          }
                          className={ALAN}
                        >
                          <option value="">Belirtilmedi</option>
                          {sehirler.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={ETIKET}>Instagram</label>
                        <input
                          type="text"
                          maxLength={100}
                          value={duzForm.instagram}
                          onChange={(e) =>
                            setDuzForm({ ...duzForm, instagram: e.target.value })
                          }
                          className={ALAN}
                        />
                      </div>
                      <div>
                        <label className={ETIKET}>İlişki türü</label>
                        <select
                          value={duzForm.relationshipType}
                          onChange={(e) =>
                            setDuzForm({
                              ...duzForm,
                              relationshipType: e.target
                                .value as HavuzIliskiTuru,
                            })
                          }
                          className={ALAN}
                        >
                          {ILISKI_SECENEKLERI.map((v) => (
                            <option key={v} value={v}>
                              {ILISKI_ETIKETLERI[v]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={ETIKET}>Durum</label>
                        <select
                          value={duzForm.status}
                          onChange={(e) =>
                            setDuzForm({
                              ...duzForm,
                              status: e.target.value as HavuzDurum,
                            })
                          }
                          className={ALAN}
                        >
                          {DURUM_SECENEKLERI.map((v) => (
                            <option key={v} value={v}>
                              {DURUM_ETIKETLERI[v]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {k.talent_id && (
                      <p className="text-xs text-ink-50">
                        Bu kayıt bir Kashe üyesine bağlı; bağlantı buradan
                        değiştirilemez.
                      </p>
                    )}

                    <div>
                      <label className={ETIKET}>Not</label>
                      <textarea
                        rows={3}
                        maxLength={4000}
                        value={duzForm.notes}
                        onChange={(e) =>
                          setDuzForm({ ...duzForm, notes: e.target.value })
                        }
                        className={`${ALAN} resize-none`}
                      />
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => duzenlemeyiKaydet(k.id)}
                        disabled={isPending}
                        className={BTN_BIRINCIL}
                      >
                        Kaydet
                      </button>
                      <button
                        type="button"
                        onClick={() => setDuzenlenen(null)}
                        className={BTN_IKINCIL}
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                )}

                {/* Rol duzenleme */}
                {rolDuzenlenen === k.id && (
                  <div className="mt-5 pt-5 border-t border-line space-y-4">
                    {rolSeciciler(rolSecimi, setRolSecimi)}
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        onClick={() => rolleriKaydet(k.id)}
                        disabled={isPending}
                        className={BTN_BIRINCIL}
                      >
                        Rolleri kaydet
                      </button>
                      <button
                        type="button"
                        onClick={() => setRolDuzenlenen(null)}
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
        </div>
      )}
    </div>
  );
}
