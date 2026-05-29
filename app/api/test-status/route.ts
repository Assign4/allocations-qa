import { NextResponse } from 'next/server';

const REPO = 'Assign4/allocations-qa';
const WORKFLOW = 'run-tests.yml';

export async function GET() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({ status: 'idle' });
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    return NextResponse.json({ status: 'idle' });
  }

  const data = await res.json();
  const run = data.workflow_runs?.[0];

  if (!run) {
    return NextResponse.json({ status: 'idle' });
  }

  return NextResponse.json({
    status: run.status as string,
    conclusion: run.conclusion as string | null,
    html_url: run.html_url as string,
    updated_at: run.updated_at as string,
  });
}
