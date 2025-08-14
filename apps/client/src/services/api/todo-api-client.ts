import { appConfig } from "../../config/app-config";
import { AuthService, authService } from "../auth.service";
import { APIError } from "../../errors/api-error";
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
  RequestConfig,
} from "../../types/api.types";

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
    config: RequestConfig = {},
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
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...fetchOptions.headers,
    };

    const requestOptions: RequestInit = {
      ...fetchOptions,
      headers,
    };

    return this.executeRequest<T>(
      `${this.baseURL}${endpoint}`,
      requestOptions,
      {
        timeout,
        retries,
        retryDelay,
      },
    );
  }

  /**
   * 재시도 로직을 포함한 요청 실행
   */
  private async executeRequest<T>(
    url: string,
    options: RequestInit,
    config: { timeout: number; retries: number; retryDelay: number },
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
        if (error instanceof Error && error.name === "AbortError") {
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
          console.log(
            `🔄 Retrying request (${attempt + 1}/${config.retries}) after ${delay}ms`,
          );
        }
      }
    }

    // 모든 재시도 실패
    throw lastError || new Error("Request failed after all retries");
  }

  /**
   * 비동기 대기 유틸리티
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ================================
  // TODO CRUD API 메서드들
  // ================================

  /**
   * TODO 목록 조회
   */
  async getTodos(
    params?: GetTodosParams,
  ): Promise<APIResponse<GetTodosResponse>> {
    const queryString = params
      ? new URLSearchParams(
          Object.entries(params)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value)]),
        ).toString()
      : "";

    return this.request<GetTodosResponse>(
      `/todos${queryString ? `?${queryString}` : ""}`,
      { method: "GET" },
    );
  }

  /**
   * 새로운 TODO 생성
   */
  async createTodo(
    data: CreateTodoRequest,
  ): Promise<APIResponse<CreateTodoResponse>> {
    return this.request<CreateTodoResponse>("/todos", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  /**
   * 특정 TODO 조회
   * @deprecated getTodos()를 사용해서 전체 목록에서 필터링하세요
   */
  async getTodo(id: string): Promise<APIResponse<GetTodoResponse>> {
    // 백엔드에 개별 조회 API가 없으므로 전체 목록에서 찾기
    const response = await this.getTodos();
    const todo = response.data.todos.find(t => t.id === id);
    
    if (!todo) {
      throw APIError.createNotFoundError(`Todo with id ${id} not found`);
    }
    
    return {
      data: { todo },
      success: true,
      message: "Todo retrieved successfully"
    } as APIResponse<GetTodoResponse>;
  }

  /**
   * TODO 수정
   */
  async updateTodo(
    id: string,
    data: UpdateTodoRequest,
  ): Promise<APIResponse<UpdateTodoResponse>> {
    return this.request<UpdateTodoResponse>(`/todos/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  /**
   * TODO 삭제
   */
  async deleteTodo(id: string): Promise<APIResponse<DeleteTodoResponse>> {
    return this.request<DeleteTodoResponse>(`/todos/${id}`, {
      method: "DELETE",
    });
  }

  // ================================
  // 데이터 관리 API 메서드들 (현재 백엔드에 미구현)
  // ================================

  /**
   * 데이터 내보내기
   * @deprecated 백엔드에 구현되지 않음 - localStorage 서비스 사용
   */
  async exportData(
    format: "json" | "csv" = "json",
  ): Promise<APIResponse<ExportDataResponse>> {
    throw new Error("Export API is not implemented in backend. Use localStorage service instead.");
  }

  /**
   * 데이터 가져오기
   * @deprecated 백엔드에 구현되지 않음 - localStorage 서비스 사용
   */
  async importData(
    file: File,
    options: ImportOptions,
  ): Promise<APIResponse<ImportDataResponse>> {
    throw new Error("Import API is not implemented in backend. Use localStorage service instead.");
  }

  /**
   * localStorage 데이터 마이그레이션
   * @deprecated 백엔드에 구현되지 않음 - 클라이언트 사이드에서 처리
   */
  async migrateFromLocalStorage(
    request: MigrateDataRequest,
  ): Promise<APIResponse<MigrateDataResponse>> {
    throw new Error("Migration API is not implemented in backend. Handle on client-side.");
  }

  // ================================
  // 배치 처리 API 메서드들 (현재 백엔드에 미구현)
  // ================================

  /**
   * 여러 TODO를 한 번에 생성
   * @deprecated 백엔드에 구현되지 않음 - 개별 API 호출 사용
   */
  async createMultipleTodos(
    todos: CreateTodoRequest[],
  ): Promise<APIResponse<CreateTodoResponse[]>> {
    throw new Error("Batch create API is not implemented in backend. Use individual API calls.");
  }

  /**
   * 여러 TODO를 한 번에 업데이트
   * @deprecated 백엔드에 구현되지 않음 - 개별 API 호출 사용
   */
  async updateMultipleTodos(
    updates: Array<{ id: string; data: UpdateTodoRequest }>,
  ): Promise<APIResponse<UpdateTodoResponse[]>> {
    throw new Error("Batch update API is not implemented in backend. Use individual API calls.");
  }

  /**
   * 여러 TODO를 한 번에 삭제
   * @deprecated 백엔드에 구현되지 않음 - 개별 API 호출 사용
   */
  async deleteMultipleTodos(
    ids: string[],
  ): Promise<APIResponse<DeleteTodoResponse[]>> {
    throw new Error("Batch delete API is not implemented in backend. Use individual API calls.");
  }

  // ================================
  // 유틸리티 메서드들
  // ================================

  /**
   * API 헬스 체크
   * @deprecated 백엔드에 구현되지 않음 - getTodos() 호출로 대체
   */
  async healthCheck(): Promise<boolean> {
    try {
      // getTodos 호출로 API 상태 확인
      await this.getTodos();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 현재 사용자의 할당량 정보 조회
   * @deprecated 백엔드에 구현되지 않음 - 클라이언트 사이드에서 계산
   */
  async getQuotaInfo(): Promise<
    APIResponse<{ maxItems: number; currentCount: number; isGuest: boolean }>
  > {
    throw new Error("Quota API is not implemented in backend. Calculate on client-side.");
  }

  /**
   * API 버전 정보 조회  
   * @deprecated 백엔드에 구현되지 않음 - 클라이언트 버전 사용
   */
  async getVersionInfo(): Promise<
    APIResponse<{ version: string; buildDate: string }>
  > {
    throw new Error("Version API is not implemented in backend. Use client version instead.");
  }
}

/**
 * TODO API 클라이언트 인스턴스
 */
export const todoApiService = new TodoAPIClient(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api",
  authService,
);
