import { awscdk, TomlFile } from 'projen';
import { NodePackageManager, UpgradeDependenciesSchedule } from 'projen/lib/javascript';

// Shared by CI (workflowNodeVersion) and local development (mise.toml). vite-plus needs
// Node.js >= 24.11 on the 24 line.
const nodeVersion = '24';

const project = new awscdk.AwsCdkConstructLibrary({
  name: 'coding-agent-workstation',
  description:
    'AWS CDK constructs for provisioning a cloud-hosted coding agent workstation on Amazon Bedrock AgentCore',
  author: 'aki-kii',
  authorAddress: 'impeeeeedance@gmail.com',
  repositoryUrl: 'https://github.com/aki-kii/coding-agent-workstation',
  license: 'Apache-2.0',
  keywords: ['aws', 'cdk', 'aws-cdk', 'bedrock', 'agentcore', 'claude-code', 'coding-agent'],

  // CfnCapacityProvider — the L1 this library is built around — first shipped in
  // aws-cdk-lib 2.268.0, so that is the floor for the peer dependency.
  cdkVersion: '2.268.0',
  defaultReleaseBranch: 'main',
  jsiiVersion: '~6.0.0',
  // jsii 6 requires typescript ~6.0. projen's default (latest) pulls in TS 7, which
  // jsii cannot compile with, so pin it explicitly.
  typescriptVersion: '~6.0.0',
  projenrcTs: true,
  packageManager: NodePackageManager.PNPM,
  workflowNodeVersion: nodeVersion,

  // Formatting, linting, type checking and tests all run through Vite+ (`vp`), configured in
  // vite.config.ts. projen's ESLint, Prettier and Jest components are off so that each job has
  // exactly one tool.
  eslint: false,
  prettier: false,
  jest: false,
  devDeps: [
    'vite-plus',
    'oxlint-plugin-awscdk',
    // Integration tests: test/integ.*.ts, deployed for real by `projen integ`.
    '@aws-cdk/integ-runner',
    // Alpha modules are released in lockstep with aws-cdk-lib, so this tracks cdkVersion exactly.
    '@aws-cdk/integ-tests-alpha@2.268.0-alpha.0',
    'aws-cdk',
    'tsx',
  ],

  depsUpgradeOptions: {
    workflowOptions: {
      schedule: UpgradeDependenciesSchedule.WEEKLY,
    },
    // These move by hand only. aws-cdk-lib is the peer floor (see cdkVersion) and
    // integ-tests-alpha has to stay on the same release; typescript, jsii and jsii-rosetta are
    // held on the 6.x line (see typescriptVersion).
    exclude: ['aws-cdk-lib', '@aws-cdk/integ-tests-alpha', 'typescript', 'jsii', 'jsii-rosetta'],
  },

  gitignore: [
    '*.js',
    '*.d.ts',
    'cdk.out/',
    '.DS_Store',
    '.idea/',
    // Scratch space for agent-generated research and drafts. Local only.
    'docs/ai-output/',
    // Left behind by integ-runner --inspect-failures.
    'cdk-integ.out.*',
  ],
  githubOptions: {
    pullRequestLintOptions: {
      semanticTitleOptions: {
        types: ['feat', 'fix', 'chore', 'docs', 'test', 'refactor', 'ci'],
      },
    },
  },

  // Enable once the distribution story (npm only vs. multi-language via jsii) is settled.
  release: false,
});

project.testTask.reset('vp test run');
project.testTask.exec('vp check');

project.addTask('integ', {
  description: 'Deploy test/integ.*.ts to AWS and compare against the committed snapshots',
  exec: 'integ-runner --no-clean --parallel-regions ap-northeast-1 --language typescript --app "tsx {filePath}"',
});
project.addTask('integ:destroy', {
  description: 'Destroy every stack left behind by `integ`, which runs with --no-clean',
  exec: 'for d in test/integ.*.snapshot; do [ -d "$d" ] || continue; cdk destroy --app "$d" --all --force; done',
});

// Local runtimes come from mise, not from `vp env`. pnpm follows the version projen already writes
// to packageManager and the workflows, so all three stay in step.
new TomlFile(project, 'mise.toml', {
  obj: {
    tools: {
      node: nodeVersion,
      pnpm: project.package.pnpmVersion,
    },
  },
});

project.addPackageIgnore('/vite.config.ts');
project.addPackageIgnore('/mise.toml');

project.synth();
