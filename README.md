# Carmen Worker CDK Stack

An AWS CDK stack and CloudFormation template to help you self-host Carmen Worker, the Dockerized version of our APIs.

You can either use the CloudFormation template in the `stack.yaml` file, or
use this CDK stack to build your own.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
  * Deploying with parameters: `npx cdk deploy --parameters ApiKey=...`
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
  * Save it using `npx cdk synth > stack.yaml`

## Parameters

- `ApiKey`: the API key to use to call the License Service (recognition will
  still happen locally)
- `InstanceType`: the EC2 instance type to use when creating VMs
- `VehicleRegions`: the regions to load ANPR engines for
- `InitDefaultEngines`: whether to initialize default engines
- `TransportTypes`: the code types to load OCR engines for
- `AGDesiredCapacity`: the desired capacity (number of instances) of the
  autoscaling group
- `AGMinCapacity`: the minimum capacity (number of instances) of the autoscaling
  group
- `AGMaxCapacity`: the maximum capacity (number of instances) of the autoscaling
  group

