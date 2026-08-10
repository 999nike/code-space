(() => {
  'use strict';

  const PROJECTS_KEY = 'code-space-projects-v1';
  const SETTINGS_KEY = 'code-space-settings-v1';
  const ACTIVITY_KEY = 'code-space-activity-v1';

  const defaults = {
    codeServerUrl: 'http://127.0.0.1:8080'
  };

  const els = {
    homeView: document.getElementById('homeView'),
    settingsView: document.getElementById('settingsView'),
    rightRail: document.getElementById('rightRail'),
    workspaceList: document.getElementById('workspaceList'),
    workspaceEmpty: document.getElementById('workspaceEmpty'),
    projectCount: document.getElementById('projectCount'),
    activityList: document.getElementById('activityList'),
    projectDialog: document.getElementById('projectDialog'),
    projectForm: document.getElementById('projectForm'),
    projectDialogTitle: document.getElementById('projectDialogTitle'),
    projectNameInput: document.getElementById('projectNameInput'),
    projectPathInput: document.getElementById('projectPathInput'),
    projectRepoInput: document.getElementById('projectRepoInput'),
    repoField: document.getElementById('repoField'),
    codeServerState: document.getElementById('codeServerState'),
    codeServerUrlInput: document.getElementById('codeServerUrlInput'),
    codeMode: document.getElementById('codeMode'),
    codeServerFrame: document.getElementById('codeServerFrame'),
    frameNotice: document.getElementById('frameNotice'),
    activeProjectLabel: document.getElementById('activeProjectLabel'),
    toast: document.getElementById('toast')
  };

  let projectMode = 'new';
  let activeProjectId = null;
  let toastTimer;

  function load(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function projects() {
    const value = load(PROJECTS_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function settings() {
    return { ...defaults, ...load(SETTINGS_KEY, {}) };
  }

  function activity() {
    const value = load(ACTIVITY_KEY, []);
    return Array.isArray(value) ? value : [];
  }

  function addActivity(text, detail = '') {
    const items = activity();
    items.unshift({ id: crypto.randomUUID?.() || String(Date.now()), text, detail, at: new Date().toISOString() });
    save(ACTIVITY_KEY, items.slice(0, 8));
    renderActivity();
  }

  function render() {
    renderProjects();
    renderActivity();
    els.codeServerUrlInput.value = settings().codeServerUrl;
  }

  function renderProjects() {
    const items = projects();
    els.projectCount.textContent = `${items.length} ${items.length === 1 ? 'project' : 'projects'}`;
    els.workspaceEmpty.hidden = items.length > 0;
    els.workspaceList.hidden = items.length === 0;
    els.workspaceList.innerHTML = items.map((project) => `
      <article class="workspace-row" data-project-id="${escapeAttr(project.id)}">
        <div class="workspace-main">
          <span class="project-icon">&lt;/&gt;</span>
          <div>
            <strong>${escapeHtml(project.name)}</strong>
            <small>${escapeHtml(project.path)}</small>
          </div>
        </div>
        <div class="workspace-meta">${project.repo ? escapeHtml(shortRepo(project.repo)) : 'Local workspace'}</div>
        <div class="workspace-state">● Ready</div>
        <div class="workspace-actions">
          <button type="button" data-remove-project="${escapeAttr(project.id)}">Remove</button>
          <button type="button" class="open" data-open-project="${escapeAttr(project.id)}">Open</button>
        </div>
      </article>`).join('');
  }

  function renderActivity() {
    const items = activity();
    if (!items.length) {
      els.activityList.innerHTML = '<p class="muted">Nothing yet. Start a project and activity will appear here.</p>';
      return;
    }
    els.activityList.innerHTML = items.slice(0, 5).map((item) => `
      <div class="activity-item">
        <strong>${escapeHtml(item.text)}</strong>
        <small>${escapeHtml(item.detail || relativeTime(item.at))}</small>
      </div>`).join('');
  }

  function openProjectDialog(mode) {
    projectMode = mode;
    els.projectForm.reset();
    els.repoField.hidden = mode === 'open';
    if (mode === 'clone') {
      els.projectDialogTitle.textContent = 'Clone repository';
      els.projectRepoInput.required = true;
      els.projectNameInput.placeholder = 'Project name';
    } else if (mode === 'open') {
      els.projectDialogTitle.textContent = 'Open existing project';
      els.projectRepoInput.required = false;
    } else {
      els.projectDialogTitle.textContent = 'New project';
      els.projectRepoInput.required = false;
    }
    els.projectDialog.showModal();
    requestAnimationFrame(() => els.projectNameInput.focus());
  }

  function submitProject(event) {
    event.preventDefault();
    const name = els.projectNameInput.value.trim();
    const path = els.projectPathInput.value.trim();
    const repo = els.projectRepoInput.value.trim();
    if (!name || !path || (projectMode === 'clone' && !repo)) return;

    const items = projects();
    const project = {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      path,
      repo: projectMode === 'open' ? '' : repo,
      mode: projectMode,
      createdAt: new Date().toISOString(),
      lastOpenedAt: null
    };
    items.unshift(project);
    save(PROJECTS_KEY, items);
    els.projectDialog.close();
    renderProjects();
    addActivity(projectMode === 'clone' ? 'Registered repository' : projectMode === 'open' ? 'Opened existing workspace' : 'Created workspace', name);
    toast(`${name} added to Code Space`);
  }

  function removeProject(id) {
    const items = projects();
    const project = items.find((item) => item.id === id);
    if (!project) return;
    if (!confirm(`Remove “${project.name}” from the Code Space dashboard? This does not delete its files.`)) return;
    save(PROJECTS_KEY, items.filter((item) => item.id !== id));
    renderProjects();
    addActivity('Removed workspace shortcut', project.name);
    toast('Workspace removed');
  }

  function openProject(id) {
    const items = projects();
    const project = items.find((item) => item.id === id);
    if (!project) return;
    project.lastOpenedAt = new Date().toISOString();
    save(PROJECTS_KEY, items);
    activeProjectId = id;
    addActivity('Opened workspace', project.name);
    launchCodeServer(project);
  }

  function normalizedCodeServerUrl() {
    return String(settings().codeServerUrl || defaults.codeServerUrl).trim().replace(/\/+$/, '');
  }

  function projectCodeUrl(project) {
    const base = normalizedCodeServerUrl();
    if (!project?.path) return base;
    const params = new URLSearchParams({ folder: project.path });
    return `${base}/?${params.toString()}`;
  }

  function launchCodeServer(project = null) {
    const target = projectCodeUrl(project);
    els.activeProjectLabel.textContent = project?.name || 'code-server';
    els.codeMode.hidden = false;
    document.body.style.overflow = 'hidden';
    els.frameNotice.hidden = false;
    els.codeServerFrame.src = target;

    const hideNotice = () => {
      setTimeout(() => { els.frameNotice.hidden = true; }, 600);
      els.codeServerFrame.removeEventListener('load', hideNotice);
    };
    els.codeServerFrame.addEventListener('load', hideNotice);
  }

  function exitCodeMode() {
    els.codeMode.hidden = true;
    document.body.style.overflow = '';
    els.codeServerFrame.src = 'about:blank';
    activeProjectId = null;
  }

  async function checkCodeServer() {
    const url = normalizedCodeServerUrl();
    els.codeServerState.textContent = 'Checking…';
    els.codeServerState.className = '';
    try {
      await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store' });
      els.codeServerState.textContent = 'Reachable';
      els.codeServerState.className = 'ready';
      toast('code-server responded');
    } catch (error) {
      console.debug('code-server check failed:', error);
      els.codeServerState.textContent = 'Offline';
      els.codeServerState.className = '';
      toast('Could not reach code-server');
    }
  }

  function saveSettings() {
    const value = els.codeServerUrlInput.value.trim();
    if (!/^https?:\/\//i.test(value)) {
      toast('Enter a full http:// or https:// address');
      return;
    }
    save(SETTINGS_KEY, { codeServerUrl: value.replace(/\/+$/, '') });
    addActivity('Updated code-server address', value);
    toast('Settings saved');
  }

  function switchView(view) {
    const settingsOpen = view === 'settings';
    els.homeView.hidden = settingsOpen;
    els.rightRail.hidden = settingsOpen;
    els.settingsView.hidden = !settingsOpen;
    document.querySelectorAll('.side-link').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  }

  function openExternal() {
    const project = projects().find((item) => item.id === activeProjectId) || null;
    window.open(projectCodeUrl(project), '_blank', 'noopener,noreferrer');
  }

  function shortRepo(value) {
    return String(value || '').replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '');
  }

  function relativeTime(value) {
    const ms = Date.now() - new Date(value).getTime();
    const minutes = Math.max(0, Math.floor(ms / 60000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function toast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add('show');
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2400);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  document.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'new-project') openProjectDialog('new');
    if (action === 'clone-project') openProjectDialog('clone');
    if (action === 'open-project') openProjectDialog('open');
    if (action === 'launch-code-server') launchCodeServer();

    const view = event.target.closest('[data-view]')?.dataset.view;
    if (view) switchView(view);

    const openId = event.target.closest('[data-open-project]')?.dataset.openProject;
    if (openId) openProject(openId);

    const removeId = event.target.closest('[data-remove-project]')?.dataset.removeProject;
    if (removeId) removeProject(removeId);

    if (event.target.closest('[data-close-dialog]')) els.projectDialog.close();
  });

  document.getElementById('newProjectButton').addEventListener('click', () => openProjectDialog('new'));
  document.getElementById('importProjectButton').addEventListener('click', () => openProjectDialog('open'));
  document.getElementById('checkServerButton').addEventListener('click', checkCodeServer);
  document.getElementById('testSettingsButton').addEventListener('click', checkCodeServer);
  document.getElementById('saveSettingsButton').addEventListener('click', saveSettings);
  document.getElementById('exitCodeModeButton').addEventListener('click', exitCodeMode);
  document.getElementById('openExternalButton').addEventListener('click', openExternal);
  els.projectForm.addEventListener('submit', submitProject);
  els.projectDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    els.projectDialog.close();
  });

  render();
})();
