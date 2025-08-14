import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { metrics } from '../utils/metrics';
import { getCloudWatchMetrics } from '../utils/cloudwatch-metrics';
import { correlationId } from '../utils/correlation';

// X-Ray 통합
import {
  generatePerformanceReport,
  resetPerformanceMetrics,
  addAnnotation,
  addMetadata,
} from '../utils/xray-tracer';
import { getDynamoPerformanceReport } from '../utils/db-tracer';

/**
 * Lambda 핸들러 타입
 */
type LambdaHandler = (
  event: APIGatewayProxyEvent,
  context: Context
) => Promise<APIGatewayProxyResult>;

/**
 * 메트릭 미들웨어 옵션 (X-Ray 통합 포함)
 */
interface MetricsMiddlewareOptions {
  /** 작업 이름 (메트릭에 사용) */
  operation: string;
  /** 성능 메트릭 수집 여부 */
  collectPerformance?: boolean;
  /** 사용자 활동 추적 여부 */
  trackUserActivity?: boolean;
  /** X-Ray 연동 활성화 여부 */
  enableXRayIntegration?: boolean;
  /** 추가 태그 */
  tags?: Record<string, string>;
}

/**
 * 메트릭 수집 미들웨어 (X-Ray 분산 추적 통합)
 * Lambda 함수 실행 시 자동으로 메트릭을 수집하고 CloudWatch로 전송
 * X-Ray 성능 메트릭과 연동하여 포괄적인 가시성 제공
 */
export function withMetrics(
  handler: LambdaHandler,
  options: MetricsMiddlewareOptions
): LambdaHandler {
  return async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    const startTime = Date.now();
    const cloudWatch = getCloudWatchMetrics();

    // X-Ray 성능 메트릭 초기화
    if (options.enableXRayIntegration) {
      resetPerformanceMetrics();

      // 미들웨어 어노테이션 추가
      addAnnotation('middleware_enabled', true);
      addAnnotation('operation', options.operation);
      addAnnotation('performance_tracking', options.collectPerformance || false);
      addAnnotation('user_activity_tracking', options.trackUserActivity || false);
    }

    // Correlation ID 설정
    const correlationIdValue =
      event.headers['x-correlation-id'] ||
      event.headers['X-Correlation-Id'] ||
      context.awsRequestId;
    correlationId.set({
      correlationId: correlationIdValue,
      requestId: context.awsRequestId,
      userId: event.headers.authorization
        ? extractUserIdFromToken(event.headers.authorization)
        : undefined,
    });

    // Cold start 감지
    const isColdStart = !process.env._LAMBDA_RUNTIME_LOAD_TIME;
    if (isColdStart) {
      process.env._LAMBDA_RUNTIME_LOAD_TIME = Date.now().toString();
    }

    const tags = {
      ...options.tags,
      functionName: context.functionName,
      functionVersion: context.functionVersion,
      coldStart: isColdStart.toString(),
    };

    let result: APIGatewayProxyResult;
    let error: Error | undefined;

    try {
      // 요청 메트릭 기록
      await recordRequestStartMetrics(event, options, tags);

      // 핸들러 실행
      result = await handler(event, context);

      // 성공 메트릭 기록
      await recordSuccessMetrics(event, result, options, startTime, tags, isColdStart);

      return result;
    } catch (err) {
      error = err as Error;

      // 에러 응답 생성
      result = createErrorResponse(error);

      // 에러 메트릭 기록
      await recordErrorMetrics(event, error, options, startTime, tags);

      return result;
    } finally {
      // X-Ray 성능 리포트 생성 및 통합
      if (options.enableXRayIntegration) {
        await recordXRayPerformanceMetrics(options, startTime, error);
      }

      // 공통 메트릭 기록
      if (result) {
        await recordFinalMetrics(event, result, options, startTime, tags, error);
      }

      // 사용자 활동 추적 (옵션)
      if (options.trackUserActivity && result) {
        await recordUserActivityMetrics(event, result, options);
      }

      // Lambda 종료 시 CloudWatch 메트릭 플러시
      if (context.getRemainingTimeInMillis() < 1000) {
        await cloudWatch.shutdown();
      }
    }
  };
}

/**
 * 요청 시작 메트릭 기록
 */
