import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  createSuccessResponse,
  logger,
  ErrorCode,
} from '@/utils/error-handler';
import { withLambdaWrapper, LambdaHandler } from '@/utils/lambda-wrapper';
import { validatePathParams, IdParamSchema } from '@/utils/validation';
import { getTodoService, warmupContainer } from '@/utils/container';
import { validateJWTToken } from '@/utils/token-validator';
import { AuthError } from '@/services/todo.service';
import { ItemNotFoundError } from '@/types/database.types';

// Lambda Cold Start 최적화
warmupContainer();

/**
 * DELETE /todos/{id} - TODO 아이템 삭제
 * 표준화된 에러 처리 시스템 적용
 */
const deleteTodoHandler: LambdaHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
  correlationId: string
): Promise<APIGatewayProxyResult> => {
  try {
    // 인증, 검증, 삭제 로직을 간단히 처리
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing authorization header', ErrorCode.MISSING_CREDENTIALS, {}, correlationId);
    }

    const authContext = await validateJWTToken(authHeader.substring(7));
    const { id } = validatePathParams(event.pathParameters, IdParamSchema);

    const todoService = getTodoService();
    
    try {
      await todoService.deleteTodo(authContext, id);
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        throw new NotFoundError(`TODO item with id ${id} not found`, ErrorCode.TODO_NOT_FOUND, {}, correlationId);
      }
      if (error instanceof AuthError) {
        throw new AuthorizationError('Insufficient permissions', ErrorCode.INSUFFICIENT_PERMISSIONS, {}, correlationId);
      }
      throw error;
    }

    logger.info('TODO deleted successfully', { correlationId, todoId: id });
    return createSuccessResponse({ message: 'TODO deleted successfully' }, 204);
    
  } catch (error) {
    logger.error('TODO deletion failed', error as Error, { correlationId });
    throw error;
  }
};

export const handler = withLambdaWrapper(deleteTodoHandler);