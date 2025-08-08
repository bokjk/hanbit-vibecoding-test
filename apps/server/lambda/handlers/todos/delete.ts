import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
} from '@/utils/response';
import { validatePathParams, IdParamSchema } from '@/utils/validation';
import { logger } from '@/utils/logger';
import { getTodoService, warmupContainer } from '@/utils/container';
import { validateJWTToken } from '@/utils/token-validator';
import { AuthError } from '@/services/todo.service';
import { ItemNotFoundError } from '@/types/database.types';

// Lambda Cold Start 최적화
warmupContainer();

/**
 * DELETE /todos/{id} - TODO 아이템 삭제
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const timer = logger.startTimer();
  const requestId = event.requestContext.requestId;

  try {
    logger.logRequest('DELETE', `/todos/{id}`, { requestId });

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

    logger.info('User authenticated and request validated', {
      requestId,
      userId: authContext.userId,
      userType: authContext.userType,
      todoId: id,
    });

    // 3. TODO 서비스를 통해 삭제
    const todoService = getTodoService();
    await todoService.deleteTodo(authContext, id);

    // 4. 성공 응답 반환
    const result = {
      message: 'TODO 아이템이 성공적으로 삭제되었습니다.',
      deletedId: id,
    };

    const duration = timer();
    logger.logResponse('DELETE', `/todos/${id}`, 200, duration, {
      requestId,
      todoId: id,
    });

    return createSuccessResponse(result);
  } catch (error) {
    const duration = timer();
    const todoId = event.pathParameters?.id || 'unknown';
    logger.error('Error deleting todo', error as Error, {
      requestId,
      todoId,
    });

    // 에러 타입별 응답 처리
    if (error instanceof ItemNotFoundError) {
      logger.logResponse('DELETE', `/todos/${todoId}`, 404, duration, { requestId });
      return createNotFoundResponse('TODO');
    }

    if (error instanceof AuthError) {
      logger.logResponse('DELETE', `/todos/${todoId}`, 403, duration, { requestId });
      return createErrorResponse(error, 403);
    }

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      logger.logResponse('DELETE', `/todos/${todoId}`, 401, duration, { requestId });
      return createErrorResponse(error, 401);
    }

    if (error instanceof Error && error.message.includes('Access denied')) {
      logger.logResponse('DELETE', `/todos/${todoId}`, 403, duration, { requestId });
      return createErrorResponse(error, 403);
    }

    logger.logResponse('DELETE', `/todos/${todoId}`, 500, duration, { requestId });
    return createErrorResponse(error as Error);
  }
};
