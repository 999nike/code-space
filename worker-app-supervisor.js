#!/usr/bin/env node
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');

const HOST = '127.0.0.1';
const ROOT = path.resolve(process.env.WORKER_APP_ROOT || 'E:\\WIZZ-Server\\workspaces');
const CODE_SPACE_DIR = path.join(ROOT, 'code-space');
const OFFICE_DIR = path.join(ROOT, 'office-app');
const LOG_FILE = path.join(CODE_SPACE_DIR, 'worker-app-supervisor.log');
const CODE_SERVER_LOG = path.join(CODE_SPACE_DIR, 'worker-app-code-server.log');

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
    stdio: options.stdio || 'ignore',
    env: { ...process.env, ...(options.env || {}) }
  });
  child.once('error', (error) => log(`${command} failed to launch: ${error.message}`));
  child.unref();
  return child.pid;
}

async function stopCodeSpaceListener() {
  if (process.platform !== 'win32') {
    throw new Error('Managed Code Space restart is only available from the Windows Worker App supervisor');
  }

  // Identify the listener first, then verify it is this app's Node server before
  // stopping it. This prevents a restart request from affecting another service.
  const script = [
    `$connection = Get-NetTCPConnection -LocalAddress '${HOST}' -LocalPort ${SERVICES.codeSpace.port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1`,
    'if (-not $connection) { exit 0 }',
    '$process = Get-CimInstance Win32_Process -Filter "ProcessId=$($connection.OwningProcess)"',
    "if (-not $process -or $process.Name -notmatch '^node(\\.exe)?$' -or $process.CommandLine -notmatch '(?i)(^|[\\\\/\\s])server\\.js(?:\\s|$)') {",
    "  throw 'Refusing to stop port 8090: its listener is not the Code Space node server.'",
    '}',
    'Stop-Process -Id $connection.OwningProcess -Force',
    'Write-Output $connection.OwningProcess'
  ].join('; ');

  const result = await new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
      timeout: 10000
    }, (error, stdout, stderr) => {
      if (error) return reject(new Error(String(stderr || error.message).trim()));
      resolve(String(stdout || '').trim());
    });
  });

  if (!result) return { stopped: false, pid: null };
  const stopped = !(await waitFor(SERVICES.codeSpace.port, 2000));
  if (!stopped) throw new Error(`Code Space process ${result} did not stop cleanly`);
  return { stopped: true, pid: Number(result) };
}

async function restartCodeSpace() {
  const previous = await stopCodeSpaceListener();
  if (previous.stopped) log(`Stopped Code Space process ${previous.pid}`);
  else log('Code Space was not running; starting it now');

  const codeSpace = await ensureCodeSpace();
  if (!codeSpace.running) throw new Error('Code Space did not become ready after restart');
  return codeSpace;
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
    let out;
    try {
      out = fs.openSync(CODE_SERVER_LOG, 'a');
      fs.appendFileSync(CODE_SERVER_LOG, `\n[${new Date().toISOString()}] starting code-server\n`);
    } catch {}

    pid = detached('wsl.exe', [
      '-d', 'Ubuntu', '--', 'bash', '-lc',
      'exec code-server --bind-addr 0.0.0.0:8080'
    ], {
      stdio: out ? ['ignore', out, out] : 'ignore'
    });
  } else {
    pid = detached('code-server', ['--bind-addr', '127.0.0.1:8080'], { cwd: ROOT });
  }

  return { running: await waitFor(SERVICES.codeServer.port, 30000), started: true, pid };
}

function openBrowserTab(url) {
  if (process.env.WORKER_APP_NO_BROWSER === '1' || process.platform !== 'win32') return;
  const child = spawn('cmd.exe', ['/c', 'start', '', url], {
    detached: true,
    windowsHide: true,
    stdio: 'ignore'
  });
  child.unref();
}

async function main() {
  const restartOnly = process.argv.includes('--restart-code-space');
  log(restartOnly ? 'Code Space managed restart requested' : 'Worker App startup requested');

  if (restartOnly) {
    const codeSpace = await restartCodeSpace();
    log(`Code Space ready at ${SERVICES.codeSpace.url}`);
    return;
  }

  const [codeSpace, office] = await Promise.all([
    ensureCodeSpace(),
    ensureOffice()
  ]);

  log(`Code Space ${codeSpace.running ? 'ready' : 'FAILED'} at ${SERVICES.codeSpace.url}`);
  log(`Office ${office.running ? 'ready' : 'FAILED'} at ${SERVICES.office.url}`);

  // Open Code Space first. Its initial document claims the `code-space`
  // browsing-context name, which Office dispatches reuse instead of creating
  // another tab. The launcher never starts services during dispatch.
  if (codeSpace.running) openBrowserTab(SERVICES.codeSpace.url);
  if (office.running) openBrowserTab(SERVICES.office.url);

  const codeServer = await ensureCodeServer();
  log(`code-server ${codeServer.running ? 'ready' : 'FAILED'} at ${SERVICES.codeServer.url}`);

  if (!codeSpace.running || !office.running || !codeServer.running) {
    log(`Startup incomplete. See ${LOG_FILE}`);
    if (!codeServer.running) log(`code-server details: ${CODE_SERVER_LOG}`);
    process.exitCode = 1;
    return;
  }

  log('Worker App ready');
}

main().catch((error) => {
  log(`Supervisor fatal error: ${error?.stack || error}`);
  process.exitCode = 1;
});
