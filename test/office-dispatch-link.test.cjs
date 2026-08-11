'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');

test('Office dispatch link registers a stable reusable Code Space window name', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'office-dispatch-link.js'), 'utf8');

  const listeners = new Map();
  const context = {
    window: {
      name: '',
      CodeSpaceDispatchPackage: { validate(value) { return value; } },
      CodeSpaceDispatchInbox: { add() {}, remove() {} },
    },
    document: {
      documentElement: {},
      head: { appendChild() {} },
      addEventListener(type, fn) { listeners.set(type, fn); },
      createElement() { return { id: '', textContent: '', className: '' }; },
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    location: { href: 'http://127.0.0.1:8090/' },
    history: { replaceState() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    MutationObserver: class { observe() {} },
    URL,
    TextDecoder,
    Uint8Array,
    atob: globalThis.atob,
    setTimeout() {},
    console,
    CSS: { escape(value) { return String(value); } },
  };

  context.window.window = context.window;
  vm.runInNewContext(source, context, { filename: 'office-dispatch-link.js' });

  assert.equal(context.window.name, 'code-space');
});

test('Office dispatch link notifies the current tab without reloading after a valid import', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'office-dispatch-link.js'), 'utf8');
  const payload = Buffer.from('{}').toString('base64url');
  const added = [];
  const received = [];
  const context = {
    window: {
      name: '',
      CodeSpaceDispatchPackage: { validate() { return { packageId: 'package-1' }; } },
      CodeSpaceDispatchInbox: { add(value) { added.push(value); }, remove() {} },
      dispatchEvent(event) { received.push(event); },
    },
    document: {
      documentElement: {},
      head: { appendChild() {} },
      addEventListener() {},
      createElement() { return { id: '', textContent: '', className: '' }; },
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    location: { href: `http://127.0.0.1:8090/?officeDispatch=${payload}` },
    history: { replaceState() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    MutationObserver: class { observe() {} },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    URL,
    TextDecoder,
    Uint8Array,
    atob: globalThis.atob,
    setTimeout() {},
    console,
    CSS: { escape(value) { return String(value); } },
  };

  context.window.window = context.window;
  vm.runInNewContext(source, context, { filename: 'office-dispatch-link.js' });

  assert.deepEqual(added, [{ packageId: 'package-1' }]);
  assert.equal(received[0].type, 'code-space:office-dispatch-received');
  assert.equal(received[0].detail.packageId, 'package-1');
});
