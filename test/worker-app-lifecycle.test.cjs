'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const supervisor = fs.readFileSync(path.join(root, 'worker-app-supervisor.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

test('explicit lifecycle shutdown is ordered and narrowly managed', () => {
  const shutdown = supervisor.slice(supervisor.indexOf('async function stopWorkerApp'));
  assert.match(supervisor, /--stop-all/);
  assert.match(supervisor, /async function stopWorkerApp/);
  assert.ok(shutdown.indexOf('await stopCodeServer()') < shutdown.indexOf('await stopOfficeListener()'));
  assert.ok(shutdown.indexOf('await stopOfficeListener()') < shutdown.indexOf('await stopMemorySpace()'));
  assert.ok(shutdown.indexOf('await stopMemoryBridge()') < shutdown.indexOf('await stopCodeSpaceListener()'));
  assert.match(supervisor, /Stop-ScheduledTask -TaskName 'Memory Space Bridge'/);
  assert.match(supervisor, /listener is not managed Memory Space/);
  assert.match(supervisor, /fuser -n tcp 8080/);
  assert.match(supervisor, /code-server\*\) kill -TERM/);
  assert.doesNotMatch(supervisor, /wsl\.exe.*--shutdown/);
});

test('shutdown is explicit, guarded, and never tied to browser lifecycle', () => {
  assert.match(server, /pathname === '\/api\/worker-app\/shutdown'/);
  assert.match(server, /x-code-space-action/);
  assert.match(server, /SHUT_DOWN_WORKER_APP/);
  assert.match(app, /shutdownDialog\.showModal/);
  assert.match(app, /Shutting down Worker App/);
  assert.doesNotMatch(app, /beforeunload|unload|visibilitychange/);
});

test('silent launcher and runtime log ignores exist', () => {
  const vbs = fs.readFileSync(path.join(root, 'Start Worker App.vbs'), 'utf8');
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  assert.match(vbs, /WScript\.Shell/);
  assert.match(vbs, /, 0, False/);
  assert.match(ignore, /worker-app-code-server\.log/);
  assert.match(ignore, /worker-app-supervisor\.log/);
});
