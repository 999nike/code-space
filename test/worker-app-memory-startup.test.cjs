'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const supervisor = fs.readFileSync(path.join(__dirname, '..', 'worker-app-supervisor.js'), 'utf8');

test('Memory Bridge is health-checked, then started only through its scheduled task', () => {
  assert.match(supervisor, /memoryBridge: \{ name: 'Memory Bridge', port: 8787, url: 'http:\/\/127\.0\.0\.1:8787' \}/);
  assert.match(supervisor, /async function ensureMemoryBridge\(\)/);
  assert.match(supervisor, /if \(await reachable\(SERVICES\.memoryBridge\.port\)\) return \{ running: true, started: false \}/);
  assert.match(supervisor, /Start-ScheduledTask -TaskName 'Memory Space Bridge' -ErrorAction Stop/);
  assert.match(supervisor, /waitFor\(SERVICES\.memoryBridge\.port, 30000\)/);
  assert.doesNotMatch(supervisor, /server-v2\.mjs/);
});

test('Office receives a derived local Memory job-feed credential from the protected Bridge helper', () => {
  assert.match(supervisor, /get-office-job-feed\.ps1/);
  assert.match(supervisor, /async function getOfficeMemoryFeed\(\)/);
  assert.match(supervisor, /MEMORY_SPACE_JOB_FEED_URL: feed\.url/);
  assert.match(supervisor, /MEMORY_SPACE_JOB_FEED_TOKEN: feed\.token/);
  assert.match(supervisor, /async function officeHasMemoryFeed\(\)/);
  assert.match(supervisor, /async function stopOfficeListener\(\)/);
});

test('Memory Space is health-checked and served with the installed Python static server', () => {
  assert.match(supervisor, /memorySpace: \{ name: 'Memory Space', port: 8001, url: 'http:\/\/127\.0\.0\.1:8001' \}/);
  assert.match(supervisor, /async function ensureMemorySpace\(\)/);
  assert.match(supervisor, /if \(await reachable\(SERVICES\.memorySpace\.port\)\) return \{ running: true, started: false \}/);
  assert.match(supervisor, /detached\('python', \[\s*'-m', 'http\.server', String\(SERVICES\.memorySpace\.port\), '--bind', HOST\s*\], \{ cwd: MEMORY_APP_DIR \}\)/);
  assert.match(supervisor, /if \(memorySpace\.running\) openBrowserTab\(SERVICES\.memorySpace\.url\);/);
  assert.ok(
    supervisor.indexOf('openBrowserTab(SERVICES.memorySpace.url)')
      < supervisor.indexOf('openBrowserTab(SERVICES.codeSpace.url)'),
    'Memory Space should open in its own tab before the existing Code Space/Office pair'
  );
});
