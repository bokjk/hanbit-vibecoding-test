import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createSuccessResponse, createErrorResponse } from '@/utils/response';
import { validateQueryParams, ListTodosRequestSchema } from '@/utils/validation';
import { logger } from '@/utils/logger';

/**
 * GET /todos - TODO 목록 조회
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const timer = logger.startTimer();
  const requestId = event.requestContext.requestId;

  try {
    logger.logRequest('GET', '/todos', { requestId });

    // 쿼리 파라미터 검증
    const listTodosRequest = validateQueryParams(
      event.queryStringParameters,
      ListTodosRequestSchema
    );

    // TODO: 비즈니스 로직 구현
    // 1. 사용자 인증 확인
    // 2. 필터링 조건에 따른 TODO 목록 조회
    // 3. 페이지네이션 처리
    // 4. 결과 반환

    const mockTodos = [
      {
        id: 'todo-1',
        title: '샘플 할일 1',
        completed: false,
        priority: 'high' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'todo-2',
        title: '샘플 할일 2',
        completed: true,
        priority: 'medium' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const filteredTodos = listTodosRequest.status === 'all' 
      ? mockTodos
      : mockTodos.filter(todo => 
          listTodosRequest.status === 'completed' ? todo.completed : !todo.completed
        );

    const result = {
      todos: filteredTodos.slice(0, listTodosRequest.limit),
      pagination: {
        limit: listTodosRequest.limit,
        hasMore: false,
        cursor: null,
      },
    };

    const duration = timer();
    logger.logResponse('GET', '/todos', 200, duration, { 
      requestId,
      totalCount: filteredTodos.length 
    });

    return createSuccessResponse(result);

  } catch (error) {
    const duration = timer();
    logger.error('Error listing todos', error as Error, { requestId });
    logger.logResponse('GET', '/todos', 500, duration, { requestId });

    return createErrorResponse(error as Error);
  }
};