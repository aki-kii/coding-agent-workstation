# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### Workstation <a name="Workstation" id="coding-agent-workstation.Workstation"></a>

A cloud-hosted workstation for a coding agent.

The construct creates a capacity provider and an AgentCore runtime on it. Starting a session
launches an EC2 instance with a workspace volume that survives the instance being stopped;
invoking the runtime again with the same session ID comes back to the same workspace.

Sessions are not created by this construct. A caller starts one by invoking the runtime with a
session ID of its own choosing.

#### Initializers <a name="Initializers" id="coding-agent-workstation.Workstation.Initializer"></a>

```typescript
import { Workstation } from 'coding-agent-workstation'

new Workstation(scope: Construct, id: string, props: WorkstationProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#coding-agent-workstation.Workstation.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#coding-agent-workstation.Workstation.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#coding-agent-workstation.Workstation.Initializer.parameter.props">props</a></code> | <code><a href="#coding-agent-workstation.WorkstationProps">WorkstationProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="coding-agent-workstation.Workstation.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="coding-agent-workstation.Workstation.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="coding-agent-workstation.Workstation.Initializer.parameter.props"></a>

- *Type:* <a href="#coding-agent-workstation.WorkstationProps">WorkstationProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#coding-agent-workstation.Workstation.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#coding-agent-workstation.Workstation.with">with</a></code> | Applies one or more mixins to this construct. |
| <code><a href="#coding-agent-workstation.Workstation.grantInvoke">grantInvoke</a></code> | Allow the given principal to invoke the runtime. |

---

##### `toString` <a name="toString" id="coding-agent-workstation.Workstation.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="coding-agent-workstation.Workstation.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="coding-agent-workstation.Workstation.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

##### `grantInvoke` <a name="grantInvoke" id="coding-agent-workstation.Workstation.grantInvoke"></a>

```typescript
public grantInvoke(grantee: IGrantable): Grant
```

Allow the given principal to invoke the runtime.

Invoking with a session ID that has no session yet starts one.

###### `grantee`<sup>Required</sup> <a name="grantee" id="coding-agent-workstation.Workstation.grantInvoke.parameter.grantee"></a>

- *Type:* aws-cdk-lib.aws_iam.IGrantable

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#coding-agent-workstation.Workstation.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="coding-agent-workstation.Workstation.isConstruct"></a>

```typescript
import { Workstation } from 'coding-agent-workstation'

Workstation.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="coding-agent-workstation.Workstation.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#coding-agent-workstation.Workstation.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#coding-agent-workstation.Workstation.property.capacityProviderArn">capacityProviderArn</a></code> | <code>string</code> | The ARN of the capacity provider the workstations run on. |
| <code><a href="#coding-agent-workstation.Workstation.property.executionRole">executionRole</a></code> | <code>aws-cdk-lib.aws_iam.IRole</code> | The role the agent runs with. |
| <code><a href="#coding-agent-workstation.Workstation.property.runtimeArn">runtimeArn</a></code> | <code>string</code> | The ARN of the runtime. |
| <code><a href="#coding-agent-workstation.Workstation.property.runtimeId">runtimeId</a></code> | <code>string</code> | The ID of the runtime. |

---

##### `node`<sup>Required</sup> <a name="node" id="coding-agent-workstation.Workstation.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `capacityProviderArn`<sup>Required</sup> <a name="capacityProviderArn" id="coding-agent-workstation.Workstation.property.capacityProviderArn"></a>

```typescript
public readonly capacityProviderArn: string;
```

- *Type:* string

The ARN of the capacity provider the workstations run on.

---

##### `executionRole`<sup>Required</sup> <a name="executionRole" id="coding-agent-workstation.Workstation.property.executionRole"></a>

```typescript
public readonly executionRole: IRole;
```

- *Type:* aws-cdk-lib.aws_iam.IRole

The role the agent runs with.

---

##### `runtimeArn`<sup>Required</sup> <a name="runtimeArn" id="coding-agent-workstation.Workstation.property.runtimeArn"></a>

```typescript
public readonly runtimeArn: string;
```

- *Type:* string

The ARN of the runtime.

Invoke it with a session ID to start or resume a workstation.

---

##### `runtimeId`<sup>Required</sup> <a name="runtimeId" id="coding-agent-workstation.Workstation.property.runtimeId"></a>

```typescript
public readonly runtimeId: string;
```

- *Type:* string

The ID of the runtime.

---


### WorkstationCapacityProvider <a name="WorkstationCapacityProvider" id="coding-agent-workstation.WorkstationCapacityProvider"></a>

