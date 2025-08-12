/**
 * 서버 테스트 글로벌 설정
 */
import { vi } from 'vitest';

// AWS SDK 모킹
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  CreateTableCommand: vi.fn(),
  DeleteTableCommand: vi.fn(),
  DescribeTableCommand: vi.fn(),
  ListTablesCommand: vi.fn(),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn().mockImplementation(() => ({
      send: vi.fn(),
    })),
  },
  PutCommand: vi.fn(),
  GetCommand: vi.fn(),
  ScanCommand: vi.fn(),
  QueryCommand: vi.fn(),
  UpdateCommand: vi.fn(),
  DeleteCommand: vi.fn(),
}));

// JWT 토큰 모킹
vi.mock('jsonwebtoken', () => ({
  sign: vi.fn(),
  verify: vi.fn(),
  decode: vi.fn(),
}));

// UUID 모킹
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid-123'),
}));

// AWS X-Ray 모킹
vi.mock('aws-xray-sdk-core', () => ({
  captureAWS: vi.fn((aws) => aws),
  captureHTTPs: vi.fn(),
  capturePromise: vi.fn(),
  getSegment: vi.fn(),
  setSegment: vi.fn(),
}));

// 환경 변수 설정
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'us-east-1';
process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
process.env.TODOS_TABLE_NAME = 'todos-test';
process.env.RATE_LIMIT_TABLE_NAME = 'rate-limits-test';
process.env.JWT_SECRET = 'test-secret-key';

// 타임존 설정
process.env.TZ = 'UTC';

// 매 테스트 전에 mock 초기화
beforeEach(() => {
  vi.clearAllMocks();
});

// 테스트 타임아웃 설정
vi.setConfig({
  testTimeout: 10000, // 10초
});