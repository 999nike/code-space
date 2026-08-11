(() => {
  'use strict';

  const preview = document.getElementById('dispatchPreview');
  const list = document.getElementById('dispatchList');
  if (!preview || !list) return;

  let queued = false;

  function packages() {
    return window.CodeSpaceDispatchInbox?.list?.() || [];
  }

  function selectedPackage() {
    const active = list.querySelector('[data-select-dispatch].active');
    const id = active?.dataset.selectDispatch;
    return packages().find((item) => item.packageId === id) || null;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function queueEnhance() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhance();
    });
  }

  function enhanceList() {
    list.querySelectorAll('[data-select-dispatch]').forEach((button) => {
      const id = button.dataset.selectDispatch;
      const result = window.CodeSpaceDispatchResults?.latestForPackage?.(id);
      const badge = button.querySelector('.dispatch-ready');
      if (!badge) return;
      const status = result?.status || 'Ready';
      if (badge.textContent !== status) badge.textContent = status;
      badge.dataset.taskState = status.toLowerCase();
    });
  }

  function resultRows(result) {
    if (!result) return '';
    const files = Array.isArray(result.filesInspected) ? result.filesInspected : [];
    const tests = Array.isArray(result.testsRun) ? result.testsRun : [];
    const fileNames = files.map((item) => typeof item === 'string' ? item : item?.name).filter(Boolean);
    const testLines = tests.map((item) => {
      if (typeof item === 'string') return item;
      const state = item?.passed === true ? 'PASS' : item?.passed === false ? 'FAIL' : 'UNKNOWN';
      return `${item?.command || item?.file || 'Approved test'} — ${state}`;
    });
    const errors = Array.isArray(result.errors) ? result.errors.filter(Boolean) : [];
    return `
      <dl class="dispatch-task-facts">
        <div><dt>Task ID</dt><dd>${escapeHtml(result.taskId)}</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(result.status)}</dd></div>
        <div><dt>Files inspected</dt><dd>${files.length}</dd></div>
        <div><dt>Tests run</dt><dd>${tests.length}</dd></div>
      </dl>
      ${fileNames.length ? `<p class="dispatch-task-summary"><strong>Files:</strong> ${fileNames.map(escapeHtml).join(' · ')}</p>` : ''}
      ${testLines.length ? `<p class="dispatch-task-summary"><strong>Tests:</strong> ${testLines.map(escapeHtml).join(' · ')}</p>` : ''}
      <p class="dispatch-task-summary">${escapeHtml(result.summary)}</p>
      ${result.proposedResult ? `<p class="dispatch-task-summary"><strong>Proposed handoff:</strong> ${escapeHtml(result.proposedResult)}</p>` : ''}
      ${errors.length ? `<p class="dispatch-task-summary"><strong>Errors:</strong> ${errors.map(escapeHtml).join(' · ')}</p>` : ''}`;
  }

  function enhancePreview() {
    if (preview.querySelector('[data-dispatch-execution]')) return;
    const item = selectedPackage();
    if (!item || !preview.querySelector('.dispatch-preview-head')) return;

    const result = window.CodeSpaceDispatchResults?.latestForPackage?.(item.packageId) || null;
    const status = result?.status || 'Ready';
    const grant = window.CodeSpaceDispatchRunner?.createGrant?.(item);
    const grantedLabels = (grant?.allowed || []).map((key) => window.CodeSpaceDispatchPackage.CAPABILITIES[key] || key);

    const section = document.createElement('section');
    section.className = 'dispatch-execution-panel';
    section.dataset.dispatchExecution = 'true';
    section.innerHTML = `
      <div class="dispatch-task-head">
        <div><p class="eyebrow purple">Execution boundary</p><h3>Task lifecycle</h3></div>
        <span class="dispatch-task-state" data-state="${escapeHtml(status.toLowerCase())}">${escapeHtml(status)}</span>
      </div>
      <p class="dispatch-task-copy">${status === 'Ready'
        ? 'Nothing has been executed. Start Task runs the mediated read/test worker only.'
        : status === 'Running'
          ? 'The read-only worker is running inside the granted sandbox boundary.'
          : 'A persisted task result exists. No file-modification or terminal capability was granted.'}</p>
      <div class="dispatch-runner-grant"><strong>Runner grant</strong><span>${grantedLabels.length ? grantedLabels.map(escapeHtml).join(' · ') : 'No capabilities granted'}</span></div>
      ${resultRows(result)}
      <div class="dispatch-task-actions">
        ${status === 'Running'
          ? '<button type="button" class="button primary" disabled>Task running…</button>'
          : `<button type="button" class="button primary" data-start-real-task="${escapeHtml(item.packageId)}">Start Task (read/test)</button>`}
      </div>`;
    preview.appendChild(section);
  }

  function enhance() {
    enhanceList();
    enhancePreview();
  }

  function rerenderExecutionOnly() {
    preview.querySelector('[data-dispatch-execution]')?.remove();
    enhance();
  }

  async function runRealTask(item) {
    const grant = window.CodeSpaceDispatchRunner.createGrant(item);
    window.CodeSpaceDispatchRunner.assertAllowed(grant, 'readFiles');
    window.CodeSpaceDispatchRunner.assertAllowed(grant, 'runTests');
    window.CodeSpaceDispatchRunner.assertAllowed(grant, 'proposeResult');
    if (window.CodeSpaceDispatchRunner.has(grant, 'modifyFiles')) throw new Error('Read-only worker refuses Modify files.');
    if (window.CodeSpaceDispatchRunner.has(grant, 'useTerminal')) throw new Error('Read-only worker refuses Use terminal.');

    const result = window.CodeSpaceDispatchResults.startReal(item, grant);
    rerenderExecutionOnly();

    try {
      const response = await fetch('/api/dispatch/run-readonly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: item })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || `Worker returned HTTP ${response.status}`);
      window.CodeSpaceDispatchResults.completeReal(result.taskId, data);
    } catch (error) {
      window.CodeSpaceDispatchResults.fail(result.taskId, error?.message || 'Read-only worker failed.');
      console.error('Could not run read-only dispatch task:', error);
    }
    rerenderExecutionOnly();
  }

  document.addEventListener('click', (event) => {
    const startButton = event.target.closest('[data-start-real-task]');
    if (startButton) {
      const item = packages().find((candidate) => candidate.packageId === startButton.dataset.startRealTask);
      if (!item) return;
      startButton.disabled = true;
      runRealTask(item).catch((error) => console.error('Could not start read-only task:', error));
      return;
    }

    if (event.target.closest('[data-select-dispatch]') || event.target.closest('#importDispatchButton')) queueEnhance();
  });

  const observer = new MutationObserver(queueEnhance);
  observer.observe(preview, { childList: true });
  observer.observe(list, { childList: true, subtree: true });
  queueEnhance();
})();