The EC2 infrastructure the workstations run on.

A capacity provider is created once and used by a runtime. Every session started against that
runtime is one EC2 instance launched from this configuration, with its own workspace volume.

**Note**: almost everything about a capacity provider is fixed at creation. Changing a property
that says so replaces it, and the replacement deletes the persistent volumes of every session
that ran on it.

#### Initializers <a name="Initializers" id="coding-agent-workstation.WorkstationCapacityProvider.Initializer"></a>

```typescript
import { WorkstationCapacityProvider } from 'coding-agent-workstation'

new WorkstationCapacityProvider(scope: Construct, id: string, props: WorkstationCapacityProviderProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProvider.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProvider.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProvider.Initializer.parameter.props">props</a></code> | <code><a href="#coding-agent-workstation.WorkstationCapacityProviderProps">WorkstationCapacityProviderProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="coding-agent-workstation.WorkstationCapacityProvider.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="coding-agent-workstation.WorkstationCapacityProvider.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="coding-agent-workstation.WorkstationCapacityProvider.Initializer.parameter.props"></a>

- *Type:* <a href="#coding-agent-workstation.WorkstationCapacityProviderProps">WorkstationCapacityProviderProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProvider.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProvider.with">with</a></code> | Applies one or more mixins to this construct. |

---

##### `toString` <a name="toString" id="coding-agent-workstation.WorkstationCapacityProvider.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="coding-agent-workstation.WorkstationCapacityProvider.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="coding-agent-workstation.WorkstationCapacityProvider.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProvider.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="coding-agent-workstation.WorkstationCapacityProvider.isConstruct"></a>

```typescript
import { WorkstationCapacityProvider } from 'coding-agent-workstation'

WorkstationCapacityProvider.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="coding-agent-workstation.WorkstationCapacityProvider.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProvider.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProvider.property.capacityProviderArn">capacityProviderArn</a></code> | <code>string</code> | The ARN of the capacity provider. |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProvider.property.capacityProviderId">capacityProviderId</a></code> | <code>string</code> | The ID of the capacity provider. |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProvider.property.securityGroups">securityGroups</a></code> | <code>aws-cdk-lib.aws_ec2.ISecurityGroup[]</code> | The security groups of the instances. |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProvider.property.workspaceVolumeName">workspaceVolumeName</a></code> | <code>string</code> | The name of the volume to mount in a runtime's filesystem configuration. |

---

##### `node`<sup>Required</sup> <a name="node" id="coding-agent-workstation.WorkstationCapacityProvider.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `capacityProviderArn`<sup>Required</sup> <a name="capacityProviderArn" id="coding-agent-workstation.WorkstationCapacityProvider.property.capacityProviderArn"></a>

```typescript
public readonly capacityProviderArn: string;
```

- *Type:* string

The ARN of the capacity provider.

---

##### `capacityProviderId`<sup>Required</sup> <a name="capacityProviderId" id="coding-agent-workstation.WorkstationCapacityProvider.property.capacityProviderId"></a>

```typescript
public readonly capacityProviderId: string;
```

- *Type:* string

The ID of the capacity provider.

---

##### `securityGroups`<sup>Required</sup> <a name="securityGroups" id="coding-agent-workstation.WorkstationCapacityProvider.property.securityGroups"></a>

```typescript
public readonly securityGroups: ISecurityGroup[];
```

- *Type:* aws-cdk-lib.aws_ec2.ISecurityGroup[]

The security groups of the instances.

---

##### `workspaceVolumeName`<sup>Required</sup> <a name="workspaceVolumeName" id="coding-agent-workstation.WorkstationCapacityProvider.property.workspaceVolumeName"></a>

```typescript
public readonly workspaceVolumeName: string;
```

- *Type:* string

The name of the volume to mount in a runtime's filesystem configuration.

---

#### Constants <a name="Constants" id="Constants"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProvider.property.MAX_LIFETIME">MAX_LIFETIME</a></code> | <code>aws-cdk-lib.Duration</code> | The longest an instance may run, which caps a runtime's own maximum session lifetime. |

---

##### `MAX_LIFETIME`<sup>Required</sup> <a name="MAX_LIFETIME" id="coding-agent-workstation.WorkstationCapacityProvider.property.MAX_LIFETIME"></a>

```typescript
public readonly MAX_LIFETIME: Duration;
```

- *Type:* aws-cdk-lib.Duration

The longest an instance may run, which caps a runtime's own maximum session lifetime.

