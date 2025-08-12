import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import * as AWSXRay from 'aws-xray-sdk-core';
import { v4 as uuidv4 } from 'uuid';
import { 
  logger, 
  createErrorResponse, 
  recordErrorToXRay 
} from './error-handler';

/**
 * Lambda 핸들러 타입
 */
export type LambdaHandler = (
  event: APIGatewayProxyEvent,
  context: Context,
  correlationId: string
) => Promise<APIGatewayProxyResult>;

/**
 * 성능 메트릭 인터페이스
 */
interface PerformanceMetrics {
  correlationId: string;
  functionName: string;
  requestId: string;
  duration: number;
  memoryUsed: number;
  memoryLimit: number;
  billedDuration?: number;
  initDuration?: number;
  statusCode: number;
  success: boolean;
  userAgent?: string;
  sourceIp?: string;
  method: string;
  path: string;
  queryStringParameters?: Record<string, string>;
  pathParameters?: Record<string, string>;
}

/**
 * 요청 메트릭 수집
 */
function collectRequestMetrics(
  event: APIGatewayProxyEvent,
  context: Context,
  correlationId: string,
  startTime: number,
  response: APIGatewayProxyResult
): PerformanceMetrics {
  const endTime = Date.now();
  const duration = endTime - startTime;

  // Lambda context에서 메모리 사용량 추정
  const memoryUsed = process.memoryUsage().heapUsed / 1024 / 1024; // MB
  const memoryLimit = parseInt(context.memoryLimitInMB);

  return {
    correlationId,
    functionName: context.functionName,
    requestId: context.awsRequestId,
    duration,
    memoryUsed: Math.round(memoryUsed),
    memoryLimit,
    statusCode: response.statusCode,
    success: response.statusCode >= 200 && response.statusCode < 400,
    userAgent: event.headers['User-Agent'],
    sourceIp: event.requestContext.identity?.sourceIp,
    method: event.httpMethod,
    path: event.path,
    queryStringParameters: event.queryStringParameters || undefined,
    pathParameters: event.pathParameters || undefined,
  };
}

/**
 * CloudWatch 커스텀 메트릭 전송
 */
function publishCustomMetrics(metrics: PerformanceMetrics): void {
  try {
    // CloudWatch 커스텀 메트릭을 콘솔로 출력 (CloudWatch가 자동으로 파싱)
    console.log(
      `MONITORING|${metrics.duration}|Milliseconds|${metrics.functionName}|Duration`
    );
    console.log(
      `MONITORING|${metrics.memoryUsed}|Megabytes|${metrics.functionName}|MemoryUsed`
    );
    console.log(
      `MONITORING|${metrics.statusCode >= 400 ? 1 : 0}|Count|${metrics.functionName}|Errors`
    );
    console.log(
      `MONITORING|1|Count|${metrics.functionName}|Invocations`
    );

    // 성능 임계값 체크
    if (metrics.duration > 5000) { // 5초 이상
      console.log(
        `MONITORING|1|Count|${metrics.functionName}|SlowRequests`
      );
    }

    if (metrics.memoryUsed / metrics.memoryLimit > 0.8) { // 메모리 사용률 80% 이상
      console.log(
        `MONITORING|1|Count|${metrics.functionName}|HighMemoryUsage`
      );
    }
  } catch (error) {
    logger.warn('Failed to publish custom metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      metrics,
    });
  }
}

/**
 * 상관 ID 추출 또는 생성
 */
function extractOrGenerateCorrelationId(event: APIGatewayProxyEvent): string {
  // 헤더에서 상관 ID 추출 (대소문자 무관)
  const correlationId = 
    event.headers['X-Correlation-ID'] ||
    event.headers['x-correlation-id'] ||
    event.headers['X-CORRELATION-ID'] ||
    event.headers['correlationId'] ||
    event.headers['correlation-id'];

  return correlationId || uuidv4();
}

/**
 * 요청 본문 파싱
 */
