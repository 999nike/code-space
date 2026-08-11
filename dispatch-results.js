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

  function baseRecord(packageSnapshot, grant, summary, startedAt = new Date().toISOString()) {
    return {
      taskId: uid(),
      packageId: String(packageSnapshot.packageId || ''),
      jobId: String(packageSnapshot.sourceJobId || ''),
      workerId: String(packageSnapshot.worker?.id || ''),
      workerName: String(packageSnapshot.worker?.name || ''),
      status: 'Running',
      summary,
      filesInspected: [],
      testsRequested: grant.capabilities.runTests ? ['Approved Node test requested.'] : [],
      testsRun: [],
      proposedResult: null,
      startedAt,
      completedAt: null,
      capabilityGrant: [...grant.allowed],
      denialEvents: [],
      errors: []
    };
  }

  function start(packageSnapshot, mockSession) {
    if (!packageSnapshot || !mockSession?.grant) throw new Error('A validated package and mock runner grant are required.');
    const record = baseRecord(
      packageSnapshot,
      mockSession.grant,
      'Mock worker lifecycle started. No files, tests, commands, agents, external services, or Office connections were used.',
      mockSession.startedAt || new Date().toISOString()
    );
    record.testsRequested = mockSession.grant.capabilities.runTests
      ? ['Run tests capability is granted; the mock worker does not execute tests.']
      : [];
    record.proposedResult = mockSession.grant.capabilities.proposeResult
      ? 'No real worker result exists. This is a mock lifecycle record only.'
      : null;
    write([record, ...read()]);
    return structuredClone(record);
  }

  function startReal(packageSnapshot, grant) {
    if (!packageSnapshot || !grant) throw new Error('A validated package and runner grant are required.');
    const record = baseRecord(
      packageSnapshot,
      grant,
      'Read-only worker started. Code Space is mediating only the granted file-read and approved-test capabilities.'
    );
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

  function completeReal(taskId, output) {
    if (!output || output.mode !== 'read-only-worker') throw new Error('Read-only worker returned an invalid result.');
    return update(taskId, (record) => ({
      ...record,
      status: 'Completed',
      summary: String(output.summary || 'Read-only worker completed.'),
      filesInspected: Array.isArray(output.filesInspected) ? structuredClone(output.filesInspected) : [],
      testsRun: Array.isArray(output.testsRun) ? structuredClone(output.testsRun) : [],
      proposedResult: output.proposedResult ? String(output.proposedResult) : null,
      completedAt: output.completedAt || new Date().toISOString()
    }));
  }

  function fail(taskId, message) {
    return update(taskId, (record) => ({
      ...record,
      status: 'Failed',
      summary: record?.summary?.startsWith('Mock')
        ? 'Mock worker lifecycle failed before any execution capability was used.'
        : 'Read-only worker failed inside the mediated execution boundary.',
      completedAt: new Date().toISOString(),
      errors: [...(record.errors || []), String(message || 'Unknown worker failure')]
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
  scope.CodeSpaceDispatchResults = Object.freeze({
    KEY,
    list,
    latestForPackage,
    start,
    startReal,
    complete,
    completeReal,
    fail,
    recordDenial
  });
})();
