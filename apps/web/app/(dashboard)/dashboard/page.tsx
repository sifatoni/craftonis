'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { api } from '@/lib/axios'
import {
  Calendar, FileSearch, TrendingUp, Briefcase,
  Users, Radar, ArrowUp, ArrowDown,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// ── KPI Card ────────────────────────────────────────────────
function KpiCard({
  label, value, icon: Icon, color, index,
}: {
  label: string
  value: string | number
  icon: any
  color: string
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className="rounded-xl p-5 border"
      style={{
        background: '#111111',
        borderColor: '#1A1A1A',
        borderTop: `3px solid ${color}`,
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm" style={{ color: '#606060' }}>{label}</span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}15` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <div
        className="text-3xl font-bold"
        style={{ fontFamily: 'var(--font-syne)', color: color }}
      >
        {value}
      </div>
    </motion.div>
  )
}

// ── Activity Item ─────────────────────────────────────────
function ActivityItem({ activity, index }: { activity: any; index: number }) {
  const colorMap: Record<string, string> = {
    CANDIDATE: '#0284C7',
    JOB: '#16A34A',
    INTERVIEW: '#5521B5',
    MEETING: '#BF125D',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className="flex items-start gap-3 py-3 border-b last:border-0"
      style={{ borderColor: '#1A1A1A' }}
    >
      <div
        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
        style={{ background: colorMap[activity.type] || '#606060' }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm" style={{ color: '#FFFFFF' }}>
          {activity.message}
        </p>
        <p className="text-xs mt-0.5" style={{ color: '#606060' }}>
          {new Date(activity.timestamp).toLocaleString()}
        </p>
      </div>
    </motion.div>
  )
}

// ── Main Dashboard ────────────────────────────────────────
export default function DashboardPage() {
  const { data: kpis } = useQuery({
    queryKey: ['analytics', 'kpis'],
    queryFn: () => api.get('/analytics/kpis').then((r) => r.data),
    refetchInterval: 30000,
  })

  const { data: funnel } = useQuery({
    queryKey: ['analytics', 'funnel'],
    queryFn: () => api.get('/analytics/funnel').then((r) => r.data),
  })

  const { data: sources } = useQuery({
    queryKey: ['analytics', 'sources'],
    queryFn: () => api.get('/analytics/source-attribution').then((r) => r.data),
  })

  const { data: heatmap } = useQuery({
    queryKey: ['analytics', 'heatmap'],
    queryFn: () => api.get('/analytics/department-heatmap').then((r) => r.data),
  })

  const { data: activity } = useQuery({
    queryKey: ['analytics', 'activity'],
    queryFn: () => api.get('/analytics/activity-feed').then((r) => r.data),
    refetchInterval: 15000,
  })

  const kpiCards = [
    {
      label: 'Interviews Today',
      value: kpis?.interviewsToday ?? '—',
      icon: Calendar,
      color: '#A50000',
    },
    {
      label: 'Pending CVs',
      value: kpis?.pendingCvs ?? '—',
      icon: FileSearch,
      color: '#D97706',
    },
    {
      label: 'Conversion Rate',
      value: kpis ? `${kpis.conversionRate}%` : '—',
      icon: TrendingUp,
      color: '#16A34A',
    },
    {
      label: 'Open Positions',
      value: kpis?.openJobs ?? '—',
      icon: Briefcase,
      color: '#0284C7',
    },
    {
      label: 'Total Candidates',
      value: kpis?.totalCandidates ?? '—',
      icon: Users,
      color: '#5521B5',
    },
    {
      label: 'Total Leads',
      value: kpis?.totalLeads ?? '—',
      icon: Radar,
      color: '#BF125D',
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}
        >
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: '#606060' }}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric',
            month: 'long', day: 'numeric',
          })}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((card, i) => (
          <KpiCard key={card.label} {...card} index={i} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recruitment Funnel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="rounded-xl p-5 border"
          style={{ background: '#111111', borderColor: '#1A1A1A' }}
        >
          <h3
            className="text-base font-semibold mb-4"
            style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}
          >
            Recruitment Funnel
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={funnel || []} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" tick={{ fill: '#606060', fontSize: 12 }} />
              <YAxis
                dataKey="label"
                type="category"
                tick={{ fill: '#A0A0A0', fontSize: 11 }}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  background: '#1A1A1A',
                  border: '1px solid #2E2E2E',
                  borderRadius: 8,
                  color: '#FFFFFF',
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {(funnel || []).map((_: any, index: number) => (
                  <Cell
                    key={index}
                    fill={index === 0 ? '#A50000' : `rgba(165,0,0,${0.8 - index * 0.1})`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Source Attribution */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="rounded-xl p-5 border"
          style={{ background: '#111111', borderColor: '#1A1A1A' }}
        >
          <h3
            className="text-base font-semibold mb-4"
            style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}
          >
            Source Attribution
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sources || []} margin={{ left: 0 }}>
              <XAxis dataKey="source" tick={{ fill: '#606060', fontSize: 11 }} />
              <YAxis tick={{ fill: '#606060', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: '#1A1A1A',
                  border: '1px solid #2E2E2E',
                  borderRadius: 8,
                  color: '#FFFFFF',
                }}
              />
              <Bar dataKey="count" fill="#A50000" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Department Heat Map */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="rounded-xl p-5 border"
          style={{ background: '#111111', borderColor: '#1A1A1A' }}
        >
          <h3
            className="text-base font-semibold mb-4"
            style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}
          >
            Department Hiring Heat Map
          </h3>
          {!heatmap || heatmap.length === 0 ? (
            <div
              className="flex items-center justify-center h-32 rounded-lg"
              style={{ background: '#1A1A1A' }}
            >
              <p className="text-sm" style={{ color: '#606060' }}>
                No departments yet. Create departments in Settings.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {heatmap.map((dept: any) => (
                <div key={dept.departmentId}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm" style={{ color: '#A0A0A0' }}>
                      {dept.departmentName}
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{
                        color: dept.status === 'HIGH' ? '#16A34A'
                          : dept.status === 'MEDIUM' ? '#D97706' : '#A50000',
                      }}
                    >
                      {dept.hiringVelocity}%
                    </span>
                  </div>
                  <div
                    className="w-full h-2 rounded-full overflow-hidden"
                    style={{ background: '#1A1A1A' }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${dept.hiringVelocity}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className="h-full rounded-full"
                      style={{
                        background: dept.status === 'HIGH' ? '#16A34A'
                          : dept.status === 'MEDIUM' ? '#D97706' : '#A50000',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="rounded-xl p-5 border"
          style={{ background: '#111111', borderColor: '#1A1A1A' }}
        >
          <h3
            className="text-base font-semibold mb-4"
            style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}
          >
            Activity Feed
          </h3>
          <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
            {!activity || activity.length === 0 ? (
              <div
                className="flex items-center justify-center h-32 rounded-lg"
                style={{ background: '#1A1A1A' }}
              >
                <p className="text-sm" style={{ color: '#606060' }}>
                  No activity yet.
                </p>
              </div>
            ) : (
              activity.map((item: any, i: number) => (
                <ActivityItem key={i} activity={item} index={i} />
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
