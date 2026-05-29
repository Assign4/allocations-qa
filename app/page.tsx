'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type RunStatus = 'idle' | 'queued' | 'in_progress' | 'completed';
type ReportType = 'ui' | 'api';

interface RunEntry {
  id: string;
  type: ReportType;
  status: 'passed' | 'failed';
  date: string;
  runUrl?: string | null;
}

interface RunnerState {
  status: RunStatus;
  conclusion: string | null;
  runUrl: string | null;
  triggering: boolean;
  publishing: boolean;
  error: string | null;
}

const PUBLISH_TIMEOUT_MS = 3 * 60 * 1000;

function useTestRunner(type: ReportType, onReportsReady: () => void) {
  const [state, setState] = useState<RunnerState>({
    status: 'idle', conclusion: null, runUrl: null,
    triggering: false, publishing: false, error: null,
  });
  const triggerTimeRef = useRef<number | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/test-status?type=${type}`);
      const data = await res.json();
      setState(s => ({ ...s, status: data.status ?? 'idle', conclusion: data.conclusion ?? null, runUrl: data.html_url ?? null }));
    } catch { /* ignore */ }
  }, [type]);

  useEffect(() => { checkStatus(); }, [checkStatus]);

  useEffect(() => {
    const active = state.status === 'queued' || state.status === 'in_progress';
    if (!active) return;
    const id = setInterval(checkStatus, 10_000);
    return () => clearInterval(id);
  }, [state.status, checkStatus]);

  useEffect(() => {
    if (state.status !== 'completed') return;
    const t0 = triggerTimeRef.current;
    if (!t0) return;
    setState(s => ({ ...s, publishing: true }));
    const deadline = Date.now() + PUBLISH_TIMEOUT_MS;
    const id = setInterval(async () => {
      if (Date.now() > deadline) { clearInterval(id); setState(s => ({ ...s, publishing: false })); return; }
      try {
        const res = await fetch(`/last-updated.json?_=${Date.now()}`);
        const data = await res.json();
        if (data.timestamp > t0 && data.type === type) {
          clearInterval(id);
          triggerTimeRef.current = null;
          setState(s => ({ ...s, publishing: false }));
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
      setState(s => ({ ...s, error: 'Network error.' }));
    } finally {
      setState(s => ({ ...s, triggering: false }));
    }
  }, [type]);

  return { ...state, run };
}

// ── small helpers ──────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function RunBtn({ runner, label }: { runner: ReturnType<typeof useTestRunner>; label: string }) {
  const busy = runner.triggering || runner.status === 'queued' || runner.status === 'in_progress' || runner.publishing;
  return (
    <button onClick={runner.run} disabled={busy} style={{
      padding: '6px 16px', borderRadius: '6px', border: 'none',
      cursor: busy ? 'not-allowed' : 'pointer',
      fontSize: '13px', fontWeight: 600,
      background: busy ? '#334155' : '#3b82f6',
      color: busy ? '#64748b' : '#fff',
    }}>
      {runner.triggering ? 'Triggering…' : runner.status === 'in_progress' ? 'Running…' : runner.publishing ? 'Publishing…' : label}
    </button>
  );
}

function InlineBadge({ runner }: { runner: ReturnType<typeof useTestRunner> }) {
  const { status, conclusion, publishing } = runner;
  if (publishing) return <span style={{ fontSize: '12px', color: '#a78bfa' }}>⏳ Publishing…</span>;
  if (status === 'queued') return <span style={{ fontSize: '12px', color: '#f59e0b' }}>● Queued</span>;
  if (status === 'in_progress') return <span style={{ fontSize: '12px', color: '#f59e0b' }}>● Running…</span>;
  if (status === 'completed') {
    const ok = conclusion === 'success';
    return <span style={{ fontSize: '12px', color: ok ? '#22c55e' : '#ef4444' }}>{ok ? '✓ Passed' : '✗ Failed'}</span>;
  }
  return null;
}

// ── main component ─────────────────────────────────────────────────────────

export default function Home() {
  const [view, setView] = useState<'list' | 'report'>('list');
  const [activeType, setActiveType] = useState<ReportType>('ui');
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [iframeKey, setIframeKey] = useState(0);

  const refreshRuns = useCallback(() => {
    fetch('/runs.json?_=' + Date.now())
      .then(r => r.json())
      .then(data => setRuns(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => { refreshRuns(); }, [refreshRuns]);

  const onReady = useCallback(() => {
    setIframeKey(k => k + 1);
    refreshRuns();
  }, [refreshRuns]);

  const ui = useTestRunner('ui', onReady);
  const api = useTestRunner('api', onReady);

  const openReport = (type: ReportType) => { setActiveType(type); setView('report'); };
  const runner = activeType === 'ui' ? ui : api;
  const reportSrc = activeType === 'ui' ? '/ui-report/index.html' : '/api-report.html';

  // inject "live" rows for active runs not yet persisted to runs.json
  const liveRows: (RunEntry & { live: true })[] = (['ui', 'api'] as const)
    .filter(t => {
      const r = t === 'ui' ? ui : api;
      return r.status === 'queued' || r.status === 'in_progress' || r.publishing;
    })
    .map(t => ({ id: `live-${t}`, type: t, status: 'passed' as const, date: new Date().toISOString(), live: true }));

  const allRows = [...liveRows, ...runs];

  const errorMsg = ui.error || api.error;

  // ── REPORT VIEW ────────────────────────────────────────────────────────
  if (view === 'report') {
    return (
      <main style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <header style={{
          padding: '10px 20px', background: '#1e293b', borderBottom: '1px solid #334155',
          display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
        }}>
          <button onClick={() => setView('list')} style={{
            background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
            padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
          }}>← Runs</button>

          <span style={{ fontSize: '16px' }}>🎭</span>
          <span style={{ fontWeight: 600, fontSize: '14px', color: '#f1f5f9' }}>
            {activeType.toUpperCase()} Report
          </span>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <InlineBadge runner={runner} />
            {runner.runUrl && (
              <a href={runner.runUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: '12px', color: '#64748b', textDecoration: 'none' }}>
                View run ↗
              </a>
            )}
            {activeType === 'api' && (
              <a href="/api-logs.html" target="_blank" rel="noreferrer" style={{
                fontSize: '12px', color: '#94a3b8', textDecoration: 'none',
                border: '1px solid #334155', padding: '4px 8px', borderRadius: '6px',
              }}>Logs ↗</a>
            )}
            <RunBtn runner={runner} label={`Run ${activeType.toUpperCase()} Tests`} />
            <a href={reportSrc} target="_blank" rel="noreferrer" style={{
              fontSize: '13px', color: '#94a3b8', textDecoration: 'none',
              border: '1px solid #334155', padding: '4px 10px', borderRadius: '6px',
            }}>Open ↗</a>
          </div>
        </header>

        {runner.error && (
          <div style={{ padding: '8px 20px', background: '#7f1d1d', color: '#fca5a5', fontSize: '13px', borderBottom: '1px solid #991b1b' }}>
            ⚠ {runner.error}
          </div>
        )}
        {runner.publishing && (
          <div style={{ padding: '6px 20px', background: '#1e1b4b', color: '#a78bfa', fontSize: '13px', borderBottom: '1px solid #312e81' }}>
            ⏳ Tests done — waiting for Vercel to deploy updated reports…
          </div>
        )}

        <iframe key={`${reportSrc}-${iframeKey}`} src={reportSrc}
          style={{ flex: 1, border: 'none', width: '100%' }} title={`${activeType.toUpperCase()} Test Report`} />
      </main>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────
  return (
    <main style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#0f172a', color: '#f1f5f9' }}>
      <header style={{
        padding: '12px 24px', background: '#1e293b', borderBottom: '1px solid #334155',
        display: 'flex', alignItems: 'center', gap: '16px',
      }}>
        <span style={{ fontSize: '20px' }}>🎭</span>
        <span style={{ fontWeight: 700, fontSize: '16px' }}>Allocations QA</span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <InlineBadge runner={ui} />
          <RunBtn runner={ui} label="Run UI Tests" />
          <div style={{ width: '1px', height: '20px', background: '#334155' }} />
          <InlineBadge runner={api} />
          <RunBtn runner={api} label="Run API Tests" />
        </div>
      </header>

      {errorMsg && (
        <div style={{ padding: '8px 24px', background: '#7f1d1d', color: '#fca5a5', fontSize: '13px' }}>
          ⚠ {errorMsg}
        </div>
      )}
      {(ui.publishing || api.publishing) && (
        <div style={{ padding: '6px 24px', background: '#1e1b4b', color: '#a78bfa', fontSize: '13px' }}>
          ⏳ Tests done — waiting for Vercel to deploy updated reports…
        </div>
      )}

      <div style={{ padding: '28px 24px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', marginBottom: '16px', fontFamily: 'system-ui' }}>
          Test Runs
        </h2>

        {allRows.length === 0 ? (
          <p style={{ color: '#475569', fontSize: '14px', fontFamily: 'system-ui', padding: '48px 0', textAlign: 'center' }}>
            No runs yet — click <strong style={{ color: '#94a3b8' }}>Run UI Tests</strong> or{' '}
            <strong style={{ color: '#94a3b8' }}>Run API Tests</strong> to get started.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'system-ui', fontSize: '14px' }}>
            <thead>
              <tr style={{ color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '8px 16px', fontWeight: 500, textAlign: 'left', borderBottom: '1px solid #1e293b' }}>Status</th>
                <th style={{ padding: '8px 16px', fontWeight: 500, textAlign: 'left', borderBottom: '1px solid #1e293b' }}>Type</th>
                <th style={{ padding: '8px 16px', fontWeight: 500, textAlign: 'left', borderBottom: '1px solid #1e293b' }}>Date &amp; Time</th>
                <th style={{ padding: '8px 16px', fontWeight: 500, textAlign: 'left', borderBottom: '1px solid #1e293b' }}>GH Run</th>
                <th style={{ padding: '8px 16px', borderBottom: '1px solid #1e293b' }}></th>
              </tr>
            </thead>
            <tbody>
              {allRows.map((run, i) => {
                const live = 'live' in run;
                return (
                  <tr key={run.id} style={{ borderBottom: '1px solid #1e293b', background: i % 2 ? '#0b1120' : 'transparent' }}>
                    <td style={{ padding: '14px 16px' }}>
                      {live
                        ? <span style={{ color: '#f59e0b', fontWeight: 600 }}>● Running…</span>
                        : run.status === 'passed'
                          ? <span style={{ color: '#22c55e', fontWeight: 600 }}>✓ Passed</span>
                          : <span style={{ color: '#ef4444', fontWeight: 600 }}>✗ Failed</span>}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: '4px',
                        fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em',
                        background: run.type === 'ui' ? '#172554' : '#2e1065',
                        color: run.type === 'ui' ? '#60a5fa' : '#c084fc',
                      }}>
                        {run.type.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#94a3b8' }}>
                      {live ? 'Just now…' : fmt(run.date)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {!live && run.runUrl && (
                        <a href={run.runUrl} target="_blank" rel="noreferrer"
                          style={{ color: '#475569', fontSize: '12px', textDecoration: 'none', fontFamily: 'monospace' }}>
                          #{String(run.id).slice(-8)} ↗
                        </a>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {!live && (
                        <button onClick={() => openReport(run.type)} style={{
                          padding: '5px 14px', borderRadius: '6px',
                          border: '1px solid #334155', background: 'transparent',
                          color: '#94a3b8', fontSize: '13px', cursor: 'pointer',
                          fontFamily: 'system-ui',
                        }}>
                          View Report →
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