---

## Structs <a name="Structs" id="Structs"></a>

### WorkstationCapacityProviderProps <a name="WorkstationCapacityProviderProps" id="coding-agent-workstation.WorkstationCapacityProviderProps"></a>

Properties for a WorkstationCapacityProvider.

#### Initializer <a name="Initializer" id="coding-agent-workstation.WorkstationCapacityProviderProps.Initializer"></a>

```typescript
import { WorkstationCapacityProviderProps } from 'coding-agent-workstation'

const workstationCapacityProviderProps: WorkstationCapacityProviderProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProviderProps.property.vpc">vpc</a></code> | <code>aws-cdk-lib.aws_ec2.IVpc</code> | The VPC the workstation instances run in. |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProviderProps.property.instanceProfile">instanceProfile</a></code> | <code>aws-cdk-lib.aws_iam.IInstanceProfile</code> | The instance profile attached to the instances. |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProviderProps.property.instanceTypes">instanceTypes</a></code> | <code>string[]</code> | The instance types AgentCore may launch, as Amazon EC2 instance type names. |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProviderProps.property.operatorRole">operatorRole</a></code> | <code>aws-cdk-lib.aws_iam.IRole</code> | The role AgentCore assumes to provision and operate the instances. |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProviderProps.property.securityGroups">securityGroups</a></code> | <code>aws-cdk-lib.aws_ec2.ISecurityGroup[]</code> | The security groups for the instances. |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProviderProps.property.vpcSubnets">vpcSubnets</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetSelection</code> | Which subnets of the VPC the instances run in. |
| <code><a href="#coding-agent-workstation.WorkstationCapacityProviderProps.property.workspaceSizeGiB">workspaceSizeGiB</a></code> | <code>number</code> | The size of each session's workspace volume, in GiB. |

---

##### `vpc`<sup>Required</sup> <a name="vpc" id="coding-agent-workstation.WorkstationCapacityProviderProps.property.vpc"></a>

```typescript
public readonly vpc: IVpc;
```

- *Type:* aws-cdk-lib.aws_ec2.IVpc

The VPC the workstation instances run in.

**Note**: changing this replaces the capacity provider, which deletes every session's
persistent volume with it.

---

##### `instanceProfile`<sup>Optional</sup> <a name="instanceProfile" id="coding-agent-workstation.WorkstationCapacityProviderProps.property.instanceProfile"></a>

```typescript
public readonly instanceProfile: IInstanceProfile;
```

- *Type:* aws-cdk-lib.aws_iam.IInstanceProfile
- *Default:* an instance profile is created with `CloudWatchAgentServerPolicy`

The instance profile attached to the instances.

AgentCore uses it to collect system logs from the instance. It does not give the agent its
permissions; the workstation's execution role does that.

When you pass one, the construct adds nothing to it.

**Note**: changing this replaces the capacity provider, which deletes every session's
persistent volume with it.

---

##### `instanceTypes`<sup>Optional</sup> <a name="instanceTypes" id="coding-agent-workstation.WorkstationCapacityProviderProps.property.instanceTypes"></a>

```typescript
public readonly instanceTypes: string[];
```

- *Type:* string[]
- *Default:* `m7g.large` and `m6g.large`

The instance types AgentCore may launch, as Amazon EC2 instance type names.

They must be `arm64`, because the workstation image is built for `arm64`.

**Note**: changing this replaces the capacity provider, which deletes every session's
persistent volume with it.

---

##### `operatorRole`<sup>Optional</sup> <a name="operatorRole" id="coding-agent-workstation.WorkstationCapacityProviderProps.property.operatorRole"></a>

```typescript
public readonly operatorRole: IRole;
```

- *Type:* aws-cdk-lib.aws_iam.IRole
- *Default:* a role is created

The role AgentCore assumes to provision and operate the instances.

When you pass a role, the construct adds nothing to it. It must trust
`bedrock-agentcore.amazonaws.com` and be allowed to manage the EC2 and Auto Scaling
resources a capacity provider is built from.

**Note**: changing this replaces the capacity provider, which deletes every session's
persistent volume with it.

---

##### `securityGroups`<sup>Optional</sup> <a name="securityGroups" id="coding-agent-workstation.WorkstationCapacityProviderProps.property.securityGroups"></a>

```typescript
public readonly securityGroups: ISecurityGroup[];
```

- *Type:* aws-cdk-lib.aws_ec2.ISecurityGroup[]
- *Default:* one security group that allows all outbound traffic

The security groups for the instances.

**Note**: changing this replaces the capacity provider, which deletes every session's
persistent volume with it. Changing the rules of a security group does not.

---

##### `vpcSubnets`<sup>Optional</sup> <a name="vpcSubnets" id="coding-agent-workstation.WorkstationCapacityProviderProps.property.vpcSubnets"></a>

```typescript
public readonly vpcSubnets: SubnetSelection;
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetSelection
- *Default:* the VPC's public subnets

