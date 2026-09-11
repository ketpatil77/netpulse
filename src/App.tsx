import React, { useEffect, useRef, useState } from 'react';
import { Activity, Download, Play, Plus, Square, Trash2 } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './index.css';

type Target = { id: string; url: string; active: boolean };
type PingResult = {
  id: string;
  targetId: string;
  timestamp: number;
  latency: number;
  status: 'OK' | 'DOWN';
  error?: string;
};

const STORAGE_TARGETS = 'netpulse_targets';
const STORAGE_RESULTS = 'netpulse_results';
const MAX_RESULTS = 1000;
const POLL_MS = 10_000;

function normalizeUrl(value: string): string | null {
  const candidate = value.trim().match(/^https?:\/\//i) ? value.trim() : `https://${value.trim()}`;
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function App() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [results, setResults] = useState<PingResult[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      const savedTargets = localStorage.getItem(STORAGE_TARGETS);
      const savedResults = localStorage.getItem(STORAGE_RESULTS);
      if (savedTargets) setTargets(JSON.parse(savedTargets));
      if (savedResults) setResults(JSON.parse(savedResults));
    } catch {
      localStorage.removeItem(STORAGE_TARGETS);
      localStorage.removeItem(STORAGE_RESULTS);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_TARGETS, JSON.stringify(targets));
    localStorage.setItem(STORAGE_RESULTS, JSON.stringify(results.slice(-MAX_RESULTS)));
  }, [targets, results]);

  const ping = async (target: Target) => {
    if (!target.active) return;
    const start = performance.now();
    try {
      // no-cors intentionally measures reachability. The opaque response cannot expose HTTP status.
      await fetch(target.url, { mode: 'no-cors', cache: 'no-store' });
      const latency = Math.round(performance.now() - start);
      setResults(prev => [
        ...prev,
        { id: `${target.id}-${Date.now()}`, targetId: target.id, timestamp: Date.now(), latency, status: 'OK' },
      ].slice(-MAX_RESULTS));
    } catch (error) {
      setResults(prev => [
        ...prev,
        {
          id: `${target.id}-${Date.now()}`,
          targetId: target.id,
          timestamp: Date.now(),
          latency: 0,
          status: 'DOWN',
          error: error instanceof Error ? error.message : 'Network request failed',
        },
      ].slice(-MAX_RESULTS));
    }
  };

  const addTarget = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeUrl(newUrl);
    if (!normalized || targets.some(target => target.url === normalized)) return;
    setTargets(prev => [...prev, { id: crypto.randomUUID(), url: normalized, active: true }]);
    setNewUrl('');
  };

  const toggleTarget = (id: string) => {
    setTargets(prev => prev.map(target => target.id === id ? { ...target, active: !target.active } : target));
  };

  const removeTarget = (id: string) => {
    setTargets(prev => prev.filter(target => target.id !== id));
    setResults(prev => prev.filter(result => result.targetId !== id));
  };

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (targets.some(target => target.active)) {
      timerRef.current = setInterval(() => {
        targets.filter(target => target.active).forEach(target => void ping(target));
      }, POLL_MS);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [targets]);

  const exportData = () => {
    const rows = [
      ['timestamp', 'target', 'latency_ms', 'status'],
      ...results.map(result => [
        new Date(result.timestamp).toISOString(),
        targets.find(target => target.id === result.targetId)?.url ?? '',
        result.latency,
        result.status,
      ]),
    ];
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');
    const blobUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = 'netpulse_export.csv';
    anchor.click();
    URL.revokeObjectURL(blobUrl);
  };

  const stats = targets.map(target => {
    const targetResults = results.filter(result => result.targetId === target.id);
    const recent = targetResults.slice(-10);
    const downCount = recent.filter(result => result.status === 'DOWN').length;
    const successful = targetResults.filter(result => result.status === 'OK');
    const avgLatency = successful.length
      ? Math.round(successful.reduce((sum, result) => sum + result.latency, 0) / successful.length)
      : 0;
    let health = '🟢 Healthy';
    if (downCount > 0) health = '🟡 Degraded';
    if (downCount > 5 || recent.at(-1)?.status === 'DOWN') health = '🔴 Down';
    return { ...target, avgLatency, health, recent };
  });

  return (
    <div className="container">
      <header className="header">
        <h1 className="title"><Activity /> NetPulse</h1>
        <button onClick={exportData} className="btn btn-primary"><Download size={16} /> Export CSV</button>
      </header>

      <div className="grid">
        <div>
          <h3 className="section-title">Targets</h3>
          <form onSubmit={addTarget} className="input-group">
            <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="example.com" className="input" />
            <button type="submit" className="btn btn-primary" disabled={!newUrl.trim()}><Plus size={16} /></button>
          </form>
          <div className="target-list">
            {stats.map(target => (
              <div key={target.id} className="target-item">
                <div className="target-header">
                  <div className="target-url">{target.url}</div>
                  <div className="target-actions">
                    <button onClick={() => toggleTarget(target.id)} className="btn-icon" title="Toggle monitoring">
                      {target.active ? <Square size={16} /> : <Play size={16} />}
                    </button>
                    <button onClick={() => removeTarget(target.id)} className="btn-icon btn-icon-danger" title="Delete target">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="target-stats">
                  <div>Reachability: {target.health}</div>
                  <div>Avg Latency: {target.avgLatency}ms</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="section-title">Dashboard</h3>
          <div className="stats-grid">
            <div className="stat-box"><div className="stat-val">{targets.length}</div><div className="target-stats">Targets</div></div>
            <div className="stat-box" style={{ background: 'var(--success-bg)', borderColor: '#a7f3d0' }}><div className="stat-val" style={{ color: 'var(--success)' }}>{stats.filter(s => s.health.includes('Healthy')).length}</div><div className="target-stats">Healthy</div></div>
            <div className="stat-box" style={{ background: 'var(--warning-bg)', borderColor: '#fde68a' }}><div className="stat-val" style={{ color: 'var(--warning)' }}>{stats.filter(s => s.health.includes('Degraded')).length}</div><div className="target-stats">Degraded</div></div>
            <div className="stat-box" style={{ background: 'var(--danger-bg)', borderColor: '#fecaca' }}><div className="stat-val" style={{ color: 'var(--danger)' }}>{stats.filter(s => s.health.includes('Down')).length}</div><div className="target-stats">Down</div></div>
          </div>

          <h3 className="section-title">Latency History</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={results.slice(-50).map(result => ({ time: new Date(result.timestamp).toLocaleTimeString(), latency: result.latency }))}>
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }} />
                <Line type="monotone" dataKey="latency" stroke="var(--primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
