/**
 * Contract Testing 헬퍼 함수들
 * Lambda 핸들러 테스트, API 스키마 검증 유틸리티
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';

/**
 * Mock APIGatewayProxyEvent 생성
 */
export function createMockApiGatewayEvent(options: {
  httpMethod: string;
  path: string;
  body?: string | null;
  pathParameters?: Record<string, string> | null;
  queryStringParameters?: Record<string, string> | null;
  headers?: Record<string, string>;
  requestId?: string;
}): APIGatewayProxyEvent {
  const {
    httpMethod,
    path,
    body = null,
    pathParameters = null,
    queryStringParameters = null,
    headers = {},
    requestId = `mock-request-${Date.now()}`,
  } = options;

  return {
    httpMethod,
    path,
    resource: path,
    body,
    pathParameters,
    queryStringParameters,
    multiValueQueryStringParameters: null,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'contract-test-agent',
      ...headers,
    },
    multiValueHeaders: {},
    requestContext: {
      requestId,
      accountId: 'mock-account',
      resourceId: 'mock-resource',
      stage: 'test',
      requestTimeEpoch: Date.now(),
      requestTime: new Date().toISOString(),
      httpMethod,
      path,
      protocol: 'HTTP/1.1',
      resourcePath: path,
      apiId: 'mock-api-id',
      identity: {
        cognitoIdentityPoolId: null,
        accountId: 'mock-account',
        cognitoIdentityId: null,
        caller: null,
        sourceIp: '127.0.0.1',
        principalOrgId: null,
        accessKey: null,
        cognitoAuthenticationType: null,
        cognitoAuthenticationProvider: null,
        userArn: null,
        userAgent: 'contract-test-agent',
        user: null,
        apiKey: null,
        apiKeyId: null,
        clientCert: null,
      },
      domainName: 'localhost',
      domainPrefix: 'api',
    },
    stageVariables: null,
    isBase64Encoded: false,
  };
}

/**
 * Mock Lambda Context 생성
 */
export function createMockLambdaContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'contract-test-function',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:contract-test-function',
    memoryLimitInMB: '256',
    awsRequestId: `mock-aws-request-${Date.now()}`,
    logGroupName: '/aws/lambda/contract-test-function',
    logStreamName: '2024/01/01/[$LATEST]abcdef123456',
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {},
  };
}

/**
 * JWT 토큰 모킹
 */
export function createMockJwtToken(payload: {
  userId?: string;
  userType?: string;
  exp?: number;
}): string {
  const {
    userId = 'test-user-123',
    userType = 'user',
    exp = Math.floor(Date.now() / 1000) + 3600, // 1시간 후 만료
  } = payload;

  // 실제로는 JWT를 생성하지만, 테스트용으로는 Mock 토큰 사용
  const mockPayload = {
    userId,
    userType,
    exp,
    iat: Math.floor(Date.now() / 1000),
  };

  // Base64로 인코딩된 Mock JWT (실제 서명 없음)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(mockPayload)).toString('base64url');
  const signature = 'mock-signature';

  return `${header}.${body}.${signature}`;
}

/**
 * 인증 헤더 생성
 */
export function createAuthHeader(token?: string): Record<string, string> {
  const jwtToken = token || createMockJwtToken({});
  return {
    Authorization: `Bearer ${jwtToken}`,
  };
}

/**
 * API 응답 검증 헬퍼
 */
export class ApiResponseValidator {
  /**
   * HTTP 상태 코드 검증
   */
  static validateStatusCode(
    actual: number,
    expected: number,
    operationId?: string
  ): void {
    if (actual !== expected) {
      throw new Error(
        `HTTP 상태 코드 불일치 ${operationId ? `[${operationId}]` : ''}: 예상=${expected}, 실제=${actual}`
      );
    }
  }

