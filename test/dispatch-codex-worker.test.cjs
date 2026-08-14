'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { CODEX_WORKER_ID, CODEX_WORKER_NAME, MAX_READ_INPUT_BYTES, assertCodexGrant, authorizedReadInput, codexArgs, runCodexDispatchTask } = require('../dispatch-codex-worker.js');

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

test('Codex worker accepts the Code Space terminal grant', () => {
  assert.equal(assertCodexGrant(fixture()).modifyFiles, false);
  assert.equal(assertCodexGrant(fixture({ worker: { id: CODEX_WORKER_ID, name: 'Renamed display label', role: 'Coding Agent' } })).modifyFiles, false);
  assert.throws(() => assertCodexGrant(fixture({ worker: { id: 'other', name: 'Test Worker Alpha', role: 'Coding Agent' } })), /routing/i);
  assert.equal(assertCodexGrant(fixture({ capabilities: {
    allowed: [{ key: 'readFiles' }, { key: 'useTerminal' }, { key: 'proposeResult' }],
    explicitlyDenied: [{ key: 'modifyFiles' }],
    notGranted: [{ key: 'runTests' }]
  } })).modifyFiles, false);
  assert.throws(() => assertCodexGrant(fixture({ capabilities: {
    allowed: [{ key: 'proposeResult' }],
    explicitlyDenied: [{ key: 'modifyFiles' }],
    notGranted: [{ key: 'readFiles' }, { key: 'runTests' }, { key: 'useTerminal' }]
  } })), /requires readFiles/i);
  assert.throws(() => assertCodexGrant(fixture({ sandboxTarget: '../office-app' })), /restricted to agent-sandbox-test/i);
  assert.deepEqual(codexArgs(false), ['--ask-for-approval', 'never', 'exec', '--ephemeral', '--ignore-user-config', '--disable', 'plugins', '--sandbox', 'read-only', '--cd', '/mnt/e/WIZZ-Server/workspaces/agent-sandbox-test', '--skip-git-repo-check', '--color', 'never', '-']);
  assert.deepEqual(codexArgs(true), ['--ask-for-approval', 'never', 'exec', '--ephemeral', '--ignore-user-config', '--disable', 'plugins', '--sandbox', 'workspace-write', '--cd', '/mnt/e/WIZZ-Server/workspaces/agent-sandbox-test', '--skip-git-repo-check', '--color', 'never', '-']);
});

test('Codex worker receives only Code Space mediated direct file contents and captures process output', async () => {
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
    stat: async (target) => target.endsWith('agent-sandbox-test') ? { isDirectory: () => true } : { size: 21 },
    readdir: async () => [
      { name: 'math.js', isFile: () => true },
      { name: 'nested', isFile: () => false },
      { name: '../outside.js', isFile: () => true },
      { name: 'ignored.exe', isFile: () => true }
    ],
    readFile: async (target) => {
      assert.match(target, /agent-sandbox-test[\\/]math\.js$/);
      return 'export function add(a, b) { return a + b; }';
    },
    spawn,
    timeoutMs: 500
  });
  assert.equal(calls[0].command, 'wsl.exe');
  assert.deepEqual(calls[0].args, ['-d', 'Ubuntu', '--', '/home/wizz/.local/bin/codex', ...codexArgs(false)]);
  assert.equal(calls[0].options.shell, false);
  assert.match(calls[1].stdin, /Frozen Office job instructions:\nInspect the sandbox/);
  assert.match(calls[1].stdin, /Use terminal is authorised only within the fixed Code Space sandboxed Codex launcher/);
  assert.match(calls[1].stdin, /BEGIN AUTHORIZED FILE: math\.js/);
  assert.match(calls[1].stdin, /export function add/);
  assert.doesNotMatch(calls[1].stdin, /outside\.js|ignored\.exe/);
  assert.deepEqual(result.filesInspected, [{ name: 'math.js', bytes: Buffer.byteLength('export function add(a, b) { return a + b; }') }]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, 'Codex final response');
  assert.equal(result.stderr, 'diagnostic');
});

test('Codex read input has a bounded total size and does not accept empty input', () => {
  const exact = 'x'.repeat(MAX_READ_INPUT_BYTES);
  const input = authorizedReadInput([{ name: 'safe.txt', content: exact }]);
  assert.equal(input.totalBytes, MAX_READ_INPUT_BYTES);
  assert.deepEqual(input.files.map((file) => file.name), ['safe.txt']);
  assert.throws(() => authorizedReadInput([{ name: 'too-large.txt', content: `${exact}x` }]), /read-input limit/i);
});
