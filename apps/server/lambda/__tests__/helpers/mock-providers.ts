/**
 * 테스트용 Mock 제공자
 * TDD 개발을 위한 의존성 모킹 및 스텁 생성 헬퍼들
 */

import { vi, type MockedFunction } from 'vitest';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

import { DynamoQueryResult, DynamoQueryOptions } from '@/types/database.types';
import { AuthContext, ApiResponse } from '@/types/api.types';

// ==========================================
// DynamoDB Mock 제공자
// ==========================================

export interface MockDynamoDBClientOptions {
  putItem?: {
    success?: boolean;
    error?: Error;
    response?: Record<string, unknown>;
  };
  getItem?: {
    item?: Record<string, unknown>;
    error?: Error;
  };
  queryItems?: {
    items?: Record<string, unknown>[];
    lastEvaluatedKey?: Record<string, unknown>;
    error?: Error;
  };
  updateItem?: {
    success?: boolean;
    error?: Error;
    response?: Record<string, unknown>;
  };
  deleteItem?: {
    success?: boolean;
    error?: Error;
  };
}

/**
 * DynamoDB DocumentClient Mock 생성
 */
export function createMockDynamoDBClient(
  options: MockDynamoDBClientOptions = {}
): DynamoDBDocumentClient {
  const mockClient = {
    send: vi.fn(),
  } as unknown as DynamoDBDocumentClient;

  // PutCommand 모킹
  (mockClient.send as MockedFunction<(...args: unknown[]) => unknown>).mockImplementation(
    (command: PutCommand | GetCommand | QueryCommand | UpdateCommand | DeleteCommand) => {
      if (command instanceof PutCommand) {
        if (options.putItem?.error) {
          throw options.putItem.error;
        }
        return Promise.resolve(options.putItem?.response || {});
      }

      // GetCommand 모킹
      if (command instanceof GetCommand) {
        if (options.getItem?.error) {
          throw options.getItem.error;
        }
        return Promise.resolve({
          Item: options.getItem?.item,
        });
      }

      // QueryCommand 모킹
      if (command instanceof QueryCommand) {
        if (options.queryItems?.error) {
          throw options.queryItems.error;
        }
        return Promise.resolve({
          Items: options.queryItems?.items || [],
          LastEvaluatedKey: options.queryItems?.lastEvaluatedKey,
          Count: options.queryItems?.items?.length || 0,
          ScannedCount: options.queryItems?.items?.length || 0,
        });
      }

      // UpdateCommand 모킹
      if (command instanceof UpdateCommand) {
        if (options.updateItem?.error) {
          throw options.updateItem.error;
        }
        return Promise.resolve(options.updateItem?.response || {});
      }

      // DeleteCommand 모킹
      if (command instanceof DeleteCommand) {
        if (options.deleteItem?.error) {
          throw options.deleteItem.error;
        }
        return Promise.resolve({});
      }

      return Promise.resolve({});
    }
  );

  return mockClient;
}

/**
 * 메모리 기반 DynamoDB Mock 클래스
 * 실제 데이터 저장소 역할을 하는 테스트용 MockRepository
 */
export class InMemoryDynamoDBMock {
  private items: Map<string, Record<string, unknown>> = new Map();

  clear(): void {
    this.items.clear();
  }

  put(item: Record<string, unknown>): void {
    const key = this.generateKey(item.PK, item.SK);
    this.items.set(key, { ...item });
  }

  get(pk: string, sk: string): Record<string, unknown> | undefined {
    const key = this.generateKey(pk, sk);
    return this.items.get(key);
  }

