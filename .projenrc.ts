import { awscdk } from 'projen';
import { NodePackageManager, TrailingComma } from 'projen/lib/javascript';

const project = new awscdk.AwsCdkConstructLibrary({
  name: 'coding-agent-workstation',
  description:
    'AWS CDK constructs for provisioning a cloud-hosted coding agent workstation on Amazon Bedrock AgentCore',
  author: 'aki-kii',
  authorAddress: 'impeeeeedance@gmail.com',
  repositoryUrl: 'https://github.com/aki-kii/coding-agent-workstation',
  license: 'Apache-2.0',
  keywords: ['aws', 'cdk', 'aws-cdk', 'bedrock', 'agentcore', 'claude-code', 'coding-agent'],

  cdkVersion: '2.220.0',
  defaultReleaseBranch: 'main',
  jsiiVersion: '~6.0.0',
  // jsii 6 requires typescript ~6.0. projen's default (latest) pulls in TS 7, which
  // typescript-eslint (TS <6.1 only) refuses to load, so pin it explicitly.
  typescriptVersion: '~6.0.0',
  projenrcTs: true,
  packageManager: NodePackageManager.PNPM,
  workflowNodeVersion: '24',

  prettier: true,
  prettierOptions: {
    settings: {
      singleQuote: true,
      trailingComma: TrailingComma.ALL,
      semi: true,
      printWidth: 100,
    },
  },
  eslintOptions: {
    dirs: ['src'],
    devdirs: ['test', 'projenrc'],
    prettier: true,
    ignorePatterns: ['example/**/*', 'test/*.snapshot/**/*', '*.d.ts'],
  },
  jestOptions: {
    configFilePath: 'jest.config.json',
  },

  gitignore: [
    '*.js',
    '*.d.ts',
    'cdk.out/',
    '.DS_Store',
    '.idea/',
    // Scratch space for agent-generated research and drafts. Local only.
    'docs/ai-output/',
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

project.synth();
