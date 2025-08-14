/**
 * 통합 스토리지 서비스
 *
 * localStorage와 API 서비스를 추상화하여 하나의 인터페이스로 제공
 * - 온라인/오프라인 상태에 따른 자동 전환
 * - 낙관적 업데이트 지원
 * - 대기 중인 작업 큐 관리
 * - AuthContext와 연동하여 권한 기반 작업 처리
 */

import type { Todo, CreateTodoRequest, UpdateTodoRequest } from "@vive/types";
import type { PendingOperation } from "../contexts/todo.reducer";
import { offlineStorage } from "./offline-storage";
import { todoApiService } from "./api/todo-api-client";
import { authService } from "./auth.service";
import { syncManager } from "./sync-manager";

/**
 * 스토리지 작업 결과
 */
export interface StorageOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  isOptimistic?: boolean; // 낙관적 업데이트 여부
  operationId?: string; // 대기 중인 작업 ID
}

/**
 * 스토리지 설정
 */
export interface StorageConfig {
  enableOptimisticUpdates: boolean;
  autoSync: boolean;
  offlineMode: boolean;
  cacheTimeout: number; // ms
}

/**
 * 작업 우선순위
 */
export type OperationPriority = "high" | "medium" | "low";

/**
 * 통합 스토리지 서비스 클래스
 */
class IntegratedStorageService {
  private config: StorageConfig;
  private isOnline: boolean;
  private cache: Map<string, { data: Todo[]; timestamp: number }>;

  constructor(config?: Partial<StorageConfig>) {
    this.config = {
      enableOptimisticUpdates: true,
      autoSync: true,
      offlineMode: false,
      cacheTimeout: 5 * 60 * 1000, // 5분
      ...config,
    };

    this.isOnline = navigator.onLine;
    this.cache = new Map();

    this.initializeService();
  }

  // ================================
  // 초기화 및 설정
  // ================================

