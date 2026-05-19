'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Loader2, Building2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Department {
  id: string
  name: string
  managerId: string | null
  description: string | null
  _count?: { employees: number }
  manager?: { id: string; firstName: string; lastName: string } | null
}

interface DeptFormModalProps {
  open: boolean
  onClose: () => void
  initial?: Department | null
}

function DeptFormModal({ open, onClose, initial }: DeptFormModalProps) {
  const isEdit = !!initial
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [managerId, setManagerId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [nameError, setNameError] = useState('')

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['hrm-employees'],
    queryFn: () => api.get('/hrm/employees').then((r) => r.data),
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    setName(initial?.name || '')
    setDescription(initial?.description || '')
    setManagerId(initial?.managerId || '')
    setNameError('')
  }, [open, initial])

  const handleSubmit = async () => {
    if (!name.trim()) {
      setNameError('Department name is required')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        managerId: managerId || null,
      }
      if (isEdit) {
        await api.put(`/hrm/departments/${initial!.id}`, payload)
        toast.success('Department updated')
      } else {
        await api.post('/hrm/departments', payload)
        toast.success('Department created')
      }
      qc.invalidateQueries({ queryKey: ['hrm-departments'] })
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save department')
    } finally {
      setSubmitting(false)
    }
  }

  const INPUT = { background: '#0A0A0A', border: '1px solid #2E2E2E', color: '#FFFFFF' }
  const LABEL = { color: '#A0A0A0', fontSize: '0.75rem', fontWeight: 600 as const }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-md"
        style={{ background: '#111111', border: '1px solid #2E2E2E' }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}>
            {isEdit ? 'Edit Department' : 'Add Department'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label style={LABEL}>DEPARTMENT NAME *</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameError('')
              }}
              placeholder="e.g. Engineering"
              className="h-10"
              style={INPUT}
            />
            {nameError && (
              <p className="text-xs" style={{ color: '#DC2626' }}>
                {nameError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label style={LABEL}>MANAGER</Label>
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="appearance-none w-full h-10 rounded-lg px-3 text-sm"
              style={{ ...INPUT, outline: 'none' }}
            >
              <option value="">No manager</option>
              {employees.map((e: any) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label style={LABEL}>DESCRIPTION</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this department..."
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none"
              style={{ ...INPUT, outline: 'none' }}
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 h-10"
              style={{ borderColor: '#2E2E2E', color: '#A0A0A0', background: 'transparent' }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 h-10"
              style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isEdit ? (
                'Save Changes'
              ) : (
                'Create'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function DepartmentList() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editDept, setEditDept] = useState<Department | null>(null)
  const [deleteDept, setDeleteDept] = useState<Department | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data: departments = [], isLoading } = useQuery<Department[]>({
    queryKey: ['hrm-departments'],
    queryFn: () => api.get('/hrm/departments').then((r) => r.data),
  })

  const handleDelete = async () => {
    if (!deleteDept) return
    setDeleting(true)
    try {
      await api.delete(`/hrm/departments/${deleteDept.id}`)
      toast.success(`${deleteDept.name} deleted`)
      qc.invalidateQueries({ queryKey: ['hrm-departments'] })
      setDeleteDept(null)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete department')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: '#A0A0A0' }}>
          {departments.length} department{departments.length !== 1 ? 's' : ''}
        </p>
        <Button
          onClick={() => setShowAdd(true)}
          size="sm"
          className="gap-1.5"
          style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
        >
          <Plus size={14} />
          Add Department
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-4 animate-pulse"
              style={{ background: '#111111', border: '1px solid #2E2E2E' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg" style={{ background: '#1A1A1A' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-4 rounded" style={{ background: '#1A1A1A', width: '50%' }} />
                  <div className="h-3 rounded" style={{ background: '#1A1A1A', width: '70%' }} />
                </div>
              </div>
              <div className="h-3 rounded mb-3" style={{ background: '#1A1A1A', width: '80%' }} />
              <div className="h-5 rounded-full" style={{ background: '#1A1A1A', width: '40%' }} />
            </div>
          ))}
        </div>
      ) : departments.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-xl"
          style={{ background: '#111111', border: '1px solid #2E2E2E' }}
        >
          <Building2 size={48} style={{ color: '#2E2E2E' }} />
          <p className="text-base font-medium mt-4" style={{ color: '#A0A0A0' }}>
            No departments yet
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="text-sm mt-2 hover:underline"
            style={{ color: '#A50000' }}
          >
            Create your first department
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="rounded-xl p-4"
              style={{ background: '#111111', border: '1px solid #2E2E2E' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: '#1A0000' }}
                  >
                    <Building2 size={16} style={{ color: '#A50000' }} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold truncate" style={{ color: '#FFFFFF' }}>
                      {dept.name}
                    </h3>
                    {dept.manager && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: '#A0A0A0' }}>
                        {dept.manager.firstName} {dept.manager.lastName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => setEditDept(dept)}
                    className="p-1.5 rounded-lg transition-colors hover:bg-white/10"
                    style={{ color: '#0284C7' }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => setDeleteDept(dept)}
                    className="p-1.5 rounded-lg transition-colors hover:bg-red-950"
                    style={{ color: '#DC2626' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {dept.description && (
                <p className="text-xs mb-3 line-clamp-2" style={{ color: '#606060' }}>
                  {dept.description}
                </p>
              )}

              <div className="pt-2" style={{ borderTop: '1px solid #1A1A1A' }}>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: '#1A1A1A', color: '#A0A0A0' }}
                >
                  {dept._count?.employees ?? 0} employee
                  {(dept._count?.employees ?? 0) !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <DeptFormModal open={showAdd} onClose={() => setShowAdd(false)} />
      <DeptFormModal open={!!editDept} initial={editDept} onClose={() => setEditDept(null)} />

      {/* Delete Confirm */}
      {deleteDept && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}
        >
          <div
            className="rounded-xl p-6 w-full max-w-sm"
            style={{ background: '#111111', border: '1px solid #2E2E2E' }}
          >
            <h3
              className="text-base font-bold mb-2"
              style={{ color: '#FFFFFF', fontFamily: 'var(--font-syne)' }}
            >
              Delete Department?
            </h3>
            <p className="text-sm mb-5" style={{ color: '#A0A0A0' }}>
              Delete{' '}
              <strong style={{ color: '#FFFFFF' }}>{deleteDept.name}</strong>? This action cannot
              be undone.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setDeleteDept(null)}
                variant="outline"
                className="flex-1 h-9"
                style={{ borderColor: '#2E2E2E', color: '#A0A0A0', background: 'transparent' }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-9"
                style={{ background: '#DC2626', color: '#FFFFFF', border: 'none' }}
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
