export default function Home() {
  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{
        padding: '12px 24px',
        background: '#1e293b',
        borderBottom: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '20px' }}>🎭</span>
        <span style={{ fontWeight: 600, fontSize: '16px', color: '#f1f5f9' }}>
          Allocations QA — Playwright Test Report
        </span>
        <a
          href="/report.html"
          target="_blank"
          rel="noreferrer"
          style={{
            marginLeft: 'auto',
            fontSize: '13px',
            color: '#94a3b8',
            textDecoration: 'none',
            border: '1px solid #334155',
            padding: '4px 10px',
            borderRadius: '6px',
          }}
        >
          Open full screen ↗
        </a>
      </header>
      <iframe
        src="/report.html"
        style={{ flex: 1, border: 'none', width: '100%' }}
        title="Playwright Test Report"
      />
    </main>
  );
}
