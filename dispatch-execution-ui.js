(() => {
  'use strict';

  const preview = document.getElementById('dispatchPreview');
  const list = document.getElementById('dispatchList');
  if (!preview || !list) return;

  let queued = false;
  let queueLoopRunning = false;

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
      const queueEntry = window.CodeSpaceDispatchQueue?.read?.().entries.find((entry) => entry.packageId === id);
      const badge = button.querySelector('.dispatch-ready');
      if (!badge) return;
      const status = result?.status || queueEntry?.status || 'Ready';
      if (badge.textContent !== status) badge.textContent = status;
      badge.dataset.taskState = status.toLowerCase();
    });
  }

  function resultRows(result) {
    if (!result) return '';
    const files = Array.isArray(result.filesInspected) ? result.filesInspected : [];
    const created = Array.isArray(result.filesCreated) ? result.filesCreated : [];
    const modified = Array.isArray(result.filesModified) ? result.filesModified : [];
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
      ${created.length ? `<p class="dispatch-task-summary"><strong>Created:</strong> ${created.map((item) => escapeHtml(item?.name || item)).join(' · ')}</p>` : ''}
      ${modified.length ? `<p class="dispatch-task-summary"><strong>Modified:</strong> ${modified.map((item) => escapeHtml(item?.name || item)).join(' · ')}</p>` : ''}
      ${testLines.length ? `<p class="dispatch-task-summary"><strong>Tests:</strong> ${testLines.map(escapeHtml).join(' · ')}</p>` : ''}
      <p class="dispatch-task-summary">${escapeHtml(result.summary)}</p>
      ${result.proposedResult ? `<p class="dispatch-task-summary"><strong>Proposed handoff:</strong> ${escapeHtml(result.proposedResult)}</p>` : ''}
      ${errors.length ? `<p class="dispatch-task-summary"><strong>Errors:</strong> ${errors.map(escapeHtml).join(' · ')}</p>` : ''}`;
  }

  function queuePanel(item) {
    const Queue = window.CodeSpaceDispatchQueue;
    if (!Queue) return '';
    const queue = Queue.read();
    const entry = queue.entries.find((candidate) => candidate.packageId === item.packageId);
    const queuedEntries = queue.entries.filter((candidate) => candidate.status === 'Queued');
    const position = entry ? queue.entries.indexOf(entry) + 1 : null;
    const controls = queue.status === 'Running'
      ? '<button type="button" class="button secondary" data-pause-codex-queue>Pause after current task</button><button type="button" class="button secondary" data-stop-codex-queue>Stop queued tasks</button>'
      : queuedEntries.length
        ? `<button type="button" class="button primary" data-authorise-codex-queue>${queue.status === 'Paused' ? 'Resume queue' : 'Authorise & Start queue'}</button><button type="button" class="button secondary" data-stop-codex-queue>Stop queued tasks</button>`
        : '';
    const reorder = entry?.status === 'Queued' && queue.status !== 'Running'
      ? `<span class="dispatch-queue-order"><button type="button" data-move-codex-queue="-1" data-queue-package="${escapeHtml(item.packageId)}" aria-label="Move job earlier">↑</button><button type="button" data-move-codex-queue="1" data-queue-package="${escapeHtml(item.packageId)}" aria-label="Move job later">↓</button></span>`
      : '';
    return `<section class="dispatch-queue-panel" data-codex-queue>
      <div><p class="eyebrow purple">Persistent Codex queue</p><h3>${escapeHtml(queue.status)}</h3><p>${entry ? `Position ${position} · ${escapeHtml(entry.status)}${entry.message ? ` · ${escapeHtml(entry.message)}` : ''}` : 'This Codex package will be added to the queue when authorised.'}</p></div>
      <div class="dispatch-queue-actions">${reorder}${controls}</div>
    </section>`;
  }

  function enhancePreview() {
    if (preview.querySelector('[data-dispatch-execution]')) return;
    const item = selectedPackage();
    if (!item || !preview.querySelector('.dispatch-preview-head')) return;

    const result = window.CodeSpaceDispatchResults?.latestForPackage?.(item.packageId) || null;
    const status = result?.status || 'Ready';
    const grant = window.CodeSpaceDispatchRunner?.createGrant?.(item);
    const codexTask = window.CodeSpaceDispatchRunner?.isCodexWorker?.(item);
    const writeTask = window.CodeSpaceDispatchRunner?.has?.(grant, 'modifyFiles');
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
        ? codexTask ? 'Nothing has been executed. Authorise & Start runs the selected Codex worker inside the frozen sandbox and permission boundary.' : writeTask ? 'Nothing has been executed. Authorise & Start runs the single approved write inside the sandbox.' : 'Nothing has been executed. Start Task runs the mediated read/test worker only.'
        : status === 'Running'
          ? 'The read-only worker is running inside the granted sandbox boundary.'
          : 'A persisted task result exists. No file-modification or terminal capability was granted.'}</p>
      <div class="dispatch-runner-grant"><strong>Runner grant</strong><span>${grantedLabels.length ? grantedLabels.map(escapeHtml).join(' · ') : 'No capabilities granted'}</span></div>
      ${resultRows(result)}
      ${codexTask ? queuePanel(item) : ''}
      <div class="dispatch-task-actions">
        ${status === 'Running'
          ? '<button type="button" class="button primary" disabled>Task running…</button>'
          : status === 'Completed'
            ? '<button type="button" class="button primary" disabled>Task completed</button>'
            : `<button type="button" class="button primary" data-start-real-task="${escapeHtml(item.packageId)}">${status === 'Failed' ? (codexTask ? 'Retry Task (Codex)' : writeTask ? 'Retry Task (write)' : 'Retry Task (read/test)') : (codexTask ? 'Start Task (Codex)' : writeTask ? 'Start Task (write)' : 'Start Task (read/test)')}</button>`}
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

  async function executeCodexTask(item) {
    const grant = window.CodeSpaceDispatchRunner.createGrant(item);
    const result = window.CodeSpaceDispatchResults.startCodex(item, grant);
    rerenderExecutionOnly();
    try {
      const response = await fetch('/api/dispatch/run-codex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package: item })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data?.error || `Worker returned HTTP ${response.status}`);
        error.statusCode = response.status;
        throw error;
      }
      window.CodeSpaceDispatchResults.completeCodex(result.taskId, data);
      return { output: data, succeeded: data.exitCode === 0 && data.timedOut !== true };
    } catch (error) {
      window.CodeSpaceDispatchResults.fail(result.taskId, error?.message || 'Codex worker failed.');
      console.error('Could not run Codex dispatch task:', error);
      return { error, succeeded: false };
    } finally {
      rerenderExecutionOnly();
    }
  }

  async function runCodexQueue() {
    if (queueLoopRunning) return;
    queueLoopRunning = true;
    try {
      while (true) {
        window.CodeSpaceDispatchQueue.claimNext();
        const entry = window.CodeSpaceDispatchQueue.activeEntry();
        if (!entry) return;
        const item = packages().find((candidate) => candidate.packageId === entry.packageId);
        if (!item) {
          window.CodeSpaceDispatchQueue.fail(entry.packageId, { blocked: true, message: 'The frozen package is no longer in the local dispatch inbox.' });
          return;
        }
        const outcome = await executeCodexTask(item);
        if (outcome.succeeded) {
          window.CodeSpaceDispatchQueue.complete(entry.packageId, outcome.output.summary);
          continue;
        }
        const blocked = Boolean(outcome.error) || entry.modifiesFiles;
        const message = outcome.error?.message || outcome.output?.summary || 'Codex task failed.';
        window.CodeSpaceDispatchQueue.fail(entry.packageId, { blocked, message });
        if (blocked) return;
      }
    } finally {
      queueLoopRunning = false;
      rerenderExecutionOnly();
    }
  }

  async function runRealTask(item) {
    const grant = window.CodeSpaceDispatchRunner.createGrant(item);
    const codexTask = window.CodeSpaceDispatchRunner.isCodexWorker(item);
    const writeTask = window.CodeSpaceDispatchRunner.has(grant, 'modifyFiles');
    if (codexTask) {
      window.CodeSpaceDispatchQueue?.remove?.(item.packageId);
      await executeCodexTask(item);
      return;
    }

    if (writeTask) {
      window.CodeSpaceDispatchRunner.assertAllowed(grant, 'modifyFiles');
      window.CodeSpaceDispatchRunner.assertAllowed(grant, 'proposeResult');
      if (window.CodeSpaceDispatchRunner.has(grant, 'useTerminal')) throw new Error('Write worker refuses Use terminal.');
      const result = window.CodeSpaceDispatchResults.startWrite(item, grant);
      rerenderExecutionOnly();
      try {
        const response = await fetch('/api/dispatch/run-write', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ package: item })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || `Worker returned HTTP ${response.status}`);
        window.CodeSpaceDispatchResults.completeWrite(result.taskId, data);
      } catch (error) {
        window.CodeSpaceDispatchResults.fail(result.taskId, error?.message || 'Write worker failed.');
        console.error('Could not run write dispatch task:', error);
      }
      rerenderExecutionOnly();
      return;
    }

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
    if (event.target.closest('[data-authorise-codex-queue]')) {
      window.CodeSpaceDispatchQueue.authoriseAndStart();
      runCodexQueue().catch((error) => console.error('Could not run Codex queue:', error));
      return;
    }
    if (event.target.closest('[data-pause-codex-queue]')) {
      window.CodeSpaceDispatchQueue.pause();
      rerenderExecutionOnly();
      return;
    }
    if (event.target.closest('[data-stop-codex-queue]')) {
      window.CodeSpaceDispatchQueue.stop();
      rerenderExecutionOnly();
      return;
    }
    const move = event.target.closest('[data-move-codex-queue]');
    if (move) {
      window.CodeSpaceDispatchQueue.move(move.dataset.queuePackage, Number(move.dataset.moveCodexQueue));
      rerenderExecutionOnly();
      return;
    }
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
  window.addEventListener('code-space:queue-changed', rerenderExecutionOnly);
  queueEnhance();
})();
