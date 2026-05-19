'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Search, MoreVertical, Pencil, Archive, Users, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { EmployeeModal } from './EmployeeModal'

interface Department {
  id: string
  name: string
}

interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  designation: string | null
  employmentType: string
  status: string
  basicSalary: number | null
  houseAllowance: number | null
  transportAllowance: number | null
  medicalAllowance: number | null
  otherAllowance: number | null
  joinDate: string | null
  department: Department | null
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

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function calcTotal(emp: Employee): number {
  return (
    (emp.basicSalary || 0) +
    (emp.houseAllowance || 0) +
    (emp.transportAllowance || 0) +
    (emp.medicalAllowance || 0) +
    (emp.otherAllowance || 0)
  )
}

function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-4 animate-pulse"
      style={{ background: '#111111', border: '1px solid #2E2E2E' }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-full" style={{ background: '#1A1A1A' }} />
        <div className="flex-1 space-y-2">
          <div className="h-4 rounded" style={{ background: '#1A1A1A', width: '60%' }} />
          <div className="h-3 rounded" style={{ background: '#1A1A1A', width: '40%' }} />
        </div>
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-5 rounded-full" style={{ background: '#1A1A1A', width: '45%' }} />
      </div>
      <div
        className="pt-3 flex justify-between"
        style={{ borderTop: '1px solid #1A1A1A' }}
      >
        <div className="h-4 rounded" style={{ background: '#1A1A1A', width: '35%' }} />
        <div className="h-4 rounded" style={{ background: '#1A1A1A', width: '30%' }} />
      </div>
    </div>
  )
}

export function EmployeeList() {
  const router = useRouter()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ['hrm-employees', { search, departmentId: deptFilter, employmentType: typeFilter }],
    queryFn: () =>
      api
        .get('/hrm/employees', {
          params: {
            search: search || undefined,
            departmentId: deptFilter || undefined,
            employmentType: typeFilter || undefined,
          },
        })
        .then((r) => r.data),
  })

  const { data: departments = [] } = useQuery<Department[]>({
    queryKey: ['hrm-departments'],
    queryFn: () => api.get('/hrm/departments').then((r) => r.data),
  })

  const handleArchive = async (emp: Employee) => {
    try {
      await api.put(`/hrm/employees/${emp.id}`, { status: 'INACTIVE' })
      toast.success(`${emp.firstName} ${emp.lastName} archived`)
      qc.invalidateQueries({ queryKey: ['hrm-employees'] })
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to archive employee')
    }
  }

  const selectStyle = {
    background: '#111111',
    border: '1px solid #2E2E2E',
    color: '#A0A0A0',
    outline: 'none',
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: '#606060' }}
          />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 text-sm"
            style={{ background: '#111111', border: '1px solid #2E2E2E', color: '#FFFFFF' }}
          />
        </div>

        <div className="relative">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="appearance-none h-9 rounded-lg px-3 pr-8 text-sm"
            style={{ ...selectStyle, minWidth: '160px', color: deptFilter ? '#FFFFFF' : '#606060' }}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
            style={{ color: '#606060' }}
          />
        </div>

        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="appearance-none h-9 rounded-lg px-3 pr-8 text-sm"
            style={{ ...selectStyle, minWidth: '160px', color: typeFilter ? '#FFFFFF' : '#606060' }}
          >
            <option value="">All Types</option>
            {Object.entries(EMP_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <ChevronDown
            size={13}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
            style={{ color: '#606060' }}
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-xl"
          style={{ background: '#111111', border: '1px solid #2E2E2E' }}
        >
          <Users size={48} style={{ color: '#2E2E2E' }} />
          <p className="text-base font-medium mt-4" style={{ color: '#A0A0A0' }}>
            No employees found
          </p>
          <p className="text-sm mt-1" style={{ color: '#606060' }}>
            {search || deptFilter || typeFilter
              ? 'Try adjusting your filters'
              : 'Add your first employee to get started'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => {
            const status = STATUS_STYLES[emp.status] || STATUS_STYLES.INACTIVE
            const total = calcTotal(emp)

            return (
              <div
                key={emp.id}
                onClick={() => router.push(`/hrm/employees/${emp.id}`)}
                className="group rounded-xl p-4 cursor-pointer transition-all"
                style={{
                  background: '#111111',
                  border: '1px solid #2E2E2E',
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.borderColor = '#A50000')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.borderColor = '#2E2E2E')
                }
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: '#A50000', color: '#FFFFFF' }}
                    >
                      {getInitials(emp.firstName, emp.lastName)}
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-semibold leading-tight truncate"
                        style={{ color: '#FFFFFF' }}
                      >
                        {emp.firstName} {emp.lastName}
                      </p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: '#A0A0A0' }}>
                        {emp.designation || '—'}
                      </p>
                    </div>
                  </div>

                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all hover:bg-white/10"
                          style={{ color: '#606060' }}
                        >
                          <MoreVertical size={14} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        style={{ background: '#111111', border: '1px solid #2E2E2E' }}
                      >
                        <DropdownMenuItem
                          onClick={() => setEditEmployee(emp)}
                          className="cursor-pointer flex items-center gap-2 text-xs"
                          style={{ color: '#A0A0A0' }}
                        >
                          <Pencil size={12} style={{ color: '#0284C7' }} />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleArchive(emp)}
                          className="cursor-pointer flex items-center gap-2 text-xs"
                          style={{ color: '#A0A0A0' }}
                        >
                          <Archive size={12} style={{ color: '#D97706' }} />
                          Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {emp.department && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: '#1A1A1A',
                        color: '#A0A0A0',
                        border: '1px solid #2E2E2E',
                      }}
                    >
                      {emp.department.name}
                    </span>
                  )}
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: '#1A1A1A',
                      color: '#A0A0A0',
                      border: '1px solid #2E2E2E',
                    }}
                  >
                    {EMP_TYPE_LABELS[emp.employmentType] || emp.employmentType}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: status.bg, color: status.color }}
                  >
                    {status.label}
                  </span>
                </div>

                {/* Footer */}
                <div
                  className="pt-3 flex items-center justify-between"
                  style={{ borderTop: '1px solid #1A1A1A' }}
                >
                  <div>
                    <p className="text-xs" style={{ color: '#606060' }}>
                      Salary
                    </p>
                    <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>
                      {total > 0 ? `৳ ${total.toLocaleString()}` : '—'}
                    </p>
                  </div>
                  {emp.joinDate && (
                    <div className="text-right">
                      <p className="text-xs" style={{ color: '#606060' }}>
                        Joined
                      </p>
                      <p className="text-xs" style={{ color: '#A0A0A0' }}>
                        {new Date(emp.joinDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <EmployeeModal
        open={!!editEmployee}
        initial={editEmployee}
        onClose={() => setEditEmployee(null)}
      />
    </div>
  )
}
