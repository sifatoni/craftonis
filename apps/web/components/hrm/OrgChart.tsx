'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2, GitBranch } from 'lucide-react'
import { api } from '@/lib/axios'

interface OrgNode {
  id: string
  firstName: string
  lastName: string
  designation: string | null
  department: { name: string } | null
  reportees: OrgNode[]
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

// A single org chart node card
function NodeCard({ node, isRoot }: { node: OrgNode; isRoot?: boolean }) {
  return (
    <div
      style={{
        background: isRoot ? '#1A0000' : '#111111',
        border: `1px solid ${isRoot ? '#A50000' : '#2E2E2E'}`,
        borderRadius: '12px',
        padding: '12px',
        textAlign: 'center',
        minWidth: '140px',
        maxWidth: '160px',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#A50000',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontWeight: 700,
          margin: '0 auto 8px',
          flexShrink: 0,
        }}
      >
        {getInitials(node.firstName, node.lastName)}
      </div>

      <p
        style={{
          color: '#FFFFFF',
          fontSize: '12px',
          fontWeight: 600,
          lineHeight: 1.3,
          marginBottom: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {node.firstName} {node.lastName}
      </p>

      {node.designation && (
        <p
          style={{
            color: '#A0A0A0',
            fontSize: '11px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginBottom: node.department ? 4 : 0,
          }}
        >
          {node.designation}
        </p>
      )}

      {node.department && (
        <span
          style={{
            display: 'inline-block',
            background: '#1A0000',
            color: '#A50000',
            fontSize: '10px',
            padding: '2px 8px',
            borderRadius: '999px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
          }}
        >
          {node.department.name}
        </span>
      )}
    </div>
  )
}

// Recursive tree branch: node card + children below
function OrgBranch({ node, isRoot }: { node: OrgNode; isRoot?: boolean }) {
  const children = node.reportees ?? []
  const hasChildren = children.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <NodeCard node={node} isRoot={isRoot} />

      {hasChildren && (
        <>
          {/* Vertical stem down from this node */}
          <div style={{ width: 1, height: 20, background: '#2E2E2E' }} />

          {/* Children container with horizontal connector bar */}
          <div style={{ position: 'relative' }}>
            {/* Horizontal bar spanning top of children row */}
            {children.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 1,
                  background: '#2E2E2E',
                }}
              />
            )}

            {/* Children row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
              {children.map((child) => (
                <div
                  key={child.id}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 16px' }}
                >
                  {/* Vertical connector from horizontal bar down to child */}
                  <div style={{ width: 1, height: 20, background: '#2E2E2E' }} />
                  <OrgBranch node={child} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function OrgChart() {
  const { data: orgData, isLoading } = useQuery<OrgNode[]>({
    queryKey: ['hrm-org-chart'],
    queryFn: () => api.get('/hrm/org-chart').then((r) => r.data),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: '#A50000' }} />
      </div>
    )
  }

  if (!orgData || orgData.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-20 rounded-xl"
        style={{ background: '#111111', border: '1px solid #2E2E2E' }}
      >
        <GitBranch size={48} style={{ color: '#2E2E2E' }} />
        <p className="text-base font-medium mt-4" style={{ color: '#A0A0A0' }}>
          No org chart data
        </p>
        <p className="text-sm mt-1" style={{ color: '#606060' }}>
          Add employees and set reporting lines to see the org chart
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl p-6 overflow-auto"
      style={{ background: '#111111', border: '1px solid #2E2E2E' }}
    >
      {/* Scrollable org chart container */}
      <div
        style={{
          display: 'flex',
          gap: '48px',
          justifyContent: 'center',
          minWidth: 'max-content',
          paddingBottom: '8px',
        }}
      >
        {orgData.map((root) => (
          <OrgBranch key={root.id} node={root} isRoot />
        ))}
      </div>
    </div>
  )
}
