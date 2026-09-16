# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

An AWS CDK construct library that provisions a cloud-hosted coding agent workstation on Amazon Bedrock AgentCore. See `README.md` for the background and the relationship to [aki-kii/agentcore-claude-code](https://github.com/aki-kii/agentcore-claude-code), the stack this library generalizes.

The library is in the design phase — no construct has been implemented yet.

## Language

**Everything committed to this repository is written in English**: code, comments, documentation, commit messages, issue and pull request titles and bodies.

The one exception is `docs/ai-output/` (see below), which is not committed and may be in Japanese.

## Research notes and drafts

Put investigation notes, research summaries, and scratch drafts under **`docs/ai-output/`**. That directory is gitignored, so anything there stays local. Japanese is fine there — it is working material, not a deliverable.

Do not commit research output to `docs/` or anywhere else in the tree. If a finding matters to someone reading the repository, distill it into `README.md`, a code comment, or an issue, in English.

## Project configuration

This project is managed by [projen](https://github.com/projen/projen). **Edit `.projenrc.ts`, never the generated files.** `package.json`, `tsconfig.json`, `.eslintrc.json`, `.github/workflows/`, `.gitignore`, and others are regenerated on every synth and your edits will be lost.

```sh
pnpm install       # install dependencies
npx projen         # synthesize generated files from .projenrc.ts
npx projen build   # compile (jsii) -> docgen -> test -> eslint -> package
npx projen test    # tests and lint only
```

Run `npx projen build` before committing. It is the same pipeline CI runs.

## Version constraints

Two pins in `.projenrc.ts` are deliberate and load-bearing. Both carry comments explaining why; read them before changing either.

- **`typescriptVersion: '~6.0.0'`** — jsii 6 requires `typescript ~6.0`, and typescript-eslint does not support TS 7. Letting projen resolve `latest` breaks both synth and lint.
- **`cdkVersion: '2.268.0'`** — `CfnCapacityProvider`, the L1 this library is built around, first shipped in aws-cdk-lib 2.268.0.

## jsii constraints

This library is compiled with jsii so it can be published to multiple languages. That rules out several TypeScript features:

- No literal types, union types, or tuples — use enums and plain arrays
- No mapped types with union keys — use struct interfaces or arrays
- No type derivation (`typeof x`, conditional types)
- CommonJS output only — no ESM, no `.ts` extensions in import paths, no `import.meta`
- Props interfaces (structs) must have all members `readonly`, and cannot hold methods or function-typed properties

When in doubt, check whether an equivalent shape exists in `aws-cdk-lib` itself.
