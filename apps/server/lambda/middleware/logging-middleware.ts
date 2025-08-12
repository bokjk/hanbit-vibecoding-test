/**
 * 로깅 미들웨어
 * Lambda 핸들러에서 자동 요청/응답 로깅 및 상관 ID 추적
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { logger, LogContext } from '../utils/logger';
import { correlationId, CorrelationUtils } from '../utils/correlation';
import { metrics } from '../utils/metrics';

/**
 * Lambda 핸들러 타입
 */
export type LambdaHandler<TEvent = APIGatewayProxyEvent, TResult = APIGatewayProxyResult> = (
  event: TEvent,
  context: Context
) => Promise<TResult>;

/**
 * 미들웨어 설정 옵션
 */
interface LoggingMiddlewareOptions {
  /** 요청 본문 로깅 여부 (기본: false) */
  logRequestBody?: boolean;
  /** 응답 본문 로깅 여부 (기본: false) */
  logResponseBody?: boolean;
  /** 민감한 헤더 필터링 목록 */
  sensitiveHeaders?: string[];
  /** 민감한 필드 필터링 목록 */
  sensitiveFields?: string[];
  /** 성능 임계값 (ms) - 초과 시 경고 로깅 */
  performanceThreshold?: number;
  /** 사용자 활동 추적 여부 (기본: true) */
  trackUserActivity?: boolean;
  /** 메트릭 기록 여부 (기본: true) */
  enableMetrics?: boolean;
}

/**
 * 기본 설정
 */
const DEFAULT_OPTIONS: Required<LoggingMiddlewareOptions> = {
  logRequestBody: false,
  logResponseBody: false,
  sensitiveHeaders: ['authorization', 'x-api-key', 'cookie', 'x-auth-token', 'x-access-token'],
  sensitiveFields: [
    'password',
    'token',
    'secret',
    'key',
    'credential',
    'auth',
    'authorization',
    'ssn',
    'creditcard',
    'cardnumber',
  ],
  performanceThreshold: 5000, // 5초
  trackUserActivity: true,
  enableMetrics: true,
};

/**
 * 로깅 미들웨어 팩토리
 */
