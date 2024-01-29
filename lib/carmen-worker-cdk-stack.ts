import * as fs from 'fs';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';

export class CarmenWorkerCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Define VPC
    const vpc = new ec2.Vpc(this, 'carmen-worker', {
      maxAzs: 3 // Default is all AZs in the region
    });

    const instanceType = 't4g.small';
    const amiId = 'ami-03a9ccf07696362ab';

    const autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'CarmenWorkerASG', {
      vpc,
      instanceType: new ec2.InstanceType(instanceType),
      machineImage: ec2.MachineImage.genericLinux({
        'eu-central-1': amiId
      }),
      // keyName: 'my-key-pair', // Replace with your key pair name
      desiredCapacity: 1,
      minCapacity: 1,
      maxCapacity: 4,
      // autoScalingGroupName: 'carmen-worker-auto-scaling-group'
    });

    const startupScriptPath = './assets/instance-startup-script';
    const startupScript = fs.readFileSync(startupScriptPath, 'utf8');

    autoScalingGroup.addUserData(startupScript);
  }
}
