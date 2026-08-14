(() => {
  'use strict';

  const FORMAT = 'office-dispatch-package';
  const VERSION = 1;
  const CAPABILITIES = Object.freeze({
    readFiles: 'Read files',
    modifyFiles: 'Modify files',
    runTests: 'Run tests',
    useTerminal: 'Use terminal',
    proposeResult: 'Propose result / handoff'
  });
  const GROUPS = ['allowed', 'explicitlyDenied', 'notGranted'];
  const OFFICE_FREE_DEFAULT_CAPABILITIES = Object.freeze({
    allowed: Object.freeze(['readFiles', 'useTerminal', 'proposeResult']),
    explicitlyDenied: Object.freeze([]),
    notGranted: Object.freeze(['modifyFiles', 'runTests'])
  });

  function reject(message) {
    throw new Error(message);
  }

  function object(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) reject(`${label} must be an object.`);
    return value;
  }

  function text(value, label) {
    if (typeof value !== 'string' || !value.trim()) reject(`${label} must be a non-empty string.`);
    return value.trim();
  }

  function validateCapabilities(value) {
    const source = object(value, 'capabilities');
    const seen = new Set();
    const normalized = {};
    for (const group of GROUPS) {
      if (!Array.isArray(source[group])) reject(`capabilities.${group} must be an array.`);
      normalized[group] = source[group].map((item, index) => {
        object(item, `capabilities.${group}[${index}]`);
        const key = text(item.key, `capabilities.${group}[${index}].key`);
        if (!Object.hasOwn(CAPABILITIES, key)) reject(`Unsupported capability key: ${key}.`);
        if (seen.has(key)) reject(`Capability ${key} appears in conflicting permission groups.`);
        seen.add(key);
        text(item.label, `capabilities.${group}[${index}].label`);
        return { key, label: CAPABILITIES[key] };
      });
    }
    if (seen.size !== Object.keys(CAPABILITIES).length) reject('The package must classify every known capability exactly once.');
    return normalized;
  }

  function codeSpaceDefaultCapabilities() {
    return Object.fromEntries(GROUPS.map((group) => [group, OFFICE_FREE_DEFAULT_CAPABILITIES[group].map((key) => ({ key, label: CAPABILITIES[key] }))]));
  }

  function validate(value) {
    const source = object(value, 'package');
    if (source.format !== FORMAT) reject(`Unsupported package format: ${String(source.format)}.`);
    if (source.version !== VERSION) reject(`Unsupported package version: ${String(source.version)}.`);
    if (source.packageStatus !== 'Ready') reject('Only Ready dispatch packages can be imported.');
    const createdAt = text(source.createdAt, 'createdAt');
    if (Number.isNaN(Date.parse(createdAt))) reject('createdAt must be a valid timestamp.');
    const worker = object(source.worker, 'worker');
    return Object.freeze({
      format: FORMAT,
      version: VERSION,
      packageId: text(source.packageId, 'packageId'),
      createdAt,
      sourceJobId: text(source.sourceJobId, 'sourceJobId'),
      jobTitle: text(source.jobTitle, 'jobTitle'),
      instructions: text(source.instructions, 'instructions'),
      priority: text(source.priority, 'priority'),
      jobStatusAtSnapshot: text(source.jobStatusAtSnapshot, 'jobStatusAtSnapshot'),
      sandboxTarget: text(source.sandboxTarget, 'sandboxTarget'),
      worker: Object.freeze({
        id: text(worker.id, 'worker.id'),
        name: text(worker.name, 'worker.name'),
        role: text(worker.role, 'worker.role')
      }),
      capabilities: Object.freeze(source.capabilities === undefined
        ? codeSpaceDefaultCapabilities()
        : validateCapabilities(source.capabilities)),
      resultHandoffPermissionState: source.capabilities === undefined
        ? 'Code Space authorisation required'
        : text(source.resultHandoffPermissionState, 'resultHandoffPermissionState'),
      packageStatus: 'Ready'
    });
  }

  function parse(text) {
    try {
      return validate(JSON.parse(text));
    } catch (error) {
      if (error instanceof SyntaxError) reject('The selected file is not valid JSON.');
      throw error;
    }
  }

  const scope = typeof window === 'undefined' ? globalThis : window;
  scope.CodeSpaceDispatchPackage = Object.freeze({ FORMAT, VERSION, CAPABILITIES, parse, validate });
})();
