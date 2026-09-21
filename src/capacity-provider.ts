import { Duration, Names, Stack } from 'aws-cdk-lib';
import { CfnCapacityProvider } from 'aws-cdk-lib/aws-bedrockagentcore';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

const OPERATING_SYSTEM = 'LINUX_ARM64';
const WORKSPACE_VOLUME_NAME = 'workspace';
const ROOT_VOLUME_FREE_SPACE_GIB = 8;
const IDLE_INSTANCE_TIMEOUT = Duration.minutes(10);
const MAX_INSTANCE_LIFETIME = Duration.days(14);
const DEFAULT_INSTANCE_TYPES = ['m7g.large', 'm6g.large'];
const DEFAULT_WORKSPACE_SIZE_GIB = 20;

/**
 * Properties for a WorkstationCapacityProvider.
 */
export interface WorkstationCapacityProviderProps {
  /**
   * The VPC the workstation instances run in.
   *
   * **Note**: changing this replaces the capacity provider, which deletes every session's
   * persistent volume with it.
   */
  readonly vpc: ec2.IVpc;

  /**
   * Which subnets of the VPC the instances run in.
   *
   * The instances need to reach the internet to pull the container image and to talk to the
   * coding agent's API.
   *
   * **Note**: changing this replaces the capacity provider, which deletes every session's
   * persistent volume with it.
   *
   * @default - the VPC's public subnets
   */
  readonly vpcSubnets?: ec2.SubnetSelection;

  /**
   * The security groups for the instances.
   *
   * **Note**: changing this replaces the capacity provider, which deletes every session's
   * persistent volume with it. Changing the rules of a security group does not.
   *
   * @default - one security group that allows all outbound traffic
   */
  readonly securityGroups?: ec2.ISecurityGroup[];

  /**
   * The instance types AgentCore may launch, as Amazon EC2 instance type names.
   *
   * They must be `arm64`, because the workstation image is built for `arm64`.
   *
   * **Note**: changing this replaces the capacity provider, which deletes every session's
   * persistent volume with it.
   *
   * @default - `m7g.large` and `m6g.large`
   */
  readonly instanceTypes?: string[];

  /**
   * The size of each session's workspace volume, in GiB.
   *
   * One volume is created per session and billed for as long as the session exists, whether or
   * not its instance is running.
   *
   * **Note**: changing this replaces the capacity provider, which deletes every session's
   * persistent volume with it.
   *
   * @default 20
   */
  readonly workspaceSizeGiB?: number;

  /**
   * The role AgentCore assumes to provision and operate the instances.
   *
   * When you pass a role, the construct adds nothing to it. It must trust
   * `bedrock-agentcore.amazonaws.com` and be allowed to manage the EC2 and Auto Scaling
   * resources a capacity provider is built from.
   *
   * **Note**: changing this replaces the capacity provider, which deletes every session's
   * persistent volume with it.
   *
   * @default - a role is created
   */
  readonly operatorRole?: iam.IRole;

  /**
   * The instance profile attached to the instances.
   *
   * AgentCore uses it to collect system logs from the instance. It does not give the agent its
   * permissions; the workstation's execution role does that.
   *
   * When you pass one, the construct adds nothing to it.
   *
   * **Note**: changing this replaces the capacity provider, which deletes every session's
   * persistent volume with it.
   *
   * @default - an instance profile is created with `CloudWatchAgentServerPolicy`
   */
  readonly instanceProfile?: iam.IInstanceProfile;
}

/**
 * The EC2 infrastructure the workstations run on.
 *
 * A capacity provider is created once and used by a runtime. Every session started against that
 * runtime is one EC2 instance launched from this configuration, with its own workspace volume.
 *
 * **Note**: almost everything about a capacity provider is fixed at creation. Changing a property
 * that says so replaces it, and the replacement deletes the persistent volumes of every session
 * that ran on it.
 */
export class WorkstationCapacityProvider extends Construct {
  /**
   * The longest an instance may run, which caps a runtime's own maximum session lifetime.
   */
  public static readonly MAX_LIFETIME = MAX_INSTANCE_LIFETIME;

  /**
   * The ARN of the capacity provider.
   */
  public readonly capacityProviderArn: string;

  /**
   * The ID of the capacity provider.
   */
  public readonly capacityProviderId: string;

  /**
   * The name of the volume to mount in a runtime's filesystem configuration.
   */
  public readonly workspaceVolumeName = WORKSPACE_VOLUME_NAME;

  /**
   * The security groups of the instances.
   */
  public readonly securityGroups: ec2.ISecurityGroup[];

