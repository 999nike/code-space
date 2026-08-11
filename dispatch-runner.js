(() => {
  'use strict';

  function reject(message, capabilityKey = null) {
    const error = new Error(message);
    error.code = 'capability_denied';
    if (capabilityKey) error.capabilityKey = capabilityKey;
    throw error;
  }

  function createGrant(packageSnapshot) {
    if (!packageSnapshot || packageSnapshot.packageStatus !== 'Ready') {
      throw new Error('Only a validated Ready dispatch package can start a task.');
    }

    const allowed = Array.isArray(packageSnapshot.capabilities?.allowed)
      ? packageSnapshot.capabilities.allowed.map((item) => String(item?.key || '')).filter(Boolean)
      : [];

    const capabilities = Object.freeze(Object.fromEntries(allowed.map((key) => [key, true])));
    return Object.freeze({
      packageId: String(packageSnapshot.packageId || ''),
      allowed: Object.freeze([...allowed]),
      capabilities
    });
  }

  function has(grant, capabilityKey) {
    return Boolean(grant?.capabilities?.[capabilityKey]);
  }

  function assertAllowed(grant, capabilityKey) {
    if (!has(grant, capabilityKey)) reject(`Capability not granted: ${capabilityKey}.`, capabilityKey);
    return true;
  }

  function startMock(packageSnapshot) {
    const grant = createGrant(packageSnapshot);
    return Object.freeze({
      mode: 'mock',
      packageId: grant.packageId,
      grant,
      startedAt: new Date().toISOString(),
      notice: 'Mock lifecycle only. No files, tests, commands, agents, external services, or Office connections are used.'
    });
  }

  const scope = typeof window === 'undefined' ? globalThis : window;
  scope.CodeSpaceDispatchRunner = Object.freeze({ createGrant, has, assertAllowed, startMock });
})();