Which subnets of the VPC the instances run in.

The instances need to reach the internet to pull the container image and to talk to the
coding agent's API.

**Note**: changing this replaces the capacity provider, which deletes every session's
persistent volume with it.

---

##### `workspaceSizeGiB`<sup>Optional</sup> <a name="workspaceSizeGiB" id="coding-agent-workstation.WorkstationCapacityProviderProps.property.workspaceSizeGiB"></a>

```typescript
public readonly workspaceSizeGiB: number;
```

- *Type:* number
- *Default:* 20

The size of each session's workspace volume, in GiB.

One volume is created per session and billed for as long as the session exists, whether or
not its instance is running.

**Note**: changing this replaces the capacity provider, which deletes every session's
persistent volume with it.

---

### WorkstationProps <a name="WorkstationProps" id="coding-agent-workstation.WorkstationProps"></a>

Properties for a Workstation.

#### Initializer <a name="Initializer" id="coding-agent-workstation.WorkstationProps.Initializer"></a>

```typescript
import { WorkstationProps } from 'coding-agent-workstation'

const workstationProps: WorkstationProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#coding-agent-workstation.WorkstationProps.property.vpc">vpc</a></code> | <code>aws-cdk-lib.aws_ec2.IVpc</code> | The VPC the workstation instances run in. |
| <code><a href="#coding-agent-workstation.WorkstationProps.property.instanceProfile">instanceProfile</a></code> | <code>aws-cdk-lib.aws_iam.IInstanceProfile</code> | The instance profile attached to the instances. |
| <code><a href="#coding-agent-workstation.WorkstationProps.property.instanceTypes">instanceTypes</a></code> | <code>string[]</code> | The instance types AgentCore may launch, as Amazon EC2 instance type names. |
| <code><a href="#coding-agent-workstation.WorkstationProps.property.operatorRole">operatorRole</a></code> | <code>aws-cdk-lib.aws_iam.IRole</code> | The role AgentCore assumes to provision and operate the instances. |
| <code><a href="#coding-agent-workstation.WorkstationProps.property.securityGroups">securityGroups</a></code> | <code>aws-cdk-lib.aws_ec2.ISecurityGroup[]</code> | The security groups for the instances. |
| <code><a href="#coding-agent-workstation.WorkstationProps.property.vpcSubnets">vpcSubnets</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetSelection</code> | Which subnets of the VPC the instances run in. |
| <code><a href="#coding-agent-workstation.WorkstationProps.property.workspaceSizeGiB">workspaceSizeGiB</a></code> | <code>number</code> | The size of each session's workspace volume, in GiB. |
| <code><a href="#coding-agent-workstation.WorkstationProps.property.executionRole">executionRole</a></code> | <code>aws-cdk-lib.aws_iam.IRole</code> | The role the agent runs with. |
| <code><a href="#coding-agent-workstation.WorkstationProps.property.idleTimeout">idleTimeout</a></code> | <code>aws-cdk-lib.Duration</code> | How long a session stays up after the last activity. |
| <code><a href="#coding-agent-workstation.WorkstationProps.property.maxSessionLifetime">maxSessionLifetime</a></code> | <code>aws-cdk-lib.Duration</code> | How long a session may run before AgentCore stops it, however busy it is. |

---

##### `vpc`<sup>Required</sup> <a name="vpc" id="coding-agent-workstation.WorkstationProps.property.vpc"></a>

```typescript
public readonly vpc: IVpc;
```

- *Type:* aws-cdk-lib.aws_ec2.IVpc

The VPC the workstation instances run in.

**Note**: changing this replaces the capacity provider, which deletes every session's
persistent volume with it.

---

##### `instanceProfile`<sup>Optional</sup> <a name="instanceProfile" id="coding-agent-workstation.WorkstationProps.property.instanceProfile"></a>

```typescript
public readonly instanceProfile: IInstanceProfile;
```

- *Type:* aws-cdk-lib.aws_iam.IInstanceProfile
- *Default:* an instance profile is created with `CloudWatchAgentServerPolicy`

The instance profile attached to the instances.

AgentCore uses it to collect system logs from the instance. It does not give the agent its
permissions; the workstation's execution role does that.

When you pass one, the construct adds nothing to it.

**Note**: changing this replaces the capacity provider, which deletes every session's
persistent volume with it.

---

##### `instanceTypes`<sup>Optional</sup> <a name="instanceTypes" id="coding-agent-workstation.WorkstationProps.property.instanceTypes"></a>

```typescript
public readonly instanceTypes: string[];
```

- *Type:* string[]
- *Default:* `m7g.large` and `m6g.large`

The instance types AgentCore may launch, as Amazon EC2 instance type names.

They must be `arm64`, because the workstation image is built for `arm64`.

**Note**: changing this replaces the capacity provider, which deletes every session's
persistent volume with it.

---

##### `operatorRole`<sup>Optional</sup> <a name="operatorRole" id="coding-agent-workstation.WorkstationProps.property.operatorRole"></a>

```typescript
public readonly operatorRole: IRole;
```

- *Type:* aws-cdk-lib.aws_iam.IRole
- *Default:* a role is created

The role AgentCore assumes to provision and operate the instances.

When you pass a role, the construct adds nothing to it. It must trust
`bedrock-agentcore.amazonaws.com` and be allowed to manage the EC2 and Auto Scaling
resources a capacity provider is built from.

**Note**: changing this replaces the capacity provider, which deletes every session's
persistent volume with it.

---

##### `securityGroups`<sup>Optional</sup> <a name="securityGroups" id="coding-agent-workstation.WorkstationProps.property.securityGroups"></a>

```typescript
public readonly securityGroups: ISecurityGroup[];
```

- *Type:* aws-cdk-lib.aws_ec2.ISecurityGroup[]
- *Default:* one security group that allows all outbound traffic

The security groups for the instances.

**Note**: changing this replaces the capacity provider, which deletes every session's
persistent volume with it. Changing the rules of a security group does not.

---

##### `vpcSubnets`<sup>Optional</sup> <a name="vpcSubnets" id="coding-agent-workstation.WorkstationProps.property.vpcSubnets"></a>

```typescript
public readonly vpcSubnets: SubnetSelection;
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetSelection
- *Default:* the VPC's public subnets

