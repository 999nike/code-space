const test = require('node:test');
const assert = require('node:assert/strict');
const { listOfficeProjects } = require('../office-project-catalog.js');

const directory = (name) => ({ name, isDirectory: () => true });
const file = (name) => ({ name, isDirectory: () => false });

test('returns only direct workspace folder names and excludes the Code Space app folder', async () => {
  const projects = await listOfficeProjects({
    root: 'E:\\WIZZ-Server\\workspaces',
    appRoot: 'E:\\WIZZ-Server\\workspaces\\code-space',
    readdir: async () => [
      directory('office-app'),
      directory('space-junkz-shooter'),
      directory('agent-sandbox-test'),
      directory('code-space'),
      directory('nested/project'),
      file('README.md'),
    ],
  });
  assert.deepEqual(projects, [
    { name: 'agent-sandbox-test' },
    { name: 'office-app' },
    { name: 'space-junkz-shooter' },
  ]);
});
