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

    const instanceType = 't4g.small';
    const amiId = 'ami-03a9ccf07696362ab';

    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'AutoScalingGroup', {
      vpc,
      instanceType: new ec2.InstanceType(instanceType),
      machineImage: ec2.MachineImage.genericLinux({
        'eu-central-1': amiId
      }),
      // keyName: 'my-key-pair', // Replace with your key pair name
      desiredCapacity: 1,
      minCapacity: 1,
      maxCapacity: 4,
      role
    });

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

    const api = new apigateway.RestApi(this, 'CarmenWorkerAPI', {
      restApiName: 'CarmenWorkerApi',
      description: 'API for the self-hosted Carmen Worker.'
    });

    // Add /{region} resource with OPTIONS and POST
    const regionResource = api.root.addResource('{region}');
    regionResource.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,POST'"
        }
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      }
    }), {
      methodResponses: [{ statusCode: '200' }],
    });
    
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
      uri: `http://${loadBalancer.loadBalancerDnsName}/{region}`
    });
    
    regionResource.addMethod('POST', integration, {
      requestParameters: {
        'method.request.path.region': true
      }
    });

    // Add /countries resource with OPTIONS and GET
    const countriesResource = api.root.addResource('countries');
    countriesResource.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,POST'"
        }
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      }
    }), {
      methodResponses: [{ statusCode: '200' }],
    });
    // Add GET method (integration with VPC Link)
    // countriesResource.addMethod('GET', /* Integration details here */);

    // Add /services resource with OPTIONS and GET
    const servicesResource = api.root.addResource('services');
    servicesResource.addMethod('OPTIONS', new apigateway.MockIntegration({
      integrationResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
          'method.response.header.Access-Control-Allow-Origin': "'*'",
          'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,POST'"
        }
      }],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      }
    }), {
      methodResponses: [{ statusCode: '200' }],
    });
    // Add GET method (integration with VPC Link)
    // servicesResource.addMethod('GET', /* Integration details here */);

  }
}
