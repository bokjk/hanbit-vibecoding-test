import type { Todo, Priority, FilterType, TodoStats } from 'types/index';
import { AbstractStorageService } from './storage/abstract-storage.service';
import { LocalStorageService } from './localStorage.service';
import { APIStorageService } from './storage/api-storage.service';
import { TodoAPIClient } from './api/todo-api-client';
import { authService } from './auth.service';
import { appConfig } from '../config/app-config';
import { APIError } from '../errors/api-error';

/**
 * 스토리지 모드 열거형
 */
export enum StorageMode {
  LOCAL_STORAGE = 'localStorage',
  API = 'api',
  HYBRID = 'hybrid', // 향후 확장을 위한 예약
}

/**
 * 통합 TODO 서비스
 * 설정에 따라 localStorage 또는 API 스토리지를 사용합니다
 * 기존 LocalStorageService와 호환되는 인터페이스를 제공합니다
 */
export class UnifiedTodoService {
  private static instance: UnifiedTodoService;
  private currentStorage: AbstractStorageService;
  private localStorageService: LocalStorageService;
  private apiStorageService: APIStorageService | null = null;
  private currentMode: StorageMode;

  private constructor() {
    // localStorage 서비스는 항상 백업용으로 유지
    this.localStorageService = new LocalStorageService();
    
    // 초기 스토리지 모드 설정
    this.currentMode = this.determineStorageMode();
    this.currentStorage = this.createStorageService();

    // 설정 로그 출력
    if (appConfig.features.debugMode) {
      console.log(`📦 UnifiedTodoService initialized with mode: ${this.currentMode}`);
    }
  }

  static getInstance(): UnifiedTodoService {
    if (!UnifiedTodoService.instance) {
      UnifiedTodoService.instance = new UnifiedTodoService();
    }
    return UnifiedTodoService.instance;
  }

  // ================================
  // 기존 LocalStorageService 호환 메서드들
  // ================================

  /**
   * 모든 TODO 조회 (기존 인터페이스 호환)
   */
  async getTodos(): Promise<Todo[]> {
    try {
      return await this.currentStorage.getTodos();
    } catch (error) {
      return this.handleStorageError(error, 'getTodos');
    }
  }

  /**
   * TODO 저장 (기존 인터페이스 호환)
   * 주의: API 모드에서는 개별 TODO 작업으로 변환됩니다
   */
  async saveTodos(todos: Todo[]): Promise<void> {
    if (this.currentMode === StorageMode.LOCAL_STORAGE) {
      await (this.currentStorage as {saveTodos: (todos: Todo[]) => Promise<void>}).saveTodos(todos);
      return;
    }

    // API 모드에서는 지원하지 않음 (개별 CRUD 작업 사용 권장)
    throw new Error('saveTodos is not supported in API mode. Use individual CRUD operations.');
  }

  // ================================
  // 통합 CRUD 메서드들
  // ================================

  /**
   * 특정 TODO 조회
   */
  async getTodoById(id: string): Promise<Todo | null> {
    try {
      return await this.currentStorage.getTodoById(id);
    } catch (error) {
      return this.handleStorageError(error, 'getTodoById', null);
    }
  }

  /**
   * 새로운 TODO 생성
   */
  async createTodo(title: string, priority: Priority = 'medium'): Promise<Todo> {
    try {
      return await this.currentStorage.createTodo(title, priority);
    } catch (error) {
      throw this.handleStorageError(error, 'createTodo');
    }
  }

  /**
   * TODO 수정
   */
  async updateTodo(
    id: string,
    updates: Partial<Pick<Todo, 'title' | 'completed' | 'priority'>>
  ): Promise<Todo> {
    try {
      return await this.currentStorage.updateTodo(id, updates);
    } catch (error) {
      throw this.handleStorageError(error, 'updateTodo');
    }
  }

  /**
   * TODO 완료 상태 토글
   */
  async toggleTodo(id: string): Promise<Todo> {
    try {
      return await this.currentStorage.toggleTodo(id);
    } catch (error) {
      throw this.handleStorageError(error, 'toggleTodo');
    }
  }

