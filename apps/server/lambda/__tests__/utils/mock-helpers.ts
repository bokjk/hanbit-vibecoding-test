import { vi } from 'vitest';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

/**
 * 테스트용 Mock 헬퍼 함수들
 * Lambda 이벤트, Context, AWS 서비스 모킹을 위한 유틸리티
 */

/**
 * API Gateway 이벤트 생성
 */
export function createMockAPIGatewayEvent(
  httpMethod: string,
  path: string,
  body: unknown | null = null,
  queryStringParameters: Record<string, string> | null = null,
  pathParameters: Record<string, string> | null = null,
  headers: Record<string, string> = {},
  authorizer: unknown | null = null
): APIGatewayProxyEvent {
  return {
    httpMethod,
    path,
    resource: path,
    body: body ? JSON.stringify(body) : null,
    isBase64Encoded: false,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'test-agent',
      ...headers,
    },
    multiValueHeaders: {},
    queryStringParameters,
    multiValueQueryStringParameters: null,
    pathParameters,
    stageVariables: null,
    requestContext: {
      accountId: '123456789',
      apiId: 'test-api',
      protocol: 'HTTP/1.1',
      httpMethod,
      path,
      stage: 'test',
      requestId: 'test-request-id',
      requestTime: '01/Jan/2024:00:00:00 +0000',
      requestTimeEpoch: Date.now(),
      resourceId: 'test-resource',
      resourcePath: path,
      authorizer: authorizer || {
        userId: 'test-user-id',
        userType: 'authenticated',
        permissions: JSON.stringify({ maxItems: 1000 }),
      },
      identity: {
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
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'test-agent',
        userArn: null,
        clientCert: null,
      },
    },
  } as APIGatewayProxyEvent;
}

/**
 * Lambda Context 생성
 */
export function createMockLambdaContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'test-function',
    functionVersion: '1',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:test-function',
    memoryLimitInMB: '128',
    awsRequestId: 'test-aws-request-id',
    logGroupName: '/aws/lambda/test-function',
    logStreamName: '2024/01/01/[$LATEST]test-stream',
    getRemainingTimeInMillis: () => 30000,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
  };
}

/**
 * DynamoDB 클라이언트 모킹
 */
export function createMockDynamoClient() {
  return {
    send: vi.fn(),
    destroy: vi.fn(),
  };
}

/**
 * DynamoDB Document 클라이언트 모킹
 */
export function createMockDocumentClient() {
  return {
    query: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    scan: vi.fn(),
    batchGet: vi.fn(),
    batchWrite: vi.fn(),
    transactGet: vi.fn(),
    transactWrite: vi.fn(),
  };
}

/**
 * Logger 모킹
 */
export function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

/**
 * JWT 토큰 검증 모킹
 */
export function createMockJwtVerifier() {
  return {
    verify: vi.fn().mockResolvedValue({
      sub: 'test-user-id',
      email: 'test@example.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    }),
    decode: vi.fn().mockReturnValue({
      header: { alg: 'RS256', typ: 'JWT' },
      payload: { sub: 'test-user-id', email: 'test@example.com' },
    }),
  };
}

/**
 * Cognito 클라이언트 모킹
 */
export function createMockCognitoClient() {
  return {
    send: vi.fn().mockImplementation(async (command: { constructor: { name: string } }) => {
      if (command.constructor.name === 'GetUserCommand') {
        return {
          Username: 'test-user-id',
          UserAttributes: [
            { Name: 'email', Value: 'test@example.com' },
            { Name: 'name', Value: 'Test User' },
          ],
        };
      }
      return {};
    }),
  };
}

/**
 * Rate Limiter 모킹
 */
export function createMockRateLimiter() {
  return {
    checkLimit: vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 100,
      resetTime: Date.now() + 60000,
    }),
    incrementUsage: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * XRay 추적 모킹
 */
export function createMockXRay() {
  const mockSegment = {
    addAnnotation: vi.fn(),
    addMetadata: vi.fn(),
    setUser: vi.fn(),
    close: vi.fn(),
  };

  return {
    captureAWS: vi.fn().mockImplementation(service => service),
    getSegment: vi.fn().mockReturnValue(mockSegment),
    captureFunc: vi.fn().mockImplementation((name, fn) => fn(mockSegment)),
    captureAsyncFunc: vi.fn().mockImplementation((name, fn) => fn(mockSegment)),
  };
}

/**
 * 환경 변수 모킹
 */
export function mockEnvironmentVariables(envVars: Record<string, string>) {
  const originalEnv = process.env;
  
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = {
      ...originalEnv,
      ...envVars,
    };
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });
}

/**
 * 비동기 에러 테스트 헬퍼
 */
export async function expectAsyncError(
  fn: () => Promise<unknown>,
  expectedError?: string | RegExp
): Promise<Error> {
  try {
    await fn();
    throw new Error('Expected function to throw an error');
  } catch (error) {
    if (expectedError) {
      if (typeof expectedError === 'string') {
        expect(error).toHaveProperty('message', expectedError);
      } else {
        expect((error as Error).message).toMatch(expectedError);
      }
    }
    return error as Error;
  }
}

/**
 * 타임아웃 테스트 헬퍼
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 5000
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Test timeout')), timeoutMs)
    ),
  ]);
}

/**
 * 재시도 테스트 헬퍼
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 100
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError || new Error('Timeout occurred');
}

/**
 * 성능 측정 헬퍼
 */
export async function measurePerformance<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  const duration = Number(end - start) / 1_000_000; // Convert to milliseconds
  
  return { result, duration };
}

/**
 * 병렬 실행 테스트 헬퍼
 */
export async function runConcurrently<T>(
  fn: () => Promise<T>,
  concurrency: number = 10
): Promise<T[]> {
  const promises = Array.from({ length: concurrency }, () => fn());
  return Promise.all(promises);
}