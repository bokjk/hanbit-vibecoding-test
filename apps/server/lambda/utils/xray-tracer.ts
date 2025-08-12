import AWSXRay from 'aws-xray-sdk-core';
import AWS from 'aws-sdk';

/**
 * 고성능 X-Ray 분산 추적 시스템
 * - 서브시스템별 세그먼트 생성 및 관리
 * - 성능 병목 지점 자동 감지
 * - 에러 추적 및 스택 트레이스 통합
 * - 실시간 성능 메트릭 수집
 */

// 성능 임계값 상수
const PERFORMANCE_THRESHOLDS = {
  SLOW_QUERY_MS: 100,
  VERY_SLOW_QUERY_MS: 500,
  SLOW_API_CALL_MS: 200,
  VERY_SLOW_API_CALL_MS: 1000,
  MEMORY_WARNING_MB: 100,
  MEMORY_CRITICAL_MB: 200
} as const;

// 서브시스템 카테고리
export enum SubsystemType {
  DATABASE = 'database',
  API_CALL = 'api_call',
  BUSINESS_LOGIC = 'business_logic',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  SERIALIZATION = 'serialization'
}

// 성능 메트릭 인터페이스
interface PerformanceMetric {
  subsystem: SubsystemType;
  operation: string;
  duration: number;
  memoryUsage?: number;
  isBottleneck: boolean;
  severity: 'info' | 'warning' | 'critical';
}

// 에러 컨텍스트 인터페이스
interface ErrorContext {
  operation: string;
  subsystem: SubsystemType;
  inputData?: unknown;
  userId?: string;
  correlationId?: string;
  stackTrace: string;
}

// 성능 메트릭 수집기
class PerformanceCollector {
  private static instance: PerformanceCollector;
  private metrics: PerformanceMetric[] = [];
  private bottleneckThresholds = PERFORMANCE_THRESHOLDS;

  static getInstance(): PerformanceCollector {
    if (!PerformanceCollector.instance) {
      PerformanceCollector.instance = new PerformanceCollector();
    }
    return PerformanceCollector.instance;
  }

  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // 성능 병목 감지 및 자동 알림
    if (metric.isBottleneck) {
      this.notifyBottleneck(metric);
    }
  }

  private notifyBottleneck(metric: PerformanceMetric): void {
    console.warn(`[BOTTLENECK DETECTED] ${metric.subsystem}:${metric.operation} - ${metric.duration}ms`, {
      severity: metric.severity,
      threshold: this.getThresholdForSubsystem(metric.subsystem),
      memoryUsage: metric.memoryUsage
    });
  }

  private getThresholdForSubsystem(subsystem: SubsystemType): number {
    switch (subsystem) {
      case SubsystemType.DATABASE:
        return this.bottleneckThresholds.SLOW_QUERY_MS;
      case SubsystemType.API_CALL:
        return this.bottleneckThresholds.SLOW_API_CALL_MS;
      default:
        return 50; // 기본 임계값
    }
  }

  getBottlenecks(): PerformanceMetric[] {
    return this.metrics.filter(m => m.isBottleneck);
  }

  reset(): void {
    this.metrics = [];
  }
}

// 전역 성능 수집기 인스턴스
const performanceCollector = PerformanceCollector.getInstance();

// 환경 변수로 X-Ray 활성화 여부 확인
const isXRayEnabled = !!process.env._X_AMZN_TRACE_ID;

let xrayInitialized = false;

/**
 * X-Ray SDK 초기화
 * Lambda 환경에서는 자동으로 세그먼트가 생성되므로 별도 설정 불필요
 */
export function initializeXRay(): void {
  if (xrayInitialized || !isXRayEnabled) {
    return;
  }

  try {
    // AWS SDK 자동 계측 활성화
    AWSXRay.captureAWS(AWS);

    // 로컬 테스트 환경에서는 X-Ray 데몬이 없을 수 있으므로 오류 무시
    if (process.env.NODE_ENV === 'development') {
      AWSXRay.setContextMissingStrategy('LOG_ERROR');
    }

    xrayInitialized = true;
    console.log('X-Ray SDK initialized successfully');
  } catch (error) {
    console.warn('X-Ray SDK initialization failed:', error);
  }
}

/**
 * 고성능 비동기 작업 추적 및 성능 모니터링
 * - 실시간 성능 측정
 * - 자동 병목 감지
 * - 상세한 에러 추적
 */
