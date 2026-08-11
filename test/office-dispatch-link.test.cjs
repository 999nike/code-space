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
