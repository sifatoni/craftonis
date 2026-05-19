'use client'

import { useState, useCallback, memo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Plus, Trash2, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'

interface Holiday {
  id: string
  name: string
  date: string
  type: 'PUBLIC' | 'COMPANY'
}

interface HolidayManagerProps {
  year: number
}

const TYPE_LABEL: Record<string, string> = {
  PUBLIC:  'Public',
  COMPANY: 'Company',
}
const TYPE_COLOR: Record<string, string> = {
  PUBLIC:  '#DC2626',
  COMPANY: '#D97706',
}

function HolidayManagerModal({
  open,
  onClose,
  year,
}: {
  open: boolean
  onClose: () => void
  year: number
}) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [type, setType] = useState<'PUBLIC' | 'COMPANY'>('PUBLIC')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: holidays = [], isLoading } = useQuery<Holiday[]>({
    queryKey: ['hrm-holidays', year],
    queryFn: () => api.get('/hrm/holidays', { params: { year } }).then((r) => r.data),
    enabled: open,
  })

  const handleAdd = useCallback(async () => {
    if (!name.trim() || !date) {
      toast.error('Name and date are required')
      return
    }
    setAdding(true)
    try {
      await api.post('/hrm/holidays', { name: name.trim(), date, type })
      toast.success('Holiday added')
      qc.invalidateQueries({ queryKey: ['hrm-holidays'] })
      setName('')
      setDate('')
      setType('PUBLIC')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add holiday')
    } finally {
      setAdding(false)
    }
  }, [name, date, type, qc])

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id)
    try {
      await api.delete(`/hrm/holidays/${id}`)
      toast.success('Holiday removed')
      qc.invalidateQueries({ queryKey: ['hrm-holidays'] })
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete holiday')
    } finally {
      setDeletingId(null)
    }
  }, [qc])

  if (!open) return null

  const INPUT = {
    background: '#0A0A0A',
    border: '1px solid #2E2E2E',
    color: '#FFFFFF',
    outline: 'none',
  } as const

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-md flex flex-col"
        style={{ background: '#111111', border: '1px solid #2E2E2E', maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid #1A1A1A' }}
        >
          <h2 className="text-sm font-bold" style={{ color: '#FFFFFF', fontFamily: 'var(--font-syne)' }}>
            Manage Holidays — {year}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10"
            style={{ color: '#606060' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Add form */}
        <div className="px-5 py-4 flex flex-col gap-3" style={{ borderBottom: '1px solid #1A1A1A' }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#606060' }}>
            Add Holiday
          </p>
          <input
            type="text"
            placeholder="Holiday name (e.g. Eid-ul-Fitr)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-9 rounded-lg px-3 text-sm"
            style={INPUT}
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 h-9 rounded-lg px-3 text-sm"
              style={{ ...INPUT, colorScheme: 'dark' }}
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'PUBLIC' | 'COMPANY')}
              className="h-9 rounded-lg px-3 text-sm"
              style={{ ...INPUT, minWidth: '110px' }}
            >
              <option value="PUBLIC">Public</option>
              <option value="COMPANY">Company</option>
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="h-9 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
            style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add
          </button>
        </div>

        {/* Holiday list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={20} className="animate-spin" style={{ color: '#606060' }} />
            </div>
          ) : holidays.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: '#606060' }}>
              No holidays set for {year}
            </p>
          ) : (
            holidays.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-lg px-3 py-2.5"
                style={{ background: '#0A0A0A', border: '1px solid #1A1A1A' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: TYPE_COLOR[h.type] }}
                  />
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
                      {h.name}
                    </p>
                    <p className="text-xs" style={{ color: '#606060' }}>
                      {new Date(h.date).toLocaleDateString('en-US', {
                        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
                      })}
                      {' · '}{TYPE_LABEL[h.type]}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(h.id)}
                  disabled={deletingId === h.id}
                  className="p-1.5 rounded hover:bg-white/5 transition-colors"
                  style={{ color: '#606060' }}
                >
                  {deletingId === h.id
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Trash2 size={14} />}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export const HolidayManager = memo(function HolidayManager({ year }: HolidayManagerProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors hover:bg-white/10"
        style={{ color: '#A0A0A0', border: '1px solid #2E2E2E' }}
      >
        <Calendar size={13} />
        Manage Holidays
      </button>
      <HolidayManagerModal open={open} onClose={() => setOpen(false)} year={year} />
    </>
  )
})
