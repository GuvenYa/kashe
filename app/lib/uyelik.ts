import type { createClient } from '@/app/lib/supabase-server';
import type { OrgRole } from '@/app/lib/org-roles';

/**
 * KURULUS UYELIGI — ortak okuma katmani (FAZ 10a).
 *
 * TEK GERCEK `organization_memberships` / `organization_invitations`. Eski
 * tablolar (agency_members, business_members ve davet esleri) 10a-DB/01 ile
 * SALT OKUNUR oldu, aynalama tetikleyicileri kalkti; uygulama artik onlara
 * hic dokunmaz.
 *
 * YAZMA BURADA YOK: davet/uyelik yazma TEK YOL RPC
 * (`org_invitation_create/cancel/respond`, `org_member_remove/leave`,
 * `org_member_set_role`). Uygulamanin bu iki tabloda yalniz SELECT yetkisi
 * var. Buradaki tek yazma yardimcisi `uyelikHataMesaji` — DB'nin ASCII hata
 * metnini Turkce arayuz cumlesine cevirir.
 *
 * KURULUSUN KENDI HESABI (`legacy_source = 'owner_seed'`) ayri bir satirdir:
 * eski tablolarda yoktu, bu yuzden ekip listeleri ve "uyesi oldugum kurulus"
 * sayimlari onu DISARIDA birakir (asagidaki `OWNER_SEED` ile).
 */

type SunucuIstemcisi = Awaited<ReturnType<typeof createClient>>;

/** Kurulusun kendi hesabinin uyelik satiri — ekip listelerinde gosterilmez. */
export const OWNER_SEED = 'owner_seed';

/**
 * "Kurulusun kendi hesabi HARIC" PostgREST suzgeci (`.or(...)` ile kullanilir).
 *
 * NEDEN `or`: tek basina `.neq('legacy_source', 'owner_seed')` NULL satirlari
 * da DISARIDA birakir (SQL'de NULL <> 'x' -> NULL), oysa RPC ile acilan yeni
 * uyeliklerin `legacy_source`'u NULL. Iki kol birlikte "NULL ya da owner_seed
 * olmayan" demektir.
 */
export const OWNER_SEED_HARIC = `legacy_source.is.null,legacy_source.neq.${OWNER_SEED}`;

/** `organization_memberships.status` degerleri. */
export type UyelikDurumu = 'invited' | 'active' | 'suspended';

/** `organization_invitations.status` degerleri. */
export type DavetDurumu =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'expired';

export type Uyeligim = {
  membershipId: string;
  organizationId: string;
  /** Kurulusun pazaryeri profili (eski `agency_id` / `business_id`). */
  legacyProfileId: string | null;
  accountType: 'agency' | 'business';
  displayName: string | null;
  role: OrgRole;
  status: UyelikDurumu;
  legacySource: string | null;
};

/**
 * Kullanicinin SAHIBI oldugu kurulus (ajans ya da kurum hesabi).
 *
 * Kurulus satiri profile baglidir (`legacy_profile_id`); RLS uyeye okutur.
 * Ajans/kurum sahibi davet acarken ve ekip listesini okurken kendi
 * kurulusunun id'sini boyle bulur.
 */
export async function kurulusumunId(
  supabase: SunucuIstemcisi,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('legacy_profile_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[uyelik] kurulus id', error.code, error.message);
    return null;
  }
  return (data as { id: string } | null)?.id ?? null;
}

type UyelikSatiri = {
  id: string;
  organization_id: string;
  role: string;
  status: string;
  legacy_source: string | null;
  organizations: {
    id: string;
    legacy_profile_id: string | null;
    account_type: string;
    display_name: string | null;
  } | null;
};

/**
 * Kullanicinin AKTIF uyelikleri — tek sorgu (kurulus embed'i ile).
 *
 * `getCrewContext` ile karistirilmaz: o kurulus basina on bes yetki RPC'si
 * atar ve calisma alani baglami uretir. Burada yalniz uyelik satirlari var;
 * `business-write.ts` gibi her sayfada cagrilan yerler bunu kullanir.
 */
export async function uyeliklerim(
  supabase: SunucuIstemcisi,
  userId: string
): Promise<Uyeligim[]> {
  const { data, error } = await supabase
    .from('organization_memberships')
    .select(
      `id, organization_id, role, status, legacy_source,
       organizations!organization_memberships_organization_id_fkey (
         id, legacy_profile_id, account_type, display_name
       )`
    )
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) {
    console.error('[uyelik] uyelik listesi', error.code, error.message);
    return [];
  }

  const satirlar = (data ?? []) as unknown as UyelikSatiri[];
  const sonuc: Uyeligim[] = [];
  for (const s of satirlar) {
    const org = s.organizations;
    // Kurulus okunamadiysa (RLS) uyelik anlamsiz: hangi kurulus bilinmiyor.
    if (!org) continue;
    if (org.account_type !== 'agency' && org.account_type !== 'business') {
      continue;
    }
    sonuc.push({
      membershipId: s.id,
      organizationId: s.organization_id,
      legacyProfileId: org.legacy_profile_id ?? null,
      accountType: org.account_type,
      displayName: org.display_name,
      role: s.role as OrgRole,
      status: s.status as UyelikDurumu,
      legacySource: s.legacy_source,
    });
  }
  return sonuc;
}

/** Eski `business_members.member_role` semantigi. */
export type EskiKurumRolu = 'owner' | 'manager' | 'member';

