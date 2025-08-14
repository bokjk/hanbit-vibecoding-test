import { APIGatewayProxyResult } from 'aws-lambda';
import { RateLimitResult } from '@/middleware/rate-limiter';
import { CSPNonce } from './csp-nonce';

/**
 * 보안 응답 헬퍼 유틸리티
 */
export class ResponseSecurity {
  /**
   * 보안 헤더 생성 (동적 CSP 포함)
   */
  static getSecurityHeaders(
    options: {
      origin?: string;
      requestId?: string;
      environment?: 'development' | 'staging' | 'production';
      enableNonce?: boolean;
    } = {}
  ): Record<string, string> {
    const { requestId, environment = 'production', enableNonce = true } = options;

    const headers: Record<string, string> = {
      // XSS 보호
      'X-XSS-Protection': '1; mode=block',

      // 콘텐츠 타입 스니핑 방지
      'X-Content-Type-Options': 'nosniff',

      // 클릭재킹 방지
      'X-Frame-Options': 'DENY',

      // 참조자 정책
      'Referrer-Policy': 'strict-origin-when-cross-origin',

      // HTTPS 강제
      'Strict-Transport-Security':
        environment === 'production'
          ? 'max-age=31536000; includeSubDomains; preload'
          : 'max-age=86400',

      // 권한 정책
      'Permissions-Policy': [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()',
        'usb=()',
        'fullscreen=(self)',
        'picture-in-picture=()',
      ].join(', '),
    };

    // 동적 CSP 생성
    if (enableNonce && requestId) {
      const nonce = CSPNonce.generateForRequest(requestId);
      headers['Content-Security-Policy'] = CSPNonce.getEnvironmentCSP(environment, nonce);
      headers['X-CSP-Nonce'] = nonce; // 클라이언트에서 사용 가능
    } else {
      headers['Content-Security-Policy'] = CSPNonce.getEnvironmentCSP(environment);
    }

    // CSP 위반 보고 설정 (프로덕션/스테이징에서만)
    if (environment !== 'development') {
      const reportEndpoint =
        environment === 'production'
          ? 'https://todoapp.hanbit.com/csp-report'
          : 'https://staging.todoapp.hanbit.com/csp-report';

      headers['Report-To'] = CSPNonce.generateReportToHeader(reportEndpoint);
    }

    return headers;
  }

  /**
   * CORS 헤더 생성
   */
  static getCorsHeaders(origin?: string): Record<string, string> {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://todoapp.hanbit.com',
    ];

    const isAllowedOrigin = origin && allowedOrigins.includes(origin);

