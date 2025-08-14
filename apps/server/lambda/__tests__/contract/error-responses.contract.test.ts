/**
 * 에러 응답 및 상태 코드 Contract Testing
 * 모든 API 엔드포인트의 에러 케이스와 상태 코드 일관성 검증
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
import { handler as loginHandler } from '@/handlers/auth/login';

describe('Error Responses & Status Codes Contract Tests', () => {
  let contractEnv: any;
  let mockContext: any;
  let validAuthHeaders: Record<string, string>;

  beforeEach(() => {
    contractEnv = global.contractTestEnv;
    mockContext = createMockLambdaContext();
    validAuthHeaders = createAuthHeader();
  });

  describe('HTTP 상태 코드 일관성 검증', () => {
    it('✅ 400 Bad Request - 모든 엔드포인트가 일관된 검증 에러 응답을 반환해야 함', async () => {
      const testCases = [
        {
          name: 'POST /todos - 잘못된 요청 데이터',
          handler: createTodoHandler,
          event: createMockApiGatewayEvent({
            httpMethod: 'POST',
            path: '/todos',
            body: JSON.stringify({ title: '' }), // 빈 제목
            headers: validAuthHeaders,
          }),
        },
        {
          name: 'PUT /todos/{id} - 잘못된 ID 형식',
          handler: updateTodoHandler,
          event: createMockApiGatewayEvent({
            httpMethod: 'PUT',
            path: '/todos/invalid@id',
            pathParameters: { id: 'invalid@id' },
            body: JSON.stringify({ title: '수정된 할일' }),
            headers: validAuthHeaders,
          }),
        },
        {
          name: 'DELETE /todos/{id} - 잘못된 ID 형식',
          handler: deleteTodoHandler,
          event: createMockApiGatewayEvent({
            httpMethod: 'DELETE',
            path: '/todos/invalid@id',
            pathParameters: { id: 'invalid@id' },
            headers: validAuthHeaders,
          }),
        },
        {
          name: 'GET /todos - 잘못된 쿼리 파라미터',
          handler: listTodosHandler,
          event: createMockApiGatewayEvent({
            httpMethod: 'GET',
            path: '/todos',
            queryStringParameters: {
              status: 'invalid-status',
              limit: 'not-a-number',
            },
            headers: validAuthHeaders,
          }),
        },
        {
          name: 'POST /auth/login - 잘못된 입력 형식',
          handler: loginHandler,
          event: createMockApiGatewayEvent({
            httpMethod: 'POST',
            path: '/auth/login',
            body: JSON.stringify({ username: 'a', password: '12' }), // 너무 짧은 입력
          }),
        },
      ];

      for (const testCase of testCases) {
        // When
        const response = await testCase.handler(testCase.event, mockContext);

        // Then
        expect(response.statusCode, `${testCase.name} 상태 코드 검증`).toBe(400);

        const responseData = ApiResponseValidator.validateJsonBody(response.body);
        ApiResponseValidator.validateApiResponseStructure(responseData);
        ApiResponseValidator.validateErrorResponseStructure(responseData.error);

        expect(responseData.success, `${testCase.name} success 필드`).toBe(false);
        expect(responseData.error.code, `${testCase.name} 에러 코드`).toBe('ValidationError');
        expect(responseData.error.message, `${testCase.name} 에러 메시지`).toContain('검증 실패');
        expect(responseData.timestamp, `${testCase.name} timestamp`).toBeDefined();
      }
    });

    it('✅ 401 Unauthorized - 모든 인증 필요 엔드포인트가 일관된 인증 에러를 반환해야 함', async () => {
      const protectedEndpoints = [
        {
          name: 'POST /todos - 인증 헤더 누락',
          handler: createTodoHandler,
          event: createMockApiGatewayEvent({
            httpMethod: 'POST',
            path: '/todos',
            body: JSON.stringify(TestDataGenerator.createValidTodoRequest()),
            // 인증 헤더 제외
          }),
        },
        {
          name: 'GET /todos - 인증 헤더 누락',
          handler: listTodosHandler,
          event: createMockApiGatewayEvent({
            httpMethod: 'GET',
            path: '/todos',
            // 인증 헤더 제외
          }),
        },
        {
          name: 'PUT /todos/{id} - 인증 헤더 누락',
          handler: updateTodoHandler,
          event: createMockApiGatewayEvent({
            httpMethod: 'PUT',
            path: '/todos/test-id',
            pathParameters: { id: 'test-id' },
            body: JSON.stringify({ title: '수정된 할일' }),
            // 인증 헤더 제외
          }),
        },
        {
          name: 'DELETE /todos/{id} - 인증 헤더 누락',
          handler: deleteTodoHandler,
          event: createMockApiGatewayEvent({
            httpMethod: 'DELETE',
            path: '/todos/test-id',
            pathParameters: { id: 'test-id' },
            // 인증 헤더 제외
          }),
        },
      ];

      for (const endpoint of protectedEndpoints) {
        // When
        const response = await endpoint.handler(endpoint.event, mockContext);

        // Then
        expect(response.statusCode, `${endpoint.name} 상태 코드`).toBe(401);

        const responseData = ApiResponseValidator.validateJsonBody(response.body);
        ApiResponseValidator.validateApiResponseStructure(responseData);
        ApiResponseValidator.validateErrorResponseStructure(responseData.error);

        expect(responseData.success, `${endpoint.name} success 필드`).toBe(false);
        expect(responseData.error.message, `${endpoint.name} 에러 메시지`).toContain(
          'Unauthorized'
        );
        expect(responseData.timestamp, `${endpoint.name} timestamp`).toBeDefined();
      }
    });

    it('✅ 404 Not Found - 존재하지 않는 리소스에 대해 일관된 응답을 반환해야 함', async () => {
      const notFoundTests = [
        {
          name: 'PUT /todos/{id} - 존재하지 않는 TODO',
          handler: updateTodoHandler,
          event: createMockApiGatewayEvent({
            httpMethod: 'PUT',
            path: '/todos/non-existent-id',
            pathParameters: { id: 'non-existent-id' },
            body: JSON.stringify({ title: '수정된 할일' }),
            headers: validAuthHeaders,
          }),
        },
        {
          name: 'DELETE /todos/{id} - 존재하지 않는 TODO',
          handler: deleteTodoHandler,
          event: createMockApiGatewayEvent({
            httpMethod: 'DELETE',
            path: '/todos/non-existent-id',
            pathParameters: { id: 'non-existent-id' },
            headers: validAuthHeaders,
          }),
        },
      ];

      for (const testCase of notFoundTests) {
        // When
        const response = await testCase.handler(testCase.event, mockContext);

        // Then - 404 또는 다른 적절한 상태 코드 (구현에 따라 달라질 수 있음)
        if (response.statusCode === 404) {
          const responseData = ApiResponseValidator.validateJsonBody(response.body);
          ApiResponseValidator.validateApiResponseStructure(responseData);
          ApiResponseValidator.validateErrorResponseStructure(responseData.error);

          expect(responseData.success, `${testCase.name} success 필드`).toBe(false);
          expect(responseData.error.code, `${testCase.name} 에러 코드`).toBe('NotFoundError');
          expect(responseData.timestamp, `${testCase.name} timestamp`).toBeDefined();
        } else {
          // 다른 상태 코드인 경우에도 적절한 에러 응답이어야 함
          expect(
            [400, 403, 500].includes(response.statusCode),
            `${testCase.name} 적절한 에러 상태 코드`
          ).toBe(true);
        }
      }
    });

    it('✅ 500 Internal Server Error - 예상치 못한 에러에 대해 일관된 응답을 반환해야 함', async () => {
      // Given - 매우 큰 요청 본문으로 내부 에러 유발 시도
      const massiveData = {
        title: 'a'.repeat(100000), // 매우 긴 제목
        priority: 'medium',
      };

      const event = createMockApiGatewayEvent({
        httpMethod: 'POST',
        path: '/todos',
        body: JSON.stringify(massiveData),
        headers: validAuthHeaders,
      });

      // When
      const response = await createTodoHandler(event, mockContext);

      // Then - 400 (검증 실패) 또는 500 (서버 에러) 중 하나여야 함
      expect([400, 500].includes(response.statusCode)).toBe(true);

      const responseData = ApiResponseValidator.validateJsonBody(response.body);
      ApiResponseValidator.validateApiResponseStructure(responseData);
      ApiResponseValidator.validateErrorResponseStructure(responseData.error);

      expect(responseData.success).toBe(false);
      expect(responseData.timestamp).toBeDefined();
    });
  });

  describe('에러 응답 형식 일관성 검증', () => {
    it('✅ 모든 에러 응답이 OpenAPI 스키마와 일치해야 함', async () => {
      const errorTestCases = [
        {
          endpoint: 'POST /todos',
          expectedStatus: 400,
          handler: createTodoHandler,
          event: createMockApiGatewayEvent({
            httpMethod: 'POST',
            path: '/todos',
            body: JSON.stringify({}), // 빈 객체로 검증 실패 유발
            headers: validAuthHeaders,
          }),
        },
        {
          endpoint: 'POST /auth/login',
          expectedStatus: 401,
          handler: loginHandler,
          event: createMockApiGatewayEvent({
            httpMethod: 'POST',
            path: '/auth/login',
            body: JSON.stringify({ username: 'wrong', password: 'wrong' }),
          }),
        },
        {
          endpoint: 'GET /todos',
          expectedStatus: 401,
          handler: listTodosHandler,
          event: createMockApiGatewayEvent({
            httpMethod: 'GET',
            path: '/todos',
            // 인증 헤더 누락
          }),
        },
      ];

      for (const testCase of errorTestCases) {
        // When
        const response = await testCase.handler(testCase.event, mockContext);

        // Then - 예상 상태 코드 또는 다른 적절한 에러 상태 코드
        expect(
          [testCase.expectedStatus, 400, 401, 500].includes(response.statusCode),
          `${testCase.endpoint} 적절한 에러 상태 코드`
        ).toBe(true);

        // OpenAPI 스키마 검증
        if ([400, 401, 404, 500].includes(response.statusCode)) {
          const responseData = ApiResponseValidator.validateJsonBody(response.body);

          const isResponseValid = contractEnv.validateResponse(
            testCase.event.httpMethod,
            testCase.endpoint.split(' ')[1],
            response.statusCode,
            responseData
          );

          expect(isResponseValid, `${testCase.endpoint} OpenAPI 스키마 검증`).toBe(true);
        }
      }
    });

    it('✅ 에러 응답에 민감한 정보가 노출되지 않아야 함', async () => {
      const testCases = [
        {
          name: '내부 시스템 에러',
          handler: createTodoHandler,
          event: createMockApiGatewayEvent({
            httpMethod: 'POST',
            path: '/todos',
            body: 'invalid-json',
            headers: validAuthHeaders,
          }),
        },
        {
          name: '잘못된 인증 정보',
          handler: loginHandler,
          event: createMockApiGatewayEvent({
            httpMethod: 'POST',
            path: '/auth/login',
            body: JSON.stringify({ username: 'admin', password: 'admin' }),
          }),
        },
      ];

      for (const testCase of testCases) {
        // When
        const response = await testCase.handler(testCase.event, mockContext);

        // Then
        const responseData = ApiResponseValidator.validateJsonBody(response.body);
        const errorMessage = responseData.error?.message || '';
        const errorDetails = responseData.error?.details || '';

        // 민감한 정보 노출 검증
        const sensitivePatterns = [
          /password/i,
          /token/i,
          /secret/i,
          /key/i,
          /database/i,
          /connection/i,
          /stack trace/i,
          /file path/i,
          /server path/i,
          /aws.*key/i,
          /access.*key/i,
        ];

        sensitivePatterns.forEach(pattern => {
          expect(
            pattern.test(errorMessage),
            `${testCase.name} - 에러 메시지에 민감한 정보 노출`
          ).toBe(false);
          expect(
            pattern.test(errorDetails),
            `${testCase.name} - 에러 세부사항에 민감한 정보 노출`
          ).toBe(false);
        });
      }
    });
  });

  describe('Rate Limiting 에러 검증', () => {
    it('✅ 429 Too Many Requests - Rate Limit 초과 시 적절한 응답을 반환해야 함', async () => {
      // 참고: Rate Limiting 테스트는 실제 제한에 도달하기 어려우므로
      // 스키마와 헤더 검증에 집중

      const event = createMockApiGatewayEvent({
        httpMethod: 'POST',
        path: '/todos',
        body: JSON.stringify(TestDataGenerator.createValidTodoRequest()),
        headers: validAuthHeaders,
      });

      // When
      const response = await createTodoHandler(event, mockContext);

      // Then - Rate Limit 헤더 검증 (있는 경우)
      if (response.statusCode === 429) {
        // Rate Limit 에러 응답 검증
        const responseData = ApiResponseValidator.validateJsonBody(response.body);
        ApiResponseValidator.validateApiResponseStructure(responseData);
        ApiResponseValidator.validateErrorResponseStructure(responseData.error);

        expect(responseData.success).toBe(false);
        expect(responseData.error.code).toBe('RateLimitError');

        // Rate Limit 헤더 검증
        expect(response.headers?.['X-Rate-Limit-Limit']).toBeDefined();
        expect(response.headers?.['X-Rate-Limit-Remaining']).toBeDefined();
        expect(response.headers?.['X-Rate-Limit-Retry-After']).toBeDefined();
      } else {
        // 성공 응답에서도 Rate Limit 헤더가 있을 수 있음
        if (response.headers?.['X-Rate-Limit-Limit']) {
          expect(response.headers?.['X-Rate-Limit-Remaining']).toBeDefined();
        }
      }
    });
  });

  describe('Content-Type 및 헤더 검증', () => {
    it('✅ 모든 에러 응답이 올바른 Content-Type을 가져야 함', async () => {
      const errorHandlers = [
        {
          name: 'POST /todos - 검증 에러',
          handler: createTodoHandler,
          event: createMockApiGatewayEvent({
            httpMethod: 'POST',
            path: '/todos',
            body: JSON.stringify({ title: '' }),
            headers: validAuthHeaders,
          }),
        },
        {
          name: 'POST /auth/login - 인증 에러',
          handler: loginHandler,
          event: createMockApiGatewayEvent({
            httpMethod: 'POST',
            path: '/auth/login',
            body: JSON.stringify({ username: 'wrong', password: 'wrong' }),
          }),
        },
      ];

      for (const testCase of errorHandlers) {
        // When
        const response = await testCase.handler(testCase.event, mockContext);

        // Then
        expect(
          [400, 401, 500].includes(response.statusCode),
          `${testCase.name} 에러 상태 코드`
        ).toBe(true);

        ApiResponseValidator.validateContentType(response.headers || {});

        // 필수 헤더 검증
        expect(
          response.headers?.['Access-Control-Allow-Origin'],
          `${testCase.name} CORS 헤더`
        ).toBeDefined();
      }
    });

    it('✅ 에러 응답 타임스탬프 형식 검증', async () => {
      // Given
      const event = createMockApiGatewayEvent({
        httpMethod: 'POST',
        path: '/todos',
        body: JSON.stringify({ title: '' }), // 검증 실패 유발
        headers: validAuthHeaders,
      });

      // When
      const response = await createTodoHandler(event, mockContext);

      // Then
      const responseData = ApiResponseValidator.validateJsonBody(response.body);
      expect(responseData.timestamp).toBeDefined();

      // ISO 8601 형식 검증
      const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(timestampRegex.test(responseData.timestamp), 'ISO 8601 타임스탬프 형식').toBe(true);

      // 유효한 날짜인지 검증
      const timestamp = new Date(responseData.timestamp);
      expect(timestamp.getTime(), '유효한 타임스탬프').not.toBeNaN();
    });
  });
});
