/**
 * 환경별 설정 및 시크릿 관리자
 * AWS Parameter Store와 Secrets Manager에서 설정을 동적으로 로드
 */

import { SSMClient, GetParameterCommand, GetParametersCommand } from '@aws-sdk/client-ssm';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { logger } from './logger';

/**
 * 애플리케이션 설정 인터페이스
 */
export interface AppConfig {
  /** 환경 정보 */
  environment: {
    name: string;
    region: string;
    logLevel: string;
  };
  /** 보안 설정 */
  security: {
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
  /** API 설정 */
  api: {
    throttling: {
      burstLimit: number;
      rateLimit: number;
    };
  };
  /** 데이터베이스 설정 */
  database: {
    readCapacity: number;
    writeCapacity: number;
    backupEnabled: boolean;
    pointInTimeRecoveryEnabled: boolean;
  };
  /** 알림 설정 */
  notifications: {
    slackWebhook?: string;
    emailService?: {
      apiKey: string;
      fromEmail: string;
    };
  };
}

/**
 * 시크릿 정보 인터페이스
 */
export interface AppSecrets {
  /** JWT 시크릿 키 */
  jwtSecret: string;
  /** 데이터베이스 암호화 키 */
  dbEncryptionKey: string;
  /** 외부 API 키들 */
  apiKeys: {
    externalService?: string;
    analytics?: string;
  };
}

/**
 * 설정 관리자 클래스
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private ssmClient: SSMClient;
  private secretsClient: SecretsManagerClient;
  private config: AppConfig | null = null;
  private secrets: AppSecrets | null = null;
  private environment: string;

  private constructor() {
    this.ssmClient = new SSMClient({ region: process.env.AWS_REGION });
    this.secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });
    this.environment = process.env.ENVIRONMENT || 'development';
  }

  /**
   * 싱글톤 인스턴스 반환
   */
  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 애플리케이션 설정 로드
   */
  public async loadConfig(): Promise<AppConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      logger.info('애플리케이션 설정 로딩 중...', { environment: this.environment });

      const parameterNames = [
        `/hanbit-todo/${this.environment}/app-config`,
        `/hanbit-todo/${this.environment}/database-config`,
        `/hanbit-todo/${this.environment}/notification-settings`,
      ];

      // 모든 파라미터를 한 번에 조회
      const command = new GetParametersCommand({
        Names: parameterNames,
        WithDecryption: true,
      });

      const response = await this.ssmClient.send(command);

      if (!response.Parameters || response.Parameters.length === 0) {
        throw new Error('설정 파라미터를 찾을 수 없습니다.');
      }

      // 파라미터별로 파싱
      const parameters = response.Parameters.reduce(
        (acc, param) => {
          if (param.Name && param.Value) {
            acc[param.Name] = JSON.parse(param.Value);
          }
          return acc;
        },
        {} as Record<string, unknown>
      );

      const appConfigParam = parameters[`/hanbit-todo/${this.environment}/app-config`];
      const dbConfigParam = parameters[`/hanbit-todo/${this.environment}/database-config`];
      const notificationParam =
        parameters[`/hanbit-todo/${this.environment}/notification-settings`];

      // 설정 객체 구성
      this.config = {
        environment: {
          name: this.environment,
          region: process.env.AWS_REGION || 'ap-northeast-2',
          logLevel: appConfigParam?.logLevel || 'INFO',
        },
        security: {
          corsAllowedOrigins: appConfigParam?.corsAllowedOrigins || ['http://localhost:5173'],
          jwtExpirationHours: appConfigParam?.jwtExpirationHours || 24,
          passwordPolicy: appConfigParam?.passwordPolicy || {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSymbols: false,
          },
        },
        api: {
          throttling: appConfigParam?.throttling || {
            burstLimit: 200,
            rateLimit: 100,
          },
        },
        database: {
          readCapacity: dbConfigParam?.readCapacity || 5,
          writeCapacity: dbConfigParam?.writeCapacity || 5,
          backupEnabled: dbConfigParam?.backupEnabled || true,
          pointInTimeRecoveryEnabled: dbConfigParam?.pointInTimeRecoveryEnabled || true,
        },
        notifications: {
          slackWebhook: notificationParam?.slackWebhook,
          emailService: notificationParam?.emailService,
        },
      };

      logger.info('애플리케이션 설정 로딩 완료', {
        environment: this.config.environment.name,
        corsOrigins: this.config.security.corsAllowedOrigins.length,
      });

