import { createClient } from '@/app/lib/supabase-server';
import {
  eskiKurumRolu,
  uyeliklerim,
  OWNER_SEED,
  type Uyeligim,
} from '@/app/lib/uyelik';

/**
 * KURUM ADINA YAZMA YETKISI — FAZ 10a.
 *
 * Kaynak `organization_memberships` (eski `business_members` SALT OKUNUR).
 * Ince kurulus rolu, eski uc kademeli kurum rolune `eskiKurumRolu` ile
 * indirilir (owner_seed/owner -> owner, admin -> manager, digerleri ->
 * member); kurumsal yazma yetkisi bugun bu uc kademeye bakiyor.
 *
 * KURULUSUN KENDI HESABI HARIC (`owner_seed`): eski `business_members`
 * kurumun kendi satirini icermiyordu ve kurum sahibi zaten kendi profil
 * id'siyle yaziyor. Bugunku davranis birebir korunur — `owner_seed`
 * satirlari burada hic sayilmaz.
 *
 * `business_id` degeri kurulusun PAZARYERI profil kimligidir
 * (`organizations.legacy_profile_id`): konusmalar, ilanlar ve yorumlar hala
 * o kimlige bagli.
 */

export type WritableBusiness = {
  business_id: string;
  business_name: string;
};

/** Kurum uyelikleri: hesap turu business + kurulusun kendi satiri haric. */
function kurumUyelikleri(uyelikler: Uyeligim[]): Uyeligim[] {
  return uyelikler.filter(
    (u) =>
      u.accountType === 'business' &&
      u.legacySource !== OWNER_SEED &&
      !!u.legacyProfileId
  );
}

async function kurumUyelikleriniOku(): Promise<Uyeligim[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  return kurumUyelikleri(await uyeliklerim(supabase, user.id));
}

/**
 * Kullanıcının manager+ (owner/manager) rolünde olduğu kurumlar — "kimin adına"
 * seçici + kurum adına oluşturma action'ları bunu kullanır.
 * Üyeliği yoksa boş dizi (seçici hiç render edilmez, form bugünkü gibi davranır).
 */
export async function getWritableBusinesses(): Promise<WritableBusiness[]> {
  const uyelikler = await kurumUyelikleriniOku();

  return uyelikler
    .filter((u) => {
      const rol = eskiKurumRolu(u.role, u.legacySource);
      return rol === 'owner' || rol === 'manager';
    })
    .map((u) => ({
      business_id: u.legacyProfileId as string,
      business_name: u.displayName?.trim() || 'Kurum',
    }));
}

/**
 * Kullanıcı verilen kurumda owner/manager mı? (kurum adına yazma yetkisi)
 * Action katmanında on_behalf_business_id doğrulaması için.
 */
export async function canWriteForBusiness(
  businessId: string
): Promise<boolean> {
  const uyelikler = await kurumUyelikleriniOku();
  const uyelik = uyelikler.find((u) => u.legacyProfileId === businessId);
  if (!uyelik) return false;
  const rol = eskiKurumRolu(uyelik.role, uyelik.legacySource);
  return rol === 'owner' || rol === 'manager';
}

/**
 * Kullanıcı verilen kurumda 'owner' ROLÜNDE mi? (owner-only aksiyonlar:
 * ilan silme, close/cancel, promotion, kurum adına yorum). manager YETMEZ.
 */
export async function canOwnForBusiness(businessId: string): Promise<boolean> {
  const uyelikler = await kurumUyelikleriniOku();
  const uyelik = uyelikler.find((u) => u.legacyProfileId === businessId);
  if (!uyelik) return false;
  return eskiKurumRolu(uyelik.role, uyelik.legacySource) === 'owner';
}

/**
 * Kullanıcının 'owner' rolünde olduğu kurumların id'leri (kurum adına yorum
 * bağlamını çözmek için — self konuşma yoksa owner kurumların konuşması aranır).
 */
export async function getOwnedBusinessIds(): Promise<string[]> {
  const uyelikler = await kurumUyelikleriniOku();
  return uyelikler
    .filter((u) => eskiKurumRolu(u.role, u.legacySource) === 'owner')
    .map((u) => u.legacyProfileId as string);
}

/**
 * Kurumsal ekip bağlamı — TEK sorguda üyelik id'leri + rol setleri. Sayfalarda
 * kopyalanan "uyelik oku + filtrele" blogunu (5+ yer) tek kaynaga tasir.
 *
 * - teamBusinessIds: üyesi olunan TÜM kurumlar (owner/manager/member) — okuma
 *   gorunurlugu. Kurumun kendi hesabi uye olamaz (DB kurali); kurulusun
 *   kendi uyelik satiri (`owner_seed`) da burada haric tutulur.
 * - canWriteSet: owner+manager (kurum adına yazma / yönetim — edit/publish/composer).
 * - canOwnSet: yalnız owner (owner-only aksiyonlar — silme/close/cancel/promotion).
 */
export async function getTeamContext(): Promise<{
  teamBusinessIds: string[];
  canWriteSet: Set<string>;
  canOwnSet: Set<string>;
}> {
  const uyelikler = await kurumUyelikleriniOku();

  const teamBusinessIds: string[] = [];
  const canWriteSet = new Set<string>();
  const canOwnSet = new Set<string>();

  for (const u of uyelikler) {
    const id = u.legacyProfileId as string;
    const rol = eskiKurumRolu(u.role, u.legacySource);
    teamBusinessIds.push(id);
    if (rol === 'owner' || rol === 'manager') canWriteSet.add(id);
    if (rol === 'owner') canOwnSet.add(id);
  }

  return { teamBusinessIds, canWriteSet, canOwnSet };
}
