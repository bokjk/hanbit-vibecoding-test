/**
 * 구조화된 로깅 유틸리티
 * CloudWatch Logs와 호환되는 JSON 형식 로그 생성
 */

export interface LogContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  duration?: number;
  [key: string]: unknown;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private readonly logLevel: LogLevel;
  private readonly serviceName: string;

  constructor() {
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.serviceName = 'hanbit-todo-api';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const targetLevelIndex = levels.indexOf(level);
    return targetLevelIndex >= currentLevelIndex;
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      message,
      ...context,
    };

    return JSON.stringify(logEntry);
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
      const errorContext = {
        ...context,
        ...(error && {
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }),
      };
      console.error(this.formatLog('error', message, errorContext));
    }
  }

  /**
   * Lambda 함수 실행 시간 측정을 위한 타이머 시작
   */
  startTimer(): () => number {
    const start = Date.now();
    return () => Date.now() - start;
  }

  /**
   * HTTP 요청 로깅
   */
  logRequest(method: string, path: string, context?: LogContext): void {
    this.info(`${method} ${path}`, {
      ...context,
      type: 'request',
    });
  }

  /**
   * HTTP 응답 로깅
   */
  logResponse(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    this.info(`${method} ${path} - ${statusCode}`, {
      ...context,
      type: 'response',
      statusCode,
      duration,
    });
  }

  /**
   * 데이터베이스 작업 로깅
   */
  logDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    context?: LogContext
  ): void {
    this.info(`DB ${operation} on ${table}`, {
      ...context,
      type: 'database',
      operation,
      table,
      duration,
    });
  }
}

// 싱글톤 인스턴스 export
export const logger = new Logger();