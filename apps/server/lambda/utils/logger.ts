/**
 * 확장된 구조화된 로깅 유틸리티
 * 에러 분류, 상관 ID 추적, CloudWatch 최적화 지원
 */
import { correlationId } from './correlation';
import { metrics } from './metrics';

/**
 * 에러 심각도 레벨
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * 에러 분류 타입
 */
export type ErrorCategory =
  | 'business' // 비즈니스 로직 에러
  | 'system' // 시스템 레벨 에러
  | 'network' // 네트워크 관련 에러
  | 'database' // 데이터베이스 에러
  | 'authentication' // 인증/인가 에러
  | 'validation' // 입력 검증 에러
  | 'external' // 외부 서비스 에러
  | 'configuration' // 설정 관련 에러
  | 'timeout' // 타임아웃 에러
  | 'unknown'; // 분류되지 않은 에러

/**
 * 확장된 로그 컨텍스트
 */
export interface LogContext {
  // 기본 컨텍스트
  requestId?: string;
  userId?: string;
  operation?: string;
  duration?: number;

  // 상관 ID 컨텍스트
  correlationId?: string;
  traceId?: string;
  sessionId?: string;

  // 에러 분류 정보
  errorCategory?: ErrorCategory;
  errorSeverity?: ErrorSeverity;
  recoverable?: boolean;
  retryAttempt?: number;

  // 성능 메트릭
  memoryUsage?: number;
  cpuUsage?: number;
  coldStart?: boolean;

  // 비즈니스 컨텍스트
  entityId?: string;
  entityType?: string;
  businessProcess?: string;

  // CloudWatch 최적화
  logGroup?: string;
  tags?: Record<string, string>;
  dimensions?: Record<string, string | number>;

  [key: string]: unknown;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 구조화된 에러 정보
 */
interface ErrorInfo {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverable: boolean;
  retryAttempt?: number;
  cause?: ErrorInfo;
}

class Logger {
  private readonly logLevel: LogLevel;
  private readonly serviceName: string;
  private readonly environment: string;
  private readonly version: string;

  constructor() {
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.serviceName = process.env.SERVICE_NAME || 'hanbit-todo-api';
    this.environment = process.env.NODE_ENV || 'development';
    this.version = process.env.SERVICE_VERSION || '1.0.0';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const targetLevelIndex = levels.indexOf(level);
    return targetLevelIndex >= currentLevelIndex;
  }

  /**
   * CloudWatch 최적화된 로그 엔트리 생성
   */
  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    // 상관 ID 컨텍스트 자동 병합
    const correlationContext = correlationId.getLoggingContext();

    // 성능 정보 추가
    const memoryUsage = process.memoryUsage();
    const performanceInfo = {
      memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      memoryTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
    };

    const logEntry = {
      // AWS CloudWatch 표준 필드
      '@timestamp': new Date().toISOString(),
      '@level': level,
      '@message': message,
      '@service': this.serviceName,
      '@environment': this.environment,
      '@version': this.version,

      // 상관 ID 및 추적 정보 (CloudWatch 검색 최적화)
      ...correlationContext,

      // 성능 정보
      performance: performanceInfo,

      // 사용자 제공 컨텍스트
      ...context,

      // CloudWatch Insights 최적화 태그
      tags: {
        service: this.serviceName,
        environment: this.environment,
        level,
        ...context?.tags,
      },
    };

    return JSON.stringify(logEntry);
  }

