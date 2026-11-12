import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PanelKabugu, PanelBaslik } from '@/app/components/panel';
import { panelKabukProps } from '@/app/lib/panel-kabuk';
import { SuspendedNotice } from '@/app/components/suspended-notice';
import { VurguEtiketi } from '@/app/components/ui/vurgu-etiketi';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { getCrewContext, type CrewOrg } from '@/app/lib/org-context';
import {
  ORG_ROLE_SUMMARIES,
  ORG_ROLE_SUMMARIES_KURUMSAL,
  orgRolEtiketi,
  type OrgRole,
} from '@/app/lib/org-roles';
import { tarihMetni } from '@/app/lib/tarih';
import { UyeliktenAyril } from './uyelikten-ayril';
import { TeklifTercihi } from './teklif-tercihi';

export const metadata = {
  title: 'Kuruluş üyeliğim — Kashe',
};

/**
 * KURULUS UYELIGIM (Duzeltme 15-C, bulgu 131) — `/kurulus/uyelik?kurulus=<id>`.
 *
 * Panel menusunde kurulus adi (grup basligi) tiklanmiyordu; uye "bu ajansla
 * bagim ne, ne gorebiliyorum" sorusunun cevabini bulamiyordu (Fahri satir 36).
 * Bu sayfa kurulusu, uyelik rolunu, katilma tarihini ve ACIK yetkileri gosterir;
 * sahip olmayan uye buradan ayrilabilir (eylem zaten vardi, ekrani yoktu).
 *
 * Yetki satirlari `getCrewContext`in hesapladigi bayraklardan gelir (sunucudaki
 * yetki fonksiyonlarinin sonucu): ekranda yazan ile sayfalarin actigi ayni.
 * `?kurulus` yoksa ve tek kurulus varsa o secilir; uye olunmayan id `/profil`e
 * gider (baska kurulusun bilgisi gosterilmez).
 */
function yetkiSatirlari(org: CrewOrg): { metin: string; acik: boolean }[] {
  const ajans = org.accountType === 'agency';
  const satirlar: { metin: string; acik: boolean }[] = [
    { metin: 'Etkinlikleri görme', acik: org.canViewEvents },
    { metin: 'Etkinlik oluşturma ve düzenleme', acik: org.canManageEvents },
    { metin: 'Ekipleri görme', acik: org.canViewCrew },
    { metin: 'Ekip kurma ve düzenleme', acik: org.canManageCrew },
    {
      metin: ajans ? "Teklifleri ve gelen RFP'leri görme" : 'Teklif taleplerini görme',
      acik: org.canViewProposals,
    },
    { metin: 'Finans ve kazançları görme', acik: org.canViewFinance },
    { metin: 'Üyeleri yönetme', acik: org.canManageMembers },
    { metin: 'Kuruluş ayarları', acik: org.canManageSettings },
  ];
  if (ajans && org.talentPoolEnabled) {
    satirlar.splice(4, 0, { metin: 'Yetenek havuzunu görme', acik: org.canViewTalent });
  }
  return satirlar;
}

