/**
 * 환경별 리소스 격리 및 최적화를 위한 통합 설정
 * AWS 서버리스 아키텍처의 환경별 관리 전략 구현
 */

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';

/**
 * 환경 타입 정의
 */
export type Environment = 'development' | 'test' | 'staging' | 'production';

/**
 * 리소스 명명 규칙 인터페이스
 */
export interface ResourceNamingConvention {
  /**
   * 리소스 이름 생성
   * @param baseName 기본 이름
   * @param resourceType 리소스 타입
   */
  generateResourceName(baseName: string, resourceType: ResourceType): string;

  /**
   * 스택 이름 생성
   */
  generateStackName(stackName: string): string;

  /**
   * Export 이름 생성
   */
  generateExportName(exportName: string): string;
}

/**
 * 리소스 타입 열거형
 */
export enum ResourceType {
  LAMBDA = 'lambda',
  DYNAMODB = 'dynamodb',
  API_GATEWAY = 'api',
  S3_BUCKET = 's3',
  SNS_TOPIC = 'sns',
  SQS_QUEUE = 'sqs',
  CLOUDWATCH_ALARM = 'alarm',
  COGNITO_POOL = 'cognito',
  SECRET = 'secret',
  IAM_ROLE = 'role',
  VPC = 'vpc',
  KMS_KEY = 'kms',
}

/**
 * 태깅 전략 인터페이스
 */
export interface TaggingStrategy {
  /** 필수 태그 */
  requiredTags: Record<string, string>;

  /** 선택적 태그 */
  optionalTags?: Record<string, string>;

  /** 비용 할당 태그 */
  costAllocationTags: Record<string, string>;

  /** 보안 태그 */
  securityTags: Record<string, string>;

  /** 운영 태그 */
  operationalTags: Record<string, string>;
}

/**
 * DynamoDB 환경별 설정
 */
export interface DynamoDBEnvironmentConfig {
  /** 빌링 모드 */
  billingMode: dynamodb.BillingMode;

  /** 읽기 용량 (프로비저닝 모드일 때) */
  readCapacity?: number;

  /** 쓰기 용량 (프로비저닝 모드일 때) */
  writeCapacity?: number;

  /** 자동 스케일링 설정 */
  autoScaling?: {
    enabled: boolean;
    minCapacity: number;
    maxCapacity: number;
    targetUtilization: number;
  };

  /** 백업 설정 */
  backup: {
    enabled: boolean;
    pitrEnabled: boolean;
    continuousBackups?: boolean;
  };

  /** 암호화 설정 */
  encryption: {
    type: 'AWS_MANAGED' | 'CUSTOMER_MANAGED';
    kmsKeyId?: string;
  };

  /** 스트림 설정 */
  stream?: {
    enabled: boolean;
    viewType?: dynamodb.StreamViewType;
  };

  /** 글로벌 테이블 설정 */
  globalTable?: {
    enabled: boolean;
    regions: string[];
  };

  /** 삭제 정책 */
  removalPolicy: cdk.RemovalPolicy;

  /** TTL 설정 */
  ttl?: {
    enabled: boolean;
    attributeName: string;
    guestDataTtlDays?: number;
  };
}

/**
 * Lambda 환경별 설정
 */
export interface LambdaEnvironmentConfig {
  /** 메모리 크기 */
  memorySize: number;

  /** 타임아웃 */
  timeout: cdk.Duration;

  /** 예약된 동시 실행 */
  reservedConcurrentExecutions?: number;

  /** 프로비저닝된 동시 실행 */
  provisionedConcurrentExecutions?: number;

  /** 환경 변수 */
  environment: Record<string, string>;

  /** 로그 설정 */
  logging: {
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    retention: logs.RetentionDays;
    format?: 'JSON' | 'TEXT';
  };

  /** 트레이싱 */
  tracing: lambda.Tracing;

  /** 데드레터 큐 설정 */
  deadLetterQueue?: {
    enabled: boolean;
    maxRetryCount: number;
  };

  /** VPC 설정 */
  vpc?: {
    enabled: boolean;
    subnets: string[];
    securityGroups: string[];
  };

  /** 레이어 설정 */
  layers?: string[];

  /** 에지 최적화 */
  edgeOptimized?: boolean;
}

/**
 * API Gateway 환경별 설정
 */
export interface ApiGatewayEnvironmentConfig {
  /** 스테이지 이름 */
  stageName: string;

  /** 스로틀링 설정 */
  throttling: {
    rateLimit: number;
    burstLimit: number;
  };

