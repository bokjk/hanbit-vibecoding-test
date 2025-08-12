/**
 * 비즈니스 메트릭 로깅 시스템
 * TODO CRUD 작업 추적 및 사용자 활동 분석
 */
import { correlationId } from './correlation';

/**
 * 메트릭 타입 정의
 */
export type MetricType = 
  | 'business' 
  | 'performance' 
  | 'error' 
  | 'user_activity' 
  | 'api_usage'
  | 'security';

/**
 * TODO 작업 타입
 */
export type TodoOperation = 
  | 'create' 
  | 'read' 
  | 'update' 
  | 'delete' 
  | 'list' 
  | 'bulk_update' 
  | 'bulk_delete';

/**
 * 사용자 활동 타입
 */
export type UserActivity = 
  | 'login' 
  | 'logout' 
  | 'session_start' 
  | 'session_end' 
  | 'page_view' 
  | 'feature_usage'
  | 'error_encountered';

/**
 * API 상태 타입
 */
export type ApiStatus = 'success' | 'error' | 'timeout' | 'rate_limited';

/**
 * 기본 메트릭 인터페이스
 */
interface BaseMetric {
  type: MetricType;
  name: string;
  timestamp: string;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  tags?: Record<string, string>;
  dimensions?: Record<string, string | number>;
  value?: number;
  unit?: string;
}

/**
 * TODO 비즈니스 메트릭
 */
interface TodoMetric extends BaseMetric {
  type: 'business';
  operation: TodoOperation;
  todoId?: string;
  todoCount?: number;
  bulkSize?: number;
  filterType?: 'all' | 'completed' | 'active';
  sortBy?: string;
  duration: number;
}

/**
 * 성능 메트릭
 */
interface PerformanceMetric extends BaseMetric {
  type: 'performance';
  operation: string;
  duration: number;
  memoryUsed?: number;
  coldStart?: boolean;
  dbConnectionTime?: number;
  dbQueryTime?: number;
  externalApiTime?: number;
}

/**
 * 사용자 활동 메트릭
 */
interface UserActivityMetric extends BaseMetric {
  type: 'user_activity';
  activity: UserActivity;
  userAgent?: string;
  ipAddress?: string;
  location?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  sessionDuration?: number;
  pageUrl?: string;
  referrer?: string;
}

/**
 * API 사용량 메트릭
 */
interface ApiUsageMetric extends BaseMetric {
  type: 'api_usage';
  endpoint: string;
  method: string;
  statusCode: number;
  status: ApiStatus;
  responseTime: number;
  requestSize?: number;
  responseSize?: number;
  rateLimit?: {
    limit: number;
    remaining: number;
    resetTime: number;
  };
}

/**
 * 에러 메트릭
 */
interface ErrorMetric extends BaseMetric {
  type: 'error';
  errorType: string;
  errorCode?: string;
  errorMessage: string;
  stackTrace?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  operation: string;
  retryAttempt?: number;
}

/**
 * 보안 메트릭
 */
interface SecurityMetric extends BaseMetric {
  type: 'security';
  event: 'auth_success' | 'auth_failure' | 'token_refresh' | 'suspicious_activity' | 'rate_limit_exceeded';
  ipAddress?: string;
  userAgent?: string;
  authMethod?: string;
  failureReason?: string;
  threatLevel?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * 통합 메트릭 타입
 */
export type Metric = TodoMetric | PerformanceMetric | UserActivityMetric | ApiUsageMetric | ErrorMetric | SecurityMetric;

/**
 * 메트릭 매니저 클래스
 */
class MetricsManager {
  private readonly environment: string;
  private readonly serviceName: string;
  private metricsBuffer: Metric[] = [];
  private readonly bufferSize = 100;
  private readonly flushInterval = 30000; // 30초

  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.serviceName = process.env.SERVICE_NAME || 'hanbit-todo-api';
    
    // 주기적으로 메트릭 플러시
    setInterval(() => {
      this.flush().catch(error => {
        console.error('Failed to flush metrics:', error);
      });
    }, this.flushInterval);
  }

  /**
   * 기본 메트릭 정보 생성
   */
  private createBaseMetric(type: MetricType, name: string): BaseMetric {
    const context = correlationId.getCurrent();
    
    return {
      type,
      name,
      timestamp: new Date().toISOString(),
      correlationId: context?.correlationId,
      requestId: context?.requestId,
      userId: context?.userId,
      sessionId: context?.sessionId,
    };
  }

  /**
   * TODO 비즈니스 메트릭 기록
   */
  recordTodoOperation(
    operation: TodoOperation,
    duration: number,
    options: {
      todoId?: string;
      todoCount?: number;
      bulkSize?: number;
      filterType?: 'all' | 'completed' | 'active';
      sortBy?: string;
      success?: boolean;
      tags?: Record<string, string>;
    } = {}
  ): void {
    const metric: TodoMetric = {
      ...this.createBaseMetric('business', `todo_${operation}`),
      type: 'business',
      operation,
      duration,
      value: 1,
      unit: 'count',
      ...options,
      dimensions: {
        operation,
        success: options.success ?? true,
        environment: this.environment,
        ...options.tags,
      },
    };

    this.emit(metric);
  }

