'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.join(__dirname, '..');

test('startup opens the one named Code Space tab before Office, then Office reuses it', () => {
  const supervisor = fs.readFileSync(path.join(appRoot, 'worker-app-supervisor.js'), 'utf8');
  const launcher = fs.readFileSync(path.join(appRoot, 'Start Worker App.cmd'), 'utf8');
  const connector = fs.readFileSync(path.join(appRoot, '..', 'office-app', 'src', 'connectors', 'code-space.js'), 'utf8');
  const page = fs.readFileSync(path.join(appRoot, 'index.html'), 'utf8');

  assert.match(supervisor, /function openBrowserTab\(url\)/);
  assert.match(supervisor, /spawn\('cmd\.exe', \['\/c', 'start', '', url\]/);
  assert.match(supervisor, /if \(codeSpace\.running\) openBrowserTab\(SERVICES\.codeSpace\.url\);/);
  assert.match(supervisor, /if \(office\.running\) openBrowserTab\(SERVICES\.office\.url\);/);
  assert.ok(
    supervisor.indexOf('openBrowserTab(SERVICES.codeSpace.url)')
      < supervisor.indexOf('openBrowserTab(SERVICES.office.url)'),
    'Code Space must open before Office so its named context exists first'
  );
  assert.doesNotMatch(launcher, /127\.0\.0\.1:8090|https?:\/\//i);

  assert.match(page, /<script>window\.name = 'code-space';<\/script>/);
  assert.ok(page.indexOf("window.name = 'code-space'") < page.indexOf('dispatch-package.js'));
  assert.match(connector, /const CODE_SPACE_WINDOW_NAME = "code-space"/);
  assert.match(connector, /window\.open\(CODE_SPACE_URL, CODE_SPACE_WINDOW_NAME\)/);
  assert.match(connector, /target\.location = url/);
});