  /** 로깅 설정 */
  logging: {
    level: 'OFF' | 'ERROR' | 'INFO';
    dataTrace: boolean;
    metricsEnabled: boolean;
  };

  /** 캐싱 설정 */
  caching?: {
    enabled: boolean;
    clusterSize: string;
    ttlSeconds: number;
  };

  /** WAF 설정 */
  waf?: {
    enabled: boolean;
    rules: string[];
  };

  /** API 키 설정 */
  apiKey?: {
    required: boolean;
    quota?: {
      limit: number;
      period: 'DAY' | 'WEEK' | 'MONTH';
    };
  };

  /** 커스텀 도메인 */
  customDomain?: {
    domainName: string;
    certificateArn: string;
    basePath?: string;
  };

  /** CORS 설정 */
  cors: {
    allowOrigins: string[];
    allowMethods: string[];
    allowHeaders: string[];
    maxAge: cdk.Duration;
  };
}

/**
 * 보안 환경별 설정
 */
export interface SecurityEnvironmentConfig {
  /** IAM 정책 */
  iamPolicies: {
    enforceMinimumPrivilege: boolean;
    requireMFA?: boolean;
    maxSessionDuration: cdk.Duration;
  };

  /** 네트워크 보안 */
  network: {
    vpcEnabled: boolean;
    privateSubnets?: boolean;
    natGateways?: number;
    vpcEndpoints?: string[];
  };

  /** 암호화 */
  encryption: {
    enforceTransitEncryption: boolean;
    enforceAtRestEncryption: boolean;
    kmsKeyRotation: boolean;
  };

  /** 비밀 관리 */
  secrets: {
    rotationEnabled: boolean;
    rotationSchedule?: cdk.Duration;
    crossRegionReplication?: boolean;
  };

  /** 컴플라이언스 */
  compliance: {
    gdprEnabled?: boolean;
    hipaaEnabled?: boolean;
    pcidssEnabled?: boolean;
  };

  /** 감사 */
  audit: {
    cloudTrailEnabled: boolean;
    configEnabled: boolean;
    guardDutyEnabled: boolean;
  };
}

/**
 * 모니터링 환경별 설정
 */
export interface MonitoringEnvironmentConfig {
  /** CloudWatch 대시보드 */
  dashboard: {
    enabled: boolean;
    autoRefresh: boolean;
    granularity: 'FINE' | 'STANDARD';
  };

  /** 알람 설정 */
  alarms: {
    enabled: boolean;
    severityLevels: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[];
    notificationChannels: {
      email?: string[];
      slack?: string;
      pagerDuty?: string;
    };
  };

  /** 메트릭 설정 */
  metrics: {
    customMetricsEnabled: boolean;
    detailedMetricsEnabled: boolean;
    enhancedMonitoring?: boolean;
  };

  /** 로그 집계 */
  logAggregation: {
    enabled: boolean;
    logGroups: string[];
    insights?: boolean;
  };

  /** X-Ray 트레이싱 */
  xray: {
    enabled: boolean;
    samplingRate: number;
    serviceMap: boolean;
  };

  /** 비용 모니터링 */
  costMonitoring: {
    enabled: boolean;
    budgetAlerts: {
      amount: number;
      currency: string;
      threshold: number;
    }[];
  };
}

/**
 * 통합 환경 설정
 */
export interface IntegratedEnvironmentConfig {
  /** 환경 이름 */
  environment: Environment;

  /** AWS 계정 정보 */
  account: {
    id: string;
    region: string;
    alternateRegions?: string[];
  };

  /** 리소스 명명 규칙 */
  naming: ResourceNamingConvention;

  /** 태깅 전략 */
  tagging: TaggingStrategy;

  /** DynamoDB 설정 */
  dynamodb: DynamoDBEnvironmentConfig;

  /** Lambda 설정 */
  lambda: LambdaEnvironmentConfig;

  /** API Gateway 설정 */
  apiGateway: ApiGatewayEnvironmentConfig;

  /** 보안 설정 */
  security: SecurityEnvironmentConfig;

  /** 모니터링 설정 */
  monitoring: MonitoringEnvironmentConfig;

  /** 기능 플래그 */
  features: {
    multiRegion?: boolean;
    disasterRecovery?: boolean;
    blueGreenDeployment?: boolean;
    canaryDeployment?: boolean;
    autoScaling?: boolean;
  };
}

/**
 * 환경별 리소스 명명 규칙 구현
 */
