import { App, Duration, Stack, DockerImage } from 'aws-cdk-lib';
import { Function, LayerVersion, Code, Runtime, CfnLayerVersion } from 'aws-cdk-lib/aws-lambda';
import { LambdaRestApi, LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
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