  /**
   * TODO 삭제
   */
  async deleteTodo(id: string): Promise<string> {
    try {
      return await this.currentStorage.deleteTodo(id);
    } catch (error) {
      throw this.handleStorageError(error, 'deleteTodo');
    }
  }

  /**
   * 모든 TODO 삭제
   */
  async clearAllTodos(): Promise<number> {
    try {
      return await this.currentStorage.clearAllTodos();
    } catch (error) {
      return this.handleStorageError(error, 'clearAllTodos', 0);
    }
  }

  /**
   * 완료된 TODO 삭제
   */
  async clearCompletedTodos(): Promise<number> {
    try {
      return await this.currentStorage.clearCompletedTodos();
    } catch (error) {
      return this.handleStorageError(error, 'clearCompletedTodos', 0);
    }
  }

  // ================================
  // 필터링 및 통계 메서드들
  // ================================

  /**
   * 필터링된 TODO 조회
   */
  async getFilteredTodos(filter: FilterType): Promise<Todo[]> {
    try {
      return await this.currentStorage.getFilteredTodos(filter);
    } catch (error) {
      return this.handleStorageError(error, 'getFilteredTodos', []);
    }
  }

  /**
   * TODO 통계 조회
   */
  async getTodoStats(): Promise<TodoStats> {
    try {
      return await this.currentStorage.getTodoStats();
    } catch (error) {
      return this.handleStorageError(error, 'getTodoStats', {
        total: 0,
        active: 0,
        completed: 0,
        byPriority: { high: 0, medium: 0, low: 0 }
      });
    }
  }

  /**
   * 제목으로 TODO 검색
   */
  async searchTodos(query: string): Promise<Todo[]> {
    try {
      return await this.currentStorage.searchTodos(query);
    } catch (error) {
      return this.handleStorageError(error, 'searchTodos', []);
    }
  }

  /**
   * 우선순위별 TODO 조회
   */
  async getTodosByPriority(priority: Priority): Promise<Todo[]> {
    try {
      return await this.currentStorage.getTodosByPriority(priority);
    } catch (error) {
      return this.handleStorageError(error, 'getTodosByPriority', []);
    }
  }

  // ================================
  // 스토리지 모드 관리
  // ================================

  /**
   * 현재 스토리지 모드 조회
   */
  getCurrentMode(): StorageMode {
    return this.currentMode;
  }

  /**
   * 스토리지 모드 변경
   */
  async switchStorageMode(mode: StorageMode): Promise<void> {
    if (mode === this.currentMode) {
      return;
    }

    const oldMode = this.currentMode;
    this.currentMode = mode;
    
    try {
      const newStorage = this.createStorageService();
      this.currentStorage = newStorage;

      if (appConfig.features.debugMode) {
        console.log(`📦 Storage mode switched from ${oldMode} to ${mode}`);
      }
    } catch (error) {
      // 롤백
      this.currentMode = oldMode;
      throw error;
    }
  }

