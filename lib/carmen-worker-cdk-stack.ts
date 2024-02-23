import * as fs from 'fs';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export class CarmenWorkerCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const amiId = 'ami-03a9ccf07696362ab';

    // TODO: a régió is legyen paraméter, az AZ-kat ez alapján állítsuk be/kérdezzük le
    // TODO: autoscaling group paraméterezése (desiredCapacity, minCapacity, maxCapacity, availability zones)

    const parameters = {
      instanceType: new cdk.CfnParameter(this, 'InstanceType', {
        type: 'String',
        description: 'The type of the AWS EC2 instance to create. Default: `t4g.small`.',
        default: 't4g.small'
      }),
      apiKey: new cdk.CfnParameter(this, 'ApiKey', {
        type: 'String',
        description: 'The Carmen Cloud API Key to use for calling the License Service.',
      }),
      vehicleRegions: new cdk.CfnParameter(this, 'VehicleRegions', {
        type: 'String',
        description: 'The regions to load engines for.',
        default: 'eur'
      }),
      initDefaultEngines: new cdk.CfnParameter(this, 'InitDefaultEngines', {
        type: 'String',
        default: 'false'
      }),
      transportTypes: new cdk.CfnParameter(this, 'TransportTypes', {
        type: 'String',
        default: '',
      })
    };

    const vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 3
    });

    const role = new iam.Role(this, 'InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    });

    const policyStatement = new iam.PolicyStatement({
      actions: ["ec2:DescribeInstances", "ec2:DescribeTags"],
      resources: ["*"],
      effect: iam.Effect.ALLOW
    });

    const policy = new iam.Policy(this, 'CustomDescribeEC2Policy', {
      statements: [policyStatement]
    });
    role.attachInlinePolicy(policy);

    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'AutoScalingGroup', {
      vpc,
      instanceType: new ec2.InstanceType(parameters.instanceType.valueAsString),
      machineImage: ec2.MachineImage.genericLinux({
        'eu-central-1': amiId
      }),
      // keyName: 'my-key-pair', // Replace with your key pair name
      desiredCapacity: 1,
      minCapacity: 1,
      maxCapacity: 4,
      role
    });

    cdk.Tags.of(autoScalingGroup).add('ApiKey', parameters.apiKey.valueAsString);
    cdk.Tags.of(autoScalingGroup).add('VehicleRegions', parameters.vehicleRegions.valueAsString);
    cdk.Tags.of(autoScalingGroup).add('InitDefaultEngines', parameters.initDefaultEngines.valueAsString);
    cdk.Tags.of(autoScalingGroup).add('TransportTypes', parameters.transportTypes.valueAsString);

    const startupScriptPath = './assets/instance-startup-script';
    const startupScript = fs.readFileSync(startupScriptPath, 'utf8');

    autoScalingGroup.addUserData(startupScript);
    

    const loadBalancer = new elbv2.NetworkLoadBalancer(this, 'NetworkLoadBalancer', {
      vpc,
      internetFacing: true
    });

    const targetGroup = new elbv2.NetworkTargetGroup(this, 'TargetGroup', {
      vpc,
      port: 80,
      targetType: elbv2.TargetType.INSTANCE
    });

    loadBalancer.addListener('Listener', {
      port: 80,
      defaultTargetGroups: [targetGroup]
    });

    targetGroup.addTarget(autoScalingGroup);

    const vpcLink = new apigateway.VpcLink(this, 'VpcLink', {
      targets: [loadBalancer],
    });

    vpcLink.node.addDependency(loadBalancer);

    const api = new apigateway.RestApi(this, 'CarmenWorkerAPI', {
      restApiName: 'CarmenWorkerApi',
      description: 'API for the self-hosted Carmen Worker.',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS
      }
    });

    // POST /{region}
    const regionResource = api.root.addResource('{region}');
    
    const integration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'POST',
      options: {
        connectionType: apigateway.ConnectionType.VPC_LINK,
        vpcLink: vpcLink,
        requestParameters: {
          'integration.request.path.region': 'method.request.path.region'
        }
      },
      uri: `http://${loadBalancer.loadBalancerDnsName}/vehicle/{region}`
    });
    
    regionResource.addMethod('POST', integration, {
      requestParameters: {
        'method.request.path.region': true
      }
    });

    // GET /countries
    const countriesResource = api.root.addResource('countries');

    const countriesIntegration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'GET',
      options: {
        connectionType: apigateway.ConnectionType.VPC_LINK,
        vpcLink: vpcLink,
      },
      uri: `http://${loadBalancer.loadBalancerDnsName}/countries`
    });

    countriesResource.addMethod('GET', countriesIntegration);

    // GET /services
    const servicesResource = api.root.addResource('services');

    const servicesIntegration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'GET',
      options: {
        connectionType: apigateway.ConnectionType.VPC_LINK,
        vpcLink: vpcLink,
      },
      uri: `http://${loadBalancer.loadBalancerDnsName}/services`
    });

    servicesResource.addMethod('GET', servicesIntegration);

  }
}