  /**
   * 에러 정보 분석 및 분류
   */
  private analyzeError(error: Error): ErrorInfo {
    let category: ErrorCategory = 'unknown';
    let severity: ErrorSeverity = 'medium';
    let recoverable = true;

    // 에러 메시지 패턴 기반 분류
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // 네트워크 에러
    if (
      name.includes('network') ||
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('timeout')
    ) {
      category = 'network';
      severity = 'high';
      recoverable = true;
    }
    // 데이터베이스 에러
    else if (
      name.includes('db') ||
      name.includes('database') ||
      message.includes('database') ||
      message.includes('query')
    ) {
      category = 'database';
      severity = 'high';
      recoverable = false;
    }
    // 인증/인가 에러
    else if (
      name.includes('auth') ||
      name.includes('unauthorized') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    ) {
      category = 'authentication';
      severity = 'medium';
      recoverable = false;
    }
    // 검증 에러
    else if (
      name.includes('validation') ||
      message.includes('invalid') ||
      message.includes('validation') ||
      message.includes('required')
    ) {
      category = 'validation';
      severity = 'low';
      recoverable = false;
    }
    // 타임아웃 에러
    else if (
      name.includes('timeout') ||
      message.includes('timeout') ||
      message.includes('timed out')
    ) {
      category = 'timeout';
      severity = 'medium';
      recoverable = true;
    }
    // 시스템 에러
    else if (
      name.includes('system') ||
      name.includes('internal') ||
      message.includes('internal server error')
    ) {
      category = 'system';
      severity = 'critical';
      recoverable = false;
    }
    // 설정 에러
    else if (
      name.includes('config') ||
      message.includes('configuration') ||
      message.includes('environment')
    ) {
      category = 'configuration';
      severity = 'high';
      recoverable = false;
    }

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as { code?: string }).code,
      category,
      severity,
      recoverable,
      cause: (error as { cause?: Error }).cause
        ? this.analyzeError((error as { cause?: Error }).cause)
        : undefined,
    };
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatLog('debug', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.log(this.formatLog('info', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatLog('warn', message, context));
    }
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (this.shouldLog('error')) {
      let errorInfo: ErrorInfo | undefined;

      if (error) {
        errorInfo = this.analyzeError(error);

        // 메트릭 기록
        metrics.recordError(
          errorInfo.category,
          errorInfo.message,
          context?.operation || 'unknown',
          {
            errorCode: errorInfo.code,
            severity: errorInfo.severity,
            recoverable: errorInfo.recoverable,
            retryAttempt: context?.retryAttempt,
            stackTrace: errorInfo.stack,
            tags: context?.tags,
          }
        );
      }

      const errorContext: LogContext = {
        ...context,
        errorCategory: errorInfo?.category,
        errorSeverity: errorInfo?.severity,
        recoverable: errorInfo?.recoverable,
        ...(errorInfo && {
          error: errorInfo,
        }),
      };

      console.error(this.formatLog('error', message, errorContext));

      // 심각한 에러는 별도 알림 (추후 확장)
      if (errorInfo?.severity === 'critical') {
        this.handleCriticalError(message, errorInfo, context);
      }
    }
  }

  /**
   * 심각한 에러 처리
   */
  private handleCriticalError(message: string, errorInfo: ErrorInfo, context?: LogContext): void {
    // 추후 Slack, SNS 등으로 알림 발송
    console.error(`🚨 CRITICAL ERROR DETECTED: ${message}`, {
      error: errorInfo,
      context,
      alert: true,
    });
  }

  /**
   * Lambda 함수 실행 시간 측정을 위한 타이머 시작
   */
  startTimer(): () => number {
    const start = Date.now();
    return () => Date.now() - start;
  }

  /**
   * HTTP 요청 로깅 (메트릭 통합)
   */
  logRequest(method: string, path: string, context?: LogContext): void {
    this.info(`📥 ${method} ${path}`, {
      ...context,
      type: 'request',
      httpMethod: method,
      httpPath: path,
      tags: {
        type: 'request',
        method: method.toLowerCase(),
        endpoint: path,
        ...context?.tags,
      },
    });
  }

  /**
   * HTTP 응답 로깅 (메트릭 통합)
   */
  logResponse(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const icon = statusCode >= 500 ? '🔴' : statusCode >= 400 ? '🟡' : '🟢';

    this[level](`${icon} ${method} ${path} - ${statusCode} (${duration}ms)`, {
      ...context,
      type: 'response',
      httpMethod: method,
      httpPath: path,
      statusCode,
      duration,
      tags: {
        type: 'response',
        method: method.toLowerCase(),
        endpoint: path,
        status: statusCode.toString(),
        ...context?.tags,
      },
    });

    // API 사용량 메트릭 기록
    metrics.recordApiUsage(path, method, statusCode, duration, {
      tags: context?.tags,
    });
  }

  /**
   * 데이터베이스 작업 로깅 (성능 메트릭 통합)
   */
  logDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    context?: LogContext
  ): void {
    const level: LogLevel = duration > 1000 ? 'warn' : 'info';
    const icon = duration > 1000 ? '⚠️' : '📊';

    this[level](`${icon} DB ${operation.toUpperCase()} ${table} (${duration}ms)`, {
      ...context,
      type: 'database',
      operation,
      table,
      duration,
      tags: {
        type: 'database',
        operation: operation.toLowerCase(),
        table,
        ...context?.tags,
      },
      dimensions: {
        operation,
        table,
        duration,
        slow_query: duration > 1000,
      },
    });

    // 성능 메트릭 기록
    metrics.recordPerformance(`db_${operation}`, duration, {
      tags: { table, operation, ...context?.tags },
    });
  }

  /**
   * 비즈니스 이벤트 로깅
   */
  logBusinessEvent(
    event: string,
    entityType: string,
    entityId: string,
    context?: LogContext
  ): void {
    this.info(`🎯 ${event} ${entityType}:${entityId}`, {
      ...context,
      type: 'business_event',
      event,
      entityType,
      entityId,
      businessProcess: context?.businessProcess || event,
      tags: {
        type: 'business',
        event: event.toLowerCase(),
        entityType,
        ...context?.tags,
      },
    });
  }

  /**
   * 외부 서비스 호출 로깅
   */
  logExternalCall(
    service: string,
    operation: string,
    duration: number,
    success: boolean,
    context?: LogContext
  ): void {
    const level: LogLevel = success ? 'info' : 'error';
    const icon = success ? '🌐' : '🔴';

    this[level](`${icon} External ${service}.${operation} (${duration}ms)`, {
      ...context,
      type: 'external_call',
      service,
      operation,
      duration,
      success,
      tags: {
        type: 'external',
        service: service.toLowerCase(),
        operation: operation.toLowerCase(),
        success: success.toString(),
        ...context?.tags,
      },
    });

    // 성능 메트릭 기록
    metrics.recordPerformance(`external_${service}_${operation}`, duration, {
      tags: { service, operation, success: success.toString(), ...context?.tags },
    });
  }

  /**
   * 보안 이벤트 로깅
   */
  logSecurityEvent(event: string, severity: ErrorSeverity, context?: LogContext): void {
    const level: LogLevel =
      severity === 'critical' ? 'error' : severity === 'high' ? 'warn' : 'info';
    const icon = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : '🔒';

    this[level](`${icon} SECURITY: ${event}`, {
      ...context,
      type: 'security',
      event,
      severity,
      tags: {
        type: 'security',
        event: event.toLowerCase(),
        severity,
        ...context?.tags,
      },
    });

    // 보안 메트릭 기록
    metrics.recordSecurityEvent(
      event as
        | 'login_attempt'
        | 'authentication_failure'
        | 'authorization_failure'
        | 'suspicious_activity'
        | 'data_access_violation',
      {
        threatLevel: severity,
        tags: context?.tags,
      }
    );
  }

  /**
   * 성능 타이머 시작 (메트릭 통합)
   */
  startPerformanceTimer(operation: string): {
    end: (context?: LogContext) => void;
    endWithError: (error: Error, context?: LogContext) => void;
  } {
    const startTime = Date.now();
    const memoryStart = process.memoryUsage().heapUsed;

    return {
      end: (context?: LogContext) => {
        const duration = Date.now() - startTime;
        const memoryEnd = process.memoryUsage().heapUsed;
        const memoryDelta = memoryEnd - memoryStart;

        this.info(`⚡ ${operation} completed (${duration}ms)`, {
          ...context,
          operation,
          duration,
          memoryDelta: Math.round(memoryDelta / 1024 / 1024), // MB
          tags: {
            type: 'performance',
            operation: operation.toLowerCase(),
            ...context?.tags,
          },
        });

        // 성능 메트릭 기록
        metrics.recordPerformance(operation, duration, {
          tags: context?.tags,
        });
      },
      endWithError: (error: Error, context?: LogContext) => {
        const duration = Date.now() - startTime;

        this.error(`❌ ${operation} failed after ${duration}ms`, error, {
          ...context,
          operation,
          duration,
          tags: {
            type: 'performance',
            operation: operation.toLowerCase(),
            success: 'false',
            ...context?.tags,
          },
        });
      },
    };
  }
}

// 싱글톤 인스턴스 export
export const logger = new Logger();
