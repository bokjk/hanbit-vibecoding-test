import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  BusinessError,
  createSuccessResponse,
  logger,
  ErrorCode,
} from '@/utils/error-handler';
import { withLambdaWrapper, LambdaHandler } from '@/utils/lambda-wrapper';
import { parseAndValidate, CreateTodoRequestSchema } from '@/utils/validation';
import { getTodoService, warmupContainer } from '@/utils/container';
import {
  initializeLambdaContainer,
  isWarmerEvent,
  handleWarmerEvent,
  logPerformanceMetrics,
} from '@/utils/cold-start-optimizer';
import { validateJWTToken } from '@/utils/token-validator';
import { AuthError } from '@/services/todo.service';
import { RateLimiter, defaultRateLimits, extractClientIdentifier } from '@/middleware/rate-limiter';
import { withMetrics } from '@/middleware/metrics-middleware';

// X-Ray 통합
import {
  initializeXRay,
  traceAsyncWithMetrics,
  SubsystemType,
  addUserInfo,
  addAnnotation,
  generatePerformanceReport,
} from '@/utils/xray-tracer';

// X-Ray 초기화 (Lambda 콜드 스타트시)
initializeXRay();

// Lambda Cold Start 최적화 (성능 최적화) - 개선된 초기화
const containerInitPromise = initializeLambdaContainer()
  .then(metrics => {
    logger.info('Lambda container initialized', metrics);
  })
  .catch(error => {
    logger.error('Container initialization failed', error as Error);
  });

// 기존 warmup도 유지 (하위 호환성)
warmupContainer();

// 레이트 리미터 초기화
const rateLimiter = new RateLimiter();

// X-Ray를 위한 전역 어노테이션
addAnnotation('service', 'todo-api');
addAnnotation('operation_type', 'create');

/**
 * POST /todos - 새로운 TODO 아이템 생성 (X-Ray 분산 추적 적용)
 * - 전체 요청 플로우 시각화
 * - 서브시스템별 성능 모니터링
 * - 자동 병목 감지 및 에러 추적
 */
