import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createSuccessResponse, createErrorResponse } from '@/utils/response';
import { logger } from '@/utils/logger';
import { getTodoService, warmupContainer } from '@/utils/container';
import { validateJWTToken } from '@/utils/token-validator';
import { AuthError } from '@/services/todo.service';
import { Priority } from '@/types/constants';
import { ListTodosRequest } from '@/types/api.types';

// Lambda Cold Start 최적화
warmupContainer();

/**
 * GET /todos - TODO 목록 조회 (필터링 및 페이지네이션 지원)
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const timer = logger.startTimer();
  const requestId = event.requestContext.requestId;

  try {
    logger.logRequest('GET', '/todos', {
      requestId,
      queryParams: event.queryStringParameters,
    });

    // 1. 사용자 인증 확인
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Missing or invalid authorization header', { requestId });
      return createErrorResponse(new Error('Unauthorized'), 401);
    }

    const token = authHeader.substring(7);
    const authContext = await validateJWTToken(token);

    logger.info('User authenticated successfully', {
      requestId,
      userId: authContext.userId,
      userType: authContext.userType,
    });

    // 2. 쿼리 파라미터 파싱
    const queryParams = event.queryStringParameters || {};
    const listRequest: ListTodosRequest = {};

    // 상태 필터 (all, active, completed)
    if (queryParams.status && ['all', 'active', 'completed'].includes(queryParams.status)) {
      listRequest.status = queryParams.status as 'all' | 'active' | 'completed';
    }

    // 우선순위 필터
    if (
      queryParams.priority &&
      Object.values(Priority).includes(queryParams.priority as Priority)
    ) {
      listRequest.priority = queryParams.priority as Priority;
    }

    // 페이지네이션
    if (queryParams.limit) {
      const limit = parseInt(queryParams.limit, 10);
      if (!isNaN(limit) && limit > 0 && limit <= 100) {
        listRequest.limit = limit;
      }
    }

    if (queryParams.cursor) {
      listRequest.cursor = queryParams.cursor;
    }

    logger.info('Query parameters parsed', {
      requestId,
      listRequest,
    });

    // 3. TODO 서비스를 통해 목록 조회
    const todoService = getTodoService();
    const result = await todoService.listTodos(authContext, listRequest);

    // 4. 응답 데이터 변환 (DynamoDB 내부 필드 제거)
    const responseData = {
      todos: result.items.map(todo => ({
        id: todo.id,
        title: todo.title,
        completed: todo.completed,
        priority: todo.priority,
        dueDate: todo.dueDate,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
      })),
      pagination: {
        count: result.count,
        scannedCount: result.scannedCount,
        cursor: result.cursor,
        hasMore: !!result.lastEvaluatedKey,
      },
    };

    const duration = timer();
    logger.logResponse('GET', '/todos', 200, duration, {
      requestId,
      todosCount: result.count,
    });

    return createSuccessResponse(responseData);
  } catch (error) {
    const duration = timer();
    logger.error('Error listing todos', error as Error, { requestId });

    // 에러 타입별 응답 처리
    if (error instanceof AuthError) {
      logger.logResponse('GET', '/todos', 403, duration, { requestId });
      return createErrorResponse(error, 403);
    }

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      logger.logResponse('GET', '/todos', 401, duration, { requestId });
      return createErrorResponse(error, 401);
    }

    logger.logResponse('GET', '/todos', 500, duration, { requestId });
    return createErrorResponse(error as Error);
  }
};
