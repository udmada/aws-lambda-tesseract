import { App, Duration, Stack, DockerImage, CfnOutput } from 'aws-cdk-lib';
import { ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { Function, LayerVersion, Code, Runtime } from 'aws-cdk-lib/aws-lambda';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway';
import { GithubActionsIdentityProvider, GithubActionsRole } from 'aws-cdk-github-oidc';
import * as path from 'path';

const app = new App();
const stack = new Stack(app, 'tesseract-ocr-cdk-py38');

/**
 * Artifacts for AL 2
 */
const al2Layer = new LayerVersion(stack, 'al2-layer', {
    code: Code.fromAsset(path.resolve(__dirname, 'lamda-tesseract-layer')),
    description: 'AL2 Tesseract Layer',
});

// const al2LayerFromBuild = new LayerVersion(stack, 'al2-layer-from-build', {
//     code: Code.fromAsset(path.resolve(__dirname), {
//         bundling: {
//             image: DockerImage.fromBuild(path.resolve(__dirname)),
//             command: ['/bin/bash', '-c', 'cp -r /opt/build-dist/. /asset-output/'],
//         },
//     }),
//     description: 'AL2 Tesseract Layer From Build',
// });
// stack.renameLogicalId(stack.getLogicalId(al2LayerFromBuild.node.defaultChild as CfnLayerVersion), 'al2layerfrombuild')

const ocrFn = new Function(stack, 'python3.8', {
    code: Code.fromAsset(path.resolve(__dirname, 'lambda-handlers'),
        {
            bundling: {
                image: DockerImage.fromRegistry('public.ecr.aws/sam/build-python3.8:latest'),
                command: ['/bin/bash', '-c', [
                    'pip install -r requirements.txt -t /asset-output/',
                    'cp handler.py /asset-output',
                ].join(' && ')],
            }
        }),
    runtime: Runtime.PYTHON_3_8,
    layers: [al2Layer],
    memorySize: 512,
    timeout: Duration.seconds(30),
    handler: 'handler.main',
});

const api = new LambdaRestApi(stack, 'ocr-api', {
    handler: ocrFn,
    proxy: false
});

const ocr = api.root.addResource('ocr');
ocr.addMethod('POST');

new CfnOutput(stack, "ApiEndpoint", {
    value: api.url,
});

const provider = new GithubActionsIdentityProvider(stack, 'GithubProvider');

const deployRole = new GithubActionsRole(stack, 'DeployRole', {
    provider: provider,           // reference into the OIDC provider
    owner: 'udmada',            // your repository owner (organization or user) name
    repo: 'aws-lambda-tesseract', // your repository name (without the owner name)
    roleName: 'DeployRole',
    description: 'This role deploys stuff to AWS',
    maxSessionDuration: Duration.hours(1),
});
deployRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName(
    'AdministratorAccess',
));
