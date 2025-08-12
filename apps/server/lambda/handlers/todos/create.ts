import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  createErrorResponse,
} from '@/utils/response';
import { parseAndValidate, CreateTodoRequestSchema } from '@/utils/validation';
import { logger } from '@/utils/logger';
import { getTodoService, warmupContainer } from '@/utils/container';
import { validateJWTToken } from '@/utils/token-validator';
import { AuthError } from '@/services/todo.service';
import { initializeXRay, addUserInfo, addAnnotation } from '@/utils/xray-tracer';
import { 
  RateLimiter, 
  RateLimitError, 
  defaultRateLimits, 
  extractClientIdentifier
} from '@/middleware/rate-limiter';
import { ResponseSecurity, createRateLimitErrorResponse } from '@/utils/response-security';

// Lambda Cold Start 최적화
warmupContainer();

// X-Ray 초기화
initializeXRay();

// 레이트 리미터 초기화
const rateLimiter = new RateLimiter();

/**
 * POST /todos - 새로운 TODO 아이템 생성
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const timer = logger.startTimer();
  const requestId = event.requestContext.requestId;
  const origin = event.headers.Origin || event.headers.origin;

  try {
    logger.logRequest('POST', '/todos', { requestId });

    // 0. 레이트 리미팅 검사 (인증 전에 수행)
    const clientIdentifier = extractClientIdentifier(event);
    
    const rateLimitConfigs = [
      { name: 'global', config: defaultRateLimits.global },
      { name: 'todos', config: defaultRateLimits.todos }
    ];

    const rateLimitResult = await rateLimiter.checkMultipleRateLimits(clientIdentifier, rateLimitConfigs);
    
    if (!rateLimitResult.allowed) {
      logger.warn('Rate limit exceeded', {
        clientIdentifier,
        failedCheck: rateLimitResult.failedCheck,
        requestId
      });
      
      return createRateLimitErrorResponse(
        rateLimitResult.result?.retryAfter || 60,
        rateLimitConfigs.find(c => c.name === rateLimitResult.failedCheck)?.config.limit || 0,
        rateLimitResult.result?.remaining || 0,
        origin
      );
    }

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

    // 보안 강화된 응답 생성
    return ResponseSecurity.createSecureResponse(responseData, 201, {
      origin,
      requestId,
      rateLimitResult: rateLimitResult.result
    });
  } catch (error) {
    const duration = timer();
    
    // 레이트 리미팅 에러 처리
    if (error instanceof RateLimitError) {
      logger.warn('Rate limit error in handler', {
        requestId,
        retryAfter: error.retryAfter,
        limit: error.limit
      });
      logger.logResponse('POST', '/todos', 429, duration, { requestId });
      
      return createRateLimitErrorResponse(error.retryAfter, error.limit, error.remaining, origin);
    }

    logger.error('Error creating todo', error as Error, { requestId });

    // 에러 타입별 응답 처리 (보안 응답 사용)
    if (error instanceof AuthError) {
      logger.logResponse('POST', '/todos', 403, duration, { requestId });
      return ResponseSecurity.createSecureErrorResponse(error, 403, { origin, requestId });
    }

    if (error instanceof Error && error.message.includes('검증 실패')) {
      logger.logResponse('POST', '/todos', 400, duration, { requestId });
      return ResponseSecurity.createSecureErrorResponse(error, 400, { origin, requestId });
    }

    if (error instanceof Error && error.message.includes('Guest users can only create')) {
      logger.logResponse('POST', '/todos', 429, duration, { requestId });
      return ResponseSecurity.createSecureErrorResponse(error, 429, { origin, requestId });
    }

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      logger.logResponse('POST', '/todos', 401, duration, { requestId });
      return ResponseSecurity.createSecureErrorResponse(error, 401, { origin, requestId });
    }

    logger.logResponse('POST', '/todos', 500, duration, { requestId });
    return ResponseSecurity.createSecureErrorResponse(error as Error, 500, { origin, requestId });
  }
};