  constructor(scope: Construct, id: string, props: WorkstationCapacityProviderProps) {
    super(scope, id);

    this.securityGroups = props.securityGroups ?? [
      new ec2.SecurityGroup(this, 'SecurityGroup', {
        vpc: props.vpc,
        description: 'Coding agent workstation instances',
      }),
    ];

    const subnets = props.vpc.selectSubnets(
      props.vpcSubnets ?? { subnetType: ec2.SubnetType.PUBLIC },
    );

    const instanceProfile = props.instanceProfile ?? this.createInstanceProfile();
    const operatorRole = props.operatorRole ?? this.createOperatorRole(instanceProfile);

    const capacityProvider = new CfnCapacityProvider(this, 'Resource', {
      name: Names.uniqueResourceName(this, {
        maxLength: 48,
        allowedSpecialCharacters: '_',
      }),
      permissionsConfiguration: {
        capacityProviderOperatorRoleArn: operatorRole.roleArn,
      },
      computeConfiguration: {
        ec2Configuration: {
          launchTemplateSource: {
            launchParameters: {
              operatingSystem: OPERATING_SYSTEM,
              instanceRequirements: {
                allowedInstanceTypes: props.instanceTypes ?? DEFAULT_INSTANCE_TYPES,
              },
              instanceProfileArn: instanceProfile.instanceProfileArn,
            },
          },
          vpcConfiguration: {
            subnets: subnets.subnetIds,
            securityGroups: this.securityGroups.map((group) => group.securityGroupId),
          },
          volumes: [
            {
              ebsConfiguration: {
                name: WORKSPACE_VOLUME_NAME,
                sizeGiB: props.workspaceSizeGiB ?? DEFAULT_WORKSPACE_SIZE_GIB,
                volumeType: 'gp3',
                encrypted: true,
              },
            },
          ],
          rootVolume: {
            freeSpaceGiB: ROOT_VOLUME_FREE_SPACE_GIB,
            volumeType: 'gp3',
            encrypted: true,
          },
          lifecycleConfiguration: {
            idleInstanceTimeout: IDLE_INSTANCE_TIMEOUT.toSeconds(),
            maxLifetime: MAX_INSTANCE_LIFETIME.toSeconds(),
          },
        },
      },
    });

    this.capacityProviderArn = capacityProvider.attrArn;
    this.capacityProviderId = capacityProvider.attrCapacityProviderId;
  }

  private createInstanceProfile(): iam.IInstanceProfile {
    const role = new iam.Role(this, 'InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchAgentServerPolicy')],
    });
    return new iam.InstanceProfile(this, 'InstanceProfile', { role });
  }

  // The actions AgentCore needs to build a capacity provider out of a launch template and an
  // Auto Scaling group. Narrowing them is tracked in #19.
  private createOperatorRole(instanceProfile: iam.IInstanceProfile): iam.IRole {
    const stack = Stack.of(this);
    const role = new iam.Role(this, 'OperatorRole', {
      assumedBy: new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com', {
        conditions: {
          StringEquals: { 'aws:SourceAccount': stack.account },
          ArnLike: {
            'aws:SourceArn': stack.formatArn({
              service: 'bedrock-agentcore',
              resource: '*',
            }),
          },
        },
      }),
    });

    role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'ec2:CreateLaunchTemplate',
          'ec2:CreateLaunchTemplateVersion',
          'ec2:DeleteLaunchTemplate',
          'ec2:CreateFleet',
          'ec2:RunInstances',
          'ec2:TerminateInstances',
          'ec2:CreateTags',
          'ec2:CreateVolume',
          'ec2:AttachVolume',
          'ec2:DetachVolume',
          'ec2:DeleteVolume',
          'ec2:CreateNetworkInterface',
          'ec2:DeleteNetworkInterface',
          'ec2:Describe*',
        ],
        resources: ['*'],
      }),
    );
    role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: [
          'autoscaling:CreateAutoScalingGroup',
          'autoscaling:UpdateAutoScalingGroup',
          'autoscaling:DeleteAutoScalingGroup',
          'autoscaling:CreateOrUpdateTags',
          'autoscaling:DeleteTags',
          'autoscaling:PutLifecycleHook',
          'autoscaling:DeleteLifecycleHook',
          'autoscaling:CompleteLifecycleAction',
          'autoscaling:SetDesiredCapacity',
          'autoscaling:Describe*',
        ],
        resources: ['*'],
      }),
    );
    role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['iam:CreateServiceLinkedRole'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'iam:AWSServiceName': [
              'autoscaling.amazonaws.com',
              'ec2.amazonaws.com',
              'bedrock-agentcore.amazonaws.com',
            ],
          },
        },
      }),
    );
    // Only the instance profile's own role. A passed-in profile may not carry its role, and then
    // the caller has to narrow this themselves.
    role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [
          instanceProfile.role?.roleArn ??
            stack.formatArn({ service: 'iam', region: '', resource: 'role', resourceName: '*' }),
        ],
        conditions: {
          StringEquals: {
            'iam:PassedToService': ['ec2.amazonaws.com', 'autoscaling.amazonaws.com'],
          },
        },
      }),
    );

    return role;
  }
}
