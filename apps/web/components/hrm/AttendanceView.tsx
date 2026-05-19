'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Clock, Loader2, LogIn, LogOut, CheckCircle2, X, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { HolidayManager } from './HolidayManager'

interface AttendanceLog {
  id: string
  date: string
  checkinTime: string | null
  checkoutTime: string | null
  hoursWorked: number | null
  status: string
  notes: string | null
  locationName: string | null
  lat: number | null
  lon: number | null
}

interface AttendanceSummary {
  PRESENT: number
  LATE: number
  ABSENT: number
  LEAVE: number
}

interface Employee {
  id: string
  firstName: string
  lastName: string
}

interface Holiday {
  id: string
  name: string
  date: string
  type: 'PUBLIC' | 'COMPANY'
}

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  PRESENT:  { color: '#16A34A', label: 'Present' },
  LATE:     { color: '#D97706', label: 'Late' },
  ABSENT:   { color: '#DC2626', label: 'Absent' },
  HALF_DAY: { color: '#0284C7', label: 'Half Day' },
  LEAVE:    { color: '#0284C7', label: 'Leave' },
  ON_LEAVE: { color: '#0284C7', label: 'On Leave' },
  HOLIDAY:  { color: '#A50000', label: 'Holiday' },
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

function buildCalendar(year: number, month: number): Array<number | null> {
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startDow = (firstDay.getDay() + 6) % 7

  const cells: Array<number | null> = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function countWeekdaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}

async function getGeoLocation(): Promise<{ lat: number; lon: number; locationName: string } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
            { headers: { 'User-Agent': 'Craftonis/1.0' } },
          )
          const data = await res.json()
          const addr = data.address || {}
          const locationName =
            [addr.suburb || addr.neighbourhood, addr.city || addr.town || addr.village, addr.country]
              .filter(Boolean)
              .join(', ') || data.display_name || 'Unknown location'
          resolve({ lat, lon, locationName })
        } catch {
          resolve({ lat, lon, locationName: `${lat.toFixed(4)}, ${lon.toFixed(4)}` })
        }
      },
      () => resolve(null),
      { timeout: 8000 },
    )
  })
}

