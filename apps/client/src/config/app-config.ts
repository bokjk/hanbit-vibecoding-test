/**
 * 애플리케이션 환경 설정을 관리하는 클래스
 * 환경변수를 읽어와 타입 안전한 설정 객체를 제공합니다
 */
export class AppConfig {
  private static instance: AppConfig;

  private constructor() {}

  static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }

  // API 관련 설정
  get api() {
    return {
      baseURL:
        import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1",
      timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || "10000", 10),
      retryAttempts: parseInt(import.meta.env.VITE_RETRY_ATTEMPTS || "3", 10),
      retryDelay: parseInt(import.meta.env.VITE_RETRY_DELAY || "1000", 10),
    };
  }

  // 인증 관련 설정
  get auth() {
    return {
      mode: (import.meta.env.VITE_AUTH_MODE || "guest") as
        | "guest"
        | "authenticated",
      cognito: {
        userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || "",
        userPoolClientId:
          import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || "",
        identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID || "",
      },
    };
  }

  // 기능 토글 설정
  get features() {
    return {
      offlineMode: import.meta.env.VITE_ENABLE_OFFLINE_MODE === "true",
      apiMode: import.meta.env.VITE_ENABLE_API_MODE === "true",
      debugMode: import.meta.env.VITE_DEBUG_MODE === "true",
    };
  }

  // 로깅 설정
  get logging() {
    return {
      level: (import.meta.env.VITE_LOG_LEVEL || "info") as
        | "debug"
        | "info"
        | "warn"
        | "error",
    };
  }

  // 전체 설정 검증
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // API 기본 URL 검증
    if (!this.api.baseURL) {
      errors.push("VITE_API_BASE_URL is required");
    }

    // 인증 모드가 authenticated일 때 Cognito 설정 검증
    if (this.auth.mode === "authenticated") {
      if (!this.auth.cognito.userPoolId) {
        errors.push(
          "VITE_COGNITO_USER_POOL_ID is required for authenticated mode",
        );
      }
      if (!this.auth.cognito.userPoolClientId) {
        errors.push(
          "VITE_COGNITO_USER_POOL_CLIENT_ID is required for authenticated mode",
        );
      }
      if (!this.auth.cognito.identityPoolId) {
        errors.push(
          "VITE_COGNITO_IDENTITY_POOL_ID is required for authenticated mode",
        );
      }
    }

    // 타임아웃 값 검증
    if (this.api.timeout < 1000) {
      errors.push("API timeout must be at least 1000ms");
    }

    // 재시도 횟수 검증
    if (this.api.retryAttempts < 1 || this.api.retryAttempts > 10) {
      errors.push("Retry attempts must be between 1 and 10");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // 개발 모드 여부 확인
  get isDevelopment(): boolean {
    return import.meta.env.DEV;
  }

  // 프로덕션 모드 여부 확인
  get isProduction(): boolean {
    return import.meta.env.PROD;
  }

  // 설정 요약 로그 출력
  logConfig(): void {
    if (this.features.debugMode) {
      console.group("🔧 App Configuration");
      console.log(
        "Environment:",
        this.isDevelopment ? "development" : "production",
      );
      console.log("API Base URL:", this.api.baseURL);
      console.log("Auth Mode:", this.auth.mode);
      console.log("Features:", this.features);
      console.log("Logging Level:", this.logging.level);
      console.groupEnd();

      const validation = this.validate();
      if (!validation.isValid) {
        console.warn("⚠️ Configuration Errors:", validation.errors);
      } else {
        console.log("✅ Configuration is valid");
      }
    }
  }
}

// 전역 설정 인스턴스 내보내기
export const appConfig = AppConfig.getInstance();