  query(
    pk: string,
    skPrefix?: string,
    options: DynamoQueryOptions = {}
  ): DynamoQueryResult<Record<string, unknown>> {
    const items = Array.from(this.items.values())
      .filter(item => {
        if (item.PK !== pk) return false;
        if (skPrefix && !item.SK.startsWith(skPrefix)) return false;
        return true;
      })
      .sort((a, b) => {
        const order = options.scanIndexForward !== false ? 1 : -1;
        return a.SK.localeCompare(b.SK) * order;
      });

    // 페이지네이션 시뮬레이션
    let startIndex = 0;
    if (options.exclusiveStartKey) {
      const startKey = this.generateKey(
        options.exclusiveStartKey.PK.S || '',
        options.exclusiveStartKey.SK.S || ''
      );
      startIndex = items.findIndex(item => this.generateKey(item.PK, item.SK) === startKey) + 1;
    }

    const limit = options.limit || items.length;
    const paginatedItems = items.slice(startIndex, startIndex + limit);

    const result: DynamoQueryResult<Record<string, unknown>> = {
      items: paginatedItems,
      count: paginatedItems.length,
      scannedCount: items.length,
    };

    // LastEvaluatedKey 설정
    if (startIndex + limit < items.length) {
      const lastItem = paginatedItems[paginatedItems.length - 1];
      result.lastEvaluatedKey = {
        PK: { S: lastItem.PK },
        SK: { S: lastItem.SK },
      };
    }

    return result;
  }

  update(pk: string, sk: string, updates: Record<string, unknown>): Record<string, unknown> {
    const key = this.generateKey(pk, sk);
    const existingItem = this.items.get(key);

    if (!existingItem) {
      throw new Error(`Item not found: ${key}`);
    }

    const updatedItem = { ...existingItem, ...updates, updatedAt: new Date().toISOString() };
    this.items.set(key, updatedItem);
    return updatedItem;
  }

  delete(pk: string, sk: string): void {
    const key = this.generateKey(pk, sk);
    this.items.delete(key);
  }

  getAllItems(): Record<string, unknown>[] {
    return Array.from(this.items.values());
  }

  private generateKey(pk: string, sk: string): string {
    return `${pk}#${sk}`;
  }
}

// ==========================================
// Repository Mock 제공자
// ==========================================

export interface MockTodoRepositoryMethods {
  create?: MockedFunction<(...args: unknown[]) => unknown>;
  findById?: MockedFunction<(...args: unknown[]) => unknown>;
  findAll?: MockedFunction<(...args: unknown[]) => unknown>;
  findByStatus?: MockedFunction<(...args: unknown[]) => unknown>;
  findByPriority?: MockedFunction<(...args: unknown[]) => unknown>;
  update?: MockedFunction<(...args: unknown[]) => unknown>;
  delete?: MockedFunction<(...args: unknown[]) => unknown>;
}

/**
 * TodoRepository Mock 생성
 */
