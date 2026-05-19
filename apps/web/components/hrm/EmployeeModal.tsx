'use client'

import { useState, useEffect, useCallback, memo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type ModalTab = 'personal' | 'job' | 'salary' | 'emergency'

interface EmployeeModalProps {
  open: boolean
  onClose: () => void
  initial?: any | null
}

const TABS: Array<{ key: ModalTab; label: string }> = [
  { key: 'personal', label: 'Personal Info' },
  { key: 'job', label: 'Job Info' },
  { key: 'salary', label: 'Salary' },
  { key: 'emergency', label: 'Emergency' },
]

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  gender: '',
  dateOfBirth: '',
  nationalId: '',
  address: '',
  departmentId: '',
  employmentType: 'FULL_TIME',
  designation: '',
  jobRole: '',
  reportingToId: '',
  joinDate: '',
  basicSalary: '',
  houseAllowance: '',
  transportAllowance: '',
  medicalAllowance: '',
  otherAllowance: '',
  emergencyContact: '',
  emergencyPhone: '',
  emergencyRelation: '',
}

const INPUT_STYLE = { background: '#0A0A0A', border: '1px solid #2E2E2E', color: '#FFFFFF' }
const LABEL_STYLE = { color: '#A0A0A0', fontSize: '0.75rem', fontWeight: 600 as const }
const SELECT_STYLE = {
  ...INPUT_STYLE,
  appearance: 'none' as const,
  outline: 'none',
}

// ── Field is defined OUTSIDE EmployeeModal to prevent remounting on each render ──
function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label style={LABEL_STYLE}>{label}</Label>
      {children}
      {error && (
        <p className="text-xs" style={{ color: '#DC2626' }}>
          {error}
        </p>
      )}
    </div>
  )
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return ''
  return d.split('T')[0]
}

