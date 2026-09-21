import { App, Duration, Stack, Tags } from 'aws-cdk-lib';
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
  ).toThrow(/idleTimeout must be at least 5 minutes/);
});

test('tags reach the instances through propagatedTags', () => {
  const testStack = stack();
  const workstation = new Workstation(testStack, 'Workstation', { vpc: vpc(testStack) });
  Tags.of(workstation).add('Owner', 'platform');

  const capacityProvider = Template.fromStack(testStack).findResources(
    'AWS::BedrockAgentCore::CapacityProvider',
  );
  const launchParameters =
    Object.values(capacityProvider)[0].Properties.ComputeConfiguration.Ec2Configuration
      .LaunchTemplateSource.LaunchParameters;

  expect(launchParameters.PropagatedTags).toEqual({ Owner: 'platform' });
});

test('propagateTags false leaves the instances untagged', () => {
  const testStack = stack();
  const workstation = new Workstation(testStack, 'Workstation', {
    vpc: vpc(testStack),
    propagateTags: false,
  });
  Tags.of(workstation).add('Owner', 'platform');

  const capacityProvider = Template.fromStack(testStack).findResources(
    'AWS::BedrockAgentCore::CapacityProvider',
  );
  const launchParameters =
    Object.values(capacityProvider)[0].Properties.ComputeConfiguration.Ec2Configuration
      .LaunchTemplateSource.LaunchParameters;

  expect(launchParameters.PropagatedTags).toBeUndefined();
});

test('grantConnect covers the HTTP and WebSocket invoke actions', () => {
  const testStack = stack();
  const workstation = new Workstation(testStack, 'Workstation', { vpc: vpc(testStack) });
  const role = new iam.Role(testStack, 'Caller', {
    assumedBy: new iam.AccountRootPrincipal(),
  });

  workstation.grantConnect(role);

  Template.fromStack(testStack).hasResourceProperties('AWS::IAM::Policy', {
    PolicyDocument: {
      Statement: [
        {
          Action: [
            'bedrock-agentcore:InvokeAgentRuntime',
            'bedrock-agentcore:InvokeAgentRuntimeWithWebSocketStream',
          ],
          Effect: 'Allow',
        },
      ],
    },
  });
});