export function createMockTodoRepository(
  customMethods: MockTodoRepositoryMethods = {}
): MockTodoRepositoryMethods {
  const defaultMethods = {
    create: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    findByStatus: vi.fn(),
    findByPriority: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  return { ...defaultMethods, ...customMethods };
}

// ==========================================
// Service Mock 제공자
// ==========================================

export interface MockTodoServiceMethods {
  createTodo?: MockedFunction<(...args: unknown[]) => unknown>;
  getTodoById?: MockedFunction<(...args: unknown[]) => unknown>;
  listTodos?: MockedFunction<(...args: unknown[]) => unknown>;
  updateTodo?: MockedFunction<(...args: unknown[]) => unknown>;
  deleteTodo?: MockedFunction<(...args: unknown[]) => unknown>;
  validatePermissions?: MockedFunction<(...args: unknown[]) => unknown>;
}

/**
 * TodoService Mock 생성
 */
export function createMockTodoService(
  customMethods: MockTodoServiceMethods = {}
): MockTodoServiceMethods {
  const defaultMethods = {
    createTodo: vi.fn(),
    getTodoById: vi.fn(),
    listTodos: vi.fn(),
    updateTodo: vi.fn(),
    deleteTodo: vi.fn(),
    validatePermissions: vi.fn(),
  };

  return { ...defaultMethods, ...customMethods };
}

// ==========================================
// 미들웨어 Mock 제공자
// ==========================================

export interface MockAuthMiddlewareOptions {
  authContext?: AuthContext;
  shouldThrow?: boolean;
  error?: Error;
}

/**
 * Auth Middleware Mock 생성
 */
export function createMockAuthMiddleware(
  options: MockAuthMiddlewareOptions = {}
): MockedFunction<(...args: unknown[]) => unknown> {
  return vi.fn().mockImplementation(() => {
    if (options.shouldThrow) {
      throw options.error || new Error('Authentication failed');
    }
    return options.authContext;
  });
}

// ==========================================
// Lambda 이벤트 Mock 제공자
// ==========================================

export interface MockAPIGatewayEventOptions {
  httpMethod?: string;
  path?: string;
  pathParameters?: Record<string, string>;
  queryStringParameters?: Record<string, string>;
  body?: string;
  headers?: Record<string, string>;
  requestContext?: Record<string, unknown>;
}

/**
 * API Gateway Event Mock 생성
 */
export function createMockAPIGatewayEvent(
  options: MockAPIGatewayEventOptions = {}
): Record<string, unknown> {
  return {
    httpMethod: options.httpMethod || 'GET',
    path: options.path || '/todos',
    pathParameters: options.pathParameters || {},
    queryStringParameters: options.queryStringParameters || {},
    body: options.body || null,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    requestContext: {
      requestId: 'test-request-id',
      stage: 'test',
      httpMethod: options.httpMethod || 'GET',
      ...options.requestContext,
    },
    isBase64Encoded: false,
    multiValueHeaders: {},
    multiValueQueryStringParameters: {},
    resource: '',
    stageVariables: {},
  };
}

// ==========================================
// 응답 검증 헬퍼
// ==========================================

/**
 * API Gateway 응답 형식 검증
 */
export function validateAPIResponse(response: Record<string, unknown>): void {
  expect(response).toHaveProperty('statusCode');
  expect(response).toHaveProperty('headers');
  expect(response).toHaveProperty('body');
  expect(typeof response.statusCode).toBe('number');
  expect(typeof response.body).toBe('string');
}

/**
 * API 응답 본문 파싱 및 검증
 */
export function parseAndValidateAPIResponse<T = unknown>(
  response: Record<string, unknown>
): ApiResponse<T> {
  validateAPIResponse(response);

  const parsedBody = JSON.parse(response.body);
  expect(parsedBody).toHaveProperty('success');
  expect(parsedBody).toHaveProperty('timestamp');
  expect(typeof parsedBody.success).toBe('boolean');
  expect(typeof parsedBody.timestamp).toBe('string');

  return parsedBody;
}

/**
 * 성공 응답 검증
 */
export function expectSuccessResponse<T = unknown>(response: Record<string, unknown>): T {
  expect(response.statusCode).toBe(200);
  const parsedBody = parseAndValidateAPIResponse<T>(response);
  expect(parsedBody.success).toBe(true);
  expect(parsedBody.data).toBeDefined();
  return parsedBody.data as T;
}

/**
 * 에러 응답 검증
 */
export function expectErrorResponse(
  response: Record<string, unknown>,
  expectedStatusCode: number
): unknown {
  expect(response.statusCode).toBe(expectedStatusCode);
  const parsedBody = parseAndValidateAPIResponse(response);
  expect(parsedBody.success).toBe(false);
  expect(parsedBody.error).toBeDefined();
  return parsedBody.error;
}

// ==========================================
// 비동기 작업 테스트 헬퍼
// ==========================================

/**
 * Promise 기반 타임아웃 테스트
 */
export function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
}

/**
 * 재시도 로직 테스트 헬퍼
 */
export function createRetryMock(
  attempts: number,
  successOnAttempt: number
): MockedFunction<(...args: unknown[]) => unknown> {
  let attemptCount = 0;

  return vi.fn().mockImplementation(() => {
    attemptCount++;
    if (attemptCount < successOnAttempt) {
      throw new Error(`Attempt ${attemptCount} failed`);
    }
    return Promise.resolve({ success: true, attempt: attemptCount });
  });
}
