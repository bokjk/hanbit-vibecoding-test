/**
 * 인증 관련 타입 정의
 * AuthService와 AuthContext에서 사용되는 타입들
 */

/**
 * 사용자 정보 인터페이스
 */
export interface User {
  id: string;
  email?: string;
  username?: string;
  isGuest: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

/**
 * 게스트 사용자 권한
 */
export interface GuestPermissions {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  maxItems: number;
  canExport: boolean;
}

/**
 * 인증된 사용자 권한
 */
export interface AuthenticatedPermissions extends GuestPermissions {
  canImport: boolean;
  canShare: boolean;
  unlimitedItems: boolean;
}

/**
 * 사용자 권한 (게스트 또는 인증)
 */
export type UserPermissions = GuestPermissions | AuthenticatedPermissions;

/**
 * 인증 모드
 */
export type AuthMode = 'guest' | 'authenticated';

/**
 * 토큰 정보
 */
export interface TokenInfo {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: 'guest' | 'authenticated';
}

/**
 * 인증 상태
 */
export interface AuthState {
  // 기본 인증 정보
  isAuthenticated: boolean;
  isGuest: boolean;
  user: User | null;
  permissions: UserPermissions | null;
  
  // 토큰 관리
  tokenInfo: TokenInfo | null;
  tokenExpiration: Date | null;
  
  // UI 상태
  isLoading: boolean;
  error: string | null;
  
  // 초기화 상태
  isInitialized: boolean;
}

/**
 * 인증 액션 타입들
 */
export type AuthAction =
  | { type: 'AUTH_INIT_START' }
  | { type: 'AUTH_INIT_SUCCESS'; payload: { user: User; permissions: UserPermissions; tokenInfo: TokenInfo } }
  | { type: 'AUTH_INIT_GUEST'; payload: { guestToken: string; expiresIn: number; permissions: GuestPermissions } }
  | { type: 'AUTH_INIT_FAILURE'; payload: string }
  | { type: 'AUTH_LOGIN_START' }
  | { type: 'AUTH_LOGIN_SUCCESS'; payload: { user: User; permissions: AuthenticatedPermissions; tokenInfo: TokenInfo } }
  | { type: 'AUTH_LOGIN_FAILURE'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_TOKEN_REFRESH_SUCCESS'; payload: { accessToken: string; expiresAt: number } }
  | { type: 'AUTH_TOKEN_REFRESH_FAILURE'; payload: string }
  | { type: 'AUTH_PERMISSIONS_UPDATE'; payload: UserPermissions }
  | { type: 'AUTH_ERROR_CLEAR' }
  | { type: 'AUTH_SET_LOADING'; payload: boolean };

/**
 * 로그인 요청 데이터
 */
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * 회원가입 요청 데이터
 */
export interface RegisterRequest {
  email: string;
  password: string;
  username?: string;
  acceptTerms: boolean;
}

/**
 * 비밀번호 재설정 요청
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * 비밀번호 변경 요청
 */
export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * 프로필 업데이트 요청
 */
export interface ProfileUpdateRequest {
  username?: string;
  email?: string;
}

/**
 * 인증 이벤트 타입
 */
export type AuthEvent = 
  | 'login'
  | 'logout'
  | 'token_expired'
  | 'token_refreshed'
  | 'permissions_changed'
  | 'session_timeout';

/**
 * 인증 이벤트 리스너
 */
export type AuthEventListener = (event: AuthEvent, data?: unknown) => void;

/**
 * 권한 확인 함수 타입
 */
export type PermissionChecker = (action: string, resource?: string) => boolean;

/**
 * 사용자 세션 정보
 */
export interface UserSession {
  user: User;
  permissions: UserPermissions;
  tokenInfo: TokenInfo;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * 인증 설정
 */
export interface AuthConfig {
  autoRefresh: boolean;
  tokenStorageKey: string;
  sessionTimeout: number; // 분 단위
  maxRetries: number;
  retryDelay: number; // ms
}

/**
 * AuthContext 컨텍스트 타입
 */
export interface AuthContextType {
  // 상태
  state: AuthState;
  
  // 인증 액션
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  
  // 사용자 관리
  updateProfile: (data: ProfileUpdateRequest) => Promise<void>;
  changePassword: (data: PasswordChangeRequest) => Promise<void>;
  requestPasswordReset: (data: PasswordResetRequest) => Promise<void>;
  
  // 권한 확인
  hasPermission: PermissionChecker;
  canCreateTodos: () => boolean;
  canUpdateTodos: () => boolean;
  canDeleteTodos: () => boolean;
  getRemainingQuota: () => number;
  
  // 유틸리티
  isTokenExpiringSoon: () => boolean;
  getTimeUntilExpiration: () => number;
  clearError: () => void;
  
  // 이벤트 관리
  addEventListener: (event: AuthEvent, listener: AuthEventListener) => void;
  removeEventListener: (event: AuthEvent, listener: AuthEventListener) => void;
}

/**
 * 인증 초기화 옵션
 */
export interface AuthInitOptions {
  autoLogin?: boolean;
  skipGuestToken?: boolean;
  customPermissions?: Partial<GuestPermissions>;
}