async function recordRequestStartMetrics(
  event: APIGatewayProxyEvent,
  options: MetricsMiddlewareOptions,
  tags: Record<string, string>
): Promise<void> {
  const endpoint = event.resource || event.path;
  const method = event.httpMethod;

  // API 사용량 시작 메트릭
  metrics.recordApiUsage(endpoint, method, 0, 0, {
    tags: { ...tags, status: 'started' },
  });

  // CloudWatch 비즈니스 메트릭
  const cloudWatch = getCloudWatchMetrics();
  await cloudWatch.recordBusinessMetric('RequestStarted', 1, 'Count', {
    Operation: options.operation,
    Method: method,
    Endpoint: endpoint,
    ...tags,
  });
}

/**
 * 성공 메트릭 기록
 */
async function recordSuccessMetrics(
  event: APIGatewayProxyEvent,
  result: APIGatewayProxyResult,
  options: MetricsMiddlewareOptions,
  startTime: number,
  tags: Record<string, string>,
  isColdStart: boolean
): Promise<void> {
  const responseTime = Date.now() - startTime;
  const endpoint = event.resource || event.path;
  const method = event.httpMethod;

  // API 사용량 메트릭
  metrics.recordApiUsage(endpoint, method, result.statusCode, responseTime, {
    requestSize: JSON.stringify(event.body).length,
    responseSize: result.body?.length || 0,
    tags: { ...tags, success: 'true' },
  });

  // 성능 메트릭
  if (options.collectPerformance !== false) {
    const memoryUsed = process.memoryUsage().heapUsed;

    metrics.recordPerformance(options.operation, responseTime, {
      memoryUsed,
      coldStart: isColdStart,
      tags,
    });

    // CloudWatch 성능 메트릭
    const cloudWatch = getCloudWatchMetrics();
    await cloudWatch.recordPerformanceMetric(
      options.operation,
      responseTime / 1000, // ms to seconds
      memoryUsed
    );
  }

  // TODO 관련 작업인 경우 비즈니스 메트릭
  if (isTodoOperation(options.operation)) {
    const todoAction = extractTodoAction(options.operation, method);
    if (todoAction) {
      const userId = extractUserIdFromEvent(event);

      metrics.recordTodoOperation(todoAction, responseTime, {
        success: true,
        tags: { ...tags, statusCode: result.statusCode.toString() },
      });

      // CloudWatch TODO 메트릭
      const cloudWatch = getCloudWatchMetrics();
      await cloudWatch.recordTodoMetric(todoAction, userId, true);
    }
  }
}

/**
 * 에러 메트릭 기록
 */
async function recordErrorMetrics(
  event: APIGatewayProxyEvent,
  error: Error,
  options: MetricsMiddlewareOptions,
  startTime: number,
  tags: Record<string, string>
): Promise<void> {
  const responseTime = Date.now() - startTime;
  const endpoint = event.resource || event.path;
  const method = event.httpMethod;

  // 에러 메트릭
  metrics.recordError(error.constructor.name, error.message, options.operation, {
    severity: getErrorSeverity(error),
    recoverable: isRecoverableError(error),
    tags: { ...tags, endpoint, method },
  });

  // CloudWatch 에러 메트릭
  const cloudWatch = getCloudWatchMetrics();
  await cloudWatch.recordErrorMetric(options.operation, error.constructor.name, error.message);

  // TODO 관련 작업 실패 메트릭
  if (isTodoOperation(options.operation)) {
    const todoAction = extractTodoAction(options.operation, method);
    if (todoAction) {
      const userId = extractUserIdFromEvent(event);

      metrics.recordTodoOperation(todoAction, responseTime, {
        success: false,
        tags: { ...tags, errorType: error.constructor.name },
      });

      // CloudWatch TODO 실패 메트릭
      await cloudWatch.recordTodoMetric(todoAction, userId, false);
    }
  }
}

/**
 * 최종 메트릭 기록
 */
