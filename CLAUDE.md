# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

An AWS CDK construct library that provisions a cloud-hosted coding agent workstation on Amazon Bedrock AgentCore. See `README.md` for the background.

The library is in the design phase — no construct has been implemented yet.

## Language

**Everything committed to this repository is written in English**: code, comments, documentation, commit messages, issue and pull request titles and bodies.

The one exception is `docs/ai-output/` (see below), which is not committed and may be in Japanese.

## Research notes and drafts

Put investigation notes, research summaries, and scratch drafts under **`docs/ai-output/`**. That directory is gitignored, so anything there stays local. Japanese is fine there — it is working material, not a deliverable.

Do not commit research output to `docs/` or anywhere else in the tree. If a finding matters to someone reading the repository, distill it into `README.md`, a code comment, or an issue, in English.

## Project configuration

This project is managed by [projen](https://github.com/projen/projen). **Edit `.projenrc.ts`, never the generated files.** `package.json`, `tsconfig.json`, `.github/workflows/`, `.gitignore`, `mise.toml`, and others are regenerated on every synth and your edits will be lost. `.gitattributes` lists every generated file as `linguist-generated`.

`vite.config.ts` is not generated; edit it directly. It configures Vite+ (`vp`), which runs formatting (Oxfmt), linting (Oxlint + oxlint-plugin-awscdk), type checking (TypeScript 7 via tsgolint) and tests (Vitest). It reads `.gitattributes` to keep formatting and linting off projen's generated files.

Node.js and pnpm come from mise (`mise.toml`), not from `vp env`. Their versions are set in `.projenrc.ts`, so the workflows use the same ones.

```sh
mise install              # install Node.js and pnpm
pnpm install              # install dependencies
npx projen                # synthesize generated files from .projenrc.ts
npx projen build          # compile (jsii) -> docgen -> test -> package
npx projen test           # vp test run, then vp check
npx projen integ          # deploy test/integ.*.ts to AWS
npx projen integ:destroy  # tear down what integ left behind
```

Run `npx projen build` before committing. It is the same pipeline CI runs.

## Verification

Cheapest first. Catch what you can before reaching a slower layer.

1. **`pnpm exec vp check`** (no AWS) — format, lint, type check. The oxlint-plugin-awscdk rules run in their `strict` form on `src/` and `test/`; `prevent-construct-id-collision` and `no-variable-construct-id` catch logical-ID breakage that compiles and synthesizes fine but replaces resources on deploy.
2. **`pnpm exec vp test run`** (no AWS) — unit tests. Use `Template.fromStack(...).toJSON()` with `toMatchSnapshot()` as a net for changes that reach further than intended. Beyond that, write assertions only for what types, lint and synth cannot catch (for example string paths passed to `addPropertyOverride`); do not re-assert configuration values the implementation already states.
3. **`npx projen integ`** (AWS, only when asked) — deploys `test/integ.*.ts` for real in ap-northeast-1 with `--no-clean`. Run `npx projen integ:destroy` when done.

**Never update snapshots on your own** (`vp test -u`, integ-runner `--update-on-failed`). Report the diff instead; an agent that can update snapshots has switched the net off.

Integration test stacks must not set physical names, and must set `RemovalPolicy.DESTROY` explicitly.

## Version constraints

Two pins in `.projenrc.ts` are deliberate and load-bearing. Both carry comments explaining why; read them before changing either. The weekly upgrade workflow excludes both, along with the packages that must move with them.

- **`typescriptVersion: '~6.0.0'`** — jsii 6 requires `typescript ~6.0`. Letting projen resolve `latest` breaks the compile. `jsii` and `jsii-rosetta` are held on the same line.
- **`cdkVersion: '2.268.0'`** — `CfnCapacityProvider`, the L1 this library is built around, first shipped in aws-cdk-lib 2.268.0. `@aws-cdk/integ-tests-alpha` is released in lockstep with aws-cdk-lib and must stay on `2.268.0-alpha.0`.

## jsii constraints

This library is compiled with jsii so it can be published to multiple languages. That rules out several TypeScript features:

- No literal types, union types, or tuples — use enums and plain arrays
- No mapped types with union keys — use struct interfaces or arrays
- No type derivation (`typeof x`, conditional types)
- CommonJS output only — no ESM, no `.ts` extensions in import paths, no `import.meta`
- Props interfaces (structs) must have all members `readonly`, and cannot hold methods or function-typed properties

When in doubt, check whether an equivalent shape exists in `aws-cdk-lib` itself.
