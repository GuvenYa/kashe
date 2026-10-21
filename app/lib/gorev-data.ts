import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { ORG_ROLE_LABELS, type OrgRole } from '@/app/lib/org-roles';
import { ACIK_DURUMLAR, type AktiviteKaydi } from '@/app/lib/gorevler';

/**
 * FAZ 8a — gorev okuma katmani (SUNUCU).
 *
 * Okuma RLS ile: `tasks` ve `activity_logs` SELECT politikasi `events.view`
 * istiyor, yani sorgular kirac sinirini kendiliginden koruyor; buradaki
 * `organization_id` suzgeci gorunurluk degil KAPSAM daraltmasidir.
 *
 * Karsi taraf adi icin `organizations_public` kullanilmaz: gorev ve aktivite
 * AYNI kurulusun verisi, ad dogrudan `organizations`'tan gorunur.
 *
 * `internal.*` OKUNMAZ.
 */
export type GorevSatiri = {
  id: string;
  organization_id: string;
  event_id: string | null;
  title: string;
  description: string | null;
  status: string;
  assignee_user_id: string | null;
  assignee_talent_record_id: string | null;
  due_at: string | null;
  is_milestone: boolean;
  depends_on_task_id: string | null;
  sort_order: number;
  created_by: string | null;
  completed_at: string | null;
  created_at: string;
  assignee: { id: string; full_name: string | null; avatar_url: string | null } | null;
  havuz: { id: string; name: string } | null;
  event: { id: string; title: string | null; event_type: string } | null;
  bagli: { id: string; title: string } | null;
};

const GOREV_SECIM = `
  id, organization_id, event_id, title, description, status,
  assignee_user_id, assignee_talent_record_id, due_at, is_milestone,
  depends_on_task_id, sort_order, created_by, completed_at, created_at,
  assignee:profiles!tasks_assignee_user_id_fkey(id, full_name, avatar_url),
  havuz:organization_talent_records!tasks_assignee_talent_record_id_fkey(id, name),
  event:events!tasks_event_id_fkey(id, title, event_type),
  bagli:tasks!depends_on_task_id(id, title)
`;

/**
 * Siralama: son tarih (BOS OLANLAR SONDA) -> sort_order -> created_at.
 *
 * PostgREST `nullslast` ile tek sorguda yapilabiliyor; yine de tamamlanan ve
 * iptal edilen gorevler listenin DIBINE alinir (acik is once gorunur) — bu
 * kisim JS'te, cunku olcut enum degeri degil "acik mi" sorusudur.
 */
function sirala(a: GorevSatiri, b: GorevSatiri): number {
  const acik = (g: GorevSatiri) => (ACIK_DURUMLAR.includes(g.status as never) ? 0 : 1);
  if (acik(a) !== acik(b)) return acik(a) - acik(b);
  if (!!a.due_at !== !!b.due_at) return a.due_at ? -1 : 1;
  if (a.due_at && b.due_at && a.due_at !== b.due_at) {
    return a.due_at < b.due_at ? -1 : 1;
  }
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.created_at < b.created_at ? -1 : 1;
}

export async function gorevleriGetir(opts: {
  orgId: string;
  eventId?: string;
  /** Bos dizi = suzgec yok. */
  durum?: string[];
  atanan?: string;
  banaAtanan?: boolean;
}): Promise<GorevSatiri[]> {
  const supabase = await createClient();

  let sorgu = supabase
    .from('tasks')
    .select(GOREV_SECIM)
    .eq('organization_id', opts.orgId);

  if (opts.eventId) sorgu = sorgu.eq('event_id', opts.eventId);
  if (opts.durum && opts.durum.length > 0) sorgu = sorgu.in('status', opts.durum);

  if (opts.banaAtanan) {
    const user = await getCachedUser();
    if (!user) return [];
    sorgu = sorgu.eq('assignee_user_id', user.id);
  } else if (opts.atanan) {
    sorgu = sorgu.eq('assignee_user_id', opts.atanan);
  }

  const { data, error } = await sorgu.limit(300);
  if (error) {
    console.error('[gorev] liste', error.code, error.message);
    return [];
  }
  return ((data ?? []) as unknown as GorevSatiri[]).slice().sort(sirala);
}