  /**
   * 응답 헤더 검증
   */
  static validateResponseHeaders(
    headers: Record<string, string | undefined>,
    requiredHeaders: string[] = []
  ): void {
    const headerKeys = Object.keys(headers).map(h => h.toLowerCase());
    
    requiredHeaders.forEach(requiredHeader => {
      const headerLower = requiredHeader.toLowerCase();
      if (!headerKeys.includes(headerLower)) {
        throw new Error(`필수 헤더 누락: ${requiredHeader}`);
      }
    });
  }

  /**
   * Content-Type 검증
   */
  static validateContentType(
    headers: Record<string, string | undefined>,
    expectedType: string = 'application/json'
  ): void {
    const contentType = headers['Content-Type'] || headers['content-type'];
    if (!contentType || !contentType.includes(expectedType)) {
      throw new Error(`Content-Type 불일치: 예상=${expectedType}, 실제=${contentType || 'undefined'}`);
    }
  }

  /**
   * JSON 응답 본문 검증
   */
  static validateJsonBody(body: string): unknown {
    try {
      return JSON.parse(body);
    } catch (error) {
      throw new Error(`유효하지 않은 JSON 응답: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * API 응답 구조 검증
   */
  static validateApiResponseStructure(responseData: unknown): void {
    if (typeof responseData !== 'object' || responseData === null) {
      throw new Error('응답 데이터는 객체여야 합니다');
    }

    if (!('success' in responseData)) {
      throw new Error('응답에 success 필드가 없습니다');
    }

    if (!('timestamp' in responseData)) {
      throw new Error('응답에 timestamp 필드가 없습니다');
    }

    if (responseData.success && !('data' in responseData)) {
      throw new Error('성공 응답에 data 필드가 없습니다');
    }

    if (!responseData.success && !('error' in responseData)) {
      throw new Error('에러 응답에 error 필드가 없습니다');
    }
  }

  /**
   * 에러 응답 구조 검증
   */
  static validateErrorResponseStructure(errorData: unknown): void {
    if (typeof errorData !== 'object' || errorData === null) {
      throw new Error('에러 데이터는 객체여야 합니다');
    }

    if (!('code' in errorData)) {
      throw new Error('에러 응답에 code 필드가 없습니다');
    }

    if (!('message' in errorData)) {
      throw new Error('에러 응답에 message 필드가 없습니다');
    }

    if (typeof errorData.code !== 'string') {
      throw new Error('에러 코드는 문자열이어야 합니다');
    }

    if (typeof errorData.message !== 'string') {
      throw new Error('에러 메시지는 문자열이어야 합니다');
    }
  }
}

/**
 * 테스트 데이터 생성 헬퍼
 */
export class TestDataGenerator {
  /**
   * 유효한 TODO 생성 요청 데이터
   */
  static createValidTodoRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      title: '테스트 할일',
      priority: 'medium',
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 내일
      ...overrides,
    };
  }

  /**
   * 유효한 TODO 업데이트 요청 데이터
   */
  static createValidTodoUpdateRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      title: '수정된 할일',
      completed: false,
      priority: 'high',
      ...overrides,
    };
  }

  /**
   * 유효한 로그인 요청 데이터
   */
  static createValidLoginRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      username: 'demo',
      password: 'demo123',
      ...overrides,
    };
  }

  /**
   * 유효하지 않은 데이터 생성 (검증 실패용)
   */
  static createInvalidData(type: 'todo-create' | 'todo-update' | 'login'): Record<string, unknown> {
    switch (type) {
      case 'todo-create':
        return {
          title: '', // 빈 제목 (검증 실패)
          priority: 'invalid-priority', // 잘못된 우선순위
          dueDate: 'invalid-date', // 잘못된 날짜 형식
        };
      case 'todo-update':
        return {
          // 모든 필드가 누락됨 (최소 하나 필요)
        };
      case 'login':
        return {
          username: 'a', // 너무 짧은 사용자명
          password: '123', // 너무 짧은 비밀번호
        };
      default:
        return {};
    }
  }

  /**
   * 랜덤 문자열 생성
   */
  static generateRandomString(length: number = 10): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  /**
   * 유효한 ID 생성
   */
  static generateValidId(): string {
    return `test-${this.generateRandomString(8)}`;
  }
}