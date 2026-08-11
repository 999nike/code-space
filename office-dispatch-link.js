(() => {
  'use strict';

  const PENDING_KEY = 'code-space-office-dispatch-pending-v1';

  function decodePackage(value) {
    let payload = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';
    const binary = atob(payload);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
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

  function openPendingJob() {
    const packageId = sessionStorage.getItem(PENDING_KEY);
    if (!packageId) return;
    sessionStorage.removeItem(PENDING_KEY);

    document.querySelector('[data-view="dispatch"]')?.click();
    requestAnimationFrame(() => {
      document.querySelector(`[data-select-dispatch="${CSS.escape(packageId)}"]`)?.click();
      const heading = document.querySelector('#dispatchInboxView .topbar h2');
      const copy = document.querySelector('#dispatchInboxView .topbar p');
      const importCard = document.querySelector('.dispatch-import-card');
      if (heading) heading.textContent = 'Job Authorisation';
      if (copy) copy.textContent = 'Review the job and frozen permissions, then authorise or reject it.';
      if (importCard) importCard.hidden = true;

      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = 'New Office job received';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2800);
      }
    });
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
    if (!reject) return;
    const packageId = reject.dataset.rejectOfficeJob;
    window.CodeSpaceDispatchInbox.remove(packageId);
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = 'Office job rejected';
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2200);
    }
    location.reload();
  });

  if (!importFromOfficeLink()) {
    openPendingJob();
    const observer = new MutationObserver(tuneAuthorisationButtons);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    tuneAuthorisationButtons();
  }
})();