  /**
   * 성능 메트릭 기록
   */
  recordPerformance(
    operation: string,
    duration: number,
    options: {
      memoryUsed?: number;
      coldStart?: boolean;
      dbConnectionTime?: number;
      dbQueryTime?: number;
      externalApiTime?: number;
      tags?: Record<string, string>;
    } = {}
  ): void {
    const metric: PerformanceMetric = {
      ...this.createBaseMetric('performance', `performance_${operation}`),
      type: 'performance',
      operation,
      duration,
      value: duration,
      unit: 'milliseconds',
      ...options,
      dimensions: {
        operation,
        coldStart: options.coldStart ?? false,
        environment: this.environment,
        ...options.tags,
      },
    };

    this.emit(metric);
  }

  /**
   * 사용자 활동 메트릭 기록
   */
  recordUserActivity(
    activity: UserActivity,
    options: {
      userAgent?: string;
      ipAddress?: string;
      deviceType?: 'mobile' | 'tablet' | 'desktop';
      sessionDuration?: number;
      pageUrl?: string;
      referrer?: string;
      tags?: Record<string, string>;
    } = {}
  ): void {
    const metric: UserActivityMetric = {
      ...this.createBaseMetric('user_activity', `user_${activity}`),
      type: 'user_activity',
      activity,
      value: 1,
      unit: 'count',
      ...options,
      dimensions: {
        activity,
        deviceType: options.deviceType || 'unknown',
        environment: this.environment,
        ...options.tags,
      },
    };

    this.emit(metric);
  }

  /**
   * API 사용량 메트릭 기록
   */
  recordApiUsage(
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    options: {
      requestSize?: number;
      responseSize?: number;
      rateLimit?: {
        limit: number;
        remaining: number;
        resetTime: number;
      };
      tags?: Record<string, string>;
    } = {}
  ): void {
    const status: ApiStatus = 
      statusCode >= 200 && statusCode < 300 ? 'success' :
      statusCode === 429 ? 'rate_limited' :
      statusCode >= 500 ? 'timeout' : 'error';

    const metric: ApiUsageMetric = {
      ...this.createBaseMetric('api_usage', `api_${method.toLowerCase()}_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`),
      type: 'api_usage',
      endpoint,
      method,
      statusCode,
      status,
      responseTime,
      value: 1,
      unit: 'request',
      ...options,
      dimensions: {
        endpoint,
        method,
        status,
        statusCode,
        environment: this.environment,
        ...options.tags,
      },
    };

    this.emit(metric);
  }

  /**
   * 에러 메트릭 기록
   */
  recordError(
    errorType: string,
    errorMessage: string,
    operation: string,
    options: {
      errorCode?: string;
      stackTrace?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      recoverable?: boolean;
      retryAttempt?: number;
      tags?: Record<string, string>;
    } = {}
  ): void {
    const metric: ErrorMetric = {
      ...this.createBaseMetric('error', `error_${errorType}`),
      type: 'error',
      errorType,
      errorMessage,
      operation,
      severity: options.severity || 'medium',
      recoverable: options.recoverable ?? true,
      value: 1,
      unit: 'error',
      ...options,
      dimensions: {
        errorType,
        operation,
        severity: options.severity || 'medium',
        recoverable: options.recoverable ?? true,
        environment: this.environment,
        ...options.tags,
      },
    };

    this.emit(metric);
  }

  /**
   * 보안 메트릭 기록
   */
  recordSecurityEvent(
    event: 'auth_success' | 'auth_failure' | 'token_refresh' | 'suspicious_activity' | 'rate_limit_exceeded',
    options: {
      ipAddress?: string;
      userAgent?: string;
      authMethod?: string;
      failureReason?: string;
      threatLevel?: 'low' | 'medium' | 'high' | 'critical';
      tags?: Record<string, string>;
    } = {}
  ): void {
    const metric: SecurityMetric = {
      ...this.createBaseMetric('security', `security_${event}`),
      type: 'security',
      event,
      value: 1,
      unit: 'event',
      ...options,
      dimensions: {
        event,
        threatLevel: options.threatLevel || 'low',
        environment: this.environment,
        ...options.tags,
      },
    };

    this.emit(metric);
  }

  /**
   * 메트릭 발행
   */
  private emit(metric: Metric): void {
    // CloudWatch Logs에 메트릭 출력 (구조화된 로그)
    console.log(JSON.stringify({
      ...metric,
      logType: 'metric',
      service: this.serviceName,
    }));

    // 버퍼에 추가
    this.metricsBuffer.push(metric);

    // 버퍼 크기 초과 시 플러시
    if (this.metricsBuffer.length >= this.bufferSize) {
      this.flush().catch(error => {
        console.error('Failed to auto-flush metrics:', error);
      });
    }
  }