export class StandardNamingConvention implements ResourceNamingConvention {
  constructor(
    private readonly projectName: string,
    private readonly environment: Environment,
    private readonly region: string
  ) {}

  generateResourceName(baseName: string, resourceType: ResourceType): string {
    const parts = [
      this.projectName.toLowerCase(),
      this.environment.substring(0, 3).toLowerCase(),
      this.region.replace('-', ''),
      resourceType,
      baseName.toLowerCase(),
    ];

    return parts.join('-');
  }

  generateStackName(stackName: string): string {
    return `${this.projectName}-${stackName}-${this.environment}-stack`;
  }

  generateExportName(exportName: string): string {
    return `${this.projectName}-${this.environment}-${exportName}`;
  }
}

/**
 * 환경별 태깅 전략 생성
 */
export function createTaggingStrategy(
  environment: Environment,
  projectName: string,
  owner: string,
  costCenter: string
): TaggingStrategy {
  const baseDate = new Date().toISOString().split('T')[0];

  return {
    requiredTags: {
      Environment: environment,
      Project: projectName,
      ManagedBy: 'CDK',
      CreatedDate: baseDate,
    },

    costAllocationTags: {
      CostCenter: costCenter,
      Owner: owner,
      Team: getTeamByEnvironment(environment),
      Budget: getBudgetByEnvironment(environment),
    },

    securityTags: {
      DataClassification: getDataClassification(environment),
      Compliance: getComplianceLevel(environment),
      Encryption: 'Required',
      BackupRequired: environment === 'production' ? 'true' : 'false',
    },

    operationalTags: {
      MaintenanceWindow: getMaintenanceWindow(environment),
      AutoShutdown: environment === 'development' ? 'true' : 'false',
      MonitoringLevel: getMonitoringLevel(environment),
      AlertSeverity: getAlertSeverity(environment),
    },

    optionalTags: {
      Version: process.env.APP_VERSION || '1.0.0',
      BuildNumber: process.env.BUILD_NUMBER || 'local',
      GitCommit: process.env.GIT_COMMIT || 'unknown',
    },
  };
}

/**
 * 헬퍼 함수들
 */
function getTeamByEnvironment(env: Environment): string {
  const teams: Record<Environment, string> = {
    development: 'DevTeam',
    test: 'QATeam',
    staging: 'DevOpsTeam',
    production: 'OpsTeam',
  };
  return teams[env];
}

function getBudgetByEnvironment(env: Environment): string {
  const budgets: Record<Environment, string> = {
    development: 'DEV-BUDGET',
    test: 'TEST-BUDGET',
    staging: 'STAGE-BUDGET',
    production: 'PROD-BUDGET',
  };
  return budgets[env];
}

function getDataClassification(env: Environment): string {
  return env === 'production' ? 'Confidential' : 'Internal';
}

function getComplianceLevel(env: Environment): string {
  return env === 'production' ? 'HIGH' : 'STANDARD';
}

function getMaintenanceWindow(env: Environment): string {
  const windows: Record<Environment, string> = {
    development: 'MON-FRI:0000-0600',
    test: 'SAT-SUN:0000-0600',
    staging: 'SUN:0200-0400',
    production: 'SUN:0300-0400',
  };
  return windows[env];
}

function getMonitoringLevel(env: Environment): string {
  const levels: Record<Environment, string> = {
    development: 'BASIC',
    test: 'STANDARD',
    staging: 'ENHANCED',
    production: 'DETAILED',
  };
  return levels[env];
}

function getAlertSeverity(env: Environment): string {
  const severities: Record<Environment, string> = {
    development: 'LOW',
    test: 'MEDIUM',
    staging: 'HIGH',
    production: 'CRITICAL',
  };
  return severities[env];
}

/**
 * 환경별 설정 프리셋 생성 함수
 */
export function createEnvironmentConfig(
  environment: Environment,
  projectName: string,
  accountId: string,
  region: string
): IntegratedEnvironmentConfig {
  const naming = new StandardNamingConvention(projectName, environment, region);
  const owner = getTeamByEnvironment(environment);
  const costCenter = `${projectName}-${environment}`.toUpperCase();

  return {
    environment,

    account: {
      id: accountId,
      region,
      alternateRegions: environment === 'production' ? ['us-east-1', 'eu-west-1'] : undefined,
    },

    naming,

    tagging: createTaggingStrategy(environment, projectName, owner, costCenter),

    dynamodb: getDynamoDBConfig(environment),
    lambda: getLambdaConfig(environment),
    apiGateway: getApiGatewayConfig(environment),
    security: getSecurityConfig(environment),
    monitoring: getMonitoringConfig(environment),

    features: {
      multiRegion: environment === 'production',
      disasterRecovery: environment === 'production' || environment === 'staging',
      blueGreenDeployment: environment === 'production',
      canaryDeployment: environment === 'staging' || environment === 'production',
      autoScaling: environment !== 'development',
    },
  };
}

