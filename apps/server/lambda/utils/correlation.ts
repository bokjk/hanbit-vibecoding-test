/**
 * 상관 ID (Correlation ID) 관리 시스템
 * 요청 추적 및 X-Ray 통합을 위한 유틸리티
 */
import { randomUUID } from 'crypto';
import AWSXRay from 'aws-xray-sdk-core';

/**
 * 요청 상관 ID 관리를 위한 컨텍스트
 */
export interface CorrelationContext {
  correlationId: string;
  requestId: string;
  traceId?: string;
  parentSpanId?: string;
  userId?: string;
  sessionId?: string;
  operation?: string;
  timestamp: string;
  source: string;
}

/**
 * 상관 ID 매니저
 */
class CorrelationIdManager {
  private currentContext: CorrelationContext | null = null;

  /**
   * 새로운 상관 ID 컨텍스트 생성
   */
  create(options: {
    requestId?: string;
    userId?: string;
    sessionId?: string;
    operation?: string;
    source?: string;
    parentCorrelationId?: string;
  } = {}): CorrelationContext {
    const correlationId = options.parentCorrelationId 
      ? `${options.parentCorrelationId}.${randomUUID().substring(0, 8)}`
      : randomUUID();

    const context: CorrelationContext = {
      correlationId,
      requestId: options.requestId || randomUUID(),
      timestamp: new Date().toISOString(),
      source: options.source || 'lambda',
      ...(options.userId && { userId: options.userId }),
      ...(options.sessionId && { sessionId: options.sessionId }),
      ...(options.operation && { operation: options.operation }),
    };

    // X-Ray 추적 정보 추가
    try {
      const segment = AWSXRay.getSegment();
      if (segment) {
        context.traceId = segment.trace_id;
        context.parentSpanId = segment.id;
        
        // X-Ray에 메타데이터 추가
        segment.addMetadata('correlation', {
          correlationId: context.correlationId,
          operation: context.operation,
          userId: context.userId,
        });
        
        // 커스텀 어노테이션 추가
        segment.addAnnotation('correlationId', context.correlationId);
        if (context.userId) {
          segment.addAnnotation('userId', context.userId);
        }
        if (context.operation) {
          segment.addAnnotation('operation', context.operation);
        }
      }
    } catch (error) {
      // X-Ray 에러는 무시하고 로깅만 진행
      console.warn('Failed to add X-Ray correlation data:', error);
    }

    this.currentContext = context;
    return context;
  }

  /**
   * 현재 상관 ID 컨텍스트 반환
   */
  getCurrent(): CorrelationContext | null {
    return this.currentContext;
  }

  /**
   * 상관 ID 헤더에서 컨텍스트 추출
   */
  extractFromHeaders(headers: Record<string, string | string[] | undefined>): Partial<CorrelationContext> {
    const getHeader = (key: string): string | undefined => {
      const value = headers[key] || headers[key.toLowerCase()];
      return Array.isArray(value) ? value[0] : value;
    };

    return {
      correlationId: getHeader('X-Correlation-ID'),
      requestId: getHeader('X-Request-ID'),
      traceId: getHeader('X-Trace-ID'),
      userId: getHeader('X-User-ID'),
      sessionId: getHeader('X-Session-ID'),
    };
  }

  /**
   * 다른 서비스 호출 시 헤더에 포함할 상관 ID 정보 반환
   */
  getOutgoingHeaders(): Record<string, string> {
    const context = this.getCurrent();
    if (!context) {
      return {};
    }

    const headers: Record<string, string> = {
      'X-Correlation-ID': context.correlationId,
      'X-Request-ID': context.requestId,
    };

    if (context.traceId) {
      headers['X-Trace-ID'] = context.traceId;
    }

    if (context.userId) {
      headers['X-User-ID'] = context.userId;
    }

    if (context.sessionId) {
      headers['X-Session-ID'] = context.sessionId;
    }

    return headers;
  }

  /**
   * 자식 컨텍스트 생성 (중첩 호출용)
   */
  createChild(operation?: string): CorrelationContext {
    const parent = this.getCurrent();
    if (!parent) {
      throw new Error('No parent correlation context found');
    }

    return this.create({
      parentCorrelationId: parent.correlationId,
      userId: parent.userId,
      sessionId: parent.sessionId,
      operation,
      source: 'nested',
    });
  }

