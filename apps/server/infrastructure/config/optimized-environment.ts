/**
 * 최적화된 환경별 설정
 * 비용, 성능, 보안을 균형있게 고려한 설정
 */
export interface OptimizedEnvironmentConfig {
  /** 기본 설정 */
  name: string;
  region: string;
  stackSuffix: string;
  tags: Record<string, string>;

  /** 데이터베이스 설정 */
  database: {
    billingMode: 'PROVISIONED' | 'PAY_PER_REQUEST';
    readCapacity?: number;
    writeCapacity?: number;
    autoScaling?: {
      minCapacity: number;
      maxCapacity: number;
      targetUtilization: number;
    };
    backupEnabled: boolean;
    pointInTimeRecoveryEnabled: boolean;
    streamEnabled: boolean;
    contributorInsightsEnabled: boolean;
    encryptionType: 'AWS_MANAGED' | 'CUSTOMER_MANAGED';
    ttlEnabled: boolean;
    globalSecondaryIndexes: {
      projectionType: 'ALL' | 'INCLUDE' | 'KEYS_ONLY';
      attributes?: string[];
    };
  };

  /** Lambda 설정 */
  lambda: {
    runtime: 'nodejs18.x' | 'nodejs20.x';
    architecture: 'x86_64' | 'arm64';
    memorySize: number;
    timeout: number;
    logRetentionDays: number;
    reservedConcurrency?: number;
    provisionedConcurrency?: number;
    tracingMode: 'Active' | 'PassThrough';
    insightsEnabled: boolean;
    environment: Record<string, string>;
    layers: {
      commonDependencies: boolean;
      lambdaInsights: boolean;
      powertools: boolean;
    };
  };

  /** API Gateway 설정 */
  api: {
    throttling: {
      burstLimit: number;
      rateLimit: number;
    };
    logLevel: 'INFO' | 'ERROR' | 'OFF';
    metricsEnabled: boolean;
    tracingEnabled: boolean;
    cachingEnabled: boolean;
    cacheClusterSize?: string;
    compressionEnabled: boolean;
    minimumCompressionSize: number;
  };

  /** 네트워크 및 보안 */
  network: {
    vpcEnabled: boolean;
    natGateways?: number;
    maxAzs?: number;
    vpcEndpoints?: string[];
    flowLogsEnabled: boolean;
  };

  security: {
    wafEnabled: boolean;
    wafRules?: string[];
    secretsEncryption: 'AWS_MANAGED' | 'CUSTOMER_MANAGED';
    keyRotationEnabled: boolean;
    corsAllowedOrigins: string[];
    jwtExpirationHours: number;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSymbols: boolean;
    };
  };

  /** 모니터링 설정 */
  monitoring: {
    dashboardEnabled: boolean;
    detailedMetricsEnabled: boolean;
    customMetricsEnabled: boolean;
    alarmingEnabled: boolean;
    alertEmail?: string;
    alertingThresholds: {
      errorRate: number;
      throttleRate: number;
      duration: number;
      concurrentExecutions: number;
    };
    logAnalyticsEnabled: boolean;
    tracingEnabled: boolean;
  };

  /** 비용 최적화 */
  costOptimization: {
    level: 'AGGRESSIVE' | 'BALANCED' | 'PERFORMANCE_FIRST';
    budgetLimit: number;
    autoShutdown?: {
      enabled: boolean;
      schedule?: string;
    };
    rightsizing: {
      enabled: boolean;
      checkFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    };
    savingsPlans: {
      eligible: boolean;
      type?: 'COMPUTE' | 'EC2_INSTANCE';
    };
    reservedCapacity: {
      eligible: boolean;
      term?: 'ONE_YEAR' | 'THREE_YEAR';
    };
  };
}

/**
 * 개발 환경 설정 - 최소 비용 최적화
 */