  /**
   * localStorage에서 API로 데이터 마이그레이션
   */
  async migrateToAPI(): Promise<{ success: boolean; migratedCount: number; error?: string }> {
    try {
      if (this.currentMode !== StorageMode.LOCAL_STORAGE) {
        throw new Error('Migration is only available from localStorage mode');
      }

      // localStorage 데이터 조회
      const localTodos = await this.localStorageService.getTodos();
      
      if (localTodos.length === 0) {
        return { success: true, migratedCount: 0 };
      }

      // API 스토리지 서비스가 없으면 생성
      if (!this.apiStorageService) {
        this.apiStorageService = this.createAPIStorageService();
      }

      // 데이터 마이그레이션
      const migratedCount = await this.apiStorageService.importData(localTodos);

      // 성공 시 API 모드로 전환
      await this.switchStorageMode(StorageMode.API);

      if (appConfig.features.debugMode) {
        console.log(`🚀 Successfully migrated ${migratedCount} todos to API`);
      }

      return { success: true, migratedCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during migration';
      
      if (appConfig.features.debugMode) {
        console.error('❌ Migration failed:', errorMessage);
      }

      return { success: false, migratedCount: 0, error: errorMessage };
    }
  }

  // ================================
  // 동기화 관련 메서드들
  // ================================

  /**
   * 동기화 상태 확인
   */
  async isSynced(): Promise<boolean> {
    if (this.currentMode === StorageMode.LOCAL_STORAGE) {
      return true; // localStorage는 항상 동기화됨
    }

    try {
      return await this.currentStorage.isSynced?.() ?? false;
    } catch {
      return false;
    }
  }

  /**
   * 수동 동기화
   */
  async syncData(): Promise<number> {
    if (this.currentMode === StorageMode.LOCAL_STORAGE) {
      return 0; // localStorage는 동기화할 필요 없음
    }

    try {
      return await this.currentStorage.syncData?.() ?? 0;
    } catch (error) {
      if (appConfig.features.debugMode) {
        console.error('❌ Sync failed:', error);
      }
      return 0;
    }
  }

  // ================================
  // 내부 유틸리티 메서드들
  // ================================

  /**
   * 적절한 스토리지 모드 결정
   */
  private determineStorageMode(): StorageMode {
    // API 모드가 활성화되어 있으면 API 사용
    if (appConfig.features.apiMode) {
      return StorageMode.API;
    }
    
    // 기본적으로 localStorage 사용
    return StorageMode.LOCAL_STORAGE;
  }

  /**
   * 현재 모드에 따른 스토리지 서비스 생성
   */
  private createStorageService(): AbstractStorageService {
    switch (this.currentMode) {
      case StorageMode.API:
        return this.createAPIStorageService();
      case StorageMode.LOCAL_STORAGE:
      default:
        return this.localStorageService as AbstractStorageService; // AbstractStorageService로 캐스팅
    }
  }

  /**
   * API 스토리지 서비스 생성
   */
  private createAPIStorageService(): APIStorageService {
    if (!this.apiStorageService) {
      const apiClient = new TodoAPIClient(appConfig.api.baseURL, authService);
      this.apiStorageService = new APIStorageService(apiClient);
    }
    return this.apiStorageService;
  }

  /**
   * 스토리지 에러 처리
   */
  private handleStorageError<T>(error: unknown, operation: string, defaultValue?: T): T {
    if (error instanceof APIError && error.isNetworkError()) {
      // 네트워크 에러의 경우 localStorage로 폴백 (API 모드에서만)
      if (this.currentMode === StorageMode.API) {
        console.warn(`⚠️ Network error in ${operation}, falling back to localStorage`);
        
        if (defaultValue !== undefined) {
          return defaultValue;
        }
      }
    }

    if (appConfig.features.debugMode) {
      console.error(`❌ Storage error in ${operation}:`, error);
    }

    // defaultValue가 있으면 반환, 없으면 에러를 다시 던짐
    if (defaultValue !== undefined) {
      return defaultValue;
    }

    throw error;
  }

  // ================================
  // 정리 및 디버깅 메서드들
  // ================================

  /**
   * 서비스 상태 정보 조회
   */
  getServiceInfo(): {
    currentMode: StorageMode;
    isApiAvailable: boolean;
    cacheInfo?: { size: number; lastSyncTime: Date | null; isSyncing: boolean };
  } {
    const info = {
      currentMode: this.currentMode,
      isApiAvailable: this.apiStorageService !== null,
    };

    // API 스토리지 캐시 정보 추가
    if (this.apiStorageService && 'getCacheInfo' in this.apiStorageService) {
      (info as {cacheInfo?: unknown}).cacheInfo = (this.apiStorageService as {getCacheInfo: () => unknown}).getCacheInfo();
    }

    return info;
  }

  /**
   * 캐시 클리어 (API 모드에서만)
   */
  clearCache(): void {
    if (this.apiStorageService && 'clearCache' in this.apiStorageService) {
      this.apiStorageService.clearCache();
    }
  }

  /**
   * 서비스 정리
   */
  dispose(): void {
    if (this.apiStorageService && 'clearCache' in this.apiStorageService) {
      this.apiStorageService.clearCache();
    }
    this.apiStorageService = null;
  }
}

// 전역 통합 서비스 인스턴스 내보내기
export const unifiedTodoService = UnifiedTodoService.getInstance();