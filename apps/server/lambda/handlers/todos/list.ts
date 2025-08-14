import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  createSuccessResponse,
  logger,
  ErrorCode,
} from '@/utils/error-handler';
import { withLambdaWrapper, LambdaHandler } from '@/utils/lambda-wrapper';
import { getTodoService, warmupContainer } from '@/utils/container';
import { validateJWTToken } from '@/utils/token-validator';
import { AuthError } from '@/services/todo.service';
import { Priority } from '@/types/constants';
import { ListTodosRequest } from '@/types/api.types';

// Lambda Cold Start 최적화
warmupContainer();

/**
 * GET /todos - TODO 목록 조회 (필터링 및 페이지네이션 지원)
 * 표준화된 에러 처리 시스템 적용
 */
const listTodosHandler: LambdaHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
  correlationId: string
): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();

  try {
    logger.info('Listing TODO items', {
      correlationId,
      method: event.httpMethod,
      path: event.path,
      queryParams: event.queryStringParameters,
    });

    // 1. 사용자 인증 확인
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Authentication failed - missing or invalid header', {
        correlationId,
        reason: 'missing_or_invalid_header',
        endpoint: '/todos',
        method: 'GET',
      });

      throw new AuthenticationError(
        'Missing or invalid authorization header',
        ErrorCode.MISSING_CREDENTIALS,
        { reason: 'missing_or_invalid_header' },
        correlationId
      );
    }

    const token = authHeader.substring(7);
    let authContext;

    try {
      authContext = await validateJWTToken(token);
    } catch (error) {
      logger.warn('JWT token validation failed', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new AuthenticationError(
        'Invalid or expired token',
        ErrorCode.INVALID_TOKEN,
        { originalError: error instanceof Error ? error.message : 'Unknown error' },
        correlationId
      );
    }

    logger.info('User authenticated successfully', {
      correlationId,
      userId: authContext.userId,
      userType: authContext.userType,
      operation: 'list_todos',
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

    logger.debug('Query parameters parsed', {
      correlationId,
      listRequest,
    });

    // 3. TODO 서비스를 통해 목록 조회
    const todoService = getTodoService();
    let result;

    try {
      result = await todoService.listTodos(authContext, listRequest);
    } catch (error) {
      logger.error('Failed to list TODO items', error as Error, {
        correlationId,
        userId: authContext.userId,
        listRequest,
      });

      if (error instanceof AuthError) {
        throw new AuthorizationError(
          'Insufficient permissions to list TODO items',
          ErrorCode.INSUFFICIENT_PERMISSIONS,
          { originalError: (error as Error).message },
          correlationId
        );
      }

      throw new ValidationError(
        'Failed to retrieve TODO items',
        ErrorCode.INVALID_OPERATION,
        { originalError: error instanceof Error ? error.message : 'Unknown error' },
        correlationId
      );
    }

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

    const duration = Date.now() - startTime;
    logger.info('TODO listing completed successfully', {
      correlationId,
      duration,
      todosCount: result.count,
      success: true,
    });

    return createSuccessResponse(responseData);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorInstance = error instanceof Error ? error : new Error(String(error));

    logger.error('TODO listing failed', errorInstance, {
      correlationId,
      duration,
      operation: 'list_todos',
      errorType: errorInstance.constructor.name,
    });

    // 에러를 다시 던져서 wrapper에서 처리하도록 함
    throw error;
  }
};

// 표준화된 Lambda wrapper가 적용된 핸들러 export
export const handler = withLambdaWrapper(listTodosHandler);
