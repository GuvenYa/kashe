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

// ---- Kashe tema (Theme 2) ----
const C = {
  paper: '#FAF7F0',
  terracotta: '#C8442A',
  ink: '#1A120E',
  plum: '#6B2E5C',
  moss: '#3F6B47',
  ember: '#A8341E',
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

const SERIF = 'Fraunces, serif'
const MONO = 'DM Mono, monospace'

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
type TabKey = 'genel' | 'talep-arz' | 'icerik' | 'buyume' | 'huni' | 'tutundurma'
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
      className="text-[11px] uppercase text-[#A8341E]"
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
    <div className="rounded-2xl border border-[#1A120E]/10 bg-white p-5 shadow-sm">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h3
        style={{ fontFamily: SERIF }}
        className="mt-1 mb-4 text-xl font-semibold text-[#1A120E]"
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

function StatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-[#1A120E]/10 bg-white p-5 shadow-sm">
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
  fontFamily: 'Geist, sans-serif',
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
  const [tab, setTab] = useState<TabKey>('genel')

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      try {
        const [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16, r17, r18, r19] = await Promise.all([
          supabase.rpc('admin_stats_registrations', { p_days: 30 }),
          supabase.rpc('admin_stats_active_users'),
          supabase.rpc('admin_stats_messages', { p_days: 30 }),
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
        ])

        const firstErr = [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16, r17, r18, r19].find((r) => r.error)?.error
        if (firstErr) throw firstErr

        setReg((r1.data ?? []) as RegRow[])
        setActive((r2.data ?? []) as ActiveRow[])
        setMsgs((r3.data ?? []) as MsgRow[])
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
      } catch (e: any) {
        setError(e?.message ?? 'İstatistikler yüklenirken bir hata oluştu.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

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
      <div className="flex min-h-[60vh] items-center justify-center text-[#1A120E]/60">
        <span style={{ fontFamily: MONO }} className="text-sm uppercase tracking-wider">
          İstatistikler yükleniyor…
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#A8341E]/30 bg-[#A8341E]/5 p-6 text-[#A8341E]">
        <strong style={{ fontFamily: SERIF }}>Hata:</strong> {error}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0] p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <Eyebrow>Admin · Panel</Eyebrow>
          <h1
            style={{ fontFamily: SERIF }}
            className="mt-1 text-3xl font-semibold text-[#1A120E]"
          >
            İstatistikler
          </h1>
          <p className="mt-1 text-sm text-[#1A120E]/60">Son 30 günün özeti</p>
        </header>

        {/* Özet kutucuklar */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Toplam Kullanıcı" value={totalUsers.toLocaleString('tr-TR')} accent={C.terracotta} />
          <StatTile label="Son 7g Aktif" value={totalActive7d.toLocaleString('tr-TR')} accent={C.plum} />
          <StatTile label="Mesaj (30g)" value={totalMessages.toLocaleString('tr-TR')} accent={C.moss} />
          <StatTile label="Teklif Dönüşümü" value={`%${conversion}`} accent={C.ember} />
        </div>

        {/* Sekme çubuğu — alt çizgi tarzı */}
        <div className="mb-6 flex gap-6 border-b border-[#1A120E]/12">
          {([
            { key: 'genel', label: 'Genel' },
            { key: 'talep-arz', label: 'Talep-Arz' },
            { key: 'icerik', label: 'İçerik' },
            { key: 'buyume', label: 'Büyüme' },
            { key: 'huni', label: 'Hunisi' },
            { key: 'tutundurma', label: 'Tutundurma' },
          ] as { key: TabKey; label: string }[]).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{ fontFamily: MONO }}
              className={`relative px-1 py-3 text-[12px] uppercase tracking-[0.12em] border-b-2 -mb-px transition-colors ${
                tab === t.key
                  ? 'border-[#C8442A] text-[#1A120E] font-semibold'
                  : 'border-transparent text-[#1A120E]/45 hover:text-[#1A120E]/80'
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
              <p className="mt-2 text-sm text-[#1A120E]/70">
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
              <div className="rounded-2xl border border-[#A8341E]/25 bg-[#A8341E]/5 p-5">
                <Eyebrow>Arz açığı · Profesyonel çek</Eyebrow>
                <h3 style={{ fontFamily: SERIF }} className="mt-1 mb-1 text-xl font-semibold text-[#1A120E]">
                  Talebin arzı aştığı kategoriler
                </h3>
                <p className="mb-4 text-sm text-[#1A120E]/60">
                  Bu kategorilerde müşteri talebi var ama yeterli profesyonel yok.
                  Reklam/içerikle profesyonel çekmek en yüksek getiriyi sağlar.
                </p>
                {supplyGaps.length === 0 ? (
                  <p className="text-sm text-[#1A120E]/50">Şu an arz açığı yok.</p>
                ) : (
                  <ul className="space-y-2">
                    {supplyGaps.map((r) => (
                      <li
                        key={r.category_id}
                        className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-[#1A120E]">{r.label}</span>
                        <span className="text-[#1A120E]/60">
                          {r.demand} talep · {r.supply} arz{' '}
                          <strong className="text-[#A8341E]">(+{r.gap} açık)</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Talep açığı — talep yarat */}
              <div className="rounded-2xl border border-[#3F6B47]/25 bg-[#3F6B47]/5 p-5">
                <Eyebrow>Talep açığı · Talep yarat</Eyebrow>
                <h3 style={{ fontFamily: SERIF }} className="mt-1 mb-1 text-xl font-semibold text-[#1A120E]">
                  Arzın talebi aştığı kategoriler
                </h3>
                <p className="mb-4 text-sm text-[#1A120E]/60">
                  Bu kategorilerde çok profesyonel var ama az talep. Sosyal medya
                  içeriği ve kampanyayla müşteri talebi yaratmak gerekir.
                </p>
                {demandGaps.length === 0 ? (
                  <p className="text-sm text-[#1A120E]/50">Şu an talep açığı yok.</p>
                ) : (
                  <ul className="space-y-2">
                    {demandGaps.map((r) => (
                      <li
                        key={r.category_id}
                        className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-[#1A120E]">{r.label}</span>
                        <span className="text-[#1A120E]/60">
                          {r.supply} arz · {r.demand} talep{' '}
                          <strong className="text-[#3F6B47]">(+{r.gap} fazla)</strong>
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
                <p className="text-sm text-[#1A120E]/50">Henüz favori verisi yok.</p>
              ) : (
                <ol className="space-y-2">
                  {topFav.map((r, i) => (
                    <li key={r.profile_id} className="flex items-center justify-between gap-3 rounded-lg bg-[#FAF7F0] px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span style={{ fontFamily: SERIF }} className="text-[#C8442A] font-semibold w-5 shrink-0">{i + 1}.</span>
                        <span className="font-medium text-[#1A120E] truncate">{r.name}</span>
                        {r.category && <span className="text-[#1A120E]/50 text-xs shrink-0">· {r.category}</span>}
                      </span>
                      <span className="text-[#1A120E]/70 shrink-0">{r.fav_count} ❤</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            {/* En yüksek puanlı */}
            <Card eyebrow="Sosyal medya · Öne çıkar" title="En yüksek puanlı profesyoneller">
              {topRated.length === 0 ? (
                <p className="text-sm text-[#1A120E]/50">Henüz puan verisi yok.</p>
              ) : (
                <ol className="space-y-2">
                  {topRated.map((r, i) => (
                    <li key={r.professional_id} className="flex items-center justify-between gap-3 rounded-lg bg-[#FAF7F0] px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span style={{ fontFamily: SERIF }} className="text-[#C8442A] font-semibold w-5 shrink-0">{i + 1}.</span>
                        <span className="font-medium text-[#1A120E] truncate">{r.name}</span>
                        {r.category && <span className="text-[#1A120E]/50 text-xs shrink-0">· {r.category}</span>}
                      </span>
                      <span className="text-[#1A120E]/70 shrink-0">
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
                <p className="text-sm text-[#1A120E]/50">Henüz görüntülenme verisi yok.</p>
              ) : (
                <ol className="space-y-2">
                  {topViewed.map((r, i) => (
                    <li key={r.profile_id} className="flex items-center justify-between gap-3 rounded-lg bg-[#FAF7F0] px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span style={{ fontFamily: SERIF }} className="text-[#C8442A] font-semibold w-5 shrink-0">{i + 1}.</span>
                        <span className="font-medium text-[#1A120E] truncate">{r.name}</span>
                        {r.category && <span className="text-[#1A120E]/50 text-xs shrink-0">· {r.category}</span>}
                      </span>
                      <span className="text-[#1A120E]/70 shrink-0">{r.views} görüntülenme</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            {/* En aktif kategoriler */}
            <Card eyebrow="Trend · İçerik fikri" title="En aktif kategoriler">
              {activeCats.filter((r) => r.activity > 0).length === 0 ? (
                <p className="text-sm text-[#1A120E]/50">Henüz aktivite verisi yok.</p>
              ) : (
                <ol className="space-y-2">
                  {activeCats.filter((r) => r.activity > 0).map((r, i) => (
                    <li key={r.category_id} className="flex items-center justify-between gap-3 rounded-lg bg-[#FAF7F0] px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span style={{ fontFamily: SERIF }} className="text-[#C8442A] font-semibold w-5 shrink-0">{i + 1}.</span>
                        <span className="font-medium text-[#1A120E] truncate">{r.label}</span>
                      </span>
                      <span className="text-[#1A120E]/70 shrink-0 text-xs">
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
                    <div key={c.metric} className="rounded-2xl border border-[#1A120E]/10 bg-white p-5 shadow-sm">
                      <Eyebrow>{c.label}</Eyebrow>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span style={{ fontFamily: SERIF }} className="text-3xl font-semibold text-[#1A120E]">
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
                      <p className="mt-1 text-xs text-[#1A120E]/50">
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
              <p className="mt-2 text-xs text-[#1A120E]/50">
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
            <p className="text-sm text-[#1A120E]/60">
              Huni&apos;de kaybedilen kullanıcılar — her liste bir aksiyon fırsatı.
              Profile tıklayarak ilgili kullanıcıya ulaşabilirsin.
            </p>

            {/* Profilini tamamlamayan profesyoneller */}
            <Card eyebrow="Aksiyon · Tamamlama hatırlat" title={`Profilini tamamlamayan profesyoneller (${incompletePros.length})`}>
              {incompletePros.length === 0 ? (
                <p className="text-sm text-[#1A120E]/50">Herkes profilini tamamlamış.</p>
              ) : (
                <ul className="space-y-2">
                  {incompletePros.map((r) => (
                    <li key={r.profile_id} className="flex items-center justify-between gap-3 rounded-lg bg-[#FAF7F0] px-3 py-2 text-sm">
                      <a href={`/p/${r.profile_id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-[#1A120E] hover:text-[#C8442A] truncate">
                        {r.name}
                      </a>
                      <span className="flex items-center gap-2 shrink-0 text-xs">
                        {r.category && <span className="text-[#1A120E]/50">{r.category}</span>}
                        <span className={`px-2 py-0.5 rounded-full ${
                          r.approval_status === 'rejected'
                            ? 'bg-[#A8341E]/10 text-[#A8341E]'
                            : !r.is_published
                            ? 'bg-[#D98C3F]/15 text-[#8C5A1F]'
                            : 'bg-[#1A120E]/8 text-[#1A120E]/60'
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
                <p className="text-sm text-[#1A120E]/50">Tüm açık ilanlar başvuru almış.</p>
              ) : (
                <ul className="space-y-2">
                  {listingsNoApps.map((r) => (
                    <li key={r.listing_id} className="flex items-center justify-between gap-3 rounded-lg bg-[#FAF7F0] px-3 py-2 text-sm">
                      <a href={`/ilanlar/${r.listing_id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-[#1A120E] hover:text-[#C8442A] truncate">
                        {r.title}
                      </a>
                      <span className="shrink-0 text-xs text-[#1A120E]/50">{r.creator_name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Yayında ama başvurmayan profesyoneller */}
            <Card eyebrow="Aksiyon · İlan öner" title={`Yayında ama hiç başvurmayan profesyoneller (${prosNoApps.length})`}>
              {prosNoApps.length === 0 ? (
                <p className="text-sm text-[#1A120E]/50">Tüm yayındaki profesyoneller başvurmuş.</p>
              ) : (
                <ul className="space-y-2">
                  {prosNoApps.map((r) => (
                    <li key={r.profile_id} className="flex items-center justify-between gap-3 rounded-lg bg-[#FAF7F0] px-3 py-2 text-sm">
                      <a href={`/p/${r.profile_id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-[#1A120E] hover:text-[#C8442A] truncate">
                        {r.name}
                      </a>
                      {r.category && <span className="shrink-0 text-xs text-[#1A120E]/50">{r.category}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  )
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
    <div className="rounded-2xl border border-[#1A120E]/10 bg-white p-5 shadow-sm">
      <span style={{ fontFamily: MONO, letterSpacing: '0.08em' }} className="text-[11px] uppercase text-[#A8341E]">
        {eyebrow}
      </span>
      <h3 style={{ fontFamily: SERIF }} className="mt-1 mb-4 text-xl font-semibold text-[#1A120E]">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-[#1A120E]/50">Henüz veri yok.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const cnt = Number(r.cnt)
            const pct = base > 0 ? Math.round((cnt / base) * 100) : 0
            return (
              <div key={r.step}>
                <div className="flex items-center justify-between mb-1 text-sm">
                  <span className="text-[#1A120E] font-medium">{r.label}</span>
                  <span className="text-[#1A120E]/60">
                    {cnt} <span className="text-[#1A120E]/40">· %{pct}</span>
                  </span>
                </div>
                <div className="h-7 w-full rounded-lg bg-[#FAF7F0] overflow-hidden">
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