/** Kullaniciya atanmis acik gorevler — TUM kuruluslar (profil merkezi karti). */
export async function banaAtananGorevler(limit = 5): Promise<GorevSatiri[]> {
  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('tasks')
    .select(GOREV_SECIM)
    .eq('assignee_user_id', user.id)
    .in('status', ACIK_DURUMLAR)
    .limit(50);
  if (error) {
    console.error('[gorev] bana atanan', error.code, error.message);
    return [];
  }
  return ((data ?? []) as unknown as GorevSatiri[])
    .slice()
    .sort(sirala)
    .slice(0, limit);
}

/** Gecikmis acik gorevler (gosterge karti). */
export async function gecikmisGorevler(
  orgId: string,
  limit = 5
): Promise<GorevSatiri[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .select(GOREV_SECIM)
    .eq('organization_id', orgId)
    .in('status', ACIK_DURUMLAR)
    .lt('due_at', new Date().toISOString())
    .order('due_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('[gorev] gecikmis', error.code, error.message);
    return [];
  }
  return (data ?? []) as unknown as GorevSatiri[];
}

/** Gosterge sayilari — tek sorgudan turetilir. */
export async function gorevSayilari(orgId: string): Promise<{
  acik: number;
  banaAtanan: number;
  gecikmis: number;
  buHaftaBiten: number;
}> {
  const supabase = await createClient();
  const user = await getCachedUser();

  const { data, error } = await supabase
    .from('tasks')
    .select('id, status, assignee_user_id, due_at, completed_at')
    .eq('organization_id', orgId)
    .limit(2000);
  if (error) {
    console.error('[gorev] sayim', error.code, error.message);
    return { acik: 0, banaAtanan: 0, gecikmis: 0, buHaftaBiten: 0 };
  }

  const satirlar = (data ?? []) as {
    status: string;
    assignee_user_id: string | null;
    due_at: string | null;
    completed_at: string | null;
  }[];
  const simdi = new Date();
  const haftaBasi = new Date(simdi.getTime() - 7 * 24 * 60 * 60 * 1000);
  const acikMi = (s: string) => ACIK_DURUMLAR.includes(s as never);

  return {
    acik: satirlar.filter((t) => acikMi(t.status)).length,
    banaAtanan: satirlar.filter(
      (t) => acikMi(t.status) && !!user && t.assignee_user_id === user.id
    ).length,
    gecikmis: satirlar.filter(
      (t) => acikMi(t.status) && !!t.due_at && new Date(t.due_at) < simdi
    ).length,
    buHaftaBiten: satirlar.filter(
      (t) =>
        t.status === 'done' &&
        !!t.completed_at &&
        new Date(t.completed_at) >= haftaBasi
    ).length,
  };
}

// -----------------------------------------------------------------------------
// Atanabilirler
// -----------------------------------------------------------------------------
export type Atanabilir =
  | { tur: 'user'; id: string; ad: string; altNot: string }
  | { tur: 'talent'; id: string; ad: string; altNot: string };

/**
 * Atanabilecek kisiler: kurulusun AKTIF uyeleri; ajansta ek olarak havuz
 * kayitlari (modul acikken).
 *
 * Tetikleyici ayni kurali DB'de uyguluyor ("atanan kisi kurulusun aktif uyesi
 * degil"); buradaki liste onun ONUNDEKI arayuz kapisidir, yerine gecmez.
 */
