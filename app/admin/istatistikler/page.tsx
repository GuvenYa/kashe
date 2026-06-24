'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase-browser'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

// ---- Kashe tema (P6 — zümrüt/mercan) ----
// Recharts inline renk ister (CSS değişkeni almaz), o yüzden hex sabit tutuldu.
const C = {
  paper: '#FFFFFF',
  terracotta: '#1F5C4A', // zümrüt
  ink: '#1A120E',
  plum: '#E2674A',       // mercan
  moss: '#3F6B47',       // yeşil (başarı/onay)
  ember: '#143D31',      // koyu zümrüt
}

const ROLE_LABELS: Record<string, string> = {
  client: 'Müşteri',
  professional: 'Profesyonel',
  business: 'İşletme',
  agency: 'Ajans',
}

const ROLE_COLORS: Record<string, string> = {
  client: C.terracotta,
  professional: C.plum,
  business: C.moss,
  agency: C.ember,
}

const QUOTE_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  accepted: 'Kabul',
  declined: 'Red',
  expired: 'Süresi doldu',
  withdrawn: 'Geri çekildi',
}

const QUOTE_COLORS: Record<string, string> = {
  pending: '#D98C3F',
  accepted: C.moss,
  declined: C.ember,
  expired: '#8C6B4F',
  withdrawn: C.plum,
}

const PIE_PALETTE = [C.terracotta, C.plum, C.moss, C.ember, '#D98C3F', '#8C6B4F', '#4F6B8C', '#A86B2E']

const ROLE_ORDER = ['client', 'professional', 'business', 'agency'] as const

const SERIF = 'var(--font-display), sans-serif'
const MONO = 'var(--font-mono), monospace'

// ---- Tipler ----
type RegRow = { bucket: string; role_key: string; cnt: number }
type ActiveRow = { role_key: string; total: number; active_7d: number; active_30d: number }
type MsgRow = { bucket: string; cnt: number }
type QuoteRow = { status_key: string; cnt: number }
type LabelRow = { label: string; cnt: number }
type SupplyDemandCatRow = {
  category_id: number
  label: string
  supply: number
  demand: number
  applications: number
}
type SupplyDemandCityRow = {
  city_id: number
  label: string
  supply: number
  demand: number
}
type TabKey = 'genel' | 'talep-arz' | 'icerik' | 'buyume' | 'huni' | 'tutundurma' | 'yonetim' | 'rezervasyon' | 'operasyonel'
type OpsListingFirstApp = { avg_hours: number; median_hours: number; measured_count: number }
type OpsAppResponse = {
  avg_hours: number
  median_hours: number
  responded_count: number
  total_count: number
  pending_count: number
}
type OpsMsgResponse = { avg_hours: number; median_hours: number; measured_count: number }
type BookingSummary = {
  total_count: number
  confirmed_count: number
  completed_count: number
  cancelled_count: number
  gmv: number
  avg_value: number
  cancelled_value: number
}
type BookingDailyRow = { bucket: string; gmv: number; cnt: number }
type QueueRow = { pending_profiles: number; pending_listings: number; pending_categories: number }
type AdminActionRow = {
  id: string
  admin_name: string
  action: string
  target_type: string
  target_id: string | null
  notes: string | null
  created_at: string
}
type TopFavRow = { profile_id: string; name: string; category: string | null; fav_count: number }
type TopRatedRow = { professional_id: string; name: string; category: string | null; avg_rating: number; review_count: number }
type TopViewedRow = { profile_id: string; name: string; category: string | null; views: number }
type ActiveCatRow = { category_id: number; label: string; listings_count: number; applications_count: number; activity: number }
type WeeklyCompareRow = { metric: string; this_week: number; last_week: number }
type WeeklyTrendRow = { week_start: string; kayit: number; ilan: number; basvuru: number; rezervasyon: number; mesaj: number; teklif: number }
type FunnelRow = { step: number; label: string; cnt: number }
type IncompleteProRow = { profile_id: string; name: string; category: string | null; approval_status: string; is_published: boolean }
type ListingNoAppRow = { listing_id: string; title: string; creator_id: string; creator_name: string; created_at: string }
type ProNoAppRow = { profile_id: string; name: string; category: string | null }

const num = (v: unknown) => Number(v ?? 0)
const fmtDate = (s: any) => {
  const parts = String(s ?? '').split('-')
  return parts.length === 3 ? `${parts[2]}.${parts[1]}` : String(s ?? '')
}

// ---- Küçük UI yapı taşları ----
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{ fontFamily: MONO, letterSpacing: '0.08em' }}
      className="text-[11px] uppercase text-terracotta"
    >
      {children}
    </span>
  )
}

function Card({
  title,
  eyebrow,
  children,
}: {
  title: string
  eyebrow?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h3
        style={{ fontFamily: SERIF }}
        className="mt-1 mb-4 text-xl font-semibold text-ink"
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

function StatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <Eyebrow>{label}</Eyebrow>
      <div
        style={{ fontFamily: SERIF, color: accent }}
        className="mt-1 text-3xl font-semibold"
      >
        {value}
      </div>
    </div>
  )
}

const tooltipStyle = {
  borderRadius: 12,
  border: `1px solid ${C.ink}1A`,
  fontFamily: 'var(--font-body), sans-serif',
  fontSize: 13,
  background: '#fff',
}

