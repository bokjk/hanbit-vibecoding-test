import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { 
  AuthContextType, 
  // LoginRequest, 
  // RegisterRequest, 
  // PasswordResetRequest,
  // PasswordChangeRequest,
  // ProfileUpdateRequest,
  AuthEvent,
  AuthEventListener,
  AuthInitOptions
} from '../types/auth.types';
import { authReducer, initialAuthState, authSelectors } from './auth.reducer';
import { authService } from '../services/auth.service';
import { appConfig } from '../config/app-config';

/**
 * AuthContext 생성
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider Props
 */
interface AuthProviderProps {
  children: ReactNode;
  initOptions?: AuthInitOptions;
}

/**
 * AuthContext Provider 컴포넌트
 */
export function AuthProvider({ children, initOptions }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);
  const eventListeners = useRef<Map<AuthEvent, Set<AuthEventListener>>>(new Map());
  const isInitializing = useRef(false);

  // ================================
  // 이벤트 관리
  // ================================

  const addEventListener = useCallback((event: AuthEvent, listener: AuthEventListener) => {
    if (!eventListeners.current.has(event)) {
      eventListeners.current.set(event, new Set());
    }
    eventListeners.current.get(event)!.add(listener);
  }, []);

  const removeEventListener = useCallback((event: AuthEvent, listener: AuthEventListener) => {
    const listeners = eventListeners.current.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }, []);

  const emitEvent = useCallback((event: AuthEvent, data?: unknown) => {
    const listeners = eventListeners.current.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event, data);
        } catch (listenerError) {
          console.error('AuthEvent listener error:', listenerError);
        }
      });
    }

    if (appConfig.features.debugMode) {
      console.log(`🔐 Auth Event: ${event}`, data);
    }
  }, []);

  // ================================
  // 초기화 관련 메서드
  // ================================

  const initialize = useCallback(async () => {
    if (isInitializing.current || state.isInitialized) {
      return;
    }

    isInitializing.current = true;
    dispatch({ type: 'AUTH_INIT_START' });

    try {
      // AuthService에서 토큰 상태 확인
      if (authService.isTokenValid()) {
        // 유효한 토큰이 있으면 사용자 정보 조회
        try {
          const userInfoResponse = await authService.getUserInfo();
          const tokenInfo = {
            accessToken: await authService.getValidToken(),
            expiresAt: Date.now() + 3600000, // 1시간 (실제로는 AuthService에서 관리)
            tokenType: userInfoResponse.data.user.isGuest ? 'guest' as const : 'authenticated' as const,
          };

          if (userInfoResponse.data.user.isGuest) {
            // 게스트 사용자
            dispatch({
              type: 'AUTH_INIT_GUEST',
              payload: {
                guestToken: tokenInfo.accessToken,
                expiresIn: 3600,
                permissions: userInfoResponse.data.permissions,
              },
            });
            emitEvent('login', { user: userInfoResponse.data.user, isGuest: true });
          } else {
            // 인증된 사용자
            dispatch({
              type: 'AUTH_INIT_SUCCESS',
              payload: {
                user: userInfoResponse.data.user,
                permissions: userInfoResponse.data.permissions,
                tokenInfo,
              },
            });
            emitEvent('login', { user: userInfoResponse.data.user, isGuest: false });
          }
        } catch (userInfoError) {
          // 사용자 정보 조회 실패 시 게스트 토큰으로 폴백
          console.warn('Failed to get user info, falling back to guest token', userInfoError);
          await requestGuestAccess();
        }
      } else {
        // 토큰이 없거나 만료된 경우 게스트 토큰 요청
        if (!initOptions?.skipGuestToken) {
          await requestGuestAccess();
        } else {
          dispatch({
            type: 'AUTH_INIT_FAILURE',
            payload: 'No valid token and guest token creation is disabled',
          });
        }
      }
    } catch (initError) {
      const errorMessage = initError instanceof Error ? initError.message : 'Failed to initialize auth';
      dispatch({
        type: 'AUTH_INIT_FAILURE',
        payload: errorMessage,
      });
      emitEvent('login', { error: errorMessage });
    } finally {
      isInitializing.current = false;
    }
  }, [state.isInitialized, initOptions, emitEvent, requestGuestAccess]);

  const requestGuestAccess = useCallback(async () => {
    try {
      const guestResponse = await authService.requestGuestToken();
      
      dispatch({
        type: 'AUTH_INIT_GUEST',
        payload: {
          guestToken: guestResponse.guestToken,
          expiresIn: guestResponse.expiresIn,
          permissions: {
            ...guestResponse.permissions,
            ...initOptions?.customPermissions,
          },
        },
      });

      emitEvent('login', { isGuest: true });
    } catch (guestError) {
      const errorMessage = guestError instanceof Error ? guestError.message : 'Failed to get guest token';
      dispatch({
        type: 'AUTH_INIT_FAILURE',
        payload: errorMessage,
      });
      throw loginError;
    }
  }, [initOptions, emitEvent]);

  // ================================
  // 인증 관련 메서드들
  // ================================

  const login = useCallback(async () => {
    dispatch({ type: 'AUTH_LOGIN_START' });

    try {
      // TODO: 실제 로그인 API 구현
      // 현재는 게스트 토큰만 지원하므로 에러 처리
      throw new Error('Full authentication is not yet implemented. Using guest mode.');
    } catch (loginError) {
      const errorMessage = loginError instanceof Error ? loginError.message : 'Login failed';
      dispatch({
        type: 'AUTH_LOGIN_FAILURE',
        payload: errorMessage,
      });
      emitEvent('login', { error: errorMessage });
      throw loginError;
    }
  }, [emitEvent]);

  const register = useCallback(async () => {
    dispatch({ type: 'AUTH_SET_LOADING', payload: true });

    try {
      // TODO: 실제 회원가입 API 구현
      throw new Error('User registration is not yet implemented');
    } catch (registerError) {
      const errorMessage = registerError instanceof Error ? registerError.message : 'Registration failed';
      dispatch({ type: 'AUTH_SET_LOADING', payload: false });
      dispatch({ type: 'AUTH_LOGIN_FAILURE', payload: errorMessage });
      throw loginError;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // AuthService 로그아웃 호출
      authService.logout();
      
      // 상태 초기화
      dispatch({ type: 'AUTH_LOGOUT' });
      
      emitEvent('logout');

      // 게스트 토큰 재요청 (옵션에 따라)
      if (!initOptions?.skipGuestToken) {
        await requestGuestAccess();
      }
    } catch (logoutError) {
      console.error('Logout error:', logoutError);
      // 로그아웃은 실패하더라도 로컬 상태는 정리
      dispatch({ type: 'AUTH_LOGOUT' });
      emitEvent('logout', { error: logoutError });
    }
  }, [requestGuestAccess, initOptions, emitEvent]);

  const refreshToken = useCallback(async () => {
    if (!authService.isTokenValid()) {
      return;
    }

    try {
      await authService.refreshToken();
      
      const newToken = await authService.getValidToken();
      const expiresAt = Date.now() + 3600000; // AuthService에서 실제 만료 시간 가져와야 함
      
      dispatch({
        type: 'AUTH_TOKEN_REFRESH_SUCCESS',
        payload: {
          accessToken: newToken,
          expiresAt,
        },
      });

      emitEvent('token_refreshed');
    } catch (refreshError) {
      const errorMessage = refreshError instanceof Error ? refreshError.message : 'Token refresh failed';
      dispatch({
        type: 'AUTH_TOKEN_REFRESH_FAILURE',
        payload: errorMessage,
      });
      emitEvent('token_expired', { error: errorMessage });
      throw loginError;
    }
  }, [emitEvent]);

  // ================================
  // 사용자 관리 메서드들 (미구현)
  // ================================

  const updateProfile = useCallback(async () => {
    throw new Error('Profile update is not yet implemented');
  }, []);

  const changePassword = useCallback(async () => {
    throw new Error('Password change is not yet implemented');
  }, []);

  const requestPasswordReset = useCallback(async () => {
    throw new Error('Password reset is not yet implemented');
  }, []);

  // ================================
  // 권한 확인 메서드들
  // ================================

  const hasPermission = useCallback((action: string): boolean => {
    // 간단한 권한 확인 로직
    switch (action) {
      case 'create':
        return authSelectors.canCreateTodos(state);
      case 'update':
        return authSelectors.canUpdateTodos(state);
      case 'delete':
        return authSelectors.canDeleteTodos(state);
      case 'export':
        return authSelectors.canExport(state);
      default:
        return false;
    }
  }, [state]);

  const canCreateTodos = useCallback(() => authSelectors.canCreateTodos(state), [state]);
  const canUpdateTodos = useCallback(() => authSelectors.canUpdateTodos(state), [state]);
  const canDeleteTodos = useCallback(() => authSelectors.canDeleteTodos(state), [state]);
  
  const getRemainingQuota = useCallback(() => {
    // TODO: 현재 TODO 개수는 외부에서 전달받아야 함
    // 임시로 0으로 설정
    return authSelectors.getRemainingQuota(state, 0);
  }, [state]);

  const isTokenExpiringSoon = useCallback(() => authSelectors.isTokenExpiringSoon(state), [state]);
  const getTimeUntilExpiration = useCallback(() => authSelectors.getTimeUntilExpiration(state), [state]);

  // ================================
  // 유틸리티 메서드들
  // ================================

  const clearError = useCallback(() => {
    dispatch({ type: 'AUTH_ERROR_CLEAR' });
  }, []);

  // ================================
  // 효과 및 이벤트 리스너
  // ================================

  // 초기화
  useEffect(() => {
    initialize();
  }, [initialize]);

  // 토큰 자동 갱신 (만료 5분 전)
  useEffect(() => {
    if (!authSelectors.isTokenValid(state) || authSelectors.isTokenExpiringSoon(state)) {
      return;
    }

    const timeUntilRefresh = getTimeUntilExpiration() - (5 * 60 * 1000); // 5분 전
    
    if (timeUntilRefresh > 0) {
      const timeoutId = setTimeout(() => {
        refreshToken().catch(console.error);
      }, timeUntilRefresh);

      return () => clearTimeout(timeoutId);
    }
  }, [state, getTimeUntilExpiration, refreshToken]);

  // ================================
  // Context 값 생성
  // ================================

  const contextValue: AuthContextType = {
    state,
    login,
    register,
    logout,
    refreshToken,
    updateProfile,
    changePassword,
    requestPasswordReset,
    hasPermission,
    canCreateTodos,
    canUpdateTodos,
    canDeleteTodos,
    getRemainingQuota,
    isTokenExpiringSoon,
    getTimeUntilExpiration,
    clearError,
    addEventListener,
    removeEventListener,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * AuthContext를 사용하는 훅
 */
/* eslint-disable react-refresh/only-export-components */
export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}