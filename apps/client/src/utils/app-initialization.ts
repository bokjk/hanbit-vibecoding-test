import { appConfig } from '../config/app-config';

/**
 * 앱 초기화 결과
 */
export interface AppInitResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  config: {
    apiMode: boolean;
    offlineMode: boolean;
    debugMode: boolean;
    authMode: 'guest' | 'authenticated';
  };
}

/**
 * 앱 초기화 함수
 * 환경 설정 검증, 설정 로그 출력 등을 수행합니다
 */
export async function initializeApp(): Promise<AppInitResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // 설정 검증
    const validation = appConfig.validate();
    if (!validation.isValid) {
      errors.push(...validation.errors);
    }

    // 개발 모드에서 설정 로그 출력
    if (appConfig.features.debugMode) {
      appConfig.logConfig();
    }

    // API 모드 관련 검증
    if (appConfig.features.apiMode) {
      if (!appConfig.api.baseURL) {
        errors.push('API mode is enabled but API base URL is not configured');
      }

      // 인증 모드 관련 검증
      if (appConfig.auth.mode === 'authenticated') {
        const { cognito } = appConfig.auth;
        if (!cognito.userPoolId || !cognito.userPoolClientId || !cognito.identityPoolId) {
          warnings.push('Authenticated mode is configured but Cognito settings are incomplete');
        }
      }

      // 네트워크 연결 확인 (선택적)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        warnings.push('No network connection detected. API features may not work properly.');
      }
    }

    // 로컬 스토리지 지원 확인
    try {
      const testKey = '__test_storage__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
    } catch {
      errors.push('localStorage is not available. The app may not function properly.');
    }

    // Web Crypto API 지원 확인 (ID 생성용)
    if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
      warnings.push('Web Crypto API is not fully supported. Fallback ID generation will be used.');
    }

    // Fetch API 지원 확인 (API 모드용)
    if (appConfig.features.apiMode && typeof fetch === 'undefined') {
      errors.push('Fetch API is not available. API mode cannot be used.');
    }

    // 성공적인 초기화
    const result: AppInitResult = {
      success: errors.length === 0,
      errors,
      warnings,
      config: {
        apiMode: appConfig.features.apiMode,
        offlineMode: appConfig.features.offlineMode,
        debugMode: appConfig.features.debugMode,
        authMode: appConfig.auth.mode,
      },
    };

    // 초기화 결과 로그 출력
    if (appConfig.features.debugMode) {
      console.group('🚀 App Initialization Result');
      console.log('Success:', result.success);
      console.log('Config:', result.config);
      
      if (warnings.length > 0) {
        console.warn('Warnings:', warnings);
      }
      
      if (errors.length > 0) {
        console.error('Errors:', errors);
      }
      
      console.groupEnd();
    }

    return result;

  } catch (error) {
    // 예상치 못한 초기화 오류
    const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
    errors.push(`Initialization failed: ${errorMessage}`);

    if (appConfig.features.debugMode) {
      console.error('❌ App initialization failed:', error);
    }

    return {
      success: false,
      errors,
      warnings,
      config: {
        apiMode: false,
        offlineMode: true,
        debugMode: false,
        authMode: 'guest',
      },
    };
  }
}

/**
 * 런타임 환경 정보를 수집합니다
 */
export function getEnvironmentInfo(): {
  userAgent: string;
  platform: string;
  isOnline: boolean;
  storageSupport: {
    localStorage: boolean;
    sessionStorage: boolean;
  };
  apiSupport: {
    fetch: boolean;
    crypto: boolean;
    webWorker: boolean;
  };
} {
  return {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : false,
    storageSupport: {
      localStorage: (() => {
        try {
          return typeof localStorage !== 'undefined';
        } catch {
          return false;
        }
      })(),
      sessionStorage: (() => {
        try {
          return typeof sessionStorage !== 'undefined';
        } catch {
          return false;
        }
      })(),
    },
    apiSupport: {
      fetch: typeof fetch !== 'undefined',
      crypto: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function',
      webWorker: typeof Worker !== 'undefined',
    },
  };
}

/**
 * 앱 종료 시 정리 작업을 수행합니다
 */
export function cleanupApp(): void {
  try {
    // UnifiedTodoService 정리
    // 동적 import를 사용하여 순환 의존성 방지
    import('../services/unified-todo.service').then(({ unifiedTodoService }) => {
      if (typeof unifiedTodoService.dispose === 'function') {
        unifiedTodoService.dispose();
      }
    }).catch(() => {
      // 정리 실패는 무시
    });

    // 브라우저 이벤트 리스너 정리는 각 컴포넌트/훅에서 처리

    if (appConfig.features.debugMode) {
      console.log('🧹 App cleanup completed');
    }
  } catch (error) {
    if (appConfig.features.debugMode) {
      console.warn('⚠️ App cleanup failed:', error);
    }
  }
}