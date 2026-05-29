'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type RunStatus = 'idle' | 'queued' | 'in_progress' | 'completed';
type ReportTab = 'ui' | 'api';

interface RunnerState {
  status: RunStatus;
  conclusion: string | null;
  runUrl: string | null;
  triggering: boolean;
  publishing: boolean;
  error: string | null;
}

const PUBLISH_TIMEOUT_MS = 3 * 60 * 1000; // stop polling after 3 min

function useTestRunner(type: ReportTab, onReportsReady: () => void) {
  const [state, setState] = useState<RunnerState>({
    status: 'idle', conclusion: null, runUrl: null,
    triggering: false, publishing: false, error: null,
  });
  const triggerTimeRef = useRef<number | null>(null);

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
    } catch { /* ignore */ }
  }, [type]);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  // Poll GH Actions status while running
  useEffect(() => {
    const active = state.status === 'queued' || state.status === 'in_progress';
    if (!active) return;
    const id = setInterval(checkStatus, 10_000);
    return () => clearInterval(id);
  }, [state.status, checkStatus]);

  // Once GH Actions is done, poll last-updated.json until Vercel redeploys
  useEffect(() => {
    if (state.status !== 'completed') return;
    const t0 = triggerTimeRef.current;
    if (!t0) return;

    setState(s => ({ ...s, publishing: true }));
    const deadline = Date.now() + PUBLISH_TIMEOUT_MS;

    const id = setInterval(async () => {
      if (Date.now() > deadline) {
        clearInterval(id);
        setState(s => ({ ...s, publishing: false }));
        return;
      }
      try {
        const res = await fetch(`/last-updated.json?_=${Date.now()}`);
        const data = await res.json();
        if (data.timestamp > t0 && data.type === type) {
          clearInterval(id);
          setState(s => ({ ...s, publishing: false }));
          triggerTimeRef.current = null;
          onReportsReady();
        }
      } catch { /* ignore */ }
    }, 5_000);

    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  const run = useCallback(async () => {
    setState(s => ({ ...s, triggering: true, error: null }));
    triggerTimeRef.current = Date.now();
    try {
      const res = await fetch(`/api/run-tests?type=${type}`, { method: 'POST' });
      if (res.ok) {
        setState(s => ({ ...s, status: 'queued', conclusion: null, runUrl: null }));
      } else {
        const data = await res.json().catch(() => ({}));
        triggerTimeRef.current = null;
        setState(s => ({ ...s, error: data.error ?? `Error ${res.status}` }));
      }
    } catch {
      triggerTimeRef.current = null;
      setState(s => ({ ...s, error: 'Network error — could not reach the server.' }));
    } finally {
      setState(s => ({ ...s, triggering: false }));
    }
  }, [type]);

  return { ...state, run };
}

function StatusBadge({ status, conclusion, publishing }: {
  status: RunStatus; conclusion: string | null; publishing: boolean;
}) {
  if (publishing) return <span style={{ fontSize: '13px', color: '#a78bfa', fontWeight: 500 }}>⏳ Publishing…</span>;
  const running = status === 'queued' || status === 'in_progress';
  if (!running && status !== 'completed') return null;
  const label = running
    ? (status === 'in_progress' ? '● Running…' : '● Queued…')
    : conclusion === 'success' ? '✓ Passed' : '✗ Failed';
  const color = running ? '#f59e0b' : conclusion === 'success' ? '#22c55e' : '#ef4444';
  return <span style={{ fontSize: '13px', color, fontWeight: 500 }}>{label}</span>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<ReportTab>('ui');
  const [iframeKey, setIframeKey] = useState(0);

  const reloadIframe = useCallback(() => setIframeKey(k => k + 1), []);

  const ui = useTestRunner('ui', reloadIframe);
  const api = useTestRunner('api', reloadIframe);
  const runner = activeTab === 'ui' ? ui : api;

  const isRunning = runner.triggering || runner.status === 'queued' || runner.status === 'in_progress';
  const isDone = runner.status === 'completed' && !runner.publishing;
  const reportSrc = activeTab === 'ui' ? '/ui-report/index.html' : '/api-report.html';

  const tabBtn = (tab: ReportTab, label: string) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      style={{
        padding: '4px 14px', borderRadius: '6px', border: 'none',
        cursor: 'pointer', fontSize: '13px',
        fontWeight: activeTab === tab ? 600 : 400,
        background: activeTab === tab ? '#3b82f6' : 'transparent',
        color: activeTab === tab ? '#fff' : '#94a3b8',
      }}
    >
      {label}
    </button>
  );

  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{
        padding: '10px 20px', background: '#1e293b',
        borderBottom: '1px solid #334155',
        display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
      }}>
        <span style={{ fontSize: '18px' }}>🎭</span>
        <span style={{ fontWeight: 600, fontSize: '15px', color: '#f1f5f9' }}>Allocations QA</span>

        <div style={{ display: 'flex', gap: '2px' }}>
          {tabBtn('ui', 'UI')}
          {tabBtn('api', 'API')}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <StatusBadge
            status={runner.status}
            conclusion={runner.conclusion}
            publishing={runner.publishing}
          />

          {isDone && runner.runUrl && (
            <a href={runner.runUrl} target="_blank" rel="noreferrer"
              style={{ fontSize: '12px', color: '#64748b', textDecoration: 'none' }}>
              View run ↗
            </a>
          )}

          {activeTab === 'api' && (
            <a href="/api-logs.html" target="_blank" rel="noreferrer" style={{
              fontSize: '12px', color: '#94a3b8', textDecoration: 'none',
              border: '1px solid #334155', padding: '4px 10px', borderRadius: '6px',
            }}>
              Logs ↗
            </a>
          )}

          <button
            onClick={runner.run}
            disabled={isRunning || runner.publishing}
            style={{
              padding: '6px 16px', borderRadius: '6px', border: 'none',
              cursor: (isRunning || runner.publishing) ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: 600,
              background: (isRunning || runner.publishing) ? '#334155' : '#3b82f6',
              color: (isRunning || runner.publishing) ? '#64748b' : '#fff',
            }}
          >
            {runner.triggering ? 'Triggering…'
              : isRunning ? 'Running…'
              : runner.publishing ? 'Publishing…'
              : `Run ${activeTab.toUpperCase()} Tests`}
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

      {runner.publishing && (
        <div style={{
          padding: '6px 20px', background: '#1e1b4b', color: '#a78bfa',
          fontSize: '13px', borderBottom: '1px solid #312e81',
        }}>
          ⏳ Tests done — waiting for Vercel to deploy updated reports…
        </div>
      )}

      <iframe
        key={`${reportSrc}-${iframeKey}`}
        src={reportSrc}
        style={{ flex: 1, border: 'none', width: '100%' }}
        title={`${activeTab.toUpperCase()} Test Report`}
      />
    </main>
  );
}
