import jwt from 'jsonwebtoken';
import jwksClient, { JwksClient } from 'jwks-rsa';
import { logger } from './logger';
import { AuthContext } from '../middleware/auth-middleware';

/**
 * JWT 토큰 검증 유틸리티
 *
 * 기능:
 * - Cognito JWT 토큰 검증
 * - 토큰에서 사용자 정보 및 권한 추출
 * - 게스트/인증 사용자 구분
 * - JWKS를 통한 서명 검증
 */

interface CognitoTokenClaims {
  // 표준 JWT 클레임
  sub: string; // 사용자 ID
  aud: string; // 클라이언트 ID
  iss: string; // 발급자 (Cognito User Pool)
  exp: number; // 만료 시간
  iat: number; // 발급 시간
  token_use: 'access' | 'id'; // 토큰 유형

  // Cognito 특화 클레임
  scope?: string; // 권한 범위
  auth_time?: number; // 인증 시간

  // 커스텀 클레임
  'custom:user_type'?: 'authenticated' | 'guest';
  'custom:session_id'?: string;
  'custom:permissions'?: string;

  // Identity Pool 클레임 (게스트 사용자)
  'cognito:username'?: string;
  identities?: Array<{
    userId: string;
    providerName: string;
    providerType: string;
    primary: string;
    dateCreated: string;
  }>;
}

interface GuestPermissions {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  persistData: boolean;
  maxItems: number;
}

interface AuthenticatedPermissions {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  persistData: boolean;
  maxItems: number;
  canExport?: boolean;
  canImport?: boolean;
}

export class TokenValidator {
  private jwksClient: JwksClient | null = null;
  private userPoolId: string;
  private region: string;
  private clientId: string;

