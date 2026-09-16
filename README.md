# coding-agent-workstation

AWS CDK constructs that provision a **cloud-hosted workstation for a coding agent** on Amazon Bedrock AgentCore — a single long-lived box you wake up when you want to work, that puts itself back to sleep when you stop.

> **Status: design phase.** This repository currently contains only the build scaffolding. No construct has been implemented yet; `src/index.ts` holds a placeholder that exists to keep the build green.

## Background

AgentCore Runtime can be backed by **compute type `Instances`** instead of microVM, which puts the agent on an EC2 managed instance in your own account. That is what makes this shape possible: one workstation that survives restarts, with a persistent EBS volume holding the home directory and repository checkouts, shut down by the capacity provider's idle timeout once nobody is using it.

Assembling that by hand means getting several non-obvious things right at the same time:

- A capacity provider and a runtime that agree on the volume name, or the workspace never mounts
- `networkConfiguration` left unset on the runtime when a capacity provider supplies the network
- An instance idle timeout longer than the runtime session timeout, or instances die while sessions are still live
- An execution role trust policy that AgentCore accepts, which is not the same on the capacity side as on the runtime side
- A capacity provider that is effectively immutable after creation — changing it replaces it, and the replacement takes the persistent volume with it

Those are the problems this library is meant to absorb.

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