  /**
   * 메트릭 버퍼 플러시
   */
  private async flush(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    // 실제 환경에서는 CloudWatch 메트릭으로 전송
    if (this.environment === 'production') {
      await this.flushToCloudWatch();
    }

    this.metricsBuffer = [];
  }

  /**
   * CloudWatch 메트릭으로 전송
   */
  private async flushToCloudWatch(): Promise<void> {
    try {
      const { getCloudWatchMetrics } = await import('./cloudwatch-metrics');
      const cloudWatchMetrics = getCloudWatchMetrics();

      // 버퍼의 메트릭들을 CloudWatch 포맷으로 변환하여 전송
      for (const metric of this.metricsBuffer) {
        await this.sendMetricToCloudWatch(cloudWatchMetrics, metric);
      }

      console.log(JSON.stringify({
        logType: 'metrics_batch_sent',
        service: this.serviceName,
        timestamp: new Date().toISOString(),
        metricsCount: this.metricsBuffer.length,
        status: 'success'
      }));

    } catch (error) {
      console.error(JSON.stringify({
        logType: 'metrics_batch_error',
        service: this.serviceName,
        timestamp: new Date().toISOString(),
        metricsCount: this.metricsBuffer.length,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'failed'
      }));
    }
  }

  /**
   * 개별 메트릭을 CloudWatch로 전송
   */
  private async sendMetricToCloudWatch(cloudWatchMetrics: Record<string, unknown>, metric: Metric): Promise<void> {
    const dimensions = {
      Service: this.serviceName,
      Environment: this.environment,
      ...(metric.dimensions as Record<string, string>)
    };

    switch (metric.type) {
      case 'business': {
        await cloudWatchMetrics.recordTodoMetric(
          (metric as TodoMetric).operation,
          metric.userId,
          true
        );
        break;
      }

      case 'performance': {
        const perfMetric = metric as PerformanceMetric;
        await cloudWatchMetrics.recordPerformanceMetric(
          perfMetric.operation,
          perfMetric.duration / 1000, // ms to seconds
          perfMetric.memoryUsed
        );
        break;
      }

      case 'error': {
        const errorMetric = metric as ErrorMetric;
        await cloudWatchMetrics.recordErrorMetric(
          errorMetric.operation,
          errorMetric.errorType,
          errorMetric.errorMessage
        );
        break;
      }

      case 'api_usage': {
        const apiMetric = metric as ApiUsageMetric;
        await cloudWatchMetrics.recordPerformanceMetric(
          `api_${apiMetric.method}_${apiMetric.endpoint}`,
          apiMetric.responseTime / 1000 // ms to seconds
        );
        break;
      }

      case 'user_activity': {
        const userMetric = metric as UserActivityMetric;
        if (metric.userId) {
          await cloudWatchMetrics.recordUserActivityMetric(
            metric.userId,
            userMetric.activity,
            metric.value || 1
          );
        }
        break;
      }

      case 'security': {
        const secMetric = metric as SecurityMetric;
        await cloudWatchMetrics.recordBusinessMetric(
          `security_${secMetric.event}`,
          metric.value || 1,
          'Count',
          dimensions
        );
        break;
      }

      default:
        // 일반적인 커스텀 메트릭으로 전송
        await cloudWatchMetrics.recordBusinessMetric(
          metric.name,
          metric.value || 1,
          (metric.unit as 'Count' | 'Seconds' | 'Milliseconds' | 'Bytes' | 'Percent') || 'Count',
          dimensions
        );
    }
  }

  /**
   * 사용자 세션 메트릭 추적을 위한 세션 타이머
   */
  startSessionTimer(userId: string): () => void {
    const startTime = Date.now();
    
    this.recordUserActivity('session_start', {
      tags: { userId },
    });

    return () => {
      const duration = Date.now() - startTime;
      this.recordUserActivity('session_end', {
        sessionDuration: duration,
        tags: { userId },
      });
    };
  }

  /**
   * 성능 타이머 유틸리티
   */
  startPerformanceTimer(operation: string): {
    end: (options?: { success?: boolean; tags?: Record<string, string> }) => void;
    addTag: (key: string, value: string) => void;
  } {
    const startTime = Date.now();
    const tags: Record<string, string> = {};

    return {
      end: (options: { success?: boolean; tags?: Record<string, string> } = {}) => {
        const duration = Date.now() - startTime;
        this.recordPerformance(operation, duration, {
          tags: { ...tags, ...options.tags, success: String(options.success ?? true) },
        });
      },
      addTag: (key: string, value: string) => {
        tags[key] = value;
      },
    };
  }
}

/**
 * 싱글톤 인스턴스
 */
export const metrics = new MetricsManager();