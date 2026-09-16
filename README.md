# coding-agent-workstation

AWS CDK constructs that provision a **cloud-hosted workstation for a coding agent** on Amazon Bedrock AgentCore — a single long-lived box you wake up when you want to work, that puts itself back to sleep when you stop.

> **Status: design phase.** This repository currently contains only the build scaffolding. No construct has been implemented yet; `src/index.ts` holds a placeholder that exists to keep the build green.

## Background

This library generalizes the infrastructure behind [aki-kii/agentcore-claude-code](https://github.com/aki-kii/agentcore-claude-code), which runs Claude Code inside an AgentCore Runtime backed by **compute type `Instances`** (not microVM). The agent runs on an EC2 managed instance in your own account, a persistent EBS volume keeps the home directory and repository checkouts across restarts, and the capacity provider's idle timeout shuts the instance down when nobody is using it.

The goal is **not** to package that stack verbatim. The reference implementation carries account-specific values, a CI role that bootstraps itself, and a container contract entangled with one particular set of secrets. Deciding what belongs inside the construct and what the caller supplies is the work this repository is here to do.

## Development

This project is managed by [projen](https://github.com/projen/projen). Project configuration lives in `.projenrc.ts`; generated files (`package.json`, `tsconfig.json`, `.github/workflows/`, and so on) are overwritten on the next synth, so edit `.projenrc.ts` instead.

```sh
pnpm install       # install dependencies
npx projen         # synthesize generated files from .projenrc.ts
npx projen build   # compile (jsii) -> docgen -> test -> eslint -> package
npx projen test    # tests and lint only
```

### Requirements

- Node.js 24
- pnpm
- TypeScript is pinned to the 6.x line. jsii 6 requires `typescript ~6.0`, and typescript-eslint does not support TS 7 yet — leaving projen's default in place breaks both synth and lint. See `typescriptVersion` in `.projenrc.ts`.

## License

Apache-2.0