function parseRequestBody(body: string | null): unknown {
  if (!body) return null;

  try {
    return JSON.parse(body);
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}

/**
 * 요청 로깅
 */
function logRequest(
  event: APIGatewayProxyEvent,
  context: Context,
  correlationId: string
): void {
  const sanitizedBody = event.body ? parseRequestBody(event.body) : null;
  
  // 민감한 정보 마스킹 (비밀번호, 토큰 등)
  const maskedBody = sanitizedBody ? maskSensitiveData(sanitizedBody) : null;

  logger.info('Incoming request', {
    correlationId,
    functionName: context.functionName,
    requestId: context.awsRequestId,
    method: event.httpMethod,
    path: event.path,
    queryStringParameters: event.queryStringParameters,
    pathParameters: event.pathParameters,
    headers: maskSensitiveHeaders(event.headers),
    body: maskedBody,
    sourceIp: event.requestContext.identity?.sourceIp,
    userAgent: event.headers['User-Agent'],
  });
}

/**
 * 응답 로깅
 */
function logResponse(
  response: APIGatewayProxyResult,
  correlationId: string,
  duration: number
): void {
  const responseBody = response.body ? JSON.parse(response.body) : null;
  
  logger.info('Outgoing response', {
    correlationId,
    statusCode: response.statusCode,
    duration,
    body: responseBody,
    headers: response.headers,
  });
}

/**
 * 민감한 데이터 마스킹
 */
function maskSensitiveData(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(maskSensitiveData);
  }

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'credential', 'auth'];
  const masked = { ...data as Record<string, unknown> };

  for (const key in masked) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      masked[key] = '***MASKED***';
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }

  return masked;
}

/**
 * 민감한 헤더 마스킹
 */
function maskSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie'];
  const masked = { ...headers };

  for (const key in masked) {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      masked[key] = '***MASKED***';
    }
  }

  return masked;
}

/**
 * X-Ray 서브세그먼트 생성
 */
function createXRaySubsegment(name: string, correlationId: string): void {
  try {
    const segment = AWSXRay.getSegment();
    if (segment) {
      const subsegment = segment.addNewSubsegment(name);
      subsegment.addAnnotation('correlationId', correlationId);
      subsegment.close();
    }
  } catch (error) {
    logger.debug('Failed to create X-Ray subsegment', {
      name,
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Lambda 핸들러 wrapper
 */
export function wrapLambdaHandler(
  handler: LambdaHandler,
  options?: {
    enableMetrics?: boolean;
    enableXRayTracing?: boolean;
    logRequests?: boolean;
    logResponses?: boolean;
  }
): (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult> {
  const {
    enableMetrics = true,
    enableXRayTracing = true,
    logRequests = true,
    logResponses = true,
  } = options || {};

  return async (
    event: APIGatewayProxyEvent,
    context: Context
  ): Promise<APIGatewayProxyResult> => {
    const startTime = Date.now();
    const correlationId = extractOrGenerateCorrelationId(event);

    // X-Ray 추적 시작
    if (enableXRayTracing) {
      createXRaySubsegment('lambda-handler', correlationId);
    }

    // 요청 로깅
    if (logRequests) {
      logRequest(event, context, correlationId);
    }

    try {
      // 핸들러 실행
      const response = await handler(event, context, correlationId);

      // 응답에 상관 ID 헤더 추가
      if (!response.headers) {
        response.headers = {};
      }
      response.headers['X-Correlation-ID'] = correlationId;

      // 응답 로깅
      if (logResponses) {
        logResponse(response, correlationId, Date.now() - startTime);
      }

      // 성능 메트릭 수집 및 전송
      if (enableMetrics) {
        const metrics = collectRequestMetrics(event, context, correlationId, startTime, response);
        
        logger.info('Performance metrics', metrics);
        publishCustomMetrics(metrics);
      }

      return response;

    } catch (error) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));

      // X-Ray에 에러 기록
      if (enableXRayTracing) {
        recordErrorToXRay(errorInstance, correlationId);
      }

      // 에러 응답 생성
      const errorResponse = createErrorResponse(errorInstance, correlationId);

      // 에러 메트릭 수집
      if (enableMetrics) {
        const metrics = collectRequestMetrics(event, context, correlationId, startTime, errorResponse);
        
        logger.error('Error metrics', errorInstance, metrics);
        publishCustomMetrics(metrics);
      }

      return errorResponse;
    }
  };
}

/**
 * 간단한 Lambda 핸들러 wrapper (기본 옵션 사용)
 */
export function withLambdaWrapper(handler: LambdaHandler) {
  return wrapLambdaHandler(handler);
}

/**
 * 헬스체크 전용 wrapper (로깅 최소화)
 */
export function withHealthCheckWrapper(handler: LambdaHandler) {
  return wrapLambdaHandler(handler, {
    enableMetrics: false,
    enableXRayTracing: false,
    logRequests: false,
    logResponses: false,
  });
}

/**
 * 개발환경 전용 wrapper (상세 로깅)
 */
export function withDevelopmentWrapper(handler: LambdaHandler) {
  return wrapLambdaHandler(handler, {
    enableMetrics: true,
    enableXRayTracing: true,
    logRequests: true,
    logResponses: true,
  });
}