/**
 * DynamoDB 환경별 설정
 */
function getDynamoDBConfig(env: Environment): DynamoDBEnvironmentConfig {
  const configs: Record<Environment, DynamoDBEnvironmentConfig> = {
    development: {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      backup: {
        enabled: false,
        pitrEnabled: false,
      },
      encryption: {
        type: 'AWS_MANAGED',
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      ttl: {
        enabled: true,
        attributeName: 'ttl',
        guestDataTtlDays: 1,
      },
    },
    test: {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      backup: {
        enabled: true,
        pitrEnabled: false,
      },
      encryption: {
        type: 'AWS_MANAGED',
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      ttl: {
        enabled: true,
        attributeName: 'ttl',
        guestDataTtlDays: 3,
      },
    },
    staging: {
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 5,
      writeCapacity: 5,
      autoScaling: {
        enabled: true,
        minCapacity: 5,
        maxCapacity: 50,
        targetUtilization: 70,
      },
      backup: {
        enabled: true,
        pitrEnabled: true,
        continuousBackups: true,
      },
      encryption: {
        type: 'CUSTOMER_MANAGED',
      },
      stream: {
        enabled: true,
        viewType: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      },
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
      ttl: {
        enabled: true,
        attributeName: 'ttl',
        guestDataTtlDays: 7,
      },
    },
    production: {
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 10,
      writeCapacity: 10,
      autoScaling: {
        enabled: true,
        minCapacity: 10,
        maxCapacity: 1000,
        targetUtilization: 70,
      },
      backup: {
        enabled: true,
        pitrEnabled: true,
        continuousBackups: true,
      },
      encryption: {
        type: 'CUSTOMER_MANAGED',
      },
      stream: {
        enabled: true,
        viewType: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      },
      globalTable: {
        enabled: true,
        regions: ['us-east-1', 'eu-west-1'],
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      ttl: {
        enabled: true,
        attributeName: 'ttl',
        guestDataTtlDays: 7,
      },
    },
  };

  return configs[env];
}

/**
 * Lambda 환경별 설정
 */
function getLambdaConfig(env: Environment): LambdaEnvironmentConfig {
  const configs: Record<Environment, LambdaEnvironmentConfig> = {
    development: {
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: {
        LOG_LEVEL: 'DEBUG',
        NODE_ENV: 'development',
        ENABLE_DEBUG: 'true',
      },
      logging: {
        level: 'DEBUG',
        retention: logs.RetentionDays.THREE_DAYS,
        format: 'JSON',
      },
      tracing: lambda.Tracing.ACTIVE,
    },
    test: {
      memorySize: 512,
      timeout: cdk.Duration.seconds(60),
      environment: {
        LOG_LEVEL: 'INFO',
        NODE_ENV: 'test',
        ENABLE_DEBUG: 'false',
      },
      logging: {
        level: 'INFO',
        retention: logs.RetentionDays.ONE_WEEK,
        format: 'JSON',
      },
      tracing: lambda.Tracing.ACTIVE,
    },
    staging: {
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      reservedConcurrentExecutions: 10,
      environment: {
        LOG_LEVEL: 'WARN',
        NODE_ENV: 'staging',
        ENABLE_DEBUG: 'false',
      },
      logging: {
        level: 'WARN',
        retention: logs.RetentionDays.TWO_WEEKS,
        format: 'JSON',
      },
      tracing: lambda.Tracing.ACTIVE,
      deadLetterQueue: {
        enabled: true,
        maxRetryCount: 3,
      },
    },
    production: {
      memorySize: 1536,
      timeout: cdk.Duration.seconds(30),
      reservedConcurrentExecutions: 100,
      provisionedConcurrentExecutions: 10,
      environment: {
        LOG_LEVEL: 'ERROR',
        NODE_ENV: 'production',
        ENABLE_DEBUG: 'false',
      },
      logging: {
        level: 'ERROR',
        retention: logs.RetentionDays.ONE_MONTH,
        format: 'JSON',
      },
      tracing: lambda.Tracing.ACTIVE,
      deadLetterQueue: {
        enabled: true,
        maxRetryCount: 5,
      },
      edgeOptimized: true,
    },
  };

  return configs[env];
}

/**
 * API Gateway 환경별 설정
 */
function getApiGatewayConfig(env: Environment): ApiGatewayEnvironmentConfig {
  const configs: Record<Environment, ApiGatewayEnvironmentConfig> = {
    development: {
      stageName: 'dev',
      throttling: {
        rateLimit: 100,
        burstLimit: 200,
      },
      logging: {
        level: 'INFO',
        dataTrace: true,
        metricsEnabled: true,
      },
      cors: {
        allowOrigins: ['http://localhost:3000', 'http://localhost:5173'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: cdk.Duration.hours(1),
      },
    },
    test: {
      stageName: 'test',
      throttling: {
        rateLimit: 500,
        burstLimit: 1000,
      },
      logging: {
        level: 'INFO',
        dataTrace: true,
        metricsEnabled: true,
      },
      cors: {
        allowOrigins: ['https://test.example.com'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: cdk.Duration.hours(6),
      },
    },
    staging: {
      stageName: 'staging',
      throttling: {
        rateLimit: 1000,
        burstLimit: 2000,
      },
      logging: {
        level: 'ERROR',
        dataTrace: false,
        metricsEnabled: true,
      },
      caching: {
        enabled: true,
        clusterSize: '0.5',
        ttlSeconds: 300,
      },
      cors: {
        allowOrigins: ['https://staging.example.com'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: cdk.Duration.hours(12),
      },
    },
    production: {
      stageName: 'v1',
      throttling: {
        rateLimit: 10000,
        burstLimit: 20000,
      },
      logging: {
        level: 'ERROR',
        dataTrace: false,
        metricsEnabled: true,
      },
      caching: {
        enabled: true,
        clusterSize: '1.6',
        ttlSeconds: 600,
      },
      waf: {
        enabled: true,
        rules: ['RateLimitRule', 'SqlInjectionRule', 'XssRule'],
      },
      apiKey: {
        required: true,
        quota: {
          limit: 100000,
          period: 'DAY',
        },
      },
      customDomain: {
        domainName: 'api.example.com',
        certificateArn: 'arn:aws:acm:region:account:certificate/id',
      },
      cors: {
        allowOrigins: ['https://example.com', 'https://www.example.com'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: cdk.Duration.hours(24),
      },
    },
  };

  return configs[env];
}

/**
 * 보안 환경별 설정
 */
function getSecurityConfig(env: Environment): SecurityEnvironmentConfig {
  const configs: Record<Environment, SecurityEnvironmentConfig> = {
    development: {
      iamPolicies: {
        enforceMinimumPrivilege: false,
        maxSessionDuration: cdk.Duration.hours(12),
      },
      network: {
        vpcEnabled: false,
      },
      encryption: {
        enforceTransitEncryption: false,
        enforceAtRestEncryption: true,
        kmsKeyRotation: false,
      },
      secrets: {
        rotationEnabled: false,
      },
      audit: {
        cloudTrailEnabled: false,
        configEnabled: false,
        guardDutyEnabled: false,
      },
    },
    test: {
      iamPolicies: {
        enforceMinimumPrivilege: true,
        maxSessionDuration: cdk.Duration.hours(8),
      },
      network: {
        vpcEnabled: false,
      },
      encryption: {
        enforceTransitEncryption: true,
        enforceAtRestEncryption: true,
        kmsKeyRotation: false,
      },
      secrets: {
        rotationEnabled: false,
      },
      audit: {
        cloudTrailEnabled: true,
        configEnabled: false,
        guardDutyEnabled: false,
      },
    },
    staging: {
      iamPolicies: {
        enforceMinimumPrivilege: true,
        requireMFA: true,
        maxSessionDuration: cdk.Duration.hours(4),
      },
      network: {
        vpcEnabled: true,
        privateSubnets: true,
        natGateways: 1,
      },
      encryption: {
        enforceTransitEncryption: true,
        enforceAtRestEncryption: true,
        kmsKeyRotation: true,
      },
      secrets: {
        rotationEnabled: true,
        rotationSchedule: cdk.Duration.days(30),
      },
      audit: {
        cloudTrailEnabled: true,
        configEnabled: true,
        guardDutyEnabled: true,
      },
    },
    production: {
      iamPolicies: {
        enforceMinimumPrivilege: true,
        requireMFA: true,
        maxSessionDuration: cdk.Duration.hours(1),
      },
      network: {
        vpcEnabled: true,
        privateSubnets: true,
        natGateways: 3,
        vpcEndpoints: ['s3', 'dynamodb', 'secrets-manager'],
      },
      encryption: {
        enforceTransitEncryption: true,
        enforceAtRestEncryption: true,
        kmsKeyRotation: true,
      },
      secrets: {
        rotationEnabled: true,
        rotationSchedule: cdk.Duration.days(7),
        crossRegionReplication: true,
      },
      compliance: {
        gdprEnabled: true,
        hipaaEnabled: false,
        pcidssEnabled: true,
      },
      audit: {
        cloudTrailEnabled: true,
        configEnabled: true,
        guardDutyEnabled: true,
      },
    },
  };

  return configs[env];
}

/**
 * 모니터링 환경별 설정
 */
function getMonitoringConfig(env: Environment): MonitoringEnvironmentConfig {
  const configs: Record<Environment, MonitoringEnvironmentConfig> = {
    development: {
      dashboard: {
        enabled: true,
        autoRefresh: false,
        granularity: 'STANDARD',
      },
      alarms: {
        enabled: false,
        severityLevels: ['LOW'],
        notificationChannels: {},
      },
      metrics: {
        customMetricsEnabled: false,
        detailedMetricsEnabled: false,
      },
      logAggregation: {
        enabled: false,
        logGroups: [],
      },
      xray: {
        enabled: true,
        samplingRate: 0.1,
        serviceMap: false,
      },
      costMonitoring: {
        enabled: false,
        budgetAlerts: [],
      },
    },
    test: {
      dashboard: {
        enabled: true,
        autoRefresh: true,
        granularity: 'STANDARD',
      },
      alarms: {
        enabled: true,
        severityLevels: ['MEDIUM', 'HIGH'],
        notificationChannels: {
          email: ['test-team@example.com'],
        },
      },
      metrics: {
        customMetricsEnabled: true,
        detailedMetricsEnabled: false,
      },
      logAggregation: {
        enabled: true,
        logGroups: ['/aws/lambda/*'],
        insights: false,
      },
      xray: {
        enabled: true,
        samplingRate: 0.5,
        serviceMap: true,
      },
      costMonitoring: {
        enabled: true,
        budgetAlerts: [
          {
            amount: 100,
            currency: 'USD',
            threshold: 80,
          },
        ],
      },
    },
    staging: {
      dashboard: {
        enabled: true,
        autoRefresh: true,
        granularity: 'FINE',
      },
      alarms: {
        enabled: true,
        severityLevels: ['MEDIUM', 'HIGH', 'CRITICAL'],
        notificationChannels: {
          email: ['devops-team@example.com'],
          slack: '#staging-alerts',
        },
      },
      metrics: {
        customMetricsEnabled: true,
        detailedMetricsEnabled: true,
        enhancedMonitoring: true,
      },
      logAggregation: {
        enabled: true,
        logGroups: ['/aws/lambda/*', '/aws/apigateway/*'],
        insights: true,
      },
      xray: {
        enabled: true,
        samplingRate: 0.8,
        serviceMap: true,
      },
      costMonitoring: {
        enabled: true,
        budgetAlerts: [
          {
            amount: 500,
            currency: 'USD',
            threshold: 70,
          },
          {
            amount: 500,
            currency: 'USD',
            threshold: 90,
          },
        ],
      },
    },
    production: {
      dashboard: {
        enabled: true,
        autoRefresh: true,
        granularity: 'FINE',
      },
      alarms: {
        enabled: true,
        severityLevels: ['HIGH', 'CRITICAL'],
        notificationChannels: {
          email: ['ops-team@example.com', 'on-call@example.com'],
          slack: '#production-alerts',
          pagerDuty: 'service-key',
        },
      },
      metrics: {
        customMetricsEnabled: true,
        detailedMetricsEnabled: true,
        enhancedMonitoring: true,
      },
      logAggregation: {
        enabled: true,
        logGroups: ['/aws/lambda/*', '/aws/apigateway/*', '/aws/dynamodb/*'],
        insights: true,
      },
      xray: {
        enabled: true,
        samplingRate: 1.0,
        serviceMap: true,
      },
      costMonitoring: {
        enabled: true,
        budgetAlerts: [
          {
            amount: 1000,
            currency: 'USD',
            threshold: 50,
          },
          {
            amount: 1000,
            currency: 'USD',
            threshold: 75,
          },
          {
            amount: 1000,
            currency: 'USD',
            threshold: 90,
          },
        ],
      },
    },
  };

  return configs[env];
}
