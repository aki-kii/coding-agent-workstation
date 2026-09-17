import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vite-plus/test';

// Drives .claude/review/review.mjs in a throwaway git repository.

const SCRIPT = resolve(__dirname, '../../.claude/review/review.mjs');

interface Finding {
  readonly id: string;
  readonly status: string;
}

interface Result {
  readonly result: string;
  readonly round?: number;
  readonly reviewers?: { readonly reviewer: string; readonly files: string[] }[];
  readonly openFindings?: Finding[];
  readonly notes?: Finding[];
  readonly abort?: { readonly kind: string; readonly findings: string[] };
}

let repo: string;

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'review-pr-test-'));
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  write('README.md', 'base\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  git('switch', '-q', '-c', 'feature');
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

function git(...args: string[]): string {
  const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout;
}

function write(file: string, content: string): void {
  mkdirSync(dirname(join(repo, file)), { recursive: true });
  writeFileSync(join(repo, file), content);
}

function run(...args: string[]): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('node', [SCRIPT, ...args], { cwd: repo, encoding: 'utf8' });
  return { status: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
}

function ok(...args: string[]): Result {
  const r = run(...args);
  if (r.status !== 0) throw new Error(`${args.join(' ')} failed: ${r.stderr}`);
  return JSON.parse(r.stdout) as Result;
}

function roundFile(round: number, name: string): string {
  return join(repo, '.claude/review/.state/feature', `round-${round}`, name);
}

function review(round: number, reviewer: string, output: object): void {
  writeFileSync(roundFile(round, `${reviewer}.json`), JSON.stringify(output));
}

function respond(round: number, responses: object[]): void {
  writeFileSync(roundFile(round, 'responses.json'), JSON.stringify(responses));
}

function finding(overrides: object = {}): object {
  return {
    file: 'src/a.ts',
    line: 1,
    severity: 'medium',
    confidence: 'likely',
    category: 'correctness',
    summary: 'defect',
    failure_scenario: 'input -> wrong output',
    ...overrides,
  };
}

const evidence = [{ source: 'src/a.ts:1', detail: 'shows it' }];

function gate(command = 'gh pr create --fill', cwd = repo): number {
  const input = JSON.stringify({ cwd, tool_input: { command } });
  return spawnSync('node', [SCRIPT, 'gate'], { cwd, input }).status ?? 1;
}

describe('reviewer selection', () => {
  test('picks reviewers from paths and changed lines', () => {
    write('src/a.ts', "const role = new iam.Role(this, 'Role');\n");
    write('.claude/hooks/x.mjs', 'export {};\n');

    const plan = ok('start', '--base', 'main');

    const byName = Object.fromEntries(plan.reviewers!.map((r) => [r.reviewer, r.files]));
    expect(byName).toEqual({
      general: ['.claude/hooks/x.mjs', 'src/a.ts'],
      cdk: ['src/a.ts'],
      security: ['.claude/hooks/x.mjs', 'src/a.ts'],
      script: ['.claude/hooks/x.mjs'],
    });
  });

  test('add puts an extra reviewer into the round', () => {
    write('README.md', 'changed\n');
    ok('start', '--base', 'main');

    expect(run('add', 'security').status).toBe(1);
    expect(ok('add', 'security', '--reason', 'mentions a token').result).toBe('ADDED');
    review(1, 'general', { replies: [], findings: [] });
    expect(run('judge').status).toBe(1);
    review(1, 'security', { replies: [], findings: [] });
    expect(ok('judge').result).toBe('DONE');
  });
});

describe('stopping', () => {
  test('passes when no finding reaches the threshold, and the gate follows the tree', () => {
    write('README.md', 'changed\n');
    ok('start', '--base', 'main');
    expect(gate()).toBe(2);

    review(1, 'general', {
      replies: [],
      findings: [
        finding({ severity: 'high', confidence: 'possible' }),
        finding({ severity: 'low', confidence: 'confirmed' }),
      ],
    });
    const result = ok('judge');

    expect(result.result).toBe('DONE');
    expect(result.notes).toHaveLength(2);
    expect(gate()).toBe(0);
    write('README.md', 'changed again\n');
    expect(gate()).toBe(2);
  });

  test('closes a finding only when the reviewer withdraws it', () => {
    write('src/a.ts', 'a\n');
    ok('start', '--base', 'main');
    review(1, 'general', { replies: [], findings: [finding()] });
    review(1, 'cdk', { replies: [], findings: [] });
    expect(ok('judge').result).toBe('FIX');

    respond(1, [{ id: 'general-R1-1', action: 'fix' }]);
    write('src/a.ts', 'fixed\n');
    const round2 = ok('next');
    expect(round2.round).toBe(2);
    expect(round2.reviewers!.map((r) => r.reviewer).sort()).toEqual(['cdk', 'general']);

    review(2, 'general', {
      replies: [{ id: 'general-R1-1', verdict: 'maintain', comment: 'still' }],
      findings: [],
    });
    review(2, 'cdk', { replies: [], findings: [] });
    expect(ok('judge').result).toBe('FIX');

    respond(2, [{ id: 'general-R1-1', action: 'fix' }]);
    write('src/a.ts', 'fixed twice\n');
    ok('next');
    review(3, 'general', {
      replies: [{ id: 'general-R1-1', verdict: 'withdraw', comment: 'ok' }],
      findings: [],
    });
    review(3, 'cdk', { replies: [], findings: [] });
    expect(ok('judge').result).toBe('DONE');
  });

  test('aborts when the same file, reviewer and category come back in consecutive rounds', () => {
    write('README.md', 'changed\n');
    ok('start', '--base', 'main');
    review(1, 'general', { replies: [], findings: [finding({ file: 'README.md' })] });
    ok('judge');
    respond(1, [{ id: 'general-R1-1', action: 'fix' }]);
    write('README.md', 'fixed\n');
    ok('next');

    review(2, 'general', {
      replies: [{ id: 'general-R1-1', verdict: 'withdraw', comment: 'fixed' }],
      findings: [finding({ file: 'README.md', summary: 'another defect' })],
    });
    const result = ok('judge');

    expect(result.result).toBe('ABORT');
    expect(result.abort).toEqual({
      kind: 'repeated-finding',
      message: expect.any(String),
      findings: ['general-R2-1'],
    });
    expect(run('next').status).toBe(1);
    expect(run('start', '--base', 'main').status).toBe(1);
  });

  test('a different category in the same file does not abort', () => {
    write('README.md', 'changed\n');
    ok('start', '--base', 'main');
    review(1, 'general', { replies: [], findings: [finding({ file: 'README.md' })] });
    ok('judge');
    respond(1, [{ id: 'general-R1-1', action: 'fix' }]);
    write('README.md', 'fixed\n');
    ok('next');

    review(2, 'general', {
      replies: [{ id: 'general-R1-1', verdict: 'withdraw', comment: 'fixed' }],
      findings: [finding({ file: 'README.md', category: 'docs' })],
    });

    expect(ok('judge').result).toBe('FIX');
  });

  test('aborts when a fourth round would be needed', () => {
    write('README.md', 'changed\n');
    ok('start', '--base', 'main');
    const categories = ['correctness', 'docs', 'tests'];
    for (const [i, category] of categories.entries()) {
      const round = i + 1;
      const carried =
        i === 0 ? [] : [{ id: `general-R${i}-1`, verdict: 'withdraw', comment: 'fixed' }];
      review(round, 'general', {
        replies: carried,
        findings: [finding({ file: 'README.md', category })],
      });
      const result = ok('judge');
      if (round < 3) {
        expect(result.result).toBe('FIX');
        respond(round, [{ id: `general-R${round}-1`, action: 'fix' }]);
        write('README.md', `fix ${round}\n`);
        ok('next');
      } else {
        expect(result.result).toBe('ABORT');
        expect(result.abort!.kind).toBe('round-limit');
      }
    }
  });

  test('aborts when a maintained finding is disputed twice for the same reason', () => {
    write('README.md', 'changed\n');
    ok('start', '--base', 'main');
    review(1, 'general', { replies: [], findings: [finding({ file: 'README.md' })] });
    ok('judge');

    const dispute = {
      id: 'general-R1-1',
      action: 'dispute',
      reasonType: 'by-design',
      reason: 'intended',
      evidence,
    };
    respond(1, [dispute]);
    const round2 = ok('next');
    expect(round2.reviewers!.map((r) => r.reviewer)).toEqual(['general']);

    review(2, 'general', {
      replies: [{ id: 'general-R1-1', verdict: 'maintain', comment: 'evidence does not cover it' }],
      // A disputed finding does not count toward the repeated-finding rule.
      findings: [finding({ file: 'README.md', summary: 'related defect' })],
    });
    expect(ok('judge').result).toBe('FIX');

    respond(2, [dispute, { id: 'general-R2-1', action: 'fix' }]);
    const result = ok('next');

    expect(result.result).toBe('ABORT');
    expect(result.abort).toEqual({
      kind: 'disputed-twice',
      message: expect.any(String),
      findings: ['general-R1-1'],
    });
  });

  test('a dispute with a different reason type continues', () => {
    write('README.md', 'changed\n');
    ok('start', '--base', 'main');
    review(1, 'general', { replies: [], findings: [finding({ file: 'README.md' })] });
    ok('judge');
    respond(1, [
      {
        id: 'general-R1-1',
        action: 'dispute',
        reasonType: 'by-design',
        reason: 'intended',
        evidence,
      },
    ]);
    ok('next');
    review(2, 'general', {
      replies: [{ id: 'general-R1-1', verdict: 'maintain', comment: 'no' }],
      findings: [],
    });
    ok('judge');

    respond(2, [
      {
        id: 'general-R1-1',
        action: 'dispute',
        reasonType: 'false-positive',
        reason: 'never runs',
        evidence,
      },
    ]);

    expect(ok('next').result).toBe('REVIEW');
  });
});

describe('gate', () => {
  test('ignores commands that do not create a pull request, even outside a repository', () => {
    expect(gate('ls -la', tmpdir())).toBe(0);
    expect(gate('git commit -m "block gh pr create until review"')).toBe(0);
    expect(gate("grep -rn 'gh pr create' .claude")).toBe(0);
  });

  test('blocks pull request creation in command position', () => {
    expect(gate('git push && gh pr create --fill')).toBe(2);
    expect(gate('cd sub; gh pr create')).toBe(2);
  });

  test('fails closed when the state cannot be read', () => {
    write('README.md', 'changed\n');
    ok('start', '--base', 'main');
    writeFileSync(join(repo, '.claude/review/.state/feature/state.json'), '{');

    expect(gate()).toBe(2);
    expect(gate('gh pr create', tmpdir())).toBe(2);
  });
});

describe('diffs', () => {
  test('keeps non-ASCII paths and leaves the state directory out of the snapshot', () => {
    write('docs/日本語.md', 'x\n');

    const plan = ok('start', '--base', 'main');

    expect(plan.reviewers).toEqual([
      expect.objectContaining({ reviewer: 'general', files: ['docs/日本語.md'] }),
    ]);
  });

  test('a reviewer carried only for its finding still sees the fix to that file', () => {
    write('src/a.ts', "new iam.Role(this, 'Role');\n");
    ok('start', '--base', 'main');
    review(1, 'general', { replies: [], findings: [] });
    review(1, 'cdk', { replies: [], findings: [] });
    review(1, 'security', {
      replies: [],
      findings: [finding({ category: 'iam', severity: 'high', confidence: 'confirmed' })],
    });
    ok('judge');
    respond(1, [{ id: 'security-R1-1', action: 'fix' }]);
    // The fixed line no longer matches any security rule.
    write('src/a.ts', 'narrowed\n');

    const round2 = ok('next');

    expect(round2.reviewers).toContainEqual(
      expect.objectContaining({ reviewer: 'security', files: ['src/a.ts'] }),
    );
  });
});

describe('validation', () => {
  test('rejects reviewer output that skips a carried finding or uses an unknown category', () => {
    write('README.md', 'changed\n');
    ok('start', '--base', 'main');
    review(1, 'general', {
      replies: [],
      findings: [finding({ file: 'README.md', category: 'style' })],
    });
    expect(run('judge').stderr).toMatch(/category must be one of/);

    review(1, 'general', { replies: [], findings: [finding({ file: 'README.md' })] });
    ok('judge');
    respond(1, [{ id: 'general-R1-1', action: 'fix' }]);
    ok('next');
    review(2, 'general', { replies: [], findings: [] });
    expect(run('judge').stderr).toMatch(/no reply for carried finding general-R1-1/);
  });

  test('rejects a dispute without evidence and a missing response', () => {
    write('README.md', 'changed\n');
    ok('start', '--base', 'main');
    review(1, 'general', {
      replies: [],
      findings: [finding({ file: 'README.md' }), finding({ file: 'README.md', category: 'docs' })],
    });
    ok('judge');

    respond(1, [
      { id: 'general-R1-1', action: 'dispute', reasonType: 'by-design', reason: 'intended' },
    ]);
    const r = run('next');

    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/general-R1-1: a dispute needs evidence/);
    expect(r.stderr).toMatch(/no response for open finding general-R1-2/);
  });
});
