import { DynamoDBClient, UpdateItemCommand, UpdateItemCommandInput } from '@aws-sdk/client-dynamodb';
import { logger } from '@/utils/logger';

/**
 * DynamoDB 기반 레이트 리미터
 */
export interface RateLimitConfig {
  limit: number;           // 허용 요청 수
  windowMs: number;        // 시간 창 (밀리초)
  blockDurationMs?: number; // 차단 시간 (밀리초) - 선택적
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * 레이트 리미팅 에러
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfter: number,
    public readonly limit: number,
    public readonly remaining: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class RateLimiter {
  private dynamoClient: DynamoDBClient;
  private tableName: string;

  constructor(
    region: string = process.env.AWS_REGION || 'us-east-1',
    tableName: string = process.env.RATE_LIMIT_TABLE || 'rate-limits'
  ) {
    this.dynamoClient = new DynamoDBClient({ region });
    this.tableName = tableName;
  }

  /**
   * 레이트 리미팅 검사 및 적용
   */
  async checkRateLimit(
    identifier: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
    const key = `${identifier}:${windowStart}`;
    const ttl = Math.floor((windowStart + config.windowMs * 2) / 1000); // 2배 여유시간

    try {
      // DynamoDB UpdateItem으로 원자적 카운터 증가
      const updateParams: UpdateItemCommandInput = {
        TableName: this.tableName,
        Key: {
          id: { S: key }
        },
        UpdateExpression: 'ADD requests :inc SET #ttl = :ttl, updated_at = :now',
        ExpressionAttributeNames: {
          '#ttl': 'ttl'
        },
        ExpressionAttributeValues: {
          ':inc': { N: '1' },
          ':ttl': { N: String(ttl) },
          ':now': { N: String(now) }
        },
        ReturnValues: 'ALL_NEW'
      };

      const response = await this.dynamoClient.send(new UpdateItemCommand(updateParams));
      const currentCount = parseInt(response.Attributes?.requests?.N || '0');
      const resetTime = windowStart + config.windowMs;
      const remaining = Math.max(0, config.limit - currentCount);

      // 제한 초과 시 차단 설정
      if (currentCount > config.limit) {
        const retryAfter = Math.ceil((resetTime - now) / 1000);
        
        // 차단 기간이 설정된 경우 추가 차단
        if (config.blockDurationMs) {
          await this.setBlock(identifier, config.blockDurationMs);
        }

        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter
        };
      }

      return {
        allowed: true,
        remaining,
        resetTime
      };
    } catch (error) {
      logger.error('Rate limiting check failed:', error as Error);
      
      // 실패 시 허용 (가용성 우선)
      return {
        allowed: true,
        remaining: config.limit - 1,
        resetTime: windowStart + config.windowMs
      };
    }
  }

  /**
   * 사용자/IP 차단 설정
   */
  async setBlock(identifier: string, durationMs: number): Promise<void> {
    const blockKey = `block:${identifier}`;
    const blockUntil = Date.now() + durationMs;
    const ttl = Math.floor(blockUntil / 1000) + 60; // 1분 여유시간

    try {
      await this.dynamoClient.send(new UpdateItemCommand({
        TableName: this.tableName,
        Key: {
          id: { S: blockKey }
        },
        UpdateExpression: 'SET block_until = :block_until, #ttl = :ttl',
        ExpressionAttributeNames: {
          '#ttl': 'ttl'
        },
        ExpressionAttributeValues: {
          ':block_until': { N: String(blockUntil) },
          ':ttl': { N: String(ttl) }
        }
      }));
    } catch (error) {
      logger.error('Failed to set block:', error as Error);
    }
  }

  /**
   * 차단 상태 확인
   */
  async isBlocked(identifier: string): Promise<{ blocked: boolean; retryAfter?: number }> {
    const blockKey = `block:${identifier}`;
    const now = Date.now();

    try {
      const response = await this.dynamoClient.send(new UpdateItemCommand({
        TableName: this.tableName,
        Key: {
          id: { S: blockKey }
        },
        UpdateExpression: 'SET dummy = :dummy', // DynamoDB GetItem 대신 사용
        ExpressionAttributeValues: {
          ':dummy': { N: String(now) }
        },
        ReturnValues: 'ALL_OLD'
      }));

      const blockUntil = response.Attributes?.block_until?.N;
      if (blockUntil && parseInt(blockUntil) > now) {
        const retryAfter = Math.ceil((parseInt(blockUntil) - now) / 1000);
        return { blocked: true, retryAfter };
      }

      return { blocked: false };
    } catch (error) {
      // 에러 시 차단되지 않은 것으로 처리
      return { blocked: false };
    }
  }

