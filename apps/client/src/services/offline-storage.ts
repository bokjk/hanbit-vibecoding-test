/**
 * 오프라인 스토리지 서비스
 *
 * 오프라인 상황에서 사용자의 작업 내역을 로컬에 저장하고,
 * 온라인 복구 시 동기화할 수 있도록 관리하는 서비스
 */

import type { Todo } from "@vive/types";
import type { PendingOperation } from "../contexts/todo.reducer";

/**
 * 오프라인 저장소 키 상수들
 */
const STORAGE_KEYS = {
  OFFLINE_TODOS: "hanbit_todos_offline",
  PENDING_OPERATIONS: "hanbit_pending_operations",
  SYNC_METADATA: "hanbit_sync_metadata",
  USER_PREFERENCES: "hanbit_user_preferences",
} as const;

/**
 * 동기화 메타데이터
 */
export interface SyncMetadata {
  lastSyncAt: string | null;
  userId: string | null;
  totalOperations: number;
  failedSyncs: number;
  lastFailedAt: string | null;
  deviceId: string;
  version: string;
}

/**
 * 사용자 설정
 */
export interface UserPreferences {
  autoSync: boolean;
  offlineMode: boolean;
  maxRetries: number;
  batchSize: number;
}

/**
 * 저장소 통계
 */
export interface StorageStats {
  totalTodos: number;
  pendingOperations: number;
  storageUsed: number; // KB 단위
  lastModified: string | null;
  isHealthy: boolean;
}

/**
 * 오프라인 스토리지 서비스 클래스
 */
class OfflineStorageService {
  private deviceId: string;
  private version = "1.0.0";

  constructor() {
    this.deviceId = this.generateDeviceId();
    this.initializeStorage();
  }

  // ================================
  // 초기화 및 설정
  // ================================

  /**
   * 저장소 초기화
   */
  private initializeStorage(): void {
    // 기본 설정 초기화
    if (!this.getItem(STORAGE_KEYS.USER_PREFERENCES)) {
      const defaultPreferences: UserPreferences = {
        autoSync: true,
        offlineMode: false,
        maxRetries: 3,
        batchSize: 10,
      };
      this.saveUserPreferences(defaultPreferences);
    }

    // 메타데이터 초기화
    if (!this.getItem(STORAGE_KEYS.SYNC_METADATA)) {
      const defaultMetadata: SyncMetadata = {
        lastSyncAt: null,
        userId: null,
        totalOperations: 0,
        failedSyncs: 0,
        lastFailedAt: null,
        deviceId: this.deviceId,
        version: this.version,
      };
      this.saveSyncMetadata(defaultMetadata);
    }

    // 빈 배열 초기화
    if (!this.getItem(STORAGE_KEYS.OFFLINE_TODOS)) {
      this.setItem(STORAGE_KEYS.OFFLINE_TODOS, []);
    }
    if (!this.getItem(STORAGE_KEYS.PENDING_OPERATIONS)) {
      this.setItem(STORAGE_KEYS.PENDING_OPERATIONS, []);
    }
  }

  /**
   * 디바이스 ID 생성
   */
  private generateDeviceId(): string {
    const stored = localStorage.getItem("hanbit_device_id");
    if (stored) {
      return stored;
    }

    const newId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("hanbit_device_id", newId);
    return newId;
  }

  // ================================
  // 기본 저장소 유틸리티
  // ================================

