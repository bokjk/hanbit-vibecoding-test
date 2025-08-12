import type { APIErrorResponse } from '../types/api.types';

/**
 * API 에러를 나타내는 커스텀 에러 클래스
 * HTTP 응답 에러와 네트워크 에러를 구분하여 처리합니다
 */
export class APIError extends Error {
  public readonly code: string;
  public readonly status?: number;
  public readonly details?: unknown;
  public readonly timestamp: string;
  public readonly requestId?: string;
  public readonly isRetryable: boolean;

  constructor(
    errorResponse: APIErrorResponse,
    status?: number,
    originalError?: Error
  ) {
    super(errorResponse.error.message);
    
    this.name = 'APIError';
    this.code = errorResponse.error.code;
    this.status = status;
    this.details = errorResponse.error.details;
    this.timestamp = errorResponse.error.timestamp;
    this.requestId = errorResponse.error.requestId;
    this.isRetryable = this.determineRetryability();

    // Error 스택 추적을 위해 원본 에러 보존
    if (originalError) {
      this.stack = originalError.stack;
    }
  }

  /**
   * 네트워크 에러인지 확인
   */
  isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR' || 
           this.code === 'TIMEOUT_ERROR' ||
           !this.status; // status가 없으면 네트워크 에러로 간주
  }

  /**
   * 서버 에러인지 확인 (5xx)
   */
  isServerError(): boolean {
    return this.status ? this.status >= 500 : false;
  }

  /**
   * 클라이언트 에러인지 확인 (4xx)
   */
  isClientError(): boolean {
    return this.status ? this.status >= 400 && this.status < 500 : false;
  }

  /**
   * 인증 에러인지 확인
   */
  isAuthError(): boolean {
    return this.code === 'UNAUTHORIZED' || 
           this.code === 'TOKEN_EXPIRED' ||
           this.status === 401;
  }

  /**
   * 권한 에러인지 확인
   */
  isForbiddenError(): boolean {
    return this.code === 'FORBIDDEN' || this.status === 403;
  }

  /**
   * 리소스를 찾을 수 없는 에러인지 확인
   */
  isNotFoundError(): boolean {
    return this.code === 'NOT_FOUND' || this.status === 404;
  }

  /**
   * 할당량 초과 에러인지 확인
   */
  isQuotaExceededError(): boolean {
    return this.code === 'QUOTA_EXCEEDED';
  }

  /**
   * 재시도 가능한지 확인
   */
  private determineRetryability(): boolean {
    // 네트워크 에러나 서버 에러는 재시도 가능
    if (this.isNetworkError() || this.isServerError()) {
      return true;
    }

    // 일시적인 서비스 장애는 재시도 가능
    if (this.code === 'SERVICE_UNAVAILABLE') {
      return true;
    }

    // 클라이언트 에러는 일반적으로 재시도 불가능
    return false;
  }

  /**
   * 사용자 친화적 메시지 반환
   */
  getUserFriendlyMessage(): string {
    switch (this.code) {
      case 'NETWORK_ERROR':
        return '네트워크 연결을 확인해 주세요.';
      case 'TIMEOUT_ERROR':
        return '요청 시간이 초과되었습니다. 다시 시도해 주세요.';
      case 'UNAUTHORIZED':
        return '로그인이 필요합니다.';
      case 'FORBIDDEN':
        return '접근 권한이 없습니다.';
      case 'NOT_FOUND':
        return '요청한 데이터를 찾을 수 없습니다.';
      case 'QUOTA_EXCEEDED':
        return '할당량이 초과되었습니다.';
      case 'SERVICE_UNAVAILABLE':
        return '서비스가 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.';
      case 'VALIDATION_ERROR':
        return '입력 데이터를 확인해 주세요.';
      default:
        return this.message || '알 수 없는 오류가 발생했습니다.';
    }
  }

  /**
   * 에러 정보를 JSON 형태로 직렬화
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
      isRetryable: this.isRetryable,
    };
  }

  /**
   * 네트워크 에러 생성 팩토리 메서드
   */
  static createNetworkError(originalError?: Error): APIError {
    const errorResponse: APIErrorResponse = {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: '네트워크 연결 오류가 발생했습니다.',
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      }
    };
    return new APIError(errorResponse, undefined, originalError);
  }

  /**
   * 타임아웃 에러 생성 팩토리 메서드
   */
  static createTimeoutError(): APIError {
    const errorResponse: APIErrorResponse = {
      success: false,
      error: {
        code: 'TIMEOUT_ERROR',
        message: '요청 시간이 초과되었습니다.',
        timestamp: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      }
    };
    return new APIError(errorResponse);
  }

  /**
   * HTTP 응답으로부터 APIError 생성
   */
  static async fromResponse(response: Response): Promise<APIError> {
    try {
      const errorData: APIErrorResponse = await response.json();
      return new APIError(errorData, response.status);
    } catch {
      // JSON 파싱에 실패한 경우 기본 에러 생성
      const errorResponse: APIErrorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
          timestamp: new Date().toISOString(),
          requestId: crypto.randomUUID(),
        }
      };
      return new APIError(errorResponse, response.status);
    }
  }
}