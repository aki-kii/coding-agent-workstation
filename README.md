# coding-agent-workstation

AWS CDK constructs that provision a **cloud-hosted workstation for a coding agent** on Amazon Bedrock AgentCore — a single long-lived box you wake up when you want to work, that puts itself back to sleep when you stop.

> **Status: early.** `Workstation` and `WorkstationCapacityProvider` are implemented and build. The bundled image has not been deployed and tried end to end yet.

## Background

AgentCore Runtime can be backed by **compute type `Instances`** instead of microVM, which puts the agent on an EC2 managed instance in your own account. That is what makes this shape possible: one workstation that survives restarts, with a persistent EBS volume holding the home directory and repository checkouts, shut down by the capacity provider's idle timeout once nobody is using it.

Assembling that by hand means getting several non-obvious things right at the same time:

- A capacity provider and a runtime that agree on the volume name, or the workspace never mounts
- `networkConfiguration` left unset on the runtime when a capacity provider supplies the network
- An instance idle timeout longer than the runtime session timeout, or instances die while sessions are still live
- An execution role trust policy that AgentCore accepts, which is not the same on the capacity side as on the runtime side
- A capacity provider that is effectively immutable after creation — changing it replaces it, and the replacement takes the persistent volume with it

Those are the problems this library is meant to absorb.

## Usage

```ts
import { Workstation } from 'coding-agent-workstation';

const workstation = new Workstation(this, 'Workstation', {
  vpc,
  // Optional: runs at every session start, as the image user.
  startupScript: path.join(__dirname, 'startup.sh'),
});

// Grants bedrock-agentcore:InvokeAgentRuntime, and InvokeAgentRuntimeWithWebSocketStream for the terminal.
workstation.grantInvoke(callerRole);
```

### Starting a session

Call `InvokeAgentRuntime` on `workstation.runtimeArn` with a `runtimeSessionId` of your choosing. The first call with a new ID starts an EC2 instance with a fresh workspace volume; later calls with the same ID resume the same workspace. The container answers `/invocations` with `{"status":"ready", ...}` once startup, including the startup script, has finished.

The workstation reports itself busy while Claude Code is working (read from `claude agents --json`) and while a terminal is connected, and for the configured `idleTimeout` after both stop.

### Startup script

`startupScript` is a path to a local file. It is built into the image and runs at every session start as the image user, with `HOME` on the workspace volume; `/invocations` answers when it exits. Changing it rebuilds the image and updates the runtime in place, leaving the capacity provider and its volumes alone.

Without a script the container starts Claude Code in Remote Control server mode (`claude remote-control`) in the background, in `~/workspace`, for use from claude.ai/code or the mobile app. That needs a claude.ai sign-in and a one-time confirmation, both done once in the terminal: run `claude auth login`, then `cd ~/workspace && claude remote-control` and answer its questions about Remote Control and trusting the directory. Claude Code never saves trust for `HOME` itself, which is why the server runs in a directory under it.

### Terminal

The image serves its own terminal on `/ws`: an interactive login shell on a PTY, reached through `InvokeAgentRuntimeWithWebSocketStream` with the same session ID. AgentCore's built-in interactive shell (`InvokeAgentRuntimeCommandShell`) is not supported on capacity-provider runtimes (confirmed in the sandbox on 2026-10-05). Window resizing is not supported.

TODO: a client for `/ws` is not included yet.

## Development

This project is managed by [projen](https://github.com/projen/projen). Project configuration lives in `.projenrc.ts`; generated files (`package.json`, `tsconfig.json`, `.github/workflows/`, and so on) are overwritten on the next synth, so edit `.projenrc.ts` instead.

```sh
mise install              # install Node.js and pnpm
pnpm install              # install dependencies
npx projen                # synthesize generated files from .projenrc.ts
npx projen build          # compile (jsii) -> docgen -> test -> package
npx projen test           # vp test run, then vp check (format, lint, type check)
npx projen integ          # deploy test/integ.*.ts to AWS (needs credentials)
npx projen integ:destroy  # tear down what integ left behind
```

Formatting, linting, type checking and tests run through [Vite+](https://viteplus.dev/) (`vp`): Oxfmt, Oxlint with [oxlint-plugin-awscdk](https://awscdk-lint.dev/), and Vitest, all configured in `vite.config.ts`. projen's ESLint, Prettier and Jest components are turned off.

### Requirements

- [mise](https://mise.jdx.dev/) — `mise install` provides Node.js 24 and pnpm at the versions in `mise.toml`. That file is generated from `.projenrc.ts`, and CI uses the same versions. Use mise for these rather than `vp env`.
- TypeScript is pinned to the 6.x line because jsii 6 requires `typescript ~6.0`; leaving projen's default in place breaks the compile. `vp check` type checks with TypeScript 7 (tsgolint) independently of that pin. See `typescriptVersion` in `.projenrc.ts`.

## License

Apache-2.0