  /**
   * 컨텍스트 업데이트
   */
  updateContext(updates: Partial<CorrelationContext>): void {
    if (this.currentContext) {
      this.currentContext = {
        ...this.currentContext,
        ...updates,
      };

      // X-Ray 메타데이터 업데이트
      try {
        const segment = AWSXRay.getSegment();
        if (segment && updates.operation) {
          segment.addAnnotation('operation', updates.operation);
        }
      } catch (error) {
        // X-Ray 에러는 무시
      }
    }
  }

  /**
   * 컨텍스트 정리
   */
  clear(): void {
    this.currentContext = null;
  }

  /**
   * CloudWatch 로그용 컨텍스트 객체 반환
   */
  getLoggingContext(): Record<string, unknown> {
    const context = this.getCurrent();
    if (!context) {
      return {};
    }

    return {
      correlationId: context.correlationId,
      requestId: context.requestId,
      traceId: context.traceId,
      userId: context.userId,
      sessionId: context.sessionId,
      operation: context.operation,
      source: context.source,
    };
  }
}

/**
 * 싱글톤 인스턴스
 */
export const correlationId = new CorrelationIdManager();

/**
 * Lambda 핸들러용 유틸리티 함수들
 */
export const CorrelationUtils = {
  /**
   * API Gateway 이벤트에서 상관 ID 컨텍스트 초기화
   */
  initializeFromAPIGateway(event: Record<string, unknown>, operation?: string): CorrelationContext {
    const extractedContext = correlationId.extractFromHeaders(event.headers || {});
    
    const requestContext = event.requestContext as Record<string, unknown> | undefined;
    const authorizer = requestContext?.authorizer as Record<string, unknown> | undefined;
    
    return correlationId.create({
      requestId: requestContext?.requestId as string | undefined,
      userId: authorizer?.userId as string | undefined,
      operation,
      source: 'api-gateway',
      parentCorrelationId: extractedContext.correlationId,
    });
  },

  /**
   * EventBridge 이벤트에서 상관 ID 컨텍스트 초기화
   */
  initializeFromEventBridge(event: Record<string, unknown>, operation?: string): CorrelationContext {
    const detail = event.detail as Record<string, unknown> | undefined;
    
    return correlationId.create({
      requestId: (event.id as string) || randomUUID(),
      operation,
      source: 'eventbridge',
      // EventBridge 이벤트의 상세 정보에서 상관 ID 추출 시도
      parentCorrelationId: detail?.correlationId as string | undefined,
    });
  },

  /**
   * SQS 메시지에서 상관 ID 컨텍스트 초기화
   */
  initializeFromSQS(record: Record<string, unknown>, operation?: string): CorrelationContext {
    let parentCorrelationId: string | undefined;
    let userId: string | undefined;

    const messageAttributes = record.messageAttributes as Record<string, Record<string, unknown>> | undefined;
    
    // 메시지 속성에서 상관 ID 추출
    const correlationIdAttr = messageAttributes?.correlationId;
    if (correlationIdAttr?.stringValue) {
      parentCorrelationId = correlationIdAttr.stringValue as string;
    }

    const userIdAttr = messageAttributes?.userId;
    if (userIdAttr?.stringValue) {
      userId = userIdAttr.stringValue as string;
    }

    return correlationId.create({
      requestId: (record.messageId as string) || randomUUID(),
      userId,
      operation,
      source: 'sqs',
      parentCorrelationId,
    });
  },

  /**
   * 외부 서비스 호출용 fetch 래퍼
   */
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = {
      ...correlationId.getOutgoingHeaders(),
      ...options.headers,
    };

    return fetch(url, {
      ...options,
      headers,
    });
  },

  /**
   * 상관 ID가 포함된 이벤트 발행
   */
  createEventWithCorrelation(eventDetail: Record<string, unknown>): Record<string, unknown> {
    const context = correlationId.getCurrent();
    return {
      ...eventDetail,
      correlationId: context?.correlationId,
      parentRequestId: context?.requestId,
      userId: context?.userId,
    };
  },
};