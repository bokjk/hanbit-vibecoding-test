import { logger } from '../utils/error-handler';
import { Todo } from '@hanbit/types';

/**
 * 인메모리 캐싱 서비스
 *
 * 주요 기능:
 * - Lambda 컨테이너 재사용을 활용한 인메모리 캐싱
 * - TTL 기반 캐시 만료 관리
 * - LRU 캐시 정책으로 메모리 사용량 제한
 * - 캐시 히트율 모니터링
 * - 자주 조회되는 데이터의 응답 시간 개선
 */

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  totalRequests: number;
  hitRate: number;
  size: number;
  memoryUsage: number; // bytes
}

class InMemoryCache {
  private cache: Map<string, CacheItem<unknown>> = new Map();
  private readonly maxSize: number;
  private readonly defaultTtl: number;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    hitRate: 0,
    size: 0,
    memoryUsage: 0,
  };

  constructor(maxSize: number = 1000, defaultTtlSeconds: number = 300) {
    this.maxSize = maxSize;
    this.defaultTtl = defaultTtlSeconds * 1000; // Convert to milliseconds

    // 주기적인 만료된 항목 정리 (5분마다)
    setInterval(() => this.cleanupExpiredItems(), 5 * 60 * 1000);

    logger.debug('In-memory cache initialized', {
      maxSize,
      defaultTtlSeconds,
    });
  }

  /**
   * 캐시에서 데이터 조회
   */
  get<T>(key: string): T | null {
    this.metrics.totalRequests++;

    const item = this.cache.get(key);

    if (!item) {
      this.metrics.misses++;
      this.updateHitRate();
      return null;
    }

    // TTL 체크
    if (Date.now() > item.timestamp + item.ttl) {
      this.cache.delete(key);
      this.metrics.misses++;
      this.updateHitRate();
      this.updateMetrics();
      return null;
    }

    // 접근 통계 업데이트
    item.accessCount++;
    item.lastAccessed = Date.now();

    this.metrics.hits++;
    this.updateHitRate();

    logger.debug('Cache hit', { key, accessCount: item.accessCount });
    return item.data;
  }

  /**
   * 캐시에 데이터 저장
   */
  set<T>(key: string, data: T, ttlSeconds?: number): void {
    const ttl = ttlSeconds ? ttlSeconds * 1000 : this.defaultTtl;

    // 최대 크기 체크 및 LRU 정리
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    this.cache.set(key, item);
    this.updateMetrics();

    logger.debug('Cache set', {
      key,
      ttlSeconds: ttl / 1000,
      cacheSize: this.cache.size,
    });
  }

  /**
   * 캐시에서 데이터 제거
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateMetrics();
      logger.debug('Cache delete', { key });
    }
    return deleted;
  }

  /**
   * 키 패턴으로 캐시 항목들 삭제
   */
  deletePattern(pattern: string): number {
    const regex = new RegExp(pattern);
    let deletedCount = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      this.updateMetrics();
      logger.debug('Cache pattern delete', { pattern, deletedCount });
    }

    return deletedCount;
  }

  /**
   * 캐시 전체 초기화
   */
  clear(): void {
    this.cache.clear();
    this.updateMetrics();
    this.resetMetrics();
    logger.debug('Cache cleared');
  }

  /**
   * LRU 정책에 따른 캐시 제거
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug('LRU eviction', { evictedKey: oldestKey });
    }
  }

  /**
   * 만료된 항목들 정리
   */
  private cleanupExpiredItems(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.timestamp + item.ttl) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.updateMetrics();
      logger.debug('Expired items cleaned', { expiredCount });
    }
  }

  /**
   * 히트율 업데이트
   */
  private updateHitRate(): void {
    this.metrics.hitRate =
      this.metrics.totalRequests > 0 ? (this.metrics.hits / this.metrics.totalRequests) * 100 : 0;
  }

  /**
   * 메트릭 업데이트
   */
  private updateMetrics(): void {
    this.metrics.size = this.cache.size;
    this.metrics.memoryUsage = this.estimateMemoryUsage();
  }

  /**
   * 메트릭 초기화
   */
  private resetMetrics(): void {
    this.metrics.hits = 0;
    this.metrics.misses = 0;
    this.metrics.totalRequests = 0;
    this.metrics.hitRate = 0;
  }

  /**
   * 메모리 사용량 추정
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;

    for (const [key, item] of this.cache.entries()) {
      // 키와 메타데이터 크기 추정
      totalSize += key.length * 2; // UTF-16 encoding
      totalSize += JSON.stringify(item.data).length * 2;
      totalSize += 64; // 메타데이터 오버헤드 추정
    }

    return totalSize;
  }

  /**
   * 캐시 메트릭 반환
   */
  getMetrics(): CacheMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * 캐시 상태 정보
   */
  getStatus(): {
    size: number;
    maxSize: number;
    memoryUsageKB: number;
    hitRate: number;
    oldestItemAge: number;
  } {
    let oldestAge = 0;
    const now = Date.now();

    for (const item of this.cache.values()) {
      const age = now - item.timestamp;
      if (age > oldestAge) {
        oldestAge = age;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsageKB: Math.round(this.estimateMemoryUsage() / 1024),
      hitRate: Math.round(this.metrics.hitRate * 100) / 100,
      oldestItemAge: Math.round(oldestAge / 1000), // seconds
    };
  }
}

