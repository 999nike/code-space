'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.join(__dirname, '..');

test('startup opens Code Space before Office and Office dispatches through the hidden bridge', () => {
  const supervisor = fs.readFileSync(path.join(appRoot, 'worker-app-supervisor.js'), 'utf8');
  const launcher = fs.readFileSync(path.join(appRoot, 'Start Worker App.cmd'), 'utf8');
  const connector = fs.readFileSync(path.join(appRoot, '..', 'office-app', 'src', 'connectors', 'code-space.js'), 'utf8');
  const page = fs.readFileSync(path.join(appRoot, 'index.html'), 'utf8');

  assert.match(supervisor, /function openBrowserTab\(url\)/);
  assert.match(supervisor, /spawn\('explorer\.exe', \[url\]/);
  assert.doesNotMatch(supervisor, /spawn\('cmd\.exe', \['\/c', 'start'/);
  assert.match(supervisor, /async function ensureService\(key, ensure\)/);
  assert.match(supervisor, /running: await reachable\(SERVICES\[key\]\.port\)/);
  assert.match(supervisor, /const office = await ensureService\('office', ensureOffice\)/);
  assert.match(supervisor, /const codeServer = await ensureService\('codeServer', ensureCodeServer\)/);
  assert.match(supervisor, /if \(codeSpace\.running\) openBrowserTab\(SERVICES\.codeSpace\.url\);/);
  assert.match(supervisor, /if \(office\.running\) openBrowserTab\(SERVICES\.office\.url\);/);
  assert.match(supervisor, /if \(memorySpace\.running\) openBrowserTab\(SERVICES\.memorySpace\.url\);/);
  assert.ok(
    supervisor.indexOf('openBrowserTab(SERVICES.codeSpace.url)')
      < supervisor.indexOf('openBrowserTab(SERVICES.office.url)'),
    'Code Space must open before Office so the dispatch bridge is available first'
  );
  assert.match(supervisor, /spawn\('wsl\.exe', \[/);
  assert.match(supervisor, /exec code-server --bind-addr 0\.0\.0\.0:8080/);
  assert.doesNotMatch(supervisor, /nohup setsid code-server --bind-addr 0\.0\.0\.0:8080/);
  assert.match(supervisor, /windowsHide: true,\s*detached: false,\s*stdio: 'ignore'/);
  assert.ok(
    supervisor.indexOf("ensureService('codeServer', ensureCodeServer)")
      < supervisor.indexOf('openBrowserTab(SERVICES.memorySpace.url)'),
    'code-server startup must be attempted before browser tabs are opened'
  );
  assert.doesNotMatch(launcher, /127\.0\.0\.1:8090|https?:\/\//i);

  assert.match(connector, /const CODE_SPACE_BRIDGE_URL = `\$\{CODE_SPACE_URL\}office-dispatch-bridge\.html`/);
  assert.match(connector, /document\.createElement\("iframe"\)/);
  assert.match(connector, /bridgeFrame\.hidden = true/);
  assert.match(connector, /target\.postMessage\(/);
  assert.doesNotMatch(connector, /window\.open\(/);
});