    return {
      'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0],
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Request-ID',
      ].join(', '),
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400', // 24시간 preflight 캐싱
      Vary: 'Origin',
    };
  }

  /**
   * 레이트 리미팅 헤더 생성
   */
  static getRateLimitHeaders(rateLimitResult?: RateLimitResult | null): Record<string, string> {
    if (!rateLimitResult) return {};

    const headers: Record<string, string> = {
      'X-RateLimit-Remaining': String(rateLimitResult.remaining),
      'X-RateLimit-Reset': String(Math.ceil(rateLimitResult.resetTime / 1000)),
    };

    if (rateLimitResult.retryAfter) {
      headers['Retry-After'] = String(rateLimitResult.retryAfter);
    }

    return headers;
  }

  /**
   * 통합 보안 응답 생성
   */
  static createSecureResponse(
    data: unknown,
    statusCode: number = 200,
    options: {
      origin?: string;
      requestId?: string;
      environment?: 'development' | 'staging' | 'production';
      rateLimitResult?: RateLimitResult | null;
      additionalHeaders?: Record<string, string>;
      enableNonce?: boolean;
    } = {}
  ): APIGatewayProxyResult {
    const {
      origin,
      requestId,
      environment = (process.env.NODE_ENV as 'development' | 'staging' | 'production') ||
        'production',
      rateLimitResult,
      additionalHeaders = {},
      enableNonce = true,
    } = options;

    // 민감한 정보 제거
    const sanitizedData = this.sanitizeResponseData(data);

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...this.getSecurityHeaders({ origin, requestId, environment, enableNonce }),
        ...this.getCorsHeaders(origin),
        ...this.getRateLimitHeaders(rateLimitResult),
        ...additionalHeaders,
      },
      body: JSON.stringify(sanitizedData),
    };
  }

  /**
   * 에러 응답 생성 (보안 고려)
   */
  static createSecureErrorResponse(
    error: Error,
    statusCode: number = 500,
    options: {
      origin?: string;
      requestId?: string;
      environment?: 'development' | 'staging' | 'production';
      rateLimitResult?: RateLimitResult | null;
      enableNonce?: boolean;
    } = {}
  ): APIGatewayProxyResult {
    const {
      origin,
      requestId,
      environment = (process.env.NODE_ENV as 'development' | 'staging' | 'production') ||
        'production',
      rateLimitResult,
      enableNonce = true,
    } = options;

    // 프로덕션에서는 상세 에러 정보 숨김
    const isDevelopment = environment === 'development';
    const errorMessage = isDevelopment ? error.message : this.getGenericErrorMessage(statusCode);

    const errorResponse = {
      error: true,
      message: errorMessage,
      statusCode,
      ...(requestId && { requestId }),
      ...(isDevelopment && { stack: error.stack }),
    };

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...this.getSecurityHeaders({ origin, requestId, environment, enableNonce }),
        ...this.getCorsHeaders(origin),
        ...this.getRateLimitHeaders(rateLimitResult),
      },
      body: JSON.stringify(errorResponse),
    };
  }

  /**
   * OPTIONS 요청 응답 (CORS preflight)
   */
  static createOptionsResponse(origin?: string): APIGatewayProxyResult {
    return {
      statusCode: 204,
      headers: {
        ...this.getCorsHeaders(origin),
        'Content-Length': '0',
      },
      body: '',
    };
  }

  /**
   * 응답 데이터 정화 (민감한 정보 제거)
   */
  private static sanitizeResponseData(data: unknown): unknown {
    if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        return data.map(item => this.sanitizeResponseData(item));
      }

      const sanitized: Record<string, unknown> = {};
      const sensitiveKeys = [
        'password',
        'secret',
        'token',
        'key',
        'credential',
        'private',
        'auth',
        'jwt',
        'session',
        'cookie',
      ];

      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = sensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey));

        if (isSensitive) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeResponseData(value);
        }
      }

      return sanitized;
    }

    return data;
  }

  /**
   * 상태 코드별 일반적인 에러 메시지
   */
  private static getGenericErrorMessage(statusCode: number): string {
    const errorMessages: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };

    return errorMessages[statusCode] || 'Unknown Error';
  }

  /**
   * 콘텐츠 보안 정책 (CSP) 동적 생성
   */
  static generateCSP(
    options: {
      allowInlineStyles?: boolean;
      allowInlineScripts?: boolean;
      additionalScriptSrc?: string[];
      additionalStyleSrc?: string[];
    } = {}
  ): string {
    const {
      allowInlineStyles = true,
      allowInlineScripts = false,
      additionalScriptSrc = [],
      additionalStyleSrc = [],
    } = options;

    const scriptSrc = [
      "'self'",
      ...(allowInlineScripts ? ["'unsafe-inline'"] : []),
      ...additionalScriptSrc,
    ].join(' ');

    const styleSrc = [
      "'self'",
      ...(allowInlineStyles ? ["'unsafe-inline'"] : []),
      ...additionalStyleSrc,
    ].join(' ');

    return [
      `default-src 'self'`,
      `script-src ${scriptSrc}`,
      `style-src ${styleSrc}`,
      `img-src 'self' data: https:`,
      `font-src 'self' data:`,
      `connect-src 'self' https:`,
      `frame-ancestors 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
    ].join('; ');
  }
}

/**
 * 레이트 리미팅 에러 응답 헬퍼
 */
export function createRateLimitErrorResponse(
  retryAfter: number,
  limit: number,
  remaining: number,
  origin?: string
): APIGatewayProxyResult {
  return ResponseSecurity.createSecureErrorResponse(
    new Error('Rate limit exceeded. Please try again later.'),
    429,
    {
      origin,
      rateLimitResult: {
        allowed: false,
        remaining,
        resetTime: Date.now() + retryAfter * 1000,
        retryAfter,
      },
    }
  );
}
