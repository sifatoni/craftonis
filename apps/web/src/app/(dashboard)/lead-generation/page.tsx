'use client';

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const SOCKET_URL = NEXT_PUBLIC_API_URL.replace('/api/v1', '') + '/leads';

export default function LeadGenerationPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [clientId, setClientId] = useState('');
  const [jobId, setJobId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [tokens, setTokens] = useState(0);

  // Form State
  const [designationInput, setDesignationInput] = useState('');
  const [designations, setDesignations] = useState<string[]>(['CEO']);
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('Bangladesh');
  const [area, setArea] = useState('');
  const [organization, setOrganization] = useState('');
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(3);

  // Results State
  const [leads, setLeads] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [captchaData, setCaptchaData] = useState<any>(null);

  // Filters
  const [platformFilter, setPlatformFilter] = useState('All');
  const [valueBandFilter, setValueBandFilter] = useState('All');
  const [stageFilter, setStageFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const logEndRef = useRef<HTMLDivElement>(null);

  // Load Initial Data
  useEffect(() => {
    const cid = uuidv4();
    setClientId(cid);
    fetchTokens();
    fetchLeads();

    const newSocket = io(SOCKET_URL, { transports: ['websocket'] });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join', { clientId: cid });
    });

    newSocket.on('leads:progress', (data: any) => {
      setLogs((prev) => [...prev, data].slice(-20));
    });

    newSocket.on('leads:data', (newLeads: any[]) => {
      setLeads((prev) => {
        const merged = [...newLeads, ...prev];
        // simple dedup by id or email
        const seen = new Set();
        return merged.filter((l) => {
          const k = l.id || l.email || l.name;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      });
    });

    newSocket.on('leads:complete', (summary: any) => {
      setIsSearching(false);
      setJobId('');
      toast.success(`Search complete! ${summary.total || 0} leads found.`);
    });

    newSocket.on('leads:error', (err: any) => {
      setIsSearching(false);
      setJobId('');
      toast.error(err.message || 'An error occurred during scraping');
    });

    newSocket.on('leads:captcha', (data: any) => {
      setCaptchaData(data);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const fetchTokens = async () => {
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/leads/tokens/balance`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTokens(data.balance);
      }
    } catch (err) {}
  };

  const fetchLeads = async () => {
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/leads`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {}
  };

  const handleStart = async () => {
    if (designations.length === 0) return toast.error('Add at least one designation');
    setIsSearching(true);
    setLogs([]);
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/leads/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          designations,
          industry,
          country,
          area,
          organization,
          startPage,
          endPage,
          clientId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setJobId(data.jobId);
      } else {
        throw new Error('Failed to start search');
      }
    } catch (err: any) {
      setIsSearching(false);
      toast.error(err.message);
    }
  };

  const handleStop = async () => {
    if (!jobId) return;
    try {
      await fetch(`${NEXT_PUBLIC_API_URL}/leads/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ jobId }),
      });
      setIsSearching(false);
      toast.info('Search stopped');
    } catch (err) {}
  };

  const handleAddDesignation = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && designationInput.trim()) {
      e.preventDefault();
      if (!designations.includes(designationInput.trim())) {
        setDesignations([...designations, designationInput.trim()]);
      }
      setDesignationInput('');
    }
  };

  const removeDesignation = (tag: string) => {
    setDesignations(designations.filter((d) => d !== tag));
  };

  const handleReveal = async (leadId: string) => {
    if (tokens < 1) return toast.error('Insufficient tokens');
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/leads/${leadId}/reveal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        const fullLead = await res.json();
        setLeads(leads.map(l => l.id === leadId ? fullLead : l));
        setTokens(prev => prev - 1);
        toast.success('Lead revealed');
      } else {
        toast.error('Failed to reveal lead');
      }
    } catch (err) {}
  };

  const handleBulkReveal = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (tokens < ids.length) return toast.error('Insufficient tokens');
    try {
      const res = await fetch(`${NEXT_PUBLIC_API_URL}/leads/bulk-reveal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ leadIds: ids }),
      });
      if (res.ok) {
        const { revealed } = await res.json();
        toast.success(`Revealed ${revealed} leads`);
        fetchTokens();
        fetchLeads();
        setSelectedIds(new Set());
      }
    } catch (err) {}
  };

  const updateStage = async (leadId: string, stage: string) => {
    try {
      await fetch(`${NEXT_PUBLIC_API_URL}/leads/${leadId}/stage`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ stage }),
      });
      setLeads(leads.map(l => l.id === leadId ? { ...l, crmStage: stage } : l));
      toast.success('Stage updated');
    } catch (err) {}
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    window.location.href = `${NEXT_PUBLIC_API_URL}/leads/export?format=${format}&token=${localStorage.getItem('token')}`;
  };

  const solveCaptcha = () => {
    if (socket && captchaData) {
      socket.emit('captcha:solved', { jobId: captchaData.jobId });
      setCaptchaData(null);
    }
  };

  const filteredLeads = leads.filter((l) => {
    if (platformFilter !== 'All' && l.platform !== platformFilter.toLowerCase()) return false;
    if (valueBandFilter !== 'All' && l.valueBand !== valueBandFilter) return false;
    if (stageFilter !== 'All' && l.crmStage !== stageFilter.toUpperCase()) return false;
    if (searchQuery && !l.name?.toLowerCase().includes(searchQuery.toLowerCase()) && !l.organization?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'linkedin': return <span className="text-blue-500 font-bold">in</span>;
      case 'instagram': return <span className="text-pink-500 font-bold">IG</span>;
      case 'facebook': return <span className="text-blue-600 font-bold">FB</span>;
      case 'maps': return <span className="text-red-500 font-bold">📍</span>;
      case 'yellowpages': return <span className="text-yellow-500 font-bold">YP</span>;
      default: return <span>🌐</span>;
    }
  };

  return (
    <div className="flex h-full bg-[#0d0d0d] text-white">
      {/* Sidebar */}
      <div className="w-80 border-r border-[#222] p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Lead Generation</h1>
          <span className="bg-gray-800 px-2 py-1 rounded text-xs">💎 {tokens}</span>
        </div>
        
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Designations (Enter to add)</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {designations.map(d => (
                <span key={d} className="bg-[#222] px-2 py-1 rounded text-xs flex items-center gap-1">
                  {d} <button onClick={() => removeDesignation(d)} className="hover:text-red-500">&times;</button>
                </span>
              ))}
            </div>
            <input
              className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="Type & press Enter"
              value={designationInput}
              onChange={e => setDesignationInput(e.target.value)}
              onKeyDown={handleAddDesignation}
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Industry</label>
            <input className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm" value={industry} onChange={e => setIndustry(e.target.value)} />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Country</label>
            <input className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm" value={country} onChange={e => setCountry(e.target.value)} />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Area / City</label>
            <input className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm" value={area} onChange={e => setArea(e.target.value)} />
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Organization</label>
            <input className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm" value={organization} onChange={e => setOrganization(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">From Page</label>
              <input type="number" className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm" value={startPage} onChange={e => setStartPage(Number(e.target.value))} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-400 mb-1 block">To Page</label>
              <input type="number" className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-sm" value={endPage} onChange={e => setEndPage(Number(e.target.value))} />
            </div>
          </div>

          {!isSearching ? (
            <button onClick={handleStart} className="w-full bg-crimson hover:bg-red-600 text-white font-semibold py-2 rounded mt-2 transition-colors">
              🔍 Find Leads
            </button>
          ) : (
            <button onClick={handleStop} className="w-full border border-red-500 text-red-500 hover:bg-red-500/10 font-semibold py-2 rounded mt-2 transition-colors">
              ⏹ Stop Search
            </button>
          )}
        </div>

        {isSearching && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-2">Live Progress</h3>
            <div className="bg-black/50 p-2 rounded h-40 overflow-y-auto font-mono text-[10px] text-green-400 flex flex-col gap-1">
              {logs.map((log, i) => (
                <div key={i}>{log.message}</div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Main Area */}
      <div className="flex-1 p-6 flex flex-col overflow-y-auto bg-[#0a0a0a]">
        
        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          {['Total Found', 'High Value', 'Medium', 'Low', 'Revealed'].map(stat => (
            <div key={stat} className="bg-[#111] border border-[#222] rounded-lg p-4 text-center">
              <div className="text-sm text-gray-400">{stat}</div>
              <div className="text-2xl font-bold">
                {stat === 'Total Found' ? leads.length :
                 stat === 'High Value' ? leads.filter(l => l.valueBand === 'High').length :
                 stat === 'Medium' ? leads.filter(l => l.valueBand === 'Medium').length :
                 stat === 'Low' ? leads.filter(l => l.valueBand === 'Low').length :
                 leads.filter(l => l.revealed).length}
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <input
            className="bg-[#111] border border-[#333] rounded px-4 py-2 text-sm w-64"
            placeholder="Search name or company..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <select className="bg-[#111] border border-[#333] rounded px-3 py-2 text-sm" value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}>
            {['All', 'LinkedIn', 'Instagram', 'Facebook', 'Maps', 'YellowPages'].map(o => <option key={o}>{o}</option>)}
          </select>
          <select className="bg-[#111] border border-[#333] rounded px-3 py-2 text-sm" value={valueBandFilter} onChange={e => setValueBandFilter(e.target.value)}>
            {['All', 'High', 'Medium', 'Low'].map(o => <option key={o}>{o}</option>)}
          </select>
          <select className="bg-[#111] border border-[#333] rounded px-3 py-2 text-sm" value={stageFilter} onChange={e => setStageFilter(e.target.value)}>
            {['All', 'NEW', 'CONTACTED', 'RESPONDED', 'QUALIFIED'].map(o => <option key={o}>{o}</option>)}
          </select>
          
          <div className="ml-auto flex gap-2">
            <button onClick={() => handleExport('csv')} className="bg-[#222] hover:bg-[#333] px-4 py-2 rounded text-sm transition-colors">Export CSV</button>
            <button onClick={() => handleExport('excel')} className="bg-[#222] hover:bg-[#333] px-4 py-2 rounded text-sm transition-colors">Export Excel</button>
          </div>
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-3 mb-4 flex items-center justify-between animate-in fade-in slide-in-from-top-4">
            <span className="text-sm font-medium">{selectedIds.size} leads selected</span>
            <button onClick={handleBulkReveal} className="bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded text-sm font-medium transition-colors">
              🔓 Reveal Selected ({selectedIds.size} tokens)
            </button>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 pb-10">
          {filteredLeads.map(lead => (
            <div key={lead.id} className="bg-[#111] border border-[#222] hover:border-[#444] rounded-xl p-4 transition-colors flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(lead.id)}
                    onChange={(e) => {
                      const newSet = new Set(selectedIds);
                      e.target.checked ? newSet.add(lead.id) : newSet.delete(lead.id);
                      setSelectedIds(newSet);
                    }}
                    className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-transparent"
                  />
                  <div className="font-semibold text-lg">{lead.name || 'Unknown'}</div>
                </div>
                <div className="flex gap-2 items-center">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    lead.valueBand === 'High' ? 'bg-green-500/20 text-green-400' :
                    lead.valueBand === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>{lead.valueBand}</span>
                  {getPlatformIcon(lead.platform)}
                </div>
              </div>
              
              <div className="text-sm text-gray-400 truncate">{lead.designation || 'No Designation'}</div>
              <div className="text-sm text-gray-500 truncate">{lead.organization || 'No Organization'}</div>
              
              <div className="flex items-center gap-2 mt-2">
                <div className="text-xs text-gray-500 w-10">Score</div>
                <div className="flex-1 h-1.5 bg-[#222] rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${lead.contactScore >= 80 ? 'bg-green-500' : lead.contactScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                    style={{ width: `${Math.min(100, lead.contactScore)}%` }}
                  />
                </div>
                <div className="text-xs font-mono w-6 text-right">{lead.contactScore}</div>
              </div>

              <div className="bg-[#0a0a0a] rounded p-2 mt-2 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <span className="opacity-50">✉️</span>
                  <span className={lead.revealed ? 'text-green-400' : 'text-gray-400 font-mono tracking-wider'}>
                    {lead.email || 'No email found'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="opacity-50">📞</span>
                  <span className={lead.revealed ? 'text-green-400' : 'text-gray-400 font-mono tracking-wider'}>
                    {lead.phone || 'No phone found'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#222]">
                <select
                  value={lead.crmStage}
                  onChange={(e) => updateStage(lead.id, e.target.value)}
                  className="bg-transparent border border-[#333] rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
                >
                  <option value="NEW">NEW</option>
                  <option value="CONTACTED">CONTACTED</option>
                  <option value="RESPONDED">RESPONDED</option>
                  <option value="QUALIFIED">QUALIFIED</option>
                </select>

                {!lead.revealed ? (
                  <button onClick={() => handleReveal(lead.id)} className="bg-white text-black hover:bg-gray-200 px-3 py-1 text-xs rounded font-medium flex items-center gap-1 transition-colors">
                    <span>🔓</span> Reveal (1)
                  </button>
                ) : (
                  <span className="text-green-500 text-xs font-medium flex items-center gap-1">
                    <span>✅</span> Revealed
                  </span>
                )}
              </div>
            </div>
          ))}
          {filteredLeads.length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-500">
              No leads found matching your criteria.
            </div>
          )}
        </div>
      </div>

      {/* CAPTCHA Modal */}
      {captchaData && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#333] p-6 rounded-xl max-w-md w-full shadow-2xl flex flex-col gap-4">
            <h2 className="text-xl font-bold text-yellow-500 flex items-center gap-2">
              <span>⚠️</span> Verification Required
            </h2>
            <p className="text-sm text-gray-300">
              {captchaData.engine} detected automated access and is showing a CAPTCHA.
            </p>
            <div className="bg-black/50 p-3 rounded text-sm text-gray-400 border border-[#222]">
              <ol className="list-decimal pl-4 space-y-1">
                <li>Click the button below to open the search engine.</li>
                <li>Complete the human verification (CAPTCHA).</li>
                <li>Return here and click "I've Completed Verification".</li>
              </ol>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <a
                href={captchaData.engine === 'google' ? 'https://google.com' : 'https://bing.com'}
                target="_blank"
                rel="noreferrer"
                className="bg-[#222] hover:bg-[#333] text-center py-2 rounded text-sm font-medium transition-colors"
              >
                Open {captchaData.engine === 'google' ? 'Google' : 'Bing'}
              </a>
              <button
                onClick={solveCaptcha}
                className="bg-green-600 hover:bg-green-700 py-2 rounded text-sm font-medium transition-colors"
              >
                ✓ I've Completed Verification
              </button>
              <button
                onClick={solveCaptcha}
                className="text-gray-500 hover:text-gray-300 text-xs py-1 transition-colors mt-2"
              >
                Skip This Source
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
