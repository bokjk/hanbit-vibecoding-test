/**
 * 서버 테스트 유틸리티 함수들
 */
import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { vi } from 'vitest';
import { Todo, Priority } from '@vive/types';

// Mock DynamoDB 클라이언트 생성
export const createMockDynamoClient = () => {
  const mockClient = {
    send: vi.fn(),
  };

  return mockClient as unknown as DynamoDBClient;
};

export const createMockDynamoDocumentClient = () => {
  const mockClient = {
    send: vi.fn(),
  };

  return mockClient as unknown as DynamoDBDocumentClient;
};

// API Gateway 이벤트 생성 헬퍼
export const createAPIGatewayEvent = (
  method: string,
  path: string,
  body: unknown | null = null,
  authorizer: unknown | null = null,
  headers: Record<string, string> = {},
  queryStringParameters: Record<string, string> | null = null
): APIGatewayProxyEvent => ({
  httpMethod: method,
  path,
  resource: path,
  body: body ? JSON.stringify(body) : null,
  headers: {
    'Content-Type': 'application/json',
    ...headers,
  },
  multiValueHeaders: {},
  queryStringParameters,
  multiValueQueryStringParameters: null,
  pathParameters: null,
  stageVariables: null,
  requestContext: {
    requestId: 'test-request-id',
    stage: 'test',
    resourceId: 'test-resource-id',
    resourcePath: path,
    httpMethod: method,
    requestTime: new Date().toISOString(),
    requestTimeEpoch: Date.now(),
    path,
    accountId: 'test-account-id',
    apiId: 'test-api-id',
    authorizer: authorizer || {
      userId: 'test-user-123',
      userType: 'authenticated',
    },
    protocol: 'HTTP/1.1',
    identity: {
      sourceIp: '127.0.0.1',
      userAgent: 'test-user-agent',
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      user: null,
      userArn: null,
    },
  },
  isBase64Encoded: false,
});

// Lambda Context 생성 헬퍼
export const createLambdaContext = (): Context => ({
  callbackWaitsForEmptyEventLoop: false,
  functionName: 'test-function',
  functionVersion: '$LATEST',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2024/01/01/[$LATEST]test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: vi.fn(),
  fail: vi.fn(),
  succeed: vi.fn(),
});

// 테스트 Todo 데이터 생성
export const createTestTodo = (overrides: Partial<Todo> = {}): Todo => ({
  id: 'test-todo-123',
  title: 'Test Todo',
  priority: 'medium',
  completed: false,
  userId: 'test-user-123',
  isGuest: false,
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
  ...overrides,
});

export const createTestTodos = (count: number, userId: string = 'test-user-123'): Todo[] => {
  return Array.from({ length: count }, (_, index) =>
    createTestTodo({
      id: `test-todo-${index}`,
      title: `Test Todo ${index + 1}`,
      priority: (['high', 'medium', 'low'] as Priority[])[index % 3],
      completed: index % 2 === 0,
      userId,
    })
  );
};

// DynamoDB 응답 모킹 헬퍼
export const mockDynamoResponse = <T>(data: T) => ({
  $metadata: {
    httpStatusCode: 200,
    requestId: 'test-request-id',
  },
  ...data,
});

export const mockDynamoError = (code: string, message: string) => {
  const error = new Error(message) as Error & { name: string; __type: string };
  error.name = code;
  error.__type = code;
  return error;
};

// API 응답 검증 헬퍼
export const expectSuccessResponse = (
  response: APIGatewayProxyResult,
  expectedStatusCode: number = 200
) => {
  expect(response.statusCode).toBe(expectedStatusCode);
  expect(response.headers).toMatchObject({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });

  const body = JSON.parse(response.body);
  expect(body.success).toBe(true);
  expect(body.data).toBeDefined();
  return body.data;
};

export const expectErrorResponse = (
  response: APIGatewayProxyResult,
  expectedStatusCode: number,
  expectedErrorCode?: string
) => {
  expect(response.statusCode).toBe(expectedStatusCode);
  expect(response.headers).toMatchObject({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });

  const body = JSON.parse(response.body);
  expect(body.success).toBe(false);
  expect(body.error).toBeDefined();
  
  if (expectedErrorCode) {
    expect(body.error.code).toBe(expectedErrorCode);
  }
  
  return body.error;
};

// JWT 토큰 모킹
export const createMockJWTPayload = (overrides: Record<string, unknown> = {}) => ({
  sub: 'test-user-123',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600, // 1시간 후 만료
  userType: 'authenticated',
  permissions: { maxItems: 1000 },
  ...overrides,
});

// 성능 테스트 헬퍼
export const measureExecutionTime = async <T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> => {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const duration = Number(end - start) / 1_000_000; // 밀리초로 변환
  
  return { result, duration };
};

// 동시성 테스트 헬퍼
export const runConcurrentTests = async <T>(
  fn: () => Promise<T>,
  count: number
): Promise<T[]> => {
  const promises = Array.from({ length: count }, () => fn());
  return Promise.all(promises);
};

// Rate Limit 테스트 헬퍼
export const createRateLimitEvent = (
  clientId: string,
  path: string,
  additionalHeaders: Record<string, string> = {}
) => {
  return createAPIGatewayEvent('POST', path, {}, null, {
    'x-forwarded-for': '192.168.1.1',
    'user-agent': 'test-client',
    'x-client-id': clientId,
    ...additionalHeaders,
  });
};

// 보안 테스트 헬퍼
export const createXSSTestPayload = () => ({
  title: '<script>alert("xss")</script>',
  description: '<img src="x" onerror="alert(1)">',
});

export const createSQLInjectionTestPayload = () => ({
  title: "'; DROP TABLE todos; --",
  description: "1' OR '1'='1",
});

// 메모리 누수 테스트 헬퍼
export const checkMemoryUsage = () => {
  const memUsage = process.memoryUsage();
  return {
    rss: memUsage.rss / 1024 / 1024, // MB
    heapTotal: memUsage.heapTotal / 1024 / 1024, // MB
    heapUsed: memUsage.heapUsed / 1024 / 1024, // MB
    external: memUsage.external / 1024 / 1024, // MB
  };
};