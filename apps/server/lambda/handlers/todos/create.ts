import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/utils/response';
import { parseAndValidate, CreateTodoRequestSchema } from '@/utils/validation';
import { logger } from '@/utils/logger';
import { getTodoService, warmupContainer } from '@/utils/container';
import { validateJWTToken } from '@/utils/token-validator';
import { AuthError } from '@/services/todo.service';
import { initializeXRay, addUserInfo, addAnnotation } from '@/utils/xray-tracer';

// Lambda Cold Start 최적화
warmupContainer();

// X-Ray 초기화
initializeXRay();

/**
 * POST /todos - 새로운 TODO 아이템 생성
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const timer = logger.startTimer();
  const requestId = event.requestContext.requestId;

  try {
    logger.logRequest('POST', '/todos', { requestId });

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

    // X-Ray에 사용자 정보 추가
    addUserInfo(authContext.userId, authContext.userType);
    addAnnotation('operation', 'createTodo');

    // 2. 요청 본문 검증
    const createTodoRequest = parseAndValidate(event.body, CreateTodoRequestSchema);

    logger.info('Request validation passed', {
      requestId,
      title: createTodoRequest.title,
      priority: createTodoRequest.priority,
    });

    // 3. TODO 서비스를 통해 아이템 생성
    const todoService = getTodoService();
    const createdTodo = await todoService.createTodo(authContext, createTodoRequest);

    // 4. 응답 데이터 변환 (DynamoDB 내부 필드 제거)
    const responseData = {
      id: createdTodo.id,
      title: createdTodo.title,
      completed: createdTodo.completed,
      priority: createdTodo.priority,
      dueDate: createdTodo.dueDate,
      createdAt: createdTodo.createdAt,
      updatedAt: createdTodo.updatedAt,
    };

    const duration = timer();
    logger.logResponse('POST', '/todos', 201, duration, {
      requestId,
      todoId: createdTodo.id,
    });

    return createSuccessResponse(responseData, 201);
  } catch (error) {
    const duration = timer();
    logger.error('Error creating todo', error as Error, { requestId });

    // 에러 타입별 응답 처리
    if (error instanceof AuthError) {
      logger.logResponse('POST', '/todos', 403, duration, { requestId });
      return createErrorResponse(error, 403);
    }

    if (error instanceof Error && error.message.includes('검증 실패')) {
      logger.logResponse('POST', '/todos', 400, duration, { requestId });
      return createValidationErrorResponse(error.message);
    }

    if (error instanceof Error && error.message.includes('Guest users can only create')) {
      logger.logResponse('POST', '/todos', 429, duration, { requestId });
      return createErrorResponse(error, 429);
    }

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      logger.logResponse('POST', '/todos', 401, duration, { requestId });
      return createErrorResponse(error, 401);
    }

    logger.logResponse('POST', '/todos', 500, duration, { requestId });
    return createErrorResponse(error as Error);
  }
};
