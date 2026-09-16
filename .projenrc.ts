import { awscdk, TomlFile } from 'projen';
import { NodePackageManager, UpgradeDependenciesSchedule } from 'projen/lib/javascript';

// vite-plus requires Node.js >= 24.11.
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

  // First release with CfnCapacityProvider.
  cdkVersion: '2.268.0',
  defaultReleaseBranch: 'main',
  jsiiVersion: '~6.0.0',
  // jsii 6 cannot compile with TypeScript 7, projen's default.
  typescriptVersion: '~6.0.0',
  projenrcTs: true,
  packageManager: NodePackageManager.PNPM,
  pnpmVersion: '12.4.2',
  workflowNodeVersion: nodeVersion,
  buildWorkflowOptions: {
    mutableInstall: false,
  },
  pnpmOptions: {
    workspaceYamlOptions: {
      minimumReleaseAge: 1440,
      // Its postinstall only re-checks the platform binary pnpm already installed.
      allowBuilds: { esbuild: false },
    },
  },

  // Replaced by Vite+ (vite.config.ts).
  eslint: false,
  prettier: false,
  jest: false,
  devDeps: [
    'vite-plus',
    'oxlint-plugin-awscdk',
    '@aws-cdk/integ-runner',
    // Must match cdkVersion.
    '@aws-cdk/integ-tests-alpha@2.268.0-alpha.0',
    'aws-cdk',
    'tsx',
  ],

  depsUpgradeOptions: {
    workflowOptions: {
      schedule: UpgradeDependenciesSchedule.WEEKLY,
    },
    // Pinned on purpose; upgrade by hand.
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
    'cdk-integ.out.*',
  ],
  githubOptions: {
    // The Mergify app is not installed, and its rules need a review a sole maintainer cannot give.
    mergify: false,
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
  description: 'Destroy the stacks left behind by integ',
  exec: 'for d in test/integ.*.snapshot; do [ -d "$d" ] || continue; cdk destroy --app "$d" --all --force; done',
});

new TomlFile(project, 'mise.toml', {
  obj: {
    tools: {
      node: nodeVersion,
      pnpm: project.package.pnpmVersion,
    },
  },
});

// pnpm/action-setup installs pnpm from npm; pnpm 12 ships as a native binary through pnpm/setup.
project.github?.actions.set('pnpm/action-setup', 'pnpm/setup@v2.1.0');
// pnpm/setup would otherwise run its own install before Node.js is set up. The indices point at
// the "Setup pnpm" steps; check the generated workflows after upgrading projen.
const pnpmSetupSteps: Array<[workflow: string, path: string]> = [
  ['build', 'jobs.build.steps.1'],
  ['build', 'jobs.package-js.steps.3'],
  ['upgrade', 'jobs.upgrade.steps.1'],
];
for (const [workflow, path] of pnpmSetupSteps) {
  project.github?.tryFindWorkflow(workflow)?.file?.addOverride(`${path}.with.install`, false);
}

project.addPackageIgnore('/vite.config.ts');
project.addPackageIgnore('/mise.toml');

project.synth();
