import * as AWSXRay from 'aws-xray-sdk-core';
import { logger } from './error-handler';

/**
 * Lambda 콜드 스타트 최적화 유틸리티
 *
 * 주요 기능:
 * - 공통 의존성 pre-loading
 * - 연결 풀 초기화 및 재사용
 * - 메모리 사용 최적화
 * - 초기화 성능 메트릭 수집
 */

interface ColdStartMetrics {
  isWarm: boolean;
  initStartTime: number;
  initDuration?: number;
  memoryUsage: NodeJS.MemoryUsage;
  nodeVersion: string;
  architecture: string;
}

// Global 변수 (Lambda 컨테이너 재사용)
let isContainerInitialized = false;
const initializationStartTime = Date.now();

// 연결 풀 및 캐시 (컨테이너 간 재사용)
const connectionPool = new Map<string, unknown>();
const configCache = new Map<string, string>();

/**
 * 콜드 스타트 상태 확인
 */
export function isColdStart(): boolean {
  return !isContainerInitialized;
}

/**
 * Lambda 컨테이너 초기화
 */
export async function initializeLambdaContainer(): Promise<ColdStartMetrics> {
  const startTime = Date.now();
  const coldStart = isColdStart();

  if (coldStart) {
    logger.info('Lambda cold start detected - initializing container', {
      initStartTime: initializationStartTime,
    });

    // 공통 의존성 pre-loading
    await preloadDependencies();

    // AWS 서비스 연결 풀 초기화
    await initializeConnectionPools();

    // X-Ray 세그먼트 초기화
    await initializeXRayTracing();

    // 환경변수 캐싱
    cacheEnvironmentVariables();

    isContainerInitialized = true;

    const initDuration = Date.now() - startTime;
    logger.info('Lambda container initialization completed', {
      coldStart: true,
      initDuration,
      memoryUsage: process.memoryUsage(),
    });
  }

  return {
    isWarm: !coldStart,
    initStartTime: initializationStartTime,
    initDuration: coldStart ? Date.now() - startTime : undefined,
    memoryUsage: process.memoryUsage(),
    nodeVersion: process.version,
    architecture: process.arch,
  };
}

/**
 * 공통 의존성 pre-loading
 */
