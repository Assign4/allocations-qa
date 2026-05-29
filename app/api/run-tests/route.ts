import { NextResponse } from 'next/server';

const REPO = 'Assign4/allocations-qa';
const WORKFLOW = 'run-tests.yml';

export async function POST() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'GITHUB_TOKEN not configured' }, { status: 500 });
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    }
  );

  if (res.status === 204) {
    return NextResponse.json({ ok: true });
  }

  const body = await res.text();
  return NextResponse.json({ error: body }, { status: res.status });
}
