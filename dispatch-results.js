(() => {
  'use strict';

  const KEY = 'code-space-dispatch-results-v1';
  const memoryFallback = [];

  function storageAvailable() {
    try {
      return typeof localStorage !== 'undefined';
    } catch {
      return false;
    }
  }

  function read() {
    if (!storageAvailable()) return structuredClone(memoryFallback);
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function write(items) {
    const copy = structuredClone(items);
    if (!storageAvailable()) {
      memoryFallback.splice(0, memoryFallback.length, ...copy);
      return copy;
    }
    localStorage.setItem(KEY, JSON.stringify(copy));
    return copy;
  }

  function uid() {
    return `task_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
  }

  function list() {
    return read();
  }

  function latestForPackage(packageId) {
    return read().find((item) => item.packageId === packageId) || null;
  }

  function start(packageSnapshot, mockSession) {
    if (!packageSnapshot || !mockSession?.grant) throw new Error('A validated package and mock runner grant are required.');
    const startedAt = mockSession.startedAt || new Date().toISOString();
    const record = {
      taskId: uid(),
      packageId: String(packageSnapshot.packageId || ''),
      jobId: String(packageSnapshot.sourceJobId || ''),
      workerId: String(packageSnapshot.worker?.id || ''),
      workerName: String(packageSnapshot.worker?.name || ''),
      status: 'Running',
      summary: 'Mock worker lifecycle started. No files, tests, commands, agents, external services, or Office connections were used.',
      filesInspected: [],
      testsRequested: mockSession.grant.capabilities.runTests
        ? ['Run tests capability is granted; the mock worker does not execute tests.']
        : [],
      testsRun: [],
      proposedResult: mockSession.grant.capabilities.proposeResult
        ? 'No real worker result exists. This is a mock lifecycle record only.'
        : null,
      startedAt,
      completedAt: null,
      capabilityGrant: [...mockSession.grant.allowed],
      denialEvents: [],
      errors: []
    };
    write([record, ...read()]);
    return structuredClone(record);
  }

  function update(taskId, updater) {
    const items = read();
    const index = items.findIndex((item) => item.taskId === taskId);
    if (index < 0) throw new Error('Task result record was not found.');
    items[index] = updater(structuredClone(items[index]));
    write(items);
    return structuredClone(items[index]);
  }

  function complete(taskId) {
    return update(taskId, (record) => ({
      ...record,
      status: 'Completed',
      summary: 'Mock worker lifecycle completed. No files, tests, commands, agents, external services, or Office connections were used.',
      completedAt: new Date().toISOString()
    }));
  }

  function fail(taskId, message) {
    return update(taskId, (record) => ({
      ...record,
      status: 'Failed',
      summary: 'Mock worker lifecycle failed before any execution capability was used.',
      completedAt: new Date().toISOString(),
      errors: [...(record.errors || []), String(message || 'Unknown mock lifecycle failure')]
    }));
  }

  function recordDenial(taskId, capabilityKey, message = '') {
    return update(taskId, (record) => ({
      ...record,
      denialEvents: [
        ...(record.denialEvents || []),
        {
          capabilityKey: String(capabilityKey || ''),
          message: String(message || `Capability not granted: ${capabilityKey}.`),
          at: new Date().toISOString()
        }
      ]
    }));
  }

  const scope = typeof window === 'undefined' ? globalThis : window;
  scope.CodeSpaceDispatchResults = Object.freeze({ KEY, list, latestForPackage, start, complete, fail, recordDenial });
})();
