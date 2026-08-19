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
const MEMORY_APP_DIR = path.join(ROOT, 'memory-app');
const OFFICE_MEMORY_FEED_SCRIPT = path.join(MEMORY_APP_DIR, 'bridge', 'windows', 'get-office-job-feed.ps1');
const LOG_FILE = path.join(CODE_SPACE_DIR, 'worker-app-supervisor.log');
const CODE_SERVER_LOG = path.join(CODE_SPACE_DIR, 'worker-app-code-server.log');

const SERVICES = {
  memorySpace: { name: 'Memory Space', port: 8001, url: 'http://127.0.0.1:8001' },
  memoryBridge: { name: 'Memory Bridge', port: 8787, url: 'http://127.0.0.1:8787' },
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
  const feed = await getOfficeMemoryFeed();
  if (await reachable(SERVICES.office.port)) {
    const status = await officeMemoryFeedStatus();
    if (!status.managed) {
      throw new Error('Refusing to stop port 4176: its listener is not the managed Office server.');
    }
    if (status.configured) return { running: true, started: false };
    await stopOfficeListener();
  }
  log('Starting Office...');
  const pid = detached(process.execPath, ['server.mjs'], {
    cwd: OFFICE_DIR,
    // Keep this derived, job-only credential in the Office child process. It
    // is deliberately neither persisted nor written to the supervisor log.
    env: {
      PORT: String(SERVICES.office.port),
      MEMORY_SPACE_JOB_FEED_URL: feed.url,
      MEMORY_SPACE_JOB_FEED_TOKEN: feed.token
    }
  });
  return { running: await waitFor(SERVICES.office.port), started: true, pid };
}

async function getOfficeMemoryFeed() {
  const stdout = await new Promise((resolve, reject) => {
    execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', OFFICE_MEMORY_FEED_SCRIPT
    ], { windowsHide: true, timeout: 10000 }, (error, output, stderr) => {
      if (error) return reject(new Error(String(stderr || error.message).trim()));
      resolve(String(output || '').trim());
    });
  });
  let feed;
  try { feed = JSON.parse(stdout); } catch { throw new Error('Memory Bridge returned invalid Office job-feed configuration'); }
  const url = String(feed?.url || '').trim();
  const token = String(feed?.token || '').trim();
  if (!url || !token) throw new Error('Memory Bridge returned incomplete Office job-feed configuration');
  return { url, token };
}

async function officeMemoryFeedStatus() {
  return new Promise((resolve) => {
    const req = http.request({ host: HOST, port: SERVICES.office.port, path: '/api/memory-jobs', method: 'GET', timeout: 2000 }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          resolve({ managed: res.statusCode === 200 && typeof data?.configured === 'boolean', configured: data?.configured === true });
        } catch { resolve({ managed: false, configured: false }); }
      });
    });
    req.once('timeout', () => { req.destroy(); resolve({ managed: false, configured: false }); });
    req.once('error', () => resolve({ managed: false, configured: false }));
    req.end();
  });
}

async function stopOfficeListener() {
  if (process.platform !== 'win32') throw new Error('Managed Office restart is only available from the Windows Worker App supervisor');
  const script = [
    `$connection = Get-NetTCPConnection -LocalAddress '${HOST}' -LocalPort ${SERVICES.office.port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1`,
    'if (-not $connection) { exit 0 }',
    '$process = Get-CimInstance Win32_Process -Filter "ProcessId=$($connection.OwningProcess)"',
    "if (-not $process -or $process.Name -notmatch '^node(\\.exe)?$' -or $process.CommandLine -notmatch '(?i)(^|[\\\\/\\s])server\\.mjs(?:\\s|$)') {",
    "  throw 'Refusing to stop port 4176: its listener is not the Office node server.'",
    '}',
    'Stop-Process -Id $connection.OwningProcess -Force'
  ].join('; ');
  await new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 10000 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(String(stderr || error.message).trim()));
      resolve(String(stdout || '').trim());
    });
  });
  if (await waitFor(SERVICES.office.port, 2000)) throw new Error('Office did not stop cleanly for its Memory feed refresh');
  log('Restarting Office to refresh its Memory job-feed credential');
}

async function startMemoryBridgeScheduledTask() {
  if (process.platform !== 'win32') {
    throw new Error('Memory Bridge is managed by a Windows Scheduled Task');
  }

  await new Promise((resolve, reject) => {
    execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      "Start-ScheduledTask -TaskName 'Memory Space Bridge' -ErrorAction Stop"
    ], { windowsHide: true, timeout: 10000 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(String(stderr || error.message).trim()));
      resolve(String(stdout || '').trim());
    });
  });
}

async function ensureMemoryBridge() {
  if (await reachable(SERVICES.memoryBridge.port)) return { running: true, started: false };
  log('Starting Memory Bridge using the Memory Space Bridge scheduled task...');
  await startMemoryBridgeScheduledTask();
  return {
    running: await waitFor(SERVICES.memoryBridge.port, 30000),
    started: true
  };
}

