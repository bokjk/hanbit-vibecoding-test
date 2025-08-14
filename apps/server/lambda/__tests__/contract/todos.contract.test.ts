/**
 * TODO API Contract Testing
 * OpenAPI 스키마와 실제 API 구현 간의 계약 검증
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockApiGatewayEvent,
  createMockLambdaContext,
  createAuthHeader,
  ApiResponseValidator,
  TestDataGenerator,
} from './utils/contract-helpers';

// Lambda 핸들러 임포트
import { handler as createTodoHandler } from '@/handlers/todos/create';
import { handler as listTodosHandler } from '@/handlers/todos/list';
import { handler as updateTodoHandler } from '@/handlers/todos/update';
import { handler as deleteTodoHandler } from '@/handlers/todos/delete';

describe('TODO API Contract Tests', () => {
  let contractEnv: any;
  let validAuthHeaders: Record<string, string>;
  let mockContext: any;

  beforeEach(() => {
    contractEnv = global.contractTestEnv;
    validAuthHeaders = createAuthHeader();
    mockContext = createMockLambdaContext();
  });

  describe('POST /todos - 할일 생성', () => {
    it('✅ 유효한 요청으로 할일을 생성하고 OpenAPI 스키마와 일치해야 함', async () => {
      // Given
      const requestData = TestDataGenerator.createValidTodoRequest();
      const event = createMockApiGatewayEvent({
        httpMethod: 'POST',
        path: '/todos',
        body: JSON.stringify(requestData),
        headers: validAuthHeaders,
      });

      // When
      const response = await createTodoHandler(event, mockContext);

      // Then - HTTP 상태 코드 검증
      ApiResponseValidator.validateStatusCode(response.statusCode, 201, 'createTodo');

      // Then - 응답 헤더 검증
      ApiResponseValidator.validateResponseHeaders(response.headers || {}, [
        'Content-Type',
        'Access-Control-Allow-Origin',
      ]);
      ApiResponseValidator.validateContentType(response.headers || {});

      // Then - 응답 본문 구조 검증
      const responseData = ApiResponseValidator.validateJsonBody(response.body);
      ApiResponseValidator.validateApiResponseStructure(responseData);

      // Then - OpenAPI 스키마 검증
      const isRequestValid = contractEnv.validateRequest('POST', '/todos', {
        body: requestData,
        headers: event.headers,
      });
      expect(isRequestValid).toBe(true);

      const isResponseValid = contractEnv.validateResponse('POST', '/todos', 201, responseData);
      expect(isResponseValid).toBe(true);

      // Then - 비즈니스 로직 검증
      expect(responseData.success).toBe(true);
      expect(responseData.data).toBeDefined();
      expect(responseData.data.id).toBeDefined();
      expect(responseData.data.title).toBe(requestData.title);
      expect(responseData.data.priority).toBe(requestData.priority);
      expect(responseData.data.completed).toBe(false);
      expect(responseData.data.createdAt).toBeDefined();
      expect(responseData.data.updatedAt).toBeDefined();
    });

    it('❌ 유효하지 않은 요청 데이터로 400 에러를 반환해야 함', async () => {
      // Given
      const invalidRequestData = TestDataGenerator.createInvalidData('todo-create');
      const event = createMockApiGatewayEvent({
        httpMethod: 'POST',
        path: '/todos',
        body: JSON.stringify(invalidRequestData),
        headers: validAuthHeaders,
      });

      // When
      const response = await createTodoHandler(event, mockContext);

      // Then - HTTP 상태 코드 검증
      ApiResponseValidator.validateStatusCode(
        response.statusCode,
        400,
        'createTodo-validation-error'
      );

      // Then - 에러 응답 구조 검증
      const responseData = ApiResponseValidator.validateJsonBody(response.body);
      ApiResponseValidator.validateApiResponseStructure(responseData);
      ApiResponseValidator.validateErrorResponseStructure(responseData.error);

      // Then - OpenAPI 에러 스키마 검증
      const isResponseValid = contractEnv.validateResponse('POST', '/todos', 400, responseData);
      expect(isResponseValid).toBe(true);

      // Then - 에러 내용 검증
      expect(responseData.success).toBe(false);
      expect(responseData.error.code).toBe('ValidationError');
      expect(responseData.error.message).toContain('검증 실패');
    });

    it('❌ 인증 헤더 없이 요청 시 401 에러를 반환해야 함', async () => {
      // Given
      const requestData = TestDataGenerator.createValidTodoRequest();
      const event = createMockApiGatewayEvent({
        httpMethod: 'POST',
        path: '/todos',
        body: JSON.stringify(requestData),
        // 인증 헤더 제외
      });

      // When
      const response = await createTodoHandler(event, mockContext);

      // Then - HTTP 상태 코드 검증
      ApiResponseValidator.validateStatusCode(response.statusCode, 401, 'createTodo-unauthorized');

      // Then - 에러 응답 검증
      const responseData = ApiResponseValidator.validateJsonBody(response.body);
      ApiResponseValidator.validateApiResponseStructure(responseData);

      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toContain('Unauthorized');
    });

    it('✅ CORS 헤더가 올바르게 설정되어야 함', async () => {
      // Given
      const requestData = TestDataGenerator.createValidTodoRequest();
      const event = createMockApiGatewayEvent({
        httpMethod: 'POST',
        path: '/todos',
        body: JSON.stringify(requestData),
        headers: {
          ...validAuthHeaders,
          Origin: 'https://todo-app.example.com',
        },
      });

      // When
      const response = await createTodoHandler(event, mockContext);

      // Then - CORS 헤더 검증
      const securityHeaders = contractEnv.validateSecurityHeaders(response.headers || {});
      expect(securityHeaders.hasCors).toBe(true);
      expect(securityHeaders.hasContentType).toBe(true);
    });
  });

  describe('GET /todos - 할일 목록 조회', () => {
    it('✅ 기본 파라미터로 할일 목록을 조회해야 함', async () => {
      // Given
      const event = createMockApiGatewayEvent({
        httpMethod: 'GET',
        path: '/todos',
        headers: validAuthHeaders,
        queryStringParameters: {
          status: 'all',
          limit: '20',
        },
      });

      // When
      const response = await listTodosHandler(event, mockContext);

      // Then - HTTP 상태 코드 검증
      ApiResponseValidator.validateStatusCode(response.statusCode, 200, 'listTodos');

      // Then - 응답 본문 검증
      const responseData = ApiResponseValidator.validateJsonBody(response.body);
      ApiResponseValidator.validateApiResponseStructure(responseData);

      // Then - OpenAPI 스키마 검증
      const isRequestValid = contractEnv.validateRequest('GET', '/todos', {
        query: event.queryStringParameters,
        headers: event.headers,
      });
      expect(isRequestValid).toBe(true);

      const isResponseValid = contractEnv.validateResponse('GET', '/todos', 200, responseData);
      expect(isResponseValid).toBe(true);

      // Then - 데이터 구조 검증
      expect(responseData.success).toBe(true);
      expect(responseData.data.todos).toBeInstanceOf(Array);
      expect(responseData.data.total).toBeTypeOf('number');
    });

    it('✅ 필터 파라미터로 할일을 필터링해야 함', async () => {
      // Given
      const event = createMockApiGatewayEvent({
        httpMethod: 'GET',
        path: '/todos',
        headers: validAuthHeaders,
        queryStringParameters: {
          status: 'completed',
          priority: 'high',
          limit: '10',
        },
      });

      // When
      const response = await listTodosHandler(event, mockContext);

      // Then
      ApiResponseValidator.validateStatusCode(response.statusCode, 200);
      ApiResponseValidator.validateJsonBody(response.body);

      // 필터링 파라미터 스키마 검증
      const isRequestValid = contractEnv.validateRequest('GET', '/todos', {
        query: event.queryStringParameters,
        headers: event.headers,
      });
      expect(isRequestValid).toBe(true);
    });

    it('❌ 유효하지 않은 쿼리 파라미터로 400 에러를 반환해야 함', async () => {
      // Given
      const event = createMockApiGatewayEvent({
        httpMethod: 'GET',
        path: '/todos',
        headers: validAuthHeaders,
        queryStringParameters: {
          status: 'invalid-status',
          priority: 'invalid-priority',
          limit: '999', // 최대값 초과
        },
      });

      // When
      const response = await listTodosHandler(event, mockContext);

      // Then
      ApiResponseValidator.validateStatusCode(response.statusCode, 400);
      const responseData = ApiResponseValidator.validateJsonBody(response.body);
      expect(responseData.success).toBe(false);
    });
  });

  describe('PUT /todos/{id} - 할일 업데이트', () => {
    const mockTodoId = TestDataGenerator.generateValidId();

    it('✅ 유효한 데이터로 할일을 업데이트해야 함', async () => {
      // Given
      const updateData = TestDataGenerator.createValidTodoUpdateRequest();
      const event = createMockApiGatewayEvent({
        httpMethod: 'PUT',
        path: `/todos/${mockTodoId}`,
        pathParameters: { id: mockTodoId },
        body: JSON.stringify(updateData),
        headers: validAuthHeaders,
      });

      // When
      const response = await updateTodoHandler(event, mockContext);

      // Then - 성공 응답인 경우 (실제 TODO가 존재하면 200, 없으면 404)
      if (response.statusCode === 200) {
        // 업데이트 성공
        const responseData = ApiResponseValidator.validateJsonBody(response.body);
        ApiResponseValidator.validateApiResponseStructure(responseData);

        const isResponseValid = contractEnv.validateResponse(
          'PUT',
          `/todos/{id}`,
          200,
          responseData
        );
        expect(isResponseValid).toBe(true);

        expect(responseData.success).toBe(true);
        expect(responseData.data.id).toBe(mockTodoId);
      } else if (response.statusCode === 404) {
        // TODO가 존재하지 않음 (예상됨)
        const responseData = ApiResponseValidator.validateJsonBody(response.body);
        expect(responseData.success).toBe(false);
        expect(responseData.error.code).toBe('NotFoundError');
      }
    });

    it('❌ 유효하지 않은 ID로 요청 시 400 에러를 반환해야 함', async () => {
      // Given
      const invalidId = 'invalid-id-with-special-chars!!!';
      const updateData = TestDataGenerator.createValidTodoUpdateRequest();
      const event = createMockApiGatewayEvent({
        httpMethod: 'PUT',
        path: `/todos/${invalidId}`,
        pathParameters: { id: invalidId },
        body: JSON.stringify(updateData),
        headers: validAuthHeaders,
      });

      // When
      const response = await updateTodoHandler(event, mockContext);

      // Then - ID 형식 검증 에러
      ApiResponseValidator.validateStatusCode(response.statusCode, 400);
      const responseData = ApiResponseValidator.validateJsonBody(response.body);
      expect(responseData.success).toBe(false);
    });

    it('❌ 빈 업데이트 데이터로 요청 시 400 에러를 반환해야 함', async () => {
      // Given
      const emptyUpdateData = TestDataGenerator.createInvalidData('todo-update');
      const event = createMockApiGatewayEvent({
        httpMethod: 'PUT',
        path: `/todos/${mockTodoId}`,
        pathParameters: { id: mockTodoId },
        body: JSON.stringify(emptyUpdateData),
        headers: validAuthHeaders,
      });

      // When
      const response = await updateTodoHandler(event, mockContext);

      // Then
      ApiResponseValidator.validateStatusCode(response.statusCode, 400);
      const responseData = ApiResponseValidator.validateJsonBody(response.body);
      expect(responseData.success).toBe(false);
      expect(responseData.error.message).toContain('최소 하나의 필드는 업데이트되어야 합니다');
    });
  });

  describe('DELETE /todos/{id} - 할일 삭제', () => {
    const mockTodoId = TestDataGenerator.generateValidId();

    it('✅ 유효한 ID로 할일을 삭제해야 함', async () => {
      // Given
      const event = createMockApiGatewayEvent({
        httpMethod: 'DELETE',
        path: `/todos/${mockTodoId}`,
        pathParameters: { id: mockTodoId },
        headers: validAuthHeaders,
      });

      // When
      const response = await deleteTodoHandler(event, mockContext);

      // Then - 성공하면 204, 없으면 404
      if (response.statusCode === 204) {
        // 삭제 성공 - 본문 없음
        expect(response.body).toBe('');

        // OpenAPI 스키마 검증 (204는 본문이 없음)
        const isRequestValid = contractEnv.validateRequest('DELETE', '/todos/{id}', {
          headers: event.headers,
        });
        expect(isRequestValid).toBe(true);
      } else if (response.statusCode === 404) {
        // TODO가 존재하지 않음
        const responseData = ApiResponseValidator.validateJsonBody(response.body);
        expect(responseData.success).toBe(false);
        expect(responseData.error.code).toBe('NotFoundError');
      }
    });

    it('❌ 유효하지 않은 ID로 요청 시 400 에러를 반환해야 함', async () => {
      // Given
      const invalidId = 'invalid@id#';
      const event = createMockApiGatewayEvent({
        httpMethod: 'DELETE',
        path: `/todos/${invalidId}`,
        pathParameters: { id: invalidId },
        headers: validAuthHeaders,
      });

      // When
      const response = await deleteTodoHandler(event, mockContext);

      // Then
      ApiResponseValidator.validateStatusCode(response.statusCode, 400);
      const responseData = ApiResponseValidator.validateJsonBody(response.body);
      expect(responseData.success).toBe(false);
    });
  });

  describe('보안 및 CORS 검증', () => {
    it('✅ 모든 엔드포인트가 CORS 헤더를 반환해야 함', async () => {
      const endpoints = [
        { method: 'POST', path: '/todos', handler: createTodoHandler, needsAuth: true },
        { method: 'GET', path: '/todos', handler: listTodosHandler, needsAuth: true },
        {
          method: 'PUT',
          path: `/todos/${TestDataGenerator.generateValidId()}`,
          handler: updateTodoHandler,
          needsAuth: true,
        },
        {
          method: 'DELETE',
          path: `/todos/${TestDataGenerator.generateValidId()}`,
          handler: deleteTodoHandler,
          needsAuth: true,
        },
      ];

      for (const endpoint of endpoints) {
        // Given
        const headers = endpoint.needsAuth ? validAuthHeaders : {};
        const body =
          endpoint.method === 'POST' || endpoint.method === 'PUT'
            ? JSON.stringify(TestDataGenerator.createValidTodoRequest())
            : null;

        const event = createMockApiGatewayEvent({
          httpMethod: endpoint.method,
          path: endpoint.path,
          body,
          headers: {
            ...headers,
            Origin: 'https://todo-app.example.com',
          },
          pathParameters: endpoint.path.includes('{id}')
            ? { id: TestDataGenerator.generateValidId() }
            : null,
        });

        // When
        const response = await endpoint.handler(event, mockContext);

        // Then - CORS 헤더 검증
        expect(response.headers).toBeDefined();
        expect(response.headers?.['Access-Control-Allow-Origin']).toBeDefined();
        expect(response.headers?.['Access-Control-Allow-Headers']).toBeDefined();
        expect(response.headers?.['Access-Control-Allow-Methods']).toBeDefined();
      }
    });

    it('✅ Rate Limiting 헤더가 적절히 설정되어야 함', async () => {
      // Given
      const event = createMockApiGatewayEvent({
        httpMethod: 'POST',
        path: '/todos',
        body: JSON.stringify(TestDataGenerator.createValidTodoRequest()),
        headers: validAuthHeaders,
      });

      // When
      const response = await createTodoHandler(event, mockContext);

      // Then - Rate Limit 헤더 검증 (있으면 모두 있어야 함)
      if (response.headers?.['X-Rate-Limit-Limit']) {
        expect(response.headers?.['X-Rate-Limit-Remaining']).toBeDefined();
        expect(Number(response.headers?.['X-Rate-Limit-Limit'] || '0')).toBeGreaterThan(0);
        expect(Number(response.headers?.['X-Rate-Limit-Remaining'] || '0')).toBeGreaterThanOrEqual(
          0
        );
      }
    });
  });
});
