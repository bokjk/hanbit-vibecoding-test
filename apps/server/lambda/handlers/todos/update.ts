import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import {
  AuthenticationError,
  createSuccessResponse,
  logger,
  ErrorCode,
} from '@/utils/error-handler';
import { withLambdaWrapper, LambdaHandler } from '@/utils/lambda-wrapper';
import {
  parseAndValidate,
  validatePathParams,
  UpdateTodoRequestSchema,
  IdParamSchema,
} from '@/utils/validation';
import { getTodoService, warmupContainer } from '@/utils/container';
import { validateJWTToken } from '@/utils/token-validator';

// Lambda Cold Start 최적화
warmupContainer();

/**
 * PUT /todos/{id} - TODO 아이템 업데이트
 * 표준화된 에러 처리 시스템 적용
 */
const updateTodoHandler: LambdaHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
  correlationId: string
): Promise<APIGatewayProxyResult> => {
  try {
    // 인증, 검증, 업데이트 로직을 간단히 처리
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthenticationError(
        'Missing authorization header',
        ErrorCode.MISSING_CREDENTIALS,
        {},
        correlationId
      );
    }

    const authContext = await validateJWTToken(authHeader.substring(7));
    const { id } = validatePathParams(event.pathParameters, IdParamSchema);
    const updateTodoRequest = parseAndValidate(event.body, UpdateTodoRequestSchema);

    const todoService = getTodoService();
    const updatedTodo = await todoService.updateTodo(authContext, id, updateTodoRequest);

    const responseData = {
      id: updatedTodo.id,
      title: updatedTodo.title,
      completed: updatedTodo.completed,
      priority: updatedTodo.priority,
      dueDate: updatedTodo.dueDate,
      createdAt: updatedTodo.createdAt,
      updatedAt: updatedTodo.updatedAt,
    };

    logger.info('TODO updated successfully', { correlationId, todoId: id });
    return createSuccessResponse(responseData);
  } catch (error) {
    logger.error('TODO update failed', error as Error, { correlationId });
    throw error;
  }
};

export const handler = withLambdaWrapper(updateTodoHandler);
