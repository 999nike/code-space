const test = require('node:test');
const assert = require('node:assert/strict');

require('../dispatch-package.js');

const { parse, validate } = globalThis.CodeSpaceDispatchPackage;
const valid = {
  format: 'office-dispatch-package',
  version: 1,
  packageId: 'sandbox-package-1',
  createdAt: '2026-08-11T15:00:00.000Z',
  sourceJobId: 'sandbox-job-1',
  jobTitle: 'Sandbox validation fixture',
  instructions: 'Display only; do not execute.',
  priority: 'Medium',
  jobStatusAtSnapshot: 'Ready',
  sandboxTarget: 'sandbox-target',
  worker: { id: 'sandbox-worker-1', name: 'Sandbox Worker', role: 'Reviewer' },
  capabilities: {
    allowed: [{ key: 'readFiles', label: 'Read files' }],
    explicitlyDenied: [{ key: 'useTerminal', label: 'Use terminal' }],
    notGranted: [
      { key: 'modifyFiles', label: 'Modify files' },
      { key: 'runTests', label: 'Run tests' },
      { key: 'proposeResult', label: 'Propose result / handoff' }
    ]
  },
  resultHandoffPermissionState: 'Not granted',
  packageStatus: 'Ready'
};

test('accepts a valid Office v1 Ready package', () => {
  const accepted = parse(JSON.stringify(valid));
  assert.equal(accepted.packageId, valid.packageId);
  assert.equal(accepted.capabilities.explicitlyDenied[0].key, 'useTerminal');
});

test('applies the Code Space read-only profile to a permission-free Office package', () => {
  const permissionFree = { ...valid };
  delete permissionFree.capabilities;
  delete permissionFree.resultHandoffPermissionState;
  const accepted = validate(permissionFree);
  assert.deepEqual(accepted.capabilities.allowed.map((item) => item.key), ['readFiles', 'useTerminal', 'proposeResult']);
  assert.deepEqual(accepted.capabilities.notGranted.map((item) => item.key), ['modifyFiles', 'runTests']);
  assert.equal(accepted.resultHandoffPermissionState, 'Code Space authorisation required');
});

test('rejects malformed JSON and contract failures', () => {
  assert.throws(() => parse('{'), /valid JSON/i);
  assert.throws(() => validate({ ...valid, format: 'other' }), /format/i);
  assert.throws(() => validate({ ...valid, version: 2 }), /version/i);
  assert.throws(() => validate({ ...valid, packageStatus: 'Draft' }), /Ready/i);
  assert.throws(() => validate({ ...valid, worker: {} }), /worker.id/i);
  assert.throws(() => validate({ ...valid, capabilities: {} }), /allowed/i);
});

test('rejects unknown and conflicting capabilities', () => {
  const unknown = structuredClone(valid);
  unknown.capabilities.notGranted[0].key = 'unknownCapability';
  assert.throws(() => validate(unknown), /Unsupported capability/i);
  const conflict = structuredClone(valid);
  conflict.capabilities.allowed.push({ key: 'useTerminal', label: 'Use terminal' });
  assert.throws(() => validate(conflict), /conflicting/i);
});

test('accepted package is independent of later input mutation', () => {
  const input = structuredClone(valid);
  const accepted = validate(input);
  input.instructions = 'Changed later';
  input.worker.name = 'Changed later';
  input.capabilities.allowed[0].label = 'Changed later';
  assert.equal(accepted.instructions, valid.instructions);
  assert.equal(accepted.worker.name, valid.worker.name);
  assert.equal(accepted.capabilities.allowed[0].label, 'Read files');
});
