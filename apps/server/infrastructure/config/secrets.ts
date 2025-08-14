import * as cdk from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './environment';

/**
 * 시크릿 관리 인터페이스
 */
export interface SecretsConfig {
  /** JWT 시크릿 키 */
  jwtSecret: string;
  /** 데이터베이스 암호화 키 */
  dbEncryptionKey: string;
  /** API 키들 */
  apiKeys: {
    /** 외부 서비스 API 키 */
    externalService?: string;
    /** 분석 서비스 API 키 */
    analytics?: string;
  };
  /** 알림 설정 */
  notifications: {
    /** 슬랙 웹훅 URL */
    slackWebhook?: string;
    /** 이메일 서비스 설정 */
    emailService?: {
      apiKey: string;
      fromEmail: string;
    };
  };
}

/**
 * AWS Parameter Store 및 Secrets Manager를 관리하는 Construct
 */
export class SecretsConstruct extends Construct {
  public readonly jwtSecret: secretsmanager.ISecret;
  public readonly dbEncryptionKey: ssm.IStringParameter;
  public readonly apiKeysSecret: secretsmanager.ISecret;
  public readonly notificationSettings: ssm.IStringParameter;

  constructor(scope: Construct, id: string, config: EnvironmentConfig) {
    super(scope, id);

    // JWT 시크릿 - Secrets Manager에서 관리 (자동 로테이션 지원)
    this.jwtSecret = new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: `/hanbit-todo/${config.name}/jwt-secret`,
      description: `JWT signing secret for ${config.name} environment`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        excludeCharacters: ' %+~`#$&*()|[]{}:;<>?!\'/@"\\',
        includeSpace: false,
        passwordLength: 64,
      },
    });

    // 데이터베이스 암호화 키 - Parameter Store (String Parameter)
    this.dbEncryptionKey = new ssm.StringParameter(this, 'DbEncryptionKey', {
      parameterName: `/hanbit-todo/${config.name}/db-encryption-key`,
      description: `Database encryption key for ${config.name} environment`,
      stringValue: 'PLACEHOLDER_KEY', // 배포 후 실제 키로 교체 필요
      tier: ssm.ParameterTier.STANDARD,
    });

    // API 키들 - Secrets Manager에서 관리
    this.apiKeysSecret = new secretsmanager.Secret(this, 'ApiKeysSecret', {
      secretName: `/hanbit-todo/${config.name}/api-keys`,
      description: `External API keys for ${config.name} environment`,
      secretStringValue: cdk.SecretValue.unsafePlainText(
        JSON.stringify({
          externalService: 'PLACEHOLDER_API_KEY',
          analytics: 'PLACEHOLDER_ANALYTICS_KEY',
        })
      ),
    });

    // 알림 설정 - Parameter Store (JSON 형태)
    this.notificationSettings = new ssm.StringParameter(this, 'NotificationSettings', {
      parameterName: `/hanbit-todo/${config.name}/notification-settings`,
      description: `Notification settings for ${config.name} environment`,
      stringValue: JSON.stringify({
        slackWebhook: config.monitoring.alertEmail ? 'PLACEHOLDER_SLACK_WEBHOOK' : '',
        emailService: {
          apiKey: 'PLACEHOLDER_EMAIL_API_KEY',
          fromEmail: `noreply@hanbit-todo-${config.name}.com`,
        },
      }),
      tier: ssm.ParameterTier.STANDARD,
    });

    // 환경별 추가 파라미터들
    this.createEnvironmentParameters(config);
  }

  /**
   * 환경별 추가 파라미터 생성
   */
  private createEnvironmentParameters(config: EnvironmentConfig): void {
    // 앱 설정 - Parameter Store
    new ssm.StringParameter(this, 'AppConfig', {
      parameterName: `/hanbit-todo/${config.name}/app-config`,
      description: `Application configuration for ${config.name} environment`,
      stringValue: JSON.stringify({
        corsAllowedOrigins: config.security.corsAllowedOrigins,
        jwtExpirationHours: config.security.jwtExpirationHours,
        passwordPolicy: config.security.passwordPolicy,
        throttling: config.api.throttling,
        logLevel: config.lambda.environment.LOG_LEVEL,
      }),
      tier: ssm.ParameterTier.STANDARD,
    });

    // 데이터베이스 설정 - Parameter Store
    new ssm.StringParameter(this, 'DatabaseConfig', {
      parameterName: `/hanbit-todo/${config.name}/database-config`,
      description: `Database configuration for ${config.name} environment`,
      stringValue: JSON.stringify({
        readCapacity: config.database.readCapacity,
        writeCapacity: config.database.writeCapacity,
        backupEnabled: config.database.backupEnabled,
        pointInTimeRecoveryEnabled: config.database.pointInTimeRecoveryEnabled,
      }),
      tier: ssm.ParameterTier.STANDARD,
    });

    // 프로덕션 환경에서만 추가 보안 파라미터
    if (config.name === 'production') {
      new ssm.StringParameter(this, 'SecurityConfig', {
        parameterName: `/hanbit-todo/${config.name}/security-config`,
        description: `Security configuration for ${config.name} environment`,
        stringValue: JSON.stringify({
          enableAdvancedSecurity: true,
          enableAuditLogging: true,
          enableEncryptionAtRest: true,
          enableEncryptionInTransit: true,
        }),
        tier: ssm.ParameterTier.STANDARD,
      });
    }
  }
}

/**
 * Lambda 함수에서 사용할 환경 변수 생성 헬퍼
 */
export function createLambdaEnvironmentVariables(
  config: EnvironmentConfig,
  secrets: SecretsConstruct
): Record<string, string> {
  const baseEnvVars = {
    ...config.lambda.environment,
    ENVIRONMENT: config.name,
    REGION: config.region,
  };

  // 시크릿 ARN들을 환경 변수로 추가
  const secretEnvVars = {
    JWT_SECRET_ARN: secrets.jwtSecret.secretArn,
    API_KEYS_SECRET_ARN: secrets.apiKeysSecret.secretArn,
  };

  // Parameter Store 이름들을 환경 변수로 추가
  const parameterEnvVars = {
    DB_ENCRYPTION_KEY_PARAMETER: secrets.dbEncryptionKey.parameterName,
    NOTIFICATION_SETTINGS_PARAMETER: secrets.notificationSettings.parameterName,
    APP_CONFIG_PARAMETER: `/hanbit-todo/${config.name}/app-config`,
    DATABASE_CONFIG_PARAMETER: `/hanbit-todo/${config.name}/database-config`,
  };

  return {
    ...baseEnvVars,
    ...secretEnvVars,
    ...parameterEnvVars,
  };
}
