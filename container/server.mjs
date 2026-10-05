import { execFile, spawn } from 'node:child_process';
import { chmod, copyFile, mkdir, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { WebSocketServer } from 'ws';

const home = process.env.HOME;
const idlePaddingSeconds = Number(process.env.WORKSTATION_IDLE_PADDING_SECONDS ?? 0);
const startupScript = '/opt/workstation/startup.sh';
const claudeSeed = '/opt/claude-code/bin/claude';
const claudeHome = path.join(home, '.local', 'bin', 'claude');
const pollIntervalMs = 10_000;
const pollTimeoutMs = 5_000;
// Well under the 64 KB limit on a WebSocket frame.
const maxFrameBytes = 16 * 1024;

const startedAt = Date.now();
// The container reports itself busy until idlePaddingSeconds after this time.
let lastBusy = startedAt;
let reportedStatus = 'Healthy';
const terminals = new Set();
const children = new Set();

// Children get the copy of Claude Code in HOME first, which can update itself.
process.env.PATH = `${path.dirname(claudeHome)}:${process.env.PATH}`;

function log(message) {
  console.log(`${new Date().toISOString()} ${message}`);
}

function status() {
  if (terminals.size > 0) lastBusy = Date.now();
  const next = Date.now() - lastBusy < idlePaddingSeconds * 1000 ? 'HealthyBusy' : 'Healthy';
  if (next !== reportedStatus) {
    reportedStatus = next;
    log(`status ${next}`);
  }
  return next;
}

// Run a command as the image user and log its output line by line.
function run(label, command, args) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  children.add(child);
  for (const stream of [child.stdout, child.stderr]) {
    let pending = '';
    stream.on('data', (chunk) => {
      const lines = (pending + chunk).split('\n');
      pending = lines.pop();
      for (const line of lines) log(`[${label}] ${line}`);
    });
    stream.on('end', () => {
      if (pending) log(`[${label}] ${pending}`);
    });
  }
  return new Promise((resolve) => {
    child.on('error', (error) => {
      log(`[${label}] failed to start: ${error.message}`);
      children.delete(child);
      resolve();
    });
    child.on('exit', (code, signal) => {
      log(`[${label}] exited with ${signal ?? code}`);
      children.delete(child);
      resolve();
    });
    // Spawned is as far as the default Remote Control server needs to get.
    child.on('spawn', () => {
      if (label === 'remote-control') resolve();
    });
  });
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function startup() {
  await mkdir(path.dirname(claudeHome), { recursive: true });
  await mkdir(path.join(home, '.config'), { recursive: true });
  if (!(await exists(claudeHome))) {
    await copyFile(await realpath(claudeSeed), claudeHome);
    await chmod(claudeHome, 0o755);
    log(`seeded Claude Code into ${claudeHome}`);
  }

  if (await exists(startupScript)) {
    log('running the startup script');
    await run('startup', startupScript, []);
  } else {
    log('no startup script, starting Remote Control');
    await run('remote-control', 'claude', ['remote-control']);
  }
}

const startupDone = startup().catch((error) => {
  log(`startup failed: ${error.stack ?? error}`);
});

// Claude Code's agent list: any entry that is working keeps the workstation busy.
function pollAgents() {
  execFile('claude', ['agents', '--json'], { timeout: pollTimeoutMs }, (error, stdout) => {
    if (error) {
      log(`agent poll failed: ${error.message.split('\n')[0]}`);
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      log('agent poll failed: output is not JSON');
      return;
    }
    const agents = Array.isArray(parsed) ? parsed : (parsed?.agents ?? []);
    if (agents.some((agent) => agent?.status === 'busy' || agent?.state === 'working')) {
      lastBusy = Date.now();
    }
  });
}

const server = createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url ?? '/', 'http://localhost');
  } catch {
    res.writeHead(400).end();
    return;
  }

  if (url.pathname === '/ping') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({ status: status(), time_of_last_update: Math.floor(Date.now() / 1000) }),
    );
    return;
  }

  if (url.pathname === '/invocations') {
    lastBusy = Date.now();
    // Drain the body; nothing in it is used.
    req.resume();
    startupDone.then(() => {
      lastBusy = Date.now();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ready', startedAt: new Date(startedAt).toISOString(), home }));
    });
    return;
  }

  res.writeHead(404).end();
});

// The terminal does not support window resizing: `script` has no way to receive a new size.
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/ws') {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const shell = spawn('script', ['-qfc', 'bash -l', '/dev/null'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: home,
    });
    terminals.add(ws);
    lastBusy = Date.now();
    log('terminal opened');

    const forward = (chunk) => {
      for (let i = 0; i < chunk.length; i += maxFrameBytes) {
        if (ws.readyState === ws.OPEN) ws.send(chunk.subarray(i, i + maxFrameBytes), { binary: true });
      }
    };
    shell.stdout.on('data', forward);
    shell.stderr.on('data', forward);
    shell.stdin.on('error', () => {});
    ws.on('message', (data) => shell.stdin.write(data));
    shell.on('exit', () => ws.close());
    shell.on('error', (error) => {
      log(`terminal failed to start: ${error.message}`);
      ws.close();
    });
    ws.on('close', () => {
      terminals.delete(ws);
      lastBusy = Date.now();
      shell.kill('SIGHUP');
      log('terminal closed');
    });
    ws.on('error', () => ws.terminate());
  });
});

function shutdown(signal) {
  log(`received ${signal}`);
  for (const child of children) child.kill('SIGTERM');
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Listen first: a startup that fails or hangs must not take /ping down with it.
server.listen(8080, '0.0.0.0', () => log('listening on 8080'));
setInterval(pollAgents, pollIntervalMs).unref();
setInterval(status, 1_000).unref();
