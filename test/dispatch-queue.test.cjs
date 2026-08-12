'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const store = new Map();
globalThis.localStorage = {
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); }
};
globalThis.window = globalThis;
globalThis.dispatchEvent = () => {};
globalThis.CustomEvent = class { constructor(type) { this.type = type; } };

require('../dispatch-queue.js');
const Queue = globalThis.CodeSpaceDispatchQueue;

function pkg(id, modifyFiles = false) {
  return {
    packageId: id, jobTitle: id, sandboxTarget: 'agent-sandbox-test', worker: { name: 'Codex' },
    capabilities: { allowed: [{ key: 'readFiles' }, { key: 'useTerminal' }, { key: 'proposeResult' }, ...(modifyFiles ? [{ key: 'modifyFiles' }] : [])] }
  };
}

test('Codex queue is persistent, ordered, and only begins after batch authorisation', () => {
  Queue.enqueue(pkg('one'));
  Queue.enqueue(pkg('two'));
  assert.deepEqual(Queue.read().entries.map((entry) => entry.packageId), ['one', 'two']);
  Queue.move('two', -1);
  assert.deepEqual(Queue.read().entries.map((entry) => entry.packageId), ['two', 'one']);
  assert.equal(Queue.read().status, 'Idle');
  Queue.authoriseAndStart();
  assert.equal(Queue.activeEntry(), null);
  Queue.claimNext();
  assert.equal(Queue.activeEntry().packageId, 'two');
  Queue.complete('two');
  Queue.claimNext();
  assert.equal(Queue.activeEntry().packageId, 'one');
  Queue.complete('one');
  assert.equal(Queue.read().status, 'Finished');
});

test('a failed write task pauses the queue while a read-only failure may continue', () => {
  store.clear();
  Queue.enqueue(pkg('read-only'));
  Queue.enqueue(pkg('write', true));
  Queue.authoriseAndStart();
  Queue.claimNext();
  Queue.fail('read-only', { message: 'Ordinary failure.' });
  assert.equal(Queue.read().status, 'Running');
  Queue.claimNext();
  Queue.fail('write', { message: 'Write task failed.' });
  assert.equal(Queue.read().entries.find((entry) => entry.packageId === 'write').status, 'Failed');
  assert.equal(Queue.read().status, 'Paused');
});

test('the stable built-in Codex worker id queues even if its display label changes', () => {
  store.clear();
  Queue.enqueue({
    ...pkg('built-in-id'),
    worker: { id: 'builtin:codex', name: 'Codex model' }
  });
  assert.deepEqual(Queue.read().entries.map((entry) => entry.packageId), ['built-in-id']);
});
