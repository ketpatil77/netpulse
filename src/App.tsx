import React, { useState, useEffect, useRef } from 'react';
import { Activity, Plus, Play, Square, Trash2, Download, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type Target = { id: string; url: string; active: boolean; };
type PingResult = { id: string; targetId: string; timestamp: number; latency: number; status: string; error?: string; };

export default function App() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [results, setResults] = useState<PingResult[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const savedTargets = localStorage.getItem('netpulse_targets');
    const savedResults = localStorage.getItem('netpulse_results');
    if (savedTargets) setTargets(JSON.parse(savedTargets));
    if (savedResults) setResults(JSON.parse(savedResults));
  }, []);

  useEffect(() => {
    localStorage.setItem('netpulse_targets', JSON.stringify(targets));
    localStorage.setItem('netpulse_results', JSON.stringify(results.slice(-1000))); // Keep last 1000
  }, [targets, results]);

  const addTarget = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;
    const url = newUrl.startsWith('http') ? newUrl : `https://${newUrl}`;
    setTargets([...targets, { id: Date.now().toString(), url, active: true }]);
    setNewUrl('');
  };

  const toggleTarget = (id: string) => {
    setTargets(targets.map(t => t.id === id ? { ...t, active: !t.active } : t));
  };

  const removeTarget = (id: string) => {
    setTargets(targets.filter(t => t.id !== id));
    setResults(results.filter(r => r.targetId !== id));
  };

  const ping = async (target: Target) => {
    if (!target.active) return;
    const start = performance.now();
    try {
      const res = await fetch(target.url, { mode: 'no-cors', cache: 'no-store' });
      const latency = Math.round(performance.now() - start);
      setResults(prev => [...prev, { id: Date.now().toString(), targetId: target.id, timestamp: Date.now(), latency, status: 'OK' }]);
    } catch (err: any) {
      setResults(prev => [...prev, { id: Date.now().toString(), targetId: target.id, timestamp: Date.now(), latency: 0, status: 'DOWN', error: err.message }]);
    }
  };

  useEffect(() => {
    timerRef.current = setInterval(() => {
      targets.forEach(t => ping(t));
    }, 10000);
    return () => clearInterval(timerRef.current!);
  }, [targets]);

  const exportData = () => {
    const csv = 'timestamp,target,latency,status\n' + results.map(r => `${new Date(r.timestamp).toISOString()},${targets.find(t=>t.id===r.targetId)?.url},${r.latency},${r.status}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'netpulse_export.csv'; a.click();
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
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '1000px', margin: 'auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Activity color="#2563eb" /> NetPulse</h1>
        <button onClick={exportData} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', cursor: 'pointer' }}><Download size={16}/> Export CSV</button>
      </header>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '2rem' }}>
        <div>
          <h3>Targets</h3>
          <form onSubmit={addTarget} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input value={newUrl} onChange={e=>setNewUrl(e.target.value)} placeholder="example.com" style={{ flex: 1, padding: '0.5rem' }} />
            <button type="submit" style={{ padding: '0.5rem' }}><Plus size={16}/></button>
          </form>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {stats.map(t => (
              <div key={t.id} style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <strong>{t.url}</strong>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => toggleTarget(t.id)} title="Toggle">{t.active ? <Square size={16}/> : <Play size={16}/>}</button>
                    <button onClick={() => removeTarget(t.id)} title="Delete"><Trash2 size={16}/></button>
                  </div>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#555' }}>
                  <div>Status: {t.health}</div>
                  <div>Avg Latency: {t.avgLatency}ms</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3>Dashboard</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{targets.length}</div>
              <div>Targets</div>
            </div>
            <div style={{ padding: '1rem', background: '#ecfdf5', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#059669' }}>{stats.filter(s=>s.health.includes('Healthy')).length}</div>
              <div>Healthy</div>
            </div>
            <div style={{ padding: '1rem', background: '#fffbeb', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#d97706' }}>{stats.filter(s=>s.health.includes('Degraded')).length}</div>
              <div>Degraded</div>
            </div>
            <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626' }}>{stats.filter(s=>s.health.includes('Down')).length}</div>
              <div>Down</div>
            </div>
          </div>
          
          <h3>Latency History</h3>
          <div style={{ height: '300px', border: '1px solid #eee', padding: '1rem', borderRadius: '8px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={results.slice(-50).map(r => ({ time: new Date(r.timestamp).toLocaleTimeString(), latency: r.latency }))}>
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="latency" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
