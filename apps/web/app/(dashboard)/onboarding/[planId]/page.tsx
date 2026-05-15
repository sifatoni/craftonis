'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2, Edit2, Check, X, FileUp, Download, Plus, Bot, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORY_COLORS: Record<string, string> = {
  DOCUMENTATION: 'bg-blue-900 text-blue-300',
  TRAINING: 'bg-purple-900 text-purple-300',
  MEETING: 'bg-orange-900 text-orange-300',
  SETUP: 'bg-teal-900 text-teal-300',
  GOAL: 'bg-green-900 text-green-300',
};

export default function OnboardingPlanDetail({ params }: { params: { planId: string } }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editTaskData, setEditTaskData] = useState<any>({});
  
  const [addingTaskToWeek, setAddingTaskToWeek] = useState<string | null>(null);
  const [newTaskData, setNewTaskData] = useState<any>({ title: '', category: 'DOCUMENTATION', dueDay: 1 });

  const [editingWeek, setEditingWeek] = useState<string | null>(null);
  const [editWeekData, setEditWeekData] = useState<any>({});

  const fetchPlan = useCallback(async () => {
    try {
      const { data } = await api.get(`/onboarding/${params.planId}`);
      setPlan(data);
    } catch (err) {
      toast.error('Failed to load plan');
      router.push('/onboarding');
    } finally {
      setLoading(false);
    }
  }, [params.planId, router]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  if (loading || !plan) return <div className="p-8 text-center text-gray-400">Loading plan details...</div>;

  const totalTasks = plan.weeks?.flatMap((w: any) => w.tasks).length || 0;
  const completedTasks = plan.weeks?.flatMap((w: any) => w.tasks).filter((t: any) => t.completed).length || 0;
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleStatusChange = async (status: string) => {
    try {
      await api.put(`/onboarding/${plan.id}`, { status });
      setPlan({ ...plan, status });
      toast.success('Status updated');
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleUpdateDuration = async (newDuration: number) => {
    try {
      const { data } = await api.put(`/onboarding/${plan.id}`, { durationDays: newDuration });
      setPlan(data);
      toast.success('Duration updated');
    } catch (err) {
      toast.error('Failed to update duration');
    }
  };

  const handleDeletePlan = async () => {
    if (!confirm('Are you sure you want to delete this plan?')) return;
    try {
      await api.delete(`/onboarding/${plan.id}`);
      toast.success('Plan deleted');
      router.push('/onboarding');
    } catch (err) {
      toast.error('Failed to delete plan');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 10 * 1024 * 1024) {
      return toast.error('File too large (max 10MB)');
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      toast.loading('Uploading document...', { id: 'upload' });
      await api.post(`/onboarding/${plan.id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Document uploaded', { id: 'upload' });
      fetchPlan();
    } catch (err) {
      toast.error('Failed to upload document', { id: 'upload' });
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      await api.delete(`/onboarding/documents/${docId}`);
      setPlan({ ...plan, documents: plan.documents.filter((d: any) => d.id !== docId) });
      toast.success('Document deleted');
    } catch (err) {
      toast.error('Failed to delete document');
    }
  };

  const handleGenerateAI = async () => {
    setIsAiModalOpen(false);
    setAiLoading(true);
    const toastId = toast.loading('🤖 Generating personalized onboarding plan...');
    try {
      await api.post(`/onboarding/${plan.id}/generate`, { durationDays: plan.durationDays });
      toast.success('AI plan generated!', { id: toastId });
      fetchPlan();
    } catch (err) {
      toast.error('Failed to generate AI plan', { id: toastId });
    } finally {
      setAiLoading(false);
    }
  };

  const toggleTask = async (taskId: string, current: boolean) => {
    try {
      await api.put(`/onboarding/tasks/${taskId}`, { completed: !current });
      fetchPlan();
    } catch (err) {
      toast.error('Failed to update task');
    }
  };

  const saveTaskEdit = async (taskId: string) => {
    try {
      await api.put(`/onboarding/tasks/${taskId}`, editTaskData);
      setEditingTask(null);
      fetchPlan();
    } catch (err) {
      toast.error('Failed to save task');
    }
  };

  const saveNewTask = async (weekId: string) => {
    if (!newTaskData.title) return;
    try {
      await api.post(`/onboarding/weeks/${weekId}/tasks`, newTaskData);
      setAddingTaskToWeek(null);
      setNewTaskData({ title: '', category: 'DOCUMENTATION', dueDay: 1 });
      fetchPlan();
    } catch (err) {
      toast.error('Failed to add task');
    }
  };

  const saveWeekEdit = async (weekId: string) => {
    try {
      await api.put(`/onboarding/weeks/${weekId}`, editWeekData);
      setEditingWeek(null);
      fetchPlan();
    } catch (err) {
      toast.error('Failed to update week');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => router.push('/onboarding')} className="p-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">{plan.candidate?.name || 'Unknown Candidate'}</h1>
            <p className="text-gray-400">{plan.candidate?.job?.title || 'No Role Assigned'}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <select 
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/20"
            value={plan.status}
            onChange={e => handleStatusChange(e.target.value)}
          >
            <option value="DRAFT">DRAFT</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
          
          <Button onClick={() => window.print()} variant="outline" className="border-white/20 hover:bg-white/10 text-white">
            <Download className="w-4 h-4 mr-2" /> Export PDF
          </Button>
          
          <Button onClick={() => setIsAiModalOpen(true)} className="bg-crimson-600 hover:bg-crimson-700 text-white border-none shadow-[0_0_15px_rgba(220,20,60,0.3)]">
            <Bot className="w-4 h-4 mr-2" /> ✨ Generate with AI
          </Button>

          <Button variant="ghost" onClick={handleDeletePlan} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Progress & Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex justify-between items-end mb-2">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Overall Progress</h3>
              <p className="text-sm text-gray-400">{completedTasks} of {totalTasks} tasks completed</p>
            </div>
            <span className="text-3xl font-bold text-white">{progress}%</span>
          </div>
          <div className="h-3 bg-black/50 rounded-full overflow-hidden">
            <div className="h-full bg-crimson-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Duration</label>
            <div className="flex items-center space-x-2">
              <input 
                type="number" 
                value={plan.durationDays} 
                onChange={e => setPlan({ ...plan, durationDays: parseInt(e.target.value) || 30 })}
                onBlur={() => handleUpdateDuration(plan.durationDays)}
                className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white w-20 text-sm focus:border-crimson-500 outline-none"
              />
              <span className="text-sm text-gray-300">Days</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Start Date</label>
            <input 
              type="date" 
              value={plan.startDate ? plan.startDate.split('T')[0] : ''}
              onChange={e => {
                const updated = { ...plan, startDate: e.target.value ? new Date(e.target.value).toISOString() : null };
                setPlan(updated);
                api.put(`/onboarding/${plan.id}`, { startDate: e.target.value });
              }}
              className="bg-black/50 border border-white/10 rounded px-2 py-1 text-white text-sm w-full focus:border-crimson-500 outline-none style-color-scheme-dark"
            />
          </div>
        </div>
      </div>

      {/* Document Context */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-white">Context Documents</h3>
            <p className="text-xs text-gray-400">Uploaded documents will be used as AI context</p>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.docx,.xlsx,.csv,.txt" />
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" className="border-white/20 hover:bg-white/10 text-white text-xs">
            <FileUp className="w-3 h-3 mr-2" /> Upload
          </Button>
        </div>
        {plan.documents?.length > 0 && (
          <div className="divide-y divide-white/5">
            {plan.documents.map((doc: any) => (
              <div key={doc.id} className="p-3 flex justify-between items-center hover:bg-white/5">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center mr-3">
                    <FileUp className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white">{doc.fileName}</p>
                    <p className="text-xs text-gray-500">{(doc.fileSize / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteDocument(doc.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plan Content */}
      <div id="plan-content" className="space-y-6">
        {plan.weeks?.map((week: any) => {
          const weekCompleted = week.tasks?.filter((t: any) => t.completed).length || 0;
          const weekTotal = week.tasks?.length || 0;
          const weekProgress = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;

          return (
            <div key={week.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/10 bg-white/5 flex flex-col group">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    {editingWeek === week.id ? (
                      <input 
                        className="bg-black/50 border border-white/20 rounded px-2 py-1 text-white font-semibold text-lg w-full mb-1 focus:border-crimson-500 outline-none"
                        value={editWeekData.title}
                        onChange={e => setEditWeekData({ ...editWeekData, title: e.target.value })}
                        onBlur={() => saveWeekEdit(week.id)}
                        onKeyDown={e => e.key === 'Enter' && saveWeekEdit(week.id)}
                        autoFocus
                      />
                    ) : (
                      <h3 
                        className="text-lg font-semibold text-white hover:text-crimson-400 cursor-pointer flex items-center"
                        onClick={() => { setEditingWeek(week.id); setEditWeekData({ title: week.title, description: week.description }); }}
                      >
                        {week.title} <Edit2 className="w-3 h-3 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h3>
                    )}
                    
                    {editingWeek === week.id ? (
                      <input 
                        className="bg-black/50 border border-white/20 rounded px-2 py-1 text-gray-300 text-sm w-full focus:border-crimson-500 outline-none"
                        value={editWeekData.description || ''}
                        onChange={e => setEditWeekData({ ...editWeekData, description: e.target.value })}
                        onBlur={() => saveWeekEdit(week.id)}
                        onKeyDown={e => e.key === 'Enter' && saveWeekEdit(week.id)}
                        placeholder="Week focus..."
                      />
                    ) : (
                      <p 
                        className="text-sm text-gray-400 cursor-pointer hover:text-gray-300"
                        onClick={() => { setEditingWeek(week.id); setEditWeekData({ title: week.title, description: week.description }); }}
                      >
                        {week.description || 'No description provided'}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <span className="text-xs font-medium text-gray-400">{weekProgress}%</span>
                    <div className="w-24 h-1.5 bg-black/50 rounded-full mt-1">
                      <div className="h-full bg-crimson-500 transition-all" style={{ width: `${weekProgress}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-white/5">
                {week.tasks?.map((task: any) => (
                  <div key={task.id} className="p-4 hover:bg-white/5 transition-colors group flex items-start gap-4">
                    <button 
                      onClick={() => toggleTask(task.id, task.completed)}
                      className={`mt-1 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${task.completed ? 'bg-crimson-500 border-crimson-500' : 'border-gray-500 hover:border-crimson-400'}`}
                    >
                      {task.completed && <Check className="w-3 h-3 text-white" />}
                    </button>
                    
                    {editingTask === task.id ? (
                      <div className="flex-1 space-y-2">
                        <input className="w-full bg-black/50 border border-white/20 rounded px-2 py-1 text-white" value={editTaskData.title} onChange={e => setEditTaskData({...editTaskData, title: e.target.value})} />
                        <div className="flex gap-2">
                          <select className="bg-black/50 border border-white/20 rounded px-2 py-1 text-xs text-white" value={editTaskData.category} onChange={e => setEditTaskData({...editTaskData, category: e.target.value})}>
                            {Object.keys(CATEGORY_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <input type="number" className="bg-black/50 border border-white/20 rounded px-2 py-1 text-xs text-white w-20" placeholder="Due Day" value={editTaskData.dueDay || ''} onChange={e => setEditTaskData({...editTaskData, dueDay: parseInt(e.target.value)})} />
                          <input className="bg-black/50 border border-white/20 rounded px-2 py-1 text-xs text-white flex-1" placeholder="Assignee" value={editTaskData.assignee || ''} onChange={e => setEditTaskData({...editTaskData, assignee: e.target.value})} />
                        </div>
                        <div className="flex justify-end space-x-2 mt-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditingTask(null)}>Cancel</Button>
                          <Button size="sm" onClick={() => saveTaskEdit(task.id)} className="bg-crimson-600 hover:bg-crimson-700 text-white">Save</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className={`text-sm font-medium ${task.completed ? 'text-gray-500 line-through' : 'text-white'}`}>{task.title}</p>
                            {task.description && <p className="text-xs text-gray-400 mt-1">{task.description}</p>}
                            <div className="flex items-center gap-2 mt-2">
                              {task.category && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[task.category] || 'bg-gray-800 text-gray-300'}`}>
                                  {task.category}
                                </span>
                              )}
                              {task.dueDay && <span className="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded flex items-center"><Clock className="w-3 h-3 mr-1" /> Day {task.dueDay}</span>}
                              {task.assignee && <span className="text-[10px] text-gray-400 bg-white/5 px-1.5 py-0.5 rounded flex items-center"><Users className="w-3 h-3 mr-1" /> {task.assignee}</span>}
                            </div>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                            <Button variant="ghost" size="sm" onClick={() => { setEditingTask(task.id); setEditTaskData(task); }} className="h-7 w-7 p-0 text-gray-400 hover:text-white">
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => api.delete(`/onboarding/tasks/${task.id}`).then(fetchPlan)} className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Task Form */}
              <div className="p-3 bg-black/20 border-t border-white/5">
                {addingTaskToWeek === week.id ? (
                  <div className="space-y-2 p-2 border border-white/10 rounded bg-white/5">
                    <input className="w-full bg-black/50 border border-white/20 rounded px-2 py-1 text-sm text-white focus:border-crimson-500 outline-none" placeholder="Task title..." value={newTaskData.title} onChange={e => setNewTaskData({...newTaskData, title: e.target.value})} autoFocus />
                    <div className="flex gap-2">
                      <select className="bg-black/50 border border-white/20 rounded px-2 py-1 text-xs text-white" value={newTaskData.category} onChange={e => setNewTaskData({...newTaskData, category: e.target.value})}>
                        {Object.keys(CATEGORY_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input type="number" className="bg-black/50 border border-white/20 rounded px-2 py-1 text-xs text-white w-20" placeholder="Due Day" value={newTaskData.dueDay} onChange={e => setNewTaskData({...newTaskData, dueDay: parseInt(e.target.value)})} />
                      <input className="bg-black/50 border border-white/20 rounded px-2 py-1 text-xs text-white flex-1" placeholder="Assignee (e.g. HR, IT)" value={newTaskData.assignee || ''} onChange={e => setNewTaskData({...newTaskData, assignee: e.target.value})} />
                    </div>
                    <div className="flex justify-end space-x-2 pt-1">
                      <Button size="sm" variant="ghost" onClick={() => setAddingTaskToWeek(null)} className="h-7 text-xs">Cancel</Button>
                      <Button size="sm" onClick={() => saveNewTask(week.id)} className="h-7 text-xs bg-crimson-600 hover:bg-crimson-700 text-white border-none">Add</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setAddingTaskToWeek(week.id)} className="w-full text-gray-400 hover:text-white border border-dashed border-white/10 hover:border-white/20">
                    <Plus className="w-4 h-4 mr-2" /> Add Task to {week.title}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[#1e1e1e] border border-white/10 rounded-xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center"><Bot className="w-5 h-5 mr-2 text-crimson-400" /> Generate AI Plan</h2>
            <p className="text-sm text-gray-400 mb-6">
              This will use the candidate&apos;s CV, interview assessment, and uploaded documents to create a personalized {plan.durationDays}-day plan. 
              <span className="text-red-400 block mt-2 font-medium">Warning: This will replace all existing tasks in this plan.</span>
            </p>
            
            {plan.documents?.length > 0 && (
              <div className="mb-6">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Context Documents</p>
                <div className="space-y-1">
                  {plan.documents.map((d: any) => (
                    <div key={d.id} className="text-sm text-gray-300 bg-white/5 rounded px-2 py-1 flex items-center">
                      <FileUp className="w-3 h-3 mr-2 text-blue-400" /> {d.fileName}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-4">
              <Button variant="ghost" onClick={() => setIsAiModalOpen(false)} disabled={aiLoading} className="text-gray-400 hover:text-white">Cancel</Button>
              <Button onClick={handleGenerateAI} disabled={aiLoading} className="bg-crimson-600 hover:bg-crimson-700 text-white border-none">
                {aiLoading ? 'Generating...' : 'Confirm Generation'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
