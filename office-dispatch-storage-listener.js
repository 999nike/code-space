(() => {
  'use strict';

  const INBOX_KEY = 'code-space-dispatch-inbox-v1';

  function dispatchNav() {
    return document.querySelector('[data-view="dispatch"]');
  }

  function ensureIndicatorStyles() {
    if (document.getElementById('office-job-indicator-styles')) return;
    const style = document.createElement('style');
    style.id = 'office-job-indicator-styles';
    style.textContent = `
      [data-view="dispatch"].has-new-job {
        border-color: rgba(63, 225, 138, .9) !important;
        box-shadow: 0 0 0 1px rgba(63, 225, 138, .35), 0 0 22px rgba(63, 225, 138, .22);
        animation: officeJobPulse 1.2s ease-in-out infinite;
      }
      .new-job-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: fit-content;
        margin-top: 5px;
        padding: 2px 7px;
        border-radius: 999px;
        background: #3fe18a;
        color: #07110b;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: .12em;
      }
      @keyframes officeJobPulse {
        0%, 100% { transform: translateZ(0); }
        50% { transform: translateZ(0) scale(1.015); }
      }
    `;
    document.head.appendChild(style);
  }

  function markNewJob() {
    ensureIndicatorStyles();
    const nav = dispatchNav();
    if (!nav) return;
    nav.classList.add('has-new-job');
    const title = nav.querySelector('strong');
    if (title && !title.querySelector('.new-job-badge')) {
      const badge = document.createElement('span');
      badge.className = 'new-job-badge';
      badge.textContent = 'NEW JOB';
      title.appendChild(badge);
    }
  }

  window.addEventListener('storage', (event) => {
    if (event.storageArea !== localStorage || event.key !== INBOX_KEY || !event.newValue) return;
    try {
      const items = JSON.parse(event.newValue);
      if (!Array.isArray(items) || !items.length) return;
      const previous = event.oldValue ? JSON.parse(event.oldValue) : [];
      const previousIds = new Set(Array.isArray(previous) ? previous.map((item) => item?.packageId) : []);
      const added = items.filter((item) => item?.packageId && !previousIds.has(item.packageId));
      if (!added.length) return;

      markNewJob();
      window.dispatchEvent(new CustomEvent('code-space:office-dispatch-received', {
        detail: { packageId: added[0].packageId }
      }));

      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = added.length > 1 ? `${added.length} NEW JOBS received from Office` : 'NEW JOB received from Office';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3200);
      }
    } catch (error) {
      console.error('Could not refresh Code Space after Office bridge delivery:', error);
    }
  });
})();
