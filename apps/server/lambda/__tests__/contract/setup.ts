/**
 * Contract Testing 전용 설정
 * API Contract 검증을 위한 공통 설정 및 유틸리티
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { ContractTestEnvironment } from './utils/contract-environment';
import { logger } from '@/utils/logger';

// Contract 테스트 환경 설정
const contractEnv = new ContractTestEnvironment();

// 전역 설정
beforeAll(async () => {
  logger.info('🧪 Contract Testing 환경 초기화 시작');

  // OpenAPI 스키마 로드 및 검증
  await contractEnv.initializeSchema();

  // Mock 서버 설정 (필요시)
  await contractEnv.setupMockServer();

  logger.info('✅ Contract Testing 환경 초기화 완료');
});

afterAll(async () => {
  logger.info('🧪 Contract Testing 환경 정리 시작');

  // Mock 서버 정리
  await contractEnv.teardownMockServer();

  logger.info('✅ Contract Testing 환경 정리 완료');
});

// 각 테스트 전후 설정
beforeEach(async () => {
  // 각 테스트별 환경 재설정
  await contractEnv.resetTestState();
});

afterEach(async () => {
  // 테스트 후 정리
  await contractEnv.cleanupTestState();
});

// Contract Testing 전용 환경 변수 설정
process.env.NODE_ENV = 'test';
process.env.IS_CONTRACT_TEST = 'true';
process.env.AWS_REGION = 'us-east-1';
process.env.LAMBDA_HANDLER_TIMEOUT = '30000';

// Jest/Vitest 글로벌 확장
declare global {
  // eslint-disable-next-line no-var
  var contractTestEnv: ContractTestEnvironment;
}

// 전역 변수로 노출
global.contractTestEnv = contractEnv;
