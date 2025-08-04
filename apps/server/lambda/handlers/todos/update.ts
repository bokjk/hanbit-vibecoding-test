import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  createValidationErrorResponse,
  createNotFoundResponse
} from '@/utils/response';
import { 
  parseAndValidate, 
  validatePathParams, 
  UpdateTodoRequestSchema,
  IdParamSchema
} from '@/utils/validation';
import { logger } from '@/utils/logger';

/**
 * PUT /todos/{id} - TODO 아이템 업데이트
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const timer = logger.startTimer();
  const requestId = event.requestContext.requestId;

  try {
    logger.logRequest('PUT', `/todos/{id}`, { requestId });

    // 경로 파라미터 검증
    const { id } = validatePathParams(
      event.pathParameters,
      IdParamSchema
    );

    // 요청 본문 검증
    const updateTodoRequest = parseAndValidate(
      event.body,
      UpdateTodoRequestSchema
    );

    // TODO: 비즈니스 로직 구현
    // 1. 사용자 인증 확인
    // 2. TODO 아이템 존재 여부 확인
    // 3. 권한 확인 (본인의 TODO인지)
    // 4. TODO 업데이트
    // 5. 결과 반환

    // 임시로 TODO가 존재하지 않는 경우 처리
    if (id === 'non-existent') {
      const duration = timer();
      logger.logResponse('PUT', `/todos/${id}`, 404, duration, { requestId });
      return createNotFoundResponse('TODO');
    }

    const updatedTodo = {
      id,
      title: updateTodoRequest.title || '기존 제목',
      completed: updateTodoRequest.completed ?? false,
      priority: updateTodoRequest.priority || 'medium' as const,
      dueDate: updateTodoRequest.dueDate,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString(),
    };

    const duration = timer();
    logger.logResponse('PUT', `/todos/${id}`, 200, duration, { 
      requestId,
      todoId: id
    });

    return createSuccessResponse(updatedTodo);

  } catch (error) {
    const duration = timer();
    const todoId = event.pathParameters?.id || 'unknown';
    logger.error('Error updating todo', error as Error, { 
      requestId,
      todoId
    });
    logger.logResponse('PUT', `/todos/${todoId}`, 500, duration, { requestId });

    if (error instanceof Error && error.message.includes('검증 실패')) {
      return createValidationErrorResponse(error.message);
    }

    return createErrorResponse(error as Error);
  }
};