/**
 * 동기화 관리자
 *
 * 로컬 오프라인 데이터와 원격 서버 간의 동기화를 관리하는 핵심 서비스
 * - 온라인/오프라인 상태 감지
 * - 대기 중인 작업 처리
 * - 충돌 해결
 * - 재시도 로직
 */

import type { Todo } from "types/index";
import type {
  PendingOperation,
  ConnectionStatus,
} from "../contexts/todo.reducer";
import { offlineStorage } from "./offline-storage";
import { todoApiService } from "./api/todo-api-client";

/**
 * 동기화 결과
 */
export interface SyncResult {
  success: boolean;
  message: string;
  syncedOperations: number;
  failedOperations: number;
  conflicts: TodoConflict[];
  lastSyncAt: Date;
}

/**
 * TODO 충돌 정보
 */
export interface TodoConflict {
  todoId: string;
  localTodo: Todo;
  remoteTodo: Todo;
  conflictType: "update" | "delete" | "create";
  timestamp: Date;
}

/**
 * 동기화 설정
 */
export interface SyncConfig {
  autoSync: boolean;
  batchSize: number;
  retryAttempts: number;
  retryDelay: number; // ms
  conflictResolution: "local" | "remote" | "manual";
  offlineTimeout: number; // ms
}

/**
 * 동기화 이벤트 타입
 */
export type SyncEvent =
  | "sync_start"
  | "sync_success"
  | "sync_error"
  | "sync_conflict"
  | "connection_change"
  | "operation_queued"
  | "operation_processed";

/**
 * 동기화 이벤트 리스너
 */
export type SyncEventListener = (event: SyncEvent, data?: unknown) => void;

/**
 * 동기화 관리자 클래스
 */
class SyncManagerService {
  private config: SyncConfig;
  private isOnline: boolean;
  private isSyncing: boolean;
  private syncInterval: NodeJS.Timeout | null;
  private eventListeners: Map<SyncEvent, Set<SyncEventListener>>;
  private retryTimeouts: Map<string, NodeJS.Timeout>;

  constructor(config?: Partial<SyncConfig>) {
    this.config = {
      autoSync: true,
      batchSize: 10,
      retryAttempts: 3,
      retryDelay: 1000,
      conflictResolution: "manual",
      offlineTimeout: 5000,
      ...config,
    };

    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    this.syncInterval = null;
    this.eventListeners = new Map();
    this.retryTimeouts = new Map();

    this.initializeSync();
  }

  // ================================
  // 초기화
  // ================================

  /**
   * 동기화 매니저 초기화
   */
  private initializeSync(): void {
    // 네트워크 상태 이벤트 리스너 등록
    window.addEventListener("online", this.handleOnlineStatusChange.bind(this));
    window.addEventListener(
      "offline",
      this.handleOnlineStatusChange.bind(this),
    );

    // 페이지 언로드 시 정리
    window.addEventListener("beforeunload", this.cleanup.bind(this));

    // 자동 동기화가 활성화된 경우 주기적 동기화 시작
    if (this.config.autoSync) {
      this.startPeriodicSync();
    }

    // 온라인 상태에서 즉시 동기화 시도
    if (this.isOnline) {
      setTimeout(() => this.performSync(), 1000);
    }
  }

  /**
   * 주기적 동기화 시작 (30초마다)
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (this.isOnline && !this.isSyncing) {
        await this.performSync();
      }
    }, 30000); // 30초마다
  }

  /**
   * 리소스 정리
   */
  private cleanup(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // 모든 재시도 타임아웃 정리
    this.retryTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.retryTimeouts.clear();

    // 이벤트 리스너 정리
    window.removeEventListener(
      "online",
      this.handleOnlineStatusChange.bind(this),
    );
    window.removeEventListener(
      "offline",
      this.handleOnlineStatusChange.bind(this),
    );
  }

  // ================================
  // 네트워크 상태 관리
  // ================================

  /**
   * 온라인 상태 변경 처리
   */
  private async handleOnlineStatusChange(): Promise<void> {
    const wasOnline = this.isOnline;
    this.isOnline = navigator.onLine;

    this.emitEvent("connection_change", {
      isOnline: this.isOnline,
      wasOnline,
    });

    if (!wasOnline && this.isOnline) {
      // 오프라인에서 온라인으로 전환 시 즉시 동기화
      console.log("🌐 Connection restored - starting sync...");
      setTimeout(() => this.performSync(), 500);
    } else if (wasOnline && !this.isOnline) {
      // 온라인에서 오프라인으로 전환
      console.log("🌐 Connection lost - entering offline mode");
    }
  }

