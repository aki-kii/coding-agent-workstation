import * as path from 'node:path';
import { ArnFormat, Duration, Names, Stack } from 'aws-cdk-lib';
import { CfnRuntime } from 'aws-cdk-lib/aws-bedrockagentcore';
import { DockerImageAsset, Platform } from 'aws-cdk-lib/aws-ecr-assets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { WorkstationCapacityProvider, WorkstationCapacityProviderProps } from './capacity-provider';

// container/Dockerfile puts HOME under this path.
const WORKSPACE_MOUNT_PATH = '/mnt/workspace';
const IDLE_RUNTIME_SESSION_TIMEOUT = Duration.minutes(5);
const DEFAULT_IDLE_TIMEOUT = Duration.minutes(10);
const DEFAULT_MAX_SESSION_LIFETIME = Duration.hours(24);
const IDLE_PADDING_ENV_VAR = 'WORKSTATION_IDLE_PADDING_SECONDS';

/**
 * Properties for a Workstation.
 */
export interface WorkstationProps extends WorkstationCapacityProviderProps {
  /**
   * The role the agent runs with.
   *
   * When you pass a role, the construct adds nothing to it. It must trust
   * `bedrock-agentcore.amazonaws.com`, be allowed to pull the workstation image from Amazon ECR
   * and to write the runtime's logs, and carry whatever the agent itself needs.
   *
   * @default - a role is created with read-only access to the account
   */
  readonly executionRole?: iam.IRole;

  /**
   * How long a session stays up after the last activity.
   *
   * This is the whole idle time. The workstation reports itself busy for all but the last five
   * minutes of it, and AgentCore's own idle timeout covers the rest. It must be at least five
   * minutes.
   *
   * @default Duration.minutes(10)
   */
  readonly idleTimeout?: Duration;

  /**
   * How long a session may run before AgentCore stops it, however busy it is.
   *
   * The instance itself is capped at 14 days, and this has to stay under that.
   *
   * @default Duration.hours(24)
   */
  readonly maxSessionLifetime?: Duration;
}

/**
 * A cloud-hosted workstation for a coding agent.
 *
 * The construct creates a capacity provider and an AgentCore runtime on it. Starting a session
 * launches an EC2 instance with a workspace volume that survives the instance being stopped;
 * invoking the runtime again with the same session ID comes back to the same workspace.
 *
 * Sessions are not created by this construct. A caller starts one by invoking the runtime with a
 * session ID of its own choosing.
 */
export class Workstation extends Construct {
  /**
   * The ARN of the runtime. Invoke it with a session ID to start or resume a workstation.
   */
  public readonly runtimeArn: string;

  /**
   * The ID of the runtime.
   */
  public readonly runtimeId: string;

  /**
   * The ARN of the capacity provider the workstations run on.
   */
  public readonly capacityProviderArn: string;

  /**
   * The role the agent runs with.
   */
  public readonly executionRole: iam.IRole;

  constructor(scope: Construct, id: string, props: WorkstationProps) {
    super(scope, id);

    const idleTimeout = props.idleTimeout ?? DEFAULT_IDLE_TIMEOUT;
    if (idleTimeout.toSeconds() < IDLE_RUNTIME_SESSION_TIMEOUT.toSeconds()) {
      throw new Error(
        `idleTimeout must be at least ${IDLE_RUNTIME_SESSION_TIMEOUT.toSeconds()} seconds, got ${idleTimeout.toSeconds()}`,
      );
    }

    const maxSessionLifetime = props.maxSessionLifetime ?? DEFAULT_MAX_SESSION_LIFETIME;
    if (maxSessionLifetime.toSeconds() > WorkstationCapacityProvider.MAX_LIFETIME.toSeconds()) {
      throw new Error(
        `maxSessionLifetime must be at most ${WorkstationCapacityProvider.MAX_LIFETIME.toSeconds()} seconds, got ${maxSessionLifetime.toSeconds()}`,
      );
    }

    const capacityProvider = new WorkstationCapacityProvider(this, 'Capacity', props);
    this.capacityProviderArn = capacityProvider.capacityProviderArn;
    this.executionRole = props.executionRole ?? this.createExecutionRole();

    const image = new DockerImageAsset(this, 'Image', {
      directory: path.join(__dirname, '..', 'container'),
      platform: Platform.LINUX_ARM64,
    });
    if (!props.executionRole) image.repository.grantPull(this.executionRole);

    const runtime = new CfnRuntime(this, 'Resource', {
      agentRuntimeName: Names.uniqueResourceName(this, {
        maxLength: 48,
        allowedSpecialCharacters: '_',
      }),
      agentRuntimeArtifact: {
        containerConfiguration: { containerUri: image.imageUri },
      },
      roleArn: this.executionRole.roleArn,
      capacityProviderConfiguration: {
        capacityProviderArn: capacityProvider.capacityProviderArn,
      },
      filesystemConfigurations: [
        {
          capacityProviderVolume: {
            volumeName: capacityProvider.workspaceVolumeName,
            mountPath: WORKSPACE_MOUNT_PATH,
          },
        },
      ],
      lifecycleConfiguration: {
        idleRuntimeSessionTimeout: IDLE_RUNTIME_SESSION_TIMEOUT.toSeconds(),
        maxLifetime: maxSessionLifetime.toSeconds(),
      },
      // The container reports itself busy for this long after the last activity, and AgentCore's
      // own idle timeout runs out five minutes after that.
      environmentVariables: {
        [IDLE_PADDING_ENV_VAR]: `${idleTimeout.toSeconds() - IDLE_RUNTIME_SESSION_TIMEOUT.toSeconds()}`,
      },
      protocolConfiguration: 'HTTP',
    });

    this.runtimeArn = runtime.attrAgentRuntimeArn;
    this.runtimeId = runtime.attrAgentRuntimeId;
  }

  /**
   * Allow the given principal to invoke the runtime, over HTTP and over a WebSocket stream.
   *
   * Invoking with a session ID that has no session yet starts one.
   */
  public grantConnect(grantee: iam.IGrantable): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee,
      actions: [
        'bedrock-agentcore:InvokeAgentRuntime',
        'bedrock-agentcore:InvokeAgentRuntimeWithWebSocketStream',
      ],
      resourceArns: [this.runtimeArn, `${this.runtimeArn}/*`],
    });
  }

  private createExecutionRole(): iam.IRole {
    const stack = Stack.of(this);
    const role = new iam.Role(this, 'ExecutionRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com', {
        conditions: {
          StringEquals: { 'aws:SourceAccount': stack.account },
          ArnLike: {
            'aws:SourceArn': stack.formatArn({ service: 'bedrock-agentcore', resource: '*' }),
          },
        },
      }),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess')],
    });

    // Without these the runtime cannot write its logs. Pulling the image is granted on the
    // asset's repository once it exists.
    role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
          'logs:PutResourcePolicy',
        ],
        resources: [
          stack.formatArn({
            service: 'logs',
            resource: 'log-group',
            resourceName: '/aws/bedrock-agentcore/runtimes/*',
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
          stack.formatArn({
            service: 'logs',
            resource: 'log-group',
            resourceName: '/aws/bedrock-agentcore/runtimes/*:log-stream:*',
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
        ],
      }),
    );
    role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'xray:PutTraceSegments',
          'xray:PutTelemetryRecords',
          'xray:GetSamplingRules',
          'xray:GetSamplingTargets',
        ],
        resources: ['*'],
      }),
    );
    role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: { StringEquals: { 'cloudwatch:namespace': 'bedrock-agentcore' } },
      }),
    );

    return role;
  }
}