  /**
   * 안전한 localStorage 접근
   */
  private getItem<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error(`Failed to get item from localStorage: ${key}`, error);
      return null;
    }
  }

  /**
   * 안전한 localStorage 저장
   */
  private setItem<T>(key: string, value: T): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Failed to save item to localStorage: ${key}`, error);

      // 저장소 용량 초과 시 자동 정리 시도
      if (error instanceof Error && error.name === "QuotaExceededError") {
        this.cleanupOldData();
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  /**
   * 오래된 데이터 정리
   */
  private cleanupOldData(): void {
    try {
      const metadata = this.getSyncMetadata();
      if (metadata && metadata.failedSyncs > 10) {
        // 실패한 동기화 기록 정리
        this.saveSyncMetadata({
          ...metadata,
          failedSyncs: 0,
          lastFailedAt: null,
        });
      }

      // 30일 이상 된 대기 작업 정리
      const operations = this.getPendingOperations();
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const cleanedOperations = operations.filter(
        (op) => op.timestamp.getTime() > thirtyDaysAgo,
      );

      if (cleanedOperations.length !== operations.length) {
        this.savePendingOperations(cleanedOperations);
      }
    } catch (error) {
      console.error("Failed to cleanup old data:", error);
    }
  }

  // ================================
  // TODO 관리
  // ================================

  /**
   * 오프라인 TODO 목록 조회
   */
  getTodos(): Todo[] {
    return this.getItem<Todo[]>(STORAGE_KEYS.OFFLINE_TODOS) || [];
  }

  /**
   * 오프라인 TODO 목록 저장
   */
  saveTodos(todos: Todo[]): boolean {
    return this.setItem(STORAGE_KEYS.OFFLINE_TODOS, todos);
  }

  /**
   * 특정 TODO 조회
   */
  getTodoById(id: string): Todo | null {
    const todos = this.getTodos();
    return todos.find((todo) => todo.id === id) || null;
  }

  /**
   * TODO 추가 (오프라인)
   */
  addTodo(todo: Todo): boolean {
    const todos = this.getTodos();
    const updatedTodos = [...todos, todo];
    return this.saveTodos(updatedTodos);
  }

  /**
   * TODO 업데이트 (오프라인)
   */
  updateTodo(id: string, updates: Partial<Todo>): boolean {
    const todos = this.getTodos();
    const todoIndex = todos.findIndex((todo) => todo.id === id);

    if (todoIndex === -1) {
      return false;
    }

    const updatedTodos = [...todos];
    updatedTodos[todoIndex] = {
      ...updatedTodos[todoIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return this.saveTodos(updatedTodos);
  }

  /**
   * TODO 삭제 (오프라인)
   */
  deleteTodo(id: string): boolean {
    const todos = this.getTodos();
    const filteredTodos = todos.filter((todo) => todo.id !== id);
    return this.saveTodos(filteredTodos);
  }

  // ================================
  // 대기 중인 작업 관리
  // ================================

  /**
   * 대기 중인 작업 목록 조회
   */
  getPendingOperations(): PendingOperation[] {
    return (
      this.getItem<PendingOperation[]>(STORAGE_KEYS.PENDING_OPERATIONS) || []
    );
  }

  /**
   * 대기 중인 작업 목록 저장
   */
  savePendingOperations(operations: PendingOperation[]): boolean {
    return this.setItem(STORAGE_KEYS.PENDING_OPERATIONS, operations);
  }

  /**
   * 대기 중인 작업 추가
   */
  addPendingOperation(
    operation: Omit<PendingOperation, "id" | "timestamp" | "retryCount">,
  ): boolean {
    const operations = this.getPendingOperations();
    const newOperation: PendingOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      retryCount: 0,
    };

    const updatedOperations = [...operations, newOperation];
    return this.savePendingOperations(updatedOperations);
  }

  /**
   * 대기 중인 작업 제거
   */
  removePendingOperation(id: string): boolean {
    const operations = this.getPendingOperations();
    const filteredOperations = operations.filter((op) => op.id !== id);
    return this.savePendingOperations(filteredOperations);
  }

  /**
   * 대기 중인 작업 재시도 횟수 업데이트
   */
  incrementOperationRetry(id: string): boolean {
    const operations = this.getPendingOperations();
    const operationIndex = operations.findIndex((op) => op.id === id);

    if (operationIndex === -1) {
      return false;
    }

    const updatedOperations = [...operations];
    updatedOperations[operationIndex] = {
      ...updatedOperations[operationIndex],
      retryCount: updatedOperations[operationIndex].retryCount + 1,
    };

    return this.savePendingOperations(updatedOperations);
  }

  /**
   * 실패한 작업들 정리 (최대 재시도 횟수 초과)
   */
  cleanupFailedOperations(maxRetries = 3): PendingOperation[] {
    const operations = this.getPendingOperations();
    const failedOperations = operations.filter(
      (op) => op.retryCount >= maxRetries,
    );
    const validOperations = operations.filter(
      (op) => op.retryCount < maxRetries,
    );

    this.savePendingOperations(validOperations);

    return failedOperations;
  }

  // ================================
  // 동기화 메타데이터 관리
  // ================================

  /**
   * 동기화 메타데이터 조회
   */
  getSyncMetadata(): SyncMetadata | null {
    return this.getItem<SyncMetadata>(STORAGE_KEYS.SYNC_METADATA);
  }

  /**
   * 동기화 메타데이터 저장
   */
  saveSyncMetadata(metadata: SyncMetadata): boolean {
    return this.setItem(STORAGE_KEYS.SYNC_METADATA, metadata);
  }

  /**
   * 마지막 동기화 시간 업데이트
   */
  updateLastSyncTime(userId: string): boolean {
    const metadata = this.getSyncMetadata();
    if (!metadata) {
      return false;
    }

    const updatedMetadata: SyncMetadata = {
      ...metadata,
      lastSyncAt: new Date().toISOString(),
      userId,
      totalOperations: metadata.totalOperations + 1,
    };

    return this.saveSyncMetadata(updatedMetadata);
  }

  /**
   * 동기화 실패 기록
   */
  recordSyncFailure(): boolean {
    const metadata = this.getSyncMetadata();
    if (!metadata) {
      return false;
    }

    const updatedMetadata: SyncMetadata = {
      ...metadata,
      failedSyncs: metadata.failedSyncs + 1,
      lastFailedAt: new Date().toISOString(),
    };

    return this.saveSyncMetadata(updatedMetadata);
  }

  // ================================
  // 사용자 설정 관리
  // ================================

  /**
   * 사용자 설정 조회
   */
  getUserPreferences(): UserPreferences | null {
    return this.getItem<UserPreferences>(STORAGE_KEYS.USER_PREFERENCES);
  }

  /**
   * 사용자 설정 저장
   */
  saveUserPreferences(preferences: UserPreferences): boolean {
    return this.setItem(STORAGE_KEYS.USER_PREFERENCES, preferences);
  }

  // ================================
  // 통계 및 진단
  // ================================

  /**
   * 저장소 통계 조회
   */
  getStorageStats(): StorageStats {
    const todos = this.getTodos();
    const operations = this.getPendingOperations();
    const metadata = this.getSyncMetadata();

    // 대략적인 저장소 사용량 계산
    let storageUsed = 0;
    try {
      const allData = {
        todos,
        operations,
        metadata,
        preferences: this.getUserPreferences(),
      };
      storageUsed = Math.round(JSON.stringify(allData).length / 1024); // KB
    } catch {
      storageUsed = 0;
    }

    return {
      totalTodos: todos.length,
      pendingOperations: operations.length,
      storageUsed,
      lastModified: metadata?.lastSyncAt || null,
      isHealthy: operations.length < 100 && (metadata?.failedSyncs || 0) < 5,
    };
  }

  /**
   * 저장소 상태 검사
   */
  performHealthCheck(): {
    isHealthy: boolean;
    issues: string[];
    stats: StorageStats;
  } {
    const stats = this.getStorageStats();
    const issues: string[] = [];

    // 대기 중인 작업이 너무 많은 경우
    if (stats.pendingOperations > 50) {
      issues.push(`대기 중인 작업이 많습니다 (${stats.pendingOperations}개)`);
    }

    // 저장소 사용량이 많은 경우
    if (stats.storageUsed > 1024) {
      // 1MB 이상
      issues.push(`저장소 사용량이 많습니다 (${stats.storageUsed}KB)`);
    }

    // 동기화 실패가 많은 경우
    const metadata = this.getSyncMetadata();
    if (metadata && metadata.failedSyncs > 5) {
      issues.push(`동기화 실패가 많습니다 (${metadata.failedSyncs}번)`);
    }

    // 오래된 데이터가 있는 경우
    if (metadata?.lastSyncAt) {
      const lastSync = new Date(metadata.lastSyncAt).getTime();
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      if (lastSync < oneDayAgo) {
        issues.push("마지막 동기화가 오래되었습니다");
      }
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      stats,
    };
  }

  // ================================
  // 데이터 관리
  // ================================

  /**
   * 모든 오프라인 데이터 초기화
   */
  clearAllData(): boolean {
    try {
      localStorage.removeItem(STORAGE_KEYS.OFFLINE_TODOS);
      localStorage.removeItem(STORAGE_KEYS.PENDING_OPERATIONS);
      localStorage.removeItem(STORAGE_KEYS.SYNC_METADATA);
      localStorage.removeItem(STORAGE_KEYS.USER_PREFERENCES);

      // 재초기화
      this.initializeStorage();

      return true;
    } catch (error) {
      console.error("Failed to clear all data:", error);
      return false;
    }
  }

  /**
   * 특정 사용자 데이터만 초기화
   */
  clearUserData(): boolean {
    try {
      // TODO와 대기 작업은 초기화
      this.setItem(STORAGE_KEYS.OFFLINE_TODOS, []);
      this.setItem(STORAGE_KEYS.PENDING_OPERATIONS, []);

      // 메타데이터는 사용자 정보만 초기화
      const metadata = this.getSyncMetadata();
      if (metadata) {
        const updatedMetadata: SyncMetadata = {
          ...metadata,
          userId: null,
          lastSyncAt: null,
          totalOperations: 0,
          failedSyncs: 0,
          lastFailedAt: null,
        };
        this.saveSyncMetadata(updatedMetadata);
      }

      return true;
    } catch (error) {
      console.error("Failed to clear user data:", error);
      return false;
    }
  }

  /**
   * 데이터 내보내기 (백업용)
   */
  exportData(): {
    todos: Todo[];
    pendingOperations: PendingOperation[];
    metadata: SyncMetadata | null;
    preferences: UserPreferences | null;
    exportedAt: string;
  } {
    return {
      todos: this.getTodos(),
      pendingOperations: this.getPendingOperations(),
      metadata: this.getSyncMetadata(),
      preferences: this.getUserPreferences(),
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * 데이터 가져오기 (복원용)
   */
  importData(data: {
    todos: Todo[];
    pendingOperations: PendingOperation[];
    metadata: SyncMetadata;
    preferences: UserPreferences;
  }): boolean {
    try {
      this.saveTodos(data.todos);
      this.savePendingOperations(data.pendingOperations);
      this.saveSyncMetadata(data.metadata);
      this.saveUserPreferences(data.preferences);
      return true;
    } catch (error) {
      console.error("Failed to import data:", error);
      return false;
    }
  }
}

/**
 * 오프라인 스토리지 서비스 인스턴스
 */
export const offlineStorage = new OfflineStorageService();

/**
 * 편의 함수들
 */
export const offlineStorageUtils = {
  /**
   * 저장소 공간 확인
   */
  checkStorageAvailability(): boolean {
    try {
      const testKey = "__storage_test__";
      const testValue = "test";
      localStorage.setItem(testKey, testValue);
      const retrieved = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      return retrieved === testValue;
    } catch {
      return false;
    }
  },

  /**
   * 저장소 사용량 추정
   */
  getStorageUsage(): number {
    let totalSize = 0;
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
        const value = localStorage[key];
        totalSize += key.length + (value?.length || 0);
      }
    }
    return Math.round(totalSize / 1024); // KB 단위
  },

  /**
   * 브라우저 지원 여부 확인
   */
  isSupported(): boolean {
    try {
      return (
        typeof Storage !== "undefined" &&
        typeof localStorage !== "undefined" &&
        localStorage !== null
      );
    } catch {
      return false;
    }
  },
};
