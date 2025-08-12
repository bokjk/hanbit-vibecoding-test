import type { AuthState, AuthAction, User, UserPermissions, TokenInfo } from '../types/auth.types';

/**
 * 초기 인증 상태
 */
export const initialAuthState: AuthState = {
  isAuthenticated: false,
  isGuest: false,
  user: null,
  permissions: null,
  tokenInfo: null,
  tokenExpiration: null,
  isLoading: false,
  error: null,
  isInitialized: false,
};

/**
 * 기본 게스트 권한
 */
const DEFAULT_GUEST_PERMISSIONS = {
  canCreate: true,
  canUpdate: true,
  canDelete: true,
  maxItems: 50,
  canExport: false,
};

/**
 * 기본 인증 사용자 권한
 */
// const DEFAULT_AUTH_PERMISSIONS = {
//   ...DEFAULT_GUEST_PERMISSIONS,
//   maxItems: 1000,
//   canExport: true,
//   canImport: true,
//   canShare: true,
//   unlimitedItems: false,
// };

/**
 * 인증 상태 관리 리듀서
 */
export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    // 앱 초기화 관련
    case 'AUTH_INIT_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'AUTH_INIT_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        isGuest: false,
        user: action.payload.user,
        permissions: action.payload.permissions,
        tokenInfo: action.payload.tokenInfo,
        tokenExpiration: new Date(action.payload.tokenInfo.expiresAt),
        isLoading: false,
        error: null,
        isInitialized: true,
      };

    case 'AUTH_INIT_GUEST': {
      const guestUser: User = {
        id: `guest-${Date.now()}`,
        username: 'Guest User',
        isGuest: true,
        createdAt: new Date().toISOString(),
      };

      const guestTokenInfo: TokenInfo = {
        accessToken: action.payload.guestToken,
        expiresAt: Date.now() + (action.payload.expiresIn * 1000),
        tokenType: 'guest',
      };

      return {
        ...state,
        isAuthenticated: false,
        isGuest: true,
        user: guestUser,
        permissions: { ...DEFAULT_GUEST_PERMISSIONS, ...action.payload.permissions },
        tokenInfo: guestTokenInfo,
        tokenExpiration: new Date(guestTokenInfo.expiresAt),
        isLoading: false,
        error: null,
        isInitialized: true,
      };
    }

    case 'AUTH_INIT_FAILURE':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
        isInitialized: true,
      };

    // 로그인 관련
    case 'AUTH_LOGIN_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'AUTH_LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        isGuest: false,
        user: action.payload.user,
        permissions: action.payload.permissions,
        tokenInfo: action.payload.tokenInfo,
        tokenExpiration: new Date(action.payload.tokenInfo.expiresAt),
        isLoading: false,
        error: null,
      };

    case 'AUTH_LOGIN_FAILURE':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };

    // 로그아웃
    case 'AUTH_LOGOUT':
      return {
        ...initialAuthState,
        isInitialized: true,
      };

    // 토큰 갱신 관련
    case 'AUTH_TOKEN_REFRESH_SUCCESS': {
      if (!state.tokenInfo) {
        return state;
      }

      const updatedTokenInfo: TokenInfo = {
        ...state.tokenInfo,
        accessToken: action.payload.accessToken,
        expiresAt: action.payload.expiresAt,
      };

      return {
        ...state,
        tokenInfo: updatedTokenInfo,
        tokenExpiration: new Date(action.payload.expiresAt),
        error: null,
      };
    }

    case 'AUTH_TOKEN_REFRESH_FAILURE':
      return {
        ...state,
        error: action.payload,
        // 토큰 갱신 실패 시 게스트 모드로 전환하지 않고 에러 상태만 표시
        // 사용자가 직접 재로그인하도록 유도
      };

    // 권한 업데이트
    case 'AUTH_PERMISSIONS_UPDATE':
      return {
        ...state,
        permissions: action.payload,
      };

    // 에러 관리
    case 'AUTH_ERROR_CLEAR':
      return {
        ...state,
        error: null,
      };

    // 로딩 상태 설정
    case 'AUTH_SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    default:
      return state;
  }
}

