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
    return `
      <dl class="dispatch-task-facts">
        <div><dt>Task ID</dt><dd>${escapeHtml(result.taskId)}</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(result.status)}</dd></div>
        <div><dt>Files inspected</dt><dd>${result.filesInspected.length}</dd></div>
        <div><dt>Tests run</dt><dd>${result.testsRun.length}</dd></div>
      </dl>
      <p class="dispatch-task-summary">${escapeHtml(result.summary)}</p>`;
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
        ? 'Nothing has been executed. Start Task records a mock lifecycle only.'
        : 'A mock lifecycle record exists. No files, tests, commands, agents, external services, or Office connections were used.'}</p>
      <div class="dispatch-runner-grant"><strong>Runner grant</strong><span>${grantedLabels.length ? grantedLabels.map(escapeHtml).join(' · ') : 'No capabilities granted'}</span></div>
      ${resultRows(result)}
      <div class="dispatch-task-actions">
        ${status === 'Running'
          ? `<button type="button" class="button primary" data-complete-mock-task="${escapeHtml(result.taskId)}">Complete mock task</button>`
          : `<button type="button" class="button primary" data-start-mock-task="${escapeHtml(item.packageId)}">Start Task (mock)</button>`}
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

  document.addEventListener('click', (event) => {
    const startButton = event.target.closest('[data-start-mock-task]');
    if (startButton) {
      const item = packages().find((candidate) => candidate.packageId === startButton.dataset.startMockTask);
      if (!item) return;
      try {
        const session = window.CodeSpaceDispatchRunner.startMock(item);
        window.CodeSpaceDispatchResults.start(item, session);
        rerenderExecutionOnly();
      } catch (error) {
        console.error('Could not start mock task lifecycle:', error);
      }
      return;
    }

    const completeButton = event.target.closest('[data-complete-mock-task]');
    if (completeButton) {
      try {
        window.CodeSpaceDispatchResults.complete(completeButton.dataset.completeMockTask);
        rerenderExecutionOnly();
      } catch (error) {
        console.error('Could not complete mock task lifecycle:', error);
      }
      return;
    }

    if (event.target.closest('[data-select-dispatch]') || event.target.closest('#importDispatchButton')) queueEnhance();
  });

  const observer = new MutationObserver(queueEnhance);
  observer.observe(preview, { childList: true });
  observer.observe(list, { childList: true, subtree: true });
  queueEnhance();
})();