  constructor() {
    this.userPoolId = process.env.COGNITO_USER_POOL_ID || '';
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.clientId = process.env.COGNITO_CLIENT_ID || '';

    if (!this.userPoolId || !this.clientId) {
      logger.warn('Cognito 환경변수가 설정되지 않았습니다', {
        hasUserPoolId: !!this.userPoolId,
        hasClientId: !!this.clientId,
        region: this.region,
      });
    } else {
      // JWKS 클라이언트 초기화
      this.jwksClient = jwksClient({
        jwksUri: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}/.well-known/jwks.json`,
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 600000, // 10분 캐시
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      });
    }
  }

  /**
   * JWT 토큰 검증 및 인증 컨텍스트 생성
   */
  async validateToken(token: string): Promise<AuthContext> {
    try {
      // 1. 토큰 디코딩 (검증 없이)
      const decodedToken = jwt.decode(token, { complete: true });
      if (!decodedToken || typeof decodedToken === 'string') {
        throw new Error('유효하지 않은 토큰 형식입니다');
      }

      const header = decodedToken.header;
      const payload = decodedToken.payload as CognitoTokenClaims;

      logger.debug('토큰 디코딩 완료', {
        algorithm: header.alg,
        tokenType: payload.token_use,
        subject: payload.sub,
        issuer: payload.iss,
        expiration: new Date(payload.exp * 1000).toISOString(),
      });

      // 2. 토큰 유형별 처리
      if (this.isGuestToken(payload)) {
        return await this.validateGuestToken(token, payload);
      } else {
        return await this.validateCognitoToken(token, payload, header);
      }
    } catch (error) {
      logger.error('토큰 검증 오류', {
        error: error instanceof Error ? error.message : 'Unknown token validation error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw new Error(
        `토큰 검증 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Cognito JWT 토큰 검증 (인증된 사용자)
   */
  private async validateCognitoToken(
    token: string,
    payload: CognitoTokenClaims,
    header: jwt.JwtHeader
  ): Promise<AuthContext> {
    if (!this.jwksClient) {
      throw new Error('JWKS 클라이언트가 초기화되지 않았습니다');
    }

    // 1. 키 ID 확인
    const kid = header.kid;
    if (!kid) {
      throw new Error('토큰 헤더에 키 ID가 없습니다');
    }

    // 2. 공개 키 조회
    const key = await this.jwksClient.getSigningKey(kid);
    const signingKey = key.getPublicKey();

    // 3. 토큰 서명 검증
    const verifiedPayload = jwt.verify(token, signingKey, {
      algorithms: ['RS256'],
      issuer: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`,
      audience: this.clientId,
    }) as CognitoTokenClaims;

    // 4. 토큰 유형 확인
    if (verifiedPayload.token_use !== 'access') {
      throw new Error(`잘못된 토큰 유형: ${verifiedPayload.token_use}`);
    }

    // 5. 사용자 정보 및 권한 추출
    const userType = verifiedPayload['custom:user_type'] || 'authenticated';
    const permissions = this.extractPermissions(verifiedPayload, userType);

    logger.info('Cognito 토큰 검증 성공', {
      userId: verifiedPayload.sub,
      userType,
      tokenExpiration: new Date(verifiedPayload.exp * 1000).toISOString(),
    });

    return {
      userId: verifiedPayload.sub,
      userType: userType as 'authenticated',
      permissions,
      tokenClaims: verifiedPayload,
    };
  }

  /**
   * 게스트 토큰 검증 (Cognito Identity Pool)
   */
  private async validateGuestToken(
    token: string,
    payload: CognitoTokenClaims
  ): Promise<AuthContext> {
    // 게스트 토큰의 경우 기본 검증만 수행
    const currentTime = Math.floor(Date.now() / 1000);

    // 만료 시간 확인
    if (payload.exp <= currentTime) {
      throw new Error('토큰이 만료되었습니다');
    }

    // 발급 시간 확인 (너무 오래된 토큰 방지)
    if (payload.iat && currentTime - payload.iat > 24 * 60 * 60) {
      throw new Error('토큰이 너무 오래되었습니다');
    }

    const sessionId = payload['custom:session_id'] || this.generateSessionId();
    const permissions = this.getDefaultGuestPermissions();

    logger.info('게스트 토큰 검증 성공', {
      userId: payload.sub,
      sessionId,
      tokenExpiration: new Date(payload.exp * 1000).toISOString(),
    });

    return {
      userId: payload.sub,
      userType: 'guest',
      sessionId,
      permissions,
      tokenClaims: payload,
    };
  }

  /**
   * 게스트 토큰인지 확인
   */
  private isGuestToken(payload: CognitoTokenClaims): boolean {
    // 커스텀 클레임으로 게스트 타입 확인
    const userType = payload['custom:user_type'];
    if (userType === 'guest') {
      return true;
    }

    // Identity Pool 토큰 특성으로 확인
    if (payload.identities && Array.isArray(payload.identities)) {
      return true;
    }

    // 발급자가 Identity Pool인 경우 (cognito-identity)
    if (payload.iss && payload.iss.includes('cognito-identity')) {
      return true;
    }

    return false;
  }

  /**
   * 토큰에서 권한 정보 추출
   */
  private extractPermissions(
    payload: CognitoTokenClaims,
    userType: 'authenticated' | 'guest'
  ): GuestPermissions | AuthenticatedPermissions {
    const permissionsJson = payload['custom:permissions'];

    if (permissionsJson) {
      try {
        const customPermissions = JSON.parse(permissionsJson);
        logger.debug('커스텀 권한 정보 로드됨', { userType, customPermissions });
        return customPermissions;
      } catch (error) {
        logger.warn('커스텀 권한 정보 파싱 실패, 기본 권한 사용', {
          error: error instanceof Error ? error.message : 'Parse error',
          permissionsJson,
        });
      }
    }

    // 기본 권한 반환
    return userType === 'guest'
      ? this.getDefaultGuestPermissions()
      : this.getDefaultAuthenticatedPermissions();
  }

  /**
   * 게스트 사용자 기본 권한
   */
  private getDefaultGuestPermissions(): GuestPermissions {
    return {
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      persistData: false, // 게스트는 영구 저장 불가
      maxItems: 10,
    };
  }

  /**
   * 인증된 사용자 기본 권한
   */
  private getDefaultAuthenticatedPermissions(): AuthenticatedPermissions {
    return {
      canRead: true,
      canCreate: true,
      canUpdate: true,
      canDelete: true,
      persistData: true, // 인증 사용자는 영구 저장 가능
      maxItems: 1000,
      canExport: true,
      canImport: true,
    };
  }

  /**
   * 세션 ID 생성
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `session_${timestamp}_${random}`;
  }

  /**
   * 토큰 클레임 조회 헬퍼 메서드
   */
  static getClaim(tokenClaims: Record<string, unknown>, claimName: string): unknown {
    return tokenClaims[claimName];
  }

  /**
   * 사용자 ID 추출
   */
  static getUserId(tokenClaims: Record<string, unknown>): string {
    const userId = tokenClaims.sub;
    if (typeof userId !== 'string') {
      throw new Error('유효하지 않은 사용자 ID입니다');
    }
    return userId;
  }

  /**
   * 토큰 만료 시간 확인
   */
  static isTokenExpired(tokenClaims: Record<string, unknown>): boolean {
    const exp = tokenClaims.exp;
    if (typeof exp !== 'number') {
      return true;
    }
    return Date.now() >= exp * 1000;
  }

  /**
   * 토큰 만료까지 남은 시간 (초)
   */
  static getTimeToExpiry(tokenClaims: Record<string, unknown>): number {
    const exp = tokenClaims.exp;
    if (typeof exp !== 'number') {
      return 0;
    }
    const remaining = exp * 1000 - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  }
}
