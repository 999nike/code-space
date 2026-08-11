#!/usr/bin/env node
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const HOST = '127.0.0.1';
const ROOT = path.resolve(process.env.WORKER_APP_ROOT || 'E:\\WIZZ-Server\\workspaces');
const CODE_SPACE_DIR = path.join(ROOT, 'code-space');
const OFFICE_DIR = path.join(ROOT, 'office-app');
const LOG_FILE = path.join(CODE_SPACE_DIR, 'worker-app-supervisor.log');

const SERVICES = {
  office: { name: 'Office', port: 4176, url: 'http://127.0.0.1:4176' },
  codeSpace: { name: 'Code Space', port: 8090, url: 'http://127.0.0.1:8090' },
  codeServer: { name: 'code-server', port: 8080, url: 'http://127.0.0.1:8080' }
};

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, `${line}\n`); } catch {}
}

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
  child.once('error', (error) => log(`${command} failed to launch: ${error.message}`));
  child.unref();
  return child.pid;
}

async function ensureCodeSpace() {
  if (await reachable(SERVICES.codeSpace.port)) return { running: true, started: false };
  log('Starting Code Space...');
  const pid = detached(process.execPath, ['server.js'], { cwd: CODE_SPACE_DIR });
  return { running: await waitFor(SERVICES.codeSpace.port), started: true, pid };
}

async function ensureOffice() {
  if (await reachable(SERVICES.office.port)) return { running: true, started: false };
  log('Starting Office...');
  const pid = detached(process.execPath, ['server.mjs'], {
    cwd: OFFICE_DIR,
    env: { PORT: String(SERVICES.office.port) }
  });
  return { running: await waitFor(SERVICES.office.port), started: true, pid };
}

async function ensureCodeServer() {
  if (await reachable(SERVICES.codeServer.port)) return { running: true, started: false };
  log('Starting code-server in Ubuntu WSL...');

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

function openUrl(url) {
  if (process.env.WORKER_APP_NO_BROWSER === '1' || process.platform !== 'win32') return;
  const child = spawn('cmd.exe', ['/c', 'start', '', url], {
    detached: true,
    windowsHide: true,
    stdio: 'ignore'
  });
  child.unref();
}

async function main() {
  log('Worker App startup requested');

  const [codeSpace, office] = await Promise.all([
    ensureCodeSpace(),
    ensureOffice()
  ]);

  log(`Code Space ${codeSpace.running ? 'ready' : 'FAILED'} at ${SERVICES.codeSpace.url}`);
  log(`Office ${office.running ? 'ready' : 'FAILED'} at ${SERVICES.office.url}`);

  if (office.running) openUrl(SERVICES.office.url);

  const codeServer = await ensureCodeServer();
  log(`code-server ${codeServer.running ? 'ready' : 'FAILED'} at ${SERVICES.codeServer.url}`);

  if (!codeSpace.running || !office.running || !codeServer.running) {
    log(`Startup incomplete. See ${LOG_FILE}`);
    process.exitCode = 1;
    return;
  }

  log('Worker App ready');
}

main().catch((error) => {
  log(`Supervisor fatal error: ${error?.stack || error}`);
  process.exitCode = 1;
});
