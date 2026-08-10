#!/usr/bin/env node
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const HOST = '127.0.0.1';
const PORT = Number(process.env.CODE_SPACE_PORT || 8090);
const ROOT = path.resolve(process.env.CODE_SPACE_WORKSPACES || 'E:\\WIZZ-Server\\workspaces');
const CODE_SERVER_URL = String(process.env.CODE_SERVER_URL || 'http://127.0.0.1:8080').replace(/\/+$/, '');
const CODE_SERVER_COMMAND = String(process.env.CODE_SERVER_COMMAND || 'code-server').trim();
const APP_ROOT = __dirname;
const MAX_BODY = 128 * 1024;
let codeServerProcess = null;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function safeError(error) {
  return String(error?.message || error || 'Unknown error').slice(0, 500);
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('Request is too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Error('Request body must be valid JSON');
  }
}

function resolveNewProjectPath(value, name) {
  const requested = String(value || '').trim();
  const fallbackName = String(name || 'project').trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '-');
  const target = path.resolve(requested || path.join(ROOT, fallbackName));
  const relative = path.relative(ROOT, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`New and cloned projects must stay inside ${ROOT}`);
  }
  return target;
}

async function assertDirectory(target) {
  const resolved = path.resolve(String(target || '').trim());
  if (!resolved) throw new Error('Project folder is required');
  const stat = await fsp.stat(resolved).catch(() => null);
  if (!stat?.isDirectory()) throw new Error('That project folder does not exist');
  return resolved;
}

async function git(args, cwd, timeout = 30000) {
  const result = await execFileAsync('git', args, {
    cwd,
    windowsHide: true,
    timeout,
    maxBuffer: 2 * 1024 * 1024
  });
  return String(result.stdout || '').trim();
}

async function gitInfo(cwd) {
  try {
    await git(['rev-parse', '--is-inside-work-tree'], cwd, 8000);
  } catch {
    return { isGit: false, branch: null, clean: null, pulled: false, message: 'Not a Git repository' };
  }

  const branch = await git(['branch', '--show-current'], cwd, 8000).catch(() => '');
  const porcelain = await git(['status', '--porcelain'], cwd, 8000).catch(() => '');
  const clean = porcelain.length === 0;
  return { isGit: true, branch: branch || 'detached', clean, pulled: false };
}

async function prepareProject(projectPath) {
  const cwd = await assertDirectory(projectPath);
  const info = await gitInfo(cwd);

  if (!info.isGit) return { path: cwd, ...info };
  if (!info.clean) {
    return { path: cwd, ...info, message: 'Local changes present — auto-pull skipped' };
  }

  try {
    const output = await git(['pull', '--ff-only'], cwd, 60000);
    return {
      path: cwd,
      ...info,
      pulled: true,
      message: output || 'Repository is up to date'
    };
  } catch (error) {
    return {
      path: cwd,
      ...info,
      pulled: false,
      message: `Auto-pull skipped: ${safeError(error)}`
    };
  }
}

async function isCodeServerReachable(timeout = 1800) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(CODE_SERVER_URL, { redirect: 'manual', signal: controller.signal });
    clearTimeout(timer);
    return response.status > 0;
  } catch {
    return false;
  }
}

function codeServerBindAddress() {
  try {
    const parsed = new URL(CODE_SERVER_URL);
    return parsed.host || '127.0.0.1:8080';
  } catch {
    return '127.0.0.1:8080';
  }
}

function startDetachedCodeServer() {
  let child;

  if (process.platform === 'win32') {
    child = spawn('wsl.exe', [
      '-d', 'Ubuntu',
      '--', 'bash', '-lc',
      'exec code-server --bind-addr 0.0.0.0:8080'
    ], {
      windowsHide: true,
      detached: true,
      stdio: 'ignore'
    });
  } else {
    child = spawn(CODE_SERVER_COMMAND, ['--bind-addr', codeServerBindAddress()], {
      cwd: ROOT,
      detached: true,
      stdio: 'ignore'
    });
  }

  child.on('error', (error) => {
    console.error('[code-space] code-server start failed:', safeError(error));
  });
  child.unref();
  codeServerProcess = child;
  return child.pid || null;
}

async function ensureCodeServer() {
  if (await isCodeServerReachable()) {
    return { started: false, running: true, codeServerUrl: CODE_SERVER_URL };
  }

  const pid = startDetachedCodeServer();
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (await isCodeServerReachable(1200)) {
      return { started: true, running: true, pid, codeServerUrl: CODE_SERVER_URL };
    }
  }

  throw new Error(`code-server did not become reachable at ${CODE_SERVER_URL}. Check that Ubuntu WSL is installed and code-server is available inside it.`);
}

async function runtimeStatus() {
  let gitVersion = null;
  try {
    gitVersion = await git(['--version'], APP_ROOT, 5000);
  } catch {}

  return {
    runtime: true,
    host: HOST,
    port: PORT,
    workspaceRoot: ROOT,
    codeServerUrl: CODE_SERVER_URL,
    codeServerPlatform: process.platform === 'win32' ? 'wsl' : process.platform,
    codeServer: await isCodeServerReachable(),
    codeServerPid: codeServerProcess?.pid || null,
    git: Boolean(gitVersion),
    gitVersion
  };
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/status' && req.method === 'GET') {
    return json(res, 200, await runtimeStatus());
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const body = await readBody(req);

  if (pathname === '/api/code-server/start') {
    return json(res, 200, await ensureCodeServer());
  }

  if (pathname === '/api/projects/new') {
    const target = resolveNewProjectPath(body.path, body.name);
    const existing = await fsp.stat(target).catch(() => null);
    if (existing) throw new Error('That project folder already exists');
    await fsp.mkdir(target, { recursive: true });
    if (body.initGit !== false) await git(['init'], target, 15000).catch(() => null);
    return json(res, 201, { path: target, created: true });
  }

  if (pathname === '/api/projects/clone') {
    const repo = String(body.repo || '').trim();
    if (!repo) throw new Error('Git repository URL is required');
    const target = resolveNewProjectPath(body.path, body.name);
    const existing = await fsp.stat(target).catch(() => null);
    if (existing) throw new Error('That project folder already exists');
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await git(['clone', repo, target], ROOT, 120000);
    return json(res, 201, { path: target, cloned: true, repo });
  }

  if (pathname === '/api/projects/open') {
    const target = await assertDirectory(body.path);
    return json(res, 200, { path: target, opened: true, git: await gitInfo(target) });
  }

  if (pathname === '/api/projects/prepare') {
    return json(res, 200, await prepareProject(body.path));
  }

  return json(res, 404, { error: 'Unknown API route' });
}

async function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(APP_ROOT, `.${requested}`);
  const relative = path.relative(APP_ROOT, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  const stat = await fsp.stat(filePath).catch(() => null);
  if (!stat?.isFile()) {
    res.writeHead(404);
    return res.end('Not found');
  }

  res.writeHead(200, {
    'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url.pathname);
    return await serveStatic(req, res, decodeURIComponent(url.pathname));
  } catch (error) {
    console.error('[code-space]', error);
    return json(res, 400, { error: safeError(error) });
  }
});

server.listen(PORT, HOST, async () => {
  await fsp.mkdir(ROOT, { recursive: true }).catch(() => null);
  console.log(`Code Space: http://${HOST}:${PORT}`);
  console.log(`Workspaces: ${ROOT}`);
  console.log(`code-server: ${CODE_SERVER_URL}`);
  console.log(`code-server engine: ${process.platform === 'win32' ? 'Ubuntu WSL' : CODE_SERVER_COMMAND}`);
});