  private initializeService(): void {
    // 네트워크 상태 모니터링
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.handleConnectionRestore();
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
    });

    // 동기화 매니저 이벤트 리스너 등록
    syncManager.addEventListener(
      "sync_success",
      this.handleSyncSuccess.bind(this),
    );
    syncManager.addEventListener("sync_error", this.handleSyncError.bind(this));
    syncManager.addEventListener(
      "sync_conflict",
      this.handleSyncConflict.bind(this),
    );
  }

  private async handleConnectionRestore(): Promise<void> {
    if (this.config.autoSync) {
      // 온라인 복원 시 자동 동기화
      try {
        await syncManager.triggerSync();
      } catch (error) {
        console.warn("Auto sync failed after connection restore:", error);
      }
    }
  }

  private handleSyncSuccess(): void {
    console.log("🔄 Sync completed successfully");
    // 캐시 무효화
    this.cache.clear();
  }

  private handleSyncError(_event: string, data: unknown): void {
    console.error("🔄 Sync failed:", data);
  }

  private handleSyncConflict(_event: string, data: unknown): void {
    console.warn("🔄 Sync conflicts detected:", data);
    // 충돌 해결 로직은 상위 레벨에서 처리
  }

  // ================================
  // 설정 관리
  // ================================

  updateConfig(newConfig: Partial<StorageConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): StorageConfig {
    return { ...this.config };
  }

  // ================================
  // 연결 상태 확인
  // ================================

  isConnected(): boolean {
    return this.isOnline && !this.config.offlineMode;
  }

  canUseAPI(): boolean {
    return this.isConnected() && authService.isAuthenticated();
  }

  // ================================
  // TODO CRUD 작업 (통합 인터페이스)
  // ================================

  /**
   * TODO 목록 조회
   */
  async getTodos(options?: {
    useCache?: boolean;
  }): Promise<StorageOperationResult<Todo[]>> {
    const cacheKey = "todos";
    const useCache = options?.useCache !== false;

    // 캐시 확인
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < this.config.cacheTimeout) {
        return {
          success: true,
          data: cached.data,
        };
      }
    }

    try {
      let todos: Todo[];

      if (this.canUseAPI()) {
        // 온라인: API에서 데이터 가져오기
        const apiResponse = await todoApiService.getAll();
        todos = apiResponse.data.todos || [];

        // 로컬 스토리지에도 백업 저장
        offlineStorage.setTodos(todos);
      } else {
        // 오프라인: 로컬 스토리지에서 데이터 가져오기
        todos = offlineStorage.getTodos();
      }

      // 캐시 업데이트
      this.cache.set(cacheKey, {
        data: todos,
        timestamp: Date.now(),
      });

      return {
        success: true,
        data: todos,
      };
    } catch (error) {
      // API 실패시 로컬 스토리지 폴백
      const localTodos = offlineStorage.getTodos();
      return {
        success: false,
        data: localTodos,
        error: error instanceof Error ? error.message : "Failed to fetch todos",
      };
    }
  }

  /**
   * TODO 생성
   */
  async createTodo(
    todoData: CreateTodoRequest,
  ): Promise<StorageOperationResult<Todo>> {
    // 낙관적 업데이트를 위한 임시 TODO 생성
    const optimisticTodo: Todo = {
      id: crypto.randomUUID(),
      title: todoData.title,
      completed: false,
      description: todoData.description,
      priority: todoData.priority || "medium",
      dueDate: todoData.dueDate,
      tags: todoData.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: authService.getCurrentUserId() || "guest",
    };

    // 즉시 로컬 스토리지에 추가 (낙관적 업데이트)
    if (this.config.enableOptimisticUpdates) {
      offlineStorage.addTodo(optimisticTodo);
      this.cache.clear(); // 캐시 무효화
    }

    if (this.canUseAPI()) {
      try {
        // API 호출
        const response = await todoApiService.create(todoData);
        const serverTodo = response.data;

        // 서버 응답으로 로컬 업데이트
        offlineStorage.updateTodo(optimisticTodo.id, serverTodo);

        return {
          success: true,
          data: serverTodo,
          isOptimistic: false,
        };
      } catch {
        // API 실패시 대기 큐에 추가
        const operationId = crypto.randomUUID();
        const queued = syncManager.queueOperation(
          "create",
          optimisticTodo.id,
          todoData,
        );

        if (!queued) {
          // 큐 추가 실패시 롤백
          offlineStorage.deleteTodo(optimisticTodo.id);
          return {
            success: false,
            error: "Failed to queue operation for later sync",
          };
        }

        return {
          success: true,
          data: optimisticTodo,
          isOptimistic: true,
          operationId,
          error: "Queued for sync when online",
        };
      }
    } else {
      // 오프라인: 대기 큐에 추가
      const operationId = crypto.randomUUID();
      syncManager.queueOperation("create", optimisticTodo.id, todoData);

      return {
        success: true,
        data: optimisticTodo,
        isOptimistic: true,
        operationId,
      };
    }
  }

  /**
   * TODO 업데이트
   */
  async updateTodo(
    id: string,
    updates: UpdateTodoRequest,
  ): Promise<StorageOperationResult<Todo>> {
    // 기존 TODO 찾기
    const existingTodo = offlineStorage.getTodos().find((t) => t.id === id);
    if (!existingTodo) {
      return {
        success: false,
        error: "Todo not found",
      };
    }

    // 낙관적 업데이트
    const updatedTodo: Todo = {
      ...existingTodo,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (this.config.enableOptimisticUpdates) {
      offlineStorage.updateTodo(id, updatedTodo);
      this.cache.clear();
    }

    if (this.canUseAPI()) {
      try {
        // API 호출
        const response = await todoApiService.update(id, updates);
        const serverTodo = response.data;

        // 서버 응답으로 로컬 업데이트
        offlineStorage.updateTodo(id, serverTodo);

        return {
          success: true,
          data: serverTodo,
          isOptimistic: false,
        };
      } catch {
        // API 실패시 대기 큐에 추가
        const operationId = crypto.randomUUID();
        syncManager.queueOperation("update", id, updates);

        return {
          success: true,
          data: updatedTodo,
          isOptimistic: true,
          operationId,
          error: "Queued for sync when online",
        };
      }
    } else {
      // 오프라인: 대기 큐에 추가
      const operationId = crypto.randomUUID();
      syncManager.queueOperation("update", id, updates);

      return {
        success: true,
        data: updatedTodo,
        isOptimistic: true,
        operationId,
      };
    }
  }

  /**
   * TODO 삭제
   */
  async deleteTodo(id: string): Promise<StorageOperationResult<void>> {
    // 기존 TODO 백업 (롤백용)
    const existingTodo = offlineStorage.getTodos().find((t) => t.id === id);
    if (!existingTodo) {
      return {
        success: false,
        error: "Todo not found",
      };
    }

    // 낙관적 업데이트 (즉시 삭제)
    if (this.config.enableOptimisticUpdates) {
      offlineStorage.deleteTodo(id);
      this.cache.clear();
    }

    if (this.canUseAPI()) {
      try {
        // API 호출
        await todoApiService.delete(id);

        return {
          success: true,
          isOptimistic: false,
        };
      } catch {
        // API 실패시 복원 및 대기 큐에 추가
        if (this.config.enableOptimisticUpdates) {
          offlineStorage.addTodo(existingTodo); // 롤백
        }

        const operationId = crypto.randomUUID();
        syncManager.queueOperation("delete", id);

        return {
          success: false,
          operationId,
          error: "Failed to delete, queued for retry",
        };
      }
    } else {
      // 오프라인: 대기 큐에 추가
      const operationId = crypto.randomUUID();
      syncManager.queueOperation("delete", id);

      return {
        success: true,
        isOptimistic: true,
        operationId,
      };
    }
  }

  /**
   * TODO 완료 상태 토글
   */
  async toggleTodo(id: string): Promise<StorageOperationResult<Todo>> {
    const existingTodo = offlineStorage.getTodos().find((t) => t.id === id);
    if (!existingTodo) {
      return {
        success: false,
        error: "Todo not found",
      };
    }

    return this.updateTodo(id, { completed: !existingTodo.completed });
  }

  // ================================
  // 동기화 관련 메서드
  // ================================

  /**
   * 수동 동기화 트리거
   */
  async syncData(): Promise<StorageOperationResult<void>> {
    try {
      const result = await syncManager.triggerSync();

      if (result.success) {
        this.cache.clear(); // 캐시 무효화
        return {
          success: true,
        };
      } else {
        return {
          success: false,
          error: result.message,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Sync failed",
      };
    }
  }

  /**
   * 대기 중인 작업 상태 확인
   */
  getPendingOperations(): PendingOperation[] {
    return offlineStorage.getPendingOperations();
  }

  /**
   * 동기화 상태 확인
   */
  getSyncStatus() {
    return syncManager.getSyncStatus();
  }

  // ================================
  // 데이터 마이그레이션 지원
  // ================================

  /**
   * 게스트 데이터를 인증된 사용자 계정으로 마이그레이션
   */
  async migrateGuestData(
    targetUserId: string,
  ): Promise<StorageOperationResult<number>> {
    try {
      const guestTodos = offlineStorage
        .getTodos()
        .filter((todo) => todo.userId === "guest");
      let migratedCount = 0;

      if (this.canUseAPI()) {
        // 각 게스트 TODO를 새 사용자 계정으로 마이그레이션
        for (const guestTodo of guestTodos) {
          try {
            await this.createTodo({
              title: guestTodo.title,
              description: guestTodo.description,
              priority: guestTodo.priority,
              dueDate: guestTodo.dueDate,
              tags: guestTodo.tags,
              userId: targetUserId,
            });

            // 원본 게스트 TODO 삭제
            offlineStorage.deleteTodo(guestTodo.id);
            migratedCount++;
          } catch (error) {
            console.error(`Failed to migrate todo ${guestTodo.id}:`, error);
          }
        }
      } else {
        // 오프라인: userId만 업데이트하고 나중에 동기화
        for (const guestTodo of guestTodos) {
          const migratedTodo = { ...guestTodo, userId: targetUserId };
          offlineStorage.updateTodo(guestTodo.id, migratedTodo);
          migratedCount++;
        }
      }

      return {
        success: true,
        data: migratedCount,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Migration failed",
      };
    }
  }

  // ================================
  // 유틸리티 메서드
  // ================================

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 로컬 데이터 초기화 (주의: 모든 로컬 데이터 삭제)
   */
  clearLocalData(): void {
    offlineStorage.clearAll();
    this.cache.clear();
  }

  /**
   * 서비스 상태 정보
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      canUseAPI: this.canUseAPI(),
      config: this.config,
      cacheSize: this.cache.size,
      pendingOperations: this.getPendingOperations().length,
      syncStatus: this.getSyncStatus(),
    };
  }
}

/**
 * 통합 스토리지 서비스 인스턴스
 */
export const integratedStorage = new IntegratedStorageService();

/**
 * 스토리지 유틸리티 함수들
 */
export const storageUtils = {
  /**
   * 작업 결과가 성공인지 확인
   */
  isSuccess<T>(
    result: StorageOperationResult<T>,
  ): result is StorageOperationResult<T> & { success: true; data: T } {
    return result.success && result.data !== undefined;
  },

  /**
   * 낙관적 업데이트인지 확인
   */
  isOptimistic<T>(result: StorageOperationResult<T>): boolean {
    return result.isOptimistic === true;
  },

  /**
   * 에러 메시지 추출
   */
  getErrorMessage<T>(result: StorageOperationResult<T>): string {
    return result.error || "Unknown error occurred";
  },

  /**
   * 안전한 데이터 접근
   */
  getData<T>(result: StorageOperationResult<T>): T | null {
    return result.data || null;
  },
};