const createTodoHandler: LambdaHandler = async (
  event: APIGatewayProxyEvent,
  context: Context,
  correlationId: string
): Promise<APIGatewayProxyResult> => {
  // Warmer 이벤트 처리 (콜드 스타트 방지용)
  if (isWarmerEvent(event)) {
    return handleWarmerEvent();
  }

  // 컨테이너 초기화 완료 대기 (이미 완료된 경우 즉시 통과)
  await containerInitPromise;
  return traceAsyncWithMetrics(
    'todo-creation-lambda',
    SubsystemType.API_CALL,
    async lambdaSegment => {
      const startTime = Date.now();

      // Lambda 컨텍스트 메타데이터
      lambdaSegment?.addMetadata('lambda_context', {
        functionName: context.functionName,
        functionVersion: context.functionVersion,
        requestId: context.awsRequestId,
        correlationId,
        remainingTimeMs: context.getRemainingTimeInMillis(),
      });

      // HTTP 요청 메타데이터
      lambdaSegment?.addMetadata('http_request', {
        method: event.httpMethod,
        path: event.path,
        userAgent: event.headers['User-Agent'],
        clientIp: event.requestContext.identity?.sourceIp,
        bodySize: event.body?.length || 0,
      });

      lambdaSegment?.addAnnotation('http_method', event.httpMethod);
      lambdaSegment?.addAnnotation('endpoint', '/todos');
      lambdaSegment?.addAnnotation('lambda_function', context.functionName);
      lambdaSegment?.addAnnotation('correlation_id', correlationId);

      try {
        logger.info('Creating new TODO item', {
          correlationId,
          method: event.httpMethod,
          path: event.path,
        });

        // 0. 레이트 리미팅 검사 (인증 전에 수행) - X-Ray 추적 적용
        await traceAsyncWithMetrics(
          'rate-limit-check',
          SubsystemType.AUTHENTICATION,
          async rateLimitSegment => {
            const clientIdentifier = extractClientIdentifier(event);

            const rateLimitConfigs = [
              { name: 'global', config: defaultRateLimits.global },
              { name: 'todos', config: defaultRateLimits.todos },
            ];

            rateLimitSegment?.addAnnotation('client_identifier', clientIdentifier);
            rateLimitSegment?.addAnnotation('rate_limit_configs', rateLimitConfigs.length);

            const rateLimitResult = await rateLimiter.checkMultipleRateLimits(
              clientIdentifier,
              rateLimitConfigs
            );

            rateLimitSegment?.addAnnotation('rate_limit_allowed', rateLimitResult.allowed);
            if (rateLimitResult.failedCheck) {
              rateLimitSegment?.addAnnotation('failed_check', rateLimitResult.failedCheck);
            }

            if (!rateLimitResult.allowed) {
              logger.warn('Rate limit exceeded for TODO creation', {
                correlationId,
                clientIdentifier,
                failedCheck: rateLimitResult.failedCheck,
                endpoint: '/todos',
                method: 'POST',
              });

              rateLimitSegment?.addMetadata('rate_limit_violation', {
                clientIdentifier,
                failedCheck: rateLimitResult.failedCheck,
                retryAfter: rateLimitResult.result?.retryAfter,
                remaining: rateLimitResult.result?.remaining,
              });

              throw new RateLimitError(
                'Too many requests. Please try again later.',
                ErrorCode.RATE_LIMIT_EXCEEDED,
                {
                  retryAfter: rateLimitResult.result?.retryAfter || 60,
                  limit:
                    rateLimitConfigs.find(c => c.name === rateLimitResult.failedCheck)?.config
                      .limit || 0,
                  remaining: rateLimitResult.result?.remaining || 0,
                },
                correlationId
              );
            }
          },
          { clientIp: event.requestContext.identity?.sourceIp }
        );

        // 1. 사용자 인증 확인 - X-Ray 추적 적용
        const authContext = await traceAsyncWithMetrics(
          'authenticate-user',
          SubsystemType.AUTHENTICATION,
          async authSegment => {
            const authHeader = event.headers.Authorization || event.headers.authorization;

            authSegment?.addAnnotation('has_auth_header', !!authHeader);
            authSegment?.addAnnotation(
              'is_bearer_token',
              authHeader?.startsWith('Bearer ') || false
            );

            if (!authHeader || !authHeader.startsWith('Bearer ')) {
              authSegment?.addMetadata('auth_failure', {
                reason: 'missing_or_invalid_header',
                hasHeader: !!authHeader,
                headerPrefix: authHeader?.substring(0, 10),
              });

              logger.warn('Authentication failed - missing or invalid header', {
                correlationId,
                reason: 'missing_or_invalid_header',
                endpoint: '/todos',
                method: 'POST',
              });

              throw new AuthenticationError(
                'Missing or invalid authorization header',
                ErrorCode.MISSING_CREDENTIALS,
                { reason: 'missing_or_invalid_header' },
                correlationId
              );
            }

            const token = authHeader.substring(7);
            authSegment?.addAnnotation('token_length', token.length);

            try {
              const context = await validateJWTToken(token);

              // 인증 성공 메타데이터
              authSegment?.addAnnotation('auth_success', true);
              authSegment?.addAnnotation('user_type', context.userType);
              authSegment?.addMetadata('auth_context', {
                userId: context.userId,
                userType: context.userType,
                permissions: {
                  canCreate: context.permissions.canCreate,
                  maxItems: context.permissions.maxItems,
                },
              });

              // X-Ray에 사용자 정보 추가
              addUserInfo(context.userId, context.userType);

              return context;
            } catch (error) {
              authSegment?.addAnnotation('auth_success', false);
              authSegment?.addMetadata('auth_error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                tokenPreview: `${token.substring(0, 20)}...`,
              });

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
          },
          { hasAuthHeader: !!(event.headers.Authorization || event.headers.authorization) }
        );

        logger.info('User authenticated successfully', {
          correlationId,
          userId: authContext.userId,
          userType: authContext.userType,
          operation: 'create_todo',
        });

        // 2. 요청 본문 검증 - X-Ray 추적 적용
        const createTodoRequest = await traceAsyncWithMetrics(
          'validate-request',
          SubsystemType.VALIDATION,
          async validationSegment => {
            validationSegment?.addAnnotation('has_request_body', !!event.body);
            validationSegment?.addAnnotation('body_size', event.body?.length || 0);

            try {
              const request = parseAndValidate(event.body, CreateTodoRequestSchema);

              // 검증 성공 메타데이터
              validationSegment?.addAnnotation('validation_success', true);
              validationSegment?.addMetadata('validated_request', {
                titleLength: request.title.length,
                priority: request.priority,
                hasDueDate: !!request.dueDate,
              });

              return request;
            } catch (error) {
              validationSegment?.addAnnotation('validation_success', false);
              validationSegment?.addMetadata('validation_error', {
                error: error instanceof Error ? error.message : 'Unknown validation error',
                bodyPreview: event.body?.substring(0, 100),
              });

              logger.warn('Request validation failed', {
                correlationId,
                error: error instanceof Error ? error.message : 'Unknown validation error',
                body: event.body,
              });

              throw new ValidationError(
                'Invalid request data',
                ErrorCode.VALIDATION_ERROR,
                {
                  originalError:
                    error instanceof Error ? error.message : 'Unknown validation error',
                  body: event.body,
                },
                correlationId
              );
            }
          },
          { bodyLength: event.body?.length }
        );

        logger.debug('Request validation passed', {
          correlationId,
          operation: 'create_todo',
          title: createTodoRequest.title,
          priority: createTodoRequest.priority,
        });

        // 3. TODO 서비스를 통해 아이템 생성 - X-Ray 추적 적용
        const createdTodo = await traceAsyncWithMetrics(
          'todo-service-creation',
          SubsystemType.BUSINESS_LOGIC,
          async serviceSegment => {
            const todoService = getTodoService();

            serviceSegment?.addAnnotation('user_id', authContext.userId);
            serviceSegment?.addAnnotation('user_type', authContext.userType);
            serviceSegment?.addMetadata('creation_request', {
              title: createTodoRequest.title,
              priority: createTodoRequest.priority,
              dueDate: createTodoRequest.dueDate,
              titleLength: createTodoRequest.title.length,
            });

            try {
              const todo = await todoService.createTodo(authContext, createTodoRequest);

              serviceSegment?.addAnnotation('creation_success', true);
              serviceSegment?.addAnnotation('created_todo_id', todo.id);
              serviceSegment?.addMetadata('created_todo', {
                id: todo.id,
                completed: todo.completed,
                priority: todo.priority,
                isGuest: todo.isGuest,
                createdAt: todo.createdAt,
              });

              return todo;
            } catch (error) {
              serviceSegment?.addAnnotation('creation_success', false);
              serviceSegment?.addMetadata('creation_error', {
                error: error instanceof Error ? error.message : 'Unknown error',
                errorType: error instanceof Error ? error.constructor.name : 'Unknown',
              });

              logger.error('Failed to create TODO item', error as Error, {
                correlationId,
                userId: authContext.userId,
                title: createTodoRequest.title,
              });

              if (error instanceof AuthError) {
                throw new AuthorizationError(
                  'Insufficient permissions to create TODO item',
                  ErrorCode.INSUFFICIENT_PERMISSIONS,
                  { originalError: (error as Error).message },
                  correlationId
                );
              }

              if (error instanceof Error && error.message.includes('Guest users can only create')) {
                throw new BusinessError(
                  error.message,
                  ErrorCode.BUSINESS_RULE_VIOLATION,
                  { userType: authContext.userType },
                  correlationId
                );
              }

              throw new BusinessError(
                'Failed to create TODO item',
                ErrorCode.INVALID_OPERATION,
                { originalError: error instanceof Error ? error.message : 'Unknown error' },
                correlationId
              );
            }
          },
          {
            operation: 'CREATE_TODO',
            userId: authContext.userId,
            titleLength: createTodoRequest.title.length,
          }
        );

        logger.info('TODO item created successfully', {
          correlationId,
          todoId: createdTodo.id,
          userId: authContext.userId,
          priority: createTodoRequest.priority || 'medium',
          titleLength: createTodoRequest.title.length,
        });

        // 4. 응답 데이터 변환 - X-Ray 추적 적용
        const responseData = await traceAsyncWithMetrics(
          'prepare-response',
          SubsystemType.SERIALIZATION,
          async responseSegment => {
            const data = {
              id: createdTodo.id,
              title: createdTodo.title,
              completed: createdTodo.completed,
              priority: createdTodo.priority,
              dueDate: createdTodo.dueDate,
              createdAt: createdTodo.createdAt,
              updatedAt: createdTodo.updatedAt,
            };

            responseSegment?.addAnnotation('response_fields', Object.keys(data).length);
            responseSegment?.addAnnotation('response_size', JSON.stringify(data).length);

            return data;
          },
          { todoId: createdTodo.id }
        );

        const duration = Date.now() - startTime;

        // 성능 리포트 생성 및 추가
        const performanceReport = generatePerformanceReport();

        logger.info('TODO creation completed successfully', {
          correlationId,
          duration,
          todoId: createdTodo.id,
          success: true,
          performanceMetrics: {
            totalOperations: performanceReport.totalOperations,
            bottleneckCount: performanceReport.bottlenecks.length,
            averageDuration: performanceReport.averageDuration,
          },
        });

        // 최종 Lambda 성능 메타데이터
        lambdaSegment?.addMetadata('lambda_execution_summary', {
          totalDuration: duration,
          success: true,
          todoId: createdTodo.id,
          userType: authContext.userType,
          responseSize: JSON.stringify(responseData).length,
          performanceReport,
          remainingTime: context.getRemainingTimeInMillis(),
        });

        lambdaSegment?.addAnnotation('lambda_success', true);
        lambdaSegment?.addAnnotation('total_duration_ms', duration);
        lambdaSegment?.addAnnotation('created_todo_id', createdTodo.id);

        // 성능 메트릭 로깅 (콜드 스타트 최적화)
        logPerformanceMetrics(context.functionName, duration);

        // 보안 강화된 응답 생성
        return createSuccessResponse(responseData, 201);
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorInstance = error instanceof Error ? error : new Error(String(error));

        // X-Ray 에러 메타데이터 추가
        lambdaSegment?.addMetadata('lambda_error', {
          errorMessage: errorInstance.message,
          errorType: errorInstance.constructor.name,
          duration,
          correlationId,
          stackTrace: errorInstance.stack?.substring(0, 1000), // 스택 트레이스 축약
        });

        lambdaSegment?.addAnnotation('lambda_success', false);
        lambdaSegment?.addAnnotation('error_type', errorInstance.constructor.name);
        lambdaSegment?.addAnnotation('total_duration_ms', duration);

        // 성능 리포트 (에러 상황에서도 수집)
        const performanceReport = generatePerformanceReport();

        logger.error('TODO creation failed', errorInstance, {
          correlationId,
          duration,
          operation: 'create_todo',
          errorType: errorInstance.constructor.name,
          performanceMetrics: {
            totalOperations: performanceReport.totalOperations,
            bottleneckCount: performanceReport.bottlenecks.length,
            slowestOperations: performanceReport.slowestOperations.map(op => ({
              operation: op.operation,
              duration: op.duration,
              subsystem: op.subsystem,
            })),
          },
        });

        // 에러를 다시 던져서 wrapper에서 처리하도록 함
        throw error;
      }
    },
    {
      operation: 'TODO_CREATION_LAMBDA',
      method: event.httpMethod,
      path: event.path,
      functionName: context.functionName,
      correlationId,
    }
  );
};

// 메트릭 미들웨어와 표준화된 Lambda wrapper가 적용된 핸들러 export (X-Ray 통합)
const wrappedHandler = withLambdaWrapper(createTodoHandler);
export const handler = withMetrics(wrappedHandler, {
  operation: 'todo_create',
  collectPerformance: true,
  trackUserActivity: true,
  enableXRayIntegration: true, // X-Ray 메트릭 연동
  tags: {
    endpoint: '/todos',
    method: 'POST',
    version: 'v1',
    xrayEnabled: 'true',
  },
});
