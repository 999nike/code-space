(() => {
  'use strict';

  const KEY = 'code-space-codex-queue-v1';
  const STATES = Object.freeze(['Idle', 'Running', 'Paused', 'Stopped', 'Finished']);
  const ENTRY_STATES = Object.freeze(['Queued', 'Running', 'Completed', 'Failed', 'Blocked', 'Stopped']);

  function now() { return new Date().toISOString(); }
  function isCodex(item) {
    return String(item?.worker?.id || '').trim() === 'builtin:codex'
      || String(item?.worker?.name || '').trim() === 'Codex';
  }
  function canModify(item) {
    return Array.isArray(item?.capabilities?.allowed) && item.capabilities.allowed.some((capability) => capability?.key === 'modifyFiles');
  }
  function base() { return { status: 'Idle', authorisedAt: null, activePackageId: null, entries: [] }; }
  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!value || typeof value !== 'object' || !Array.isArray(value.entries) || !STATES.includes(value.status)) return base();
      return {
        status: value.status,
        authorisedAt: typeof value.authorisedAt === 'string' ? value.authorisedAt : null,
        activePackageId: typeof value.activePackageId === 'string' ? value.activePackageId : null,
        entries: value.entries.filter((entry) => entry && typeof entry.packageId === 'string' && ENTRY_STATES.includes(entry.status))
      };
    } catch {
      return base();
    }
  }
  function write(value) {
    localStorage.setItem(KEY, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('code-space:queue-changed'));
    return structuredClone(value);
  }
  function mutate(updater) { return write(updater(read())); }
  function entryFor(item) {
    return {
      packageId: String(item.packageId),
      jobTitle: String(item.jobTitle || item.packageId),
      sandboxTarget: String(item.sandboxTarget || ''),
      modifiesFiles: canModify(item),
      status: 'Queued',
      queuedAt: now(),
      startedAt: null,
      completedAt: null,
      message: ''
    };
  }
  function enqueue(item) {
    if (!isCodex(item)) return read();
    return mutate((queue) => {
      const existing = queue.entries.find((entry) => entry.packageId === item.packageId);
      if (!existing) queue.entries.push(entryFor(item));
      return queue;
    });
  }
  function sync(items) {
    let queue = read();
    for (const item of Array.isArray(items) ? items : []) {
      if (isCodex(item) && !queue.entries.some((entry) => entry.packageId === item.packageId)) queue.entries.push(entryFor(item));
    }
    return write(queue);
  }
  function remove(packageId) {
    return mutate((queue) => {
      if (queue.activePackageId === packageId) return queue;
      queue.entries = queue.entries.filter((entry) => entry.packageId !== packageId);
      return queue;
    });
  }
  function move(packageId, direction) {
    return mutate((queue) => {
      if (queue.status === 'Running') return queue;
      const index = queue.entries.findIndex((entry) => entry.packageId === packageId && entry.status === 'Queued');
      const destination = index + Number(direction);
      if (index < 0 || destination < 0 || destination >= queue.entries.length || queue.entries[destination].status !== 'Queued') return queue;
      [queue.entries[index], queue.entries[destination]] = [queue.entries[destination], queue.entries[index]];
      return queue;
    });
  }
  function authoriseAndStart() {
    return mutate((queue) => {
      if (queue.activePackageId || !queue.entries.some((entry) => entry.status === 'Queued')) return queue;
      queue.status = 'Running';
      queue.authorisedAt = now();
      return queue;
    });
  }
  function pause() { return mutate((queue) => ({ ...queue, status: 'Paused' })); }
  function stop() {
    return mutate((queue) => {
      queue.status = 'Stopped';
      queue.entries = queue.entries.map((entry) => entry.status === 'Queued' ? { ...entry, status: 'Stopped', completedAt: now(), message: 'Stopped by user before execution.' } : entry);
      return queue;
    });
  }
  function claimNext() {
    return mutate((queue) => {
      if (queue.status !== 'Running' || queue.activePackageId) return queue;
      const entry = queue.entries.find((candidate) => candidate.status === 'Queued');
      if (!entry) {
        queue.status = 'Finished';
        return queue;
      }
      entry.status = 'Running';
      entry.startedAt = now();
      queue.activePackageId = entry.packageId;
      return queue;
    });
  }
  function complete(packageId, message = '') {
    return mutate((queue) => {
      const entry = queue.entries.find((candidate) => candidate.packageId === packageId);
      if (!entry || entry.status !== 'Running') return queue;
      entry.status = 'Completed';
      entry.completedAt = now();
      entry.message = String(message || 'Codex task completed.');
      queue.activePackageId = null;
      if (queue.status !== 'Stopped' && !queue.entries.some((candidate) => candidate.status === 'Queued')) queue.status = 'Finished';
      return queue;
    });
  }
  function fail(packageId, { blocked = false, message = '' } = {}) {
    return mutate((queue) => {
      const entry = queue.entries.find((candidate) => candidate.packageId === packageId);
      if (!entry || entry.status !== 'Running') return queue;
      entry.status = blocked ? 'Blocked' : 'Failed';
      entry.completedAt = now();
      entry.message = String(message || (blocked ? 'Task blocked by a safety boundary.' : 'Codex task failed.'));
      queue.activePackageId = null;
      if (queue.status !== 'Stopped' && (blocked || entry.modifiesFiles)) queue.status = 'Paused';
      else if (queue.status !== 'Stopped' && !queue.entries.some((candidate) => candidate.status === 'Queued')) queue.status = 'Finished';
      return queue;
    });
  }
  function activeEntry() {
    const queue = read();
    return queue.entries.find((entry) => entry.status === 'Running') || null;
  }

  window.CodeSpaceDispatchQueue = Object.freeze({ KEY, read, enqueue, sync, remove, move, authoriseAndStart, pause, stop, claimNext, complete, fail, activeEntry });
})();
