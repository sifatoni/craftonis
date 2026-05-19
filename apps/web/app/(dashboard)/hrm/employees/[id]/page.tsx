'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Pencil, Archive } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { EmployeeModal } from '@/components/hrm/EmployeeModal'

interface PageProps {
  params: { id: string }
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function calcTenure(joinDate: string): string {
  const join = new Date(joinDate)
  const now = new Date()
  const months =
    (now.getFullYear() - join.getFullYear()) * 12 + (now.getMonth() - join.getMonth())
  const yrs = Math.floor(months / 12)
  const mos = months % 12
  if (yrs === 0) return `${mos} mo${mos !== 1 ? 's' : ''}`
  if (mos === 0) return `${yrs} yr${yrs !== 1 ? 's' : ''}`
  return `${yrs} yr${yrs !== 1 ? 's' : ''} ${mos} mo${mos !== 1 ? 's' : ''}`
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: '#052E16', color: '#16A34A', label: 'Active' },
  INACTIVE: { bg: '#1A1A1A', color: '#A0A0A0', label: 'Inactive' },
  ON_LEAVE: { bg: '#1C1007', color: '#D97706', label: 'On Leave' },
  TERMINATED: { bg: '#1A0000', color: '#DC2626', label: 'Terminated' },
}

const EMP_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: 'Full Time',
  PART_TIME: 'Part Time',
  CONTRACT: 'Contract',
  INTERN: 'Intern',
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="flex items-start justify-between gap-4 py-2.5"
      style={{ borderBottom: '1px solid #1A1A1A' }}
    >
      <span className="text-xs flex-shrink-0" style={{ color: '#606060' }}>
        {label}
      </span>
      <span className="text-sm text-right break-words max-w-[60%]" style={{ color: '#FFFFFF' }}>
        {value || '—'}
      </span>
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#111111', border: '1px solid #2E2E2E' }}>
      <h3
        className="text-xs font-bold uppercase tracking-widest mb-1"
        style={{ color: '#A50000' }}
      >
        {title}
      </h3>
      <div>{children}</div>
    </div>
  )
}