export function traceAsyncWithMetrics<T>(
  operation: string,
  subsystem: SubsystemType,
  fn: (subsegment?: AWSXRay.Subsegment) => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  if (!isXRayEnabled) {
    return fn();
  }

  const startTime = Date.now();
  const startMemory = process.memoryUsage();

  return new Promise((resolve, reject) => {
    AWSXRay.captureAsyncFunc(`${subsystem}:${operation}`, async subsegment => {
      try {
        // 상세 메타데이터 추가
        if (subsegment) {
          subsegment.addMetadata('performance', {
            subsystem,
            operation,
            startTime,
            startMemory: Math.round(startMemory.heapUsed / 1024 / 1024),
            ...metadata
          });
          
          // 서브시스템별 주석 추가
          subsegment.addAnnotation('subsystem', subsystem);
          subsegment.addAnnotation('operation', operation);
        }

        const result = await fn(subsegment);
        
        // 성능 메트릭 수집
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        const duration = endTime - startTime;
        const memoryDelta = Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024);
        
        // 성능 병목 감지
        const isBottleneck = detectBottleneck(subsystem, duration);
        const severity = getSeverityLevel(subsystem, duration, memoryDelta);
        
        // 성능 메트릭 기록
        const metric: PerformanceMetric = {
          subsystem,
          operation,
          duration,
          memoryUsage: memoryDelta,
          isBottleneck,
          severity
        };
        
        performanceCollector.recordMetric(metric);
        
        // X-Ray 세그먼트에 성능 데이터 추가
        if (subsegment) {
          subsegment.addMetadata('performance_result', {
            duration,
            memoryDelta,
            isBottleneck,
            severity,
            endMemory: Math.round(endMemory.heapUsed / 1024 / 1024)
          });
          
          // 성능 주석 추가
          subsegment.addAnnotation('duration_ms', duration);
          subsegment.addAnnotation('memory_mb', memoryDelta);
          subsegment.addAnnotation('is_bottleneck', isBottleneck);
        }

        if (subsegment) {
          subsegment.close();
        }

        resolve(result);
      } catch (error) {
        // 상세 에러 컨텍스트 수집
        const errorContext: ErrorContext = {
          operation,
          subsystem,
          inputData: metadata,
          stackTrace: error instanceof Error ? error.stack || '' : String(error)
        };
        
        // X-Ray 세그먼트에 에러 정보 추가
        if (subsegment) {
          subsegment.addError(error as Error);
          subsegment.addMetadata('error_context', errorContext);
          subsegment.addAnnotation('error_type', error instanceof Error ? error.constructor.name : 'UnknownError');
          subsegment.close(error as Error);
        }
        
        // 에러 로깅
        console.error(`[${subsystem}:${operation}] Error occurred:`, {
          error: error instanceof Error ? error.message : String(error),
          context: errorContext
        });
        
        reject(error);
      }
    });
  });
}

/**
 * 레거시 호환성을 위한 기존 traceAsync 함수 (성능 개선 적용)
 */
export function traceAsync<T>(
  name: string,
  fn: (subsegment?: AWSXRay.Subsegment) => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  return traceAsyncWithMetrics(
    name,
    SubsystemType.BUSINESS_LOGIC,
    fn,
    metadata
  );
}

/**
 * 고성능 동기 함수 추적 (빠른 작업용)
 */
export function traceSyncWithMetrics<T>(
  operation: string,
  subsystem: SubsystemType,
  fn: (subsegment?: AWSXRay.Subsegment) => T,
  metadata?: Record<string, unknown>
): T {
  if (!isXRayEnabled) {
    return fn();
  }

  const startTime = Date.now();
  
  return AWSXRay.captureFunc(`${subsystem}:${operation}`, subsegment => {
    try {
      if (subsegment) {
        subsegment.addMetadata('sync_operation', {
          subsystem,
          operation,
          startTime,
          ...metadata
        });
        
        subsegment.addAnnotation('subsystem', subsystem);
        subsegment.addAnnotation('operation', operation);
      }
      
      const result = fn(subsegment);
      
      const duration = Date.now() - startTime;
      
      // 빠른 성능 체크 (동기 작업은 일반적으로 매우 빠름)
      if (duration > 10) { // 10ms 이상인 동기 작업은 주목할 만함
        const metric: PerformanceMetric = {
          subsystem,
          operation,
          duration,
          isBottleneck: duration > 50,
          severity: duration > 50 ? 'warning' : 'info'
        };
        
        performanceCollector.recordMetric(metric);
        
        if (subsegment) {
          subsegment.addMetadata('sync_performance', {
            duration,
            isUnexpectedlySlow: duration > 10
          });
          subsegment.addAnnotation('duration_ms', duration);
        }
      }
      
      return result;
    } catch (error) {
      if (subsegment) {
        const errorContext: ErrorContext = {
          operation,
          subsystem,
          inputData: metadata,
          stackTrace: error instanceof Error ? error.stack || '' : String(error)
        };
        
        subsegment.addError(error as Error);
        subsegment.addMetadata('sync_error_context', errorContext);
      }
      throw error;
    }
  });
}

/**
 * 레거시 호환성을 위한 기존 traceSync 함수
 */
export function traceSync<T>(
  name: string,
  fn: (subsegment?: AWSXRay.Subsegment) => T,
  metadata?: Record<string, unknown>
): T {
  return traceSyncWithMetrics(
    name,
    SubsystemType.BUSINESS_LOGIC,
    fn,
    metadata
  );
}

/**
 * 현재 세그먼트에 사용자 정보 추가
 */
