'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');

const CODEX_WORKER_NAME = 'Codex';
const CODEX_WORKER_ID = 'builtin:codex';
const SANDBOX_TARGET = 'agent-sandbox-test';
const WSL_SANDBOX_PATH = '/mnt/e/WIZZ-Server/workspaces/agent-sandbox-test';
const CODEX_COMMAND = '/home/wizz/.local/bin/codex';
const KNOWN_CAPABILITIES = ['readFiles', 'modifyFiles', 'runTests', 'useTerminal', 'proposeResult'];
const MAX_OUTPUT = 128 * 1024;
const TIMEOUT_MS = 10 * 60 * 1000;

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function isCodexWorker(packageSnapshot) {
  return String(packageSnapshot?.worker?.id || '').trim() === CODEX_WORKER_ID
    || String(packageSnapshot?.worker?.name || '').trim() === CODEX_WORKER_NAME;
}

function assertCodexGrant(packageSnapshot) {
  if (!packageSnapshot || packageSnapshot.format !== 'office-dispatch-package' || packageSnapshot.version !== 1) throw new Error('Unsupported dispatch package.');
  if (packageSnapshot.packageStatus !== 'Ready') throw new Error('Only Ready dispatch packages can execute.');
  if (!isCodexWorker(packageSnapshot)) throw new Error(`Codex routing requires the selected worker name to be ${CODEX_WORKER_NAME}.`);
  if (text(packageSnapshot.sandboxTarget, 'sandboxTarget') !== SANDBOX_TARGET) throw new Error(`Codex worker is restricted to ${SANDBOX_TARGET}.`);

  return Object.freeze({
    allowed: Object.freeze([...KNOWN_CAPABILITIES]),
    modifyFiles: true
  });
}

function codexArgs() {
  return [
    '--ask-for-approval', 'never',
    'exec',
    '--ephemeral',
    '--sandbox', 'workspace-write',
    '--cd', WSL_SANDBOX_PATH,
    '--skip-git-repo-check',
    '--color', 'never',
    '-'
  ];
}

function commandFor(platform) {
  return platform === 'win32'
    ? { command: 'wsl.exe', args: ['-d', 'Ubuntu', '--', CODEX_COMMAND] }
    : { command: CODEX_COMMAND, args: [] };
}

function boundedAppend(current, chunk) {
  if (current.length >= MAX_OUTPUT) return current;
  return `${current}${String(chunk)}`.slice(0, MAX_OUTPUT);
}

function runProcess(command, args, input, options = {}) {
  const start = options.spawn || spawn;
  const timeoutMs = options.timeoutMs || TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const child = start(command, args, { cwd: options.cwd, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.stdout.on('data', (chunk) => { stdout = boundedAppend(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = boundedAppend(stderr, chunk); });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ exitCode: Number.isInteger(code) ? code : null, signal: signal || null, timedOut, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

function promptFor(packageSnapshot, grant) {
  const permissionSummary = KNOWN_CAPABILITIES.map((key) => `${key}: Allowed`).join('\n');
  return [
    'You are the Codex worker for an explicitly authorised Office dispatch package.',
    `Work from the current project directory (${SANDBOX_TARGET}).`,
    'You have full project access: read files, modify/create/delete files, use the terminal, and run relevant tests as needed to complete the task.',
    'Inspect the project directly. Code Space does not pre-copy or size-limit project files for you.',
    'The Code Space execution grant is:',
    permissionSummary,
    'Complete the requested work rather than stopping for per-file or per-command permission checks.',
    'Report the work performed and tests run in your final response.',
    '',
    'Office job instructions:',
    text(packageSnapshot.instructions, 'instructions')
  ].join('\n');
}

async function runCodexDispatchTask(packageSnapshot, options = {}) {
  const grant = assertCodexGrant(packageSnapshot);
  const root = path.resolve(options.root || process.cwd());
  const sandbox = path.resolve(root, SANDBOX_TARGET);
  if (path.dirname(sandbox) !== root) throw new Error('Codex sandbox escaped the approved workspace root.');
  const stat = options.stat || fs.stat;
  if (!(await stat(sandbox).catch(() => null))?.isDirectory()) throw new Error('The requested sandbox project does not exist.');

  const launch = commandFor(options.platform || process.platform);
  const output = await runProcess(launch.command, [...launch.args, ...codexArgs()], promptFor(packageSnapshot, grant), {
    cwd: sandbox, spawn: options.spawn, timeoutMs: options.timeoutMs
  });
  const succeeded = output.exitCode === 0 && !output.timedOut;
  return {
    mode: 'codex-worker',
    packageId: text(packageSnapshot.packageId, 'packageId'),
    sandboxTarget: SANDBOX_TARGET,
    capabilityGrant: [...grant.allowed],
    sandboxMode: 'workspace-write',
    filesInspected: [],
    exitCode: output.exitCode,
    signal: output.signal,
    timedOut: output.timedOut,
    stdout: output.stdout,
    stderr: output.stderr,
    summary: succeeded ? 'Codex worker completed successfully.' : `Codex worker exited unsuccessfully${output.exitCode === null ? '' : ` with status ${output.exitCode}`}.`,
    proposedResult: output.stdout.trim() || output.stderr.trim() || 'Codex produced no terminal output.',
    completedAt: new Date().toISOString()
  };
}

module.exports = {
  CODEX_WORKER_NAME,
  CODEX_WORKER_ID,
  SANDBOX_TARGET,
  WSL_SANDBOX_PATH,
  isCodexWorker,
  assertCodexGrant,
  codexArgs,
  commandFor,
  promptFor,
  runProcess,
  runCodexDispatchTask
};
