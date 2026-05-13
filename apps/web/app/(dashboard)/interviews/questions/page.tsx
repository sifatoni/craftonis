'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { api } from '@/lib/axios'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, Pencil, Trash2, Check, X,
  ChevronUp, ChevronDown, Calendar, MessageSquare, Code2,
  BookOpen, GripVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ── Types ─────────────────────────────────────────────────
type InterviewType = 'GENERAL' | 'BEHAVIORAL' | 'TECHNICAL'

interface Question {
  id: string
  type: InterviewType
  text: string
  category: string | null
  order: number
  isCustom: boolean
}

// ── Seed hints shown when bank is empty ───────────────────
const SEED_HINTS: Record<InterviewType, { text: string; category: string }[]> = {
  GENERAL: [
    { text: 'Tell me about yourself', category: 'Introduction' },
    { text: 'Why are you interested in this role?', category: 'Motivation' },
    { text: 'What are your strengths and weaknesses?', category: 'Self-Assessment' },
    { text: 'Where do you see yourself in 5 years?', category: 'Career Goals' },
    { text: 'Do you have any questions for us?', category: 'Wrap-up' },
  ],
  BEHAVIORAL: [
    { text: 'Tell me about a time you handled conflict at work', category: 'Communication' },
    { text: 'Describe a challenging project and how you managed it', category: 'Problem Solving' },
    { text: 'Give an example of when you showed leadership', category: 'Leadership' },
    { text: 'How do you prioritize tasks under pressure?', category: 'Time Management' },
    { text: 'Tell me about a failure and what you learned', category: 'Growth' },
  ],
  TECHNICAL: [
    { text: 'Explain your technical stack experience', category: 'Experience' },
    { text: 'How do you approach debugging a complex issue?', category: 'Problem Solving' },
    { text: 'Describe your code review process', category: 'Process' },
    { text: 'How do you stay updated with new technologies?', category: 'Learning' },
    { text: 'Walk me through a technical project you are proud of', category: 'Portfolio' },
  ],
}

const TAB_CONFIG: { type: InterviewType; label: string; icon: React.ElementType; color: string }[] = [
  { type: 'GENERAL', label: 'General', icon: Calendar, color: '#D97706' },
  { type: 'BEHAVIORAL', label: 'Behavioral', icon: MessageSquare, color: '#0284C7' },
  { type: 'TECHNICAL', label: 'Technical', icon: Code2, color: '#5521B5' },
]

// ── Hooks ─────────────────────────────────────────────────
function useQuestions(type: InterviewType) {
  return useQuery<Question[]>({
    queryKey: ['questions', type],
    queryFn: () => api.get(`/questions?type=${type}`).then(r => r.data),
  })
}

// ── Question Row ──────────────────────────────────────────
function QuestionRow({
  question,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: {
  question: Question
  index: number
  total: number
  onMoveUp: () => void
  onMoveDown: () => void
  onEdit: (q: Question) => void
  onDelete: (id: string) => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border group"
      style={{ background: '#111111', borderColor: '#1A1A1A' }}
    >
      {/* Order number */}
      <span className="w-6 text-xs font-mono flex-shrink-0 text-right" style={{ color: '#3D3D3D' }}>
        {index + 1}
      </span>

      {/* Question text */}
      <p className="flex-1 text-sm" style={{ color: '#FFFFFF' }}>{question.text}</p>

      {/* Category badge */}
      {question.category && (
        <span
          className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap"
          style={{ background: '#1A1A1A', color: '#A0A0A0', border: '1px solid #2E2E2E' }}
        >
          {question.category}
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-1.5 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed"
          style={{ color: '#606060' }}
          title="Move up"
        >
          <ChevronUp size={13} />
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="p-1.5 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed"
          style={{ color: '#606060' }}
          title="Move down"
        >
          <ChevronDown size={13} />
        </button>
        <button
          onClick={() => onEdit(question)}
          className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: '#A0A0A0' }}
          title="Edit"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => onDelete(question.id)}
          className="p-1.5 rounded-lg transition-colors hover:bg-red-950"
          style={{ color: '#606060' }}
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </motion.div>
  )
}

// ── Inline Form (Add / Edit) ───────────────────────────────
function InlineForm({
  initialText = '',
  initialCategory = '',
  onSave,
  onCancel,
  saving,
}: {
  initialText?: string
  initialCategory?: string
  onSave: (text: string, category: string) => void
  onCancel: () => void
  saving: boolean
}) {
  const [text, setText] = useState(initialText)
  const [category, setCategory] = useState(initialCategory)

  return (
    <div
      className="flex items-center gap-2 px-4 py-3 rounded-xl border"
      style={{ background: '#0A0A0A', borderColor: '#A50000' }}
    >
      <input
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && text.trim()) onSave(text.trim(), category.trim())
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="Question text..."
        className="flex-1 bg-transparent text-sm outline-none"
        style={{ color: '#FFFFFF' }}
      />
      <input
        value={category}
        onChange={e => setCategory(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && text.trim()) onSave(text.trim(), category.trim())
          if (e.key === 'Escape') onCancel()
        }}
        placeholder="Category (optional)"
        className="w-36 bg-transparent text-sm outline-none border-l pl-2 flex-shrink-0"
        style={{ color: '#A0A0A0', borderColor: '#2E2E2E' }}
      />
      <button
        onClick={() => { if (text.trim()) onSave(text.trim(), category.trim()) }}
        disabled={!text.trim() || saving}
        className="p-1.5 rounded-lg transition-colors hover:bg-white/5 disabled:opacity-40"
        style={{ color: '#16A34A' }}
        title="Save"
      >
        <Check size={14} />
      </button>
      <button
        onClick={onCancel}
        className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
        style={{ color: '#606060' }}
        title="Cancel"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ── Tab Panel ─────────────────────────────────────────────
