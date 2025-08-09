import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  createUnauthorizedResponse,
} from '@/utils/response';
import { parseAndValidate, RefreshRequestSchema } from '@/utils/validation';
import { logger } from '@/utils/logger';
import { initializeXRay, addAnnotation } from '@/utils/xray-tracer';

// X-Ray 초기화
initializeXRay();

/**
 * POST /auth/refresh - 토큰 갱신
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const timer = logger.startTimer();
  const requestId = event.requestContext.requestId;

  try {
    logger.logRequest('POST', '/auth/refresh', { requestId });

    // X-Ray에 작업 정보 추가
    addAnnotation('operation', 'refresh');

    // 요청 본문 검증
    const refreshRequest = parseAndValidate(event.body, RefreshRequestSchema);

    // TODO: 비즈니스 로직 구현
    // 1. 리프레시 토큰 검증
    // 2. 세션 확인
    // 3. 새로운 액세스 토큰 생성
    // 4. 세션 업데이트
    // 5. 새 토큰 반환

    // 임시 토큰 검증 로직 (데모용)
    if (refreshRequest.refreshToken === 'mock-refresh-token') {
      const refreshResponse = {
        accessToken: 'new-mock-access-token',
      };

      const duration = timer();
      logger.logResponse('POST', '/auth/refresh', 200, duration, { requestId });

      return createSuccessResponse(refreshResponse);
    }

    // 토큰 검증 실패
    const duration = timer();
    logger.warn('Refresh token validation failed', { requestId });
    logger.logResponse('POST', '/auth/refresh', 401, duration, { requestId });

    return createUnauthorizedResponse('유효하지 않은 리프레시 토큰입니다');
  } catch (error) {
    const duration = timer();
    logger.error('Error during token refresh', error as Error, { requestId });
    logger.logResponse('POST', '/auth/refresh', 500, duration, { requestId });

    if (error instanceof Error && error.message.includes('검증 실패')) {
      return createValidationErrorResponse(error.message);
    }

    return createErrorResponse(error as Error);
  }
};
