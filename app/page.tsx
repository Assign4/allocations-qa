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
  countdown: number | null;
  error: string | null;
}

const DEPLOY_SECS = 70;

function useTestRunner(type: ReportType, onReportsReady: () => void) {
  const [state, setState] = useState<RunnerState>({
    status: 'idle', conclusion: null, runUrl: null,
    triggering: false, publishing: false, countdown: null, error: null,
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

    setState(s => ({ ...s, publishing: true, countdown: DEPLOY_SECS }));

    const countdownId = setInterval(() => {
      setState(s => ({ ...s, countdown: s.countdown !== null && s.countdown > 1 ? s.countdown - 1 : null }));
    }, 1_000);

    const resolve = () => {
      clearInterval(countdownId);
      clearInterval(pollId);
      clearTimeout(forceId);
      triggerTimeRef.current = null;
      setState(s => ({ ...s, publishing: false, countdown: null }));
      onReportsReady();
    };

    const forceId = setTimeout(resolve, DEPLOY_SECS * 1_000);

    const pollId = setInterval(async () => {
      try {
        const res = await fetch(`/last-updated.json?_=${Date.now()}`);
        const data = await res.json();
        if (data.timestamp > t0 && data.type === type) resolve();
      } catch { /* ignore */ }
    }, 5_000);

    return () => { clearInterval(countdownId); clearInterval(pollId); clearTimeout(forceId); };
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

// ── animation atoms ───────────────────────────────────────────────────────

function Spinner({ size = 14, color = '#6366f1' }: { size?: number; color?: string }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, flexShrink: 0,
      border: `2px solid ${color}28`, borderTopColor: color,
      borderRadius: '50%', animation: 'qa-spin 0.75s linear infinite',
    }} />
  );
}

function PulseDot({ color = '#f59e0b' }: { color?: string }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 12, height: 12, flexShrink: 0 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color, animation: 'qa-ping 1.4s ease-out infinite' }} />
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, position: 'relative' }} />
    </span>
  );
}

function BounceDots({ color = '#7c3aed' }: { color?: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {([0, 0.18, 0.36] as number[]).map((delay, i) => (
        <span key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: color, animation: `qa-bounce 1s ease-in-out ${delay}s infinite` }} />
      ))}
    </span>
  );
}

// ── design tokens ─────────────────────────────────────────────────────────

const T = {
  bg: '#f1f5f9',
  surface: '#ffffff',
  border: '#e2e8f0',
  text: '#1e293b',
  muted: '#64748b',
  faint: '#94a3b8',
  passed: '#059669',   passedBg: '#ecfdf5',
  failed: '#dc2626',   failedBg: '#fef2f2',
  running: '#d97706',  runningBg: '#fffbeb',
  publishing: '#7c3aed', publishingBg: '#f5f3ff',
  blue: '#4f46e5',
  uiBadgeBg: '#eef2ff', uiBadgeText: '#4338ca',
  apiBadgeBg: '#f5f3ff', apiBadgeText: '#7c3aed',
};

function pill(bg: string, color: string, children: React.ReactNode) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, background: bg, color, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}

// ── badge + button ────────────────────────────────────────────────────────

function InlineBadge({ runner }: { runner: ReturnType<typeof useTestRunner> }) {
  const { status, conclusion, publishing, countdown } = runner;
  if (publishing) return pill(T.publishingBg, T.publishing, <><Spinner size={11} color={T.publishing} />Deploying{countdown !== null ? ` ${countdown}s` : ''}<BounceDots color={T.publishing} /></>);
  if (status === 'queued')      return pill(T.runningBg, T.running, <><Spinner size={11} color={T.running} />Queued</>);
  if (status === 'in_progress') return pill(T.runningBg, T.running, <><Spinner size={11} color={T.running} />Running</>);
  if (status === 'completed') {
    const ok = conclusion === 'success';
    return pill(ok ? T.passedBg : T.failedBg, ok ? T.passed : T.failed, ok ? '✓ Passed' : '✗ Failed');
  }
  return null;
}

