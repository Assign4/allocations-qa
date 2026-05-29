'use client';

import { useState, useEffect, useCallback } from 'react';

type RunStatus = 'idle' | 'queued' | 'in_progress' | 'completed';
type ReportTab = 'ui' | 'api';

interface StatusData {
  status: RunStatus;
  conclusion: string | null;
  html_url: string | null;
}

export default function Home() {
  const [runStatus, setRunStatus] = useState<RunStatus>('idle');
  const [conclusion, setConclusion] = useState<string | null>(null);
  const [runUrl, setRunUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ReportTab>('ui');
  const [triggering, setTriggering] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/test-status');
      const data: StatusData = await res.json();
      setRunStatus(data.status ?? 'idle');
      setConclusion(data.conclusion ?? null);
      setRunUrl(data.html_url ?? null);
    } catch {
      /* ignore network errors */
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    const active = runStatus === 'queued' || runStatus === 'in_progress';
    if (!active) return;
    const id = setInterval(checkStatus, 10_000);
    return () => clearInterval(id);
  }, [runStatus, checkStatus]);

  const runTests = async () => {
    setTriggering(true);
    try {
      await fetch('/api/run-tests', { method: 'POST' });
      setRunStatus('queued');
      setConclusion(null);
      setRunUrl(null);
    } finally {
      setTriggering(false);
    }
  };

  const isRunning = triggering || runStatus === 'queued' || runStatus === 'in_progress';
  const isDone = runStatus === 'completed';
  const passed = isDone && conclusion === 'success';

  const statusLabel = isRunning
    ? runStatus === 'in_progress' ? '● Running…' : '● Queued…'
    : isDone
    ? passed ? '✓ Passed' : '✗ Failed'
    : null;

  const statusColor = isRunning ? '#f59e0b' : passed ? '#22c55e' : '#ef4444';
  const reportSrc = activeTab === 'ui' ? '/report.html' : '/api-report.html';

  const tabStyle = (tab: ReportTab) => ({
    padding: '4px 14px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer' as const,
    fontSize: '13px',
    fontWeight: activeTab === tab ? 600 : 400,
    background: activeTab === tab ? '#3b82f6' : '#1e293b',
    color: activeTab === tab ? '#fff' : '#94a3b8',
    transition: 'background 0.15s',
  });

  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{
        padding: '10px 20px',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '18px' }}>🎭</span>
        <span style={{ fontWeight: 600, fontSize: '15px', color: '#f1f5f9' }}>
          Allocations QA
        </span>

        <div style={{ display: 'flex', gap: '4px', marginLeft: '4px' }}>
          <button style={tabStyle('ui')} onClick={() => setActiveTab('ui')}>UI</button>
          <button style={tabStyle('api')} onClick={() => setActiveTab('api')}>API</button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {statusLabel && (
            <span style={{ fontSize: '13px', color: statusColor, fontWeight: 500 }}>
              {statusLabel}
            </span>
          )}

          {isDone && runUrl && (
            <a href={runUrl} target="_blank" rel="noreferrer" style={{
              fontSize: '12px', color: '#64748b', textDecoration: 'none',
            }}>
              View run ↗
            </a>
          )}

          {isDone && (
            <button onClick={() => window.location.reload()} style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #334155',
              background: 'transparent',
              color: '#94a3b8',
              fontSize: '12px',
              cursor: 'pointer',
            }}>
              Reload reports
            </button>
          )}

          <button
            onClick={runTests}
            disabled={isRunning}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              background: isRunning ? '#334155' : '#3b82f6',
              color: isRunning ? '#64748b' : '#fff',
              transition: 'background 0.15s',
            }}
          >
            {triggering ? 'Triggering…' : isRunning ? 'Running…' : 'Run Tests'}
          </button>

          <a href={reportSrc} target="_blank" rel="noreferrer" style={{
            fontSize: '13px',
            color: '#94a3b8',
            textDecoration: 'none',
            border: '1px solid #334155',
            padding: '4px 10px',
            borderRadius: '6px',
          }}>
            Open ↗
          </a>
        </div>
      </header>

      <iframe
        key={reportSrc}
        src={reportSrc}
        style={{ flex: 1, border: 'none', width: '100%' }}
        title={`${activeTab.toUpperCase()} Test Report`}
      />
    </main>
  );
}
