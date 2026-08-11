const test = require('node:test');
const assert = require('node:assert/strict');

const store = new Map();
globalThis.localStorage = {
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); }
};

require('../dispatch-results.js');

const Results = globalThis.CodeSpaceDispatchResults;

const pkg = {
  packageId: 'sandbox-package-1',
  sourceJobId: 'sandbox-job-1',
  worker: { id: 'sandbox-worker-1', name: 'Test Worker Alpha' }
};
const session = {
  startedAt: '2026-08-11T15:30:00.000Z',
  grant: {
    allowed: ['readFiles', 'runTests', 'proposeResult'],
    capabilities: { readFiles: true, runTests: true, proposeResult: true }
  }
};

test('start persists a passive Running result record', () => {
  const record = Results.start(pkg, session);
  assert.equal(record.status, 'Running');
  assert.deepEqual(record.filesInspected, []);
  assert.deepEqual(record.testsRun, []);
  assert.deepEqual(record.capabilityGrant, ['readFiles', 'runTests', 'proposeResult']);
  assert.equal(Results.latestForPackage(pkg.packageId).taskId, record.taskId);
});

test('completion updates the same persisted record', () => {
  const running = Results.latestForPackage(pkg.packageId);
  const completed = Results.complete(running.taskId);
  assert.equal(completed.status, 'Completed');
  assert.ok(completed.completedAt);
  assert.equal(Results.latestForPackage(pkg.packageId).status, 'Completed');
});