export function withLogging<TEvent = APIGatewayProxyEvent, TResult = APIGatewayProxyResult>(
  handler: LambdaHandler<TEvent, TResult>,
  options: LoggingMiddlewareOptions = {}
): LambdaHandler<TEvent, TResult> {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return async (event: TEvent, context: Context): Promise<TResult> => {
    const startTime = Date.now();
    const functionName = context.functionName;
    const functionVersion = context.functionVersion;
    const requestId = context.awsRequestId;

    // 콜드 스타트 감지
    const isColdStart = !global.lambdaInitialized;
    if (!global.lambdaInitialized) {
      global.lambdaInitialized = true;
    }

    let correlationContext;
    let operation: string = 'unknown';
    let httpMethod: string = 'unknown';
    let httpPath: string = 'unknown';

    try {
      // 이벤트 타입에 따른 상관 ID 컨텍스트 초기화
      if (isAPIGatewayEvent(event)) {
        operation = `${event.httpMethod}_${event.path}`;
        httpMethod = event.httpMethod;
        httpPath = event.path;
        // 사용자 ID 추출 (필요시 활용 가능)
        extractUserId(event);
        correlationContext = CorrelationUtils.initializeFromAPIGateway(event, operation);
      } else if (isEventBridgeEvent(event)) {
        operation = (event as { source?: string }).source || 'eventbridge';
        correlationContext = CorrelationUtils.initializeFromEventBridge(event, operation);
      } else if (isSQSEvent(event)) {
        operation = 'sqs_processing';
        const firstRecord = (event as { Records?: unknown[] }).Records?.[0];
        if (firstRecord) {
          correlationContext = CorrelationUtils.initializeFromSQS(firstRecord, operation);
        } else {
          correlationContext = correlationId.create({ operation, requestId });
        }
      } else {
        // 기타 이벤트 타입
        correlationContext = correlationId.create({ operation, requestId });
      }

      // 요청 로깅
      const requestContext: LogContext = {
        operation,
        functionName,
        functionVersion,
        coldStart: isColdStart,
        memorySize: Number(context.memoryLimitInMB),
        remainingTime: context.getRemainingTimeInMillis(),
        tags: {
          function: functionName,
          version: functionVersion,
          operation: operation.toLowerCase(),
        },
      };

      if (isAPIGatewayEvent(event)) {
        logger.logRequest(httpMethod, httpPath, {
          ...requestContext,
          userAgent: event.headers?.['user-agent'] || event.headers?.['User-Agent'],
          sourceIp: event.requestContext?.identity?.sourceIp,
          requestBody: config.logRequestBody
            ? sanitizeData(event.body, config.sensitiveFields)
            : undefined,
          queryParameters: event.queryStringParameters,
          pathParameters: event.pathParameters,
        });
      } else {
        logger.info(`🚀 ${operation} started`, {
          ...requestContext,
          eventType: getEventType(event),
        });
      }

      // 사용자 활동 추적
      if (config.trackUserActivity && isAPIGatewayEvent(event)) {
        metrics.recordUserActivity('page_view', {
          userAgent: event.headers?.['user-agent'] || event.headers?.['User-Agent'],
          ipAddress: event.requestContext?.identity?.sourceIp,
          pageUrl: event.path,
          tags: {
            method: httpMethod.toLowerCase(),
            endpoint: httpPath,
          },
        });
      }

      // 핸들러 실행
      const result = await handler(event, context);
      const duration = Date.now() - startTime;

      // 응답 로깅
      if (isAPIGatewayResult(result)) {
        logger.logResponse(httpMethod, httpPath, result.statusCode, duration, {
          ...requestContext,
          responseBody: config.logResponseBody
            ? sanitizeData(result.body, config.sensitiveFields)
            : undefined,
          responseHeaders: sanitizeHeaders(result.headers || {}, config.sensitiveHeaders),
          duration,
          success: result.statusCode < 400,
        });
      } else {
        logger.info(`✅ ${operation} completed (${duration}ms)`, {
          ...requestContext,
          duration,
          success: true,
        });
      }

      // 성능 메트릭 기록
      if (config.enableMetrics) {
        metrics.recordPerformance(operation, duration, {
          memoryUsed: Number(context.memoryLimitInMB),
          coldStart: isColdStart,
          tags: {
            function: functionName,
            success: 'true',
          },
        });

        // 성능 임계값 초과 경고
        if (duration > config.performanceThreshold) {
          logger.warn(`🐌 Slow operation detected: ${operation} took ${duration}ms`, {
            ...requestContext,
            duration,
            threshold: config.performanceThreshold,
            tags: {
              type: 'performance_warning',
              operation: operation.toLowerCase(),
            },
          });
        }
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // 에러 로깅
      logger.error(
        `❌ ${operation} failed after ${duration}ms`,
        error instanceof Error ? error : new Error(errorMessage),
        {
          operation,
          functionName,
          functionVersion,
          duration,
          coldStart: isColdStart,
          remainingTime: context.getRemainingTimeInMillis(),
          tags: {
            function: functionName,
            version: functionVersion,
            operation: operation.toLowerCase(),
            success: 'false',
          },
        }
      );

      // 에러 메트릭 기록
      if (config.enableMetrics) {
        metrics.recordPerformance(operation, duration, {
          memoryUsed: Number(context.memoryLimitInMB),
          coldStart: isColdStart,
          tags: {
            function: functionName,
            success: 'false',
            error: 'true',
          },
        });
      }

      // API Gateway 이벤트의 경우 에러 응답 생성
      if (isAPIGatewayEvent(event)) {
        const errorResponse: APIGatewayProxyResult = {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationContext?.correlationId || 'unknown',
            'X-Request-ID': requestId,
          },
          body: JSON.stringify({
            error: 'Internal Server Error',
            message: 'An unexpected error occurred',
            correlationId: correlationContext?.correlationId,
            requestId,
          }),
        };

        logger.logResponse(httpMethod, httpPath, 500, duration, {
          operation,
          functionName,
          duration,
          success: false,
          error: errorMessage,
        });

        return errorResponse as TResult;
      }

      // 다른 이벤트 타입의 경우 에러 재발생
      throw error;
    } finally {
      // 컨텍스트 정리
      correlationId.clear();
    }
  };
}

/**
 * 유틸리티 함수들
 */

/**
 * API Gateway 이벤트 타입 가드
 */
function isAPIGatewayEvent(event: unknown): event is APIGatewayProxyEvent {
  return (
    typeof event === 'object' &&
    event !== null &&
    'httpMethod' in event &&
    'path' in event &&
    'requestContext' in event
  );
}