export const optimizedDevelopmentConfig: OptimizedEnvironmentConfig = {
  name: 'development',
  region: 'ap-northeast-2',
  stackSuffix: 'Dev',
  tags: {
    Environment: 'development',
    Project: 'HanbitTodo',
    Owner: 'Development Team',
    CostCenter: 'Dev',
    ManagedBy: 'CDK',
    AutoShutdown: 'true',
  },

  database: {
    billingMode: 'PAY_PER_REQUEST',
    backupEnabled: false,
    pointInTimeRecoveryEnabled: false,
    streamEnabled: false,
    contributorInsightsEnabled: false,
    encryptionType: 'AWS_MANAGED',
    ttlEnabled: true,
    globalSecondaryIndexes: {
      projectionType: 'KEYS_ONLY', // 비용 절감
    },
  },

  lambda: {
    runtime: 'nodejs20.x',
    architecture: 'arm64', // 비용 절감
    memorySize: 256,
    timeout: 30,
    logRetentionDays: 7,
    tracingMode: 'PassThrough', // X-Ray 비용 절감
    insightsEnabled: false,
    environment: {
      LOG_LEVEL: 'DEBUG',
      NODE_ENV: 'development',
      ENABLE_CORS: 'true',
      ENABLE_DEBUG: 'true',
    },
    layers: {
      commonDependencies: true,
      lambdaInsights: false,
      powertools: false,
    },
  },

  api: {
    throttling: {
      burstLimit: 200,
      rateLimit: 100,
    },
    logLevel: 'INFO',
    metricsEnabled: false, // 비용 절감
    tracingEnabled: false,
    cachingEnabled: false,
    compressionEnabled: false,
    minimumCompressionSize: 1024,
  },

  network: {
    vpcEnabled: false, // VPC 비용 절감
    flowLogsEnabled: false,
  },

  security: {
    wafEnabled: false,
    secretsEncryption: 'AWS_MANAGED',
    keyRotationEnabled: false,
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

  monitoring: {
    dashboardEnabled: true,
    detailedMetricsEnabled: false,
    customMetricsEnabled: false,
    alarmingEnabled: false,
    alertingThresholds: {
      errorRate: 50,
      throttleRate: 20,
      duration: 30000,
      concurrentExecutions: 100,
    },
    logAnalyticsEnabled: false,
    tracingEnabled: false,
  },

  costOptimization: {
    level: 'AGGRESSIVE',
    budgetLimit: 100,
    autoShutdown: {
      enabled: true,
      schedule: '0 19 ? * MON-FRI *', // 평일 저녁 7시
    },
    rightsizing: {
      enabled: true,
      checkFrequency: 'WEEKLY',
    },
    savingsPlans: {
      eligible: false,
    },
    reservedCapacity: {
      eligible: false,
    },
  },
};

/**
 * 테스트 환경 설정 - 균형잡힌 비용과 성능
 */
export const optimizedTestConfig: OptimizedEnvironmentConfig = {
  name: 'test',
  region: 'ap-northeast-2',
  stackSuffix: 'Test',
  tags: {
    Environment: 'test',
    Project: 'HanbitTodo',
    Owner: 'QA Team',
    CostCenter: 'Test',
    ManagedBy: 'CDK',
    AutoShutdown: 'weekend',
  },

  database: {
    billingMode: 'PAY_PER_REQUEST',
    backupEnabled: true,
    pointInTimeRecoveryEnabled: false,
    streamEnabled: true,
    contributorInsightsEnabled: true,
    encryptionType: 'AWS_MANAGED',
    ttlEnabled: true,
    globalSecondaryIndexes: {
      projectionType: 'INCLUDE',
      attributes: ['title', 'completed', 'priority'],
    },
  },

  lambda: {
    runtime: 'nodejs20.x',
    architecture: 'x86_64', // 호환성 우선
    memorySize: 512,
    timeout: 60,
    logRetentionDays: 14,
    reservedConcurrency: 50,
    tracingMode: 'Active',
    insightsEnabled: true,
    environment: {
      LOG_LEVEL: 'INFO',
      NODE_ENV: 'test',
      ENABLE_CORS: 'true',
      ENABLE_DEBUG: 'false',
    },
    layers: {
      commonDependencies: true,
      lambdaInsights: true,
      powertools: true,
    },
  },

  api: {
    throttling: {
      burstLimit: 500,
      rateLimit: 250,
    },
    logLevel: 'INFO',
    metricsEnabled: true,
    tracingEnabled: true,
    cachingEnabled: false,
    compressionEnabled: true,
    minimumCompressionSize: 1024,
  },

  network: {
    vpcEnabled: true,
    natGateways: 1,
    maxAzs: 2,
    vpcEndpoints: ['s3', 'dynamodb'],
    flowLogsEnabled: true,
  },

  security: {
    wafEnabled: false,
    secretsEncryption: 'AWS_MANAGED',
    keyRotationEnabled: false,
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

  monitoring: {
    dashboardEnabled: true,
    detailedMetricsEnabled: true,
    customMetricsEnabled: true,
    alarmingEnabled: true,
    alertEmail: 'qa-team@example.com',
    alertingThresholds: {
      errorRate: 10,
      throttleRate: 10,
      duration: 10000,
      concurrentExecutions: 40,
    },
    logAnalyticsEnabled: true,
    tracingEnabled: true,
  },

  costOptimization: {
    level: 'BALANCED',
    budgetLimit: 300,
    autoShutdown: {
      enabled: true,
      schedule: '0 22 ? * FRI *', // 금요일 저녁 10시
    },
    rightsizing: {
      enabled: true,
      checkFrequency: 'WEEKLY',
    },
    savingsPlans: {
      eligible: false,
    },
    reservedCapacity: {
      eligible: false,
    },
  },
};

/**
 * 프로덕션 환경 설정 - 고성능 및 고가용성
 */
export const optimizedProductionConfig: OptimizedEnvironmentConfig = {
  name: 'production',
  region: 'ap-northeast-2',
  stackSuffix: 'Prod',
  tags: {
    Environment: 'production',
    Project: 'HanbitTodo',
    Owner: 'Operations Team',
    CostCenter: 'Production',
    ManagedBy: 'CDK',
    Compliance: 'Required',
    DataClassification: 'Internal',
  },

  database: {
    billingMode: 'PROVISIONED',
    readCapacity: 5,
    writeCapacity: 5,
    autoScaling: {
      minCapacity: 5,
      maxCapacity: 100,
      targetUtilization: 70,
    },
    backupEnabled: true,
    pointInTimeRecoveryEnabled: true,
    streamEnabled: true,
    contributorInsightsEnabled: true,
    encryptionType: 'CUSTOMER_MANAGED',
    ttlEnabled: true,
    globalSecondaryIndexes: {
      projectionType: 'ALL', // 성능 우선
    },
  },

  lambda: {
    runtime: 'nodejs20.x',
    architecture: 'arm64', // 비용 효율성
    memorySize: 1024,
    timeout: 30,
    logRetentionDays: 30,
    reservedConcurrency: 100,
    provisionedConcurrency: 2,
    tracingMode: 'Active',
    insightsEnabled: true,
    environment: {
      LOG_LEVEL: 'ERROR',
      NODE_ENV: 'production',
      ENABLE_CORS: 'true',
      ENABLE_DEBUG: 'false',
    },
    layers: {
      commonDependencies: true,
      lambdaInsights: true,
      powertools: true,
    },
  },

  api: {
    throttling: {
      burstLimit: 2000,
      rateLimit: 1000,
    },
    logLevel: 'ERROR',
    metricsEnabled: true,
    tracingEnabled: true,
    cachingEnabled: true,
    cacheClusterSize: '0.5',
    compressionEnabled: true,
    minimumCompressionSize: 0,
  },

  network: {
    vpcEnabled: true,
    natGateways: 2, // 고가용성
    maxAzs: 3,
    vpcEndpoints: ['s3', 'dynamodb', 'secretsmanager', 'kms', 'lambda'],
    flowLogsEnabled: true,
  },

  security: {
    wafEnabled: true,
    wafRules: ['RateLimitRule', 'SqlInjectionRule', 'XssRule', 'IpReputationRule'],
    secretsEncryption: 'CUSTOMER_MANAGED',
    keyRotationEnabled: true,
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

  monitoring: {
    dashboardEnabled: true,
    detailedMetricsEnabled: true,
    customMetricsEnabled: true,
    alarmingEnabled: true,
    alertEmail: 'ops-team@example.com',
    alertingThresholds: {
      errorRate: 5,
      throttleRate: 5,
      duration: 5000,
      concurrentExecutions: 80,
    },
    logAnalyticsEnabled: true,
    tracingEnabled: true,
  },

  costOptimization: {
    level: 'PERFORMANCE_FIRST',
    budgetLimit: 1000,
    rightsizing: {
      enabled: true,
      checkFrequency: 'MONTHLY',
    },
    savingsPlans: {
      eligible: true,
      type: 'COMPUTE',
    },
    reservedCapacity: {
      eligible: true,
      term: 'ONE_YEAR',
    },
  },
};

/**
 * 환경별 설정 반환
 */
export function getOptimizedEnvironmentConfig(environment: string): OptimizedEnvironmentConfig {
  switch (environment.toLowerCase()) {
    case 'dev':
    case 'development':
      return optimizedDevelopmentConfig;
    case 'test':
    case 'testing':
      return optimizedTestConfig;
    case 'prod':
    case 'production':
      return optimizedProductionConfig;
    default:
      console.warn(`Unknown environment: ${environment}. Using development configuration.`);
      return optimizedDevelopmentConfig;
  }
}
