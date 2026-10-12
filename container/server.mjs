import { execFile, spawn } from 'node:child_process';
import { chmod, copyFile, mkdir, realpath, stat, symlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { WebSocketServer } from 'ws';

// The signing packages are CommonJS without named exports that ESM can see.
const require = createRequire(import.meta.url);
const { Sha256 } = require('@aws-crypto/sha256-js');
const { defaultProvider } = require('@aws-sdk/credential-provider-node');
const { SignatureV4 } = require('@smithy/signature-v4');

const home = process.env.HOME;
const idlePaddingSeconds = Number(process.env.WORKSTATION_IDLE_PADDING_SECONDS ?? 0);
const startupScript = '/opt/workstation/startup.sh';
// A native install in its own HOME: .local/bin/claude links to .local/share/claude/versions/<v>.
const claudeSeed = '/opt/claude-code/.local/bin/claude';
const claudeHome = path.join(home, '.local', 'bin', 'claude');
const claudeVersions = path.join(home, '.local', 'share', 'claude', 'versions');
// Where the default Remote Control server works.
const workspace = path.join(home, 'workspace');
const pollIntervalMs = 10_000;
const pollTimeoutMs = 5_000;
// Well under the 64 KB limit on a WebSocket frame.
const maxFrameBytes = 16 * 1024;

// The longest a presigned terminal URL may live.
const terminalUrlSeconds = 300;
const sessionHeader = 'x-amzn-bedrock-agentcore-runtime-session-id';

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
function run(label, command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
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
  // Lay the seed out the way the native installer does, so that Claude Code can update itself
  // in HOME.
  if (!(await exists(claudeHome))) {
    const seedVersion = await realpath(claudeSeed);
    const version = path.join(claudeVersions, path.basename(seedVersion));
    await mkdir(claudeVersions, { recursive: true });
    await copyFile(seedVersion, version);
    await chmod(version, 0o755);
    await symlink(version, claudeHome);
    log(`seeded Claude Code ${path.basename(seedVersion)} into ${claudeHome}`);
  }

  if (await exists(startupScript)) {
    log('running the startup script');
    await run('startup', startupScript, [], home);
  } else {
    // Claude Code never saves its trust answer for HOME itself, so Remote Control runs in a
    // directory under it. Trust it once from the terminal.
    await mkdir(workspace, { recursive: true });
    log(`no startup script, starting Remote Control in ${workspace}`);
    await run('remote-control', 'claude', ['remote-control'], workspace);
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
    void (async () => {
      const body = await readBody(req);
      await startupDone;
      lastBusy = Date.now();
      const reply = { status: 'ready', startedAt: new Date(startedAt).toISOString(), home };
      const sessionId = req.headers[sessionHeader];
      // The container cannot learn its own runtime ARN, so the caller passes it in the payload.
      const runtimeArn = parseRuntimeArn(body);
      if (typeof sessionId === 'string' && runtimeArn) {
        try {
          reply.terminalUrl = await presignTerminalUrl(runtimeArn, sessionId);
        } catch (error) {
          log(`presigning the terminal URL failed: ${error.message}`);
        }
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(reply));
    })();
    return;
  }

  res.writeHead(404).end();
});

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', () => resolve(''));
  });
}

function parseRuntimeArn(body) {
  try {
    const { runtimeArn } = JSON.parse(body);
    return typeof runtimeArn === 'string' && runtimeArn.startsWith('arn:') ? runtimeArn : undefined;
  } catch {
    return undefined;
  }
}

// A wss:// URL for /ws on this session, signed with the execution role the same way as the
// AgentCore SDK's generate_presigned_url.
async function presignTerminalUrl(runtimeArn, sessionId) {
  const region = runtimeArn.split(':')[3];
  const hostname = `bedrock-agentcore.${region}.amazonaws.com`;
  const signer = new SignatureV4({
    service: 'bedrock-agentcore',
    region,
    credentials: defaultProvider(),
    sha256: Sha256,
  });
  const signed = await signer.presign(
    {
      method: 'GET',
      protocol: 'https:',
      hostname,
      path: `/runtimes/${encodeURIComponent(runtimeArn)}/ws`,
      query: { 'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': sessionId },
      headers: { host: hostname },
    },
    { expiresIn: terminalUrlSeconds },
  );
  return `wss://${hostname}${signed.path}?${new URLSearchParams(signed.query)}`;
}

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
        if (ws.readyState === ws.OPEN)
          ws.send(chunk.subarray(i, i + maxFrameBytes), { binary: true });
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
