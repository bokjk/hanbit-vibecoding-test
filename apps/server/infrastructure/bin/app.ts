#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { HanbitStack } from '../lib/hanbit-stack';
import { getEnvironmentConfig } from '../config/environment';

const app = new cdk.App();

// 환경 설정 가져오기
const environmentName = app.node.tryGetContext('environment') || process.env.ENVIRONMENT || 'dev';
const config = getEnvironmentConfig(environmentName);

// CDK context에서 환경별 계정/리전 정보 가져오기
const environmentContext = app.node.tryGetContext('hanbit-todo:environments') || {};
const envContext = environmentContext[config.name] || {};

// 환경 설정
const env = {
  account: envContext.account || process.env.CDK_DEFAULT_ACCOUNT,
  region: envContext.region || config.region,
};

// 스택 이름 동적 생성
const stackName = envContext.stackName || `HanbitTodoStack-${config.stackSuffix}`;

console.log(`🚀 배포 환경: ${config.name}`);
console.log(`📦 스택 이름: ${stackName}`);
console.log(`🌏 AWS 리전: ${env.region}`);
console.log(`🏷️  태그:`, config.tags);

// 환경별 스택 생성
new HanbitStack(app, stackName, {
  env,
  description: `Hanbit TODO 앱 인프라 스택 (${config.name} 환경)`,
  tags: config.tags,
  environmentConfig: config,
});
