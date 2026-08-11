'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const MAX_FILES = 40;
const MAX_FILE_BYTES = 64 * 1024;
const MAX_OUTPUT = 64 * 1024;
const READABLE_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.json', '.md', '.txt']);
const TEST_PATTERN = /\.test\.(?:js|cjs|mjs)$/i;
const REQUIRED_ALLOWED = ['readFiles', 'runTests', 'proposeResult'];

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function capabilityKeys(packageSnapshot, group) {
  const items = packageSnapshot?.capabilities?.[group];
  if (!Array.isArray(items)) throw new Error(`capabilities.${group} must be an array.`);
  return items.map((item) => text(item?.key, `capabilities.${group}.key`));
}

function assertSafeGrant(packageSnapshot) {
  if (!packageSnapshot || packageSnapshot.format !== 'office-dispatch-package' || packageSnapshot.version !== 1) {
    throw new Error('Unsupported dispatch package.');
  }
  if (packageSnapshot.packageStatus !== 'Ready') throw new Error('Only Ready dispatch packages can execute.');

  const allowed = new Set(capabilityKeys(packageSnapshot, 'allowed'));
  const denied = new Set(capabilityKeys(packageSnapshot, 'explicitlyDenied'));
  const notGranted = new Set(capabilityKeys(packageSnapshot, 'notGranted'));

  for (const capability of REQUIRED_ALLOWED) {
    if (!allowed.has(capability)) throw new Error(`Required capability is not allowed: ${capability}.`);
  }
  if (allowed.has('modifyFiles') || allowed.has('useTerminal')) {
    throw new Error('Read-only worker refuses modifyFiles or useTerminal grants.');
  }
  if (!denied.has('modifyFiles')) throw new Error('modifyFiles must be explicitly denied for this worker.');
  if (!notGranted.has('useTerminal') && !denied.has('useTerminal')) {
    throw new Error('useTerminal must remain denied or not granted.');
  }
  return Object.freeze({ allowed: Object.freeze([...allowed]) });
}

function resolveSandbox(root, sandboxTarget) {
  const workspaceRoot = path.resolve(root);
  const name = text(sandboxTarget, 'sandboxTarget');
  if (name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
    throw new Error('sandboxTarget must be one direct workspace folder name.');
  }
  const target = path.resolve(workspaceRoot, name);
  if (path.dirname(target) !== workspaceRoot) throw new Error('sandboxTarget escaped the approved workspace root.');
  return target;
}

async function readDirectFiles(target, deps = {}) {
  const readdir = deps.readdir || fs.readdir;
  const readFile = deps.readFile || fs.readFile;
  const stat = deps.stat || fs.stat;
  const entries = await readdir(target, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && READABLE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort()
    .slice(0, MAX_FILES);

  const inspected = [];
  for (const name of files) {
    const fullPath = path.join(target, name);
    const info = await stat(fullPath);
    if (info.size > MAX_FILE_BYTES) continue;
    const content = await readFile(fullPath, 'utf8');
    inspected.push({ name, bytes: info.size, content });
  }
  return inspected;
}

async function runApprovedTest(target, files, deps = {}) {
  const testFile = files.map((item) => item.name).find((name) => TEST_PATTERN.test(name));
  if (!testFile) throw new Error('No approved direct *.test.js/*.test.cjs/*.test.mjs file was found.');

  const execute = deps.execFileAsync || execFileAsync;
  try {
    const result = await execute(process.execPath, ['--test', testFile], {
      cwd: target,
      windowsHide: true,
      timeout: 15000,
      maxBuffer: MAX_OUTPUT
    });
    return {
      command: `node --test ${testFile}`,
      file: testFile,
      passed: true,
      stdout: String(result?.stdout || '').slice(0, MAX_OUTPUT),
      stderr: String(result?.stderr || '').slice(0, MAX_OUTPUT)
    };
  } catch (error) {
    return {
      command: `node --test ${testFile}`,
      file: testFile,
      passed: false,
      stdout: String(error?.stdout || '').slice(0, MAX_OUTPUT),
      stderr: String(error?.stderr || error?.message || '').slice(0, MAX_OUTPUT)
    };
  }
}

function describeCode(files) {
  const codeFiles = files.filter((item) => /\.(?:js|cjs|mjs)$/i.test(item.name) && !TEST_PATTERN.test(item.name));
  const names = [];
  for (const file of codeFiles) {
    for (const match of file.content.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) names.push(match[1]);
  }
  const unique = [...new Set(names)];
  if (unique.length) return `Code inspected defines function${unique.length === 1 ? '' : 's'}: ${unique.join(', ')}.`;
  if (codeFiles.length) return `Inspected code file${codeFiles.length === 1 ? '' : 's'}: ${codeFiles.map((item) => item.name).join(', ')}.`;
  return 'No readable direct code file was found.';
}

async function runReadOnlyDispatchTask(packageSnapshot, options = {}) {
  const grant = assertSafeGrant(packageSnapshot);
  const root = path.resolve(options.root || process.cwd());
  const target = resolveSandbox(root, packageSnapshot.sandboxTarget);
  const stat = options.stat || fs.stat;
  const targetStat = await stat(target).catch(() => null);
  if (!targetStat?.isDirectory()) throw new Error('The requested sandbox project does not exist.');

  const files = await readDirectFiles(target, options);
  if (!files.length) throw new Error('The sandbox contains no readable direct test files.');
  const test = await runApprovedTest(target, files, options);
  const codeSummary = describeCode(files);
  const summary = `${codeSummary} ${test.passed ? 'Approved Node test passed.' : 'Approved Node test failed.'}`;

  return {
    mode: 'read-only-worker',
    packageId: text(packageSnapshot.packageId, 'packageId'),
    sandboxTarget: text(packageSnapshot.sandboxTarget, 'sandboxTarget'),
    capabilityGrant: [...grant.allowed],
    filesInspected: files.map((item) => ({ name: item.name, bytes: item.bytes })),
    testsRun: [{ command: test.command, file: test.file, passed: test.passed }],
    testOutput: { stdout: test.stdout, stderr: test.stderr },
    summary,
    proposedResult: summary,
    completedAt: new Date().toISOString()
  };
}

module.exports = { assertSafeGrant, resolveSandbox, readDirectFiles, runApprovedTest, runReadOnlyDispatchTask };
