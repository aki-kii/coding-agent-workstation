import { IntegTest } from '@aws-cdk/integ-tests-alpha';
import { App, CfnOutput, RemovalPolicies, Stack } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Workstation } from '../src';

const app = new App();
const stack = new Stack(app, 'WorkstationInteg');

const vpc = new ec2.Vpc(stack, 'Vpc', {
  maxAzs: 2,
  natGateways: 0,
  subnetConfiguration: [{ name: 'Public', subnetType: ec2.SubnetType.PUBLIC }],
});

const workstation = new Workstation(stack, 'Workstation', { vpc });

new CfnOutput(stack, 'RuntimeArn', { value: workstation.runtimeArn });
new CfnOutput(stack, 'CapacityProviderArn', { value: workstation.capacityProviderArn });

RemovalPolicies.of(stack).destroy();

new IntegTest(app, 'WorkstationTest', { testCases: [stack] });
