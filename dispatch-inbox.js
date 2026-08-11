(() => {
  'use strict';

  const KEY = 'code-space-dispatch-inbox-v1';

  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function write(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    return items;
  }

  window.CodeSpaceDispatchInbox = Object.freeze({
    list: read,
    add(packageSnapshot) {
      const items = read().filter((item) => item.packageId !== packageSnapshot.packageId);
      write([{ ...packageSnapshot, importedAt: new Date().toISOString() }, ...items]);
    },
    remove(packageId) {
      return write(read().filter((item) => item.packageId !== packageId));
    }
  });
})();
