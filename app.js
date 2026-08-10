(() => {
  'use strict';

  const PROJECTS_KEY = 'code-space-projects-v1';
  const SETTINGS_KEY = 'code-space-settings-v1';
  const ACTIVITY_KEY = 'code-space-activity-v1';

  const defaults = { codeServerUrl: 'http://127.0.0.1:8080' };

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
    projectSubmitButton: document.getElementById('projectSubmitButton'),
    runtimeState: document.getElementById('runtimeState'),
    gitState: document.getElementById('gitState'),
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
  let runtimeInfo = null;
  let toastTimer;
  let startingCodeServer = false;

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

  async function api(path, options = {}) {
    const response = await fetch(path, {
      cache: 'no-store',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || `Code Space runtime returned HTTP ${response.status}`);
    return data;
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
    checkRuntime({ quiet: true });
  }

  function renderProjects() {
    const items = projects();
    els.projectCount.textContent = `${items.length} ${items.length === 1 ? 'project' : 'projects'}`;
    els.workspaceEmpty.hidden = items.length > 0;
    els.workspaceList.hidden = items.length === 0;
    els.workspaceList.innerHTML = items.map((project) => {
      const state = project.lastGitState || 'Ready';
      const stateClass = state.toLowerCase().includes('change') ? 'changes' : state.toLowerCase().includes('error') ? 'error' : '';
      return `
        <article class="workspace-row" data-project-id="${escapeAttr(project.id)}">
          <div class="workspace-main">
            <span class="project-icon">&lt;/&gt;</span>
            <div><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project.path)}</small></div>
          </div>
          <div class="workspace-meta">${project.repo ? escapeHtml(shortRepo(project.repo)) : 'Local workspace'}</div>
          <div class="workspace-state ${stateClass}">● ${escapeHtml(state)}</div>
          <div class="workspace-actions">
            <button type="button" data-remove-project="${escapeAttr(project.id)}">Remove</button>
            <button type="button" class="open" data-open-project="${escapeAttr(project.id)}">Open</button>
          </div>
        </article>`;
    }).join('');
  }

  function renderActivity() {
    const items = activity();
    if (!items.length) {
      els.activityList.innerHTML = '<p class="muted">Nothing yet. Start a project and activity will appear here.</p>';
      return;
    }
    els.activityList.innerHTML = items.slice(0, 5).map((item) => `
      <div class="activity-item"><strong>${escapeHtml(item.text)}</strong><small>${escapeHtml(item.detail || relativeTime(item.at))}</small></div>`).join('');
  }

  function openProjectDialog(mode) {
    projectMode = mode;
    els.projectForm.reset();
    els.repoField.hidden = mode === 'open';
    const suggestedRoot = runtimeInfo?.workspaceRoot || 'E:\\WIZZ-Server\\workspaces';

    if (mode === 'clone') {
      els.projectDialogTitle.textContent = 'Clone repository';
      els.projectRepoInput.required = true;
      els.projectPathInput.placeholder = `${suggestedRoot}\\my-project`;
      els.projectSubmitButton.textContent = 'Clone project';
    } else if (mode === 'open') {
      els.projectDialogTitle.textContent = 'Open existing project';
      els.projectRepoInput.required = false;
      els.projectPathInput.placeholder = `${suggestedRoot}\\existing-project`;
      els.projectSubmitButton.textContent = 'Open project';
    } else {
      els.projectDialogTitle.textContent = 'New project';
      els.projectRepoInput.required = false;
      els.projectPathInput.placeholder = `${suggestedRoot}\\my-project`;
      els.projectSubmitButton.textContent = 'Create project';
    }

    els.projectDialog.showModal();
    requestAnimationFrame(() => els.projectNameInput.focus());
  }

  async function submitProject(event) {
    event.preventDefault();
    const name = els.projectNameInput.value.trim();
    const projectPath = els.projectPathInput.value.trim();
    const repo = els.projectRepoInput.value.trim();
    if (!name || !projectPath || (projectMode === 'clone' && !repo)) return;

    const original = els.projectSubmitButton.textContent;
    els.projectSubmitButton.disabled = true;
    els.projectSubmitButton.textContent = projectMode === 'clone' ? 'Cloning…' : projectMode === 'open' ? 'Opening…' : 'Creating…';

    try {
      const endpoint = projectMode === 'clone'
        ? '/api/projects/clone'
        : projectMode === 'open'
          ? '/api/projects/open'
          : '/api/projects/new';

      const result = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({ name, path: projectPath, repo })
      });

      const items = projects();
      const resolvedPath = result.path || projectPath;
      const existing = items.find((item) => item.path.toLowerCase() === resolvedPath.toLowerCase());
      const project = existing || {
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: new Date().toISOString()
      };
      Object.assign(project, {
        name,
        path: resolvedPath,
        repo: projectMode === 'open' ? '' : repo,
        mode: projectMode,
        lastOpenedAt: project.lastOpenedAt || null,
        lastGitState: result.git?.clean === false ? 'Changes' : 'Ready'
      });
      if (!existing) items.unshift(project);
      save(PROJECTS_KEY, items);

      els.projectDialog.close();
      renderProjects();
      addActivity(projectMode === 'clone' ? 'Cloned repository' : projectMode === 'open' ? 'Opened existing workspace' : 'Created local workspace', name);
      toast(projectMode === 'clone' ? `${name} cloned` : `${name} ready`);
    } catch (error) {
      console.error(error);
      toast(error?.message || 'Could not prepare project');
    } finally {
      els.projectSubmitButton.disabled = false;
      els.projectSubmitButton.textContent = original;
    }
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

  async function openProject(id) {
    const items = projects();
    const project = items.find((item) => item.id === id);
    if (!project) return;

    toast(`Preparing ${project.name}…`);
    try {
      const prepared = await api('/api/projects/prepare', {
        method: 'POST',
        body: JSON.stringify({ path: project.path })
      });
      project.lastOpenedAt = new Date().toISOString();
      project.lastGitState = prepared.isGit
        ? prepared.clean === false ? 'Changes' : 'Clean'
        : 'Ready';
      save(PROJECTS_KEY, items);
      renderProjects();
      activeProjectId = id;
      addActivity(prepared.pulled ? 'Pulled latest changes' : 'Opened workspace', prepared.message || project.name);
      await startCoding(project);
    } catch (error) {
      console.error(error);
      project.lastGitState = 'Error';
      save(PROJECTS_KEY, items);
      renderProjects();
      toast(error?.message || 'Could not open project');
    }
  }

  function normalizedCodeServerUrl() {
    return String(runtimeInfo?.codeServerUrl || settings().codeServerUrl || defaults.codeServerUrl).trim().replace(/\/+$/, '');
  }

  function codeServerFolderPath(value) {
    const raw = String(value || '').trim();
    if (!raw || runtimeInfo?.codeServerPlatform !== 'wsl') return raw;
    const match = raw.match(/^([A-Za-z]):[\\/](.*)$/);
    if (!match) return raw.replaceAll('\\', '/');
    const drive = match[1].toLowerCase();
    const rest = match[2].replaceAll('\\', '/');
    return `/mnt/${drive}/${rest}`;
  }

  function projectCodeUrl(project, { embedded = true } = {}) {
    const base = embedded ? '/editor' : normalizedCodeServerUrl();
    if (!project?.path) return `${base}/`;
    const params = new URLSearchParams({ folder: codeServerFolderPath(project.path) });
    return `${base}/?${params.toString()}`;
  }

  async function ensureCodeServer() {
    if (startingCodeServer) return runtimeInfo;
    startingCodeServer = true;
    els.codeServerState.textContent = 'Starting…';
    els.codeServerState.className = '';
    try {
      const result = await api('/api/code-server/start', {
        method: 'POST',
        body: JSON.stringify({})
      });
      runtimeInfo = { ...(runtimeInfo || {}), codeServer: true, codeServerUrl: result.codeServerUrl || normalizedCodeServerUrl() };
      els.codeServerState.textContent = 'Running';
      els.codeServerState.className = 'ready';
      if (result.started) addActivity('Started code-server', runtimeInfo.codeServerUrl);
      return runtimeInfo;
    } finally {
      startingCodeServer = false;
    }
  }

  function setFrameNoticeVisible(visible) {
    els.frameNotice.hidden = !visible;
    els.frameNotice.classList.toggle('is-hidden', !visible);
  }

  async function startCoding(project = null) {
    setFrameNoticeVisible(true);
    const heading = els.frameNotice.querySelector('h2');
    const copy = els.frameNotice.querySelector('p');
    if (heading) heading.textContent = 'Starting Code Space…';
    if (copy) copy.textContent = 'Starting code-server and preparing the coding environment.';

    try {
      await ensureCodeServer();
      launchCodeServer(project);
    } catch (error) {
      console.error(error);
      toast(error?.message || 'Could not start code-server');
      await checkRuntime({ quiet: true });
    }
  }

  function launchCodeServer(project = null) {
    const target = projectCodeUrl(project);
    els.activeProjectLabel.textContent = project?.name || 'code-server';
    els.codeMode.hidden = false;
    els.homeView.classList.add('coding-active');
    setFrameNoticeVisible(true);

    // Register before changing src. A local code-server can respond quickly
    // enough for its load event to fire before a later listener is attached.
    // The reverse proxy can keep an iframe load event pending even when
    // code-server is already ready. Do not let that leave Code Mode covered.
    let noticeSettled = false;
    const hideNotice = () => {
      if (noticeSettled) return;
      noticeSettled = true;
      setTimeout(() => { setFrameNoticeVisible(false); }, 250);
    };
    els.codeServerFrame.addEventListener('load', hideNotice, { once: true });
    els.codeServerFrame.src = target;
    setTimeout(hideNotice, 1600);
  }

  function exitCodeMode() {
    els.codeMode.hidden = true;
    els.homeView.classList.remove('coding-active');
    els.codeServerFrame.src = 'about:blank';
    setFrameNoticeVisible(true);
    activeProjectId = null;
  }

  async function checkRuntime({ quiet = false } = {}) {
    els.runtimeState.textContent = 'Checking…';
    els.codeServerState.textContent = 'Checking…';
    els.gitState.textContent = 'Checking…';
    try {
      runtimeInfo = await api('/api/status');
      els.runtimeState.textContent = 'Ready';
      els.runtimeState.className = 'ready';
      els.codeServerState.textContent = runtimeInfo.codeServer ? 'Running' : 'Stopped';
      els.codeServerState.className = runtimeInfo.codeServer ? 'ready' : '';
      els.gitState.textContent = runtimeInfo.git ? 'Ready' : 'Unavailable';
      els.gitState.className = runtimeInfo.git ? 'ready' : '';

      if (runtimeInfo.codeServerUrl && localStorage.getItem(SETTINGS_KEY) === null) {
        els.codeServerUrlInput.value = runtimeInfo.codeServerUrl;
      }
      if (!quiet) toast(runtimeInfo.codeServer ? 'Code Space is ready' : 'Runtime ready — Start Coding will launch code-server');
      return runtimeInfo;
    } catch (error) {
      console.debug('Code Space runtime check failed:', error);
      els.runtimeState.textContent = 'Offline';
      els.runtimeState.className = '';
      els.codeServerState.textContent = 'Unknown';
      els.codeServerState.className = '';
      els.gitState.textContent = 'Unknown';
      els.gitState.className = '';
      if (!quiet) toast('Start Code Space with node server.js');
      return null;
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
    window.open(projectCodeUrl(project, { embedded: false }), '_blank', 'noopener,noreferrer');
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
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2800);
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
    if (action === 'start-coding') startCoding();

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
  document.getElementById('checkServerButton').addEventListener('click', () => checkRuntime());
  document.getElementById('testSettingsButton').addEventListener('click', () => checkRuntime());
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