/**
 * API Gateway 응답 타입 가드
 */
function isAPIGatewayResult(result: unknown): result is APIGatewayProxyResult {
  return typeof result === 'object' && result !== null && 'statusCode' in result;
}

/**
 * EventBridge 이벤트 타입 가드
 */
function isEventBridgeEvent(event: unknown): boolean {
  return typeof event === 'object' && event !== null && 'source' in event && 'detail-type' in event;
}

/**
 * SQS 이벤트 타입 가드
 */
function isSQSEvent(event: unknown): boolean {
  return (
    typeof event === 'object' &&
    event !== null &&
    'Records' in event &&
    Array.isArray((event as Record<string, unknown>).Records) &&
    (event as Record<string, unknown>).Records.length > 0 &&
    'eventSource' in (event as Record<string, unknown>).Records[0] &&
    (event as Record<string, unknown>).Records[0].eventSource === 'aws:sqs'
  );
}

/**
 * 이벤트 타입 추출
 */
function getEventType(event: unknown): string {
  if (isAPIGatewayEvent(event)) return 'api-gateway';
  if (isEventBridgeEvent(event)) return 'eventbridge';
  if (isSQSEvent(event)) return 'sqs';
  return 'unknown';
}

/**
 * API Gateway 이벤트에서 사용자 ID 추출
 */
function extractUserId(event: APIGatewayProxyEvent): string | undefined {
  // JWT 토큰에서 추출하거나 인가자에서 설정된 경우
  return (
    event.requestContext.authorizer?.userId ||
    event.requestContext.authorizer?.claims?.sub ||
    event.headers?.['x-user-id'] ||
    event.headers?.['X-User-ID']
  );
}

/**
 * 민감한 데이터 필터링
 */
function sanitizeData(data: unknown, sensitiveFields: string[]): unknown {
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return '[BODY_NOT_JSON]';
    }
  }

  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sanitized = { ...data } as Record<string, unknown>;

  for (const field of sensitiveFields) {
    const regex = new RegExp(field, 'i');
    for (const key in sanitized) {
      if (regex.test(key)) {
        sanitized[key] = '[REDACTED]';
      }
    }
  }

  return sanitized;
}

/**
 * 민감한 헤더 필터링
 */
function sanitizeHeaders(
  headers: Record<string, string>,
  sensitiveHeaders: string[]
): Record<string, string> {
  const sanitized = { ...headers };

  for (const header of sensitiveHeaders) {
    const regex = new RegExp(header, 'i');
    for (const key in sanitized) {
      if (regex.test(key)) {
        sanitized[key] = '[REDACTED]';
      }
    }
  }

  return sanitized;
}

/**
 * 특정 작업을 위한 전용 미들웨어들
 */

/**
 * TODO API 전용 로깅 미들웨어
 */
export const withTodoLogging = (handler: LambdaHandler) =>
  withLogging(handler, {
    logRequestBody: true,
    logResponseBody: false,
    trackUserActivity: true,
    enableMetrics: true,
    performanceThreshold: 3000, // 3초
    sensitiveFields: ['password', 'token', 'secret'],
  });

/**
 * 인증 API 전용 로깅 미들웨어
 */
export const withAuthLogging = (handler: LambdaHandler) =>
  withLogging(handler, {
    logRequestBody: false, // 보안상 요청 본문 제외
    logResponseBody: false, // 보안상 응답 본문 제외
    trackUserActivity: true,
    enableMetrics: true,
    performanceThreshold: 2000, // 2초
    sensitiveFields: [
      'password',
      'token',
      'secret',
      'credential',
      'auth',
      'authorization',
      'refresh_token',
      'access_token',
    ],
    sensitiveHeaders: [
      'authorization',
      'x-api-key',
      'cookie',
      'x-auth-token',
      'x-access-token',
      'x-refresh-token',
    ],
  });

/**
 * 관리 API 전용 로깅 미들웨어
 */
export const withAdminLogging = (handler: LambdaHandler) =>
  withLogging(handler, {
    logRequestBody: true,
    logResponseBody: true,
    trackUserActivity: true,
    enableMetrics: true,
    performanceThreshold: 5000, // 5초
  });

// 전역 Lambda 초기화 플래그
declare global {
  let lambdaInitialized: boolean;
}
