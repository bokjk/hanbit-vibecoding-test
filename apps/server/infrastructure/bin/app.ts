#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { HanbitStack } from '../lib/hanbit-stack';

const app = new cdk.App();

// 환경 설정
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'ap-northeast-2',
};

// 스택 생성
new HanbitStack(app, 'HanbitTodoStack', {
  env,
  description: 'Hanbit TODO 앱 인프라 스택',
  tags: {
    Project: 'HanbitTodo',
    Environment: process.env.NODE_ENV || 'dev',
  },
});