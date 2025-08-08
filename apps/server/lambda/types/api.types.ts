import { Priority } from './constants';

/**
 * API 요청/응답 타입 정의
 */

// 공통 API 응답 타입
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

// TODO 관련 API 타입
export interface CreateTodoRequest {
  title: string;
  priority?: Priority;
  dueDate?: string;
}

export interface UpdateTodoRequest {
  title?: string;
  completed?: boolean;
  priority?: Priority;
  dueDate?: string;
}

export interface ListTodosRequest {
  status?: 'all' | 'active' | 'completed';
  priority?: Priority;
  limit?: number;
  cursor?: string; // for pagination
}

// 인증 관련 API 타입
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
  };
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}

// 게스트 인증 관련 API 타입
export interface GuestAuthRequest {
  sessionId?: string; // 기존 세션 재사용 시
  deviceInfo?: {
    userAgent: string;
    platform: string;
    timestamp: string;
  };
}

export interface GuestAuthResponse {
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

// 권한 타입
export interface GuestPermissions {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  persistData: boolean;
  maxItems: number;
}

export interface AuthenticatedPermissions extends GuestPermissions {
  canExport?: boolean;
  canImport?: boolean;
}

// 인증 컨텍스트 타입
export interface AuthContext {
  userId: string;
  userType: 'authenticated' | 'guest';
  sessionId?: string;
  permissions: GuestPermissions | AuthenticatedPermissions;
  tokenClaims: Record<string, unknown>;
}

// JWT 토큰 클레임 타입
export interface CognitoTokenClaims {
  // 표준 JWT 클레임
  sub: string; // 사용자 ID
  aud: string; // 클라이언트 ID
  iss: string; // 발급자
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

// 에러 타입
export interface AuthError {
  code:
    | 'AUTHENTICATION_FAILED'
    | 'INVALID_TOKEN'
    | 'EXPIRED_TOKEN'
    | 'INSUFFICIENT_PERMISSIONS'
    | 'RATE_LIMIT_EXCEEDED';
  message: string;
  details?: unknown;
}
