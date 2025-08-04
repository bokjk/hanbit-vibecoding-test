import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createSuccessResponse, createErrorResponse, createValidationErrorResponse } from '@/utils/response';
import { parseAndValidate, CreateTodoRequestSchema } from '@/utils/validation';
import { logger } from '@/utils/logger';

/**
 * POST /todos - 새로운 TODO 아이템 생성
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const timer = logger.startTimer();
  const requestId = event.requestContext.requestId;

  try {
    logger.logRequest('POST', '/todos', { requestId });

    // 요청 본문 검증
    const createTodoRequest = parseAndValidate(
      event.body,
      CreateTodoRequestSchema
    );

    // TODO: 비즈니스 로직 구현
    // 1. 사용자 인증 확인
    // 2. TODO 서비스를 통해 아이템 생성
    // 3. 결과 반환

    const mockTodo = {
      id: 'temp-id',
      title: createTodoRequest.title,
      completed: false,
      priority: createTodoRequest.priority,
      dueDate: createTodoRequest.dueDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const duration = timer();
    logger.logResponse('POST', '/todos', 201, duration, { requestId });

    return createSuccessResponse(mockTodo, 201);

  } catch (error) {
    const duration = timer();
    logger.error('Error creating todo', error as Error, { requestId });
    logger.logResponse('POST', '/todos', 500, duration, { requestId });

    if (error instanceof Error && error.message.includes('검증 실패')) {
      return createValidationErrorResponse(error.message);
    }

    return createErrorResponse(error as Error);
  }
};