// 글로벌 캐시 인스턴스 (Lambda 컨테이너 재사용)
const globalCache = new InMemoryCache(
  parseInt(process.env.CACHE_MAX_SIZE || '1000'),
  parseInt(process.env.CACHE_DEFAULT_TTL || '300')
);

/**
 * 캐시 서비스 클래스
 */
export class CacheService {
  private cache: InMemoryCache;
  private readonly keyPrefix: string;

  constructor(keyPrefix: string = 'todo') {
    this.cache = globalCache;
    this.keyPrefix = keyPrefix;
  }

  /**
   * TODO 목록 캐시 조회
   */
  getUserTodos(userId: string): Todo[] | null {
    const key = this.buildKey('user_todos', userId);
    return this.cache.get<Todo[]>(key);
  }

  /**
   * TODO 목록 캐시 저장
   */
  setUserTodos(userId: string, todos: Todo[], ttlSeconds?: number): void {
    const key = this.buildKey('user_todos', userId);
    this.cache.set(key, todos, ttlSeconds);
  }

  /**
   * 단일 TODO 캐시 조회
   */
  getTodo(userId: string, todoId: string): Todo | null {
    const key = this.buildKey('todo', userId, todoId);
    return this.cache.get<Todo>(key);
  }

  /**
   * 단일 TODO 캐시 저장
   */
  setTodo(userId: string, todo: Todo, ttlSeconds?: number): void {
    const key = this.buildKey('todo', userId, todo.id);
    this.cache.set(key, todo, ttlSeconds);
  }

  /**
   * 우선순위별 TODO 목록 캐시 조회
   */
  getTodosByPriority(userId: string, priority: string, completed?: boolean): Todo[] | null {
    const key = this.buildKey('priority', userId, priority, String(completed ?? 'all'));
    return this.cache.get<Todo[]>(key);
  }

  /**
   * 우선순위별 TODO 목록 캐시 저장
   */
  setTodosByPriority(
    userId: string,
    priority: string,
    completed: boolean | undefined,
    todos: Todo[],
    ttlSeconds?: number
  ): void {
    const key = this.buildKey('priority', userId, priority, String(completed ?? 'all'));
    this.cache.set(key, todos, ttlSeconds);
  }

  /**
   * 사용자 관련 모든 캐시 무효화
   */
  invalidateUserCache(userId: string): number {
    const pattern = `^${this.keyPrefix}:.*:${userId}($|:)`;
    return this.cache.deletePattern(pattern);
  }

  /**
   * 특정 TODO 관련 캐시 무효화
   */
  invalidateTodoCache(userId: string, todoId: string): void {
    // 단일 TODO 캐시 삭제
    const todoKey = this.buildKey('todo', userId, todoId);
    this.cache.delete(todoKey);

    // 관련된 목록 캐시들 삭제
    const userPattern = `^${this.keyPrefix}:user_todos:${userId}$`;
    this.cache.deletePattern(userPattern);

    // 우선순위별 캐시들 삭제
    const priorityPattern = `^${this.keyPrefix}:priority:${userId}:`;
    this.cache.deletePattern(priorityPattern);
  }

