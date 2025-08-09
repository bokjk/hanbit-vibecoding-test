import { appConfig } from '../config/app-config';
import type { GuestTokenResponse, RefreshTokenResponse, UserInfoResponse } from '../types/api.types';
import { APIError } from '../errors/api-error';

/**
 * 토큰 정보 인터페이스
 */
interface TokenInfo {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: 'guest' | 'authenticated';
}

/**
 * 인증 서비스 클래스
 * JWT 토큰 관리, 자동 갱신, 인증 상태 관리를 담당합니다
 */
export class AuthService {
  private static instance: AuthService;
  private tokenInfo: TokenInfo | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private readonly TOKEN_KEY = 'auth_token_info';
  private readonly REFRESH_MARGIN = 5 * 60 * 1000; // 만료 5분 전에 갱신

  private constructor() {
    this.loadTokenFromStorage();
    this.setupRefreshTimer();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * 현재 토큰이 유효한지 확인
   */
  isTokenValid(): boolean {
    if (!this.tokenInfo) return false;
    return Date.now() < this.tokenInfo.expiresAt;
  }

  /**
   * 인증된 사용자인지 확인
   */
  isAuthenticated(): boolean {
    return this.isTokenValid() && this.tokenInfo?.tokenType === 'authenticated';
  }

  /**
   * 게스트 사용자인지 확인
   */
  isGuest(): boolean {
    return this.isTokenValid() && this.tokenInfo?.tokenType === 'guest';
  }

  /**
   * 유효한 토큰을 반환 (자동 갱신 포함)
   */
  async getValidToken(): Promise<string> {
    // 토큰이 없거나 만료된 경우
    if (!this.isTokenValid()) {
      await this.refreshOrRequestGuestToken();
    }

    // 토큰이 곧 만료될 예정인 경우 미리 갱신
    if (this.tokenInfo && this.isTokenExpiringSoon()) {
      try {
        await this.refreshToken();
      } catch (error) {
        // 갱신 실패 시 새로운 게스트 토큰 요청
        console.warn('Token refresh failed, requesting new guest token:', error);
        await this.requestGuestToken();
      }
    }

    if (!this.tokenInfo) {
      throw new Error('Unable to obtain valid token');
    }

    return this.tokenInfo.accessToken;
  }

  /**
   * 게스트 토큰 요청
   */
  async requestGuestToken(): Promise<GuestTokenResponse> {
    try {
      const response = await fetch(`${appConfig.api.baseURL}/auth/guest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(appConfig.api.timeout),
      });

      if (!response.ok) {
        throw await APIError.fromResponse(response);
      }

      const data: GuestTokenResponse = await response.json();
      
      // 토큰 정보 저장
      this.tokenInfo = {
        accessToken: data.guestToken,
        expiresAt: Date.now() + (data.expiresIn * 1000),
        tokenType: 'guest',
      };

      this.saveTokenToStorage();
      this.setupRefreshTimer();

      if (appConfig.features.debugMode) {
        console.log('🎫 Guest token obtained successfully');
      }

      return data;
    } catch (error) {
      if (error instanceof TypeError) {
        throw APIError.createNetworkError(error);
      }
      if (error.name === 'AbortError') {
        throw APIError.createTimeoutError();
      }
      throw error;
    }
  }

  /**
   * 토큰 갱신
   */
  async refreshToken(): Promise<void> {
    if (!this.tokenInfo?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${appConfig.api.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.tokenInfo.refreshToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(appConfig.api.timeout),
      });

      if (!response.ok) {
        throw await APIError.fromResponse(response);
      }

      const data: RefreshTokenResponse = await response.json();
      
      // 토큰 정보 업데이트
      this.tokenInfo = {
        ...this.tokenInfo,
        accessToken: data.accessToken,
        expiresAt: Date.now() + (data.expiresIn * 1000),
      };

      this.saveTokenToStorage();
      this.setupRefreshTimer();

      if (appConfig.features.debugMode) {
        console.log('🔄 Token refreshed successfully');
      }
    } catch (error) {
      if (error instanceof TypeError) {
        throw APIError.createNetworkError(error);
      }
      if (error.name === 'AbortError') {
        throw APIError.createTimeoutError();
      }
      throw error;
    }
  }

  /**
   * 사용자 정보 조회
   */
  async getUserInfo(): Promise<UserInfoResponse> {
    const token = await this.getValidToken();

    try {
      const response = await fetch(`${appConfig.api.baseURL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(appConfig.api.timeout),
      });

      if (!response.ok) {
        throw await APIError.fromResponse(response);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof TypeError) {
        throw APIError.createNetworkError(error);
      }
      if (error.name === 'AbortError') {
        throw APIError.createTimeoutError();
      }
      throw error;
    }
  }

  /**
   * 로그아웃
   */
  logout(): void {
    this.tokenInfo = null;
    this.clearTokenFromStorage();
    this.clearRefreshTimer();

    if (appConfig.features.debugMode) {
      console.log('👋 Logged out successfully');
    }
  }

  /**
   * 토큰이 곧 만료될 예정인지 확인
   */
  private isTokenExpiringSoon(): boolean {
    if (!this.tokenInfo) return false;
    return Date.now() + this.REFRESH_MARGIN >= this.tokenInfo.expiresAt;
  }

  /**
   * 토큰 갱신 또는 새로운 게스트 토큰 요청
   */
  private async refreshOrRequestGuestToken(): Promise<void> {
    try {
      if (this.tokenInfo?.refreshToken) {
        await this.refreshToken();
      } else {
        await this.requestGuestToken();
      }
    } catch (error) {
      // 갱신 실패 시 게스트 토큰 요청
      if (this.tokenInfo?.refreshToken) {
        console.warn('Token refresh failed, requesting new guest token:', error);
        await this.requestGuestToken();
      } else {
        throw error;
      }
    }
  }

  /**
   * 자동 갱신 타이머 설정
   */
  private setupRefreshTimer(): void {
    this.clearRefreshTimer();

    if (!this.tokenInfo || !this.isTokenValid()) return;

    const refreshTime = this.tokenInfo.expiresAt - Date.now() - this.REFRESH_MARGIN;
    
    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshOrRequestGuestToken().catch(console.error);
      }, refreshTime);

      if (appConfig.features.debugMode) {
        console.log(`⏰ Token refresh scheduled in ${Math.round(refreshTime / 1000)}s`);
      }
    }
  }

  /**
   * 자동 갱신 타이머 해제
   */
  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * localStorage에서 토큰 정보 로드
   */
  private loadTokenFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.TOKEN_KEY);
      if (stored) {
        this.tokenInfo = JSON.parse(stored);
        
        // 만료된 토큰은 제거
        if (!this.isTokenValid()) {
          this.clearTokenFromStorage();
          this.tokenInfo = null;
        }
      }
    } catch (error) {
      console.error('Failed to load token from storage:', error);
      this.clearTokenFromStorage();
    }
  }

  /**
   * localStorage에 토큰 정보 저장
   */
  private saveTokenToStorage(): void {
    try {
      if (this.tokenInfo) {
        localStorage.setItem(this.TOKEN_KEY, JSON.stringify(this.tokenInfo));
      }
    } catch (error) {
      console.error('Failed to save token to storage:', error);
    }
  }

  /**
   * localStorage에서 토큰 정보 제거
   */
  private clearTokenFromStorage(): void {
    try {
      localStorage.removeItem(this.TOKEN_KEY);
    } catch (error) {
      console.error('Failed to clear token from storage:', error);
    }
  }
}

// 전역 인증 서비스 인스턴스 내보내기
export const authService = AuthService.getInstance();