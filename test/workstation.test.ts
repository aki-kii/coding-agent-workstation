import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { App, Duration, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { expect, test } from 'vite-plus/test';
import { Workstation } from '../src';

function stack(): Stack {
  return new Stack(new App(), 'Test', {
    env: { account: '123456789012', region: 'us-east-1' },
  });
}

function vpc(scope: Stack): ec2.IVpc {
  return new ec2.Vpc(scope, 'Vpc', { maxAzs: 2 });
}

test('default workstation', () => {
  const testStack = stack();
  new Workstation(testStack, 'Workstation', { vpc: vpc(testStack) });

  expect(Template.fromStack(testStack).toJSON()).toMatchSnapshot();
});

test('idleTimeout below the runtime idle timeout is rejected', () => {
  const testStack = stack();

  expect(
    () =>
      new Workstation(testStack, 'Workstation', {
        vpc: vpc(testStack),
        idleTimeout: Duration.minutes(4),
      }),
  ).toThrow(/idleTimeout must be at least 300 seconds/);
});

test('idleTimeout is the total, and the container gets what is left after the runtime timeout', () => {
  const testStack = stack();
  new Workstation(testStack, 'Workstation', {
    vpc: vpc(testStack),
    idleTimeout: Duration.hours(2),
  });

  Template.fromStack(testStack).hasResourceProperties('AWS::BedrockAgentCore::Runtime', {
    EnvironmentVariables: { WORKSTATION_IDLE_PADDING_SECONDS: '6900' },
  });
});

test('maxSessionLifetime beyond the instance cap is rejected', () => {
  const testStack = stack();

  expect(
    () =>
      new Workstation(testStack, 'Workstation', {
        vpc: vpc(testStack),
        maxSessionLifetime: Duration.days(30),
      }),
  ).toThrow(/maxSessionLifetime must be at most 1209600 seconds/);
});

test('grantInvoke allows invoking the runtime', () => {
  const testStack = stack();
  const workstation = new Workstation(testStack, 'Workstation', { vpc: vpc(testStack) });
  const role = new iam.Role(testStack, 'Caller', {
    assumedBy: new iam.AccountRootPrincipal(),
  });

  workstation.grantInvoke(role);

  Template.fromStack(testStack).hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: [
        {
          Action: 'bedrock-agentcore:InvokeAgentRuntime',
          Effect: 'Allow',
        },
      ],
    },
  });
});

test('startupScript is staged into the image build context as an executable startup.sh', () => {
  const script = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'startup-test-')), 'my-script.sh');
  fs.writeFileSync(script, '#!/bin/bash\necho hello\n');
  const app = new App();
  const testStack = new Stack(app, 'Test', {
    env: { account: '123456789012', region: 'us-east-1' },
  });
  new Workstation(testStack, 'Workstation', { vpc: vpc(testStack), startupScript: script });

  const assembly = app.synth();
  const asset = Object.values(
    JSON.parse(fs.readFileSync(path.join(assembly.directory, 'Test.assets.json'), 'utf-8'))
      .dockerImages,
  )[0] as { source: { directory: string } };
  const context = path.join(assembly.directory, asset.source.directory);

  expect(fs.readFileSync(path.join(context, 'startup.sh'), 'utf-8')).toContain('echo hello');
  expect(fs.statSync(path.join(context, 'startup.sh')).mode & 0o777).toBe(0o755);
  expect(fs.existsSync(path.join(context, 'Dockerfile'))).toBe(true);
});

test('a startupScript that is not a file is rejected', () => {
  const testStack = stack();

  expect(
    () =>
      new Workstation(testStack, 'Workstation', {
        vpc: vpc(testStack),
        startupScript: '/nonexistent/startup.sh',
      }),
  ).toThrow(/startupScript must be an existing file/);
});

test('an imported instance profile without its role needs an operator role', () => {
  const testStack = stack();

  expect(
    () =>
      new Workstation(testStack, 'Workstation', {
        vpc: vpc(testStack),
        instanceProfile: iam.InstanceProfile.fromInstanceProfileArn(
          testStack,
          'Imported',
          'arn:aws:iam::123456789012:instance-profile/imported',
        ),
      }),
  ).toThrow(/instanceProfile was imported without its role/);
});
