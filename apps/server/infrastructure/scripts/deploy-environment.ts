#!/usr/bin/env node

/**
 * 환경별 배포 스크립트
 * 각 환경에 맞는 설정으로 CDK 스택을 배포합니다.
 *
 * 사용법:
 * npm run deploy:dev     - 개발 환경 배포
 * npm run deploy:test    - 테스트 환경 배포
 * npm run deploy:staging - 스테이징 환경 배포
 * npm run deploy:prod    - 프로덕션 환경 배포
 */

import * as cdk from 'aws-cdk-lib';
import { EnhancedHanbitStack } from '../lib/optimized/enhanced-hanbit-stack';
import { Environment } from '../lib/optimized/environment-config';

// 환경 변수에서 배포 환경 가져오기
const environment = (process.env.DEPLOY_ENV || 'development') as Environment;
const projectName = process.env.PROJECT_NAME || 'hanbit-todo';
const awsAccountId = process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID;
const awsRegion = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'ap-northeast-2';

// 환경별 도메인 설정
const domainConfigs: Record<Environment, string | undefined> = {
  development: undefined,
  test: 'test.hanbit-todo.com',
  staging: 'staging.hanbit-todo.com',
  production: 'api.hanbit-todo.com',
};

// 유효성 검증
const validEnvironments: Environment[] = ['development', 'test', 'staging', 'production'];
if (!validEnvironments.includes(environment)) {
  console.error(`❌ Invalid environment: ${environment}`);
  console.error(`Valid environments: ${validEnvironments.join(', ')}`);
  process.exit(1);
}

if (!awsAccountId) {
  console.error('❌ AWS Account ID not found. Set CDK_DEFAULT_ACCOUNT or AWS_ACCOUNT_ID');
  process.exit(1);
}

// 배포 전 확인 메시지
console.log('🚀 Deployment Configuration:');
console.log('================================');
console.log(`📦 Project Name: ${projectName}`);
console.log(`🌍 Environment: ${environment}`);
console.log(`🔢 AWS Account: ${awsAccountId}`);
console.log(`📍 AWS Region: ${awsRegion}`);
console.log(`🌐 Domain: ${domainConfigs[environment] || 'None'}`);
console.log('================================\n');

// 프로덕션 배포 시 추가 확인
if (environment === 'production') {
  console.warn('⚠️  WARNING: You are about to deploy to PRODUCTION!');
  console.warn('⚠️  This action will affect live users.');

  // CI/CD 환경이 아닌 경우 확인 프롬프트 (실제 구현에서는 readline 사용)
  if (!process.env.CI) {
    console.log('\n❓ Do you want to continue? (Set CI=true to skip this prompt)');
    // 실제 구현에서는 사용자 입력을 받아야 함
  }
}

// CDK 앱 생성
const app = new cdk.App();

// 스택 이름 생성
const stackName = `${projectName}-${environment}-stack`;

// 스택 생성
new EnhancedHanbitStack(app, stackName, {
  environment,
  projectName,
  domainName: domainConfigs[environment],
  env: {
    account: awsAccountId,
    region: awsRegion,
  },
  description: `${projectName} infrastructure for ${environment} environment`,
  tags: {
    DeployedBy: process.env.USER || 'unknown',
    DeploymentDate: new Date().toISOString(),
    GitCommit: process.env.GIT_COMMIT || 'unknown',
  },
});

// 배포 정보 출력
console.log('✅ Stack configuration created successfully');
console.log(`📝 Stack Name: ${stackName}`);
console.log('\n🔧 To deploy, run:');
console.log(`   cdk deploy ${stackName}`);
console.log('\n🗑️  To destroy, run:');
console.log(`   cdk destroy ${stackName}`);

// CDK 앱 합성
app.synth();