async function preloadDependencies(): Promise<void> {
  try {
    // 자주 사용되는 AWS SDK 클라이언트들을 미리 로드
    const dynamoImport = import('aws-sdk/clients/dynamodb');
    const cognitoImport = import('aws-sdk/clients/cognitoidentity');
    const ssmImport = import('aws-sdk/clients/ssm');

    // 유틸리티 모듈들 pre-loading
    const cryptoImport = import('crypto');
    const uuidImport = import('uuid');

    await Promise.all([dynamoImport, cognitoImport, ssmImport, cryptoImport, uuidImport]);

    logger.debug('Common dependencies preloaded successfully');
  } catch (error) {
    logger.warn('Failed to preload some dependencies', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * AWS 서비스 연결 풀 초기화
 */
async function initializeConnectionPools(): Promise<void> {
  try {
    // DynamoDB 클라이언트 초기화 및 캐싱
    if (!connectionPool.has('dynamodb')) {
      const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
      const { DynamoDBDocumentClient } = await import('@aws-sdk/lib-dynamodb');

      const client = new DynamoDBClient({
        region: process.env.AWS_REGION,
        maxAttempts: 3,
        requestTimeout: 1000, // 1초 타임아웃
      });

      const docClient = DynamoDBDocumentClient.from(client, {
        marshallOptions: {
          convertEmptyValues: false,
          removeUndefinedValues: true,
          convertClassInstanceToMap: false,
        },
        unmarshallOptions: {
          wrapNumbers: false,
        },
      });

      connectionPool.set('dynamodb', docClient);
      logger.debug('DynamoDB connection pool initialized');
    }

    // Cognito 클라이언트 초기화 및 캐싱
    if (!connectionPool.has('cognito')) {
      const { CognitoIdentityClient } = await import('@aws-sdk/client-cognito-identity');

      const cognitoClient = new CognitoIdentityClient({
        region: process.env.AWS_REGION,
        maxAttempts: 3,
      });

      connectionPool.set('cognito', cognitoClient);
      logger.debug('Cognito connection pool initialized');
    }
  } catch (error) {
    logger.error('Failed to initialize connection pools', error as Error);
    throw error;
  }
}

/**
 * X-Ray 추적 초기화
 */
async function initializeXRayTracing(): Promise<void> {
  if (process.env.AWS_XRAY_TRACING_NAME) {
    try {
      const AWS = await import('aws-sdk');
      AWSXRay.captureAWS(AWS);
      logger.debug('X-Ray tracing initialized');
    } catch (error) {
      logger.debug('X-Ray initialization skipped', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

/**
 * 환경변수 캐싱 (빈번한 접근 최적화)
 */
function cacheEnvironmentVariables(): void {
  const envVars = {
    DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME,
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID,
    COGNITO_IDENTITY_POOL_ID: process.env.COGNITO_IDENTITY_POOL_ID,
    AWS_REGION: process.env.AWS_REGION,
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
  };

  Object.entries(envVars).forEach(([key, value]) => {
    if (value) {
      configCache.set(key, value);
    }
  });

  logger.debug('Environment variables cached', {
    cachedCount: configCache.size,
  });
}

/**
 * 캐시된 연결 가져오기
 */
export function getConnection(type: 'dynamodb' | 'cognito'): unknown {
  const connection = connectionPool.get(type);
  if (!connection) {
    throw new Error(`Connection pool not initialized for ${type}`);
  }
  return connection;
}

/**
 * 캐시된 설정값 가져오기
 */
export function getCachedConfig(key: string): string | undefined {
  return configCache.get(key) || process.env[key];
}

/**
 * Lambda warmer 헬퍼 함수
 */
export function isWarmerEvent(event: unknown): boolean {
  if (typeof event !== 'object' || event === null) {
    return false;
  }

  const eventObj = event as Record<string, unknown>;
  return (
    eventObj.source === 'serverless-plugin-warmup' ||
    eventObj.action === 'ping' ||
    eventObj.warmer === true
  );
}

/**
 * Warmer 이벤트 응답
 */
export function handleWarmerEvent(): { statusCode: number; body: string } {
  logger.debug('Lambda warmer event handled');
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Lambda is warm',
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage(),
    }),
  };
}

/**
 * 메모리 최적화를 위한 가비지 컬렉션 힌트
 */
export function optimizeMemory(): void {
  if (global.gc) {
    global.gc();
    logger.debug('Garbage collection triggered', {
      memoryUsage: process.memoryUsage(),
    });
  }
}

/**
 * Lambda 성능 메트릭 로깅
 */
export function logPerformanceMetrics(functionName: string, duration: number): void {
  const metrics = {
    functionName,
    duration,
    memoryUsage: process.memoryUsage(),
    isWarm: !isColdStart(),
    timestamp: new Date().toISOString(),
  };

  // CloudWatch 커스텀 메트릭 형식으로 로깅
  console.log(`MONITORING|${duration}|Milliseconds|${functionName}|ExecutionTime`);
  console.log(
    `MONITORING|${metrics.memoryUsage.heapUsed / 1024 / 1024}|Megabytes|${functionName}|MemoryUsed`
  );
  console.log(`MONITORING|${metrics.isWarm ? 0 : 1}|Count|${functionName}|ColdStarts`);

  logger.info('Performance metrics', metrics);
}

/**
 * 연결 풀 정리 (Lambda 종료시)
 */
export function cleanupConnections(): void {
  connectionPool.clear();
  configCache.clear();
  isContainerInitialized = false;
  logger.debug('Connection pools cleaned up');
}

// Lambda 컨테이너 종료시 정리
process.on('beforeExit', cleanupConnections);