  /**
   * 다중 레이트 리미팅 검사
   */
  async checkMultipleRateLimits(
    identifier: string,
    configs: Array<{ name: string; config: RateLimitConfig }>
  ): Promise<{ allowed: boolean; failedCheck?: string; result?: RateLimitResult }> {
    // 차단 상태 우선 확인
    const blockStatus = await this.isBlocked(identifier);
    if (blockStatus.blocked) {
      return {
        allowed: false,
        failedCheck: 'blocked',
        result: {
          allowed: false,
          remaining: 0,
          resetTime: Date.now() + (blockStatus.retryAfter || 0) * 1000,
          retryAfter: blockStatus.retryAfter
        }
      };
    }

    // 각 레이트 리미팅 규칙 검사
    for (const { name, config } of configs) {
      const result = await this.checkRateLimit(`${name}:${identifier}`, config);
      if (!result.allowed) {
        return {
          allowed: false,
          failedCheck: name,
          result
        };
      }
    }

    return { allowed: true };
  }
}

/**
 * 기본 레이트 리미팅 설정
 */
export const defaultRateLimits = {
  // IP별 글로벌 제한
  global: {
    limit: 100,        // 100 requests
    windowMs: 60 * 1000 // per minute
  },
  
  // 인증 API 제한
  auth: {
    limit: 5,          // 5 attempts
    windowMs: 15 * 60 * 1000, // per 15 minutes
    blockDurationMs: 60 * 60 * 1000 // block for 1 hour
  },
  
  // TODO API 제한
  todos: {
    limit: 60,         // 60 requests
    windowMs: 60 * 1000 // per minute
  },
  
  // 엄격한 제한 (관리자 API 등)
  strict: {
    limit: 10,         // 10 requests
    windowMs: 60 * 1000, // per minute
    blockDurationMs: 5 * 60 * 1000 // block for 5 minutes
  }
};

/**
 * API Gateway 이벤트에서 클라이언트 식별자 추출
 */
export function extractClientIdentifier(event: { 
  requestContext: { identity: { sourceIp: string } };
  headers: Record<string, string | undefined>;
}): string {
  // 사용자 ID가 있으면 우선 사용, 없으면 IP 주소 사용
  const userId = event.requestContext?.identity?.sourceIp;
  const forwardedFor = event.headers['X-Forwarded-For'] || event.headers['x-forwarded-for'];
  const realIP = event.headers['X-Real-IP'] || event.headers['x-real-ip'];
  
  // 실제 클라이언트 IP 추출 (프록시 고려)
  const clientIP = realIP || (forwardedFor?.split(',')[0]?.trim()) || userId || 'unknown';
  
  return clientIP;
}

/**
 * 사용자별 식별자 생성 (인증된 사용자)
 */
export function createUserIdentifier(userId: string, clientIP?: string): string {
  return clientIP ? `user:${userId}:${clientIP}` : `user:${userId}`;
}

/**
 * 레이트 리미팅 미들웨어 팩토리
 */
export function createRateLimitMiddleware(
  rateLimiter: RateLimiter,
  configs: Array<{ name: string; config: RateLimitConfig }>
) {
  return async (event: APIGatewayProxyEvent, _context: unknown): Promise<RateLimitResult | null> => {
    const clientIdentifier = extractClientIdentifier(event);
    
    try {
      const result = await rateLimiter.checkMultipleRateLimits(clientIdentifier, configs);
      
      if (!result.allowed && result.result) {
        logger.warn('Rate limit exceeded', {
          identifier: clientIdentifier,
          failedCheck: result.failedCheck,
          remaining: result.result.remaining,
          retryAfter: result.result.retryAfter,
          requestId: event.requestContext?.requestId
        });
        
        throw new RateLimitError(
          `Rate limit exceeded: ${result.failedCheck}`,
          result.result.retryAfter || 60,
          configs.find(c => c.name === result.failedCheck)?.config.limit || 0,
          result.result.remaining
        );
      }
      
      return result.result || null;
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      
      logger.error('Rate limiting middleware error:', error as Error);
      return null; // 에러 시 통과
    }
  };
}