      return this.config;
    } catch (error) {
      logger.error('설정 로딩 실패', error as Error);

      // 기본 설정으로 폴백
      return this.getDefaultConfig();
    }
  }

  /**
   * 시크릿 정보 로드
   */
  public async loadSecrets(): Promise<AppSecrets> {
    if (this.secrets) {
      return this.secrets;
    }

    try {
      logger.info('시크릿 정보 로딩 중...', { environment: this.environment });

      // JWT 시크릿 조회
      const jwtSecretResponse = await this.secretsClient.send(
        new GetSecretValueCommand({
          SecretId: `/hanbit-todo/${this.environment}/jwt-secret`,
        })
      );

      // API 키 시크릿 조회
      const apiKeysResponse = await this.secretsClient.send(
        new GetSecretValueCommand({
          SecretId: `/hanbit-todo/${this.environment}/api-keys`,
        })
      );

      // DB 암호화 키 조회 (Parameter Store)
      const dbKeyResponse = await this.ssmClient.send(
        new GetParameterCommand({
          Name: `/hanbit-todo/${this.environment}/db-encryption-key`,
          WithDecryption: true,
        })
      );

      if (
        !jwtSecretResponse.SecretString ||
        !apiKeysResponse.SecretString ||
        !dbKeyResponse.Parameter?.Value
      ) {
        throw new Error('필수 시크릿 정보가 누락되었습니다.');
      }

      const jwtSecretData = JSON.parse(jwtSecretResponse.SecretString);
      const apiKeysData = JSON.parse(apiKeysResponse.SecretString);

      this.secrets = {
        jwtSecret: jwtSecretData.password || jwtSecretData.secret,
        dbEncryptionKey: dbKeyResponse.Parameter.Value,
        apiKeys: {
          externalService: apiKeysData.externalService,
          analytics: apiKeysData.analytics,
        },
      };

      logger.info('시크릿 정보 로딩 완료', {
        jwtSecretLoaded: !!this.secrets.jwtSecret,
        apiKeysCount: Object.keys(this.secrets.apiKeys).length,
      });

      return this.secrets;
    } catch (error) {
      logger.error('시크릿 로딩 실패', error as Error);

      // 개발 환경에서는 기본값 사용, 프로덕션에서는 에러 발생
      if (this.environment === 'development') {
        logger.warning('개발 환경에서 기본 시크릿 사용');
        return this.getDefaultSecrets();
      } else {
        throw new Error('프로덕션 환경에서 시크릿을 로드할 수 없습니다.');
      }
    }
  }

  /**
   * 특정 설정 값 조회
   */
  public async getConfigValue<T>(path: string): Promise<T | undefined> {
    const config = await this.loadConfig();
    return this.getNestedValue(config, path) as T;
  }

  /**
   * 특정 시크릿 값 조회
   */
  public async getSecretValue<T>(path: string): Promise<T | undefined> {
    const secrets = await this.loadSecrets();
    return this.getNestedValue(secrets, path) as T;
  }

  /**
   * 설정 새로고침 (캐시 초기화)
   */
  public refreshConfig(): void {
    this.config = null;
    this.secrets = null;
    logger.info('설정 캐시가 초기화되었습니다.');
  }

  /**
   * 환경별 설정 유효성 검사
   */
  public async validateConfig(): Promise<boolean> {
    try {
      const config = await this.loadConfig();
      const secrets = await this.loadSecrets();

      // 필수 설정 검증
      const validationRules = [
        { condition: config.environment.name, message: '환경 이름이 필요합니다.' },
        {
          condition: config.security.corsAllowedOrigins.length > 0,
          message: 'CORS 설정이 필요합니다.',
        },
        { condition: secrets.jwtSecret, message: 'JWT 시크릿이 필요합니다.' },
        { condition: config.api.throttling.rateLimit > 0, message: 'API 제한 설정이 필요합니다.' },
      ];

      for (const rule of validationRules) {
        if (!rule.condition) {
          logger.error('설정 검증 실패', new Error(rule.message));
          return false;
        }
      }

      logger.info('설정 검증 완료');
      return true;
    } catch (error) {
      logger.error('설정 검증 중 오류 발생', error as Error);
      return false;
    }
  }

  /**
   * 기본 설정 반환
   */
  private getDefaultConfig(): AppConfig {
    logger.warning('기본 설정 사용 중');

    return {
      environment: {
        name: this.environment,
        region: 'ap-northeast-2',
        logLevel: 'INFO',
      },
      security: {
        corsAllowedOrigins: ['http://localhost:5173', 'http://localhost:3000'],
        jwtExpirationHours: 24,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSymbols: false,
        },
      },
      api: {
        throttling: {
          burstLimit: 200,
          rateLimit: 100,
        },
      },
      database: {
        readCapacity: 5,
        writeCapacity: 5,
        backupEnabled: true,
        pointInTimeRecoveryEnabled: true,
      },
      notifications: {},
    };
  }

  /**
   * 기본 시크릿 반환 (개발 환경만)
   */
  private getDefaultSecrets(): AppSecrets {
    return {
      jwtSecret: 'dev-jwt-secret-key-for-development-only',
      dbEncryptionKey: 'dev-db-encryption-key',
      apiKeys: {
        externalService: 'dev-external-api-key',
        analytics: 'dev-analytics-key',
      },
    };
  }

  /**
   * 중첩된 객체에서 값 추출
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path
      .split('.')
      .reduce((current: unknown, key: string) => (current as Record<string, unknown>)?.[key], obj);
  }
}

/**
 * 글로벌 설정 관리자 인스턴스
 */
export const configManager = ConfigManager.getInstance();

/**
 * 설정 초기화 헬퍼 함수
 */
export async function initializeConfig(): Promise<{ config: AppConfig; secrets: AppSecrets }> {
  const [config, secrets] = await Promise.all([
    configManager.loadConfig(),
    configManager.loadSecrets(),
  ]);

  // 설정 유효성 검사
  const isValid = await configManager.validateConfig();
  if (!isValid) {
    throw new Error('설정 검증에 실패했습니다.');
  }

  return { config, secrets };
}
