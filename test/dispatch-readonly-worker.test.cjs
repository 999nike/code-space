const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs/promises');

const { assertSafeGrant, resolveSandbox, runReadOnlyDispatchTask } = require('../dispatch-readonly-worker.js');

function fixture(overrides = {}) {
  return {
    format: 'office-dispatch-package',
    version: 1,
    packageId: 'real-worker-package-1',
    createdAt: '2026-08-11T12:00:00.000Z',
    sourceJobId: 'job-1',
    jobTitle: 'Agent Sandbox Read Test',
    instructions: 'Read files, run the approved test, report the result. Do not modify files.',
    priority: 'Medium',
    jobStatusAtSnapshot: 'Ready',
    sandboxTarget: 'agent-sandbox-test',
    worker: { id: 'worker-1', name: 'Test Worker Alpha', role: 'Coding Worker' },
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
    packageStatus: 'Ready',
    ...overrides
  };
}

test('read-only worker accepts only the intended capability grant', () => {
  const grant = assertSafeGrant(fixture());
  assert.deepEqual(grant.allowed, ['readFiles', 'runTests', 'proposeResult']);

  const unsafe = fixture({
    capabilities: {
      allowed: [
        { key: 'readFiles' },
        { key: 'runTests' },
        { key: 'proposeResult' },
        { key: 'modifyFiles' }
      ],
      explicitlyDenied: [],
      notGranted: [{ key: 'useTerminal' }]
    }
  });
  assert.throws(() => assertSafeGrant(unsafe), /refuses modifyFiles/i);
});

test('sandbox resolution allows one direct workspace folder only', () => {
  const root = path.resolve('C:\\sandbox-root');
  assert.equal(resolveSandbox(root, 'agent-sandbox-test'), path.resolve(root, 'agent-sandbox-test'));
  assert.throws(() => resolveSandbox(root, '..\\escape'), /direct workspace folder/i);
  assert.throws(() => resolveSandbox(root, 'nested/project'), /direct workspace folder/i);
});

test('real worker reads direct files and runs only the detected Node test file', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'code-space-worker-'));
  const sandbox = path.join(root, 'agent-sandbox-test');
  await fs.mkdir(sandbox);
  await fs.writeFile(path.join(sandbox, 'math.js'), "function add(a, b) { return a + b; }\nmodule.exports = { add };\n");
  await fs.writeFile(path.join(sandbox, 'math.test.js'), "const assert = require('node:assert');\nconst { add } = require('./math');\nassert.equal(add(2, 3), 5);\nconsole.log('Test passed');\n");
  await fs.mkdir(path.join(sandbox, 'nested'));
  await fs.writeFile(path.join(sandbox, 'nested', 'ignored.js'), 'throw new Error(\"must not be read\");\n');

  const result = await runReadOnlyDispatchTask(fixture(), { root });
  assert.equal(result.mode, 'read-only-worker');
  assert.deepEqual(result.filesInspected.map((item) => item.name), ['math.js', 'math.test.js']);
  assert.equal(result.testsRun.length, 1);
  assert.equal(result.testsRun[0].file, 'math.test.js');
  assert.equal(result.testsRun[0].passed, true);
  assert.match(result.summary, /defines function: add/i);
  assert.match(result.summary, /test passed/i);
  assert.equal(result.capabilityGrant.includes('modifyFiles'), false);
  assert.equal(result.capabilityGrant.includes('useTerminal'), false);

  await fs.rm(root, { recursive: true, force: true });
});
