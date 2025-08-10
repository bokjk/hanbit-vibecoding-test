import { appConfig } from '../../config/app-config';
import { AuthService } from '../auth.service';
import { APIError } from '../../errors/api-error';
import type {
  APIResponse,
  GetTodosParams,
  GetTodosResponse,
  CreateTodoRequest,
  CreateTodoResponse,
  GetTodoResponse,
  UpdateTodoRequest,
  UpdateTodoResponse,
  DeleteTodoResponse,
  ExportDataResponse,
  ImportDataResponse,
  ImportOptions,
  MigrateDataRequest,
  MigrateDataResponse,
  RequestConfig
} from '../../types/api.types';

/**
 * TODO API 클라이언트
 * 모든 TODO 관련 API 엔드포인트를 관리합니다
 */
export class TodoAPIClient {
  private readonly baseURL: string;
  private readonly authService: AuthService;

  constructor(baseURL: string, authService: AuthService) {
    this.baseURL = baseURL;
    this.authService = authService;
  }

  // ================================
  // HTTP 요청 래퍼 메서드
  // ================================

  /**
   * 공통 HTTP 요청 처리기
   */
  private async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<APIResponse<T>> {
    const {
      timeout = appConfig.api.timeout,
      retries = appConfig.api.retryAttempts,
      retryDelay = appConfig.api.retryDelay,
      ...fetchOptions
    } = config;

    // Authorization 헤더 추가
    const token = await this.authService.getValidToken();
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...fetchOptions.headers,
    };

    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers,
    };

    return this.executeRequest<T>(`${this.baseURL}${endpoint}`, requestOptions, {
      timeout,
      retries,
      retryDelay
    });
  }

  /**
   * 재시도 로직을 포함한 요청 실행
   */
  private async executeRequest<T>(
    url: string,
    options: RequestInit,
    config: { timeout: number; retries: number; retryDelay: number }
  ): Promise<APIResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= config.retries; attempt++) {
      try {
        // AbortController로 타임아웃 설정
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await APIError.fromResponse(response);
          
          // 재시도 불가능한 에러인 경우 즉시 던지기
          if (!error.isRetryable || attempt === config.retries) {
            throw error;
          }
          
          lastError = error;
        } else {
          return await response.json();
        }
      } catch (error) {
        lastError = error as Error;

        // 타임아웃 에러 처리
        if (error instanceof Error && error.name === 'AbortError') {
          if (attempt === config.retries) {
            throw APIError.createTimeoutError();
          }
        }
        // 네트워크 에러 처리
        else if (error instanceof TypeError) {
          if (attempt === config.retries) {
            throw APIError.createNetworkError(error);
          }
        }
        // API 에러는 재시도 여부에 따라 처리
        else if (error instanceof APIError) {
          if (!error.isRetryable || attempt === config.retries) {
            throw error;
          }
        }
        // 기타 예상치 못한 에러
        else if (attempt === config.retries) {
          throw error;
        }
      }

      // 재시도 전 대기 (지수 백오프)
      if (attempt < config.retries) {
        const delay = config.retryDelay * Math.pow(2, attempt);
        await this.sleep(delay);
        
        if (appConfig.features.debugMode) {
          console.log(`🔄 Retrying request (${attempt + 1}/${config.retries}) after ${delay}ms`);
        }
      }
    }

    // 모든 재시도 실패
    throw lastError || new Error('Request failed after all retries');
  }

  /**
   * 비동기 대기 유틸리티
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ================================
  // TODO CRUD API 메서드들
  // ================================

  /**
   * TODO 목록 조회
   */
  async getTodos(params?: GetTodosParams): Promise<APIResponse<GetTodosResponse>> {
    const queryString = params ? new URLSearchParams(
      Object.entries(params)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)])
    ).toString() : '';

    return this.request<GetTodosResponse>(
      `/todos${queryString ? `?${queryString}` : ''}`,
      { method: 'GET' }
    );
  }

  /**
   * 새로운 TODO 생성
   */
  async createTodo(data: CreateTodoRequest): Promise<APIResponse<CreateTodoResponse>> {
    return this.request<CreateTodoResponse>('/todos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * 특정 TODO 조회
   */
  async getTodo(id: string): Promise<APIResponse<GetTodoResponse>> {
    return this.request<GetTodoResponse>(`/todos/${id}`, {
      method: 'GET',
    });
  }

  /**
   * TODO 수정
   */
  async updateTodo(
    id: string,
    data: UpdateTodoRequest
  ): Promise<APIResponse<UpdateTodoResponse>> {
    return this.request<UpdateTodoResponse>(`/todos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * TODO 삭제
   */
  async deleteTodo(id: string): Promise<APIResponse<DeleteTodoResponse>> {
    return this.request<DeleteTodoResponse>(`/todos/${id}`, {
      method: 'DELETE',
    });
  }

  // ================================
  // 데이터 관리 API 메서드들
  // ================================

  /**
   * 데이터 내보내기
   */
  async exportData(format: 'json' | 'csv' = 'json'): Promise<APIResponse<ExportDataResponse>> {
    return this.request<ExportDataResponse>(`/export?format=${format}`, {
      method: 'GET',
    });
  }

  /**
   * 데이터 가져오기
   */
  async importData(
    file: File,
    options: ImportOptions
  ): Promise<APIResponse<ImportDataResponse>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('options', JSON.stringify(options));

    // FormData 사용 시 Content-Type을 자동으로 설정하도록 함
    return this.request<ImportDataResponse>('/import', {
      method: 'POST',
      body: formData,
      headers: {}, // Content-Type 헤더 제거하여 브라우저가 자동 설정하도록 함
    });
  }

  /**
   * localStorage 데이터 마이그레이션
   */
  async migrateFromLocalStorage(
    request: MigrateDataRequest
  ): Promise<APIResponse<MigrateDataResponse>> {
    return this.request<MigrateDataResponse>('/migrate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ================================
  // 배치 처리 API 메서드들
  // ================================

  /**
   * 여러 TODO를 한 번에 생성
   */
  async createMultipleTodos(
    todos: CreateTodoRequest[]
  ): Promise<APIResponse<CreateTodoResponse[]>> {
    return this.request<CreateTodoResponse[]>('/todos/batch', {
      method: 'POST',
      body: JSON.stringify({ todos }),
    });
  }

  /**
   * 여러 TODO를 한 번에 업데이트
   */
  async updateMultipleTodos(
    updates: Array<{ id: string; data: UpdateTodoRequest }>
  ): Promise<APIResponse<UpdateTodoResponse[]>> {
    return this.request<UpdateTodoResponse[]>('/todos/batch', {
      method: 'PUT',
      body: JSON.stringify({ updates }),
    });
  }

  /**
   * 여러 TODO를 한 번에 삭제
   */
  async deleteMultipleTodos(ids: string[]): Promise<APIResponse<DeleteTodoResponse[]>> {
    return this.request<DeleteTodoResponse[]>('/todos/batch', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  }

  // ================================
  // 유틸리티 메서드들
  // ================================

  /**
   * API 헬스 체크
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5초 타임아웃
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 현재 사용자의 할당량 정보 조회
   */
  async getQuotaInfo(): Promise<APIResponse<{ maxItems: number; currentCount: number; isGuest: boolean }>> {
    return this.request('/quota', { method: 'GET' });
  }

  /**
   * API 버전 정보 조회
   */
  async getVersionInfo(): Promise<APIResponse<{ version: string; buildDate: string }>> {
    return this.request('/version', { method: 'GET' });
  }
}

/**
 * TODO API 클라이언트 인스턴스
 */
export const todoApiService = new TodoAPIClient();