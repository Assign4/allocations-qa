'use client';

import { useState, useEffect, useCallback } from 'react';

type RunStatus = 'idle' | 'queued' | 'in_progress' | 'completed';
type ReportTab = 'ui' | 'api';

interface RunnerState {
  status: RunStatus;
  conclusion: string | null;
  runUrl: string | null;
  triggering: boolean;
  error: string | null;
}

function useTestRunner(type: ReportTab) {
  const [state, setState] = useState<RunnerState>({
    status: 'idle',
    conclusion: null,
    runUrl: null,
    triggering: false,
    error: null,
  });

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/test-status?type=${type}`);
      const data = await res.json();
      setState(s => ({
        ...s,
        status: data.status ?? 'idle',
        conclusion: data.conclusion ?? null,
        runUrl: data.html_url ?? null,
      }));
    } catch { /* ignore network errors */ }
  }, [type]);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  useEffect(() => {
    const active = state.status === 'queued' || state.status === 'in_progress';
    if (!active) return;
    const id = setInterval(checkStatus, 10_000);
    return () => clearInterval(id);
  }, [state.status, checkStatus]);

  const run = useCallback(async () => {
    setState(s => ({ ...s, triggering: true, error: null }));
    try {
      const res = await fetch(`/api/run-tests?type=${type}`, { method: 'POST' });
      if (res.ok) {
        setState(s => ({ ...s, status: 'queued', conclusion: null, runUrl: null }));
      } else {
        const data = await res.json().catch(() => ({}));
        setState(s => ({ ...s, error: data.error ?? `Error ${res.status}` }));
      }
    } catch {
      setState(s => ({ ...s, error: 'Network error — could not reach the server.' }));
    } finally {
      setState(s => ({ ...s, triggering: false }));
    }
  }, [type]);

  return { ...state, run };
}

function StatusBadge({ status, conclusion }: { status: RunStatus; conclusion: string | null }) {
  const isRunning = status === 'queued' || status === 'in_progress';
  const isDone = status === 'completed';
  if (!isRunning && !isDone) return null;

  const label = isRunning
    ? (status === 'in_progress' ? '● Running…' : '● Queued…')
    : conclusion === 'success' ? '✓ Passed' : '✗ Failed';

  const color = isRunning ? '#f59e0b' : conclusion === 'success' ? '#22c55e' : '#ef4444';

  return <span style={{ fontSize: '13px', color, fontWeight: 500 }}>{label}</span>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<ReportTab>('ui');
  const ui = useTestRunner('ui');
  const api = useTestRunner('api');
  const runner = activeTab === 'ui' ? ui : api;

  const isRunning = runner.triggering || runner.status === 'queued' || runner.status === 'in_progress';
  const isDone = runner.status === 'completed';
  const reportSrc = activeTab === 'ui' ? '/ui-report/index.html' : '/api-report.html';

  const tabBtn = (tab: ReportTab, label: string) => ({
    onClick: () => setActiveTab(tab),
    style: {
      padding: '4px 14px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer' as const,
      fontSize: '13px',
      fontWeight: activeTab === tab ? 600 : 400,
      background: activeTab === tab ? '#3b82f6' : 'transparent',
      color: activeTab === tab ? '#fff' : '#94a3b8',
    },
    children: label,
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
        <span style={{ fontWeight: 600, fontSize: '15px', color: '#f1f5f9' }}>Allocations QA</span>

        <div style={{ display: 'flex', gap: '2px' }}>
          <button {...tabBtn('ui', 'UI')}>UI</button>
          <button {...tabBtn('api', 'API')}>API</button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <StatusBadge status={runner.status} conclusion={runner.conclusion} />

          {isDone && runner.runUrl && (
            <a href={runner.runUrl} target="_blank" rel="noreferrer"
              style={{ fontSize: '12px', color: '#64748b', textDecoration: 'none' }}>
              View run ↗
            </a>
          )}

          {isDone && (
            <button onClick={() => window.location.reload()} style={{
              padding: '4px 10px', borderRadius: '6px',
              border: '1px solid #334155', background: 'transparent',
              color: '#94a3b8', fontSize: '12px', cursor: 'pointer',
            }}>
              Reload reports
            </button>
          )}

          <button
            onClick={runner.run}
            disabled={isRunning}
            style={{
              padding: '6px 16px', borderRadius: '6px', border: 'none',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: 600,
              background: isRunning ? '#334155' : '#3b82f6',
              color: isRunning ? '#64748b' : '#fff',
            }}
          >
            {runner.triggering ? 'Triggering…' : isRunning ? 'Running…' : `Run ${activeTab.toUpperCase()} Tests`}
          </button>

          <a href={reportSrc} target="_blank" rel="noreferrer" style={{
            fontSize: '13px', color: '#94a3b8', textDecoration: 'none',
            border: '1px solid #334155', padding: '4px 10px', borderRadius: '6px',
          }}>
            Open ↗
          </a>
        </div>
      </header>

      {runner.error && (
        <div style={{
          padding: '8px 20px', background: '#7f1d1d', color: '#fca5a5',
          fontSize: '13px', borderBottom: '1px solid #991b1b',
        }}>
          ⚠ {runner.error}
        </div>
      )}

      <iframe
        key={reportSrc}
        src={reportSrc}
        style={{ flex: 1, border: 'none', width: '100%' }}
        title={`${activeTab.toUpperCase()} Test Report`}
      />
    </main>
  );
}
