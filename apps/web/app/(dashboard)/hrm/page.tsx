'use client'

import { useQuery } from '@tanstack/react-query'
import { Users, Building2, GitBranch, UserPlus, TrendingUp, Clock, CalendarDays } from 'lucide-react'
import { api } from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { EmployeeList } from '@/components/hrm/EmployeeList'
import { DepartmentList } from '@/components/hrm/DepartmentList'
import { OrgChart } from '@/components/hrm/OrgChart'
import { AttendanceView } from '@/components/hrm/AttendanceView'
import { LeaveView } from '@/components/hrm/LeaveView'
import { EmployeeModal } from '@/components/hrm/EmployeeModal'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type Tab = 'employees' | 'attendance' | 'leave' | 'departments' | 'org-chart'

function HRMPageContent() {
  const searchParams = useSearchParams()
  const [showAddEmployee, setShowAddEmployee] = useState(false)

  const activeTabParam = searchParams.get('tab')
  let activeTab: Tab = 'employees'
  if (activeTabParam === 'attendance') activeTab = 'attendance'
  else if (activeTabParam === 'leave') activeTab = 'leave'
  else if (activeTabParam === 'departments') activeTab = 'departments'
  else if (activeTabParam === 'org-chart' || activeTabParam === 'orgchart') activeTab = 'org-chart'

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['hrm-employees'],
    queryFn: () => api.get('/hrm/employees').then((r) => r.data),
  })

  const { data: departments = [] } = useQuery<any[]>({
    queryKey: ['hrm-departments'],
    queryFn: () => api.get('/hrm/departments').then((r) => r.data),
  })

  const totalPayroll = employees.reduce((sum: number, emp: any) => {
    return (
      sum +
      (emp.basicSalary || 0) +
      (emp.houseAllowance || 0) +
      (emp.transportAllowance || 0) +
      (emp.medicalAllowance || 0) +
      (emp.otherAllowance || 0)
    )
  }, 0)

  const now = new Date()
  const newThisMonth = employees.filter((emp: any) => {
    if (!emp.createdAt) return false
    const d = new Date(emp.createdAt)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const stats = [
    { label: 'Total Employees', value: String(employees.length), icon: Users },
    { label: 'New This Month', value: String(newThisMonth), icon: TrendingUp },
    { label: 'Total Payroll', value: `৳ ${totalPayroll.toLocaleString()}`, icon: UserPlus },
    { label: 'Total Departments', value: String(departments.length), icon: Building2 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}
          >
            Human Resources
          </h1>
          <p className="text-sm mt-1" style={{ color: '#A0A0A0' }}>
            Manage your team and organization
          </p>
        </div>
        {activeTab === 'employees' && (
          <Button
            onClick={() => setShowAddEmployee(true)}
            className="gap-2"
            style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
          >
            <UserPlus size={16} />
            Add Employee
          </Button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="rounded-xl p-4"
              style={{ background: '#111111', border: '1px solid #2E2E2E' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: '#1A0000' }}
                >
                  <Icon size={16} style={{ color: '#A50000' }} />
                </div>
                <div>
                  <p className="text-xs" style={{ color: '#A0A0A0' }}>
                    {stat.label}
                  </p>
                  <p
                    className="text-xl font-bold mt-0.5"
                    style={{ color: '#FFFFFF', fontFamily: 'var(--font-syne)' }}
                  >
                    {stat.value}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Content */}
      {activeTab === 'employees' && <EmployeeList />}
      {activeTab === 'attendance' && <AttendanceView />}
      {activeTab === 'leave' && <LeaveView />}
      {activeTab === 'departments' && <DepartmentList />}
      {activeTab === 'org-chart' && <OrgChart />}

      {/* Always mounted — open prop controls visibility */}
      <EmployeeModal
        open={showAddEmployee}
        onClose={() => setShowAddEmployee(false)}
      />
    </div>
  )
}

export default function HRMPage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center">
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#A50000', borderTopColor: 'transparent' }}
        />
      </div>
    }>
      <HRMPageContent />
    </Suspense>
  )
}
