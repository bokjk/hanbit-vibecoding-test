import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityClient,
  GetIdCommand,
  GetCredentialsForIdentityCommand,
} from '@aws-sdk/client-cognito-identity';
import { createSuccessResponse, createErrorResponse } from '../utils/response';
import { logger } from '../utils/logger';
import { initializeXRay, addAnnotation } from '../utils/xray-tracer';

// X-Ray 초기화
initializeXRay();

/**
 * 게스트 사용자를 위한 인증 핸들러
 *
 * 기능:
 * - Cognito Identity Pool을 통한 임시 자격 증명 발급
 * - 게스트 세션 ID 생성 및 관리
 * - 게스트 사용자 권한 설정
 * - TTL 기반 세션 만료 관리
 */

interface GuestAuthRequest {
  sessionId?: string; // 기존 세션 재사용 시
  deviceInfo?: {
    userAgent: string;
    platform: string;
    timestamp: string;
  };
}

interface GuestAuthResponse {
  identityId: string;
  sessionId: string;
  credentials: {
    accessKeyId: string;
    secretKey: string;
    sessionToken: string;
    expiration: Date;
  };
  permissions: {
    canRead: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    persistData: boolean;
    maxItems: number;
    sessionDuration: number;
  };
  expiresAt: string;
}

// 게스트 사용자 기본 권한
const GUEST_PERMISSIONS = {
  canRead: true,
  canCreate: true,
  canUpdate: true,
  canDelete: true,
  persistData: false, // 게스트는 영구 저장 불가
  maxItems: 10, // 최대 10개 TODO 생성 가능
  sessionDuration: 24 * 60 * 60, // 24시간 (초 단위)
} as const;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  const requestId = event.requestContext.requestId;

  logger.info('게스트 인증 요청 시작', {
    requestId,
    userAgent: event.headers['User-Agent'],
    sourceIp: event.requestContext.identity.sourceIp,
  });

  try {
    // X-Ray에 작업 정보 추가
    addAnnotation('operation', 'guestAuth');

    // 요청 body 파싱
    const requestBody: GuestAuthRequest = event.body ? JSON.parse(event.body) : {};

    // Cognito Identity Client 초기화
    const cognitoClient = new CognitoIdentityClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    const identityPoolId = process.env.COGNITO_IDENTITY_POOL_ID;
    if (!identityPoolId) {
      throw new Error('COGNITO_IDENTITY_POOL_ID 환경변수가 설정되지 않았습니다');
    }

    // 1. Identity ID 획득 (게스트 사용자)
    const getIdCommand = new GetIdCommand({
      IdentityPoolId: identityPoolId,
      // 게스트 사용자이므로 Logins 제공하지 않음
    });

    const identityResponse = await cognitoClient.send(getIdCommand);

    if (!identityResponse.IdentityId) {
      throw new Error('Identity ID 생성에 실패했습니다');
    }

    logger.info('Identity ID 생성 성공', {
      requestId,
      identityId: identityResponse.IdentityId,
    });

    // 2. 임시 자격 증명 획득
    const getCredentialsCommand = new GetCredentialsForIdentityCommand({
      IdentityId: identityResponse.IdentityId,
      // 게스트 사용자이므로 Logins 제공하지 않음
    });

    const credentialsResponse = await cognitoClient.send(getCredentialsCommand);

    if (!credentialsResponse.Credentials) {
      throw new Error('임시 자격 증명 생성에 실패했습니다');
    }

    const { Credentials } = credentialsResponse;
    if (
      !Credentials.AccessKeyId ||
      !Credentials.SecretKey ||
      !Credentials.SessionToken ||
      !Credentials.Expiration
    ) {
      throw new Error('임시 자격 증명이 완전하지 않습니다');
    }

    // 3. 세션 ID 생성 또는 재사용
    const sessionId = requestBody.sessionId || generateSessionId();

    // 4. 세션 만료 시간 계산
    const now = new Date();
    const expiresAt = new Date(now.getTime() + GUEST_PERMISSIONS.sessionDuration * 1000);

    // 5. 응답 데이터 구성
    const responseData: GuestAuthResponse = {
      identityId: identityResponse.IdentityId,
      sessionId,
      credentials: {
        accessKeyId: Credentials.AccessKeyId,
        secretKey: Credentials.SecretKey,
        sessionToken: Credentials.SessionToken,
        expiration: Credentials.Expiration,
      },
      permissions: GUEST_PERMISSIONS,
      expiresAt: expiresAt.toISOString(),
    };

    // 6. 감사 로깅
    logger.info('게스트 인증 성공', {
      requestId,
      identityId: identityResponse.IdentityId,
      sessionId,
      expiresAt: expiresAt.toISOString(),
      userAgent: event.headers['User-Agent'],
      sourceIp: event.requestContext.identity.sourceIp,
      processingTime: Date.now() - startTime,
    });

    // 7. 성공 응답 반환
    return createSuccessResponse<GuestAuthResponse>(responseData);
  } catch (error) {
    logger.error('게스트 인증 실패', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userAgent: event.headers['User-Agent'],
      sourceIp: event.requestContext.identity.sourceIp,
      processingTime: Date.now() - startTime,
    });

    if (error instanceof Error) {
      // AWS SDK 오류 처리
      if (error.name === 'NotAuthorizedException') {
        return createErrorResponse(
          'AUTHENTICATION_FAILED',
          '인증에 실패했습니다. 다시 시도해주세요.',
          401
        );
      }

      if (error.name === 'InvalidParameterException') {
        return createErrorResponse(
          'INVALID_REQUEST',
          '잘못된 요청입니다. 요청 형식을 확인해주세요.',
          400
        );
      }

      if (error.name === 'ResourceNotFoundException') {
        return createErrorResponse(
          'RESOURCE_NOT_FOUND',
          '인증 리소스를 찾을 수 없습니다. 시스템 관리자에게 문의하세요.',
          404
        );
      }
    }

    // 일반적인 서버 오류
    return createErrorResponse(
      'INTERNAL_SERVER_ERROR',
      '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      500
    );
  }
};

/**
 * 고유한 세션 ID 생성
 * 형식: guest_<timestamp>_<random>
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `guest_${timestamp}_${random}`;
}

/**
 * 게스트 세션 검증 (재사용을 위한 별도 함수)
 */
export async function validateGuestSession(
  sessionId: string,
  identityId: string
): Promise<{ valid: boolean; reason?: string }> {
  try {
    // 세션 ID 형식 검증
    if (!sessionId.startsWith('guest_')) {
      return { valid: false, reason: '잘못된 세션 ID 형식입니다' };
    }

    // Identity ID 형식 검증 (Cognito Identity ID는 지역:UUID 형식)
    const identityIdPattern = /^[a-zA-Z0-9-]+:[a-fA-F0-9-]{36}$/;
    if (!identityIdPattern.test(identityId)) {
      return { valid: false, reason: '잘못된 Identity ID 형식입니다' };
    }

    // 추가 검증 로직 (필요시)
    // - 세션이 DB에 존재하는지 확인
    // - 세션 만료 시간 확인
    // - 사용자별 요청 제한 확인 등

    return { valid: true };
  } catch (error) {
    logger.error('게스트 세션 검증 오류', {
      sessionId,
      identityId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return { valid: false, reason: '세션 검증 중 오류가 발생했습니다' };
  }
}

/**
 * 게스트 사용자 권한 확인
 */
export function getGuestPermissions(): typeof GUEST_PERMISSIONS {
  return { ...GUEST_PERMISSIONS };
}
