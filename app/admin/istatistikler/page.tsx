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

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      try {
        const [r1, r2, r3, r4, r5, r6] = await Promise.all([
          supabase.rpc('admin_stats_registrations', { p_days: 30 }),
          supabase.rpc('admin_stats_active_users'),
          supabase.rpc('admin_stats_messages', { p_days: 30 }),
          supabase.rpc('admin_stats_quotes'),
          supabase.rpc('admin_stats_categories'),
          supabase.rpc('admin_stats_cities'),
        ])

        const firstErr = [r1, r2, r3, r4, r5, r6].find((r) => r.error)?.error
        if (firstErr) throw firstErr

        setReg((r1.data ?? []) as RegRow[])
        setActive((r2.data ?? []) as ActiveRow[])
        setMsgs((r3.data ?? []) as MsgRow[])
        setQuotes((r4.data ?? []) as QuoteRow[])
        setCats((r5.data ?? []) as LabelRow[])
        setCities((r6.data ?? []) as LabelRow[])
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

        {/* Grafikler */}
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
      </div>
    </div>
  )
}