function TabPanel({ type, color }: { type: InterviewType; color: string }) {
  const qc = useQueryClient()
  const { data: questions = [], isLoading } = useQuestions(type)
  const [addingNew, setAddingNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['questions', type] })

  const createMutation = useMutation({
    mutationFn: (data: { text: string; category?: string }) =>
      api.post('/questions', { type, ...data }).then(r => r.data),
    onSuccess: () => { invalidate(); setAddingNew(false); toast.success('Question added') },
    onError: () => toast.error('Failed to add question'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, text, category }: { id: string; text: string; category?: string }) =>
      api.put(`/questions/${id}`, { text, category }).then(r => r.data),
    onSuccess: () => { invalidate(); setEditingId(null); toast.success('Question updated') },
    onError: () => toast.error('Failed to update question'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/questions/${id}`).then(r => r.data),
    onSuccess: () => { invalidate(); toast.success('Question removed') },
    onError: () => toast.error('Failed to remove question'),
  })

  const reorderMutation = useMutation({
    mutationFn: (updates: { id: string; order: number }[]) =>
      api.post('/questions/reorder', { updates }).then(r => r.data),
    onSuccess: invalidate,
  })

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= questions.length) return

    const reordered = [...questions]
    ;[reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]]

    reorderMutation.mutate(
      reordered.map((q, i) => ({ id: q.id, order: i }))
    )
  }

  const isEmpty = !isLoading && questions.length === 0

  return (
    <div className="space-y-2">
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: color, borderTopColor: 'transparent' }} />
        </div>
      ) : isEmpty ? (
        /* Empty state — seed hints */
        <div className="rounded-xl border p-5 space-y-3" style={{ background: '#0A0A0A', borderColor: '#1A1A1A' }}>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={14} style={{ color: '#606060' }} />
            <p className="text-xs" style={{ color: '#606060' }}>
              No questions yet. These are suggested starters — click <strong style={{ color: color }}>+ Add Question</strong> to save your own.
            </p>
          </div>
          {SEED_HINTS[type].map((hint, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg border"
              style={{ background: '#111111', borderColor: '#1A1A1A', borderStyle: 'dashed' }}
            >
              <span className="w-6 text-xs font-mono text-right flex-shrink-0" style={{ color: '#2E2E2E' }}>{i + 1}</span>
              <p className="flex-1 text-sm" style={{ color: '#3D3D3D' }}>{hint.text}</p>
              <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: '#1A1A1A', color: '#2E2E2E' }}>
                {hint.category}
              </span>
            </div>
          ))}
        </div>
      ) : (
        /* Question list */
        <AnimatePresence initial={false}>
          {questions.map((q, i) =>
            editingId === q.id ? (
              <motion.div key={q.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <InlineForm
                  initialText={q.text}
                  initialCategory={q.category ?? ''}
                  saving={updateMutation.isPending}
                  onSave={(text, category) =>
                    updateMutation.mutate({ id: q.id, text, category: category || undefined })
                  }
                  onCancel={() => setEditingId(null)}
                />
              </motion.div>
            ) : (
              <QuestionRow
                key={q.id}
                question={q}
                index={i}
                total={questions.length}
                onMoveUp={() => handleMove(i, 'up')}
                onMoveDown={() => handleMove(i, 'down')}
                onEdit={q => setEditingId(q.id)}
                onDelete={id => deleteMutation.mutate(id)}
              />
            )
          )}
        </AnimatePresence>
      )}

      {/* Add new — inline form or button */}
      {addingNew ? (
        <InlineForm
          saving={createMutation.isPending}
          onSave={(text, category) =>
            createMutation.mutate({ text, category: category || undefined })
          }
          onCancel={() => setAddingNew(false)}
        />
      ) : (
        <button
          onClick={() => { setEditingId(null); setAddingNew(true) }}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed text-sm transition-colors hover:border-[#A50000] hover:text-white"
          style={{ borderColor: '#2E2E2E', color: '#606060', background: 'transparent' }}
        >
          <Plus size={14} />
          Add Question
        </button>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────
export default function QuestionBankPage() {
  const [activeTab, setActiveTab] = useState<InterviewType>('GENERAL')
  const active = TAB_CONFIG.find(t => t.type === activeTab)!

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/interviews"
            className="flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
            style={{ color: '#606060' }}
          >
            <ArrowLeft size={13} />
            Back to Interviews
          </Link>
          <div className="w-px h-4" style={{ background: '#2E2E2E' }} />
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}>
              Question Bank
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#606060' }}>
              Manage interview questions by type — applied to all sessions
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex rounded-xl p-1 gap-1"
        style={{ background: '#111111', border: '1px solid #1A1A1A' }}
      >
        {TAB_CONFIG.map(tab => {
          const isActive = activeTab === tab.type
          return (
            <button
              key={tab.type}
              onClick={() => setActiveTab(tab.type)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: isActive ? `${tab.color}15` : 'transparent',
                color: isActive ? tab.color : '#606060',
                border: isActive ? `1px solid ${tab.color}30` : '1px solid transparent',
              }}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Active tab content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        <TabPanel type={activeTab} color={active.color} />
      </motion.div>
    </div>
  )
}