export function addUserInfo(userId: string, userType: 'authenticated' | 'guest'): void {
  if (!isXRayEnabled) return;

  try {
    const segment = AWSXRay.getSegment();
    if (segment) {
      segment.setUser(userId);
      segment.addAnnotation('userType', userType);
    }
  } catch (error) {
    console.warn('Failed to add user info to X-Ray segment:', error);
  }
}

/**
 * 현재 세그먼트에 주석 추가
 */
export function addAnnotation(key: string, value: string | number | boolean): void {
  if (!isXRayEnabled) return;

  try {
    const segment = AWSXRay.getSegment();
    if (segment) {
      segment.addAnnotation(key, value);
    }
  } catch (error) {
    console.warn('Failed to add annotation to X-Ray segment:', error);
  }
}

/**
 * 현재 세그먼트에 메타데이터 추가 (성능 최적화)
 */
export function addMetadata(namespace: string, data: Record<string, unknown>): void {
  if (!isXRayEnabled) return;

  try {
    const segment = AWSXRay.getSegment();
    if (segment) {
      segment.addMetadata(namespace, data);
    }
  } catch (error) {
    console.warn('Failed to add metadata to X-Ray segment:', error);
  }
}

// ==========================================
// 성능 분석 유틸리티 함수들
// ==========================================

/**
 * 성능 병목 감지 로직
 */
function detectBottleneck(subsystem: SubsystemType, duration: number): boolean {
  switch (subsystem) {
    case SubsystemType.DATABASE:
      return duration > PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS;
    case SubsystemType.API_CALL:
      return duration > PERFORMANCE_THRESHOLDS.SLOW_API_CALL_MS;
    case SubsystemType.BUSINESS_LOGIC:
      return duration > 100; // 비즈니스 로직 100ms 임계값
    case SubsystemType.AUTHENTICATION:
      return duration > 200; // 인증 200ms 임계값
    case SubsystemType.VALIDATION:
      return duration > 50;  // 검증 50ms 임계값
    case SubsystemType.SERIALIZATION:
      return duration > 25;  // 직렬화 25ms 임계값
    default:
      return duration > 50;  // 기본 50ms 임계값
  }
}

/**
 * 심각도 수준 결정
 */
function getSeverityLevel(
  subsystem: SubsystemType,
  duration: number,
  memoryUsage: number
): 'info' | 'warning' | 'critical' {
  // 메모리 기준 심각도
  if (memoryUsage > PERFORMANCE_THRESHOLDS.MEMORY_CRITICAL_MB) {
    return 'critical';
  }
  if (memoryUsage > PERFORMANCE_THRESHOLDS.MEMORY_WARNING_MB) {
    return 'warning';
  }
  
  // 서브시스템별 성능 임계값 기준
  const criticalThresholds = {
    [SubsystemType.DATABASE]: PERFORMANCE_THRESHOLDS.VERY_SLOW_QUERY_MS,
    [SubsystemType.API_CALL]: PERFORMANCE_THRESHOLDS.VERY_SLOW_API_CALL_MS,
    [SubsystemType.BUSINESS_LOGIC]: 500,
    [SubsystemType.AUTHENTICATION]: 1000,
    [SubsystemType.VALIDATION]: 200,
    [SubsystemType.SERIALIZATION]: 100
  };
  
  const warningThresholds = {
    [SubsystemType.DATABASE]: PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS,
    [SubsystemType.API_CALL]: PERFORMANCE_THRESHOLDS.SLOW_API_CALL_MS,
    [SubsystemType.BUSINESS_LOGIC]: 100,
    [SubsystemType.AUTHENTICATION]: 200,
    [SubsystemType.VALIDATION]: 50,
    [SubsystemType.SERIALIZATION]: 25
  };
  
  if (duration > criticalThresholds[subsystem]) {
    return 'critical';
  }
  if (duration > warningThresholds[subsystem]) {
    return 'warning';
  }
  
  return 'info';
}

/**
 * 성능 요약 리포트 생성
 */
export function generatePerformanceReport(): {
  totalOperations: number;
  bottlenecks: PerformanceMetric[];
  averageDuration: number;
  slowestOperations: PerformanceMetric[];
} {
  const bottlenecks = performanceCollector.getBottlenecks();
  const slowestOperations = bottlenecks
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 5);
    
  return {
    totalOperations: performanceCollector['metrics'].length,
    bottlenecks,
    averageDuration: performanceCollector['metrics'].reduce((sum, m) => sum + m.duration, 0) / performanceCollector['metrics'].length || 0,
    slowestOperations
  };
}

/**
 * 성능 메트릭 초기화 (테스트용)
 */
export function resetPerformanceMetrics(): void {
  performanceCollector.reset();
}

/**
 * 성능 임계값 동적 조정 (운영 환경용)
 */
export function updatePerformanceThresholds(newThresholds: Partial<typeof PERFORMANCE_THRESHOLDS>): void {
  Object.assign(performanceCollector['bottleneckThresholds'], newThresholds);
}

/**
 * X-Ray 서브시스템 타입 상수 export
 */
export { SubsystemType };