async function ensureMemorySpace() {
  if (await reachable(SERVICES.memorySpace.port)) return { running: true, started: false };
  log('Starting Memory Space...');
  const pid = detached('python', [
    '-m', 'http.server', String(SERVICES.memorySpace.port), '--bind', HOST
  ], { cwd: MEMORY_APP_DIR });
  return { running: await waitFor(SERVICES.memorySpace.port), started: true, pid };
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

async function runPowerShell(script) {
  return new Promise((resolve, reject) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 15000 }, (error, stdout, stderr) => error ? reject(new Error(String(stderr || error.message).trim())) : resolve(String(stdout || '').trim())));
}

async function stopCodeServer() {
  if (!(await reachable(SERVICES.codeServer.port))) return;
  log('Stopping code-server...');
  await new Promise((resolve, reject) => execFile('wsl.exe', ['-d', 'Ubuntu', '--', 'bash', '-lc', "pid=$(ss -ltnp 'sport = :8080' 2>/dev/null | grep -o 'pid=[0-9]*' | head -n1 | cut -d= -f2); test -n \"$pid\" || exit 3; cmd=$(ps -p \"$pid\" -o args=); case \"$cmd\" in *code-server*) kill \"$pid\";; *) exit 4;; esac"], { windowsHide: true, timeout: 10000 }, (error, stdout, stderr) => error ? reject(new Error(`Refusing to stop code-server: ${String(stderr || error.message).trim()}`)) : resolve(String(stdout || '').trim())));
  if (await waitFor(SERVICES.codeServer.port, 3000)) throw new Error('code-server did not stop cleanly');
}

async function stopMemorySpace() {
  if (!(await reachable(SERVICES.memorySpace.port))) return;
  log('Stopping Memory Space...');
  await runPowerShell([`$c=Get-NetTCPConnection -LocalAddress '${HOST}' -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue|Select-Object -First 1`, 'if(-not $c){exit 0}', '$p=Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)"', "if(-not $p -or $p.Name -notmatch '^python(\\.exe)?$' -or $p.CommandLine -notmatch '(?i)-m\\s+http\\.server\\s+8001'){throw 'Refusing to stop port 8001: listener is not managed Memory Space.'}", 'Stop-Process -Id $c.OwningProcess -Force'].join(';'));
  if (await waitFor(SERVICES.memorySpace.port, 3000)) throw new Error('Memory Space did not stop cleanly');
}

async function stopMemoryBridge() {
  if (!(await reachable(SERVICES.memoryBridge.port))) return;
  log('Stopping Memory Bridge scheduled task...');
  await runPowerShell("Stop-ScheduledTask -TaskName 'Memory Space Bridge' -ErrorAction Stop");
  if (await waitFor(SERVICES.memoryBridge.port, 5000)) throw new Error('Memory Bridge did not stop cleanly');
}

async function stopWorkerApp() {
  log('Worker App explicit shutdown requested');
  await stopCodeServer();
  if (await reachable(SERVICES.office.port)) { const status = await officeMemoryFeedStatus(); if (!status.managed) throw new Error('Refusing to stop port 4176: listener is not managed Office.'); await stopOfficeListener(); }
  await stopMemorySpace();
  await stopMemoryBridge();
  await stopCodeSpaceListener();
  log('Worker App stopped');
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
  const stopAll = process.argv.includes('--stop-all');
  log(restartOnly ? 'Code Space managed restart requested' : 'Worker App startup requested');

  if (stopAll) { await stopWorkerApp(); return; }

  if (restartOnly) {
    const codeSpace = await restartCodeSpace();
    log(`Code Space ready at ${SERVICES.codeSpace.url}`);
    return;
  }

  const [memoryBridge, memorySpace] = await Promise.all([
    ensureMemoryBridge(),
    ensureMemorySpace()
  ]);

  log(`Memory Bridge ${memoryBridge.running ? 'ready' : 'FAILED'} at ${SERVICES.memoryBridge.url}`);
  log(`Memory Space ${memorySpace.running ? 'ready' : 'FAILED'} at ${SERVICES.memorySpace.url}`);

  const [codeSpace, office] = await Promise.all([
    ensureCodeSpace(),
    ensureOffice()
  ]);

  log(`Code Space ${codeSpace.running ? 'ready' : 'FAILED'} at ${SERVICES.codeSpace.url}`);
  log(`Office ${office.running ? 'ready' : 'FAILED'} at ${SERVICES.office.url}`);

  // Open Memory Space as its own tab. Code Space must still open before Office:
  // its initial document claims the `code-space`
  // browsing-context name, which Office dispatches reuse instead of creating
  // another tab. The launcher never starts services during dispatch.
  if (memorySpace.running) openBrowserTab(SERVICES.memorySpace.url);
  if (codeSpace.running) openBrowserTab(SERVICES.codeSpace.url);
  if (office.running) openBrowserTab(SERVICES.office.url);

  const codeServer = await ensureCodeServer();
  log(`code-server ${codeServer.running ? 'ready' : 'FAILED'} at ${SERVICES.codeServer.url}`);

  if (!memoryBridge.running || !memorySpace.running || !codeSpace.running || !office.running || !codeServer.running) {
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
