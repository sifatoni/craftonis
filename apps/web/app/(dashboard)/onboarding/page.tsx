'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/axios';
import { Plus, Users, Calendar, CheckCircle, Clock, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

export default function OnboardingDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    candidateId: '',
    jobId: '',
    title: '',
    durationDays: 30,
    startDate: '',
    notes: '',
  });

  const prefillCandidateId = searchParams.get('candidateId');
  const prefillJobId = searchParams.get('jobId');
  const prefillName = searchParams.get('name');

  useEffect(() => {
    fetchPlans();
    fetchCandidates();
  }, []);

  useEffect(() => {
    if (prefillCandidateId && prefillName) {
      setFormData(prev => ({
        ...prev,
        candidateId: prefillCandidateId,
        jobId: prefillJobId || '',
        title: `Onboarding Plan — ${prefillName}`,
      }));
      setIsModalOpen(true);
    }
  }, [prefillCandidateId, prefillJobId, prefillName]);

  const fetchPlans = async () => {
    try {
      const { data } = await api.get('/onboarding');
      setPlans(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load onboarding plans');
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidates = async () => {
    try {
      // 1. Fetch all jobs
      const { data: jobs } = await api.get('/jobs');
      
      // 2. For each job, fetch candidates
      const allHiredCandidates: any[] = [];
      
      await Promise.all((jobs || []).map(async (job: any) => {
        try {
          const { data: jobCandidates } = await api.get(`/jobs/${job.id}/candidates`);
          // 3. Filter where stage === 'HIRED'
          const hired = (jobCandidates || [])
            .filter((c: any) => c.stage === 'HIRED')
            .map((c: any) => ({
              ...c,
              jobTitle: job.title
            }));
          allHiredCandidates.push(...hired);
        } catch (e) {
          console.error(`Failed to fetch candidates for job ${job.id}`, e);
        }
      }));

      setCandidates(allHiredCandidates);
    } catch (err) {
      console.error('Failed to fetch candidates', err);
      // Fallback to debug if everything fails
      try {
        const { data } = await api.get('/debug/candidates');
        setCandidates((data.candidates || []).filter((c: any) => c.stage === 'HIRED'));
      } catch (e) {}
    }
  };

  const handleCreate = async (generateAI: boolean) => {
    if (!formData.candidateId) return toast.error('Please select a candidate');
    try {
      const { data } = await api.post('/onboarding', formData);
      if (generateAI) {
        toast.loading('Generating AI plan...', { id: 'ai-gen' });
        await api.post(`/onboarding/${data.id}/generate`, { durationDays: formData.durationDays });
        toast.success('AI Plan generated!', { id: 'ai-gen' });
      } else {
        toast.success('Plan created');
      }
      router.push(`/onboarding/${data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create plan');
      toast.dismiss('ai-gen');
    }
  };

  const filteredPlans = plans.filter(p => filter === 'ALL' || p.status === filter);

  const stats = {
    total: plans.length,
    active: plans.filter(p => p.status === 'ACTIVE').length,
    completed: plans.filter(p => p.status === 'COMPLETED').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-syne)' }}>AI Onboarding</h1>
          <p className="text-gray-400">Manage and auto-generate onboarding plans for new hires.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-crimson-600 hover:bg-crimson-700 text-white border-none shadow-[0_0_15px_rgba(220,20,60,0.3)]">
          <Plus className="w-4 h-4 mr-2" />
          New Plan
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-blue-500/20 rounded-lg"><Users className="w-6 h-6 text-blue-400" /></div>
          <div><p className="text-sm text-gray-400">Total Plans</p><p className="text-2xl font-bold text-white">{stats.total}</p></div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-teal-500/20 rounded-lg"><Clock className="w-6 h-6 text-teal-400" /></div>
          <div><p className="text-sm text-gray-400">Active</p><p className="text-2xl font-bold text-white">{stats.active}</p></div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center space-x-4">
          <div className="p-3 bg-green-500/20 rounded-lg"><CheckCircle className="w-6 h-6 text-green-400" /></div>
          <div><p className="text-sm text-gray-400">Completed</p><p className="text-2xl font-bold text-white">{stats.completed}</p></div>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-white/10 pb-2">
        {['ALL', 'DRAFT', 'ACTIVE', 'COMPLETED'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading plans...</div>
      ) : filteredPlans.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-xl bg-white/5">
          <p className="text-gray-400 mb-4">No onboarding plans found.</p>
          <Button onClick={() => setIsModalOpen(true)} variant="outline" className="border-white/20 hover:bg-white/10 text-white">Create First Plan</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlans.map(plan => {
            const completedTasks = plan.weeks?.flatMap((w: any) => w.tasks).filter((t: any) => t.completed).length || 0;
            const totalTasks = plan.weeks?.flatMap((w: any) => w.tasks).length || 0;
            const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            return (
              <div key={plan.id} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all flex flex-col group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-white text-lg">{plan.candidate?.name || 'Unknown Candidate'}</h3>
                    <p className="text-sm text-gray-400">{plan.candidate?.job?.title || 'No Role'}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                    plan.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                    plan.status === 'ACTIVE' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {plan.status}
                  </span>
                </div>
                
                <div className="flex items-center space-x-4 text-sm text-gray-400 mb-4">
                  <div className="flex items-center"><Calendar className="w-4 h-4 mr-1" /> {plan.durationDays} Days</div>
                  {plan.aiGenerated && <span className="bg-indigo-500/20 text-indigo-300 px-2 rounded text-xs">AI Generated</span>}
                </div>

                <div className="mt-auto">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Progress</span>
                    <span className="text-white">{progress}%</span>
                  </div>
                  <div className="h-2 bg-black/50 rounded-full overflow-hidden mb-4">
                    <div className="h-full bg-crimson-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button onClick={() => router.push(`/onboarding/${plan.id}`)} className="flex-1 bg-white/10 hover:bg-white/20 text-white border-none">
                      View Plan
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[#1e1e1e] border border-white/10 rounded-xl w-full max-w-lg shadow-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Create Onboarding Plan</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Candidate</label>
                <div className="relative">
                  <select 
                    className="appearance-none w-full bg-black/50 border border-white/10 rounded-lg pl-3 pr-10 py-2.5 text-white focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500 outline-none"
                    value={formData.candidateId}
                    onChange={e => {
                      const c = candidates.find(c => c.id === e.target.value);
                      setFormData({ ...formData, candidateId: e.target.value, jobId: c?.jobId || '', title: c ? `Onboarding Plan — ${c.name}` : '' });
                    }}
                  >
                    <option value="">Select Candidate</option>
                    {candidates.map(c => (
                      <option key={c.id} value={c.id}>{c.name} — {c.jobTitle || 'No Title'}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Plan Title</label>
                <input 
                  type="text"
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-white focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500 outline-none"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. 30-Day Engineering Onboarding"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Duration (Days)</label>
                  <input 
                    type="number"
                    className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-white focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500 outline-none"
                    value={formData.durationDays}
                    onChange={e => setFormData({ ...formData, durationDays: parseInt(e.target.value) || 30 })}
                    min={7}
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-sm text-gray-400 mb-1">Start Date</label>
                  <input 
                    type="date"
                    style={{ colorScheme: 'dark' }}
                    className="w-full bg-black/50 border border-white/10 rounded-lg pl-2.5 pr-3 py-2.5 text-white focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500 outline-none"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notes (Optional)</label>
                <textarea 
                  className="w-full bg-black/50 border border-white/10 rounded-lg p-2.5 text-white focus:border-crimson-500 focus:ring-1 focus:ring-crimson-500 outline-none h-20 resize-none"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any specific goals or context..."
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-white/10">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">Cancel</Button>
              <Button onClick={() => handleCreate(false)} className="bg-white/10 hover:bg-white/20 text-white border-none">Create Draft</Button>
              <Button onClick={() => handleCreate(true)} className="bg-crimson-600 hover:bg-crimson-700 text-white border-none shadow-[0_0_15px_rgba(220,20,60,0.3)]">✨ Create & Generate AI</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
