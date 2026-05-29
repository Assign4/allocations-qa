#!/usr/bin/env node
// Called by GitHub Actions workflows to prepend a run entry to public/runs.json
// Usage: node scripts/update-runs.js <ui|api> <success|failure>

const fs = require('fs');
const path = require('path');

const [, , type, outcome] = process.argv;
if (!type || !outcome) {
  console.error('Usage: update-runs.js <ui|api> <success|failure>');
  process.exit(1);
}

const runsPath = path.join('public', 'runs.json');
let runs = [];
try {
  runs = JSON.parse(fs.readFileSync(runsPath, 'utf8'));
} catch (_) {}
if (!Array.isArray(runs)) runs = [];

const {
  GITHUB_RUN_ID,
  GITHUB_SERVER_URL,
  GITHUB_REPOSITORY,
} = process.env;

runs.unshift({
  id: GITHUB_RUN_ID || String(Date.now()),
  type,
  status: outcome === 'success' ? 'passed' : 'failed',
  date: new Date().toISOString(),
  runUrl: GITHUB_RUN_ID
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : null,
});

fs.writeFileSync(runsPath, JSON.stringify(runs.slice(0, 50), null, 2));
console.log(`runs.json updated: ${type} → ${outcome}`);