/**
 * 인증 상태에서 권한을 확인하는 헬퍼 함수들
 */
export const authSelectors = {
  /**
   * 인증된 사용자인지 확인
   */
  isAuthenticated: (state: AuthState): boolean => state.isAuthenticated,

  /**
   * 게스트 사용자인지 확인
   */
  isGuest: (state: AuthState): boolean => state.isGuest,

  /**
   * 사용자가 로그인되어 있는지 확인 (게스트 포함)
   */
  isLoggedIn: (state: AuthState): boolean => state.isAuthenticated || state.isGuest,

  /**
   * 특정 권한을 가지고 있는지 확인
   */
  hasPermission: (state: AuthState, permission: keyof UserPermissions): boolean => {
    if (!state.permissions) return false;
    return Boolean(state.permissions[permission]);
  },

  /**
   * TODO 생성 권한 확인
   */
  canCreateTodos: (state: AuthState): boolean => {
    return authSelectors.hasPermission(state, 'canCreate');
  },

  /**
   * TODO 수정 권한 확인
   */
  canUpdateTodos: (state: AuthState): boolean => {
    return authSelectors.hasPermission(state, 'canUpdate');
  },

  /**
   * TODO 삭제 권한 확인
   */
  canDeleteTodos: (state: AuthState): boolean => {
    return authSelectors.hasPermission(state, 'canDelete');
  },

  /**
   * 데이터 내보내기 권한 확인
   */
  canExport: (state: AuthState): boolean => {
    return authSelectors.hasPermission(state, 'canExport');
  },

  /**
   * 최대 TODO 개수 조회
   */
  getMaxTodos: (state: AuthState): number => {
    if (!state.permissions) return 0;
    return state.permissions.maxItems;
  },

  /**
   * 남은 할당량 계산 (현재 TODO 개수는 외부에서 전달)
   */
  getRemainingQuota: (state: AuthState, currentCount: number): number => {
    const maxItems = authSelectors.getMaxTodos(state);
    if ('unlimitedItems' in (state.permissions || {}) && 
        state.permissions && 'unlimitedItems' in state.permissions && state.permissions.unlimitedItems) {
      return Infinity;
    }
    return Math.max(0, maxItems - currentCount);
  },

  /**
   * 토큰이 곧 만료될 예정인지 확인 (5분 이내)
   */
  isTokenExpiringSoon: (state: AuthState, marginMinutes = 5): boolean => {
    if (!state.tokenExpiration) return false;
    const marginMs = marginMinutes * 60 * 1000;
    return Date.now() + marginMs >= state.tokenExpiration.getTime();
  },

  /**
   * 토큰 만료까지 남은 시간 (밀리초)
   */
  getTimeUntilExpiration: (state: AuthState): number => {
    if (!state.tokenExpiration) return 0;
    return Math.max(0, state.tokenExpiration.getTime() - Date.now());
  },

  /**
   * 토큰이 유효한지 확인
   */
  isTokenValid: (state: AuthState): boolean => {
    if (!state.tokenExpiration) return false;
    return Date.now() < state.tokenExpiration.getTime();
  },

  /**
   * 사용자 표시명 조회
   */
  getDisplayName: (state: AuthState): string => {
    if (!state.user) return 'Unknown User';
    if (state.user.isGuest) return 'Guest User';
    return state.user.username || state.user.email || 'User';
  },

  /**
   * 에러가 있는지 확인
   */
  hasError: (state: AuthState): boolean => Boolean(state.error),

  /**
   * 로딩 중인지 확인
   */
  isLoading: (state: AuthState): boolean => state.isLoading,

  /**
   * 초기화 완료되었는지 확인
   */
  isInitialized: (state: AuthState): boolean => state.isInitialized,
};