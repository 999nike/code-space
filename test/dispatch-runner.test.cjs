const test = require('node:test');
const assert = require('node:assert/strict');

require('../dispatch-package.js');
require('../dispatch-runner.js');

const { validate } = globalThis.CodeSpaceDispatchPackage;
const { createGrant, has, assertAllowed, startMock } = globalThis.CodeSpaceDispatchRunner;

function fixture() {
  return validate({
    format: 'office-dispatch-package',
    version: 1,
    packageId: 'sandbox-package-1',
    createdAt: '2026-08-11T15:00:00.000Z',
    sourceJobId: 'sandbox-job-1',
    jobTitle: 'Sandbox UI Flow Test',
    instructions: 'Inspect only.',
    priority: 'Medium',
    jobStatusAtSnapshot: 'Ready',
    sandboxTarget: 'office-app',
    worker: { id: 'sandbox-worker-1', name: 'Test Worker Alpha', role: 'Reviewer' },
    capabilities: {
      allowed: [
        { key: 'readFiles', label: 'Read files' },
        { key: 'runTests', label: 'Run tests' },
        { key: 'proposeResult', label: 'Propose result / handoff' }
      ],
      explicitlyDenied: [{ key: 'modifyFiles', label: 'Modify files' }],
      notGranted: [{ key: 'useTerminal', label: 'Use terminal' }]
    },
    resultHandoffPermissionState: 'Allowed',
    packageStatus: 'Ready'
  });
}

test('runner grant exposes only allowed capabilities', () => {
  const grant = createGrant(fixture());
  assert.deepEqual(grant.allowed, ['readFiles', 'runTests', 'proposeResult']);
  assert.equal(has(grant, 'readFiles'), true);
  assert.equal(has(grant, 'modifyFiles'), false);
  assert.equal(has(grant, 'useTerminal'), false);
  assert.deepEqual(Object.keys(grant.capabilities), ['readFiles', 'runTests', 'proposeResult']);
});

test('denied or not-granted capabilities fail closed', () => {
  const grant = createGrant(fixture());
  assert.throws(() => assertAllowed(grant, 'modifyFiles'), /not granted/i);
  assert.throws(() => assertAllowed(grant, 'useTerminal'), /not granted/i);
  assert.equal(assertAllowed(grant, 'runTests'), true);
});

test('mock start contains no execution APIs', () => {
  const session = startMock(fixture());
  assert.equal(session.mode, 'mock');
  assert.equal(session.packageId, 'sandbox-package-1');
  assert.equal(typeof session.grant, 'object');
  assert.equal('terminal' in session, false);
  assert.equal('filesystem' in session, false);
  assert.equal('fetch' in session, false);
  assert.equal('agent' in session, false);
});
