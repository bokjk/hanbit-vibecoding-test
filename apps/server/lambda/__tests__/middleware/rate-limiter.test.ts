import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  RateLimiter, 
  RateLimitError, 
  defaultRateLimits, 
  extractClientIdentifier, 
  createUserIdentifier, 
  createRateLimitMiddleware 
} from '../../middleware/rate-limiter';
import type { RateLimitConfig } from '../../middleware/rate-limiter';

// DynamoDB 클라이언트 모킹
const mockSend = vi.fn();
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({
    send: mockSend
  })),
  UpdateItemCommand: vi.fn((params) => ({ params }))
}));

// 로거 모킹
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  const testConfig: RateLimitConfig = {
    limit: 5,
    windowMs: 60000, // 1 minute
  };

  beforeEach(() => {
    vi.clearAllMocks();
    rateLimiter = new RateLimiter('us-east-1', 'test-rate-limits');
    
    // 현재 시간 모킹 (테스트 일관성을 위해)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ================================
  // checkRateLimit 메서드 테스트
  // ================================

  describe('checkRateLimit', () => {
    it('should allow request within rate limit', async () => {
      const mockResponse = {
        Attributes: {
          requests: { N: '1' }
        }
      };
      mockSend.mockResolvedValueOnce(mockResponse);

      const result = await rateLimiter.checkRateLimit('test-client', testConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 5 limit - 1 request = 4
      expect(result.resetTime).toBe(60000); // 1 minute window
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it('should deny request when rate limit exceeded', async () => {
      const mockResponse = {
        Attributes: {
          requests: { N: '6' } // exceeds limit of 5
        }
      };
      mockSend.mockResolvedValueOnce(mockResponse);

      const result = await rateLimiter.checkRateLimit('test-client', testConfig);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should handle DynamoDB errors gracefully', async () => {
      mockSend.mockRejectedValueOnce(new Error('DynamoDB error'));

      const result = await rateLimiter.checkRateLimit('test-client', testConfig);

      // 실패 시 허용 (가용성 우선)
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // limit - 1
    });

    it('should generate correct DynamoDB parameters', async () => {
      const mockResponse = { Attributes: { requests: { N: '1' } } };
      mockSend.mockResolvedValueOnce(mockResponse);

      await rateLimiter.checkRateLimit('test-client', testConfig);

      const updateCommand = mockSend.mock.calls[0][0];
      expect(updateCommand.params).toEqual({
        TableName: 'test-rate-limits',
        Key: {
          id: { S: expect.stringContaining('test-client:') }
        },
        UpdateExpression: 'ADD requests :inc SET #ttl = :ttl, updated_at = :now',
        ExpressionAttributeNames: {
          '#ttl': 'ttl'
        },
        ExpressionAttributeValues: {
          ':inc': { N: '1' },
          ':ttl': { N: expect.any(String) },
          ':now': { N: '0' } // mocked time
        },
        ReturnValues: 'ALL_NEW'
      });
    });

    it('should handle block duration configuration', async () => {
      const configWithBlock = {
        ...testConfig,
        blockDurationMs: 300000 // 5 minutes
      };

      const mockResponse = {
        Attributes: {
          requests: { N: '6' } // exceeds limit
        }
      };
      mockSend.mockResolvedValueOnce(mockResponse);

      // setBlock 메서드 모킹 (두 번째 호출)
      mockSend.mockResolvedValueOnce({}); 

      const result = await rateLimiter.checkRateLimit('test-client', configWithBlock);

      expect(result.allowed).toBe(false);
      expect(mockSend).toHaveBeenCalledTimes(2); // checkRateLimit + setBlock
    });

    it('should calculate time windows correctly', async () => {
      const now = Date.now();
      const windowStart = Math.floor(now / testConfig.windowMs) * testConfig.windowMs;
      const expectedKey = `test-client:${windowStart}`;

      const mockResponse = { Attributes: { requests: { N: '1' } } };
      mockSend.mockResolvedValueOnce(mockResponse);

      await rateLimiter.checkRateLimit('test-client', testConfig);

      const updateCommand = mockSend.mock.calls[0][0];
      expect(updateCommand.params.Key.id.S).toBe(expectedKey);
    });
  });

  // ================================
  // setBlock 메서드 테스트
  // ================================

  describe('setBlock', () => {
    it('should set block with correct parameters', async () => {
      mockSend.mockResolvedValueOnce({});

      const blockDuration = 300000; // 5 minutes
      await rateLimiter.setBlock('test-client', blockDuration);

      const updateCommand = mockSend.mock.calls[0][0];
      expect(updateCommand.params).toEqual({
        TableName: 'test-rate-limits',
        Key: {
          id: { S: 'block:test-client' }
        },
        UpdateExpression: 'SET block_until = :block_until, #ttl = :ttl',
        ExpressionAttributeNames: {
          '#ttl': 'ttl'
        },
        ExpressionAttributeValues: {
          ':block_until': { N: '300000' }, // current time (0) + duration
          ':ttl': { N: expect.any(String) }
        }
      });
    });

    it('should handle DynamoDB errors gracefully', async () => {
      mockSend.mockRejectedValueOnce(new Error('DynamoDB error'));

      // 에러를 던지지 않아야 함
      await expect(rateLimiter.setBlock('test-client', 300000)).resolves.toBeUndefined();
    });
  });

  // ================================
  // isBlocked 메서드 테스트
  // ================================

  describe('isBlocked', () => {
    it('should return not blocked when no block exists', async () => {
      mockSend.mockResolvedValueOnce({ Attributes: {} });

      const result = await rateLimiter.isBlocked('test-client');

      expect(result.blocked).toBe(false);
      expect(result.retryAfter).toBeUndefined();
    });

    it('should return blocked when block is active', async () => {
      const futureTime = Date.now() + 300000; // 5 minutes in future
      mockSend.mockResolvedValueOnce({
        Attributes: {
          block_until: { N: String(futureTime) }
        }
      });

      const result = await rateLimiter.isBlocked('test-client');

      expect(result.blocked).toBe(true);
      expect(result.retryAfter).toBe(300); // 5 minutes in seconds
    });

    it('should return not blocked when block has expired', async () => {
      const pastTime = Date.now() - 300000; // 5 minutes in past
      mockSend.mockResolvedValueOnce({
        Attributes: {
          block_until: { N: String(pastTime) }
        }
      });

      const result = await rateLimiter.isBlocked('test-client');

      expect(result.blocked).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockSend.mockRejectedValueOnce(new Error('DynamoDB error'));

      const result = await rateLimiter.isBlocked('test-client');

      expect(result.blocked).toBe(false);
    });
  });

  // ================================
  // checkMultipleRateLimits 메서드 테스트
  // ================================

  describe('checkMultipleRateLimits', () => {
    const multipleConfigs = [
      { name: 'global', config: defaultRateLimits.global },
      { name: 'auth', config: defaultRateLimits.auth }
    ];

    it('should pass when all limits are satisfied', async () => {
      // isBlocked 호출 (첫 번째)
      mockSend.mockResolvedValueOnce({ Attributes: {} });
      // 첫 번째 rate limit 체크
      mockSend.mockResolvedValueOnce({ Attributes: { requests: { N: '1' } } });
      // 두 번째 rate limit 체크
      mockSend.mockResolvedValueOnce({ Attributes: { requests: { N: '1' } } });

      const result = await rateLimiter.checkMultipleRateLimits('test-client', multipleConfigs);

      expect(result.allowed).toBe(true);
      expect(result.failedCheck).toBeUndefined();
    });

    it('should fail when one limit is exceeded', async () => {
      // isBlocked 호출
      mockSend.mockResolvedValueOnce({ Attributes: {} });
      // 첫 번째 rate limit 체크 (성공)
      mockSend.mockResolvedValueOnce({ Attributes: { requests: { N: '1' } } });
      // 두 번째 rate limit 체크 (실패)
      mockSend.mockResolvedValueOnce({ Attributes: { requests: { N: '6' } } });

      const result = await rateLimiter.checkMultipleRateLimits('test-client', multipleConfigs);

      expect(result.allowed).toBe(false);
      expect(result.failedCheck).toBe('auth');
      expect(result.result).toBeDefined();
    });

    it('should fail immediately when client is blocked', async () => {
      const futureTime = Date.now() + 300000;
      mockSend.mockResolvedValueOnce({
        Attributes: {
          block_until: { N: String(futureTime) }
        }
      });

      const result = await rateLimiter.checkMultipleRateLimits('test-client', multipleConfigs);

      expect(result.allowed).toBe(false);
      expect(result.failedCheck).toBe('blocked');
      expect(mockSend).toHaveBeenCalledTimes(1); // Only isBlocked call
    });
  });
});

describe('RateLimitError', () => {
  it('should create error with proper properties', () => {
    const error = new RateLimitError('Rate limit exceeded', 60, 100, 5);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('RateLimitError');
    expect(error.message).toBe('Rate limit exceeded');
    expect(error.retryAfter).toBe(60);
    expect(error.limit).toBe(100);
    expect(error.remaining).toBe(5);
  });
});

describe('Default Rate Limits', () => {
  it('should have proper default configurations', () => {
    expect(defaultRateLimits.global).toEqual({
      limit: 100,
      windowMs: 60 * 1000
    });

    expect(defaultRateLimits.auth).toEqual({
      limit: 5,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 60 * 60 * 1000
    });

    expect(defaultRateLimits.todos).toEqual({
      limit: 60,
      windowMs: 60 * 1000
    });

    expect(defaultRateLimits.strict).toEqual({
      limit: 10,
      windowMs: 60 * 1000,
      blockDurationMs: 5 * 60 * 1000
    });
  });
});

describe('Utility Functions', () => {
  
  // ================================
  // extractClientIdentifier 함수 테스트
  // ================================

  describe('extractClientIdentifier', () => {
    it('should extract client IP from request context', () => {
      const event = {
        requestContext: {
          identity: {
            sourceIp: '192.168.1.1'
          }
        },
        headers: {}
      };

      const result = extractClientIdentifier(event);
      expect(result).toBe('192.168.1.1');
    });

    it('should prefer X-Real-IP header', () => {
      const event = {
        requestContext: {
          identity: {
            sourceIp: '192.168.1.1'
          }
        },
        headers: {
          'X-Real-IP': '10.0.0.1',
          'X-Forwarded-For': '203.0.113.1, 198.51.100.1'
        }
      };

      const result = extractClientIdentifier(event);
      expect(result).toBe('10.0.0.1');
    });

    it('should use first IP from X-Forwarded-For when X-Real-IP not available', () => {
      const event = {
        requestContext: {
          identity: {
            sourceIp: '192.168.1.1'
          }
        },
        headers: {
          'X-Forwarded-For': '203.0.113.1, 198.51.100.1, 192.168.1.1'
        }
      };

      const result = extractClientIdentifier(event);
      expect(result).toBe('203.0.113.1');
    });

    it('should handle case-insensitive headers', () => {
      const event = {
        requestContext: {
          identity: {
            sourceIp: '192.168.1.1'
          }
        },
        headers: {
          'x-real-ip': '10.0.0.1' // lowercase
        }
      };

      const result = extractClientIdentifier(event);
      expect(result).toBe('10.0.0.1');
    });

    it('should fallback to sourceIp when headers not available', () => {
      const event = {
        requestContext: {
          identity: {
            sourceIp: '192.168.1.1'
          }
        },
        headers: {}
      };

      const result = extractClientIdentifier(event);
      expect(result).toBe('192.168.1.1');
    });

    it('should return "unknown" when no IP available', () => {
      const event = {
        requestContext: {
          identity: {
            sourceIp: undefined as any
          }
        },
        headers: {}
      };

      const result = extractClientIdentifier(event);
      expect(result).toBe('unknown');
    });
  });

  // ================================
  // createUserIdentifier 함수 테스트
  // ================================

  describe('createUserIdentifier', () => {
    it('should create user identifier with client IP', () => {
      const result = createUserIdentifier('user123', '192.168.1.1');
      expect(result).toBe('user:user123:192.168.1.1');
    });

    it('should create user identifier without client IP', () => {
      const result = createUserIdentifier('user123');
      expect(result).toBe('user:user123');
    });

    it('should handle empty client IP', () => {
      const result = createUserIdentifier('user123', '');
      expect(result).toBe('user:user123');
    });
  });

  // ================================
  // createRateLimitMiddleware 함수 테스트
  // ================================

  describe('createRateLimitMiddleware', () => {
    let mockRateLimiter: RateLimiter;
    let middleware: ReturnType<typeof createRateLimitMiddleware>;

    beforeEach(() => {
      mockRateLimiter = {
        checkMultipleRateLimits: vi.fn()
      } as any;

      const configs = [
        { name: 'global', config: defaultRateLimits.global }
      ];

      middleware = createRateLimitMiddleware(mockRateLimiter, configs);
    });

    it('should create middleware function', () => {
      expect(typeof middleware).toBe('function');
    });

    it('should pass rate limit check', async () => {
      const mockEvent = {
        requestContext: {
          identity: { sourceIp: '192.168.1.1' },
          requestId: 'test-request-id'
        },
        headers: {}
      };

      (mockRateLimiter.checkMultipleRateLimits as any).mockResolvedValueOnce({
        allowed: true,
        result: { allowed: true, remaining: 5, resetTime: 60000 }
      });

      const result = await middleware(mockEvent, {});

      expect(result).toEqual({
        allowed: true,
        remaining: 5,
        resetTime: 60000
      });
    });

    it('should throw RateLimitError when limit exceeded', async () => {
      const mockEvent = {
        requestContext: {
          identity: { sourceIp: '192.168.1.1' },
          requestId: 'test-request-id'
        },
        headers: {}
      };

      (mockRateLimiter.checkMultipleRateLimits as any).mockResolvedValueOnce({
        allowed: false,
        failedCheck: 'global',
        result: { allowed: false, remaining: 0, resetTime: 60000, retryAfter: 30 }
      });

      await expect(middleware(mockEvent, {})).rejects.toThrow(RateLimitError);
    });

    it('should handle rate limiter errors gracefully', async () => {
      const mockEvent = {
        requestContext: {
          identity: { sourceIp: '192.168.1.1' }
        },
        headers: {}
      };

      (mockRateLimiter.checkMultipleRateLimits as any).mockRejectedValueOnce(
        new Error('Rate limiter error')
      );

      const result = await middleware(mockEvent, {});

      // 에러 시 null 반환 (통과)
      expect(result).toBeNull();
    });

    it('should re-throw RateLimitError specifically', async () => {
      const mockEvent = {
        requestContext: {
          identity: { sourceIp: '192.168.1.1' }
        },
        headers: {}
      };

      const rateLimitError = new RateLimitError('Rate limited', 60, 100, 0);
      (mockRateLimiter.checkMultipleRateLimits as any).mockRejectedValueOnce(rateLimitError);

      await expect(middleware(mockEvent, {})).rejects.toThrow(RateLimitError);
    });
  });

  // ================================
  // 통합 테스트
  // ================================

  describe('Integration Tests', () => {
    it('should handle complete rate limiting flow', async () => {
      vi.useRealTimers(); // 실제 타이머 사용
      
      const rateLimiter = new RateLimiter('us-east-1', 'test-table');
      const testConfig: RateLimitConfig = {
        limit: 2,
        windowMs: 1000, // 1 second window
      };

      // 첫 번째 요청 - 허용
      mockSend.mockResolvedValueOnce({ Attributes: { requests: { N: '1' } } });
      const result1 = await rateLimiter.checkRateLimit('client1', testConfig);
      expect(result1.allowed).toBe(true);

      // 두 번째 요청 - 허용
      mockSend.mockResolvedValueOnce({ Attributes: { requests: { N: '2' } } });
      const result2 = await rateLimiter.checkRateLimit('client1', testConfig);
      expect(result2.allowed).toBe(true);

      // 세 번째 요청 - 거부
      mockSend.mockResolvedValueOnce({ Attributes: { requests: { N: '3' } } });
      const result3 = await rateLimiter.checkRateLimit('client1', testConfig);
      expect(result3.allowed).toBe(false);
      expect(result3.retryAfter).toBeGreaterThan(0);
    });

    it('should handle different clients independently', async () => {
      const testConfig: RateLimitConfig = {
        limit: 1,
        windowMs: 60000,
      };

      // Client 1 요청
      mockSend.mockResolvedValueOnce({ Attributes: { requests: { N: '1' } } });
      const result1 = await rateLimiter.checkRateLimit('client1', testConfig);
      expect(result1.allowed).toBe(true);

      // Client 2 요청 (독립적)
      mockSend.mockResolvedValueOnce({ Attributes: { requests: { N: '1' } } });
      const result2 = await rateLimiter.checkRateLimit('client2', testConfig);
      expect(result2.allowed).toBe(true);
    });

    it('should handle real-world API Gateway event', async () => {
      const apiGatewayEvent = {
        requestContext: {
          requestId: 'c6af9ac6-7b61-11e6-9a41-93e8deadbeef',
          identity: {
            sourceIp: '127.0.0.1'
          }
        },
        headers: {
          'CloudFront-Viewer-Country': 'US',
          'X-Forwarded-For': '203.0.113.1, 198.51.100.1'
        }
      };

      const clientId = extractClientIdentifier(apiGatewayEvent);
      expect(clientId).toBe('203.0.113.1'); // First IP from X-Forwarded-For

      const configs = [{ name: 'api', config: defaultRateLimits.todos }];
      const middleware = createRateLimitMiddleware(rateLimiter, configs);

      // 성공 케이스
      mockSend
        .mockResolvedValueOnce({ Attributes: {} }) // isBlocked 체크
        .mockResolvedValueOnce({ Attributes: { requests: { N: '1' } } }); // rate limit 체크

      const result = await middleware(apiGatewayEvent, {});
      expect(result).toBeDefined();
      expect(result?.allowed).toBe(true);
    });
  });
});