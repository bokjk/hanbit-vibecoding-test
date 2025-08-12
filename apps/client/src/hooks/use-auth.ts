import { useCallback, useMemo } from 'react';
import { useAuthContext } from '../contexts/auth.context';
import type { 
  LoginRequest, 
  RegisterRequest, 
  PasswordResetRequest,
  PasswordChangeRequest,
  ProfileUpdateRequest,
  AuthEvent,
  AuthEventListener
} from '../types/auth.types';

/**
 * 인증 관련 커스텀 훅
 * AuthContext를 더 편리하게 사용할 수 있는 인터페이스 제공
 */
export function useAuth() {
  const authContext = useAuthContext();
  const { state, ...actions } = authContext;

  // ================================
  // 상태 선택자들 (메모이제이션)
  // ================================

  const authState = useMemo(() => ({
    // 기본 상태
    isAuthenticated: state.isAuthenticated,
    isGuest: state.isGuest,
    isLoggedIn: state.isAuthenticated || state.isGuest,
    user: state.user,
    permissions: state.permissions,
    
    // UI 상태
    isLoading: state.isLoading,
    error: state.error,
    hasError: Boolean(state.error),
    
    // 초기화 상태
    isInitialized: state.isInitialized,
    isReady: state.isInitialized && !state.isLoading,
    
    // 토큰 상태
    tokenExpiration: state.tokenExpiration,
    isTokenValid: state.tokenExpiration ? Date.now() < state.tokenExpiration.getTime() : false,
    isTokenExpiringSoon: actions.isTokenExpiringSoon(),
    timeUntilExpiration: actions.getTimeUntilExpiration(),
  }), [state, actions]);

  // ================================
  // 권한 관련 메서드들 (메모이제이션)
  // ================================

  const permissions = useMemo(() => ({
    // 기본 CRUD 권한
    canCreate: actions.canCreateTodos(),
    canUpdate: actions.canUpdateTodos(),
    canDelete: actions.canDeleteTodos(),
    
    // 고급 기능 권한
    canExport: actions.hasPermission('export'),
    canImport: state.permissions && 'canImport' in state.permissions 
      ? (state.permissions as Record<string, unknown>).canImport as boolean
      : false,
    canShare: state.permissions && 'canShare' in state.permissions 
      ? (state.permissions as Record<string, unknown>).canShare as boolean
      : false,
    
    // 할당량 관리
    maxItems: state.permissions?.maxItems || 0,
    remainingQuota: actions.getRemainingQuota(),
    isUnlimited: state.permissions && 'unlimitedItems' in state.permissions 
      ? (state.permissions as Record<string, unknown>).unlimitedItems as boolean 
      : false,
    
    // 권한 확인 함수
    hasPermission: actions.hasPermission,
  }), [state.permissions, actions]);

  // ================================
  // 사용자 정보 관련 (메모이제이션)
  // ================================

  const userInfo = useMemo(() => ({
    id: state.user?.id,
    email: state.user?.email,
    username: state.user?.username,
    displayName: state.user?.username || state.user?.email || 'Guest User',
    isGuest: state.user?.isGuest || false,
    createdAt: state.user?.createdAt,
    lastLoginAt: state.user?.lastLoginAt,
    
    // 사용자 타입 확인
    getUserType: () => {
      if (!state.user) return 'anonymous';
      return state.user.isGuest ? 'guest' : 'authenticated';
    },
  }), [state.user]);

  // ================================
  // 인증 액션 래퍼들 (에러 처리 포함)
  // ================================

  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      await actions.login(credentials);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      return { success: false, error: message };
    }
  }, [actions]);

  const register = useCallback(async (data: RegisterRequest) => {
    try {
      await actions.register(data);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      return { success: false, error: message };
    }
  }, [actions]);

  const logout = useCallback(async () => {
    try {
      await actions.logout();
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout failed';
      return { success: false, error: message };
    }
  }, [actions]);

  const refreshToken = useCallback(async () => {
    try {
      await actions.refreshToken();
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Token refresh failed';
      return { success: false, error: message };
    }
  }, [actions]);

  // ================================
  // 계정 관리 액션들 (미구현)
  // ================================

  const updateProfile = useCallback(async (data: ProfileUpdateRequest) => {
    try {
      await actions.updateProfile(data);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Profile update failed';
      return { success: false, error: message };
    }
  }, [actions]);

  const changePassword = useCallback(async (data: PasswordChangeRequest) => {
    try {
      await actions.changePassword(data);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password change failed';
      return { success: false, error: message };
    }
  }, [actions]);

  const requestPasswordReset = useCallback(async (data: PasswordResetRequest) => {
    try {
      await actions.requestPasswordReset(data);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password reset request failed';
      return { success: false, error: message };
    }
  }, [actions]);

  // ================================
  // 이벤트 관리 (편의 메서드)
  // ================================

  const addEventListener = useCallback((event: AuthEvent, listener: AuthEventListener) => {
    actions.addEventListener(event, listener);
  }, [actions]);

  const removeEventListener = useCallback((event: AuthEvent, listener: AuthEventListener) => {
    actions.removeEventListener(event, listener);
  }, [actions]);

  // 특정 이벤트용 편의 메서드들
  const onLogin = useCallback((listener: (data?: unknown) => void) => {
    const wrappedListener: AuthEventListener = (event, data) => listener(data);
    addEventListener('login', wrappedListener);
    return () => removeEventListener('login', wrappedListener);
  }, [addEventListener, removeEventListener]);

  const onLogout = useCallback((listener: (data?: unknown) => void) => {
    const wrappedListener: AuthEventListener = (event, data) => listener(data);
    addEventListener('logout', wrappedListener);
    return () => removeEventListener('logout', wrappedListener);
  }, [addEventListener, removeEventListener]);

  const onTokenExpired = useCallback((listener: (data?: unknown) => void) => {
    const wrappedListener: AuthEventListener = (event, data) => listener(data);
    addEventListener('token_expired', wrappedListener);
    return () => removeEventListener('token_expired', wrappedListener);
  }, [addEventListener, removeEventListener]);

  const onTokenRefreshed = useCallback((listener: (data?: unknown) => void) => {
    const wrappedListener: AuthEventListener = (event, data) => listener(data);
    addEventListener('token_refreshed', wrappedListener);
    return () => removeEventListener('token_refreshed', wrappedListener);
  }, [addEventListener, removeEventListener]);

  // ================================
  // 유틸리티 메서드들
  // ================================

  const clearError = useCallback(() => {
    actions.clearError();
  }, [actions]);

  const requireAuth = useCallback(() => {
    if (!authState.isLoggedIn) {
      throw new Error('Authentication required');
    }
  }, [authState.isLoggedIn]);

  const requireAuthenticated = useCallback(() => {
    if (!authState.isAuthenticated) {
      throw new Error('Full authentication required (guest access not sufficient)');
    }
  }, [authState.isAuthenticated]);

  const checkQuota = useCallback((requiredCount = 1) => {
    const remaining = permissions.remainingQuota;
    if (permissions.isUnlimited) {
      return true;
    }
    return remaining >= requiredCount;
  }, [permissions]);

  // ================================
  // 조건부 렌더링 헬퍼들
  // ================================

  const renderIfAuthenticated = useCallback((content: React.ReactNode, fallback?: React.ReactNode) => {
    return authState.isAuthenticated ? content : (fallback || null);
  }, [authState.isAuthenticated]);

  const renderIfGuest = useCallback((content: React.ReactNode, fallback?: React.ReactNode) => {
    return authState.isGuest ? content : (fallback || null);
  }, [authState.isGuest]);

  const renderIfLoggedIn = useCallback((content: React.ReactNode, fallback?: React.ReactNode) => {
    return authState.isLoggedIn ? content : (fallback || null);
  }, [authState.isLoggedIn]);

  const renderWithPermission = useCallback((
    permission: string, 
    content: React.ReactNode, 
    fallback?: React.ReactNode
  ) => {
    return permissions.hasPermission(permission) ? content : (fallback || null);
  }, [permissions]);

  // ================================
  // 반환값
  // ================================

  return {
    // 상태
    ...authState,
    permissions,
    user: userInfo,
    
    // 인증 액션
    login,
    register,
    logout,
    refreshToken,
    
    // 계정 관리
    updateProfile,
    changePassword,
    requestPasswordReset,
    
    // 이벤트 관리
    addEventListener,
    removeEventListener,
    onLogin,
    onLogout,
    onTokenExpired,
    onTokenRefreshed,
    
    // 유틸리티
    clearError,
    requireAuth,
    requireAuthenticated,
    checkQuota,
    
    // 조건부 렌더링
    renderIfAuthenticated,
    renderIfGuest,
    renderIfLoggedIn,
    renderWithPermission,
  };
}

/**
 * 권한 기반 조건부 렌더링을 위한 편의 훅
 */
export function useAuthPermissions() {
  const { permissions } = useAuth();
  return permissions;
}

/**
 * 사용자 정보만 필요한 경우의 편의 훅
 */
export function useCurrentUser() {
  const { user, isAuthenticated, isGuest, isLoggedIn } = useAuth();
  return {
    user,
    isAuthenticated,
    isGuest,
    isLoggedIn,
  };
}

/**
 * 인증 상태 변경을 감지하는 훅
 */
export function useAuthState() {
  const { isAuthenticated, isGuest, isLoggedIn, isLoading, error, isInitialized } = useAuth();
  return {
    isAuthenticated,
    isGuest,
    isLoggedIn,
    isLoading,
    error,
    isInitialized,
  };
}