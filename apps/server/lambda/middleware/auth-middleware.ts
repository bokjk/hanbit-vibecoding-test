import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createUnauthorizedResponse, createErrorResponse } from '../utils/response';
import { TokenValidator } from '../utils/token-validator';
import { logger } from '../utils/logger';

/**
 * JWT 토큰 검증 미들웨어
 *
 * 기능:
 * - Authorization 헤더에서 토큰 추출
 * - JWT 토큰 유효성 검증
 * - 사용자 권한 정보 추출
 * - 게스트/인증 사용자 구분
 */

export interface AuthContext {
  userId: string;
  userType: 'authenticated' | 'guest';
  sessionId?: string;
  permissions: {
    canRead: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    persistData: boolean;
    maxItems: number;
  };
  tokenClaims: Record<string, unknown>;
}

export interface AuthenticatedEvent extends APIGatewayProxyEvent {
  authContext: AuthContext;
}

/**
 * 인증이 필요한 Lambda 핸들러를 위한 미들웨어
 */
export function withAuth<T = AuthenticatedEvent>(
  handler: (event: T, authContext: AuthContext) => Promise<APIGatewayProxyResult>
) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const requestId = event.requestContext.requestId;
    const startTime = Date.now();

    logger.info('인증 미들웨어 시작', {
      requestId,
      method: event.httpMethod,
      path: event.path,
      userAgent: event.headers['User-Agent'],
      sourceIp: event.requestContext.identity.sourceIp,
    });

    try {
      // 1. Authorization 헤더에서 토큰 추출
      const authHeader = event.headers.Authorization || event.headers.authorization;
      if (!authHeader) {
        logger.warn('Authorization 헤더가 없습니다', { requestId });
        return createUnauthorizedResponse('Authorization 헤더가 필요합니다');
      }

      // Bearer 토큰 형식 확인
      const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/);
      if (!tokenMatch) {
        logger.warn('잘못된 Authorization 헤더 형식', { requestId, authHeader });
        return createUnauthorizedResponse('Bearer 토큰 형식이 올바르지 않습니다');
      }

      const token = tokenMatch[1];

      // 2. 토큰 검증
      const tokenValidator = new TokenValidator();
      let authContext: AuthContext;

      try {
        authContext = await tokenValidator.validateToken(token);

        logger.info('토큰 검증 성공', {
          requestId,
          userId: authContext.userId,
          userType: authContext.userType,
          processingTime: Date.now() - startTime,
        });
      } catch (tokenError) {
        logger.warn('토큰 검증 실패', {
          requestId,
          error: tokenError instanceof Error ? tokenError.message : 'Unknown token error',
          processingTime: Date.now() - startTime,
        });

        return createUnauthorizedResponse('유효하지 않은 토큰입니다');
      }

      // 3. 인증된 이벤트 생성
      const authenticatedEvent = {
        ...event,
        authContext,
      } as T;

      // 4. 핸들러 실행
      const result = await handler(authenticatedEvent, authContext);

      logger.info('인증된 요청 처리 완료', {
        requestId,
        userId: authContext.userId,
        userType: authContext.userType,
        statusCode: result.statusCode,
        processingTime: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      logger.error('인증 미들웨어 오류', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown middleware error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime: Date.now() - startTime,
      });

      return createErrorResponse('AUTH_MIDDLEWARE_ERROR', '인증 처리 중 오류가 발생했습니다', 500);
    }
  };
}

/**
 * 선택적 인증 미들웨어 (토큰이 있으면 검증, 없어도 통과)
 */
export function withOptionalAuth<T = APIGatewayProxyEvent>(
  handler: (event: T, authContext?: AuthContext) => Promise<APIGatewayProxyResult>
) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const requestId = event.requestContext.requestId;

    try {
      const authHeader = event.headers.Authorization || event.headers.authorization;
      let authContext: AuthContext | undefined;

      if (authHeader) {
        const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/);
        if (tokenMatch) {
          try {
            const token = tokenMatch[1];
            const tokenValidator = new TokenValidator();
            authContext = await tokenValidator.validateToken(token);

            logger.info('선택적 인증 성공', {
              requestId,
              userId: authContext.userId,
              userType: authContext.userType,
            });
          } catch (tokenError) {
            logger.info('선택적 인증 토큰 무효 (계속 진행)', {
              requestId,
              error: tokenError instanceof Error ? tokenError.message : 'Unknown token error',
            });
            // 토큰이 유효하지 않아도 계속 진행 (authContext는 undefined)
          }
        }
      }

      // 이벤트에 authContext 추가 (있는 경우)
      const extendedEvent = authContext ? ({ ...event, authContext } as T) : (event as T);

      return await handler(extendedEvent, authContext);
    } catch (error) {
      logger.error('선택적 인증 미들웨어 오류', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown middleware error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      return createErrorResponse(
        'OPTIONAL_AUTH_MIDDLEWARE_ERROR',
        '선택적 인증 처리 중 오류가 발생했습니다',
        500
      );
    }
  };
}

