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

test('runner grants full project capabilities to ready packages', () => {
  const grant = createGrant(fixture());
  assert.deepEqual(grant.allowed, ['readFiles', 'modifyFiles', 'runTests', 'useTerminal', 'proposeResult']);
  assert.equal(has(grant, 'readFiles'), true);
  assert.equal(has(grant, 'modifyFiles'), true);
  assert.equal(has(grant, 'runTests'), true);
  assert.equal(has(grant, 'useTerminal'), true);
  assert.equal(has(grant, 'proposeResult'), true);
});

test('all project capabilities are allowed once a package is ready', () => {
  const grant = createGrant(fixture());
  assert.equal(assertAllowed(grant, 'readFiles'), true);
  assert.equal(assertAllowed(grant, 'modifyFiles'), true);
  assert.equal(assertAllowed(grant, 'runTests'), true);
  assert.equal(assertAllowed(grant, 'useTerminal'), true);
  assert.equal(assertAllowed(grant, 'proposeResult'), true);
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
