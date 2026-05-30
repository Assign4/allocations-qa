import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Allocations QA Dashboard',
  description: 'Playwright test results for allocations.com',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, sans-serif', background: '#f1f5f9', color: '#1e293b' }}>
        {children}
      </body>
    </html>
  );
}
