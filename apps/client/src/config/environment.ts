/**
 * 클라이언트 측 환경별 설정
 * 빌드 시점에 환경 변수를 통해 설정이 주입됩니다.
 */

/**
 * 환경 타입
 */
export type Environment = "development" | "test" | "production";

/**
 * 클라이언트 설정 인터페이스
 */
export interface ClientConfig {
  /** 환경 정보 */
  environment: Environment;
  /** API 기본 URL */
  apiBaseUrl: string;
  /** 애플리케이션 이름 */
  appName: string;
  /** 애플리케이션 버전 */
  appVersion: string;
  /** 디버그 모드 활성화 여부 */
  debugMode: boolean;
  /** 인증 설정 */
  auth: {
    /** Cognito User Pool ID */
    userPoolId: string;
    /** Cognito User Pool Client ID */
    userPoolClientId: string;
    /** Cognito Identity Pool ID */
    identityPoolId: string;
    /** JWT 토큰 만료 시간 (시간) */
    tokenExpirationHours: number;
  };
  /** 기능 플래그 */
  features: {
    /** 오프라인 모드 지원 */
    offlineMode: boolean;
    /** 분석 추적 활성화 */
    analytics: boolean;
    /** 에러 보고 활성화 */
    errorReporting: boolean;
    /** 성능 모니터링 활성화 */
    performanceMonitoring: boolean;
  };
  /** 성능 설정 */
  performance: {
    /** API 요청 타임아웃 (밀리초) */
    apiTimeoutMs: number;
    /** 재시도 횟수 */
    retryCount: number;
    /** 로컬 스토리지 만료 시간 (일) */
    cacheExpirationDays: number;
  };
  /** 보안 설정 */
  security: {
    /** Content Security Policy 논스 활성화 */
    enableCSPNonce: boolean;
    /** XSS 보호 활성화 */
    enableXSSProtection: boolean;
  };
}

/**
 * 환경별 기본 설정
 */
const baseConfigs: Record<Environment, ClientConfig> = {
  development: {
    environment: "development",
    apiBaseUrl:
      import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api",
    appName: "Hanbit TODO (개발)",
    appVersion: import.meta.env.VITE_APP_VERSION || "1.0.0",
    debugMode: true,
    auth: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
      userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || "",
      identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID || "",
      tokenExpirationHours: 24,
    },
    features: {
      offlineMode: true,
      analytics: false,
      errorReporting: true,
      performanceMonitoring: true,
    },
    performance: {
      apiTimeoutMs: 10000,
      retryCount: 3,
      cacheExpirationDays: 1,
    },
    security: {
      enableCSPNonce: false,
      enableXSSProtection: true,
    },
  },
  test: {
    environment: "test",
    apiBaseUrl:
      import.meta.env.VITE_API_BASE_URL || "https://test-api.hanbit-todo.com",
    appName: "Hanbit TODO (테스트)",
    appVersion: import.meta.env.VITE_APP_VERSION || "1.0.0",
    debugMode: false,
    auth: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
      userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || "",
      identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID || "",
      tokenExpirationHours: 12,
    },
    features: {
      offlineMode: true,
      analytics: true,
      errorReporting: true,
      performanceMonitoring: true,
    },
    performance: {
      apiTimeoutMs: 8000,
      retryCount: 2,
      cacheExpirationDays: 3,
    },
    security: {
      enableCSPNonce: true,
      enableXSSProtection: true,
    },
  },
  production: {
    environment: "production",
    apiBaseUrl:
      import.meta.env.VITE_API_BASE_URL || "https://api.hanbit-todo.com",
    appName: "Hanbit TODO",
    appVersion: import.meta.env.VITE_APP_VERSION || "1.0.0",
    debugMode: false,
    auth: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
      userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || "",
      identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID || "",
      tokenExpirationHours: 8,
    },
    features: {
      offlineMode: true,
      analytics: true,
      errorReporting: true,
      performanceMonitoring: true,
    },
    performance: {
      apiTimeoutMs: 5000,
      retryCount: 1,
      cacheExpirationDays: 7,
    },
    security: {
      enableCSPNonce: true,
      enableXSSProtection: true,
    },
  },
};

/**
 * 현재 환경 감지
 */
function detectEnvironment(): Environment {
  // Vite 환경 변수에서 환경 확인
  const viteMode = import.meta.env.MODE;
  const nodeEnv = import.meta.env.VITE_NODE_ENV;

  // 명시적으로 설정된 환경이 있으면 사용
  if (nodeEnv && ["development", "test", "production"].includes(nodeEnv)) {
    return nodeEnv as Environment;
  }

  // Vite 모드 기반 환경 결정
  switch (viteMode) {
    case "development":
    case "dev":
      return "development";
    case "test":
    case "testing":
      return "test";
    case "production":
    case "prod":
      return "production";
    default:
      console.warn(
        `알 수 없는 환경 모드: ${viteMode}. 개발 환경으로 설정합니다.`,
      );
      return "development";
  }
}

