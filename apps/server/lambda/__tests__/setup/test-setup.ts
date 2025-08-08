/**
 * 테스트 환경 설정
 * 모든 테스트에서 사용되는 전역 설정 및 초기화 로직
 */

import { beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';

// ==========================================
// 환경 변수 설정
// ==========================================

// 테스트 환경 변수 설정
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'us-east-1';
process.env.DYNAMODB_TABLE_NAME = 'test-todos-table';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.COGNITO_USER_POOL_ID = 'us-east-1_TestPool';
process.env.COGNITO_CLIENT_ID = 'test-client-id';

// ==========================================
// AWS SDK Mock 설정
// ==========================================

// AWS SDK를 테스트 모드로 설정
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn().mockReturnValue({
      send: vi.fn(),
    }),
  },
  PutCommand: vi.fn(),
  GetCommand: vi.fn(),
  QueryCommand: vi.fn(),
  UpdateCommand: vi.fn(),
  DeleteCommand: vi.fn(),
  marshall: vi.fn(obj => obj),
  unmarshall: vi.fn(obj => obj),
}));

// ==========================================
// 날짜/시간 Mock 설정
// ==========================================

const FIXED_DATE = new Date('2024-01-01T00:00:00.000Z');

beforeAll(() => {
  // 날짜를 고정하여 테스트 결과의 일관성 확보
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_DATE);
});

afterAll(() => {
  vi.useRealTimers();
});

// ==========================================
// 테스트 격리 설정
// ==========================================

beforeEach(() => {
  // 각 테스트 전에 모든 mock 초기화
  vi.clearAllMocks();

  // 콘솔 출력 정리 (테스트 중 불필요한 로그 방지)
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // 테스트 후 정리
  vi.restoreAllMocks();
});

// ==========================================
// 전역 테스트 유틸리티
// ==========================================

declare global {
  const testUtils: {
    getFixedDate: () => Date;
    getFixedTimestamp: () => string;
    getFixedUnixTime: () => number;
    advanceTime: (ms: number) => void;
    resetTime: () => void;
  };
}

global.testUtils = {
  getFixedDate: () => FIXED_DATE,
  getFixedTimestamp: () => FIXED_DATE.toISOString(),
  getFixedUnixTime: () => Math.floor(FIXED_DATE.getTime() / 1000),

  advanceTime: (ms: number) => {
    vi.advanceTimersByTime(ms);
  },

  resetTime: () => {
    vi.setSystemTime(FIXED_DATE);
  },
};

// ==========================================
// 테스트 데이터베이스 설정
// ==========================================

import { InMemoryDynamoDBMock } from '../helpers/mock-providers';

declare global {
  const testDB: InMemoryDynamoDBMock;
}

global.testDB = new InMemoryDynamoDBMock();

beforeEach(() => {
  // 각 테스트 전에 데이터베이스 초기화
  global.testDB.clear();
});

// ==========================================
// 에러 핸들링 설정
// ==========================================

// 처리되지 않은 Promise rejection 처리
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // 테스트 환경에서는 즉시 실패로 처리
  process.exit(1);
});

// 처리되지 않은 exception 처리
process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// ==========================================
// 커스텀 매처 설정
// ==========================================

import { expect } from 'vitest';

// DynamoDB 아이템 구조 검증 매처
expect.extend({
  toHaveDynamoDBItemStructure(received: Record<string, unknown>, entityType: string) {
    const { isNot } = this;

    const hasRequiredFields =
      received &&
      typeof received.PK === 'string' &&
      typeof received.SK === 'string' &&
      received.EntityType === entityType;

    return {
      pass: hasRequiredFields,
      message: () =>
        isNot
          ? `Expected object not to have DynamoDB ${entityType} structure`
          : `Expected object to have DynamoDB ${entityType} structure with PK, SK, and EntityType`,
    };
  },

  // API 응답 구조 검증 매처
  toHaveAPIResponseStructure(received: Record<string, unknown>) {
    const { isNot } = this;

    const hasRequiredFields =
      received && typeof received.success === 'boolean' && typeof received.timestamp === 'string';

    return {
      pass: hasRequiredFields,
      message: () =>
        isNot
          ? `Expected object not to have API response structure`
          : `Expected object to have API response structure with success and timestamp`,
    };
  },
});

// TypeScript 선언 확장
declare module 'vitest' {
  interface Assertion<T = unknown> {
    toHaveDynamoDBItemStructure(entityType: string): T;
    toHaveAPIResponseStructure(): T;
  }
}
