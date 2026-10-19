'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setOrgMemberRole } from '@/app/lib/org-actions';
import {
  ORG_ROLES,
  ORG_ROLE_LABELS,
  ORG_ROLE_SUMMARIES,
  type OrgRole,
} from '@/app/lib/org-roles';

/**
 * FAZ 8-U — uye kartindaki "Kurulus rolu" secimi.
 *
 * Iki ekip sayfasi (ajans ve kurumsal) ayni kutuyu kullanir: RPC cagrisi,
 * onay kapisi ve yetki ozeti tek yerde dursun. Yazma yalniz
 * `org_member_set_role` ile; kurallarin asil kapisi DB.
 *
 * `owner` secimi dogrudan kaydedilmez: satir ici onay istenir ("Cikar"
 * dugmesindeki desen) — sahiplik devri geri alinmasi zor bir islemdir.
 */
export function KurulusRolSecici({
  membershipId,
  rol,
  aynalanmamis = false,
}: {
  /** `organization_memberships.id` = eski uye satirinin id'si (ayna ayni id ile yazar). */
  membershipId: string;
  /** Mevcut kurulus rolu; ayna satiri yoksa 'viewer' gosterilir. */
  rol: OrgRole;
  /** Ayna satiri bulunamadi — deger varsayilan, uyari `title`'da. */
  aynalanmamis?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [secilen, setSecilen] = useState<OrgRole>(rol);
  const [ownerOnayi, setOwnerOnayi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  function kaydet(yeni: OrgRole) {
    setHata(null);
    startTransition(async () => {
      const r = await setOrgMemberRole(membershipId, yeni);
      if (!r.success) {
        setHata(r.error);
        setSecilen(rol); // basarisiz: gorunur deger geri alinir
        return;
      }
      router.refresh();
    });
  }

  function rolDegisti(yeni: string) {
    const deger = yeni as OrgRole;
    setHata(null);
    if (deger === secilen) return;
    setSecilen(deger);
    if (deger === 'owner') {
      // Sahiplik devri: once onay.
      setOwnerOnayi(true);
      return;
    }
    setOwnerOnayi(false);
    kaydet(deger);
  }

  return (
    <div className="min-w-[190px]">
      <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-ink-72 mb-1">
        Kuruluş rolü
      </label>
      <select
        value={secilen}
        disabled={isPending}
        onChange={(e) => rolDegisti(e.target.value)}
        title={
          aynalanmamis
            ? 'Bu üye için kuruluş üyeliği henüz aynalanmamış; varsayılan gösteriliyor.'
            : ORG_ROLE_SUMMARIES[secilen]
        }
        className="w-full px-3 py-1.5 bg-paper border border-line rounded-lg text-sm text-ink focus:border-brand-ink focus:outline-none disabled:opacity-50"
      >
        {ORG_ROLES.map((r) => (
          <option key={r} value={r} title={ORG_ROLE_SUMMARIES[r]}>
            {ORG_ROLE_LABELS[r]}
          </option>
        ))}
      </select>

      <p className="text-[11px] text-ink-50 leading-snug mt-1">
        {ORG_ROLE_SUMMARIES[secilen]}
      </p>

      {aynalanmamis && (
        <p className="text-[11px] text-ink-50 leading-snug mt-1">
          Kuruluş üyeliği henüz aynalanmamış; varsayılan gösteriliyor.
        </p>
      )}

      {ownerOnayi && (
        <div className="mt-2 px-3 py-2 bg-paper border border-line-strong rounded-lg">
          <p className="text-xs text-ink">Sahip yapılsın mı?</p>
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setOwnerOnayi(false);
                kaydet('owner');
              }}
              className="kashe-tap px-3 py-1 bg-brand-ink text-paper rounded-lg font-display font-semibold text-xs hover:bg-brand-ink-deep transition-colors disabled:opacity-50"
            >
              Onayla
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setOwnerOnayi(false);
                setSecilen(rol);
              }}
              className="kashe-tap px-3 py-1 border border-line-strong text-ink rounded-lg font-display font-semibold text-xs hover:border-brand-ink hover:text-brand-ink transition-colors disabled:opacity-50"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {hata && <p className="text-[11px] text-danger mt-1">{hata}</p>}
    </div>
  );
}
