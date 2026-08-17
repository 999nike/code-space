'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { CODEX_WORKER_ID, CODEX_WORKER_NAME, assertCodexGrant, codexArgs, runCodexDispatchTask } = require('../dispatch-codex-worker.js');

function fixture(overrides = {}) {
  return {
    format: 'office-dispatch-package', version: 1, packageId: 'codex-package-1', sourceJobId: 'job-1',
    instructions: 'Inspect the sandbox and report the result.', sandboxTarget: 'agent-sandbox-test', packageStatus: 'Ready',
    worker: { id: 'worker-codex', name: CODEX_WORKER_NAME, role: 'Coding Agent' },
    capabilities: {
      allowed: [{ key: 'readFiles' }, { key: 'proposeResult' }],
      explicitlyDenied: [{ key: 'modifyFiles' }],
      notGranted: [{ key: 'runTests' }, { key: 'useTerminal' }]
    },
    ...overrides
  };
}

test('Codex worker grants full project access for ready Codex jobs', () => {
  const grant = assertCodexGrant(fixture());
  assert.equal(grant.modifyFiles, true);
  assert.deepEqual(grant.allowed, ['readFiles', 'modifyFiles', 'runTests', 'useTerminal', 'proposeResult']);
  assert.equal(assertCodexGrant(fixture({ worker: { id: CODEX_WORKER_ID, name: 'Renamed display label', role: 'Coding Agent' } })).modifyFiles, true);
  assert.throws(() => assertCodexGrant(fixture({ worker: { id: 'other', name: 'Test Worker Alpha', role: 'Coding Agent' } })), /routing/i);
  assert.throws(() => assertCodexGrant(fixture({ sandboxTarget: '../office-app' })), /restricted to agent-sandbox-test/i);
  assert.deepEqual(codexArgs(), ['--ask-for-approval', 'never', 'exec', '--ephemeral', '--sandbox', 'workspace-write', '--cd', '/mnt/e/WIZZ-Server/workspaces/agent-sandbox-test', '--skip-git-repo-check', '--color', 'never', '-']);
});

test('Codex worker reads and writes the project directly without a preloaded file-size limit', async () => {
  const calls = [];
  const spawn = (command, args, options) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { end(value) { calls.push({ stdin: value }); } };
    child.kill = () => {};
    calls.push({ command, args, options });
    queueMicrotask(() => {
      child.stdout.emit('data', 'Codex final response');
      child.stderr.emit('data', 'diagnostic');
      child.emit('close', 0, null);
    });
    return child;
  };

  const result = await runCodexDispatchTask(fixture(), {
    root: 'E:\\WIZZ-Server\\workspaces',
    platform: 'win32',
    stat: async (target) => target.endsWith('agent-sandbox-test') ? { isDirectory: () => true } : null,
    spawn,
    timeoutMs: 500
  });

  assert.equal(calls[0].command, 'wsl.exe');
  assert.deepEqual(calls[0].args, ['-d', 'Ubuntu', '--', '/home/wizz/.local/bin/codex', ...codexArgs()]);
  assert.equal(calls[0].options.shell, false);
  assert.match(calls[1].stdin, /Office job instructions:\nInspect the sandbox/);
  assert.match(calls[1].stdin, /full project access/i);
  assert.match(calls[1].stdin, /does not pre-copy or size-limit project files/i);
  assert.deepEqual(result.capabilityGrant, ['readFiles', 'modifyFiles', 'runTests', 'useTerminal', 'proposeResult']);
  assert.equal(result.sandboxMode, 'workspace-write');
  assert.deepEqual(result.filesInspected, []);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, 'Codex final response');
  assert.equal(result.stderr, 'diagnostic');
});