Which subnets of the VPC the instances run in.

The instances need to reach the internet to pull the container image and to talk to the
coding agent's API.

**Note**: changing this replaces the capacity provider, which deletes every session's
persistent volume with it.

---

##### `workspaceSizeGiB`<sup>Optional</sup> <a name="workspaceSizeGiB" id="coding-agent-workstation.WorkstationProps.property.workspaceSizeGiB"></a>

```typescript
public readonly workspaceSizeGiB: number;
```

- *Type:* number
- *Default:* 20

The size of each session's workspace volume, in GiB.

One volume is created per session and billed for as long as the session exists, whether or
not its instance is running.

**Note**: changing this replaces the capacity provider, which deletes every session's
persistent volume with it.

---

##### `executionRole`<sup>Optional</sup> <a name="executionRole" id="coding-agent-workstation.WorkstationProps.property.executionRole"></a>

```typescript
public readonly executionRole: IRole;
```

- *Type:* aws-cdk-lib.aws_iam.IRole
- *Default:* a role is created with read-only access to the account

The role the agent runs with.

When you pass a role, the construct adds nothing to it. It must trust
`bedrock-agentcore.amazonaws.com`, be allowed to pull the workstation image from Amazon ECR
and to write the runtime's logs, and carry whatever the agent itself needs.

---

##### `idleTimeout`<sup>Optional</sup> <a name="idleTimeout" id="coding-agent-workstation.WorkstationProps.property.idleTimeout"></a>

```typescript
public readonly idleTimeout: Duration;
```

- *Type:* aws-cdk-lib.Duration
- *Default:* Duration.minutes(10)

How long a session stays up after the last activity.

This is the whole idle time. The workstation reports itself busy for all but the last five
minutes of it, and AgentCore's own idle timeout covers the rest. It must be at least five
minutes.

---

##### `maxSessionLifetime`<sup>Optional</sup> <a name="maxSessionLifetime" id="coding-agent-workstation.WorkstationProps.property.maxSessionLifetime"></a>

```typescript
public readonly maxSessionLifetime: Duration;
```

- *Type:* aws-cdk-lib.Duration
- *Default:* Duration.hours(24)

How long a session may run before AgentCore stops it, however busy it is.

The instance itself is capped at 14 days, and this has to stay under that.

---



