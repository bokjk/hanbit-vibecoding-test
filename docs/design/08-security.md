# 8. 보안 설계

## 8.1 인증 및 인가 아키텍처

### 8.1.1 Amazon Cognito 구성

```typescript
// Cognito 설정
interface CognitoConfig {
  UserPool: {
    Id: string;
    ClientId: string;
    Domain: string;
  };
  IdentityPool: {
    Id: string;
    AllowUnauthenticatedIdentities: true; // 게스트 사용자 허용
  };
  Region: string;
}

// 인증 상태 관리
interface AuthState {
  isAuthenticated: boolean;
  isGuest: boolean;
  user: User | null;
  credentials: CognitoCredentials | null;
  permissions: GuestPermissions | AuthenticatedPermissions;
}
```

### 8.1.2 권한 시스템

```typescript
// 게스트 사용자 권한
interface GuestPermissions {
  canRead: boolean;        // true - 샘플 데이터 읽기
  canCreate: boolean;      // true - 임시 TODO 생성 (세션 기반)
  canUpdate: boolean;      // true - 세션 내 수정
  canDelete: boolean;      // true - 세션 내 삭제
  persistData: boolean;    // false - 영구 저장 불가
  maxItems: number;        // 10 - 최대 항목 수 제한
  sessionDuration: number; // 24 * 60 * 60 - 24시간 (초 단위)
}

// 인증된 사용자 권한
interface AuthenticatedPermissions {
  canRead: boolean;        // true - 본인 데이터 읽기
  canCreate: boolean;      // true - 무제한 생성
  canUpdate: boolean;      // true - 본인 데이터 수정
  canDelete: boolean;      // true - 본인 데이터 삭제
  persistData: boolean;    // true - 영구 저장
  maxItems: number;        // 1000 - 최대 항목 수
  canExport: boolean;      // true - 데이터 내보내기
  canImport: boolean;      // true - 데이터 가져오기
}
```

## 8.2 JWT 토큰 관리

### 8.2.1 토큰 구조

```typescript
// Access Token Claims
interface AccessTokenClaims {
  sub: string;              // 사용자 ID
  aud: string;              // 클라이언트 ID
  token_use: 'access';      // 토큰 유형
  scope: string;            // 권한 범위
  auth_time: number;        // 인증 시간
  iss: string;              // 발급자
  exp: number;              // 만료 시간
  iat: number;              // 발급 시간
  
  // 커스텀 클레임
  'custom:user_type': 'authenticated' | 'guest';
  'custom:session_id'?: string;  // 게스트 세션 ID
  'custom:permissions': string;   // JSON 형태의 권한 정보
}

// ID Token Claims
interface IDTokenClaims {
  sub: string;              // 사용자 ID
  aud: string;              // 클라이언트 ID
  token_use: 'id';          // 토큰 유형
  email?: string;           // 이메일 (인증된 사용자만)
  email_verified?: boolean; // 이메일 인증 여부
  iss: string;              // 발급자
  exp: number;              // 만료 시간
  iat: number;              // 발급 시간
  
  // 커스텀 클레임
  'custom:user_type': 'authenticated' | 'guest';
  'custom:preferences': string; // 사용자 설정
}
```

### 8.2.2 토큰 검증 미들웨어