export async function atanabilirler(
  orgId: string,
  havuzDahil: boolean
): Promise<Atanabilir[]> {
  const supabase = await createClient();

  const [uyeSonuc, havuzSonuc] = await Promise.all([
    supabase
      .from('organization_memberships')
      .select('user_id, role, profiles!organization_memberships_user_id_fkey(id, full_name)')
      .eq('organization_id', orgId)
      .eq('status', 'active'),
    havuzDahil
      ? supabase
          .from('organization_talent_records')
          .select('id, name, status')
          .eq('organization_id', orgId)
          .eq('status', 'active')
          .order('name', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (uyeSonuc.error) {
    console.error('[gorev] uyeler', uyeSonuc.error.code, uyeSonuc.error.message);
  }
  if (havuzSonuc.error) {
    console.error('[gorev] havuz', havuzSonuc.error);
  }

  const uyeler: Atanabilir[] = (
    (uyeSonuc.data ?? []) as unknown as {
      user_id: string;
      role: string;
      profiles: { id: string; full_name: string | null } | null;
    }[]
  ).map((u) => ({
    tur: 'user' as const,
    id: u.user_id,
    ad: u.profiles?.full_name?.trim() || 'Kuruluş üyesi',
    altNot: ORG_ROLE_LABELS[u.role as OrgRole] ?? 'Üye',
  }));

  const havuz: Atanabilir[] = (
    (havuzSonuc.data ?? []) as { id: string; name: string }[]
  ).map((h) => ({
    tur: 'talent' as const,
    id: h.id,
    ad: h.name,
    altNot: 'Havuz kaydı',
  }));

  return [...uyeler, ...havuz];
}

// -----------------------------------------------------------------------------
// Aktivite
// -----------------------------------------------------------------------------
export type AktiviteSatiri = AktiviteKaydi & {
  aktorAdi: string;
  aktorAvatar: string | null;
};

/**
 * Aktivite akisi. Etkinlik sekmesinde kapsam: O ETKINLIGIN gorevleri +
 * `entity_type='event' AND entity_id=eventId`.
 *
 * Gorev id'leri once cekilir: `activity_logs` gorevin etkinligini TASIMAZ
 * (entity_id gorevin kendi kimligi), bu yuzden iliski uzerinden suzmek
 * mumkun degil.
 */
export async function aktiviteGetir(opts: {
  orgId: string;
  eventId?: string;
  /**
   * FAZ 8b — dogrudan varlik kimligi suzgeci (kisi sayfasi: kisi + firsatlari).
   * `eventId` ile BIRLIKTE kullanilmaz; verilirse o suzgec onceliklidir.
   */
  entityIds?: string[];
  limit?: number;
}): Promise<{ satirlar: AktiviteSatiri[]; dahaVar: boolean }> {
  const supabase = await createClient();
  const limit = opts.limit ?? 50;

  let sorgu = supabase
    .from('activity_logs')
    .select('id, actor_user_id, entity_type, entity_id, action, diff, created_at')
    .eq('organization_id', opts.orgId)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (opts.entityIds) {
    // Bos dizi = gosterilecek kayit yok; `in()` bos listeyle her satiri
    // getirecegi icin erken donulur.
    if (opts.entityIds.length === 0) return { satirlar: [], dahaVar: false };
    sorgu = sorgu.in('entity_id', opts.entityIds);
  } else if (opts.eventId) {
    const { data: gorevler } = await supabase
      .from('tasks')
      .select('id')
      .eq('organization_id', opts.orgId)
      .eq('event_id', opts.eventId)
      .limit(500);
    const gorevIdleri = ((gorevler ?? []) as { id: string }[]).map((g) => g.id);
    // Silinen gorevin logu kalir ama `tasks` satiri gitmistir; o kayitlar bu
    // suzgece girmez (kabul: etkinlik sekmesi YASAYAN gorevlerin gecmisini
    // gosterir, kurulus genel akisi hepsini).
    const kimlikler = [...gorevIdleri, opts.eventId];
    sorgu = sorgu.in('entity_id', kimlikler);
  }

  const { data, error } = await sorgu;
  if (error) {
    console.error('[gorev] aktivite', error.code, error.message);
    return { satirlar: [], dahaVar: false };
  }

  const ham = (data ?? []) as unknown as AktiviteKaydi[];
  const dahaVar = ham.length > limit;
  const kesilmis = dahaVar ? ham.slice(0, limit) : ham;

  // Aktor adlari — tek sorgu (N+1 yok)
  const aktorIdleri = Array.from(
    new Set(kesilmis.map((l) => l.actor_user_id).filter(Boolean) as string[])
  );
  const adlar = new Map<string, { ad: string; avatar: string | null }>();
  if (aktorIdleri.length > 0) {
    const { data: profiller } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', aktorIdleri);
    for (const p of (profiller ?? []) as {
      id: string;
      full_name: string | null;
      avatar_url: string | null;
    }[]) {
      adlar.set(p.id, {
        ad: p.full_name?.trim() || 'Kuruluş üyesi',
        avatar: p.avatar_url,
      });
    }
  }

  return {
    satirlar: kesilmis.map((l) => ({
      ...l,
      aktorAdi: l.actor_user_id
        ? (adlar.get(l.actor_user_id)?.ad ?? 'Kuruluş üyesi')
        : 'Sistem',
      aktorAvatar: l.actor_user_id
        ? (adlar.get(l.actor_user_id)?.avatar ?? null)
        : null,
    })),
    dahaVar,
  };
}

/**
 * Aktivite cumlesinde gecen kimliklerin adlari (atanan kisi, bagli gorev).
 * `aktiviteMetni`'ne verilir; bulunamayan kimlik icin cumle genel ifade kurar.
 */
export async function aktiviteAdlari(
  satirlar: AktiviteKaydi[]
): Promise<Map<string, string>> {
  const supabase = await createClient();
  const harita = new Map<string, string>();

  const uuidler = new Set<string>();
  const topla = (deger: unknown) => {
    if (!deger || typeof deger !== 'object') return;
    const o = deger as Record<string, unknown>;
    for (const k of ['from', 'to']) {
      const v = o[k];
      if (typeof v === 'string' && v.length === 36) uuidler.add(v);
    }
  };
  for (const l of satirlar) {
    topla(l.diff.assignee_user_id);
    topla(l.diff.assignee_talent_record_id);
    topla(l.diff.depends_on_task_id);
    // FAZ 8b: firsatin sahibi — cumle adi yazar, kimligi degil.
    topla(l.diff.owner_user_id);
    const sahip = l.diff.owner_user_id;
    if (typeof sahip === "string" && sahip.length === 36) uuidler.add(sahip);
    const atanan = l.diff.assignee_user_id;
    if (typeof atanan === 'string' && atanan.length === 36) uuidler.add(atanan);
    const havuz = l.diff.assignee_talent_record_id;
    if (typeof havuz === 'string' && havuz.length === 36) uuidler.add(havuz);
  }
  if (uuidler.size === 0) return harita;

  const liste = Array.from(uuidler);
  const [profiller, havuzlar, gorevler] = await Promise.all([
    supabase.from('profiles').select('id, full_name').in('id', liste),
    supabase.from('organization_talent_records').select('id, name').in('id', liste),
    supabase.from('tasks').select('id, title').in('id', liste),
  ]);

  for (const p of (profiller.data ?? []) as {
    id: string;
    full_name: string | null;
  }[]) {
    if (p.full_name?.trim()) harita.set(p.id, p.full_name.trim());
  }
  for (const h of (havuzlar.data ?? []) as { id: string; name: string }[]) {
    harita.set(h.id, h.name);
  }
  for (const g of (gorevler.data ?? []) as { id: string; title: string }[]) {
    harita.set(g.id, g.title);
  }
  return harita;
}

// -----------------------------------------------------------------------------
// Modul kapisi
// -----------------------------------------------------------------------------

/**
 * `tasks` modulu acik mi. `organization_modules` SELECT politikasi uyelik
 * istiyor; satir yoksa modul KAPALI sayilir (ajansa dolum yapildi, business
 * sahibi `/kurumsal/ayarlar`dan acar).
 */
export async function gorevModuluAcik(orgId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('organization_modules')
    .select('is_enabled')
    .eq('organization_id', orgId)
    .eq('module_key', 'tasks')
    .maybeSingle();
  if (error) {
    console.error('[gorev] modul', error.code, error.message);
    return false;
  }
  return data?.is_enabled === true;
}