export function AttendanceView() {
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [selectedDay, setSelectedDay] = useState<{ day: number; log: AttendanceLog | null; holiday?: Holiday } | null>(null)
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [geoStatus, setGeoStatus] = useState<'idle' | 'fetching'>('idle')

  const { data: todayLog, refetch: refetchToday } = useQuery<AttendanceLog | null>({
    queryKey: ['hrm-attendance-today'],
    queryFn: () => api.get('/hrm/attendance/today').then((r) => r.data ?? null),
    retry: false,
  })

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['hrm-employees'],
    queryFn: () => api.get('/hrm/employees').then((r) => r.data),
  })

  const { data: holidays = [] } = useQuery<Holiday[]>({
    queryKey: ['hrm-holidays', calYear],
    queryFn: () => api.get('/hrm/holidays', { params: { year: calYear } }).then((r) => r.data),
  })

  const activeEmployeeId = selectedEmployeeId || employees[0]?.id || ''

  const { data: logs = [] } = useQuery<AttendanceLog[]>({
    queryKey: ['hrm-attendance-logs', activeEmployeeId, calMonth, calYear],
    queryFn: () =>
      api
        .get(`/hrm/attendance/${activeEmployeeId}`, {
          params: { month: calMonth, year: calYear },
        })
        .then((r) => r.data),
    enabled: !!activeEmployeeId,
  })

  const { data: summary } = useQuery<AttendanceSummary>({
    queryKey: ['hrm-attendance-summary', activeEmployeeId, calMonth, calYear],
    queryFn: () =>
      api
        .get(`/hrm/attendance/${activeEmployeeId}/summary`, {
          params: { month: calMonth, year: calYear },
        })
        .then((r) => r.data),
    enabled: !!activeEmployeeId,
  })

  // Build sets for O(1) lookup
  const logByDay: Record<number, AttendanceLog> = {}
  logs.forEach((log) => {
    const d = new Date(log.date).getUTCDate()
    logByDay[d] = log
  })

  const holidayByDay: Record<number, Holiday> = {}
  holidays.forEach((h) => {
    const hDate = new Date(h.date)
    if (
      hDate.getUTCFullYear() === calYear &&
      hDate.getUTCMonth() + 1 === calMonth
    ) {
      holidayByDay[hDate.getUTCDate()] = h
    }
  })

  // Working days = weekdays in month − holidays falling on weekdays
  const totalWeekdays = countWeekdaysInMonth(calYear, calMonth)
  const holidaysOnWeekdays = holidays.filter((h) => {
    const d = new Date(h.date)
    if (d.getUTCFullYear() !== calYear || d.getUTCMonth() + 1 !== calMonth) return false
    const dow = d.getUTCDay()
    return dow !== 0 && dow !== 6
  }).length
  const workingDays = totalWeekdays - holidaysOnWeekdays
  const workedDays = (summary?.PRESENT ?? 0) + (summary?.LATE ?? 0)

  const handleCheckin = async () => {
    setGeoStatus('fetching')
    setCheckingIn(true)
    try {
      const geo = await getGeoLocation()
      setGeoStatus('idle')

      const payload: Record<string, unknown> = {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }
      if (geo) {
        payload.lat = geo.lat
        payload.lon = geo.lon
        payload.locationName = geo.locationName
      }

      await api.post('/hrm/attendance/checkin', payload)
      toast.success('Checked in successfully' + (geo ? ` · 📍 ${geo.locationName}` : ''))
      refetchToday()
    } catch (err: any) {
      setGeoStatus('idle')
      toast.error(err.response?.data?.message || 'Failed to check in')
    } finally {
      setCheckingIn(false)
    }
  }

  const handleCheckout = async () => {
    setCheckingOut(true)
    try {
      await api.post('/hrm/attendance/checkout', {})
      toast.success('Checked out successfully')
      refetchToday()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to check out')
    } finally {
      setCheckingOut(false)
    }
  }

  const prevMonth = () => {
    if (calMonth === 1) { setCalMonth(12); setCalYear((y) => y - 1) }
    else setCalMonth((m) => m - 1)
  }

  const nextMonth = () => {
    if (calMonth === 12) { setCalMonth(1); setCalYear((y) => y + 1) }
    else setCalMonth((m) => m + 1)
  }

  const checkedIn = !!todayLog?.checkinTime
  const checkedOut = !!todayLog?.checkoutTime
  const completed = checkedIn && checkedOut

  const todayDayName = now.toLocaleDateString('en-US', { weekday: 'long' })
  const todayDateStr = now.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  const calCells = buildCalendar(calYear, calMonth)

  const summaryChips = [
    { key: 'WORKING', label: 'Working Days', color: '#FFFFFF', bg: '#1A1A1A', value: workingDays },
    { key: 'WORKED',  label: 'Worked Days',  color: '#16A34A', bg: '#052E16', value: workedDays },
    { key: 'PRESENT', label: 'Present',       color: '#16A34A', bg: '#052E16', value: summary?.PRESENT ?? 0 },
    { key: 'LATE',    label: 'Late',           color: '#D97706', bg: '#1C1007', value: summary?.LATE ?? 0 },
    { key: 'ABSENT',  label: 'Absent',         color: '#DC2626', bg: '#1A0000', value: summary?.ABSENT ?? 0 },
    { key: 'LEAVE',   label: 'Leave',           color: '#0284C7', bg: '#0C1A2E', value: summary?.LEAVE ?? 0 },
  ]

  return (
    <div className="space-y-6">
      {/* ── Check-in / Check-out Card ── */}
      <div
        className="max-w-sm mx-auto rounded-xl p-6 text-center"
        style={{ background: '#111111', border: '1px solid #2E2E2E' }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-1"
          style={{ color: '#A0A0A0' }}
        >
          {todayDayName}
        </p>
        <p
          className="text-base font-medium mb-5"
          style={{ color: '#FFFFFF', fontFamily: 'var(--font-syne)' }}
        >
          {todayDateStr}
        </p>

        {completed ? (
          <button
            disabled
            className="w-full h-14 rounded-xl text-sm font-bold flex items-center justify-center gap-2 cursor-not-allowed"
            style={{ background: '#052E16', color: '#16A34A', border: '1px solid #16A34A40' }}
          >
            <CheckCircle2 size={18} />
            Completed
          </button>
        ) : checkedIn ? (
          <button
            onClick={handleCheckout}
            disabled={checkingOut}
            className="w-full h-14 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
            style={{ background: '#1C1007', color: '#D97706', border: '1px solid #D97706' }}
          >
            {checkingOut
              ? <Loader2 size={18} className="animate-spin" />
              : <LogOut size={18} />}
            Check Out
          </button>
        ) : (
          <button
            onClick={handleCheckin}
            disabled={checkingIn}
            className="w-full h-14 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
            style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
          >
            {checkingIn ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {geoStatus === 'fetching' ? 'Getting location...' : 'Checking in...'}
              </>
            ) : (
              <>
                <LogIn size={18} />
                Check In
              </>
            )}
          </button>
        )}

        {/* Time display */}
        <div className="grid grid-cols-2 gap-4 mt-5">
          <div>
            <p className="text-xs" style={{ color: '#606060' }}>Check In</p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: '#FFFFFF' }}>
              {fmtTime(todayLog?.checkinTime)}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: '#606060' }}>Check Out</p>
            <p className="text-sm font-semibold mt-0.5" style={{ color: '#FFFFFF' }}>
              {fmtTime(todayLog?.checkoutTime)}
            </p>
          </div>
        </div>

        {todayLog?.hoursWorked != null && (
          <div
            className="mt-4 rounded-lg px-3 py-2 flex items-center justify-center gap-2"
            style={{ background: '#0A0A0A' }}
          >
            <Clock size={14} style={{ color: '#A50000' }} />
            <span className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>
              {todayLog.hoursWorked.toFixed(1)} hours worked
            </span>
          </div>
        )}

        {/* Location display */}
        {todayLog?.locationName && (
          <div className="mt-2 flex items-center justify-center gap-1">
            <MapPin size={12} style={{ color: '#606060' }} />
            <span className="text-xs" style={{ color: '#606060' }}>
              {todayLog.locationName}
            </span>
          </div>
        )}
      </div>

      {/* ── Calendar Section ── */}
      <div
        className="rounded-xl p-5"
        style={{ background: '#111111', border: '1px solid #2E2E2E' }}
      >
        {/* Header: employee selector + month nav + holiday manager */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="appearance-none h-9 rounded-lg px-3 pr-8 text-sm"
                style={{
                  background: '#0A0A0A',
                  border: '1px solid #2E2E2E',
                  color: '#FFFFFF',
                  outline: 'none',
                  minWidth: '180px',
                }}
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
              <ChevronRight
                size={13}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90"
                style={{ color: '#606060' }}
              />
            </div>
            <HolidayManager year={calYear} />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: '#A0A0A0' }}
            >
              <ChevronLeft size={16} />
            </button>
            <span
              className="text-sm font-semibold w-36 text-center"
              style={{ color: '#FFFFFF' }}
            >
              {MONTH_NAMES[calMonth - 1]} {calYear}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
              style={{ color: '#A0A0A0' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          {summaryChips.map((s) => (
            <div
              key={s.key}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
              style={{ background: s.bg, color: s.color }}
            >
              <span className="font-bold">{s.value}</span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DOW_LABELS.map((d) => (
            <div
              key={d}
              className="text-center text-xs py-1.5"
              style={{ color: '#606060' }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-1">
          {calCells.map((day, idx) => {
            if (day === null) return <div key={idx} />

            const log = logByDay[day]
            const holiday = holidayByDay[day]
            const dot = log ? STATUS_DOT[log.status] : null
            const isToday =
              day === now.getDate() &&
              calMonth === now.getMonth() + 1 &&
              calYear === now.getFullYear()

            return (
              <button
                key={idx}
                onClick={() => (log || holiday) ? setSelectedDay({ day, log: log ?? null, holiday }) : undefined}
                className="flex flex-col items-center justify-center rounded-lg py-2.5 transition-colors"
                style={{
                  background: isToday ? '#1A0000' : 'transparent',
                  border: isToday ? '1px solid #A50000' : '1px solid transparent',
                  cursor: (log || holiday) ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => {
                  if (log || holiday) (e.currentTarget as HTMLButtonElement).style.background = '#1A1A1A'
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    isToday ? '#1A0000' : 'transparent'
                }}
              >
                <span
                  className="text-xs font-medium"
                  style={{ color: isToday ? '#A50000' : '#FFFFFF' }}
                >
                  {day}
                </span>
                {holiday ? (
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1"
                    style={{ background: holiday.type === 'PUBLIC' ? '#DC2626' : '#D97706' }}
                  />
                ) : dot ? (
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1"
                    style={{ background: dot.color }}
                  />
                ) : (
                  <div className="w-1.5 h-1.5 mt-1" />
                )}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 pt-4" style={{ borderTop: '1px solid #1A1A1A' }}>
          {Object.entries(STATUS_DOT).map(([, v]) => (
            <div key={v.label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: v.color }} />
              <span className="text-xs" style={{ color: '#606060' }}>{v.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#DC2626' }} />
            <span className="text-xs" style={{ color: '#606060' }}>Public Holiday</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#D97706' }} />
            <span className="text-xs" style={{ color: '#606060' }}>Company Holiday</span>
          </div>
        </div>
      </div>

      {/* ── Day Detail Modal ── */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="rounded-xl p-5 w-full max-w-xs"
            style={{ background: '#111111', border: '1px solid #2E2E2E' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                className="text-sm font-bold"
                style={{ color: '#FFFFFF', fontFamily: 'var(--font-syne)' }}
              >
                {MONTH_NAMES[calMonth - 1]} {selectedDay.day}, {calYear}
              </h3>
              <div className="flex items-center gap-2">
                {selectedDay.holiday && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: selectedDay.holiday.type === 'PUBLIC' ? '#DC262625' : '#D9770625',
                      color: selectedDay.holiday.type === 'PUBLIC' ? '#DC2626' : '#D97706',
                    }}
                  >
                    {selectedDay.holiday.name}
                  </span>
                )}
                {selectedDay.log && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: (STATUS_DOT[selectedDay.log.status]?.color ?? '#606060') + '25',
                      color: STATUS_DOT[selectedDay.log.status]?.color ?? '#606060',
                    }}
                  >
                    {STATUS_DOT[selectedDay.log.status]?.label ?? selectedDay.log.status}
                  </span>
                )}
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-1 rounded hover:bg-white/10"
                  style={{ color: '#606060' }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {selectedDay.log ? (
              <div className="space-y-3">
                <div className="flex justify-between py-2" style={{ borderBottom: '1px solid #1A1A1A' }}>
                  <span className="text-xs" style={{ color: '#606060' }}>Check In</span>
                  <span className="text-sm" style={{ color: '#FFFFFF' }}>
                    {fmtTime(selectedDay.log.checkinTime)}
                  </span>
                </div>
                <div className="flex justify-between py-2" style={{ borderBottom: '1px solid #1A1A1A' }}>
                  <span className="text-xs" style={{ color: '#606060' }}>Check Out</span>
                  <span className="text-sm" style={{ color: '#FFFFFF' }}>
                    {fmtTime(selectedDay.log.checkoutTime)}
                  </span>
                </div>
                {selectedDay.log.hoursWorked != null && (
                  <div className="flex justify-between py-2" style={{ borderBottom: '1px solid #1A1A1A' }}>
                    <span className="text-xs" style={{ color: '#606060' }}>Hours Worked</span>
                    <span className="text-sm font-semibold" style={{ color: '#A50000' }}>
                      {selectedDay.log.hoursWorked.toFixed(1)}h
                    </span>
                  </div>
                )}
                {selectedDay.log.locationName && (
                  <div className="flex justify-between py-2" style={{ borderBottom: '1px solid #1A1A1A' }}>
                    <span className="text-xs" style={{ color: '#606060' }}>Location</span>
                    <span className="text-xs flex items-center gap-1" style={{ color: '#A0A0A0' }}>
                      <MapPin size={11} />
                      {selectedDay.log.locationName}
                    </span>
                  </div>
                )}
                {selectedDay.log.notes && (
                  <div className="pt-1">
                    <p className="text-xs mb-1" style={{ color: '#606060' }}>Notes</p>
                    <p className="text-sm" style={{ color: '#A0A0A0' }}>
                      {selectedDay.log.notes}
                    </p>
                  </div>
                )}
              </div>
            ) : selectedDay.holiday ? (
              <p className="text-sm" style={{ color: '#A0A0A0' }}>
                🎌 {selectedDay.holiday.name} ({selectedDay.holiday.type === 'PUBLIC' ? 'Public Holiday' : 'Company Holiday'})
              </p>
            ) : (
              <p className="text-sm" style={{ color: '#606060' }}>
                No attendance record for this day.
              </p>
            )}

            <button
              onClick={() => setSelectedDay(null)}
              className="w-full mt-4 h-9 rounded-lg text-sm transition-colors hover:bg-white/5"
              style={{ background: '#1A1A1A', color: '#A0A0A0' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
