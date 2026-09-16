// Claude Code hook: verify edited files when the agent stops.
//   record  (PostToolUse)      remember which files were edited
//   reset   (UserPromptSubmit) start a new retry budget
//   stop    (Stop)             format, lint and test; send failures back to the agent
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

const MAX_RETRIES = 3;
const OUTPUT_LIMIT = 8000;

const mode = process.argv[2];
const input = JSON.parse(readFileSync(0, 'utf8'));
const root = gitRoot(input.cwd ?? process.cwd());
if (!root) process.exit(0);

const stateDir = join(tmpdir(), 'claude-verify');
mkdirSync(stateDir, { recursive: true });
const editedPath = join(stateDir, `${input.session_id}.edited`);
const statePath = join(stateDir, `${input.session_id}.json`);

if (mode === 'record') record();
else if (mode === 'reset') saveState({ attempts: 0, lastSignature: null });
else if (mode === 'stop') stop();

function record() {
  const file = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (!file) return;
  const rel = relative(root, resolve(input.cwd ?? root, file));
  if (rel.startsWith('..') || isAbsolute(rel)) return;
  // Append-only: parallel tool calls must not overwrite each other.
  appendFileSync(editedPath, `${rel}\n`);
}

function stop() {
  const edited = readEdited();
  if (edited.length === 0) return;

  const existing = edited.filter((f) => existsSync(join(root, f)));
  const failures = [...runFormat(existing), ...runLint(), ...runTests(edited, existing)];

  if (failures.length === 0) {
    writeFileSync(editedPath, '');
    saveState({ attempts: 0, lastSignature: null });
    return;
  }

  const state = loadState();
  const attempts = state.attempts + 1;
  const signature = [...new Set(failures.flatMap((f) => f.signatures))].sort().join('\n');
  const report = failures.map((f) => `## ${f.step}\n${truncate(clean(f.output))}`).join('\n\n');

  const repeated = signature === state.lastSignature;
  if (attempts > MAX_RETRIES || repeated) {
    // Keep the edited list so the next turn verifies again.
    saveState({ attempts: 0, lastSignature: null });
    const why = repeated
      ? 'the same errors occurred twice in a row'
      : `verification still fails after ${MAX_RETRIES} fix attempts`;
    emit({
      continue: false,
      stopReason: `verify aborted: ${why}.\n${signature}`,
    });
    return;
  }

  saveState({ attempts, lastSignature: signature });
  emit({
    decision: 'block',
    reason: [
      `Verification failed (attempt ${attempts}/${MAX_RETRIES}). Fix the errors below, then finish again.`,
      'Do not update snapshots to make a test pass; if a snapshot diff is intended, stop and report it.',
      report,
    ].join('\n\n'),
  });
}

function runFormat(files) {
  if (files.length === 0) return [];
  const r = vp(['fmt', '--no-error-on-unmatched-pattern', ...files]);
  return r.status === 0
    ? []
    : [{ step: 'fmt', output: r.output, signatures: [`fmt:0:exit-${r.status}`] }];
}

function runLint() {
  // Whole project: a change can break types in files that were not edited.
  const r = vp(['lint', '--quiet', '--format=agent']);
  if (r.status === 0) return [];
  // e.g. "src/index.ts:4:9: error typescript(TS2322): ..."
  const signatures = [...r.output.matchAll(/^(.+?):(\d+):\d+: error (\S+?):/gm)].map(
    ([, file, line, rule]) => `${file}:${line}:${rule}`,
  );
  if (signatures.length === 0) signatures.push(`lint:0:exit-${r.status}`);
  return [{ step: 'lint', output: r.output, signatures }];
}

function runTests(edited, existing) {
  const inTree = (f) => /^(src|test)\//.test(f);
  const scoped = edited.every((f) => f.endsWith('.md') || (inTree(f) && existing.includes(f)));
  const targets = existing.filter(inTree);

  if (scoped && targets.length === 0) return [];
  let result = scoped ? vitest(['related', ...targets, '--passWithNoTests']) : vitest([]);
  // Files reached only through a string path (e.g. a Lambda entry) have no related tests.
  if (scoped && result.total === 0 && targets.some((f) => f.startsWith('src/'))) {
    result = vitest([]);
  }
  return result.failure ? [result.failure] : [];
}

function vitest(args) {
  const jsonPath = join(stateDir, `${input.session_id}.vitest.json`);
  writeFileSync(jsonPath, '');
  const r = vp([
    'test',
    ...(args.length ? args : ['run']),
    ...(args.length ? ['--run'] : []),
    '--reporter=agent',
    '--reporter=json',
    `--outputFile.json=${jsonPath}`,
  ]);
  let json;
  try {
    json = JSON.parse(readFileSync(jsonPath, 'utf8'));
  } catch {
    json = null;
  }
  const total = json?.numTotalTests ?? 0;
  if (r.status === 0) return { total, failure: null };

  const signatures = [];
  for (const suite of json?.testResults ?? []) {
    const file = relative(root, suite.name);
    const failed = suite.assertionResults.filter((a) => a.status === 'failed');
    for (const a of failed) {
      const at = a.failureMessages.join('\n').match(new RegExp(`${escape(suite.name)}:(\\d+):`));
      signatures.push(`${file}:${at?.[1] ?? 0}:test(${a.fullName})`);
    }
    if (failed.length === 0 && suite.status === 'failed') signatures.push(`${file}:0:suite`);
  }
  if (signatures.length === 0) signatures.push(`test:0:exit-${r.status}`);
  return { total, failure: { step: 'test', output: r.output, signatures } };
}

function vp(args) {
  const r = spawnSync('pnpm', ['exec', 'vp', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  return { status: r.status ?? 1, output: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ?? ''}` };
}

function gitRoot(cwd) {
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function readEdited() {
  if (!existsSync(editedPath)) return [];
  return [...new Set(readFileSync(editedPath, 'utf8').split('\n').filter(Boolean))];
}

function loadState() {
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    return { attempts: 0, lastSignature: null };
  }
}

function saveState(state) {
  writeFileSync(statePath, JSON.stringify(state));
}

// Drop vp/vitest chatter that carries no diagnostics.
function clean(text) {
  return stripVTControlCharacters(text)
    .split('\n')
    .filter((line) => !/^\s*(note: You are running|RUN\s+v|JSON report written to)/.test(line))
    .join('\n')
    .trim();
}

function truncate(text) {
  return text.length > OUTPUT_LIMIT ? `${text.slice(0, OUTPUT_LIMIT)}\n... (truncated)` : text;
}

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function emit(output) {
  process.stdout.write(JSON.stringify(output));
}
