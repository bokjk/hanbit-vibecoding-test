import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { 
  createSuccessResponse, 
  createErrorResponse, 
  createValidationErrorResponse,
  createUnauthorizedResponse
} from '@/utils/response';
import { parseAndValidate, LoginRequestSchema } from '@/utils/validation';
import { logger } from '@/utils/logger';

/**
 * POST /auth/login - 사용자 로그인
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const timer = logger.startTimer();
  const requestId = event.requestContext.requestId;

  try {
    logger.logRequest('POST', '/auth/login', { requestId });

    // 요청 본문 검증
    const loginRequest = parseAndValidate(
      event.body,
      LoginRequestSchema
    );

    // TODO: 비즈니스 로직 구현
    // 1. 사용자 조회
    // 2. 비밀번호 검증
    // 3. JWT 토큰 생성 (access + refresh)
    // 4. 세션 저장
    // 5. 토큰 반환

    // 임시 인증 로직 (데모용)
    if (loginRequest.username === 'demo' && loginRequest.password === 'demo123') {
      const loginResponse = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          id: 'user-123',
          username: loginRequest.username,
        },
      };

      const duration = timer();
      logger.logResponse('POST', '/auth/login', 200, duration, { 
        requestId,
        userId: loginResponse.user.id
      });

      return createSuccessResponse(loginResponse);
    }

    // 인증 실패
    const duration = timer();
    logger.warn('Login failed', { 
      requestId,
      username: loginRequest.username
    });
    logger.logResponse('POST', '/auth/login', 401, duration, { requestId });

    return createUnauthorizedResponse('사용자명 또는 비밀번호가 올바르지 않습니다');

  } catch (error) {
    const duration = timer();
    logger.error('Error during login', error as Error, { requestId });
    logger.logResponse('POST', '/auth/login', 500, duration, { requestId });

    if (error instanceof Error && error.message.includes('검증 실패')) {
      return createValidationErrorResponse(error.message);
    }

    return createErrorResponse(error as Error);
  }
};