async function recordFinalMetrics(
  event: APIGatewayProxyEvent,
  result: APIGatewayProxyResult,
  options: MetricsMiddlewareOptions,
  startTime: number,
  tags: Record<string, string>,
  error?: Error
): Promise<void> {
  const responseTime = Date.now() - startTime;
  const endpoint = event.resource || event.path;
  const method = event.httpMethod;

  // 최종 API 메트릭 (정확한 상태코드와 함께)
  metrics.recordApiUsage(endpoint, method, result.statusCode, responseTime, {
    requestSize: event.body?.length || 0,
    responseSize: result.body?.length || 0,
    tags: {
      ...tags,
      finalStatus: error ? 'error' : 'success',
      statusCode: result.statusCode.toString(),
    },
  });

  // CloudWatch 최종 메트릭
  const cloudWatch = getCloudWatchMetrics();
  await cloudWatch.recordBusinessMetric('RequestCompleted', 1, 'Count', {
    Operation: options.operation,
    Method: method,
    Endpoint: endpoint,
    StatusCode: result.statusCode.toString(),
    Success: (!error).toString(),
    ResponseTime: responseTime.toString(),
    ...tags,
  });
}

/**
 * X-Ray 성능 메트릭 기록 및 통합
 */
async function recordXRayPerformanceMetrics(
  options: MetricsMiddlewareOptions,
  startTime: number,
  error?: Error
): Promise<void> {
  try {
    const duration = Date.now() - startTime;

    // X-Ray 성능 리포트 생성
    const xrayReport = generatePerformanceReport();
    const dbReport = getDynamoPerformanceReport();

    // CloudWatch에 X-Ray 성능 메트릭 전송
    const cloudWatch = getCloudWatchMetrics();

    // 전체 성능 메트릭
    await cloudWatch.recordCustomMetric(
      'XRay/Performance/TotalOperations',
      xrayReport.totalOperations,
      'Count',
      {
        Operation: options.operation,
        HasError: (!!error).toString(),
      }
    );

    if (xrayReport.totalOperations > 0) {
      await cloudWatch.recordCustomMetric(
        'XRay/Performance/AverageDuration',
        xrayReport.averageDuration,
        'Milliseconds',
        { Operation: options.operation }
      );
    }

    // 병목 메트릭
    if (xrayReport.bottlenecks.length > 0) {
      await cloudWatch.recordCustomMetric(
        'XRay/Performance/BottleneckCount',
        xrayReport.bottlenecks.length,
        'Count',
        { Operation: options.operation }
      );

      // 서브시스템별 병목 메트릭
      const bottlenecksBySubsystem = xrayReport.bottlenecks.reduce(
        (acc, bottleneck) => {
          acc[bottleneck.subsystem] = (acc[bottleneck.subsystem] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      for (const [subsystem, count] of Object.entries(bottlenecksBySubsystem)) {
        await cloudWatch.recordCustomMetric(
          'XRay/Performance/BottleneckBySubsystem',
          count,
          'Count',
          {
            Operation: options.operation,
            Subsystem: subsystem,
          }
        );
      }
    }

    // 데이터베이스 성능 메트릭
    if (dbReport && dbReport.queryCount > 0) {
      await cloudWatch.recordCustomMetric(
        'XRay/Database/QueryCount',
        dbReport.queryCount,
        'Count',
        { Operation: options.operation }
      );

      if (dbReport.avgEfficiency !== 'N/A') {
        await cloudWatch.recordCustomMetric(
          'XRay/Database/QueryEfficiency',
          parseFloat(dbReport.avgEfficiency.replace('%', '')),
          'Percent',
          { Operation: options.operation }
        );
      }

      // 핫 파티션 감지
      if (dbReport.hotPartitions.length > 0) {
        await cloudWatch.recordCustomMetric(
          'XRay/Database/HotPartitions',
          dbReport.hotPartitions.length,
          'Count',
          { Operation: options.operation }
        );
      }

      // 스로틀링 감지
      const throttleCount = Object.keys(dbReport.throttleStats).length;
      if (throttleCount > 0) {
        await cloudWatch.recordCustomMetric(
          'XRay/Database/ThrottledOperations',
          throttleCount,
          'Count',
          { Operation: options.operation }
        );
      }
    }

    // X-Ray 메타데이터 추가
    addMetadata('performance_summary', {
      middlewareDuration: duration,
      xrayReport,
      dbReport,
      timestamp: new Date().toISOString(),
    });
  } catch (xrayError) {
    console.warn('Failed to record X-Ray performance metrics:', xrayError);

    // X-Ray 메트릭 수집 실패 메트릭
    const cloudWatch = getCloudWatchMetrics();
    await cloudWatch.recordCustomMetric('XRay/Errors/MetricCollectionFailed', 1, 'Count', {
      Operation: options.operation,
    });
  }
}

/**
 * 사용자 활동 메트릭 기록
 */
async function recordUserActivityMetrics(
  event: APIGatewayProxyEvent,
  result: APIGatewayProxyResult,
  options: MetricsMiddlewareOptions
): Promise<void> {
  const userId = extractUserIdFromEvent(event);
  if (!userId) return;

  const userAgent = event.headers['User-Agent'] || event.headers['user-agent'];
  const deviceType = detectDeviceType(userAgent);

  // 사용자 활동 메트릭
  metrics.recordUserActivity('feature_usage', {
    userAgent,
    deviceType,
    tags: {
      operation: options.operation,
      statusCode: result.statusCode.toString(),
    },
  });

  // CloudWatch 사용자 활동
  const cloudWatch = getCloudWatchMetrics();
  await cloudWatch.recordUserActivityMetric(userId, 'api_call', 1);
}

/**
 * 유틸리티 함수들
 */

function extractUserIdFromToken(authorization: string): string | undefined {
  try {
    // JWT 토큰에서 사용자 ID 추출 (간단한 구현)
    const token = authorization.replace('Bearer ', '');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.sub || payload.userId || payload.user_id;
  } catch {
    return undefined;
  }
}

function extractUserIdFromEvent(event: APIGatewayProxyEvent): string | undefined {
  return event.requestContext?.authorizer?.principalId || event.headers.authorization
    ? extractUserIdFromToken(event.headers.authorization)
    : undefined;
}

function isTodoOperation(operation: string): boolean {
  return operation.toLowerCase().includes('todo');
}

function extractTodoAction(
  operation: string,
  method: string
): 'create' | 'read' | 'update' | 'delete' | undefined {
  const op = operation.toLowerCase();

  if (op.includes('create') || method === 'POST') return 'create';
  if (op.includes('read') || op.includes('get') || method === 'GET') return 'read';
  if (op.includes('update') || method === 'PUT' || method === 'PATCH') return 'update';
  if (op.includes('delete') || method === 'DELETE') return 'delete';

  return undefined;
}

function getErrorSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
  const errorName = error.constructor.name.toLowerCase();

  if (errorName.includes('validation') || errorName.includes('bad request')) return 'low';
  if (errorName.includes('unauthorized') || errorName.includes('forbidden')) return 'medium';
  if (errorName.includes('server') || errorName.includes('database')) return 'high';
  if (errorName.includes('timeout') || errorName.includes('critical')) return 'critical';

  return 'medium';
}

function isRecoverableError(error: Error): boolean {
  const errorName = error.constructor.name.toLowerCase();

  // 복구 불가능한 에러들
  if (
    errorName.includes('syntax') ||
    errorName.includes('type') ||
    errorName.includes('reference')
  ) {
    return false;
  }

  // 대부분의 에러는 복구 가능
  return true;
}

function detectDeviceType(userAgent?: string): 'mobile' | 'tablet' | 'desktop' {
  if (!userAgent) return 'desktop';

  const ua = userAgent.toLowerCase();

  if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) {
    return 'mobile';
  }

  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  }

  return 'desktop';
}

function createErrorResponse(error: Error): APIGatewayProxyResult {
  const errorName = error.constructor.name;
  let statusCode = 500;

  // 에러 타입에 따른 적절한 상태 코드
  if (errorName.includes('Validation') || errorName.includes('BadRequest')) statusCode = 400;
  else if (errorName.includes('Unauthorized')) statusCode = 401;
  else if (errorName.includes('Forbidden')) statusCode = 403;
  else if (errorName.includes('NotFound')) statusCode = 404;
  else if (errorName.includes('Conflict')) statusCode = 409;
  else if (errorName.includes('Timeout')) statusCode = 408;

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
    body: JSON.stringify({
      error: errorName,
      message: error.message,
      timestamp: new Date().toISOString(),
    }),
  };
}