function RunBtn({ runner, label }: { runner: ReturnType<typeof useTestRunner>; label: string }) {
  const busy = runner.triggering || runner.status === 'queued' || runner.status === 'in_progress' || runner.publishing;
  return (
    <button onClick={runner.run} disabled={busy} style={{
      padding: '8px 16px', borderRadius: 8, border: 'none',
      cursor: busy ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600,
      background: busy ? '#c7d2fe' : T.blue, color: busy ? '#6366f1' : '#fff',
      display: 'inline-flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap',
      boxShadow: busy ? 'none' : '0 1px 3px rgba(79,70,229,0.3)',
    }}>
      {busy && <Spinner size={12} color={busy ? '#6366f1' : '#fff'} />}
      {runner.triggering ? 'Triggering…' : runner.status === 'in_progress' ? 'Running…' : runner.publishing ? 'Deploying…' : label}
    </button>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const card: React.CSSProperties = {
  background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`,
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
};

const gradientHeader: React.CSSProperties = {
  background: 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)',
  boxShadow: '0 2px 8px rgba(79,70,229,0.25)',
};

// ── main ──────────────────────────────────────────────────────────────────

export default function Home() {
  const [view, setView] = useState<'list' | 'report'>('list');
  const [activeType, setActiveType] = useState<ReportType>('ui');
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [iframeKey, setIframeKey] = useState(0);

  const refreshRuns = useCallback(() => {
    fetch('/runs.json?_=' + Date.now()).then(r => r.json()).then(d => setRuns(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => { refreshRuns(); }, [refreshRuns]);

  const onReady = useCallback(() => { setIframeKey(k => k + 1); refreshRuns(); }, [refreshRuns]);

  const ui = useTestRunner('ui', onReady);
  const api = useTestRunner('api', onReady);

  const openReport = (type: ReportType) => { setActiveType(type); setView('report'); };
  const runner = activeType === 'ui' ? ui : api;
  const reportSrc = activeType === 'ui' ? '/ui-report/index.html' : '/api-report.html';

  const liveRows: (RunEntry & { live: true })[] = (['ui', 'api'] as const)
    .filter(t => { const r = t === 'ui' ? ui : api; return r.status === 'queued' || r.status === 'in_progress' || r.publishing; })
    .map(t => ({ id: `live-${t}`, type: t, status: 'passed' as const, date: new Date().toISOString(), live: true }));

  const allRows = [...liveRows, ...runs];
  const isPublishing = ui.publishing || api.publishing;
  const errorMsg = ui.error || api.error;

  const total = runs.length;
  const passed = runs.filter(r => r.status === 'passed').length;
  const passRate = total ? Math.round((passed / total) * 100) : null;

  // ── REPORT VIEW ──────────────────────────────────────────────────────
  if (view === 'report') {
    return (
      <main style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: T.bg }}>
        <header className="qa-report-header" style={gradientHeader}>
          <button onClick={() => setView('list')} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '6px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>← Runs</button>
          <span style={{ fontSize: 16 }}>🎭</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#fff', whiteSpace: 'nowrap' }}>{activeType.toUpperCase()} Report</span>
          <div className="qa-report-actions">
            <InlineBadge runner={runner} />
            {runner.runUrl && <a href={runner.runUrl} target="_blank" rel="noreferrer" className="qa-hide-mobile" style={{ fontSize: 12, color: '#c7d2fe', textDecoration: 'none', whiteSpace: 'nowrap' }}>View run ↗</a>}
            {activeType === 'api' && <a href="/api-logs.html" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#c7d2fe', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.3)', padding: '5px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>Logs ↗</a>}
            <RunBtn runner={runner} label={`Run ${activeType.toUpperCase()} Tests`} />
            <a href={reportSrc} target="_blank" rel="noreferrer" className="qa-hide-mobile" style={{ fontSize: 13, color: '#c7d2fe', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.3)', padding: '5px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}>Open ↗</a>
          </div>
        </header>

        {runner.error && <div style={{ padding: '8px 16px', background: T.failedBg, color: T.failed, fontSize: 13, borderBottom: `1px solid #fecaca` }}>⚠ {runner.error}</div>}

        {runner.publishing && (
          <div style={{ position: 'relative', overflow: 'hidden', padding: '8px 16px', background: T.publishingBg, borderBottom: `1px solid #ddd6fe`, color: T.publishing, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Spinner size={13} color={T.publishing} />
            Deploying{runner.countdown !== null ? ` — auto-refreshing in ${runner.countdown}s` : '…'}
            <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${T.publishing},transparent)`, backgroundSize: '200% 100%', animation: 'qa-shimmer 2s linear infinite' }} />
          </div>
        )}

        <iframe key={`${reportSrc}-${iframeKey}`} src={reportSrc} style={{ flex: 1, border: 'none', width: '100%' }} title={`${activeType.toUpperCase()} Report`} />
      </main>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────
  return (
    <main style={{ minHeight: '100vh', background: T.bg }}>

      <header className="qa-header" style={gradientHeader}>
        <div className="qa-header-logo">
          <span style={{ fontSize: 22 }}>🎭</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', letterSpacing: '-0.01em' }}>Allocations QA</div>
            <div style={{ fontSize: 11, color: '#c7d2fe' }}>Test execution dashboard</div>
          </div>
        </div>

        <div className="qa-header-actions">
          <InlineBadge runner={ui} />
          <RunBtn runner={ui} label="Run UI Tests" />
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)' }} className="qa-hide-mobile" />
          <InlineBadge runner={api} />
          <RunBtn runner={api} label="Run API Tests" />
        </div>
      </header>

      {errorMsg && (
        <div style={{ padding: '10px 16px', background: T.failedBg, color: T.failed, fontSize: 13, borderBottom: `1px solid #fecaca` }}>
          ⚠ {errorMsg}
        </div>
      )}

      {isPublishing && (
        <div style={{ position: 'relative', overflow: 'hidden', padding: '10px 16px', background: T.publishingBg, borderBottom: `1px solid #ddd6fe`, color: T.publishing, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Spinner size={13} color={T.publishing} />
          <span>Deploying updated reports{(ui.publishing ? ui : api).countdown !== null ? ` — auto-refreshing in ${(ui.publishing ? ui : api).countdown}s` : '…'}</span>
          <BounceDots color={T.publishing} />
          <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${T.publishing},transparent)`, backgroundSize: '200% 100%', animation: 'qa-shimmer 2s linear infinite' }} />
        </div>
      )}

      <div className="qa-content">

        {/* summary cards */}
        {total > 0 && (
          <div className="qa-stats">
            {[
              { label: 'Total Runs', value: total, color: T.blue },
              { label: 'Passed',     value: passed, color: T.passed },
              { label: 'Failed',     value: total - passed, color: T.failed },
              { label: 'Pass Rate',  value: `${passRate}%`, color: passRate === 100 ? T.passed : passRate! >= 80 ? T.running : T.failed },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ ...card, padding: '14px 18px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* runs table */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.text }}>Test Runs</h2>
            {liveRows.length > 0 && <span style={{ fontSize: 11, color: T.running, fontWeight: 600, background: T.runningBg, padding: '2px 8px', borderRadius: 999 }}>● Live</span>}
          </div>

          {allRows.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: T.muted }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🚀</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 6 }}>No runs yet</div>
              <div style={{ fontSize: 13 }}>Tap <strong>Run UI Tests</strong> or <strong>Run API Tests</strong> to get started.</div>
            </div>
          ) : (
            <div className="qa-table-wrap">
              <table className="qa-table">
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '10px 18px', fontWeight: 600, fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', borderBottom: `1px solid ${T.border}` }}>Status</th>
                    <th style={{ padding: '10px 18px', fontWeight: 600, fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', borderBottom: `1px solid ${T.border}` }}>Type</th>
                    <th style={{ padding: '10px 18px', fontWeight: 600, fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', borderBottom: `1px solid ${T.border}` }}>Date & Time</th>
                    <th className="qa-hide-mobile" style={{ padding: '10px 18px', fontWeight: 600, fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', borderBottom: `1px solid ${T.border}` }}>GH Run</th>
                    <th style={{ padding: '10px 18px', borderBottom: `1px solid ${T.border}` }}></th>
                  </tr>
                </thead>
                <tbody>
                  {allRows.map((run, i) => {
                    const live = 'live' in run;
                    const rowBg = i % 2 ? '#f8fafc' : '#fff';
                    return (
                      <tr key={run.id}
                        style={{ borderBottom: i < allRows.length - 1 ? `1px solid ${T.border}` : 'none', background: rowBg, transition: 'background 0.1s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eef2ff'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = rowBg; }}>
                        <td style={{ padding: '13px 18px' }}>
                          {live
                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><PulseDot color={T.running} /><span style={{ color: T.running, fontWeight: 700 }}>Running…</span></span>
                            : pill(run.status === 'passed' ? T.passedBg : T.failedBg, run.status === 'passed' ? T.passed : T.failed, run.status === 'passed' ? '✓ Passed' : '✗ Failed')}
                        </td>
                        <td style={{ padding: '13px 18px' }}>
                          {pill(run.type === 'ui' ? T.uiBadgeBg : T.apiBadgeBg, run.type === 'ui' ? T.uiBadgeText : T.apiBadgeText, run.type.toUpperCase())}
                        </td>
                        <td style={{ padding: '13px 18px', color: T.muted, whiteSpace: 'nowrap' }}>
                          {live ? 'Just now…' : fmt(run.date)}
                        </td>
                        <td className="qa-hide-mobile" style={{ padding: '13px 18px' }}>
                          {!live && run.runUrl && <a href={run.runUrl} target="_blank" rel="noreferrer" style={{ color: T.faint, fontSize: 12, textDecoration: 'none', fontFamily: 'monospace' }}>#{String(run.id).slice(-8)} ↗</a>}
                        </td>
                        <td style={{ padding: '13px 18px', textAlign: 'right' }}>
                          {!live && (
                            <button onClick={() => openReport(run.type)} style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid ${T.border}`, background: 'transparent', color: T.blue, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              View →
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
