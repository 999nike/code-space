'use strict';

const path = require('node:path');
const fs = require('node:fs/promises');
const SANDBOX_TARGET = 'agent-sandbox-test';
const OUTPUT_FILE = 'agent-write-test.txt';
const OUTPUT_CONTENT = 'Worker write permission test passed.';
const KNOWN_CAPABILITIES = ['readFiles', 'modifyFiles', 'runTests', 'useTerminal', 'proposeResult'];

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function capabilityKeys(packageSnapshot, group) {
  const items = packageSnapshot?.capabilities?.[group];
  if (!Array.isArray(items)) throw new Error(`capabilities.${group} must be an array.`);
  return items.map((item) => text(item?.key, `capabilities.${group}.key`));
}

function assertWriteGrant(packageSnapshot) {
  if (!packageSnapshot || packageSnapshot.format !== 'office-dispatch-package' || packageSnapshot.version !== 1) throw new Error('Unsupported dispatch package.');
  if (packageSnapshot.packageStatus !== 'Ready') throw new Error('Only Ready dispatch packages can execute.');
  if (text(packageSnapshot.sandboxTarget, 'sandboxTarget') !== SANDBOX_TARGET) throw new Error(`Write worker is restricted to ${SANDBOX_TARGET}.`);
  const groups = Object.fromEntries(['allowed', 'explicitlyDenied', 'notGranted'].map((group) => [group, capabilityKeys(packageSnapshot, group)]));
  const seen = new Set();
  for (const keys of Object.values(groups)) for (const key of keys) {
    if (!KNOWN_CAPABILITIES.includes(key)) throw new Error(`Unsupported capability key: ${key}.`);
    if (seen.has(key)) throw new Error(`Capability ${key} appears in conflicting permission groups.`);
    seen.add(key);
  }
  if (seen.size !== KNOWN_CAPABILITIES.length) throw new Error('The package must classify every known capability exactly once.');
  if (!groups.allowed.includes('modifyFiles')) throw new Error('modifyFiles must be explicitly allowed for the write worker.');
  if (!groups.allowed.includes('proposeResult')) throw new Error('proposeResult must be allowed for the write worker.');
  if (groups.allowed.includes('useTerminal')) throw new Error('Write worker refuses terminal access.');
  return Object.freeze({ allowed: Object.freeze([...groups.allowed]) });
}

function resolveWriteTarget(root, sandboxTarget) {
  if (text(sandboxTarget, 'sandboxTarget') !== SANDBOX_TARGET) throw new Error(`Write worker is restricted to ${SANDBOX_TARGET}.`);
  const workspaceRoot = path.resolve(root);
  const sandbox = path.resolve(workspaceRoot, SANDBOX_TARGET);
  if (path.dirname(sandbox) !== workspaceRoot) throw new Error('sandboxTarget escaped the approved workspace root.');
  const output = path.resolve(sandbox, OUTPUT_FILE);
  const relative = path.relative(sandbox, output);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || path.dirname(output) !== sandbox) throw new Error('Write target escaped the approved sandbox.');
  return { sandbox, output };
}

async function runWriteDispatchTask(packageSnapshot, options = {}) {
  const grant = assertWriteGrant(packageSnapshot);
  const { sandbox, output } = resolveWriteTarget(options.root || process.cwd(), packageSnapshot.sandboxTarget);
  const stat = options.stat || fs.stat;
  const writeFile = options.writeFile || fs.writeFile;
  const sandboxStat = await stat(sandbox).catch(() => null);
  if (!sandboxStat?.isDirectory()) throw new Error('The requested sandbox project does not exist.');
  await writeFile(output, OUTPUT_CONTENT, { encoding: 'utf8', flag: 'wx' });
  const completedAt = new Date().toISOString();
  return { mode: 'write-worker', packageId: text(packageSnapshot.packageId, 'packageId'), sandboxTarget: SANDBOX_TARGET, capabilityGrant: [...grant.allowed], filesCreated: [{ name: OUTPUT_FILE, bytes: Buffer.byteLength(OUTPUT_CONTENT) }], filesModified: [], testsRun: [], summary: `Created ${OUTPUT_FILE} inside ${SANDBOX_TARGET}.`, proposedResult: `Created ${OUTPUT_FILE}; no other files were modified.`, completedAt };
}

module.exports = { SANDBOX_TARGET, OUTPUT_FILE, OUTPUT_CONTENT, assertWriteGrant, resolveWriteTarget, runWriteDispatchTask };
