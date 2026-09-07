import React, { useState, useEffect, useRef } from 'react';
import { Activity, Plus, Play, Square, Trash2, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import './index.css';

type Target = { id: string; url: string; active: boolean; };
type PingResult = { id: string; targetId: string; timestamp: number; latency: number; status: string; error?: string; };

export default function App() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [results, setResults] = useState<PingResult[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const savedTargets = localStorage.getItem('netpulse_targets');
    const savedResults = localStorage.getItem('netpulse_results');
    if (savedTargets) setTargets(JSON.parse(savedTargets));
    if (savedResults) setResults(JSON.parse(savedResults));
  }, []);

  useEffect(() => {
    localStorage.setItem('netpulse_targets', JSON.stringify(targets));
    localStorage.setItem('netpulse_results', JSON.stringify(results.slice(-1000)));
  }, [targets, results]);

  const addTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;
    const url = newUrl.startsWith('http') ? newUrl : `https://${newUrl}`;
    setTargets([...targets, { id: Date.now().toString(), url, active: true }]);
    setNewUrl('');
  };

  const toggleTarget = (id: string) => setTargets(targets.map(t => t.id === id ? { ...t, active: !t.active } : t));
  const removeTarget = (id: string) => { setTargets(targets.filter(t => t.id !== id)); setResults(results.filter(r => r.targetId !== id)); };

  const ping = async (target: Target) => {
    if (!target.active) return;
    const start = performance.now();
    try {
      await fetch(target.url, { mode: 'no-cors', cache: 'no-store' });
      const latency = Math.round(performance.now() - start);
      setResults(prev => [...prev, { id: Date.now().toString(), targetId: target.id, timestamp: Date.now(), latency, status: 'OK' }]);
    } catch (err: any) {
      setResults(prev => [...prev, { id: Date.now().toString(), targetId: target.id, timestamp: Date.now(), latency: 0, status: 'DOWN', error: err.message }]);
    }
  };

  useEffect(() => {
    timerRef.current = setInterval(() => { targets.forEach(t => ping(t)); }, 10000);
    return () => clearInterval(timerRef.current!);
  }, [targets]);

  const exportData = () => {
    const csv = 'timestamp,target,latency,status\n' + results.map(r => `${new Date(r.timestamp).toISOString()},${targets.find(t=>t.id===r.targetId)?.url},${r.latency},${r.status}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'netpulse_export.csv'; a.click();
  };

  const stats = targets.map(t => {
    const tRes = results.filter(r => r.targetId === t.id);
    const recent = tRes.slice(-10);
    const downCount = recent.filter(r => r.status === 'DOWN').length;
    const avgLatency = tRes.length ? Math.round(tRes.reduce((a, b) => a + b.latency, 0) / tRes.length) : 0;
    let health = '🟢 Healthy';
    if (downCount > 0) health = '🟡 Degraded';
    if (downCount > 5 || (recent.length > 0 && recent[recent.length-1].status === 'DOWN')) health = '🔴 Down';
    return { ...t, avgLatency, health, recent };
  });

  return (
    <div className="container">
      <header className="header">
        <h1 className="title"><Activity /> NetPulse</h1>
        <button onClick={exportData} className="btn btn-primary"><Download size={16}/> Export CSV</button>
      </header>
      
      <div className="grid">
        <div>
          <h3 className="section-title">Targets</h3>
          <form onSubmit={addTarget} className="input-group">
            <input value={newUrl} onChange={e=>setNewUrl(e.target.value)} placeholder="example.com" className="input" />
            <button type="submit" className="btn btn-primary"><Plus size={16}/></button>
          </form>
          <div className="target-list">
            {stats.map(t => (
              <div key={t.id} className="target-item">
                <div className="target-header">
                  <div className="target-url">{t.url}</div>
                  <div className="target-actions">
                    <button onClick={() => toggleTarget(t.id)} className="btn-icon" title="Toggle">{t.active ? <Square size={16}/> : <Play size={16}/>}</button>
                    <button onClick={() => removeTarget(t.id)} className="btn-icon btn-icon-danger" title="Delete"><Trash2 size={16}/></button>
                  </div>
                </div>
                <div className="target-stats">
                  <div>Status: {t.health}</div>
                  <div>Avg Latency: {t.avgLatency}ms</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="section-title">Dashboard</h3>
          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-val">{targets.length}</div>
              <div className="target-stats">Targets</div>
            </div>
            <div className="stat-box" style={{background: 'var(--success-bg)', borderColor: '#a7f3d0'}}>
              <div className="stat-val" style={{color: 'var(--success)'}}>{stats.filter(s=>s.health.includes('Healthy')).length}</div>
              <div className="target-stats">Healthy</div>
            </div>
            <div className="stat-box" style={{background: 'var(--warning-bg)', borderColor: '#fde68a'}}>
              <div className="stat-val" style={{color: 'var(--warning)'}}>{stats.filter(s=>s.health.includes('Degraded')).length}</div>
              <div className="target-stats">Degraded</div>
            </div>
            <div className="stat-box" style={{background: 'var(--danger-bg)', borderColor: '#fecaca'}}>
              <div className="stat-val" style={{color: 'var(--danger)'}}>{stats.filter(s=>s.health.includes('Down')).length}</div>
              <div className="target-stats">Down</div>
            </div>
          </div>
          
          <h3 className="section-title">Latency History</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={results.slice(-50).map(r => ({ time: new Date(r.timestamp).toLocaleTimeString(), latency: r.latency }))}>
                <XAxis dataKey="time" tick={{fontSize: 12, fill: 'var(--text-muted)'}} />
                <YAxis tick={{fontSize: 12, fill: 'var(--text-muted)'}} />
                <Tooltip contentStyle={{borderRadius: '8px', border: '1px solid var(--border)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)'}} />
                <Line type="monotone" dataKey="latency" stroke="var(--primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