export default function EmployeeProfilePage({ params }: PageProps) {
  const router = useRouter()
  const qc = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const {
    data: employee,
    isLoading,
    error,
  } = useQuery<any>({
    queryKey: ['hrm-employee', params.id],
    queryFn: () => api.get(`/hrm/employees/${params.id}`).then((r) => r.data),
    enabled: !!params.id,
  })

  const handleArchive = async () => {
    if (!employee) return
    setArchiving(true)
    try {
      await api.put(`/hrm/employees/${employee.id}`, { status: 'INACTIVE' })
      toast.success(`${employee.firstName} ${employee.lastName} archived`)
      qc.invalidateQueries({ queryKey: ['hrm-employees'] })
      qc.invalidateQueries({ queryKey: ['hrm-employee', params.id] })
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to archive employee')
    } finally {
      setArchiving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: '#A50000' }} />
      </div>
    )
  }

  if (error || !employee) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-base" style={{ color: '#A0A0A0' }}>
          Employee not found
        </p>
        <button
          onClick={() => router.push('/hrm')}
          className="text-sm mt-2 hover:underline"
          style={{ color: '#A50000' }}
        >
          Back to HRM
        </button>
      </div>
    )
  }

  const status = STATUS_STYLES[employee.status] || STATUS_STYLES.INACTIVE
  const total =
    (employee.basicSalary || 0) +
    (employee.houseAllowance || 0) +
    (employee.transportAllowance || 0) +
    (employee.medicalAllowance || 0) +
    (employee.otherAllowance || 0)

  const genderLabel = employee.gender
    ? employee.gender.charAt(0) + employee.gender.slice(1).toLowerCase()
    : null

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <button
        onClick={() => router.push('/hrm')}
        className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
        style={{ color: '#A0A0A0' }}
      >
        <ArrowLeft size={16} />
        Back to HRM
      </button>

      {/* Header Card */}
      <div
        className="flex flex-col sm:flex-row items-start justify-between gap-4 rounded-xl p-5"
        style={{ background: '#111111', border: '1px solid #2E2E2E' }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
            style={{ background: '#A50000', color: '#FFFFFF' }}
          >
            {getInitials(employee.firstName, employee.lastName)}
          </div>
          <div>
            <h1
              className="text-xl font-bold"
              style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}
            >
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#A0A0A0' }}>
              {employee.designation || '—'}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {employee.department && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: '#1A1A1A',
                    color: '#A0A0A0',
                    border: '1px solid #2E2E2E',
                  }}
                >
                  {employee.department.name}
                </span>
              )}
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: status.bg, color: status.color }}
              >
                {status.label}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            onClick={() => setShowEdit(true)}
            size="sm"
            className="gap-1.5"
            style={{ background: '#1A1A1A', color: '#FFFFFF', border: '1px solid #2E2E2E' }}
          >
            <Pencil size={13} />
            Edit
          </Button>
          <Button
            onClick={handleArchive}
            disabled={archiving}
            size="sm"
            className="gap-1.5"
            style={{ background: 'transparent', color: '#D97706', border: '1px solid #D97706' }}
          >
            {archiving ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
            Archive
          </Button>
        </div>
      </div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard title="Personal Information">
          <InfoRow label="Email" value={employee.email} />
          <InfoRow label="Phone" value={employee.phone} />
          <InfoRow label="Gender" value={genderLabel} />
          <InfoRow label="Date of Birth" value={fmtDate(employee.dateOfBirth)} />
          <InfoRow label="National ID" value={employee.nationalId} />
          <InfoRow label="Address" value={employee.address} />
        </InfoCard>

        <InfoCard title="Job Information">
          <InfoRow label="Department" value={employee.department?.name} />
          <InfoRow
            label="Employment Type"
            value={EMP_TYPE_LABELS[employee.employmentType] || employee.employmentType}
          />
          <InfoRow label="Job Role" value={employee.jobRole} />
          <InfoRow
            label="Reporting To"
            value={
              employee.reportingTo
                ? `${employee.reportingTo.firstName} ${employee.reportingTo.lastName}`
                : null
            }
          />
          <InfoRow label="Join Date" value={fmtDate(employee.joinDate)} />
          <InfoRow
            label="Tenure"
            value={employee.joinDate ? calcTenure(employee.joinDate) : null}
          />
        </InfoCard>

        <InfoCard title="Salary &amp; Compensation">
          <InfoRow
            label="Basic Salary"
            value={
              employee.basicSalary != null
                ? `৳ ${Number(employee.basicSalary).toLocaleString()}`
                : null
            }
          />
          <InfoRow
            label="House Allowance"
            value={
              employee.houseAllowance != null
                ? `৳ ${Number(employee.houseAllowance).toLocaleString()}`
                : null
            }
          />
          <InfoRow
            label="Transport Allowance"
            value={
              employee.transportAllowance != null
                ? `৳ ${Number(employee.transportAllowance).toLocaleString()}`
                : null
            }
          />
          <InfoRow
            label="Medical Allowance"
            value={
              employee.medicalAllowance != null
                ? `৳ ${Number(employee.medicalAllowance).toLocaleString()}`
                : null
            }
          />
          <InfoRow
            label="Other Allowance"
            value={
              employee.otherAllowance != null
                ? `৳ ${Number(employee.otherAllowance).toLocaleString()}`
                : null
            }
          />
          <div className="flex items-center justify-between pt-3">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#606060' }}>
              Total
            </span>
            <span
              className="text-base font-bold"
              style={{ color: '#A50000', fontFamily: 'var(--font-syne)' }}
            >
              ৳ {total.toLocaleString()}
            </span>
          </div>
        </InfoCard>

        <InfoCard title="Emergency Contact">
          <InfoRow label="Contact Name" value={employee.emergencyContact} />
          <InfoRow label="Phone Number" value={employee.emergencyPhone} />
          <InfoRow label="Relationship" value={employee.emergencyRelation} />
        </InfoCard>
      </div>

      <EmployeeModal
        open={showEdit}
        initial={employee}
        onClose={() => {
          setShowEdit(false)
          qc.invalidateQueries({ queryKey: ['hrm-employee', params.id] })
        }}
      />
    </div>
  )
}
