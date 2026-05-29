import { NextResponse } from 'next/server';

const REPO = 'Assign4/allocations-qa';
const WORKFLOWS = {
  ui: 'run-ui-tests.yml',
  api: 'run-api-tests.yml',
} as const;

export async function POST(request: Request) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'GITHUB_TOKEN is not set in Vercel environment variables.' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as keyof typeof WORKFLOWS | null;
  const workflow = type && WORKFLOWS[type];

  if (!workflow) {
    return NextResponse.json({ error: 'Missing ?type=ui or ?type=api' }, { status: 400 });
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`,
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

  if (res.status === 204) return NextResponse.json({ ok: true });

  const body = await res.text();
  return NextResponse.json({ error: body }, { status: res.status });
}