  /**
   * 검색 결과 캐시 조회
   */
  getSearchResults(userId: string, query: string): Todo[] | null {
    const key = this.buildKey('search', userId, this.hashQuery(query));
    return this.cache.get<Todo[]>(key);
  }

  /**
   * 검색 결과 캐시 저장
   */
  setSearchResults(userId: string, query: string, todos: Todo[], ttlSeconds = 120): void {
    const key = this.buildKey('search', userId, this.hashQuery(query));
    this.cache.set(key, todos, ttlSeconds); // 검색 결과는 짧은 TTL
  }

  /**
   * 캐시 키 구성
   */
  private buildKey(...parts: string[]): string {
    return [this.keyPrefix, ...parts].join(':');
  }

  /**
   * 쿼리 문자열 해싱 (캐시 키 길이 최적화)
   */
  private hashQuery(query: string): string {
    // 간단한 해시 함수 (실제 운영환경에서는 crypto 모듈 사용 권장)
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 32bit 정수로 변환
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 캐시 상태 및 메트릭 조회
   */
  getStats(): {
    metrics: CacheMetrics;
    status: ReturnType<InMemoryCache['getStatus']>;
    keyCount: { [prefix: string]: number };
  } {
    const metrics = this.cache.getMetrics();
    const status = this.cache.getStatus();

    // 키 타입별 통계
    const keyCount: { [prefix: string]: number } = {};

    // 실제로는 캐시 내부 구현에 접근하기 어려우므로, 메트릭으로 대체
    keyCount[this.keyPrefix] = status.size;

    return {
      metrics,
      status,
      keyCount,
    };
  }

  /**
   * 캐시 웜업 (자주 사용되는 데이터 미리 로딩)
   */
  async warmup(
    userId: string,
    preloadData?: {
      todos?: Todo[];
      priorities?: Array<{ priority: string; todos: Todo[] }>;
    }
  ): Promise<void> {
    if (!preloadData) return;

    const startTime = Date.now();
    let preloadedCount = 0;

    try {
      // 전체 TODO 목록 캐시
      if (preloadData.todos) {
        this.setUserTodos(userId, preloadData.todos, 600); // 10분 TTL
        preloadedCount++;
      }

      // 우선순위별 TODO 목록 캐시
      if (preloadData.priorities) {
        preloadData.priorities.forEach(({ priority, todos }) => {
          this.setTodosByPriority(userId, priority, undefined, todos, 300); // 5분 TTL
          preloadedCount++;
        });
      }

      const duration = Date.now() - startTime;
      logger.info('Cache warmup completed', {
        userId,
        preloadedCount,
        duration,
      });
    } catch (error) {
      logger.error('Cache warmup failed', error as Error, { userId });
    }
  }

  /**
   * 캐시 헬스체크
   */
  healthCheck(): {
    healthy: boolean;
    hitRate: number;
    memoryUsageKB: number;
    size: number;
  } {
    const status = this.cache.getStatus();
    const metrics = this.cache.getMetrics();

    return {
      healthy: status.memoryUsageKB < 50 * 1024, // 50MB 미만일 때 healthy
      hitRate: metrics.hitRate,
      memoryUsageKB: status.memoryUsageKB,
      size: status.size,
    };
  }
}

// 디폴트 캐시 서비스 인스턴스
export const cacheService = new CacheService('hanbit_todo');

/**
 * 캐시 데코레이터 함수
 */
export function withCache<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: {
    keyGenerator: (...args: Parameters<T>) => string;
    ttlSeconds?: number;
  }
): T {
  return (async (...args: Parameters<T>) => {
    const key = options.keyGenerator(...args);

    // 캐시 확인
    const cached = globalCache.get(key);
    if (cached !== null) {
      return cached;
    }

    // 함수 실행 및 결과 캐시
    const result = await fn(...args);
    globalCache.set(key, result, options.ttlSeconds);

    return result;
  }) as T;
}
