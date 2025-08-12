/**
 * Analytics 서비스
 * Beacon API를 사용한 안정적인 데이터 전송, 배치 처리, 재시도 메커니즘을 제공합니다.
 */

import type { PerformanceMetric } from '../utils/performance-monitor';
import type { ErrorReport } from '../utils/error-reporter';

export interface AnalyticsEvent {
  id: string;
  type: 'performance' | 'error' | 'user_interaction' | 'custom';
  category: string;
  action: string;
  label?: string;
  value?: number;
  timestamp: number;
  sessionId: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface BatchPayload {
  sessionId: string;
  timestamp: number;
  events: AnalyticsEvent[];
  metadata: {
    userAgent: string;
    url: string;
    referrer: string;
    viewport: {
      width: number;
      height: number;
    };
    connection?: {
      effectiveType: string;
      downlink: number;
      rtt: number;
    };
  };
}

export interface AnalyticsConfig {
  endpoint: string;
  batchSize: number;
  flushInterval: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
  enableCompression: boolean;
  enableQueuePersistence: boolean;
  maxQueueSize: number;
  enableDebugLogging: boolean;
}

export interface QueuedEvent {
  event: AnalyticsEvent;
  retryCount: number;
  timestamp: number;
}

/**
 * Analytics 서비스 클래스
 */
export class AnalyticsService {
  private static instance: AnalyticsService;
  private config: AnalyticsConfig;
  private eventQueue: QueuedEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private sessionId: string;
  private isEnabled: boolean;
  private lastFlushTime: number = 0;
  private failedBatches: BatchPayload[] = [];

  private constructor(config?: Partial<AnalyticsConfig>) {
    this.config = {
      endpoint: this.getAnalyticsEndpoint(),
      batchSize: 20,
      flushInterval: 10000, // 10초
      maxRetries: 3,
      retryDelay: 1000,
      enableCompression: true,
      enableQueuePersistence: true,
      maxQueueSize: 1000,
      enableDebugLogging: import.meta.env.VITE_DEBUG === 'true',
      ...config
    };

    this.sessionId = this.generateSessionId();
    this.isEnabled = this.shouldEnableAnalytics();

    if (this.isEnabled) {
      this.initializeService();
      this.schedulePeriodicFlush();
      this.setupBeforeUnloadHandler();
      this.loadPersistedQueue();
    }
  }