```typescript
export class TokenValidator {
  private jwksClient: JwksClient;
  
  constructor(cognitoConfig: CognitoConfig) {
    this.jwksClient = new JwksClient({
      jwksUri: `https://cognito-idp.${cognitoConfig.Region}.amazonaws.com/${cognitoConfig.UserPool.Id}/.well-known/jwks.json`
    });
  }

  async validateToken(token: string): Promise<AccessTokenClaims> {
    try {
      // 1. 토큰 디코딩 (검증 없이)
      const decodedToken = jwt.decode(token, { complete: true });
      if (!decodedToken || typeof decodedToken === 'string') {
        throw new Error('Invalid token format');
      }

      // 2. 키 ID 추출
      const kid = decodedToken.header.kid;
      if (!kid) {
        throw new Error('Missing key ID in token header');
      }

      // 3. 공개 키 조회
      const key = await this.jwksClient.getSigningKey(kid);
      const signingKey = key.getPublicKey();

      // 4. 토큰 검증
      const payload = jwt.verify(token, signingKey, {
        algorithms: ['RS256'],
        issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
        audience: process.env.COGNITO_CLIENT_ID,
      }) as AccessTokenClaims;

      // 5. 토큰 유형 검증
      if (payload.token_use !== 'access') {
        throw new Error('Invalid token use');
      }

      return payload;
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  extractPermissions(tokenClaims: AccessTokenClaims): GuestPermissions | AuthenticatedPermissions {
    const userType = tokenClaims['custom:user_type'];
    const permissionsJson = tokenClaims['custom:permissions'];
    
    try {
      const permissions = JSON.parse(permissionsJson);
      
      if (userType === 'guest') {
        return permissions as GuestPermissions;
      } else {
        return permissions as AuthenticatedPermissions;
      }
    } catch (error) {
      // 기본 권한 반환
      return userType === 'guest' ? getDefaultGuestPermissions() : getDefaultAuthenticatedPermissions();
    }
  }
}
```

## 8.3 API 보안

### 8.3.1 API Gateway 인증/인가

```typescript
// Lambda Authorizer 함수
export const authorizerHandler = async (event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
  try {
    const token = extractTokenFromAuthHeader(event.authorizationToken);
    const tokenValidator = new TokenValidator(getCognitoConfig());
    
    // 토큰 검증
    const tokenClaims = await tokenValidator.validateToken(token);
    const permissions = tokenValidator.extractPermissions(tokenClaims);
    
    // 정책 생성
    const policy = generateIAMPolicy(tokenClaims.sub, 'Allow', event.methodArn, {
      userId: tokenClaims.sub,
      userType: tokenClaims['custom:user_type'],
      permissions: JSON.stringify(permissions),
      sessionId: tokenClaims['custom:session_id'] || null,
    });
    
    return policy;
  } catch (error) {
    logger.error('Authorization failed:', error);
    throw new Error('Unauthorized');
  }
};

function generateIAMPolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, any>
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context,
  };
}
```

### 8.3.2 리소스 접근 제어

```typescript
export class ResourceAccessController {
  static canAccessTodo(
    requestingUserId: string,
    todo: Todo,
    permissions: GuestPermissions | AuthenticatedPermissions,
    action: 'read' | 'write' | 'delete'
  ): boolean {
    // 1. 소유권 확인
    if (todo.userId !== requestingUserId) {
      return false;
    }

    // 2. 권한 확인
    switch (action) {
      case 'read':
        return permissions.canRead;
      case 'write':
        return permissions.canUpdate;
      case 'delete':
        return permissions.canDelete;
      default:
        return false;
    }
  }

  static canCreateTodo(
    userId: string,
    permissions: GuestPermissions | AuthenticatedPermissions,
    currentTodoCount: number
  ): { allowed: boolean; reason?: string } {
    // 1. 생성 권한 확인
    if (!permissions.canCreate) {
      return { allowed: false, reason: 'Create permission denied' };
    }

    // 2. 할당량 확인
    if (currentTodoCount >= permissions.maxItems) {
      return { 
        allowed: false, 
        reason: `Maximum todo limit reached (${permissions.maxItems})` 
      };
    }

    return { allowed: true };
  }

  static validateDataPersistence(
    permissions: GuestPermissions | AuthenticatedPermissions,
    operation: 'create' | 'update' | 'delete'
  ): boolean {
    // 게스트 사용자는 영구 저장 불가 (세션 기반만 가능)
    if (!permissions.persistData && operation !== 'delete') {
      return false;
    }

    return true;
  }
}
```

## 8.4 데이터 보안

### 8.4.1 입력 검증 및 정화

```typescript
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// 입력 검증 스키마
const CreateTodoSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters')
    .transform(title => DOMPurify.sanitize(title.trim())),
  
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional()
    .transform(desc => desc ? DOMPurify.sanitize(desc.trim()) : undefined),
    
  priority: z.enum(['high', 'medium', 'low'])
});

const UpdateTodoSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters')
    .transform(title => DOMPurify.sanitize(title.trim()))
    .optional(),
    
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .transform(desc => DOMPurify.sanitize(desc.trim()))
    .optional(),
    
  priority: z.enum(['high', 'medium', 'low']).optional(),
  completed: z.boolean().optional()
});