/**
 * 환경별 설정 검증
 */
function validateConfig(config: ClientConfig): void {
  const errors: string[] = [];

  // 필수 필드 검증
  if (!config.apiBaseUrl) {
    errors.push("API 기본 URL이 설정되지 않았습니다.");
  }

  // 프로덕션 환경에서는 인증 설정 필수
  if (config.environment === "production") {
    if (!config.auth.userPoolId) {
      errors.push("Cognito User Pool ID가 설정되지 않았습니다.");
    }
    if (!config.auth.userPoolClientId) {
      errors.push("Cognito User Pool Client ID가 설정되지 않았습니다.");
    }
  }

  // URL 형식 검증
  try {
    new URL(config.apiBaseUrl);
  } catch {
    errors.push("API 기본 URL 형식이 올바르지 않습니다.");
  }

  if (errors.length > 0) {
    const errorMessage = `환경 설정 검증 실패:\n${errors.join("\n")}`;
    console.error(errorMessage);

    // 프로덕션에서는 에러 발생, 개발환경에서는 경고만
    if (config.environment === "production") {
      throw new Error(errorMessage);
    }
  }
}

/**
 * 현재 환경 설정 가져오기
 */
export function getEnvironmentConfig(): ClientConfig {
  const environment = detectEnvironment();
  const config = { ...baseConfigs[environment] };

  // 환경 변수로 런타임 오버라이드 지원
  if (import.meta.env.VITE_DEBUG_MODE !== undefined) {
    config.debugMode = import.meta.env.VITE_DEBUG_MODE === "true";
  }

  if (import.meta.env.VITE_OFFLINE_MODE !== undefined) {
    config.features.offlineMode = import.meta.env.VITE_OFFLINE_MODE === "true";
  }

  // 추가 환경 변수 매핑
  if (import.meta.env.VITE_ENABLE_ANALYTICS !== undefined) {
    config.features.analytics =
      import.meta.env.VITE_ENABLE_ANALYTICS === "true";
  }

  if (import.meta.env.VITE_ENABLE_ERROR_REPORTING !== undefined) {
    config.features.errorReporting =
      import.meta.env.VITE_ENABLE_ERROR_REPORTING === "true";
  }

  if (import.meta.env.VITE_ENABLE_MONITORING !== undefined) {
    config.features.performanceMonitoring =
      import.meta.env.VITE_ENABLE_MONITORING === "true";
  }

  if (import.meta.env.VITE_API_TIMEOUT) {
    config.performance.apiTimeoutMs = parseInt(
      import.meta.env.VITE_API_TIMEOUT,
      10,
    );
  }

  if (import.meta.env.VITE_RETRY_COUNT) {
    config.performance.retryCount = parseInt(
      import.meta.env.VITE_RETRY_COUNT,
      10,
    );
  }

  if (import.meta.env.VITE_ENABLE_CSP_NONCE !== undefined) {
    config.security.enableCSPNonce =
      import.meta.env.VITE_ENABLE_CSP_NONCE === "true";
  }

  // 설정 검증
  validateConfig(config);

  // 개발 환경에서 설정 정보 출력
  if (config.debugMode) {
    console.log("🔧 환경 설정 로드됨:", {
      environment: config.environment,
      apiBaseUrl: config.apiBaseUrl,
      features: config.features,
    });
  }

  return config;
}

/**
 * 글로벌 설정 객체
 */
export const appConfig = getEnvironmentConfig();

/**
 * 환경 관련 헬퍼 함수들
 */
export const isProduction = () => appConfig.environment === "production";
export const isDevelopment = () => appConfig.environment === "development";
export const isTest = () => appConfig.environment === "test";

/**
 * 기능 플래그 확인 헬퍼
 */
export const isFeatureEnabled = (
  feature: keyof ClientConfig["features"],
): boolean => {
  return appConfig.features[feature];
};

/**
 * API URL 생성 헬퍼
 */
export const createApiUrl = (path: string): string => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${appConfig.apiBaseUrl}${cleanPath}`;
};

/**
 * 환경별 로그 레벨 확인
 */
export const shouldLog = (
  level: "debug" | "info" | "warn" | "error",
): boolean => {
  if (!appConfig.debugMode) {
    return level !== "debug";
  }
  return true;
};
