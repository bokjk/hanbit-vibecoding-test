import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  createNotFoundResponse,
} from '@/utils/response';
import {
  parseAndValidate,
  validatePathParams,
  UpdateTodoRequestSchema,
  IdParamSchema,
} from '@/utils/validation';
import { logger } from '@/utils/logger';
import { getTodoService, warmupContainer } from '@/utils/container';
import { validateJWTToken } from '@/utils/token-validator';
import { AuthError } from '@/services/todo.service';
import { ItemNotFoundError } from '@/types/database.types';

// Lambda Cold Start 최적화
warmupContainer();

/**
 * PUT /todos/{id} - TODO 아이템 업데이트
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const timer = logger.startTimer();
  const requestId = event.requestContext.requestId;

  try {
    logger.logRequest('PUT', `/todos/{id}`, { requestId });

    // 1. 사용자 인증 확인
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Missing or invalid authorization header', { requestId });
      return createErrorResponse(new Error('Unauthorized'), 401);
    }

    const token = authHeader.substring(7);
    const authContext = await validateJWTToken(token);

    // 2. 경로 파라미터 검증
    const { id } = validatePathParams(event.pathParameters, IdParamSchema);

    // 3. 요청 본문 검증
    const updateTodoRequest = parseAndValidate(event.body, UpdateTodoRequestSchema);

    logger.info('User authenticated and request validated', {
      requestId,
      userId: authContext.userId,
      userType: authContext.userType,
      todoId: id,
      updates: Object.keys(updateTodoRequest),
    });

    // 4. TODO 서비스를 통해 업데이트
    const todoService = getTodoService();
    const updatedTodo = await todoService.updateTodo(authContext, id, updateTodoRequest);

    // 5. 응답 데이터 변환 (DynamoDB 내부 필드 제거)
    const responseData = {
      id: updatedTodo.id,
      title: updatedTodo.title,
      completed: updatedTodo.completed,
      priority: updatedTodo.priority,
      dueDate: updatedTodo.dueDate,
      createdAt: updatedTodo.createdAt,
      updatedAt: updatedTodo.updatedAt,
    };

    const duration = timer();
    logger.logResponse('PUT', `/todos/${id}`, 200, duration, {
      requestId,
      todoId: id,
    });

    return createSuccessResponse(responseData);
  } catch (error) {
    const duration = timer();
    const todoId = event.pathParameters?.id || 'unknown';
    logger.error('Error updating todo', error as Error, {
      requestId,
      todoId,
    });

    // 에러 타입별 응답 처리
    if (error instanceof ItemNotFoundError) {
      logger.logResponse('PUT', `/todos/${todoId}`, 404, duration, { requestId });
      return createNotFoundResponse('TODO');
    }

    if (error instanceof AuthError) {
      logger.logResponse('PUT', `/todos/${todoId}`, 403, duration, { requestId });
      return createErrorResponse(error, 403);
    }

    if (error instanceof Error && error.message.includes('검증 실패')) {
      logger.logResponse('PUT', `/todos/${todoId}`, 400, duration, { requestId });
      return createValidationErrorResponse(error.message);
    }

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      logger.logResponse('PUT', `/todos/${todoId}`, 401, duration, { requestId });
      return createErrorResponse(error, 401);
    }

    if (error instanceof Error && error.message.includes('Access denied')) {
      logger.logResponse('PUT', `/todos/${todoId}`, 403, duration, { requestId });
      return createErrorResponse(error, 403);
    }

    logger.logResponse('PUT', `/todos/${todoId}`, 500, duration, { requestId });
    return createErrorResponse(error as Error);
  }
};
