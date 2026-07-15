// ADMİN EXCEL RAPORU — /admin/rapor (GET) → kashe-rapor-YYYY-MM-DD.xlsx
//
// Sunucu tarafında üretim (exceljs). Admin-only: route handler layout guard'ından
// GEÇMEZ, bu yüzden is_admin kontrolü BURADA tekrar yapılır (layout.tsx kalıbı).
// Veri kaynakları admin panelinin mevcut sorguları/RPC'leriyle aynı (yeni analitik yok).
// 200 kayıt ölçeğinde basit üretim; streaming/ileri optimizasyon yok.

import { createClient } from '@/app/lib/supabase-server';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROLE_TR: Record<string, string> = {
  client: 'Müşteri',
  professional: 'Profesyonel',
  business: 'İşletme',
  agency: 'Ajans',
};
const APPROVAL_TR: Record<string, string> = {
  approved: 'Onaylı',
  pending: 'Bekliyor',
  revision: 'Revizyon',
  rejected: 'Reddedildi',
};
const APPROVABLE = ['professional', 'business', 'agency'];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function monthKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function tl(n: number): string {
  return `${Math.round(n).toLocaleString('tr-TR')} ₺`;
}

type ProfileRow = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  created_at: string | null;
  last_seen_at: string | null;
  approval_status: string | null;
  is_published: boolean | null;
  suspended_at: string | null;
  category_attributes: Record<string, unknown> | null;
  turkish_cities: { name: string } | null;
  service_categories: { name_tr: string } | null;
};