// 검증 미들웨어
export class InputValidator {
  static validateCreateTodo(data: unknown): CreateTodoRequest {
    try {
      return CreateTodoSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid todo data', error.errors);
      }
      throw error;
    }
  }

  static validateUpdateTodo(data: unknown): UpdateTodoRequest {
    try {
      return UpdateTodoSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid update data', error.errors);
      }
      throw error;
    }
  }

  // SQL 인젝션 방지 (DynamoDB에서는 필요 없지만 다른 DB 사용 시)
  static sanitizeQuery(query: string): string {
    return query.replace(/['"`;\\]/g, '');
  }
}
```

### 8.4.2 데이터 암호화

```typescript
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';

export class DataEncryption {
  private kmsClient: KMSClient;
  private keyId: string;

  constructor(region: string, keyId: string) {
    this.kmsClient = new KMSClient({ region });
    this.keyId = keyId;
  }

  // 민감한 데이터 암호화 (필요시)
  async encryptSensitiveData(data: string): Promise<string> {
    try {
      const command = new EncryptCommand({
        KeyId: this.keyId,
        Plaintext: Buffer.from(data, 'utf8'),
      });

      const result = await this.kmsClient.send(command);
      
      if (!result.CiphertextBlob) {
        throw new Error('Encryption failed');
      }

      return Buffer.from(result.CiphertextBlob).toString('base64');
    } catch (error) {
      logger.error('Data encryption failed:', error);
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  async decryptSensitiveData(encryptedData: string): Promise<string> {
    try {
      const command = new DecryptCommand({
        CiphertextBlob: Buffer.from(encryptedData, 'base64'),
      });

      const result = await this.kmsClient.send(command);
      
      if (!result.Plaintext) {
        throw new Error('Decryption failed');
      }

      return Buffer.from(result.Plaintext).toString('utf8');
    } catch (error) {
      logger.error('Data decryption failed:', error);
      throw new Error('Failed to decrypt sensitive data');
    }
  }
}
```

## 8.5 CORS 및 보안 헤더

### 8.5.1 CORS 설정

```typescript
// API Gateway CORS 설정
export const corsConfig = {
  allowOrigins: [
    'https://todo-app.example.com',
    'https://dev-todo-app.example.com',
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : [])
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-ID'
  ],
  maxAge: 86400, // 24시간
};

// Lambda 응답에 CORS 헤더 추가
export function addCorsHeaders(response: APIGatewayProxyResult, origin?: string): APIGatewayProxyResult {
  const allowedOrigin = corsConfig.allowOrigins.includes(origin || '') 
    ? origin 
    : corsConfig.allowOrigins[0];

  return {
    ...response,
    headers: {
      ...response.headers,
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': corsConfig.allowMethods.join(', '),
      'Access-Control-Allow-Headers': corsConfig.allowHeaders.join(', '),
      'Access-Control-Max-Age': corsConfig.maxAge.toString(),
    },
  };
}
```

### 8.5.2 보안 헤더

```typescript
// 보안 헤더 추가
export function addSecurityHeaders(response: APIGatewayProxyResult): APIGatewayProxyResult {
  return {
    ...response,
    headers: {
      ...response.headers,
      // XSS 보호
      'X-XSS-Protection': '1; mode=block',
      
      // 콘텐츠 타입 스니핑 방지
      'X-Content-Type-Options': 'nosniff',
      
      // 클릭재킹 방지
      'X-Frame-Options': 'DENY',
      
      // HTTPS 강제
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      
      // 콘텐츠 보안 정책
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
      
      // 참조자 정책
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  };
}
```

## 8.6 감사 로깅

### 8.6.1 보안 이벤트 로깅

```typescript
export class SecurityAuditLogger {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  logAuthenticationAttempt(
    userId: string,
    success: boolean,
    ipAddress: string,
    userAgent: string,
    timestamp: string
  ): void {
    this.logger.info('Authentication attempt', {
      eventType: 'AUTH_ATTEMPT',
      userId,
      success,
      ipAddress,
      userAgent,
      timestamp,
    });
  }

  logPermissionDenied(
    userId: string,
    resource: string,
    action: string,
    reason: string,
    timestamp: string
  ): void {
    this.logger.warn('Permission denied', {
      eventType: 'PERMISSION_DENIED',
      userId,
      resource,
      action,
      reason,
      timestamp,
    });
  }

  logSuspiciousActivity(
    userId: string,
    activity: string,
    details: Record<string, any>,
    timestamp: string
  ): void {
    this.logger.error('Suspicious activity detected', {
      eventType: 'SUSPICIOUS_ACTIVITY',
      userId,
      activity,
      details,
      timestamp,
    });
  }

  logDataAccess(
    userId: string,
    resource: string,
    action: string,
    recordCount: number,
    timestamp: string
  ): void {
    this.logger.info('Data access', {
      eventType: 'DATA_ACCESS',
      userId,
      resource,
      action,
      recordCount,
      timestamp,
    });
  }
}
```

---

**이전**: [API 설계](07-api-design.md)  
**다음**: [배포 전략](09-deployment.md)