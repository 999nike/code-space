#!/usr/bin/env node
'use strict';

const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const HOST = '127.0.0.1';
const ROOT = path.resolve(process.env.WORKER_APP_ROOT || 'E:\\WIZZ-Server\\workspaces');
const CODE_SPACE_DIR = path.join(ROOT, 'code-space');
const OFFICE_DIR = path.join(ROOT, 'office-app');

const SERVICES = {
  office: { name: 'Office', port: 4176, url: 'http://127.0.0.1:4176' },
  codeSpace: { name: 'Code Space', port: 8090, url: 'http://127.0.0.1:8090' },
  codeServer: { name: 'code-server', port: 8080, url: 'http://127.0.0.1:8080' }
};

function reachable(port, timeout = 1200) {
  return new Promise((resolve) => {
    const req = http.request({ host: HOST, port, path: '/', method: 'GET', timeout }, (res) => {
      res.resume();
      resolve(true);
    });
    req.once('timeout', () => req.destroy());
    req.once('error', () => resolve(false));
    req.end();
  });
}

function waitFor(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const check = async () => {
      if (await reachable(port, 1500)) return resolve(true);
      if (Date.now() >= deadline) return resolve(false);
      setTimeout(check, 500);
    };
    check();
  });
}

function detached(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
    env: { ...process.env, ...(options.env || {}) }
  });
  child.unref();
  return child.pid;
}

async function ensureCodeSpace() {
  if (await reachable(SERVICES.codeSpace.port)) return { running: true, started: false };
  const pid = detached(process.execPath, ['server.js'], { cwd: CODE_SPACE_DIR });
  return { running: await waitFor(SERVICES.codeSpace.port), started: true, pid };
}

async function ensureOffice() {
  if (await reachable(SERVICES.office.port)) return { running: true, started: false };
  const pid = detached(process.execPath, ['server.mjs'], {
    cwd: OFFICE_DIR,
    env: { PORT: String(SERVICES.office.port) }
  });
  return { running: await waitFor(SERVICES.office.port), started: true, pid };
}

async function ensureCodeServer() {
  if (await reachable(SERVICES.codeServer.port)) return { running: true, started: false };

  let pid;
  if (process.platform === 'win32') {
    pid = detached('wsl.exe', [
      '-d', 'Ubuntu', '--', 'bash', '-lc',
      'nohup setsid code-server --bind-addr 0.0.0.0:8080 >/tmp/worker-app-code-server.log 2>&1 < /dev/null &'
    ]);
  } else {
    pid = detached('code-server', ['--bind-addr', '127.0.0.1:8080'], { cwd: ROOT });
  }

  return { running: await waitFor(SERVICES.codeServer.port, 30000), started: true, pid };
}

function openOffice() {
  if (process.env.WORKER_APP_NO_BROWSER === '1') return;
  if (process.platform === 'win32') {
    const child = spawn('cmd.exe', ['/c', 'start', '', SERVICES.office.url], {
      detached: true,
      windowsHide: true,
      stdio: 'ignore'
    });
    child.unref();
  }
}

async function main() {
  const results = {};

  results.codeSpace = await ensureCodeSpace();
  results.office = await ensureOffice();
  results.codeServer = await ensureCodeServer();

  const failed = Object.entries(results).filter(([, result]) => !result.running);
  if (failed.length) {
    console.error('Worker App could not start:', failed.map(([name]) => SERVICES[name]?.name || name).join(', '));
    process.exitCode = 1;
    return;
  }

  console.log('Worker App ready');
  console.log(`Office: ${SERVICES.office.url}`);
  console.log(`Code Space: ${SERVICES.codeSpace.url}`);
  console.log(`code-server: ${SERVICES.codeServer.url}`);
  openOffice();
}

main().catch((error) => {
  console.error('[worker-app-supervisor]', error);
  process.exitCode = 1;
});
