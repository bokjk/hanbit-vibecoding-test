/**
 * 환경별 설정 인터페이스 및 타입 정의
 */
export interface EnvironmentConfig {
  /** 환경 이름 */
  name: string;
  /** AWS 리전 */
  region: string;
  /** 스택 이름 접미사 */
  stackSuffix: string;
  /** 태그 설정 */
  tags: Record<string, string>;
  /** DynamoDB 설정 */
  database: {
    /** 읽기 용량 단위 */
    readCapacity: number;
    /** 쓰기 용량 단위 */
    writeCapacity: number;
    /** 백업 활성화 여부 */
    backupEnabled: boolean;
    /** 포인트인타임 복구 활성화 여부 */
    pointInTimeRecoveryEnabled: boolean;
  };
  /** Lambda 설정 */
  lambda: {
    /** 메모리 크기 (MB) */
    memorySize: number;
    /** 타임아웃 (초) */
    timeout: number;
    /** 로그 보존 기간 (일) */
    logRetentionDays: number;
    /** 환경 변수 */
    environment: Record<string, string>;
  };
  /** API Gateway 설정 */
  api: {
    /** 요청 제한 */
    throttling: {
      burstLimit: number;
      rateLimit: number;
    };
    /** 로그 레벨 */
    logLevel: 'INFO' | 'ERROR' | 'OFF';
    /** 메트릭 활성화 여부 */
    metricsEnabled: boolean;
  };
  /** 모니터링 설정 */
  monitoring: {
    /** 알림 이메일 */
    alertEmail?: string;
    /** Slack Webhook URL */
    slackWebhookUrl?: string;
    /** 대시보드 활성화 여부 */
    dashboardEnabled: boolean;
    /** 상세 모니터링 활성화 여부 */
    detailedMonitoringEnabled: boolean;
  };
  /** 보안 설정 */
  security: {
    /** CORS 허용 오리진 */
    corsAllowedOrigins: string[];
    /** JWT 토큰 만료 시간 (시간) */
    jwtExpirationHours: number;
    /** 비밀번호 정책 */
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSymbols: boolean;
    };
  };
}

/**
 * 개발 환경 설정
 */
export const developmentConfig: EnvironmentConfig = {
  name: 'development',
  region: 'ap-northeast-2',
  stackSuffix: 'Dev',
  tags: {
    Environment: 'development',
    Project: 'HanbitTodo',
    Owner: 'Development Team',
    CostCenter: 'Dev',
  },
  database: {
    readCapacity: 1,
    writeCapacity: 1,
    backupEnabled: false,
    pointInTimeRecoveryEnabled: false,
  },
  lambda: {
    memorySize: 256,
    timeout: 30,
    logRetentionDays: 7,
    environment: {
      LOG_LEVEL: 'DEBUG',
      NODE_ENV: 'development',
      ENABLE_CORS: 'true',
      ENABLE_DEBUG: 'true',
    },
  },
  api: {
    throttling: {
      burstLimit: 200,
      rateLimit: 100,
    },
    logLevel: 'INFO',
    metricsEnabled: true,
  },
  monitoring: {
    dashboardEnabled: true,
    detailedMonitoringEnabled: false,
  },
  security: {
    corsAllowedOrigins: ['http://localhost:5173', 'http://localhost:3000'],
    jwtExpirationHours: 24,
    passwordPolicy: {
      minLength: 6,
      requireUppercase: false,
      requireLowercase: false,
      requireNumbers: false,
      requireSymbols: false,
    },
  },
};

/**
 * 테스트 환경 설정
 */
export const testConfig: EnvironmentConfig = {
  name: 'test',
  region: 'ap-northeast-2',
  stackSuffix: 'Test',
  tags: {
    Environment: 'test',
    Project: 'HanbitTodo',
    Owner: 'QA Team',
    CostCenter: 'Test',
  },
  database: {
    readCapacity: 2,
    writeCapacity: 2,
    backupEnabled: true,
    pointInTimeRecoveryEnabled: false,
  },
  lambda: {
    memorySize: 512,
    timeout: 60,
    logRetentionDays: 14,
    environment: {
      LOG_LEVEL: 'INFO',
      NODE_ENV: 'test',
      ENABLE_CORS: 'true',
      ENABLE_DEBUG: 'false',
    },
  },
  api: {
    throttling: {
      burstLimit: 500,
      rateLimit: 250,
    },
    logLevel: 'INFO',
    metricsEnabled: true,
  },
  monitoring: {
    dashboardEnabled: true,
    detailedMonitoringEnabled: true,
  },
  security: {
    corsAllowedOrigins: ['https://test.hanbit-todo.com'],
    jwtExpirationHours: 12,
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: false,
    },
  },
};

/**
 * 프로덕션 환경 설정
 */
export const productionConfig: EnvironmentConfig = {
  name: 'production',
  region: 'ap-northeast-2',
  stackSuffix: 'Prod',
  tags: {
    Environment: 'production',
    Project: 'HanbitTodo',
    Owner: 'Operations Team',
    CostCenter: 'Production',
  },
  database: {
    readCapacity: 5,
    writeCapacity: 5,
    backupEnabled: true,
    pointInTimeRecoveryEnabled: true,
  },
  lambda: {
    memorySize: 1024,
    timeout: 30,
    logRetentionDays: 30,
    environment: {
      LOG_LEVEL: 'ERROR',
      NODE_ENV: 'production',
      ENABLE_CORS: 'true',
      ENABLE_DEBUG: 'false',
    },
  },
  api: {
    throttling: {
      burstLimit: 2000,
      rateLimit: 1000,
    },
    logLevel: 'ERROR',
    metricsEnabled: true,
  },
  monitoring: {
    dashboardEnabled: true,
    detailedMonitoringEnabled: true,
  },
  security: {
    corsAllowedOrigins: ['https://hanbit-todo.com', 'https://www.hanbit-todo.com'],
    jwtExpirationHours: 8,
    passwordPolicy: {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: true,
    },
  },
};

/**
 * 환경에 따른 설정 반환
 */
export function getEnvironmentConfig(environment: string): EnvironmentConfig {
  switch (environment.toLowerCase()) {
    case 'dev':
    case 'development':
      return developmentConfig;
    case 'test':
    case 'testing':
      return testConfig;
    case 'prod':
    case 'production':
      return productionConfig;
    default:
      console.warn(`알 수 없는 환경: ${environment}. 개발 환경 설정을 사용합니다.`);
      return developmentConfig;
  }
}

/**
 * 현재 환경 설정 반환
 */
export function getCurrentEnvironmentConfig(): EnvironmentConfig {
  const environment = process.env.NODE_ENV || process.env.ENVIRONMENT || 'development';
  return getEnvironmentConfig(environment);
}