export async function GET() {
  const supabase = await createClient();

  // ---- Admin guard (layout.tsx kalıbı; route handler layout'tan geçmez) ----
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Yetkisiz', { status: 401 });
  const { data: me } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!me?.is_admin) return new Response('Yetkisiz', { status: 403 });

  // ---- Veri toplama (mevcut kaynaklar) ----
  const [profilesRes, servicesRes, ratingRes, statsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select(
        `id, full_name, company_name, email, phone, role, created_at, last_seen_at,
         approval_status, is_published, suspended_at, category_attributes,
         turkish_cities(name),
         service_categories!profiles_primary_category_id_fkey(name_tr)`
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('services')
      .select('profile_id, price_min, price_max, price_on_request')
      .eq('is_active', true),
    supabase
      .from('professional_rating_summary')
      .select('professional_id, review_count, average_rating'),
    // bookings/quotes DOĞRUDAN okunmaz: admin RLS yalnız taraf olduğu kayıtları döndürür
    // (eksik sayım). SECURITY DEFINER RPC RLS'i baypas edip doğru aylık sayımı verir.
    supabase.rpc('admin_report_stats'),
  ]);

  const profiles = (profilesRes.data ?? []) as unknown as ProfileRow[];
  const services = (servicesRes.data ?? []) as {
    profile_id: string;
    price_min: number | null;
    price_max: number | null;
    price_on_request: boolean;
  }[];
  const ratings = (ratingRes.data ?? []) as {
    professional_id: string;
    review_count: number;
    average_rating: number;
  }[];
  // RPC (RLS-bypass) — aylık bookings/quotes sayımları. Hata olursa rapor YİNE üretilir:
  // ilgili hücreler "—" + console.error (komple çökme yok).
  let statsError = false;
  const bookingsByMonth = new Map<string, number>();
  const quotesByMonth = new Map<string, number>();
  if (statsRes.error) {
    statsError = true;
    console.error('[admin-export] admin_report_stats RPC error:', statsRes.error);
  } else {
    for (const r of (statsRes.data ?? []) as {
      metric: string;
      month: string;
      cnt: number;
    }[]) {
      const cnt = Number(r.cnt ?? 0);
      if (r.metric === 'bookings') bookingsByMonth.set(r.month, cnt);
      else if (r.metric === 'quotes') quotesByMonth.set(r.month, cnt);
    }
  }
  const totalBookings = [...bookingsByMonth.values()].reduce((s, n) => s + n, 0);
  const totalQuotes = [...quotesByMonth.values()].reduce((s, n) => s + n, 0);

  // Hizmetleri profile göre grupla (fiyat aralığı için)
  const svcByProfile = new Map<string, typeof services>();
  for (const s of services) {
    const arr = svcByProfile.get(s.profile_id) ?? [];
    arr.push(s);
    svcByProfile.set(s.profile_id, arr);
  }
  const ratingByProfile = new Map(ratings.map((r) => [r.professional_id, r]));

  function priceRange(profileId: string): string {
    const svcs = svcByProfile.get(profileId) ?? [];
    if (svcs.length === 0) return '—';
    const numeric = svcs.filter((s) => !s.price_on_request && s.price_min != null);
    if (numeric.length === 0) return 'Talep üzerine';
    const min = Math.min(...numeric.map((s) => s.price_min as number));
    const max = Math.max(...numeric.map((s) => (s.price_max ?? s.price_min) as number));
    return min === max ? tl(min) : `${tl(min)} – ${tl(max)}`;
  }

  const displayName = (p: ProfileRow) =>
    (p.role === 'business' || p.role === 'agency') && p.company_name
      ? p.company_name
      : p.full_name || p.email || 'İsimsiz';

  // ---- ÖZET aggregate'leri ----
  const totalUsers = profiles.length;
  const roleCount: Record<string, number> = { client: 0, professional: 0, business: 0, agency: 0 };
  const approvalCount: Record<string, number> = { approved: 0, pending: 0, revision: 0, rejected: 0 };
  let published = 0;
  let unpublished = 0;
  const catCount = new Map<string, number>();
  for (const p of profiles) {
    if (p.role in roleCount) roleCount[p.role] += 1;
    if (APPROVABLE.includes(p.role)) {
      if (p.approval_status && p.approval_status in approvalCount)
        approvalCount[p.approval_status] += 1;
      if (p.is_published) published += 1;
      else unpublished += 1;
      const cat = p.service_categories?.name_tr;
      if (cat) catCount.set(cat, (catCount.get(cat) ?? 0) + 1);
    }
  }
  const totalReviews = ratings.reduce((s, r) => s + (r.review_count ?? 0), 0);
  const weightedRating = ratings.reduce(
    (s, r) => s + (r.average_rating ?? 0) * (r.review_count ?? 0),
    0
  );
  const avgRating = totalReviews > 0 ? weightedRating / totalReviews : 0;

  // ---- Aylık trend — kayıt (profiles, RLS'siz sayım) + rezervasyon/teklif (RPC) ----
  const kayitByMonth = new Map<string, number>();
  for (const p of profiles) {
    const m = monthKey(p.created_at);
    if (m) kayitByMonth.set(m, (kayitByMonth.get(m) ?? 0) + 1);
  }
  const months = [
    ...new Set<string>([
      ...kayitByMonth.keys(),
      ...bookingsByMonth.keys(),
      ...quotesByMonth.keys(),
    ]),
  ].sort();

  // ============================ WORKBOOK ============================
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Kashe Admin';
  const HEADER_FILL = 'FF1F5C4A'; // zümrüt
  const headerStyle = (ws: ExcelJS.Worksheet) => {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    row.height = 20;
  };

  // ---- Sekme a: Özet ----
  const s1 = wb.addWorksheet('Özet');
  s1.columns = [
    { header: 'Metrik', key: 'k', width: 34 },
    { header: 'Değer', key: 'v', width: 22 },
  ];
  headerStyle(s1);
  const section = (t: string) => {
    const r = s1.addRow([t, '']);
    r.font = { bold: true, color: { argb: HEADER_FILL } };
  };
  s1.addRow(['Rapor tarihi', fmtDate(new Date().toISOString())]);
  section('— Kullanıcılar —');
  s1.addRow(['Toplam kullanıcı', totalUsers]);
  for (const key of ['client', 'professional', 'business', 'agency'])
    s1.addRow([ROLE_TR[key], roleCount[key]]);
  section('— Profil onay durumu (prof/işletme/ajans) —');
  for (const key of ['approved', 'pending', 'revision', 'rejected'])
    s1.addRow([APPROVAL_TR[key], approvalCount[key]]);
  section('— Yayın durumu —');
  s1.addRow(['Yayında', published]);
  s1.addRow(['Yayında değil', unpublished]);
  section('— Kategori dağılımı —');
  for (const [label, cnt] of [...catCount.entries()].sort((a, b) => b[1] - a[1]))
    s1.addRow([label, cnt]);
  section('— Genel —');
  s1.addRow(['Toplam rezervasyon', statsError ? '—' : totalBookings]);
  s1.addRow(['Toplam teklif', statsError ? '—' : totalQuotes]);
  s1.addRow(['Toplam yorum', totalReviews]);
  s1.addRow(['Ortalama puan', Number(avgRating.toFixed(2))]);

  // ---- Sekme b: Kullanıcılar ----
  const s2 = wb.addWorksheet('Kullanıcılar');
  s2.columns = [
    { header: 'Ad', key: 'ad', width: 26 },
    { header: 'E-posta', key: 'email', width: 30 },
    { header: 'Telefon', key: 'tel', width: 16 },
    { header: 'Rol', key: 'rol', width: 14 },
    { header: 'Şehir', key: 'sehir', width: 16 },
    { header: 'Kayıt tarihi', key: 'kayit', width: 14 },
    { header: 'Son aktiflik', key: 'son', width: 14 },
    { header: 'Durum', key: 'durum', width: 16 },
  ];
  headerStyle(s2);
  for (const p of profiles) {
    const durum = p.suspended_at
      ? 'Askıda'
      : APPROVABLE.includes(p.role) && p.approval_status
        ? APPROVAL_TR[p.approval_status] ?? p.approval_status
        : 'Aktif';
    s2.addRow({
      ad: displayName(p),
      email: p.email ?? '—',
      tel: p.phone ?? '—',
      rol: ROLE_TR[p.role] ?? p.role,
      sehir: p.turkish_cities?.name ?? '—',
      kayit: fmtDate(p.created_at),
      son: fmtDate(p.last_seen_at),
      durum,
    });
  }

  // ---- Sekme c: Profesyoneller ----
  const s3 = wb.addWorksheet('Profesyoneller');
  s3.columns = [
    { header: 'Ad', key: 'ad', width: 26 },
    { header: 'Kategori', key: 'kat', width: 20 },
    { header: 'Onay', key: 'onay', width: 14 },
    { header: 'Yayın', key: 'yayin', width: 14 },
    { header: 'Şehir', key: 'sehir', width: 16 },
    { header: 'Fiyat aralığı', key: 'fiyat', width: 22 },
    { header: 'Deneyim', key: 'deneyim', width: 24 },
    { header: 'Yorum', key: 'yorum', width: 10 },
    { header: 'Ortalama', key: 'ort', width: 12 },
  ];
  headerStyle(s3);
  for (const p of profiles.filter((x) => x.role === 'professional' || x.role === 'agency')) {
    const r = ratingByProfile.get(p.id);
    const expLabel =
      typeof p.category_attributes?.experience_label === 'string'
        ? (p.category_attributes.experience_label as string)
        : '—';
    s3.addRow({
      ad: displayName(p),
      kat: p.service_categories?.name_tr ?? '—',
      onay: p.approval_status ? APPROVAL_TR[p.approval_status] ?? p.approval_status : '—',
      yayin: p.is_published ? 'Yayında' : 'Yayında değil',
      sehir: p.turkish_cities?.name ?? '—',
      fiyat: priceRange(p.id),
      deneyim: expLabel,
      yorum: r?.review_count ?? 0,
      ort: r && r.review_count > 0 ? Number(Number(r.average_rating).toFixed(2)) : '—',
    });
  }

  // ---- Sekme d: Aylık trend ----
  const s4 = wb.addWorksheet('Aylık trend');
  s4.columns = [
    { header: 'Ay', key: 'ay', width: 12 },
    { header: 'Kayıt', key: 'kayit', width: 12 },
    { header: 'Rezervasyon', key: 'rez', width: 14 },
    { header: 'Teklif', key: 'teklif', width: 12 },
  ];
  headerStyle(s4);
  for (const m of months) {
    s4.addRow({
      ay: m,
      kayit: kayitByMonth.get(m) ?? 0,
      rez: statsError ? '—' : (bookingsByMonth.get(m) ?? 0),
      teklif: statsError ? '—' : (quotesByMonth.get(m) ?? 0),
    });
  }

  const buffer = await wb.xlsx.writeBuffer();

  // ---- Audit log (mevcut kalıp) — export'u kaydet ----
  try {
    await supabase.from('admin_audit_log').insert({
      admin_id: user.id,
      action: 'export_report',
      target_type: 'report',
      target_id: null,
      notes: `xlsx · ${totalUsers} kullanıcı`,
    });
  } catch (e) {
    console.error('[admin-export] audit log error:', e);
  }

  const today = fmtDate(new Date().toISOString()).split('.').reverse().join('-');
  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="kashe-rapor-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