  static getInstance(config?: Partial<AnalyticsConfig>): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService(config);
    }
    return AnalyticsService.instance;
  }

  /**
   * Analytics 엔드포인트 조회
   */
  private getAnalyticsEndpoint(): string {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    return `${baseUrl}/analytics/events`;
  }

  /**
   * Analytics 활성화 여부 결정
   */
  private shouldEnableAnalytics(): boolean {
    // 환경변수로 제어
    const isProduction = import.meta.env.MODE === 'production';
    const isDebugMode = import.meta.env.VITE_DEBUG === 'true';
    const enableAnalytics = import.meta.env.VITE_ENABLE_ANALYTICS !== 'false';
    
    // 개발 환경에서는 선택적으로, 프로덕션에서는 기본 활성화
    return enableAnalytics && (isProduction || isDebugMode);
  }

  /**
   * 서비스 초기화
   */
  private initializeService(): void {
    // 페이지 로드 이벤트 추적
    this.trackEvent({
      type: 'user_interaction',
      category: 'page',
      action: 'load',
      label: window.location.pathname
    });

    // 네트워크 상태 변경 추적
    window.addEventListener('online', () => {
      this.trackEvent({
        type: 'user_interaction',
        category: 'network',
        action: 'online'
      });
      // 온라인 상태가 되면 실패한 배치 재시도
      this.retryFailedBatches();
    });

    window.addEventListener('offline', () => {
      this.trackEvent({
        type: 'user_interaction',
        category: 'network',
        action: 'offline'
      });
    });

    this.debugLog('Analytics service initialized', { sessionId: this.sessionId });
  }

  /**
   * 세션 ID 생성
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 이벤트 추적
   */
  trackEvent(eventData: Partial<AnalyticsEvent>): void {
    if (!this.isEnabled) return;

    const event: AnalyticsEvent = {
      id: this.generateEventId(),
      type: 'custom',
      category: 'general',
      action: 'unknown',
      timestamp: Date.now(),
      sessionId: this.sessionId,
      ...eventData
    };

    this.addToQueue(event);
    this.debugLog('Event tracked', event);
  }

  /**
   * 성능 메트릭 추적
   */
  trackPerformanceMetric(metric: PerformanceMetric): void {
    if (!this.isEnabled) return;

    const event: AnalyticsEvent = {
      id: this.generateEventId(),
      type: 'performance',
      category: 'performance',
      action: metric.name,
      value: metric.value,
      timestamp: metric.timestamp,
      sessionId: this.sessionId,
      metadata: {
        url: metric.url,
        userAgent: metric.userAgent,
        ...metric.metadata
      }
    };

    this.addToQueue(event);
    this.debugLog('Performance metric tracked', { name: metric.name, value: metric.value });
  }

  /**
   * 에러 리포트 추적
   */
  trackError(error: ErrorReport): void {
    if (!this.isEnabled) return;

    const event: AnalyticsEvent = {
      id: this.generateEventId(),
      type: 'error',
      category: 'error',
      action: error.type,
      label: error.message.substring(0, 100), // 메시지 길이 제한
      timestamp: error.timestamp,
      sessionId: this.sessionId,
      metadata: {
        errorId: error.id,
        severity: error.severity,
        fingerprint: error.fingerprint,
        stack: error.stack?.substring(0, 500), // 스택 길이 제한
        url: error.url,
        lineNumber: error.lineNumber,
        columnNumber: error.columnNumber,
        context: this.sanitizeErrorContext(error.context)
      }
    };

    this.addToQueue(event);
    this.debugLog('Error tracked', { type: error.type, message: error.message });
  }

  /**
   * 사용자 상호작용 추적
   */
  trackUserInteraction(category: string, action: string, label?: string, value?: number, metadata?: Record<string, unknown>): void {
    this.trackEvent({
      type: 'user_interaction',
      category,
      action,
      label,
      value,
      metadata
    });
  }

  /**
   * 페이지 뷰 추적
   */
  trackPageView(page?: string): void {
    const currentPage = page || window.location.pathname;
    
    this.trackEvent({
      type: 'user_interaction',
      category: 'page',
      action: 'view',
      label: currentPage,
      metadata: {
        title: document.title,
        referrer: document.referrer,
        url: window.location.href
      }
    });
  }

  /**
   * 커스텀 메트릭 추적
   */
  trackCustomMetric(name: string, value: number, metadata?: Record<string, unknown>): void {
    this.trackEvent({
      type: 'custom',
      category: 'metric',
      action: name,
      value,
      metadata
    });
  }

  /**
   * 큐에 이벤트 추가
   */
  private addToQueue(event: AnalyticsEvent): void {
    // 큐 크기 제한 확인
    if (this.eventQueue.length >= this.config.maxQueueSize) {
      // 오래된 이벤트 제거
      this.eventQueue.shift();
      this.debugLog('Event queue overflow, removed oldest event');
    }

    const queuedEvent: QueuedEvent = {
      event,
      retryCount: 0,
      timestamp: Date.now()
    };

    this.eventQueue.push(queuedEvent);

    // 배치 크기에 도달하면 즉시 플러시
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    } else {
      // 큐 영속성이 활성화된 경우 저장
      if (this.config.enableQueuePersistence) {
        this.persistQueue();
      }
    }
  }

  /**
   * 주기적 플러시 스케줄링
   */
  private schedulePeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);
  }

  /**
   * 이벤트 큐 플러시
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const now = Date.now();
    const eventsToSend = this.eventQueue.splice(0, this.config.batchSize);
    
    const payload: BatchPayload = {
      sessionId: this.sessionId,
      timestamp: now,
      events: eventsToSend.map(qe => qe.event),
      metadata: this.getSessionMetadata()
    };

    this.debugLog('Flushing events', { count: payload.events.length });

    try {
      await this.sendBatch(payload);
      this.lastFlushTime = now;
      
      // 큐 영속성 업데이트
      if (this.config.enableQueuePersistence) {
        this.persistQueue();
      }
    } catch (error) {
      this.debugLog('Failed to send batch, adding to retry queue', error);
      
      // 실패한 배치를 재시도 큐에 추가
      this.failedBatches.push(payload);
      
      // 실패한 이벤트를 다시 큐에 추가 (재시도 카운트 증가)
      const retriedEvents = eventsToSend.map(qe => ({
        ...qe,
        retryCount: qe.retryCount + 1
      })).filter(qe => qe.retryCount <= this.config.maxRetries);

      this.eventQueue.unshift(...retriedEvents);
    }
  }

  /**
   * 배치 전송
   */
  private async sendBatch(payload: BatchPayload): Promise<void> {
    const data = this.config.enableCompression ? 
      await this.compressPayload(payload) : 
      JSON.stringify(payload);

    // Beacon API를 우선 사용
    if ('sendBeacon' in navigator && navigator.onLine) {
      const blob = new Blob([data], { type: 'application/json' });
      const sent = navigator.sendBeacon(this.config.endpoint, blob);
      
      if (sent) {
        this.debugLog('Batch sent via Beacon API');
        return;
      } else {
        this.debugLog('Beacon API failed, falling back to fetch');
      }
    }

    // Beacon API 실패시 fetch로 폴백
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.enableCompression && { 'Content-Encoding': 'gzip' })
      },
      body: data,
      keepalive: true // 페이지 unload 시에도 전송 유지
    });

    if (!response.ok) {
      throw new Error(`Analytics request failed: ${response.status} ${response.statusText}`);
    }

    this.debugLog('Batch sent via fetch API');
  }

  /**
   * 페이로드 압축
   */
  private async compressPayload(payload: BatchPayload): Promise<string> {
    // 실제 환경에서는 CompressionStream을 사용하거나 
    // gzip 라이브러리를 사용할 수 있습니다.
    // 여기서는 단순히 JSON.stringify를 반환
    return JSON.stringify(payload);
  }

  /**
   * 실패한 배치 재시도
   */
  private async retryFailedBatches(): Promise<void> {
    if (!navigator.onLine || this.failedBatches.length === 0) return;

    this.debugLog('Retrying failed batches', { count: this.failedBatches.length });

    const batchesToRetry = [...this.failedBatches];
    this.failedBatches = [];

    for (const batch of batchesToRetry) {
      try {
        await this.sendBatch(batch);
        this.debugLog('Retry successful for batch');
      } catch (error) {
        this.debugLog('Retry failed for batch', error);
        // 재시도 제한 확인 후 다시 큐에 추가
        this.failedBatches.push(batch);
      }

      // 재시도 간 지연
      await this.delay(this.config.retryDelay);
    }
  }

  /**
   * 페이지 언로드 시 처리
   */
  private setupBeforeUnloadHandler(): void {
    const handleBeforeUnload = () => {
      // 세션 종료 이벤트 추가
      const sessionEndEvent: AnalyticsEvent = {
        id: this.generateEventId(),
        type: 'user_interaction',
        category: 'session',
        action: 'end',
        timestamp: Date.now(),
        sessionId: this.sessionId,
        metadata: {
          sessionDuration: Date.now() - parseInt(this.sessionId.split('-')[0]),
          url: window.location.href
        }
      };

      // 즉시 전송 (Beacon API 사용)
      if ('sendBeacon' in navigator) {
        const payload: BatchPayload = {
          sessionId: this.sessionId,
          timestamp: Date.now(),
          events: [...this.eventQueue.map(qe => qe.event), sessionEndEvent],
          metadata: this.getSessionMetadata()
        };

        const data = JSON.stringify(payload);
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon(this.config.endpoint, blob);
      }

      // 타이머 정리
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    
    // 모바일 환경에서의 visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }

  /**
   * 큐 영속성 - localStorage에 저장
   */
  private persistQueue(): void {
    try {
      const queueData = {
        events: this.eventQueue,
        timestamp: Date.now(),
        sessionId: this.sessionId
      };
      
      localStorage.setItem('analytics_queue', JSON.stringify(queueData));
    } catch (error) {
      this.debugLog('Failed to persist queue', error);
    }
  }

  /**
   * 영속화된 큐 로드
   */
  private loadPersistedQueue(): void {
    try {
      const stored = localStorage.getItem('analytics_queue');
      if (!stored) return;

      const queueData = JSON.parse(stored);
      
      // 세션이 다르거나 너무 오래된 데이터는 무시
      const maxAge = 24 * 60 * 60 * 1000; // 24시간
      if (queueData.sessionId !== this.sessionId || 
          Date.now() - queueData.timestamp > maxAge) {
        localStorage.removeItem('analytics_queue');
        return;
      }

      // 유효한 이벤트만 복원
      if (Array.isArray(queueData.events)) {
        this.eventQueue = queueData.events.filter((qe: QueuedEvent) => 
          qe.event && qe.retryCount <= this.config.maxRetries
        );
        this.debugLog('Restored queue from persistence', { count: this.eventQueue.length });
      }

      localStorage.removeItem('analytics_queue');
    } catch (error) {
      this.debugLog('Failed to load persisted queue', error);
      localStorage.removeItem('analytics_queue');
    }
  }

  /**
   * 세션 메타데이터 생성
   */
  private getSessionMetadata() {
    const nav = navigator as Navigator & { 
      connection?: { effectiveType: string; downlink: number; rtt: number };
      mozConnection?: { effectiveType: string; downlink: number; rtt: number };
      webkitConnection?: { effectiveType: string; downlink: number; rtt: number };
    };
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection;

    return {
      userAgent: navigator.userAgent,
      url: window.location.href,
      referrer: document.referrer,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      ...(connection && {
        connection: {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt
        }
      })
    };
  }

  /**
   * 에러 컨텍스트 정화 (개인정보 제거)
   */
  private sanitizeErrorContext(context: unknown): unknown {
    if (!context || typeof context !== 'object') return context;

    const sanitized = { ...context };
    
    // 민감한 필드 제거
    delete sanitized.localStorage;
    delete sanitized.sessionStorage;
    
    // 사용자 액션에서 개인정보 제거
    if (sanitized.previousActions && Array.isArray(sanitized.previousActions)) {
      sanitized.previousActions = sanitized.previousActions.map((action: { type?: string; timestamp?: number; target?: string }) => ({
        type: action.type || 'unknown',
        timestamp: action.timestamp || 0,
        target: action.target || 'unknown'
        // metadata는 개인정보가 포함될 수 있으므로 제외
      }));
    }

    return sanitized;
  }

  /**
   * 이벤트 ID 생성
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 디버그 로깅
   */
  private debugLog(message: string, data?: unknown): void {
    if (this.config.enableDebugLogging) {
      console.log(`[Analytics] ${message}`, data || '');
    }
  }

  /**
   * 지연 함수
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 통계 조회
   */
  getStats() {
    return {
      sessionId: this.sessionId,
      queueSize: this.eventQueue.length,
      failedBatchesCount: this.failedBatches.length,
      lastFlushTime: this.lastFlushTime,
      isEnabled: this.isEnabled,
      config: this.config
    };
  }

  /**
   * 즉시 플러시 (수동 트리거)
   */
  async flushNow(): Promise<void> {
    await this.flush();
  }

  /**
   * 서비스 중지
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // 마지막 플러시 시도
    if (this.eventQueue.length > 0) {
      this.flush();
    }

    this.eventQueue = [];
    this.failedBatches = [];
  }
}

export default AnalyticsService;