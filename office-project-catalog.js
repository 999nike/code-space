'use strict';

function isDirectProjectName(name) {
  return typeof name === 'string'
    && name.length > 0
    && !name.includes('/')
    && !name.includes('\\');
}

async function listOfficeProjects({ root, appRoot, readdir }) {
  const applicationFolder = require('node:path').basename(appRoot).toLocaleLowerCase();
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter(isDirectProjectName)
    .filter((name) => name.toLocaleLowerCase() !== applicationFolder)
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
    .map((name) => ({ name }));
}

module.exports = { listOfficeProjects };