export default async function KurulusUyelikPage({
  searchParams,
}: {
  searchParams: Promise<{ kurulus?: string }>;
}) {
  const { kurulus } = await searchParams;

  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) redirect('/giris?redirect=/kurulus/uyelik');

  const { data: suspensionCheck } = await supabase
    .from('profiles')
    .select('suspended_at, role')
    .eq('id', user.id)
    .single();
  if (suspensionCheck?.suspended_at) return <SuspendedNotice />;

  const { orgs } = await getCrewContext();
  const org =
    orgs.find((o) => o.id === kurulus) ?? (orgs.length === 1 ? orgs[0] : null);
  if (!org) redirect('/profil');

  const { data: uyelikData } = await supabase
    .from('organization_memberships')
    .select('id, role, joined_at, offers_via_agency')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .maybeSingle();
  const uyelik = uyelikData as {
    id: string;
    role: string;
    joined_at: string | null;
    /** Duzeltme 15-E: talepler ajans uzerinden mi yanitlaniyor. */
    offers_via_agency: boolean | null;
  } | null;
  const ajansUzerinden = uyelik?.offers_via_agency === true;

  const ajans = org.accountType === 'agency';
  const turAdi = ajans ? 'Ajans' : 'Kurum';
  const sahip = org.role === 'owner';
  const rol = (uyelik?.role ?? org.role) as OrgRole;
  const rolOzeti =
    (ajans ? ORG_ROLE_SUMMARIES : ORG_ROLE_SUMMARIES_KURUMSAL)[rol] ?? null;
  const yetkiler = yetkiSatirlari(org);
  const acikYetkiler = yetkiler.filter((y) => y.acik);
  const kapaliYetkiler = yetkiler.filter((y) => !y.acik);
  const profesyonel = suspensionCheck?.role === 'professional';

  const kabuk = await panelKabukProps();

  return (
    <PanelKabugu {...kabuk}>
      <div className="max-w-3xl space-y-6">
        <PanelBaslik
          eyebrow={`${turAdi} · ${org.name}`}
          altNot={`${org.name} ile bağın: rolün, ne zamandan beri üyesi olduğun ve neleri yapabildiğin.`}
        >
          <em className="not-italic font-medium text-brand-accent">Üyeliğin</em>
        </PanelBaslik>

        {/* Kurulus + rol */}
        <section className="bg-card border border-line rounded-xl p-5">
          <VurguEtiketi>Bu {ajans ? 'ajanstaki' : 'kurumdaki'} üyeliğin</VurguEtiketi>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
            <div className="rounded-xl border border-line px-3 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
                Kuruluş
              </p>
              <p className="font-display font-semibold text-ink mt-1 break-words">
                {org.name}
              </p>
            </div>
            <div className="rounded-xl border border-brand-ink bg-brand-ink/[0.05] px-3 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
                Rolün
              </p>
              <p className="font-display font-semibold text-ink mt-1">
                {orgRolEtiketi(rol)}
              </p>
            </div>
            <div className="rounded-xl border border-line px-3 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-50">
                Üyelik başlangıcı
              </p>
              <p className="font-display font-semibold text-ink mt-1">
                {tarihMetni(uyelik?.joined_at) ?? '—'}
              </p>
            </div>
          </div>
          {rolOzeti && <p className="text-sm text-ink-72 mt-3">{rolOzeti}</p>}
          <div className="flex items-center gap-4 flex-wrap mt-4 text-sm">
            <Link
              href={ajans ? '/ajans' : '/kurumsal'}
              className="kashe-tap text-brand-ink hover:underline"
            >
              {org.name} paneli →
            </Link>
            {ajans && org.legacyProfileId && (
              <Link
                href={`/p/${org.legacyProfileId}`}
                className="kashe-tap text-brand-ink hover:underline"
              >
                Ajansın profilini gör →
              </Link>
            )}
          </div>
        </section>

        {/* Yetkiler */}
        <section className="bg-card border border-line rounded-xl p-5">
          <VurguEtiketi>Neleri yapabilirsin</VurguEtiketi>
          <ul className="mt-3 space-y-1">
            {acikYetkiler.map((y) => (
              <li key={y.metin} className="text-sm text-ink-72 flex items-start gap-2">
                <span className="text-moss shrink-0" aria-hidden="true">
                  ✓
                </span>
                {y.metin}
              </li>
            ))}
            {acikYetkiler.length === 0 && (
              <li className="text-sm text-ink-72">
                Bu rolde açık bir yetki görünmüyor.
              </li>
            )}
          </ul>
          {kapaliYetkiler.length > 0 && (
            <p className="text-xs text-ink-50 mt-3">
              Bu rolde kapalı:{' '}
              {kapaliYetkiler.map((y) => y.metin.toLocaleLowerCase('tr')).join(', ')}.
              Rolünü kuruluş sahibi ya da yöneticisi değiştirebilir.
            </p>
          )}
        </section>

        {/* Baglanti nasil calisir (ajans uyesi profesyonel) */}
        {ajans && profesyonel && !sahip && (
          <section className="bg-card border border-line rounded-xl p-5">
            <VurguEtiketi>Bağlantı nasıl çalışır</VurguEtiketi>
            <ul className="mt-3 space-y-1.5 text-sm text-ink-72">
              <li className="flex items-start gap-2">
                <span className="text-moss shrink-0" aria-hidden="true">✓</span>
                Kendi profilin, takvimin, tekliflerin ve kazancın sende kalır.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-moss shrink-0" aria-hidden="true">✓</span>
                {ajansUzerinden
                  ? `Sana gelen talepler ${org.name} hesabına gider; teklifi ajans verir, rezervasyon ajans adına oluşur (aşağıdaki tercihin).`
                  : 'Sana doğrudan gelen talepleri sen yanıtlarsın; teklif ve rezervasyon senin adına oluşur.'}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-moss shrink-0" aria-hidden="true">✓</span>
                Ajans, profilindeki ekip bölümünde seni gösterir ve etkinlik
                ekiplerine ekleyebilir; müşteri ajans üzerinden de teklif
                isteyebilir.
              </li>
            </ul>
          </section>
        )}

        {/* Teklif tercihi (Duzeltme 15-E, karar 1-A): ajans uyesi profesyonel */}
        {ajans && profesyonel && !sahip && uyelik && (
          <section className="bg-card border border-line rounded-xl p-5">
            <VurguEtiketi>Teklif tercihin</VurguEtiketi>
            <TeklifTercihi
              orgId={org.id}
              ajansAdi={org.name}
              ajansUzerinden={ajansUzerinden}
            />
          </section>
        )}

        {/* Ayrilma */}
        <section className="bg-card border border-line rounded-xl p-5">
          <VurguEtiketi>Üyelikten ayrılma</VurguEtiketi>
          {sahip || !uyelik ? (
            <p className="text-sm text-ink-72 mt-3">
              {sahip
                ? 'Bu kuruluşun sahibisin; sahip kuruluştan ayrılamaz.'
                : 'Üyelik kaydın okunamadı.'}
            </p>
          ) : (
            <UyeliktenAyril
              membershipId={uyelik.id}
              ajans={ajans}
              kurulusAdi={org.name}
            />
          )}
        </section>
      </div>
    </PanelKabugu>
  );
}