  /**
   * 연결 상태 확인 (실제 서버 접근 테스트)
   */
  private async checkConnectivity(): Promise<boolean> {
    if (!navigator.onLine) {
      return false;
    }

    try {
      // API 서버에 실제 연결 테스트
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.offlineTimeout,
      );

      await fetch("/api/health", {
        method: "HEAD",
        signal: controller.signal,
        cache: "no-cache",
      });

      clearTimeout(timeoutId);
      return true;
    } catch (error) {
      console.warn("Connectivity check failed:", error);
      return false;
    }
  }

  // ================================
  // 이벤트 관리
  // ================================

  /**
   * 이벤트 리스너 추가
   */
  addEventListener(event: SyncEvent, listener: SyncEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * 이벤트 리스너 제거
   */
  removeEventListener(event: SyncEvent, listener: SyncEventListener): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * 이벤트 발생
   */
  private emitEvent(event: SyncEvent, data?: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(event, data);
        } catch (error) {
          console.error(`Sync event listener error for ${event}:`, error);
        }
      });
    }
  }

  // ================================
  // 동기화 핵심 로직
  // ================================

  /**
   * 메인 동기화 수행
   */
  async performSync(): Promise<SyncResult> {
    if (this.isSyncing) {
      console.warn("Sync already in progress, skipping...");
      return {
        success: false,
        message: "Sync already in progress",
        syncedOperations: 0,
        failedOperations: 0,
        conflicts: [],
        lastSyncAt: new Date(),
      };
    }

    this.isSyncing = true;
    this.emitEvent("sync_start");

    const syncResult: SyncResult = {
      success: false,
      message: "",
      syncedOperations: 0,
      failedOperations: 0,
      conflicts: [],
      lastSyncAt: new Date(),
    };

    try {
      // 1. 연결 상태 확인
      const isConnected = await this.checkConnectivity();
      if (!isConnected) {
        throw new Error("No internet connection available");
      }

      // 2. 서버에서 최신 데이터 가져오기
      const remoteTodos = await this.fetchRemoteTodos();

      // 3. 대기 중인 작업들 처리
      const operationResults = await this.processPendingOperations();
      syncResult.syncedOperations = operationResults.success;
      syncResult.failedOperations = operationResults.failed;

      // 4. 로컬 데이터와 원격 데이터 병합
      const mergeResult = await this.mergeData(remoteTodos);
      syncResult.conflicts = mergeResult.conflicts;

      // 5. 메타데이터 업데이트
      await this.updateSyncMetadata();

      syncResult.success = true;
      syncResult.message = `Successfully synced ${syncResult.syncedOperations} operations`;

      this.emitEvent("sync_success", syncResult);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown sync error";
      syncResult.success = false;
      syncResult.message = errorMessage;

      // 실패 기록
      offlineStorage.recordSyncFailure();

      this.emitEvent("sync_error", { error: errorMessage, syncResult });
      console.error("Sync failed:", error);
    } finally {
      this.isSyncing = false;
      syncResult.lastSyncAt = new Date();
    }

    return syncResult;
  }

  /**
   * 원격 서버에서 TODO 데이터 가져오기
   */
  private async fetchRemoteTodos(): Promise<Todo[]> {
    try {
      const response = await todoApiService.getAll();
      return response.data.todos || [];
    } catch (error) {
      console.error("Failed to fetch remote todos:", error);
      throw new Error("Failed to fetch remote data");
    }
  }

  /**
   * 대기 중인 작업들 처리
   */
  private async processPendingOperations(): Promise<{
    success: number;
    failed: number;
  }> {
    const operations = offlineStorage.getPendingOperations();
    let successCount = 0;
    let failedCount = 0;

    // 배치 단위로 처리
    const batches = this.createBatches(operations, this.config.batchSize);

    for (const batch of batches) {
      for (const operation of batch) {
        try {
          await this.processOperation(operation);
          offlineStorage.removePendingOperation(operation.id);
          successCount++;

          this.emitEvent("operation_processed", { operation, success: true });
        } catch (error) {
          failedCount++;

          // 재시도 횟수 증가
          offlineStorage.incrementOperationRetry(operation.id);

          // 최대 재시도 횟수 초과시 제거
          if (operation.retryCount >= this.config.retryAttempts) {
            offlineStorage.removePendingOperation(operation.id);
            console.error(
              `Operation ${operation.id} failed after ${this.config.retryAttempts} attempts`,
            );
          }

          this.emitEvent("operation_processed", {
            operation,
            success: false,
            error,
          });
        }
      }
    }

    return { success: successCount, failed: failedCount };
  }

  /**
   * 개별 작업 처리
   */
  private async processOperation(operation: PendingOperation): Promise<void> {
    switch (operation.type) {
      case "create":
        await this.processCreateOperation(operation);
        break;
      case "update":
        await this.processUpdateOperation(operation);
        break;
      case "delete":
        await this.processDeleteOperation(operation);
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * TODO 생성 작업 처리
   */
  private async processCreateOperation(
    operation: PendingOperation,
  ): Promise<void> {
    if (!operation.data || typeof operation.data !== "object") {
      throw new Error("Invalid create operation data");
    }

    const todoData = operation.data as Omit<
      Todo,
      "id" | "createdAt" | "updatedAt"
    >;
    await todoApiService.create({
      title: todoData.title,
      completed: todoData.completed || false,
      description: todoData.description,
      priority: todoData.priority,
      dueDate: todoData.dueDate,
      tags: todoData.tags,
      userId: todoData.userId,
    });
  }

  /**
   * TODO 업데이트 작업 처리
   */
  private async processUpdateOperation(
    operation: PendingOperation,
  ): Promise<void> {
    if (!operation.data || typeof operation.data !== "object") {
      throw new Error("Invalid update operation data");
    }

    const updateData = operation.data as Partial<Todo>;
    await todoApiService.update(operation.todoId, updateData);
  }

  /**
   * TODO 삭제 작업 처리
   */
  private async processDeleteOperation(
    operation: PendingOperation,
  ): Promise<void> {
    await todoApiService.delete(operation.todoId);
  }

  /**
   * 로컬과 원격 데이터 병합
   */
  private async mergeData(
    remoteTodos: Todo[],
  ): Promise<{ conflicts: TodoConflict[] }> {
    const localTodos = offlineStorage.getTodos();
    const conflicts: TodoConflict[] = [];

    // 원격 데이터를 기준으로 로컬 데이터 업데이트
    for (const remoteTodo of remoteTodos) {
      const localTodo = localTodos.find((t) => t.id === remoteTodo.id);

      if (!localTodo) {
        // 새로운 TODO - 로컬에 추가
        offlineStorage.addTodo(remoteTodo);
        continue;
      }

      // 수정 시간 비교로 충돌 감지
      const localModified = new Date(localTodo.updatedAt).getTime();
      const remoteModified = new Date(remoteTodo.updatedAt).getTime();

      if (localModified > remoteModified) {
        // 로컬이 더 최신 - 충돌 발생
        conflicts.push({
          todoId: remoteTodo.id,
          localTodo,
          remoteTodo,
          conflictType: "update",
          timestamp: new Date(),
        });
      } else if (remoteModified > localModified) {
        // 원격이 더 최신 - 로컬 업데이트
        offlineStorage.updateTodo(remoteTodo.id, remoteTodo);
      }
    }

    // 로컬에만 있고 원격에 없는 TODO 확인 (삭제된 것들)
    for (const localTodo of localTodos) {
      const remoteTodo = remoteTodos.find((t) => t.id === localTodo.id);
      if (!remoteTodo) {
        // 원격에서 삭제된 TODO - 충돌로 처리
        conflicts.push({
          todoId: localTodo.id,
          localTodo,
          remoteTodo: {} as Todo, // 삭제된 경우 빈 객체
          conflictType: "delete",
          timestamp: new Date(),
        });
      }
    }

    // 충돌 발생 시 이벤트 발생
    if (conflicts.length > 0) {
      this.emitEvent("sync_conflict", { conflicts });
    }

    return { conflicts };
  }

  /**
   * 동기화 메타데이터 업데이트
   */
  private async updateSyncMetadata(): Promise<void> {
    const metadata = offlineStorage.getSyncMetadata();
    if (metadata) {
      // TODO: 실제 사용자 ID를 가져와야 함
      offlineStorage.updateLastSyncTime("current-user");
    }
  }

  // ================================
  // 공개 API 메서드
  // ================================

  /**
   * 수동 동기화 트리거
   */
  async triggerSync(): Promise<SyncResult> {
    return await this.performSync();
  }

  /**
   * 대기 중인 작업 추가
   */
  queueOperation(
    type: PendingOperation["type"],
    todoId: string,
    data?: unknown,
  ): boolean {
    const success = offlineStorage.addPendingOperation({
      type,
      todoId,
      data,
    });

    if (success) {
      this.emitEvent("operation_queued", { type, todoId, data });

      // 온라인 상태라면 즉시 동기화 시도
      if (this.isOnline && !this.isSyncing) {
        setTimeout(() => this.performSync(), 1000);
      }
    }

    return success;
  }

  /**
   * 충돌 해결
   */
  async resolveConflict(
    todoId: string,
    resolution: "local" | "remote",
    conflictData: TodoConflict,
  ): Promise<boolean> {
    try {
      if (resolution === "local") {
        // 로컬 버전을 서버에 업데이트
        await todoApiService.update(todoId, conflictData.localTodo);
        return true;
      } else {
        // 원격 버전을 로컬에 적용
        if (conflictData.conflictType === "delete") {
          offlineStorage.deleteTodo(todoId);
        } else {
          offlineStorage.updateTodo(todoId, conflictData.remoteTodo);
        }
        return true;
      }
    } catch (error) {
      console.error("Failed to resolve conflict:", error);
      return false;
    }
  }

  /**
   * 자동 동기화 설정 변경
   */
  setAutoSync(enabled: boolean): void {
    this.config.autoSync = enabled;

    if (enabled) {
      this.startPeriodicSync();
    } else if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * 동기화 설정 업데이트
   */
  updateConfig(newConfig: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // 자동 동기화 설정이 변경된 경우 재시작
    if ("autoSync" in newConfig) {
      this.setAutoSync(this.config.autoSync);
    }
  }

  // ================================
  // 상태 조회
  // ================================

  /**
   * 현재 동기화 상태 조회
   */
  getSyncStatus(): {
    isOnline: boolean;
    isSyncing: boolean;
    pendingOperations: number;
    lastSyncAt: string | null;
    config: SyncConfig;
  } {
    const metadata = offlineStorage.getSyncMetadata();
    const pendingOperations = offlineStorage.getPendingOperations();

    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingOperations: pendingOperations.length,
      lastSyncAt: metadata?.lastSyncAt || null,
      config: this.config,
    };
  }

  /**
   * 연결 상태 조회
   */
  getConnectionStatus(): ConnectionStatus {
    if (!navigator.onLine) return "offline";
    return this.isOnline ? "online" : "unknown";
  }

  // ================================
  // 유틸리티
  // ================================

  /**
   * 배열을 배치 단위로 분할
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}

/**
 * 동기화 관리자 인스턴스
 */
export const syncManager = new SyncManagerService();

/**
 * 동기화 유틸리티 함수들
 */
export const syncUtils = {
  /**
   * 충돌 해결 전략 제안
   */
  suggestConflictResolution(conflict: TodoConflict): "local" | "remote" {
    // 간단한 휴리스틱: 더 최신 것을 선택
    const localTime = new Date(conflict.localTodo.updatedAt).getTime();
    const remoteTime = new Date(conflict.remoteTodo.updatedAt).getTime();

    return localTime > remoteTime ? "local" : "remote";
  },

  /**
   * 동기화 우선순위 계산
   */
  calculateSyncPriority(operation: PendingOperation): number {
    // 생성 > 업데이트 > 삭제 순서로 우선순위
    const priorityMap = { create: 3, update: 2, delete: 1 };
    const basePriority = priorityMap[operation.type] || 0;

    // 재시도 횟수가 많을수록 우선순위 증가
    return basePriority + operation.retryCount * 0.1;
  },

  /**
   * 동기화 통계 생성
   */
  generateSyncStats(operations: PendingOperation[]): {
    total: number;
    byType: Record<PendingOperation["type"], number>;
    avgRetries: number;
    oldestOperation: Date | null;
  } {
    if (operations.length === 0) {
      return {
        total: 0,
        byType: { create: 0, update: 0, delete: 0 },
        avgRetries: 0,
        oldestOperation: null,
      };
    }

    const byType = operations.reduce(
      (acc, op) => {
        acc[op.type] = (acc[op.type] || 0) + 1;
        return acc;
      },
      {} as Record<PendingOperation["type"], number>,
    );

    const totalRetries = operations.reduce((sum, op) => sum + op.retryCount, 0);
    const avgRetries = totalRetries / operations.length;

    const oldestTimestamp = Math.min(
      ...operations.map((op) => op.timestamp.getTime()),
    );
    const oldestOperation = new Date(oldestTimestamp);

    return {
      total: operations.length,
      byType: { create: 0, update: 0, delete: 0, ...byType },
      avgRetries,
      oldestOperation,
    };
  },
};
