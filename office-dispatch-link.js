(() => {
  'use strict';

  const PENDING_KEY = 'code-space-office-dispatch-pending-v1';
  const WINDOW_NAME = 'code-space';
  window.name = WINDOW_NAME;

  function decodePackage(value) {
    let payload = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';
    const binary = atob(payload);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  function dispatchNav() {
    return document.querySelector('[data-view="dispatch"]');
  }

  function markNewJob() {
    const nav = dispatchNav();
    if (!nav) return;
    nav.classList.add('has-new-job');
    const title = nav.querySelector('strong');
    if (title && !title.querySelector('.new-job-badge')) {
      const badge = document.createElement('span');
      badge.className = 'new-job-badge';
      badge.textContent = 'NEW';
      title.appendChild(badge);
    }
  }

  function clearNewJob() {
    const nav = dispatchNav();
    if (!nav) return;
    nav.classList.remove('has-new-job');
    nav.querySelector('.new-job-badge')?.remove();
  }

  function importFromOfficeLink() {
    const url = new URL(location.href);
    const payload = url.searchParams.get('officeDispatch');
    if (!payload) return false;

    try {
      const accepted = window.CodeSpaceDispatchPackage.validate(decodePackage(payload));
      window.CodeSpaceDispatchInbox.add(accepted);
      sessionStorage.setItem(PENDING_KEY, accepted.packageId);
      url.searchParams.delete('officeDispatch');
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      location.reload();
      return true;
    } catch (error) {
      console.error('Office dispatch link rejected:', error);
      const message = document.getElementById('dispatchMessage');
      if (message) {
        message.textContent = `Package rejected: ${error?.message || 'Invalid Office package.'}`;
        message.className = 'dispatch-message error';
      }
      return false;
    }
  }

  function tunePendingView() {
    const heading = document.querySelector('#dispatchInboxView .topbar h2');
    const copy = document.querySelector('#dispatchInboxView .topbar p');
    const importCard = document.querySelector('.dispatch-import-card');
    if (heading) heading.textContent = 'New Job — Authorisation Required';
    if (copy) copy.textContent = 'Review the job and frozen permissions, then authorise or reject it.';
    if (importCard) importCard.hidden = true;
  }

  function selectPendingJob(packageId, attempt = 0) {
    const selector = `[data-select-dispatch="${CSS.escape(packageId)}"]`;
    const item = document.querySelector(selector);
    if (item) {
      item.click();
      tunePendingView();
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = 'NEW JOB received from Office';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3200);
      }
      return;
    }
    if (attempt < 20) setTimeout(() => selectPendingJob(packageId, attempt + 1), 100);
  }

  function openPendingJob() {
    const packageId = sessionStorage.getItem(PENDING_KEY);
    if (!packageId) return;
    sessionStorage.removeItem(PENDING_KEY);

    markNewJob();
    dispatchNav()?.click();
    selectPendingJob(packageId);
  }

  function tuneAuthorisationButtons() {
    document.querySelectorAll('[data-start-real-task]').forEach((button) => {
      if (button.dataset.officeAuthorise === '1') return;
      button.dataset.officeAuthorise = '1';
      button.textContent = 'Authorise & Start';

      const reject = document.createElement('button');
      reject.type = 'button';
      reject.className = 'button secondary';
      reject.textContent = 'Reject';
      reject.dataset.rejectOfficeJob = button.dataset.startRealTask;
      button.insertAdjacentElement('beforebegin', reject);
    });
  }

  document.addEventListener('click', (event) => {
    const reject = event.target.closest('[data-reject-office-job]');
    if (reject) {
      const packageId = reject.dataset.rejectOfficeJob;
      clearNewJob();
      window.CodeSpaceDispatchInbox.remove(packageId);
      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = 'Office job rejected';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2200);
      }
      location.reload();
      return;
    }

    if (event.target.closest('[data-start-real-task]')) clearNewJob();
  });

  if (!importFromOfficeLink()) {
    openPendingJob();
    const observer = new MutationObserver(() => {
      tuneAuthorisationButtons();
      if (sessionStorage.getItem(PENDING_KEY)) markNewJob();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    tuneAuthorisationButtons();
  }
})();
