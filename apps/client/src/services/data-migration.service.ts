/**
 * 데이터 마이그레이션 서비스
 *
 * localStorage 데이터를 클라우드 계정으로 마이그레이션하는 핵심 서비스
 * - localStorage → 게스트 토큰 계정 마이그레이션
 * - 게스트 → 정식 사용자 전환 시 데이터 보존
 * - 데이터 무결성 보장
 */

import type { Todo } from "types/index";
import type { AuthState } from "../types/auth.types";
import { localStorageService } from "./localStorage.service";
import { authService } from "./auth.service";
import { todoApiService } from "./api/todo-api-client";
// import { offlineStorage } from './offline-storage';
import { syncManager } from "./sync-manager";

/**
 * 마이그레이션 상태
 */
export interface MigrationState {
  isRequired: boolean;
  isInProgress: boolean;
  isComplete: boolean;
  totalItems: number;
  migratedItems: number;
  error: string | null;
  stage: MigrationStage;
}

/**
 * 마이그레이션 단계
 */
export type MigrationStage =
  | "checking" // 마이그레이션 필요성 확인
  | "preparing" // 게스트 토큰 획득 준비
  | "authenticating" // 게스트 토큰 획득
  | "migrating" // 데이터 마이그레이션 중
  | "syncing" // 서버와 동기화
  | "cleanup" // 로컬 데이터 정리
  | "complete" // 완료
  | "error"; // 오류 발생

/**
 * 마이그레이션 결과
 */
export interface MigrationResult {
  success: boolean;
  message: string;
  migratedCount: number;
  skippedCount: number;
  errorCount: number;
  duration: number; // ms
}

/**
 * 마이그레이션 옵션
 */
export interface MigrationOptions {
  preserveLocalData: boolean; // 로컬 데이터 보존 여부
  skipDuplicates: boolean; // 중복 데이터 스킵 여부
  batchSize: number; // 배치 처리 사이즈
  retryAttempts: number; // 재시도 횟수
  autoCleanup: boolean; // 자동 정리 여부
}

/**
 * 마이그레이션 이벤트 타입
 */
export type MigrationEvent =
  | "migration_start"
  | "migration_progress"
  | "migration_complete"
  | "migration_error"
  | "stage_change";

/**
 * 마이그레이션 이벤트 리스너
 */
export type MigrationEventListener = (
  event: MigrationEvent,
  data?: unknown,
) => void;

/**
 * 데이터 마이그레이션 서비스 클래스
 */
class DataMigrationService {
  private state: MigrationState;
  private options: MigrationOptions;
  private eventListeners: Map<MigrationEvent, Set<MigrationEventListener>>;
  private startTime: number = 0;

  constructor() {
    this.state = {
      isRequired: false,
      isInProgress: false,
      isComplete: false,
      totalItems: 0,
      migratedItems: 0,
      error: null,
      stage: "checking",
    };

    this.options = {
      preserveLocalData: true,
      skipDuplicates: true,
      batchSize: 5,
      retryAttempts: 3,
      autoCleanup: false,
    };

    this.eventListeners = new Map();
  }

  // ================================
  // 이벤트 관리
  // ================================

