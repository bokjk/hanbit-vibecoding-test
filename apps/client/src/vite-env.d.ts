/// <reference types="vite/client" />

interface ImportMetaEnv {
  // API 설정
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_TIMEOUT: string;
  
  // 인증 설정
  readonly VITE_AUTH_MODE: 'guest' | 'authenticated';
  readonly VITE_COGNITO_USER_POOL_ID: string;
  readonly VITE_COGNITO_USER_POOL_CLIENT_ID: string;
  readonly VITE_COGNITO_IDENTITY_POOL_ID: string;
  
  // 재시도 설정
  readonly VITE_RETRY_ATTEMPTS: string;
  readonly VITE_RETRY_DELAY: string;
  
  // 기능 토글
  readonly VITE_ENABLE_OFFLINE_MODE: string;
  readonly VITE_ENABLE_API_MODE: string;
  readonly VITE_DEBUG_MODE: string;
  
  // 로깅 설정
  readonly VITE_LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
