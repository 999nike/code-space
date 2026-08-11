const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

const { OUTPUT_CONTENT, OUTPUT_FILE, assertWriteGrant, resolveWriteTarget, runWriteDispatchTask } = require('../dispatch-write-worker.js');

function fixture(overrides = {}) {
  return {
    format: 'office-dispatch-package', version: 1, packageId: 'write-package-1', sourceJobId: 'write-job-1', sandboxTarget: 'agent-sandbox-test', packageStatus: 'Ready',
    capabilities: {
      allowed: [{ key: 'readFiles' }, { key: 'modifyFiles' }, { key: 'proposeResult' }],
      explicitlyDenied: [],
      notGranted: [{ key: 'runTests' }, { key: 'useTerminal' }]
    },
    ...overrides
  };
}

test('allowed write creates only the requested file inside the sandbox', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'code-space-write-'));
  const sandbox = path.join(root, 'agent-sandbox-test');
  await fs.mkdir(sandbox);
  try {
    const result = await runWriteDispatchTask(fixture(), { root });
    assert.equal(await fs.readFile(path.join(sandbox, OUTPUT_FILE), 'utf8'), OUTPUT_CONTENT);
    assert.deepEqual(result.filesCreated.map((file) => file.name), [OUTPUT_FILE]);
    assert.deepEqual(await fs.readdir(sandbox), [OUTPUT_FILE]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('modifyFiles denied rejects the write', () => {
  const denied = fixture({ capabilities: { allowed: [{ key: 'readFiles' }, { key: 'proposeResult' }], explicitlyDenied: [{ key: 'modifyFiles' }], notGranted: [{ key: 'runTests' }, { key: 'useTerminal' }] } });
  assert.throws(() => assertWriteGrant(denied), /modifyFiles must be explicitly allowed/i);
});

test('path traversal and non-sandbox targets are rejected', () => {
  assert.throws(() => resolveWriteTarget('/tmp/root', '../agent-sandbox-test'), /restricted/i);
  assert.throws(() => resolveWriteTarget('/tmp/root', 'other-project'), /restricted/i);
});

test('terminal remains unavailable to the write worker', () => {
  const terminal = fixture({ capabilities: { allowed: [{ key: 'modifyFiles' }, { key: 'proposeResult' }, { key: 'useTerminal' }], explicitlyDenied: [], notGranted: [{ key: 'readFiles' }, { key: 'runTests' }] } });
  assert.throws(() => assertWriteGrant(terminal), /refuses terminal/i);
});