  /**
   * 이벤트 리스너 추가
   */
  addEventListener(
    event: MigrationEvent,
    listener: MigrationEventListener,
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * 이벤트 리스너 제거
   */
  removeEventListener(
    event: MigrationEvent,
    listener: MigrationEventListener,
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * 이벤트 발생
   */
  private emitEvent(event: MigrationEvent, data?: unknown): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(event, data);
        } catch (error) {
          console.error(`Migration event listener error for ${event}:`, error);
        }
      });
    }
  }

  // ================================
  // 상태 관리
  // ================================

  /**
   * 마이그레이션 상태 조회
   */
  getState(): MigrationState {
    return { ...this.state };
  }

  /**
   * 마이그레이션 옵션 업데이트
   */
  updateOptions(newOptions: Partial<MigrationOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * 상태 업데이트
   */
  private updateState(updates: Partial<MigrationState>): void {
    const prevStage = this.state.stage;
    this.state = { ...this.state, ...updates };

    if (updates.stage && updates.stage !== prevStage) {
      this.emitEvent("stage_change", {
        prevStage,
        newStage: updates.stage,
        state: this.state,
      });
    }

    if (updates.migratedItems !== undefined) {
      this.emitEvent("migration_progress", {
        progress:
          this.state.totalItems > 0
            ? this.state.migratedItems / this.state.totalItems
            : 0,
        migratedItems: this.state.migratedItems,
        totalItems: this.state.totalItems,
        stage: this.state.stage,
      });
    }
  }

  // ================================
  // 마이그레이션 필요성 확인
  // ================================

  /**
   * 마이그레이션 필요성 확인
   */
  async checkMigrationRequired(authState?: AuthState): Promise<boolean> {
    this.updateState({ stage: "checking" });

    try {
      // 1. 로컬 데이터 존재 확인
      const localTodos = localStorageService.getTodos();
      const hasLocalData = localTodos.length > 0;

      // 2. 인증 상태 확인
      const isAuthenticated = authState?.isAuthenticated || false;
      const isGuest = authState?.isGuest || false;
      const isInitialized = authState?.isInitialized || false;

      // 3. 마이그레이션 상태 확인
      const migrationCompleted =
        this.state.isComplete ||
        localStorage.getItem("migration:completed") === "true";

      // 로컬 데이터가 있고, 인증되지 않았거나 게스트이며, 마이그레이션이 완료되지 않은 경우
      const isRequired =
        hasLocalData &&
        (!isAuthenticated || isGuest) &&
        !migrationCompleted &&
        isInitialized;

      this.updateState({
        isRequired,
        totalItems: isRequired ? localTodos.length : 0,
      });

      console.log("🔄 Migration check:", {
        hasLocalData,
        isAuthenticated,
        isGuest,
        isInitialized,
        migrationCompleted,
        isRequired,
        totalItems: localTodos.length,
      });

      return isRequired;
    } catch (error) {
      console.error("Migration check failed:", error);
      this.updateState({
        error:
          error instanceof Error ? error.message : "Migration check failed",
        stage: "error",
      });
      return false;
    }
  }

  // ================================
  // 마이그레이션 실행
  // ================================

  /**
   * 마이그레이션 실행
   */
  async performMigration(): Promise<MigrationResult> {
    if (this.state.isInProgress) {
      throw new Error("Migration is already in progress");
    }

    this.startTime = Date.now();
    this.updateState({
      isInProgress: true,
      isComplete: false,
      migratedItems: 0,
      error: null,
      stage: "preparing",
    });

    this.emitEvent("migration_start", { state: this.state });

    let result: MigrationResult = {
      success: false,
      message: "",
      migratedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      duration: 0,
    };

    try {
      // 1. 게스트 토큰 획득
      await this.ensureGuestAuthentication();

      // 2. 로컬 데이터 마이그레이션
      const migrationStats = await this.migrateLocalData();

      // 3. 서버와 동기화
      await this.performSyncAfterMigration();

      // 4. 마이그레이션 완료 처리
      await this.completeMigration();

      result = {
        success: true,
        message: `Successfully migrated ${migrationStats.migrated} items`,
        migratedCount: migrationStats.migrated,
        skippedCount: migrationStats.skipped,
        errorCount: migrationStats.errors,
        duration: Date.now() - this.startTime,
      };

      this.updateState({
        isComplete: true,
        stage: "complete",
      });

      this.emitEvent("migration_complete", { result, state: this.state });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Migration failed";

      result = {
        success: false,
        message: errorMessage,
        migratedCount: this.state.migratedItems,
        skippedCount: 0,
        errorCount: this.state.totalItems - this.state.migratedItems,
        duration: Date.now() - this.startTime,
      };

      this.updateState({
        error: errorMessage,
        stage: "error",
      });

      this.emitEvent("migration_error", {
        error: errorMessage,
        result,
        state: this.state,
      });

      console.error("Migration failed:", error);
    } finally {
      this.updateState({ isInProgress: false });
    }

    return result;
  }

  /**
   * 게스트 인증 확인
   */
  private async ensureGuestAuthentication(): Promise<void> {
    this.updateState({ stage: "authenticating" });

    try {
      // AuthService를 통해 게스트 토큰이 있는지 확인
      if (!authService.isTokenValid()) {
        // 게스트 토큰 요청
        const guestResponse = await authService.requestGuestToken();
        console.log("🎫 Guest token obtained for migration:", guestResponse);
      }

      // 토큰 유효성 재확인
      if (!authService.isTokenValid()) {
        throw new Error("Failed to obtain valid guest token");
      }
    } catch (error) {
      throw new Error(
        `Authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * 로컬 데이터 마이그레이션
   */
  private async migrateLocalData(): Promise<{
    migrated: number;
    skipped: number;
    errors: number;
  }> {
    this.updateState({ stage: "migrating" });

    const localTodos = localStorageService.getTodos();
    let migrated = 0;
    let skipped = 0;
    let errors = 0;

    // 배치 단위로 처리
    const batches = this.createBatches(localTodos, this.options.batchSize);

    for (const batch of batches) {
      for (const todo of batch) {
        try {
          // 중복 확인 (옵션에 따라)
          if (
            this.options.skipDuplicates &&
            (await this.isDuplicateTodo(todo))
          ) {
            skipped++;
            this.updateState({ migratedItems: this.state.migratedItems + 1 });
            continue;
          }

          // API를 통해 서버에 생성
          await todoApiService.create({
            title: todo.title,
            description: todo.description,
            completed: todo.completed,
            priority: todo.priority,
            dueDate: todo.dueDate,
            tags: todo.tags,
          });

          migrated++;
          this.updateState({ migratedItems: this.state.migratedItems + 1 });

          console.log(`✅ Migrated todo: ${todo.title}`);

          // 배치 간 지연 (서버 부하 방지)
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          errors++;
          this.updateState({ migratedItems: this.state.migratedItems + 1 });

          console.error(`❌ Failed to migrate todo: ${todo.title}`, error);

          // 재시도 로직 (간단한 구현)
          if (this.options.retryAttempts > 0) {
            // TODO: 재시도 로직 구현
          }
        }
      }
    }

    return { migrated, skipped, errors };
  }

  /**
   * 동기화 수행
   */
  private async performSyncAfterMigration(): Promise<void> {
    this.updateState({ stage: "syncing" });

    try {
      // 동기화 매니저를 통한 서버 데이터와 로컬 데이터 동기화
      const syncResult = await syncManager.triggerSync();

      if (!syncResult.success) {
        console.warn("Post-migration sync failed:", syncResult.message);
        // 동기화 실패는 마이그레이션 실패로 처리하지 않음
      }
    } catch (error) {
      console.warn("Post-migration sync error:", error);
      // 동기화 에러는 마이그레이션 실패로 처리하지 않음
    }
  }

  /**
   * 마이그레이션 완료 처리
   */
  private async completeMigration(): Promise<void> {
    this.updateState({ stage: "cleanup" });

    try {
      // 마이그레이션 완료 플래그 설정
      localStorage.setItem("migration:completed", "true");
      localStorage.setItem("migration:timestamp", new Date().toISOString());

      // 로컬 데이터 정리 (옵션에 따라)
      if (this.options.autoCleanup && !this.options.preserveLocalData) {
        localStorageService.clearTodos();
        console.log("🧹 Local data cleaned up after successful migration");
      }
    } catch (error) {
      console.warn("Migration cleanup failed:", error);
      // 정리 실패는 마이그레이션 실패로 처리하지 않음
    }
  }

  // ================================
  // 유틸리티 메서드
  // ================================

  /**
   * 중복 TODO 확인
   */
  private async isDuplicateTodo(todo: Todo): Promise<boolean> {
    try {
      // 제목과 생성 시간을 기준으로 중복 확인
      // 실제로는 서버 API를 통해 중복 확인해야 함
      const response = await todoApiService.getAll();
      const serverTodos = response.data.todos || [];

      return serverTodos.some(
        (serverTodo) =>
          serverTodo.title === todo.title &&
          Math.abs(
            new Date(serverTodo.createdAt).getTime() -
              new Date(todo.createdAt).getTime(),
          ) < 60000, // 1분 이내
      );
    } catch (error) {
      console.warn("Duplicate check failed:", error);
      return false; // 확인 실패 시 중복이 아닌 것으로 처리
    }
  }

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

  // ================================
  // 공개 유틸리티 메서드
  // ================================

  /**
   * 마이그레이션 재설정
   */
  resetMigration(): void {
    this.state = {
      isRequired: false,
      isInProgress: false,
      isComplete: false,
      totalItems: 0,
      migratedItems: 0,
      error: null,
      stage: "checking",
    };

    localStorage.removeItem("migration:completed");
    localStorage.removeItem("migration:timestamp");

    console.log("🔄 Migration state reset");
  }

  /**
   * 마이그레이션 상태 리포트
   */
  getStatusReport(): {
    state: MigrationState;
    progress: number;
    isHealthy: boolean;
    recommendations: string[];
  } {
    const progress =
      this.state.totalItems > 0
        ? this.state.migratedItems / this.state.totalItems
        : 0;
    const isHealthy =
      !this.state.error &&
      (this.state.isComplete || this.state.stage !== "error");

    const recommendations: string[] = [];

    if (this.state.error) {
      recommendations.push("마이그레이션 오류를 해결하고 다시 시도하세요.");
    }

    if (
      this.state.isRequired &&
      !this.state.isInProgress &&
      !this.state.isComplete
    ) {
      recommendations.push(
        "로컬 데이터를 클라우드로 마이그레이션하는 것을 권장합니다.",
      );
    }

    if (this.state.isInProgress && progress < 0.1) {
      recommendations.push(
        "마이그레이션이 예상보다 오래 걸릴 수 있습니다. 네트워크 연결을 확인하세요.",
      );
    }

    return {
      state: this.state,
      progress,
      isHealthy,
      recommendations,
    };
  }

  /**
   * 강제 마이그레이션 중단
   */
  async cancelMigration(): Promise<boolean> {
    if (!this.state.isInProgress) {
      return false;
    }

    try {
      this.updateState({
        isInProgress: false,
        error: "Migration cancelled by user",
        stage: "error",
      });

      this.emitEvent("migration_error", {
        error: "Migration cancelled by user",
        state: this.state,
      });

      return true;
    } catch (error) {
      console.error("Failed to cancel migration:", error);
      return false;
    }
  }
}

/**
 * 데이터 마이그레이션 서비스 인스턴스
 */
export const dataMigrationService = new DataMigrationService();

/**
 * 마이그레이션 유틸리티 함수들
 */
export const migrationUtils = {
  /**
   * 마이그레이션 필요성 빠른 확인
   */
  quickCheck(): boolean {
    const hasLocalData = localStorageService.getTodos().length > 0;
    const migrationCompleted =
      localStorage.getItem("migration:completed") === "true";
    return hasLocalData && !migrationCompleted;
  },

  /**
   * 마이그레이션 히스토리 조회
   */
  getMigrationHistory(): {
    completed: boolean;
    timestamp: string | null;
    version: string;
  } {
    return {
      completed: localStorage.getItem("migration:completed") === "true",
      timestamp: localStorage.getItem("migration:timestamp"),
      version: "1.0.0", // 마이그레이션 버전
    };
  },

  /**
   * 안전한 마이그레이션 실행
   */
  async safeMigrate(): Promise<MigrationResult> {
    try {
      // 백업 생성
      const backup = localStorageService.getTodos();
      localStorage.setItem(
        "migration:backup",
        JSON.stringify({
          data: backup,
          timestamp: new Date().toISOString(),
        }),
      );

      // 마이그레이션 실행
      return await dataMigrationService.performMigration();
    } catch (error) {
      console.error("Safe migration failed:", error);
      throw error;
    }
  },

  /**
   * 백업 데이터 복원
   */
  restoreFromBackup(): boolean {
    try {
      const backupData = localStorage.getItem("migration:backup");
      if (!backupData) {
        return false;
      }

      const backup = JSON.parse(backupData);
      const todos = backup.data as Todo[];

      // 백업 데이터 복원
      todos.forEach((todo) => {
        localStorageService.addTodo(todo);
      });

      return true;
    } catch (error) {
      console.error("Backup restoration failed:", error);
      return false;
    }
  },
};