/**
 * Ince kurulus rolunu eski uc kademeli kurum rolune indirir.
 *
 * `map_org_role_to_legacy` (FAZ 8-U) ile AYNI eslem: owner_seed/owner ->
 * owner, admin -> manager, digerleri -> member. Kurumsal yazma yetkisi
 * (ilan/teklif/kurum adina yorum) bugun bu uc kademeye bakiyor; eslem tek
 * yerde dursun diye burada.
 */
export function eskiKurumRolu(
  role: string | null | undefined,
  legacySource: string | null | undefined
): EskiKurumRolu {
  if (legacySource === OWNER_SEED || role === 'owner') return 'owner';
  if (role === 'admin') return 'manager';
  return 'member';
}

/**
 * DB hata metni -> Turkce arayuz cumlesi (FAZ 10a RPC'leri).
 *
 * DB metinleri ASCII (`RAISE EXCEPTION` govdeleri); eslesme ona gore yapilir.
 * Kurallar DB'de; bu fonksiyon onlari TEKRARLAMAZ, yalniz adlandirir.
 */
export function uyelikHataMesaji(error: {
  code?: string | null;
  message?: string | null;
}): string {
  const mesaj = error.message ?? '';

  // --- davet olusturma ---
  if (mesaj.includes('gecersiz e-posta adresi')) {
    return 'Geçerli bir e-posta adresi gir.';
  }
  if (mesaj.includes('sahip rolu davetle verilemez')) {
    return 'Sahip rolü davetle verilemez.';
  }
  if (mesaj.includes('davet mesaji en fazla 1000 karakter')) {
    return 'Davet mesajı en fazla 1000 karakter olabilir.';
  }
  if (mesaj.includes('kendine davet gonderemezsin')) {
    return 'Kendine davet gönderemezsin.';
  }
  if (mesaj.includes('kurulusun kendi hesabi davet edilemez')) {
    return 'Kuruluşun kendi hesabı davet edilemez.';
  }
  if (mesaj.includes('bu kullanici zaten uye')) {
    return 'Bu kullanıcı zaten ekibinde.';
  }

  // --- davet yaniti / iptal ---
  if (mesaj.includes('davet artik beklemede degil')) {
    return 'Bu davet artık beklemede değil.';
  }
  if (mesaj.includes('davetin suresi dolmus')) {
    return 'Davetin süresi dolmuş.';
  }
  if (mesaj.includes('bu davet sana ait degil')) {
    return 'Bu davet sana ait değil.';
  }
  if (mesaj.includes('ajansa katilmak icin profesyonel hesap gerekir')) {
    return 'Ajansa katılmak için profesyonel hesap gerekir.';
  }
  if (mesaj.includes('kurulusun kendi hesabi uye olamaz')) {
    return 'Kuruluşun kendi hesabı üye olamaz.';
  }
  if (mesaj.includes('davet yok')) {
    return 'Davet bulunamadı.';
  }

  // --- uyelik cikarma / ayrilma ---
  if (mesaj.includes('kendini cikaramazsin')) {
    return 'Kendini çıkaramazsın; ayrılmak için "Ayrıl" seçeneğini kullan.';
  }
  if (mesaj.includes('kurulus sahibi cikarilamaz')) {
    return 'Kuruluş sahibi çıkarılamaz.';
  }
  if (mesaj.includes('owner/admin uyeyi yalniz kurulus sahibi cikarir')) {
    return 'Sahip/Yönetici üyeyi yalnız kuruluş sahibi çıkarabilir.';
  }
  if (mesaj.includes('son sahip cikarilamaz')) {
    return 'Son sahip çıkarılamaz.';
  }
  if (mesaj.includes('kurulus sahibi ayrilamaz')) {
    return 'Kuruluş sahibi ayrılamaz.';
  }
  if (mesaj.includes('son sahip ayrilamaz')) {
    return 'Son sahip ayrılamaz.';
  }
  if (mesaj.includes('bu kurulusun uyesi degilsin')) {
    return 'Bu kuruluşun üyesi değilsin.';
  }

  // --- rol degisimi (org_member_set_role; FAZ 8-U metinleri) ---
  if (mesaj.includes('kendi rolunu degistiremezsin')) {
    return 'Kendi rolünü değiştiremezsin.';
  }
  if (mesaj.includes('owner/admin rolunu yalniz kurulus sahibi degistirir')) {
    return 'Sahip/Yönetici rolünü yalnız kuruluş sahibi değiştirebilir.';
  }
  if (mesaj.includes('son sahip dusurulemez')) {
    return 'Son sahip düşürülemez.';
  }
  if (mesaj.includes('kurulus sahibinin rolu degistirilemez')) {
    return 'Kuruluş sahibinin rolü değiştirilemez.';
  }
  if (mesaj.includes('uyelik aktif degil')) {
    return 'Bu üyelik aktif değil.';
  }

  // --- kod bazli ---
  // 23505: RPC'nin on kontrolu. 23P01: ayni anda iki davet girilirse EXCLUDE
  // kisiti (FAZ 0) devreye girer — kullanici icin ayni durum.
  if (
    error.code === '23505' ||
    error.code === '23P01' ||
    mesaj.includes('zaten bekleyen bir davet')
  ) {
    return 'Bu e-postaya zaten bekleyen bir davet var.';
  }
  if (error.code === '42501' || mesaj.includes('oturum gerekir')) {
    return 'Bu işlem için yetkin yok.';
  }
  if (error.code === 'P0002' || mesaj.includes('uyelik yok')) {
    return 'Kayıt bulunamadı.';
  }
  return 'İşlem yapılamadı, tekrar dene.';
}