export default function IstatistiklerPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [reg, setReg] = useState<RegRow[]>([])
  const [active, setActive] = useState<ActiveRow[]>([])
  const [msgs, setMsgs] = useState<MsgRow[]>([])
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [cats, setCats] = useState<LabelRow[]>([])
  const [cities, setCities] = useState<LabelRow[]>([])
  const [sdCat, setSdCat] = useState<SupplyDemandCatRow[]>([])
  const [sdCity, setSdCity] = useState<SupplyDemandCityRow[]>([])
  const [topFav, setTopFav] = useState<TopFavRow[]>([])
  const [topRated, setTopRated] = useState<TopRatedRow[]>([])
  const [topViewed, setTopViewed] = useState<TopViewedRow[]>([])
  const [activeCats, setActiveCats] = useState<ActiveCatRow[]>([])
  const [weeklyCompare, setWeeklyCompare] = useState<WeeklyCompareRow[]>([])
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrendRow[]>([])
  const [funnelPro, setFunnelPro] = useState<FunnelRow[]>([])
  const [funnelClient, setFunnelClient] = useState<FunnelRow[]>([])
  const [incompletePros, setIncompletePros] = useState<IncompleteProRow[]>([])
  const [listingsNoApps, setListingsNoApps] = useState<ListingNoAppRow[]>([])
  const [prosNoApps, setProsNoApps] = useState<ProNoAppRow[]>([])
  const [queue, setQueue] = useState<QueueRow | null>(null)
  const [recentActions, setRecentActions] = useState<AdminActionRow[]>([])
  const [bookingSummary, setBookingSummary] = useState<BookingSummary | null>(null)
  const [bookingDaily, setBookingDaily] = useState<BookingDailyRow[]>([])
  const [opsFirstApp, setOpsFirstApp] = useState<OpsListingFirstApp | null>(null)
  const [opsAppResp, setOpsAppResp] = useState<OpsAppResponse | null>(null)
  const [opsMsgResp, setOpsMsgResp] = useState<OpsMsgResponse | null>(null)
  const [tab, setTab] = useState<TabKey>('genel')

  // Tarih aralığı — sadece akış metriklerini (kayıt + mesaj) etkiler.
  // 'Tümü' için büyük gün sayısı (pratikte tüm zaman).
  const RANGE_OPTIONS = [
    { key: 7, label: '7 gün' },
    { key: 30, label: '30 gün' },
    { key: 90, label: '90 gün' },
    { key: 3650, label: 'Tümü' },
  ] as const
  const [pDays, setPDays] = useState<number>(30)
  const rangeLabel =
    RANGE_OPTIONS.find((o) => o.key === pDays)?.label ?? `${pDays} gün`

  // İlk yükleme — filtreden bağımsız (anlık durum + sabit pencere) RPC'ler.
  // registrations + messages ayrı effect'te (p_days'e bağlı).
  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      try {
        const [r2, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16, r17, r18, r19, r20, r21] = await Promise.all([
          supabase.rpc('admin_stats_active_users'),
          supabase.rpc('admin_stats_quotes'),
          supabase.rpc('admin_stats_categories'),
          supabase.rpc('admin_stats_cities'),
          supabase.rpc('admin_stats_supply_demand_category'),
          supabase.rpc('admin_stats_supply_demand_city'),
          supabase.rpc('admin_stats_top_favorited'),
          supabase.rpc('admin_stats_top_rated'),
          supabase.rpc('admin_stats_top_viewed'),
          supabase.rpc('admin_stats_active_categories'),
          supabase.rpc('admin_stats_weekly_compare'),
          supabase.rpc('admin_stats_weekly_trend'),
          supabase.rpc('admin_funnel_professional'),
          supabase.rpc('admin_funnel_client'),
          supabase.rpc('admin_retention_incomplete_pros'),
          supabase.rpc('admin_retention_listings_no_apps'),
          supabase.rpc('admin_retention_pros_no_apps'),
          supabase.rpc('admin_queue_counts'),
          supabase.rpc('admin_recent_actions', { p_limit: 30 }),
        ])

        const firstErr = [r2, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16, r17, r18, r19, r20, r21].find((r) => r.error)?.error
        if (firstErr) throw firstErr

        setActive((r2.data ?? []) as ActiveRow[])
        setQuotes((r4.data ?? []) as QuoteRow[])
        setCats((r5.data ?? []) as LabelRow[])
        setCities((r6.data ?? []) as LabelRow[])
        setSdCat((r7.data ?? []) as SupplyDemandCatRow[])
        setSdCity((r8.data ?? []) as SupplyDemandCityRow[])
        setTopFav((r9.data ?? []) as TopFavRow[])
        setTopRated((r10.data ?? []) as TopRatedRow[])
        setTopViewed((r11.data ?? []) as TopViewedRow[])
        setActiveCats((r12.data ?? []) as ActiveCatRow[])
        setWeeklyCompare((r13.data ?? []) as WeeklyCompareRow[])
        setWeeklyTrend((r14.data ?? []) as WeeklyTrendRow[])
        setFunnelPro((r15.data ?? []) as FunnelRow[])
        setFunnelClient((r16.data ?? []) as FunnelRow[])
        setIncompletePros((r17.data ?? []) as IncompleteProRow[])
        setListingsNoApps((r18.data ?? []) as ListingNoAppRow[])
        setProsNoApps((r19.data ?? []) as ProNoAppRow[])
        setQueue(((r20.data ?? [])[0] ?? null) as QueueRow | null)
        setRecentActions((r21.data ?? []) as AdminActionRow[])
      } catch (e: any) {
        setError(e?.message ?? 'İstatistikler yüklenirken bir hata oluştu.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Akış metrikleri — p_days değişince yeniden çağrılır (kayıt + mesaj + rezervasyon).
  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      try {
        const [rReg, rMsg, rBs, rBd, rO1, rO2, rO3] = await Promise.all([
          supabase.rpc('admin_stats_registrations', { p_days: pDays }),
          supabase.rpc('admin_stats_messages', { p_days: pDays }),
          supabase.rpc('admin_booking_summary', { p_days: pDays }),
          supabase.rpc('admin_booking_daily', { p_days: pDays }),
          supabase.rpc('admin_ops_listing_to_first_app', { p_days: pDays }),
          supabase.rpc('admin_ops_application_response', { p_days: pDays }),
          supabase.rpc('admin_ops_message_response', { p_days: pDays }),
        ])
        if (rReg.error) throw rReg.error
        if (rMsg.error) throw rMsg.error
        if (rBs.error) throw rBs.error
        if (rBd.error) throw rBd.error
        if (rO1.error) throw rO1.error
        if (rO2.error) throw rO2.error
        if (rO3.error) throw rO3.error
        setReg((rReg.data ?? []) as RegRow[])
        setMsgs((rMsg.data ?? []) as MsgRow[])
        setBookingSummary(((rBs.data ?? [])[0] ?? null) as BookingSummary | null)
        setBookingDaily((rBd.data ?? []) as BookingDailyRow[])
        setOpsFirstApp(((rO1.data ?? [])[0] ?? null) as OpsListingFirstApp | null)
        setOpsAppResp(((rO2.data ?? [])[0] ?? null) as OpsAppResponse | null)
        setOpsMsgResp(((rO3.data ?? [])[0] ?? null) as OpsMsgResponse | null)
      } catch (e: any) {
        setError(e?.message ?? 'Akış verileri yüklenirken bir hata oluştu.')
      }
    })()
  }, [pDays])

  // ---- Kayıtları tarihe göre pivotla (rol bazlı stacked area) ----
  const regByDate: Record<string, any> = {}
  for (const row of reg) {
    const d = row.bucket
    if (!regByDate[d]) {
      regByDate[d] = { date: d, client: 0, professional: 0, business: 0, agency: 0 }
    }
    regByDate[d][row.role_key] = num(row.cnt)
  }
  const regData = Object.values(regByDate).sort((a: any, b: any) =>
    a.date < b.date ? -1 : 1
  )

  // ---- Aktif kullanıcı bar verisi ----
  const activeData = active.map((a) => ({
    role: ROLE_LABELS[a.role_key] ?? a.role_key,
    '7 gün': num(a.active_7d),
    '30 gün': num(a.active_30d),
  }))

  // ---- Mesaj verisi ----
  const msgData = msgs.map((m) => ({ date: m.bucket, mesaj: num(m.cnt) }))

  // ---- Teklif verisi ----
  const quoteData = quotes.map((q) => ({
    name: QUOTE_LABELS[q.status_key] ?? q.status_key,
    raw: q.status_key,
    value: num(q.cnt),
  }))

  // ---- Özet metrikler ----
  const totalUsers = active.reduce((s, a) => s + num(a.total), 0)
  const totalActive7d = active.reduce((s, a) => s + num(a.active_7d), 0)
  const totalMessages = msgs.reduce((s, m) => s + num(m.cnt), 0)
  const quoteTotal = quotes.reduce((s, q) => s + num(q.cnt), 0)
  const quoteAccepted = num(quotes.find((q) => q.status_key === 'accepted')?.cnt)
  const conversion = quoteTotal > 0 ? Math.round((quoteAccepted / quoteTotal) * 100) : 0

  // ---- Talep-arz: karşılaştırma grafiği + açık tespiti ----
  const sdChartData = sdCat.map((r) => ({
    label: r.label,
    Arz: num(r.supply),
    Talep: num(r.demand),
  }))

  // Arz açığı: talep > arz (profesyonel çek). Talep açığı: arz > talep (talep yarat).
  const supplyGaps = sdCat
    .filter((r) => num(r.demand) > num(r.supply))
    .map((r) => ({ ...r, gap: num(r.demand) - num(r.supply) }))
    .sort((a, b) => b.gap - a.gap)

  const demandGaps = sdCat
    .filter((r) => num(r.supply) > num(r.demand) && num(r.supply) > 0)
    .map((r) => ({ ...r, gap: num(r.supply) - num(r.demand) }))
    .sort((a, b) => b.gap - a.gap)

  // ---- Büyüme: haftalık karşılaştırma + trend ----
  const METRIC_LABELS: Record<string, string> = {
    kayit: 'Yeni kayıt',
    ilan: 'Yeni ilan',
    basvuru: 'Başvuru',
    rezervasyon: 'Rezervasyon',
    mesaj: 'Mesaj',
    teklif: 'Teklif',
  }
  const compareCards = weeklyCompare.map((r) => {
    const tw = num(r.this_week)
    const lw = num(r.last_week)
    let pct: number | null = null
    if (lw > 0) pct = Math.round(((tw - lw) / lw) * 100)
    else if (tw > 0) pct = 100
    return { metric: r.metric, label: METRIC_LABELS[r.metric] ?? r.metric, tw, lw, pct }
  })
  const trendData = weeklyTrend.map((r) => ({
    hafta: fmtDate(r.week_start),
    Kayıt: num(r.kayit),
    İlan: num(r.ilan),
    Başvuru: num(r.basvuru),
    Rezervasyon: num(r.rezervasyon),
    Mesaj: num(r.mesaj),
    Teklif: num(r.teklif),
  }))

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-ink-50">
        <span style={{ fontFamily: MONO }} className="text-sm uppercase tracking-wider">
          İstatistikler yükleniyor…
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-terracotta/30 bg-terracotta-08 p-6 text-terracotta">
        <strong style={{ fontFamily: SERIF }}>Hata:</strong> {error}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Admin · Panel</Eyebrow>
            <h1
              style={{ fontFamily: SERIF }}
              className="mt-1 text-3xl font-semibold text-ink"
            >
              İstatistikler
            </h1>
            <p className="mt-1 text-sm text-ink-50">
              Akış metrikleri: son {rangeLabel.toLowerCase()} · diğerleri güncel durum
            </p>
          </div>

          {/* Tarih aralığı seçici — sadece akış metriklerini etkiler */}
          <div className="inline-flex rounded-xl border border-line bg-card p-1 shadow-sm">
            {RANGE_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setPDays(o.key)}
                style={{ fontFamily: MONO }}
                className={`px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] rounded-lg transition-colors ${
                  pDays === o.key
                    ? 'bg-gradient-brand text-white'
                    : 'text-ink-50 hover:text-ink'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </header>

        {/* Özet kutucuklar */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Toplam Kullanıcı" value={totalUsers.toLocaleString('tr-TR')} accent={C.terracotta} />
          <StatTile label="Son 7g Aktif" value={totalActive7d.toLocaleString('tr-TR')} accent={C.plum} />
          <StatTile label={`Mesaj (${rangeLabel === 'Tümü' ? 'tüm' : rangeLabel})`} value={totalMessages.toLocaleString('tr-TR')} accent={C.moss} />
          <StatTile label="Teklif Dönüşümü" value={`%${conversion}`} accent={C.ember} />
        </div>

        {/* Sekme çubuğu — alt çizgi tarzı */}
        <div className="mb-6 flex gap-6 border-b border-line">
          {([
            { key: 'genel', label: 'Genel' },
            { key: 'talep-arz', label: 'Talep-Arz' },
            { key: 'icerik', label: 'İçerik' },
            { key: 'buyume', label: 'Büyüme' },
            { key: 'huni', label: 'Hunisi' },
            { key: 'tutundurma', label: 'Tutundurma' },
            { key: 'rezervasyon', label: 'Rezervasyon' },
            { key: 'operasyonel', label: 'Operasyonel' },
            { key: 'yonetim', label: 'Yönetim' },
          ] as { key: TabKey; label: string }[]).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{ fontFamily: MONO }}
              className={`relative px-1 py-3 text-[12px] uppercase tracking-[0.12em] border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? 'border-terracotta text-ink font-semibold'
                  : 'border-transparent text-ink-50 hover:text-ink-72'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* GENEL SEKMESİ */}
        {tab === 'genel' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 1. Yeni kayıt zaman serisi (rol bazlı) */}
          <Card eyebrow="Büyüme" title="Yeni Kayıtlar (rol bazlı)">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={regData}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${C.ink}10`} />
                <XAxis dataKey="date" tickFormatter={fmtDate} fontSize={11} stroke={`${C.ink}80`} />
                <YAxis allowDecimals={false} fontSize={11} stroke={`${C.ink}80`} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtDate} />
                <Legend />
                {ROLE_ORDER.map((role) => (
                  <Area
                    key={role}
                    type="monotone"
                    dataKey={role}
                    name={ROLE_LABELS[role]}
                    stackId="1"
                    stroke={ROLE_COLORS[role]}
                    fill={ROLE_COLORS[role]}
                    fillOpacity={0.35}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* 2. Aktif kullanıcı (7g / 30g) */}
          <Card eyebrow="Etkileşim" title="Aktif Kullanıcılar">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={activeData}>
                <CartesianGrid strokeDasharray="3 3" stroke={`${C.ink}10`} />
                <XAxis dataKey="role" fontSize={11} stroke={`${C.ink}80`} />
                <YAxis allowDecimals={false} fontSize={11} stroke={`${C.ink}80`} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="7 gün" fill={C.terracotta} radius={[4, 4, 0, 0]} />
                <Bar dataKey="30 gün" fill={C.plum} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* 3. Mesajlaşma hacmi */}
          <Card eyebrow="İletişim" title="Mesajlaşma Hacmi">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={msgData}>
                <defs>
                  <linearGradient id="msgGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.moss} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={C.moss} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={`${C.ink}10`} />
                <XAxis dataKey="date" tickFormatter={fmtDate} fontSize={11} stroke={`${C.ink}80`} />
                <YAxis allowDecimals={false} fontSize={11} stroke={`${C.ink}80`} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={fmtDate} />
                <Area
                  type="monotone"
                  dataKey="mesaj"
                  name="Mesaj"
                  stroke={C.moss}
                  fill="url(#msgGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* 4. Teklif dönüşümü */}
          <Card eyebrow="Dönüşüm" title="Teklif Durumu">
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={quoteData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {quoteData.map((d, i) => (
                      <Cell key={i} fill={QUOTE_COLORS[d.raw] ?? PIE_PALETTE[i % PIE_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <p className="mt-2 text-sm text-ink-72">
                Kabul oranı:{' '}
                <strong style={{ fontFamily: SERIF, color: C.moss }}>%{conversion}</strong>
              </p>
            </div>
          </Card>

          {/* 5. Kategori dağılımı */}
          <Card eyebrow="Arz" title="Kategori Dağılımı">
            <ResponsiveContainer width="100%" height={Math.max(280, cats.length * 32)}>
              <BarChart data={cats.map((c) => ({ ...c, cnt: num(c.cnt) }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={`${C.ink}10`} />
                <XAxis type="number" allowDecimals={false} fontSize={11} stroke={`${C.ink}80`} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  fontSize={11}
                  stroke={`${C.ink}80`}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="cnt" name="Adet" fill={C.terracotta} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* 6. Şehir dağılımı */}
          <Card eyebrow="Coğrafya" title="Şehir Dağılımı">
            <ResponsiveContainer width="100%" height={Math.max(280, cities.length * 32)}>
              <BarChart
                data={cities.slice(0, 12).map((c) => ({ ...c, cnt: num(c.cnt) }))}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke={`${C.ink}10`} />
                <XAxis type="number" allowDecimals={false} fontSize={11} stroke={`${C.ink}80`} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={120}
                  fontSize={11}
                  stroke={`${C.ink}80`}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="cnt" name="Adet" fill={C.plum} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
        )}

        {/* TALEP-ARZ SEKMESİ */}
        {tab === 'talep-arz' && (
          <div className="space-y-6">
            {/* Karar kartları: arz açığı + talep açığı */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Arz açığı — profesyonel çek */}
              <div className="rounded-2xl border border-terracotta/25 bg-terracotta-08 p-5">
                <Eyebrow>Arz açığı · Profesyonel çek</Eyebrow>
                <h3 style={{ fontFamily: SERIF }} className="mt-1 mb-1 text-xl font-semibold text-ink">
                  Talebin arzı aştığı kategoriler
                </h3>
                <p className="mb-4 text-sm text-ink-50">
                  Bu kategorilerde müşteri talebi var ama yeterli profesyonel yok.
                  Reklam/içerikle profesyonel çekmek en yüksek getiriyi sağlar.
                </p>
                {supplyGaps.length === 0 ? (
                  <p className="text-sm text-ink-50">Şu an arz açığı yok.</p>
                ) : (
                  <ul className="space-y-2">
                    {supplyGaps.map((r) => (
                      <li
                        key={r.category_id}
                        className="flex items-center justify-between rounded-lg bg-card px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-ink">{r.label}</span>
                        <span className="text-ink-72">
                          {r.demand} talep · {r.supply} arz{' '}
                          <strong className="text-terracotta">(+{r.gap} açık)</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Talep açığı — talep yarat */}
              <div className="rounded-2xl border border-moss/25 bg-moss/5 p-5">
                <Eyebrow>Talep açığı · Talep yarat</Eyebrow>
                <h3 style={{ fontFamily: SERIF }} className="mt-1 mb-1 text-xl font-semibold text-ink">
                  Arzın talebi aştığı kategoriler
                </h3>
                <p className="mb-4 text-sm text-ink-50">
                  Bu kategorilerde çok profesyonel var ama az talep. Sosyal medya
                  içeriği ve kampanyayla müşteri talebi yaratmak gerekir.
                </p>
                {demandGaps.length === 0 ? (
                  <p className="text-sm text-ink-50">Şu an talep açığı yok.</p>
                ) : (
                  <ul className="space-y-2">
                    {demandGaps.map((r) => (
                      <li
                        key={r.category_id}
                        className="flex items-center justify-between rounded-lg bg-card px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-ink">{r.label}</span>
                        <span className="text-ink-72">
                          {r.supply} arz · {r.demand} talep{' '}
                          <strong className="text-moss">(+{r.gap} fazla)</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Kategori bazlı arz vs talep karşılaştırma */}
            <Card eyebrow="Karşılaştırma" title="Kategori bazlı arz vs talep">
              <ResponsiveContainer width="100%" height={Math.max(320, sdChartData.length * 38)}>
                <BarChart data={sdChartData} layout="vertical" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke={`${C.ink}10`} />
                  <XAxis type="number" allowDecimals={false} fontSize={11} stroke={`${C.ink}80`} />
                  <YAxis type="category" dataKey="label" width={130} fontSize={11} stroke={`${C.ink}80`} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="Arz" fill={C.moss} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Talep" fill={C.terracotta} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Şehir bazlı arz vs talep */}
            <Card eyebrow="Coğrafya" title="Şehir bazlı arz vs talep">
              <ResponsiveContainer width="100%" height={Math.max(280, sdCity.length * 38)}>
                <BarChart
                  data={sdCity.map((r) => ({ label: r.label, Arz: num(r.supply), Talep: num(r.demand) }))}
                  layout="vertical"
                  barGap={2}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={`${C.ink}10`} />
                  <XAxis type="number" allowDecimals={false} fontSize={11} stroke={`${C.ink}80`} />
                  <YAxis type="category" dataKey="label" width={100} fontSize={11} stroke={`${C.ink}80`} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="Arz" fill={C.moss} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Talep" fill={C.terracotta} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* İÇERİK SEKMESİ */}
        {tab === 'icerik' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* En çok favorilenen */}
            <Card eyebrow="Sosyal medya · Öne çıkar" title="En çok favorilenen profesyoneller">
              {topFav.length === 0 ? (
                <p className="text-sm text-ink-50">Henüz favori verisi yok.</p>
              ) : (
                <ol className="space-y-2">
                  {topFav.map((r, i) => (
                    <li key={r.profile_id} className="flex items-center justify-between gap-3 rounded-lg bg-paper-2 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span style={{ fontFamily: SERIF }} className="text-terracotta font-semibold w-5 shrink-0">{i + 1}.</span>
                        <span className="font-medium text-ink truncate">{r.name}</span>
                        {r.category && <span className="text-ink-50 text-xs shrink-0">· {r.category}</span>}
                      </span>
                      <span className="text-ink-72 shrink-0">{r.fav_count} ❤</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            {/* En yüksek puanlı */}
            <Card eyebrow="Sosyal medya · Öne çıkar" title="En yüksek puanlı profesyoneller">
              {topRated.length === 0 ? (
                <p className="text-sm text-ink-50">Henüz puan verisi yok.</p>
              ) : (
                <ol className="space-y-2">
                  {topRated.map((r, i) => (
                    <li key={r.professional_id} className="flex items-center justify-between gap-3 rounded-lg bg-paper-2 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span style={{ fontFamily: SERIF }} className="text-terracotta font-semibold w-5 shrink-0">{i + 1}.</span>
                        <span className="font-medium text-ink truncate">{r.name}</span>
                        {r.category && <span className="text-ink-50 text-xs shrink-0">· {r.category}</span>}
                      </span>
                      <span className="text-ink-72 shrink-0">
                        ★ {Number(r.avg_rating).toFixed(1)} ({r.review_count})
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            {/* En çok görüntülenen */}
            <Card eyebrow="Sosyal medya · Öne çıkar" title="En çok görüntülenen profiller">
              {topViewed.length === 0 ? (
                <p className="text-sm text-ink-50">Henüz görüntülenme verisi yok.</p>
              ) : (
                <ol className="space-y-2">
                  {topViewed.map((r, i) => (
                    <li key={r.profile_id} className="flex items-center justify-between gap-3 rounded-lg bg-paper-2 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span style={{ fontFamily: SERIF }} className="text-terracotta font-semibold w-5 shrink-0">{i + 1}.</span>
                        <span className="font-medium text-ink truncate">{r.name}</span>
                        {r.category && <span className="text-ink-50 text-xs shrink-0">· {r.category}</span>}
                      </span>
                      <span className="text-ink-72 shrink-0">{r.views} görüntülenme</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            {/* En aktif kategoriler */}
            <Card eyebrow="Trend · İçerik fikri" title="En aktif kategoriler">
              {activeCats.filter((r) => r.activity > 0).length === 0 ? (
                <p className="text-sm text-ink-50">Henüz aktivite verisi yok.</p>
              ) : (
                <ol className="space-y-2">
                  {activeCats.filter((r) => r.activity > 0).map((r, i) => (
                    <li key={r.category_id} className="flex items-center justify-between gap-3 rounded-lg bg-paper-2 px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span style={{ fontFamily: SERIF }} className="text-terracotta font-semibold w-5 shrink-0">{i + 1}.</span>
                        <span className="font-medium text-ink truncate">{r.label}</span>
                      </span>
                      <span className="text-ink-72 shrink-0 text-xs">
                        {r.listings_count} ilan · {r.applications_count} başvuru
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        )}

        {/* BÜYÜME SEKMESİ */}
        {tab === 'buyume' && (
          <div className="space-y-6">
            {/* Bu hafta vs geçen hafta — karşılaştırma kartları */}
            <div>
              <div className="mb-3">
                <Eyebrow>Bu hafta vs geçen hafta</Eyebrow>
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                {compareCards.map((c) => {
                  const up = c.pct !== null && c.pct > 0
                  const down = c.pct !== null && c.pct < 0
                  const flat = c.pct === null || c.pct === 0
                  return (
                    <div key={c.metric} className="rounded-2xl border border-line bg-card p-5 shadow-sm">
                      <Eyebrow>{c.label}</Eyebrow>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span style={{ fontFamily: SERIF }} className="text-3xl font-semibold text-ink">
                          {c.tw}
                        </span>
                        {c.pct !== null && (
                          <span
                            className="text-sm font-semibold"
                            style={{ color: up ? C.moss : down ? C.ember : '#1A120E80' }}
                          >
                            {up ? '↑' : down ? '↓' : '–'} {Math.abs(c.pct)}%
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-ink-50">
                        Geçen hafta: {c.lw}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Haftalık trend — son 12 hafta */}
            <Card eyebrow="Son 12 hafta" title="Haftalık büyüme trendi">
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="trendKayit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.terracotta} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={C.terracotta} stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={`${C.ink}10`} />
                  <XAxis dataKey="hafta" fontSize={11} stroke={`${C.ink}80`} />
                  <YAxis allowDecimals={false} fontSize={11} stroke={`${C.ink}80`} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Area type="monotone" dataKey="Kayıt" stroke={C.terracotta} fill="url(#trendKayit)" strokeWidth={2} />
                  <Area type="monotone" dataKey="İlan" stroke={C.plum} fill="transparent" strokeWidth={2} />
                  <Area type="monotone" dataKey="Başvuru" stroke={C.moss} fill="transparent" strokeWidth={2} />
                  <Area type="monotone" dataKey="Rezervasyon" stroke={C.ember} fill="transparent" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-ink-50">
                Mesaj ve teklif hacmi ayrı eksende olduğu için grafikte kayıt/ilan/başvuru/rezervasyon
                gösterilir. Tüm metrikler için karşılaştırma kartlarına bakabilirsin.
              </p>
            </Card>
          </div>
        )}

        {/* HUNİ SEKMESİ */}
        {tab === 'huni' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <FunnelCard
              title="Profesyonel yolculuğu"
              eyebrow="Arz tarafı · Kümülatif"
              rows={funnelPro}
              accent={C.plum}
            />
            <FunnelCard
              title="Müşteri yolculuğu"
              eyebrow="Talep tarafı · Kümülatif"
              rows={funnelClient}
              accent={C.terracotta}
            />
          </div>
        )}

        {/* TUTUNDURMA SEKMESİ */}
        {tab === 'tutundurma' && (
          <div className="space-y-6">
            <p className="text-sm text-ink-50">
              Huni&apos;de kaybedilen kullanıcılar — her liste bir aksiyon fırsatı.
              Profile tıklayarak ilgili kullanıcıya ulaşabilirsin.
            </p>

            {/* Profilini tamamlamayan profesyoneller */}
            <Card eyebrow="Aksiyon · Tamamlama hatırlat" title={`Profilini tamamlamayan profesyoneller (${incompletePros.length})`}>
              {incompletePros.length === 0 ? (
                <p className="text-sm text-ink-50">Herkes profilini tamamlamış.</p>
              ) : (
                <ul className="space-y-2">
                  {incompletePros.map((r) => (
                    <li key={r.profile_id} className="flex items-center justify-between gap-3 rounded-lg bg-paper-2 px-3 py-2 text-sm">
                      <a href={`/p/${r.profile_id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-ink hover:text-terracotta truncate">
                        {r.name}
                      </a>
                      <span className="flex items-center gap-2 shrink-0 text-xs">
                        {r.category && <span className="text-ink-50">{r.category}</span>}
                        <span className={`px-2 py-0.5 rounded-full ${
                          r.approval_status === 'rejected'
                            ? 'bg-terracotta-12 text-terracotta'
                            : !r.is_published
                            ? 'bg-[#D98C3F]/15 text-[#8C5A1F]'
                            : 'bg-ink-12 text-ink-72'
                        }`}>
                          {r.approval_status === 'rejected' ? 'Reddedildi' : !r.is_published ? 'Yayında değil' : r.approval_status}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Başvuru almayan ilanlar */}
            <Card eyebrow="Aksiyon · Öne çıkarma öner" title={`Başvuru almayan açık ilanlar (${listingsNoApps.length})`}>
              {listingsNoApps.length === 0 ? (
                <p className="text-sm text-ink-50">Tüm açık ilanlar başvuru almış.</p>
              ) : (
                <ul className="space-y-2">
                  {listingsNoApps.map((r) => (
                    <li key={r.listing_id} className="flex items-center justify-between gap-3 rounded-lg bg-paper-2 px-3 py-2 text-sm">
                      <a href={`/ilanlar/${r.listing_id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-ink hover:text-terracotta truncate">
                        {r.title}
                      </a>
                      <span className="shrink-0 text-xs text-ink-50">{r.creator_name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Yayında ama başvurmayan profesyoneller */}
            <Card eyebrow="Aksiyon · İlan öner" title={`Yayında ama hiç başvurmayan profesyoneller (${prosNoApps.length})`}>
              {prosNoApps.length === 0 ? (
                <p className="text-sm text-ink-50">Tüm yayındaki profesyoneller başvurmuş.</p>
              ) : (
                <ul className="space-y-2">
                  {prosNoApps.map((r) => (
                    <li key={r.profile_id} className="flex items-center justify-between gap-3 rounded-lg bg-paper-2 px-3 py-2 text-sm">
                      <a href={`/p/${r.profile_id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-ink hover:text-terracotta truncate">
                        {r.name}
                      </a>
                      {r.category && <span className="shrink-0 text-xs text-ink-50">{r.category}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}

        {/* REZERVASYON SEKMESİ */}
        {tab === 'rezervasyon' && (
          <div className="space-y-6">
            {/* Özet kartları */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile
                label="Rezervasyon"
                value={num(bookingSummary?.total_count).toLocaleString('tr-TR')}
                accent={C.terracotta}
              />
              <StatTile
                label="GMV (geçerli)"
                value={`${num(bookingSummary?.gmv).toLocaleString('tr-TR')} ₺`}
                accent={C.moss}
              />
              <StatTile
                label="Ort. değer"
                value={`${Math.round(num(bookingSummary?.avg_value)).toLocaleString('tr-TR')} ₺`}
                accent={C.plum}
              />
              <StatTile
                label="İptal oranı"
                value={`%${
                  num(bookingSummary?.total_count) > 0
                    ? Math.round(
                        (num(bookingSummary?.cancelled_count) /
                          num(bookingSummary?.total_count)) *
                          100
                      )
                    : 0
                }`}
                accent={C.ember}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* GMV zaman serisi */}
              <Card eyebrow="Hacim" title="GMV trendi">
                {bookingDaily.length === 0 ? (
                  <p className="text-sm text-ink-50">Bu aralıkta rezervasyon yok.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={bookingDaily.map((r) => ({ date: r.bucket, GMV: num(r.gmv), adet: num(r.cnt) }))}>
                      <defs>
                        <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={C.moss} stopOpacity={0.5} />
                          <stop offset="95%" stopColor={C.moss} stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${C.ink}10`} />
                      <XAxis dataKey="date" tickFormatter={fmtDate} fontSize={11} stroke={`${C.ink}80`} />
                      <YAxis fontSize={11} stroke={`${C.ink}80`} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={fmtDate}
                        formatter={(v: any, name: any) =>
                          name === 'GMV' ? [`${num(v).toLocaleString('tr-TR')} ₺`, 'GMV'] : [v, name]
                        }
                      />
                      <Area type="monotone" dataKey="GMV" stroke={C.moss} fill="url(#gmvGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Card>

              {/* Durum dağılımı */}
              <Card eyebrow="Durum" title="Rezervasyon durumları">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={[
                      { name: 'Onaylı', value: num(bookingSummary?.confirmed_count), fill: C.moss },
                      { name: 'Tamamlandı', value: num(bookingSummary?.completed_count), fill: C.plum },
                      { name: 'İptal', value: num(bookingSummary?.cancelled_count), fill: C.ember },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={`${C.ink}10`} />
                    <XAxis dataKey="name" fontSize={11} stroke={`${C.ink}80`} />
                    <YAxis allowDecimals={false} fontSize={11} stroke={`${C.ink}80`} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" name="Adet" radius={[4, 4, 0, 0]}>
                      {[C.moss, C.plum, C.ember].map((c, i) => (
                        <Cell key={i} fill={c} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-2 text-xs text-ink-50">
                  İptal edilen rezervasyonların toplam değeri:{' '}
                  <strong style={{ color: C.ember }}>
                    {num(bookingSummary?.cancelled_value).toLocaleString('tr-TR')} ₺
                  </strong>
                </p>
              </Card>
            </div>
          </div>
        )}

        {/* OPERASYONEL SEKMESİ */}
        {tab === 'operasyonel' && (
          <div className="space-y-6">
            <p className="text-sm text-ink-50">
              Platformun hızı — düşük süreler sağlıklı bir pazaryerinin işareti.
              Ortalama yanıltabilir, o yüzden medyan da gösteriliyor.
            </p>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* İlan → ilk başvuru */}
              <Card eyebrow="Arz hızı" title="İlan → ilk başvuru">
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-ink-72">Ortalama</span>
                    <span style={{ fontFamily: SERIF, color: C.plum }} className="text-2xl font-semibold">
                      {fmtDuration(num(opsFirstApp?.avg_hours))}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-ink-72">Medyan</span>
                    <span style={{ fontFamily: SERIF }} className="text-xl font-semibold text-ink">
                      {fmtDuration(num(opsFirstApp?.median_hours))}
                    </span>
                  </div>
                  <p className="pt-2 text-xs text-ink-50 border-t border-line">
                    {num(opsFirstApp?.measured_count)} ilan ölçüldü
                  </p>
                </div>
              </Card>

              {/* Başvuru → yanıt */}
              <Card eyebrow="Yanıt hızı" title="Başvuru → yanıt">
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-ink-72">Ortalama</span>
                    <span style={{ fontFamily: SERIF, color: C.terracotta }} className="text-2xl font-semibold">
                      {fmtDuration(num(opsAppResp?.avg_hours))}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-ink-72">Medyan</span>
                    <span style={{ fontFamily: SERIF }} className="text-xl font-semibold text-ink">
                      {fmtDuration(num(opsAppResp?.median_hours))}
                    </span>
                  </div>
                  <p className="pt-2 text-xs text-ink-50 border-t border-line">
                    {num(opsAppResp?.responded_count)} / {num(opsAppResp?.total_count)} yanıtlandı
                    {num(opsAppResp?.pending_count) > 0 && (
                      <span className="text-terracotta">
                        {' '}· {num(opsAppResp?.pending_count)} bekliyor
                      </span>
                    )}
                  </p>
                </div>
              </Card>

              {/* Mesaj → ilk yanıt */}
              <Card eyebrow="İletişim hızı" title="Mesaj → ilk yanıt">
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-ink-72">Ortalama</span>
                    <span style={{ fontFamily: SERIF, color: C.moss }} className="text-2xl font-semibold">
                      {fmtDuration(num(opsMsgResp?.avg_hours))}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-ink-72">Medyan</span>
                    <span style={{ fontFamily: SERIF }} className="text-xl font-semibold text-ink">
                      {fmtDuration(num(opsMsgResp?.median_hours))}
                    </span>
                  </div>
                  <p className="pt-2 text-xs text-ink-50 border-t border-line">
                    {num(opsMsgResp?.measured_count)} konuşma ölçüldü
                  </p>
                </div>
              </Card>
            </div>

            {/* Yanıtsız başvuru uyarısı */}
            {num(opsAppResp?.pending_count) > 0 && (
              <div className="rounded-2xl border border-[#D98C3F]/30 bg-[#D98C3F]/8 p-5">
                <Eyebrow>Dikkat · Yanıtsız başvurular</Eyebrow>
                <p className="mt-2 text-sm text-ink-72">
                  Bu aralıkta{' '}
                  <strong style={{ color: '#8C5A1F' }}>
                    {num(opsAppResp?.pending_count)} başvuru
                  </strong>{' '}
                  hâlâ yanıt bekliyor. İlan sahiplerine hatırlatma, yanıt oranını
                  ve profesyonel memnuniyetini artırır.
                </p>
              </div>
            )}
          </div>
        )}

        {/* YÖNETİM SEKMESİ */}
        {tab === 'yonetim' && (
          <div className="space-y-6">
            {/* Bekleyen kuyruk kartları */}
            <div>
              <div className="mb-3">
                <Eyebrow>Bekleyen kuyruk</Eyebrow>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <QueueCard
                  label="Bekleyen profiller"
                  count={num(queue?.pending_profiles)}
                  href="/admin/profiller"
                  accent={C.plum}
                />
                <QueueCard
                  label="Bekleyen ilanlar"
                  count={num(queue?.pending_listings)}
                  href="/admin/ilanlar"
                  accent={C.terracotta}
                />
                <QueueCard
                  label="Kategori talepleri"
                  count={num(queue?.pending_categories)}
                  href="/admin/kategori-talepleri"
                  accent={C.moss}
                />
              </div>
            </div>

            {/* Son admin işlemleri */}
            <Card eyebrow="Denetim · Son işlemler" title="Son yönetici işlemleri">
              {recentActions.length === 0 ? (
                <p className="text-sm text-ink-50">Henüz işlem kaydı yok.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {recentActions.map((a) => {
                    const meta = actionMeta(a.action)
                    const targetHref = targetLink(a.target_type, a.target_id)
                    return (
                      <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="shrink-0 w-1.5 h-1.5 rounded-full"
                            style={{ background: meta.color }}
                          />
                          <span className="text-ink truncate">
                            <strong className="font-medium">{a.admin_name}</strong>{' '}
                            <span className="text-ink-72">{meta.label}</span>
                            {a.notes && (
                              <span className="text-ink-50 italic"> — {a.notes}</span>
                            )}
                          </span>
                        </span>
                        <span className="flex items-center gap-3 shrink-0">
                          {targetHref && (
                            <a
                              href={targetHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-terracotta hover:underline"
                            >
                              Görüntüle
                            </a>
                          )}
                          <span className="text-[11px] text-ink-50" style={{ fontFamily: MONO }}>
                            {fmtDateTime(a.created_at)}
                          </span>
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

// Bekleyen kuyruk kartı — sayı + ilgili admin sayfasına link
function QueueCard({ label, count, href, accent }: { label: string; count: number; href: string; accent: string }) {
  return (
    <a
      href={href}
      className="block rounded-2xl border border-line bg-card p-5 shadow-sm transition-all hover:border-terracotta hover:-translate-y-0.5"
    >
      <span style={{ fontFamily: MONO, letterSpacing: '0.08em' }} className="text-[11px] uppercase text-terracotta">
        {label}
      </span>
      <div className="mt-1 flex items-baseline justify-between">
        <span style={{ fontFamily: SERIF, color: accent }} className="text-3xl font-semibold">
          {count}
        </span>
        <span className="text-[11px] text-terracotta">Yönet →</span>
      </div>
    </a>
  )
}

// action metnini okunabilir Türkçe etikete + renge çevir
function actionMeta(action: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    approve_listing: { label: 'ilanı onayladı', color: C.moss },
    reject_listing: { label: 'ilanı reddetti', color: C.ember },
    revision_listing: { label: 'ilana revizyon istedi', color: '#D98C3F' },
    cancel_listing: { label: 'ilanı yayından kaldırdı', color: C.ember },
    approve_profile: { label: 'profili onayladı', color: C.moss },
    reject_profile: { label: 'profili reddetti', color: C.ember },
    revision_profile: { label: 'profile revizyon istedi', color: '#D98C3F' },
    ban_user: { label: 'kullanıcıyı askıya aldı', color: C.ember },
    unban_user: { label: 'kullanıcının askısını kaldırdı', color: C.moss },
    approve_category: { label: 'kategori talebini onayladı', color: C.moss },
    decline_category: { label: 'kategori talebini reddetti', color: C.ember },
    add_category: { label: 'kategori ekledi', color: C.plum },
  }
  return map[action] ?? { label: action.replace(/_/g, ' '), color: C.plum }
}

// hedef tipine göre link üret (varsa)
function targetLink(targetType: string, targetId: string | null): string | null {
  if (!targetId) return null
  switch (targetType) {
    case 'listing':
      return `/ilanlar/${targetId}`
    case 'user':
    case 'profile':
      return `/p/${targetId}`
    default:
      return null
  }
}

// saat sayısını okunabilir süreye çevir (1.5 → "1.5 sa", 30 → "1.2 gün", 0.5 → "30 dk")
function fmtDuration(hours: number): string {
  if (!hours || hours <= 0) return '—'
  if (hours < 1) return `${Math.round(hours * 60)} dk`
  if (hours < 48) return `${hours.toFixed(1)} sa`
  return `${(hours / 24).toFixed(1)} gün`
}

// tarih + saat formatı (DD.MM HH:mm)
function fmtDateTime(s: string): string {
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Huni kartı — her adım kayıt tabanına göre yüzde, azalan bar
function FunnelCard({
  title,
  eyebrow,
  rows,
  accent,
}: {
  title: string
  eyebrow: string
  rows: FunnelRow[]
  accent: string
}) {
  const base = rows.length > 0 ? Number(rows[0].cnt) : 0
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <span style={{ fontFamily: MONO, letterSpacing: '0.08em' }} className="text-[11px] uppercase text-terracotta">
        {eyebrow}
      </span>
      <h3 style={{ fontFamily: SERIF }} className="mt-1 mb-4 text-xl font-semibold text-ink">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-50">Henüz veri yok.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const cnt = Number(r.cnt)
            const pct = base > 0 ? Math.round((cnt / base) * 100) : 0
            return (
              <div key={r.step}>
                <div className="flex items-center justify-between mb-1 text-sm">
                  <span className="text-ink font-medium">{r.label}</span>
                  <span className="text-ink-72">
                    {cnt} <span className="text-ink-50">· %{pct}</span>
                  </span>
                </div>
                <div className="h-7 w-full rounded-lg bg-paper-2 overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-all flex items-center"
                    style={{ width: `${Math.max(pct, 2)}%`, background: accent }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}