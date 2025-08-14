import { APIGatewayProxyResult } from 'aws-lambda';
import * as AWSXRay from 'aws-xray-sdk-core';

/**
 * 에러 코드 체계
 */
export enum ErrorCode {
  // Validation Errors (4000-4099)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',

  // Authentication Errors (4010-4019)
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  MISSING_CREDENTIALS = 'MISSING_CREDENTIALS',

  // Authorization Errors (4030-4039)
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_ACCESS_DENIED = 'RESOURCE_ACCESS_DENIED',

  // Not Found Errors (4040-4049)
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  TODO_NOT_FOUND = 'TODO_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',

  // Conflict Errors (4090-4099)
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',

  // Rate Limit Errors (4290-4299)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // Business Logic Errors (4220-4229)
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INVALID_OPERATION = 'INVALID_OPERATION',

  // Server Errors (5000-5999)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
}

/**
 * 기본 애플리케이션 에러 클래스
 */
export abstract class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: string;
  public readonly correlationId?: string;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number,
    details?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.correlationId = correlationId;

    // Error.captureStackTrace가 존재하면 사용
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
      correlationId: this.correlationId,
    };
  }
}

/**
 * 비즈니스 로직 에러
 */
export class BusinessError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.BUSINESS_RULE_VIOLATION,
    details?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message, code, 422, details, correlationId);
  }
}

/**
 * 검증 에러
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.VALIDATION_ERROR,
    details?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message, code, 400, details, correlationId);
  }
}

/**
 * 인증 에러
 */
export class AuthenticationError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.AUTHENTICATION_FAILED,
    details?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message, code, 401, details, correlationId);
  }
}

/**
 * 인가 에러
 */
export class AuthorizationError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.AUTHORIZATION_FAILED,
    details?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message, code, 403, details, correlationId);
  }
}

/**
 * 리소스 미발견 에러
 */
export class NotFoundError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.RESOURCE_NOT_FOUND,
    details?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message, code, 404, details, correlationId);
  }
}

/**
 * 충돌 에러
 */
export class ConflictError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.RESOURCE_CONFLICT,
    details?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message, code, 409, details, correlationId);
  }
}

/**
 * 속도 제한 에러
 */
export class RateLimitError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.RATE_LIMIT_EXCEEDED,
    details?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message, code, 429, details, correlationId);
  }
}

/**
 * 서버 내부 에러
 */
export class InternalServerError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR,
    details?: Record<string, unknown>,
    correlationId?: string
  ) {
    super(message, code, 500, details, correlationId);
  }
}

/**
 * CloudWatch 로거 인터페이스
 */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * CloudWatch 로거 구현
 */
export class CloudWatchLogger implements Logger {
  private serviceName: string;
  private environment: string;

  constructor(serviceName = 'todo-api', environment = process.env.NODE_ENV || 'development') {
    this.serviceName = serviceName;
    this.environment = environment;
  }

  private formatLogEntry(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    meta?: Record<string, unknown>,
    error?: Error
  ): Record<string, unknown> {
    const baseEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      environment: this.environment,
      ...(meta && { meta }),
    };

    // X-Ray 추적 정보 추가
    const traceId = AWSXRay.getTraceId();
    if (traceId) {
      baseEntry['traceId'] = traceId;
    }

    // 에러 정보 추가
    if (error) {
      baseEntry['error'] = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error instanceof AppError && {
          code: error.code,
          statusCode: error.statusCode,
          details: error.details,
          correlationId: error.correlationId,
        }),
      };
    }

    return baseEntry;
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.log(JSON.stringify(this.formatLogEntry('info', message, meta)));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(JSON.stringify(this.formatLogEntry('warn', message, meta)));
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    console.error(JSON.stringify(this.formatLogEntry('error', message, meta, error)));
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.environment === 'development') {
      console.debug(JSON.stringify(this.formatLogEntry('debug', message, meta)));
    }
  }
}

/**
 * 전역 로거 인스턴스
 */
export const logger = new CloudWatchLogger();

/**
 * API Gateway 응답 생성 헬퍼
 */
export function createApiResponse(
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {}
): APIGatewayProxyResult {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Correlation-ID',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    ...headers,
  };

  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

/**
 * 성공 응답 생성
 */
export function createSuccessResponse(
  data: unknown,
  statusCode = 200,
  headers?: Record<string, string>
): APIGatewayProxyResult {
  return createApiResponse(statusCode, { success: true, data }, headers);
}

/**
 * 에러 응답 생성
 */
export function createErrorResponse(error: Error, correlationId?: string): APIGatewayProxyResult {
  // AppError인 경우
  if (error instanceof AppError) {
    logger.error('Application error occurred', error, {
      correlationId: error.correlationId || correlationId,
    });

    return createApiResponse(error.statusCode, {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        correlationId: error.correlationId || correlationId,
      },
    });
  }

  // 예상치 못한 에러인 경우
  logger.error('Unexpected error occurred', error, { correlationId });

  return createApiResponse(500, {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      correlationId,
    },
  });
}

/**
 * 에러 타입 가드 함수들
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError;
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isConflictError(error: unknown): error is ConflictError {
  return error instanceof ConflictError;
}

export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

export function isInternalServerError(error: unknown): error is InternalServerError {
  return error instanceof InternalServerError;
}

/**
 * 에러를 X-Ray에 기록
 */
export function recordErrorToXRay(error: Error, correlationId?: string): void {
  try {
    const segment = AWSXRay.getSegment();
    if (segment) {
      segment.addError(error);

      if (correlationId) {
        segment.addAnnotation('correlationId', correlationId);
      }

      if (error instanceof AppError) {
        segment.addAnnotation('errorCode', error.code);
        segment.addAnnotation('statusCode', error.statusCode);

        if (error.details) {
          segment.addMetadata('error', 'details', error.details);
        }
      }
    }
  } catch (xrayError) {
    logger.warn('Failed to record error to X-Ray', {
      originalError: error.message,
      xrayError: xrayError instanceof Error ? xrayError.message : 'Unknown X-Ray error',
    });
  }
}