// ── EmployeeModal is memoized to prevent re-renders from parent state changes ──
export const EmployeeModal = memo(function EmployeeModal({
  open,
  onClose,
  initial,
}: EmployeeModalProps) {
  const isEdit = !!initial
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<ModalTab>('personal')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setFormState] = useState(EMPTY_FORM)

  const { data: departments = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['hrm-departments'],
    queryFn: () => api.get('/hrm/departments').then((r) => r.data),
    enabled: open,
  })

  const { data: allEmployees = [] } = useQuery<any[]>({
    queryKey: ['hrm-employees'],
    queryFn: () => api.get('/hrm/employees').then((r) => r.data),
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    setActiveTab('personal')
    setErrors({})
    if (initial) {
      setFormState({
        firstName: initial.firstName || '',
        lastName: initial.lastName || '',
        email: initial.email || '',
        phone: initial.phone || '',
        gender: initial.gender || '',
        dateOfBirth: fmtDate(initial.dateOfBirth),
        nationalId: initial.nationalId || '',
        address: initial.address || '',
        departmentId: initial.departmentId || '',
        employmentType: initial.employmentType || 'FULL_TIME',
        designation: initial.designation || '',
        jobRole: initial.jobRole || '',
        reportingToId: initial.reportingToId || '',
        joinDate: fmtDate(initial.joinDate),
        basicSalary: initial.basicSalary != null ? String(initial.basicSalary) : '',
        houseAllowance: initial.houseAllowance != null ? String(initial.houseAllowance) : '',
        transportAllowance:
          initial.transportAllowance != null ? String(initial.transportAllowance) : '',
        medicalAllowance:
          initial.medicalAllowance != null ? String(initial.medicalAllowance) : '',
        otherAllowance: initial.otherAllowance != null ? String(initial.otherAllowance) : '',
        emergencyContact: initial.emergencyContact || '',
        emergencyPhone: initial.emergencyPhone || '',
        emergencyRelation: initial.emergencyRelation || '',
      })
    } else {
      setFormState(EMPTY_FORM)
    }
  }, [open, initial])

  // useCallback prevents handler recreation on every render
  const setField = useCallback(
    (field: keyof typeof EMPTY_FORM) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormState((f) => ({ ...f, [field]: e.target.value }))
        setErrors((prev) => {
          if (!prev[field]) return prev
          const n = { ...prev }
          delete n[field]
          return n
        })
      },
    [],
  )

  const totalSalary =
    (Number(form.basicSalary) || 0) +
    (Number(form.houseAllowance) || 0) +
    (Number(form.transportAllowance) || 0) +
    (Number(form.medicalAllowance) || 0) +
    (Number(form.otherAllowance) || 0)

  const validate = useCallback(() => {
    const errs: Record<string, string> = {}
    if (!form.firstName.trim()) errs.firstName = 'First name is required'
    if (!form.lastName.trim()) errs.lastName = 'Last name is required'
    return errs
  }, [form.firstName, form.lastName])

  const buildPayload = useCallback(() => {
    const s = (v: string) => (v.trim() === '' ? null : v.trim())
    const n = (v: string) => (v.trim() === '' ? null : Number(v))
    return {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: s(form.email),
      phone: s(form.phone),
      gender: s(form.gender),
      dateOfBirth: s(form.dateOfBirth),
      nationalId: s(form.nationalId),
      address: s(form.address),
      departmentId: s(form.departmentId),
      employmentType: form.employmentType || 'FULL_TIME',
      designation: s(form.designation),
      jobRole: s(form.jobRole),
      reportingToId: s(form.reportingToId),
      joinDate: s(form.joinDate),
      basicSalary: n(form.basicSalary),
      houseAllowance: n(form.houseAllowance),
      transportAllowance: n(form.transportAllowance),
      medicalAllowance: n(form.medicalAllowance),
      otherAllowance: n(form.otherAllowance),
      emergencyContact: s(form.emergencyContact),
      emergencyPhone: s(form.emergencyPhone),
      emergencyRelation: s(form.emergencyRelation),
    }
  }, [form])

  const handleSubmit = useCallback(async () => {
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      setActiveTab('personal')
      return
    }
    setSubmitting(true)
    try {
      const payload = buildPayload()
      if (isEdit) {
        await api.put(`/hrm/employees/${initial.id}`, payload)
        toast.success('Employee updated successfully')
      } else {
        await api.post('/hrm/employees', payload)
        toast.success('Employee added successfully')
      }
      qc.invalidateQueries({ queryKey: ['hrm-employees'] })
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save employee')
    } finally {
      setSubmitting(false)
    }
  }, [validate, buildPayload, isEdit, initial, qc, onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  const stopPropagation = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div
        className="max-w-2xl w-full flex flex-col rounded-xl border border-[#2E2E2E] bg-[#111111] z-[10000] p-6 shadow-2xl relative my-8"
        style={{ maxHeight: 'calc(100vh - 4rem)' }}
        onClick={stopPropagation}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-4 flex-shrink-0">
          <h2
            className="text-lg font-semibold"
            style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}
          >
            {isEdit ? 'Edit Employee' : 'Add Employee'}
          </h2>
        </div>

        {/* Tab Bar */}
        <div
          className="flex gap-1 p-1 rounded-lg flex-shrink-0 mb-4"
          style={{ background: '#0A0A0A' }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: activeTab === tab.key ? '#A50000' : 'transparent',
                color: activeTab === tab.key ? '#FFFFFF' : '#A0A0A0',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 space-y-4 pr-1">
          {/* PERSONAL INFO */}
          {activeTab === 'personal' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="FIRST NAME *" error={errors.firstName}>
                  <Input
                    value={form.firstName}
                    onChange={setField('firstName')}
                    placeholder="Arif"
                    className="h-10"
                    style={INPUT_STYLE}
                  />
                </Field>
                <Field label="LAST NAME *" error={errors.lastName}>
                  <Input
                    value={form.lastName}
                    onChange={setField('lastName')}
                    placeholder="Hassan"
                    className="h-10"
                    style={INPUT_STYLE}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="EMAIL">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={setField('email')}
                    placeholder="arif@company.com"
                    className="h-10"
                    style={INPUT_STYLE}
                  />
                </Field>
                <Field label="PHONE">
                  <Input
                    value={form.phone}
                    onChange={setField('phone')}
                    placeholder="+8801712345678"
                    className="h-10"
                    style={INPUT_STYLE}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="GENDER">
                  <select
                    value={form.gender}
                    onChange={setField('gender')}
                    className="w-full h-10 rounded-lg px-3 text-sm"
                    style={SELECT_STYLE}
                  >
                    <option value="">Select gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="DATE OF BIRTH">
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={setField('dateOfBirth')}
                    className="w-full h-10 rounded-lg px-3 text-sm"
                    style={{ ...INPUT_STYLE, colorScheme: 'dark', outline: 'none' }}
                  />
                </Field>
              </div>
              <Field label="NATIONAL ID">
                <Input
                  value={form.nationalId}
                  onChange={setField('nationalId')}
                  placeholder="NID number"
                  className="h-10"
                  style={INPUT_STYLE}
                />
              </Field>
              <Field label="ADDRESS">
                <textarea
                  value={form.address}
                  onChange={setField('address')}
                  placeholder="Full address..."
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                  style={{ ...INPUT_STYLE, outline: 'none' }}
                />
              </Field>
            </div>
          )}

          {/* JOB INFO */}
          {activeTab === 'job' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="DEPARTMENT">
                  <select
                    value={form.departmentId}
                    onChange={setField('departmentId')}
                    className="w-full h-10 rounded-lg px-3 text-sm"
                    style={SELECT_STYLE}
                  >
                    <option value="">No department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="EMPLOYMENT TYPE">
                  <select
                    value={form.employmentType}
                    onChange={setField('employmentType')}
                    className="w-full h-10 rounded-lg px-3 text-sm"
                    style={SELECT_STYLE}
                  >
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERN">Intern</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="DESIGNATION">
                  <Input
                    value={form.designation}
                    onChange={setField('designation')}
                    placeholder="e.g. Software Engineer"
                    className="h-10"
                    style={INPUT_STYLE}
                  />
                </Field>
                <Field label="JOB ROLE">
                  <Input
                    value={form.jobRole}
                    onChange={setField('jobRole')}
                    placeholder="e.g. Backend Developer"
                    className="h-10"
                    style={INPUT_STYLE}
                  />
                </Field>
              </div>
              <Field label="REPORTING TO">
                <select
                  value={form.reportingToId}
                  onChange={setField('reportingToId')}
                  className="w-full h-10 rounded-lg px-3 text-sm"
                  style={SELECT_STYLE}
                >
                  <option value="">None</option>
                  {allEmployees
                    .filter((e: any) => !initial || e.id !== initial.id)
                    .map((e: any) => (
                      <option key={e.id} value={e.id}>
                        {e.firstName} {e.lastName}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="JOIN DATE">
                <input
                  type="date"
                  value={form.joinDate}
                  onChange={setField('joinDate')}
                  className="w-full h-10 rounded-lg px-3 text-sm"
                  style={{ ...INPUT_STYLE, colorScheme: 'dark', outline: 'none' }}
                />
              </Field>
            </div>
          )}

          {/* SALARY */}
          {activeTab === 'salary' && (
            <div className="space-y-4">
              {(
                [
                  { field: 'basicSalary', label: 'BASIC SALARY' },
                  { field: 'houseAllowance', label: 'HOUSE ALLOWANCE' },
                  { field: 'transportAllowance', label: 'TRANSPORT ALLOWANCE' },
                  { field: 'medicalAllowance', label: 'MEDICAL ALLOWANCE' },
                  { field: 'otherAllowance', label: 'OTHER ALLOWANCE' },
                ] as const
              ).map(({ field, label }) => (
                <Field key={field} label={label}>
                  <div className="relative">
                    <span
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-sm select-none"
                      style={{ color: '#A0A0A0' }}
                    >
                      ৳
                    </span>
                    <Input
                      type="number"
                      value={form[field]}
                      onChange={setField(field)}
                      placeholder="0"
                      className="h-10 pl-7"
                      style={INPUT_STYLE}
                    />
                  </div>
                </Field>
              ))}

              <div
                className="rounded-lg p-3"
                style={{ background: '#0A0A0A', border: '1px solid #2E2E2E' }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: '#606060' }}
                  >
                    Total Salary
                  </span>
                  <span
                    className="text-lg font-bold"
                    style={{ color: '#A50000', fontFamily: 'var(--font-syne)' }}
                  >
                    ৳ {totalSalary.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* EMERGENCY */}
          {activeTab === 'emergency' && (
            <div className="space-y-4">
              <Field label="CONTACT NAME">
                <Input
                  value={form.emergencyContact}
                  onChange={setField('emergencyContact')}
                  placeholder="Emergency contact name"
                  className="h-10"
                  style={INPUT_STYLE}
                />
              </Field>
              <Field label="PHONE NUMBER">
                <Input
                  value={form.emergencyPhone}
                  onChange={setField('emergencyPhone')}
                  placeholder="+8801712345678"
                  className="h-10"
                  style={INPUT_STYLE}
                />
              </Field>
              <Field label="RELATIONSHIP">
                <Input
                  value={form.emergencyRelation}
                  onChange={setField('emergencyRelation')}
                  placeholder="e.g. Spouse, Parent"
                  className="h-10"
                  style={INPUT_STYLE}
                />
              </Field>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex gap-3 pt-3 flex-shrink-0 mt-4"
          style={{ borderTop: '1px solid #2E2E2E' }}
        >
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
              'Add Employee'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
})