/**
 * 권한 기반 접근 제어 미들웨어
 */
export function requirePermissions(requiredPermissions: Array<keyof AuthContext['permissions']>) {
  return function <T = AuthenticatedEvent>(
    handler: (event: T, authContext: AuthContext) => Promise<APIGatewayProxyResult>
  ) {
    return withAuth<T>(async (event: T, authContext: AuthContext) => {
      const requestId = event.requestContext.requestId;

      // 권한 확인
      const missingPermissions = requiredPermissions.filter(
        permission => !authContext.permissions[permission]
      );

      if (missingPermissions.length > 0) {
        logger.warn('권한 부족', {
          requestId,
          userId: authContext.userId,
          userType: authContext.userType,
          requiredPermissions,
          missingPermissions,
        });

        return createErrorResponse(
          'INSUFFICIENT_PERMISSIONS',
          `다음 권한이 필요합니다: ${missingPermissions.join(', ')}`,
          403
        );
      }

      return await handler(event, authContext);
    });
  };
}

/**
 * 사용자 타입별 접근 제어
 */
export function requireUserType(allowedUserTypes: Array<'authenticated' | 'guest'>) {
  return function <T = AuthenticatedEvent>(
    handler: (event: T, authContext: AuthContext) => Promise<APIGatewayProxyResult>
  ) {
    return withAuth<T>(async (event: T, authContext: AuthContext) => {
      const requestId = event.requestContext.requestId;

      if (!allowedUserTypes.includes(authContext.userType)) {
        logger.warn('사용자 타입 접근 거부', {
          requestId,
          userId: authContext.userId,
          userType: authContext.userType,
          allowedUserTypes,
        });

        return createErrorResponse(
          'USER_TYPE_NOT_ALLOWED',
          `${authContext.userType} 사용자는 이 리소스에 접근할 수 없습니다`,
          403
        );
      }

      return await handler(event, authContext);
    });
  };
}

/**
 * 요청 제한 미들웨어 (게스트 사용자용)
 */
export function withRateLimit(maxRequestsPerMinute: number = 30) {
  const requestCounts = new Map<string, { count: number; resetTime: number }>();

  return function <T = AuthenticatedEvent>(
    handler: (event: T, authContext: AuthContext) => Promise<APIGatewayProxyResult>
  ) {
    return withAuth<T>(async (event: T, authContext: AuthContext) => {
      const requestId = event.requestContext.requestId;
      const now = Date.now();
      const key = authContext.sessionId || authContext.userId;

      // 게스트 사용자에게만 Rate Limit 적용
      if (authContext.userType === 'guest') {
        const existing = requestCounts.get(key);
        const resetTime = now + 60 * 1000; // 1분 후 리셋

        if (existing && now < existing.resetTime) {
          if (existing.count >= maxRequestsPerMinute) {
            logger.warn('Rate limit 초과', {
              requestId,
              userId: authContext.userId,
              sessionId: authContext.sessionId,
              currentCount: existing.count,
              maxRequests: maxRequestsPerMinute,
            });

            return createErrorResponse(
              'RATE_LIMIT_EXCEEDED',
              `요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요. (최대 ${maxRequestsPerMinute}회/분)`,
              429
            );
          }

          existing.count++;
        } else {
          requestCounts.set(key, { count: 1, resetTime });
        }

        // 오래된 엔트리 정리 (메모리 관리)
        for (const [k, v] of requestCounts.entries()) {
          if (now >= v.resetTime) {
            requestCounts.delete(k);
          }
        }
      }

      return await handler(event, authContext);
    });
  };
}
