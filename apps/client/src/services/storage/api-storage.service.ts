import type { Todo, Priority, FilterType } from "@vive/types";
import { AbstractStorageService } from "./abstract-storage.service";
import { TodoAPIClient } from "../api/todo-api-client";
import { APIError } from "../../errors/api-error";
import { appConfig } from "../../config/app-config";

/**
 * API 기반 스토리지 서비스
 * AbstractStorageService를 구현하여 백엔드 API와 통신합니다
 */
export class APIStorageService extends AbstractStorageService {
  private apiClient: TodoAPIClient;
  private cache: Map<string, Todo> = new Map();
  private lastSyncTime: Date | null = null;
  private isSyncing = false;

  constructor(apiClient: TodoAPIClient) {
    super();
    this.apiClient = apiClient;
  }

  // ================================
  // 필수 구현 메서드들
  // ================================

  /**
   * 모든 TODO 조회
   */
  async getTodos(filter?: FilterType): Promise<Todo[]> {
    try {
      const response = await this.apiClient.getTodos({
        filter,
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      const todos = response.data.todos;

      // 캐시 업데이트
      this.updateCache(todos);
      this.lastSyncTime = new Date();

      return todos;
    } catch (error) {
      if (error instanceof APIError && error.isNetworkError()) {
        // 네트워크 오류 시 캐시된 데이터 반환
        return this.getCachedTodos(filter);
      }
      throw error;
    }
  }

  /**
   * 특정 TODO 조회
   */
  async getTodoById(id: string): Promise<Todo | null> {
    try {
      // 캐시에서 먼저 확인
      const cachedTodo = this.cache.get(id);
      if (cachedTodo) {
        return cachedTodo;
      }

      // getTodos()를 사용해서 전체 목록에서 해당 ID 찾기
      const response = await this.apiClient.getTodos();
      const todos = response.data.todos;
      const todo = todos.find(t => t.id === id) || null;

      if (todo) {
        // 캐시에 저장
        this.cache.set(id, todo);
      }

      return todo;
    } catch (error) {
      if (error instanceof APIError && error.isNetworkError()) {
        // 네트워크 오류 시 캐시에서 반환
        return this.cache.get(id) || null;
      }

      throw error;
    }
  }

  /**
   * 새로운 TODO 생성
   */
  async createTodo(title: string, priority: Priority): Promise<Todo> {
    this.validateTodoData(title, priority);

    try {
      const response = await this.apiClient.createTodo({
        title: title.trim(),
        priority,
      });

      const newTodo = response.data.todo;

      // 캐시에 추가
      this.cache.set(newTodo.id, newTodo);

      if (appConfig.features.debugMode) {
        console.log("✅ Todo created via API:", newTodo.id);
      }

      return newTodo;
    } catch (error) {
      if (error instanceof APIError && error.isNetworkError()) {
        // 오프라인 모드: 낙관적 업데이트
        return this.createOptimisticTodo(title.trim(), priority);
      }
      throw error;
    }
  }

  /**
   * TODO 수정
   */
  async updateTodo(
    id: string,
    updates: Partial<Pick<Todo, "title" | "completed" | "priority">>,
  ): Promise<Todo> {
    // 제목 업데이트 시 유효성 검사
    if (updates.title !== undefined) {
      if (!updates.title || updates.title.trim().length === 0) {
        throw new Error("Todo title cannot be empty");
      }
      if (updates.title.trim().length > 200) {
        throw new Error("Todo title cannot exceed 200 characters");
      }
    }

    try {
      const response = await this.apiClient.updateTodo(id, {
        ...updates,
        title: updates.title?.trim(),
      });

      const updatedTodo = response.data.todo;

      // 캐시 업데이트
      this.cache.set(id, updatedTodo);

      if (appConfig.features.debugMode) {
        console.log("✅ Todo updated via API:", id);
      }

      return updatedTodo;
    } catch (error) {
      if (error instanceof APIError && error.isNetworkError()) {
        // 오프라인 모드: 낙관적 업데이트
        return this.updateOptimisticTodo(id, updates);
      }
      throw error;
    }
  }

  /**
   * TODO 삭제
   */
  async deleteTodo(id: string): Promise<string> {
    try {
      await this.apiClient.deleteTodo(id);

      // 캐시에서 제거
      this.cache.delete(id);

      if (appConfig.features.debugMode) {
        console.log("✅ Todo deleted via API:", id);
      }

      return id;
    } catch (error) {
      if (error instanceof APIError && error.isNetworkError()) {
        // 오프라인 모드: 캐시에서만 제거 (나중에 동기화)
        this.cache.delete(id);
        // TODO: 삭제 작업을 pending actions에 추가
        return id;
      }
      throw error;
    }
  }

  /**
   * 모든 TODO 삭제
   */
  async clearAllTodos(): Promise<number> {
    try {
      const todos = await this.getTodos();

      // 배치 삭제 API가 있다면 사용, 없다면 개별 삭제
      if (todos.length > 0) {
        const ids = todos.map((todo) => todo.id);
        await this.apiClient.deleteMultipleTodos(ids);
      }

      // 캐시 클리어
      this.cache.clear();

      if (appConfig.features.debugMode) {
        console.log(`✅ ${todos.length} todos cleared via API`);
      }

      return todos.length;
    } catch (error) {
      if (error instanceof APIError && error.isNetworkError()) {
        // 오프라인 모드: 캐시만 클리어
        const count = this.cache.size;
        this.cache.clear();
        return count;
      }
      throw error;
    }
  }

  // ================================
  // API 특화 메서드들
  // ================================

  /**
   * 데이터 내보내기
   */
  async exportData(): Promise<string> {
    try {
      const response = await this.apiClient.exportData("json");
      return response.data.exportUrl;
    } catch (error) {
      if (error instanceof APIError && error.isNetworkError()) {
        // 오프라인 시 캐시된 데이터를 JSON으로 반환
        const todos = Array.from(this.cache.values());
        return JSON.stringify(todos, null, 2);
      }
      throw error;
    }
  }

  /**
   * 데이터 가져오기
   */
  async importData(data: Todo[]): Promise<number> {
    try {
      // localStorage에서 마이그레이션 요청
      const response = await this.apiClient.migrateFromLocalStorage({
        localStorageData: data,
        migrationOptions: {
          preserveIds: false,
          mergeStrategy: "merge",
        },
      });

      // 캐시 갱신을 위해 최신 데이터 다시 로드
      await this.getTodos();

      return response.data.migratedCount;
    } catch (error) {
      if (error instanceof APIError && error.isNetworkError()) {
        throw new Error(
          "Cannot import data while offline. Please try again when online.",
        );
      }
      throw error;
    }
  }

  /**
   * 동기화 상태 확인
   */
  async isSynced(): Promise<boolean> {
    if (this.isSyncing) {
      return false;
    }

    try {
      // 간단한 헬스 체크
      const isHealthy = await this.apiClient.healthCheck();
      return isHealthy && this.lastSyncTime !== null;
    } catch {
      return false;
    }
  }

  /**
   * 수동 동기화
   */
  async syncData(): Promise<number> {
    if (this.isSyncing) {
      return 0;
    }

    this.isSyncing = true;

    try {
      // 서버에서 최신 데이터 가져오기
      const todos = await this.getTodos();

      if (appConfig.features.debugMode) {
        console.log(`🔄 Synced ${todos.length} todos from API`);
      }

      return todos.length;
    } finally {
      this.isSyncing = false;
    }
  }

  // ================================
  // 캐시 관리 메서드들
  // ================================

  /**
   * 캐시 업데이트
   */
  private updateCache(todos: Todo[]): void {
    // 기존 캐시 클리어 후 새 데이터로 업데이트
    this.cache.clear();
    todos.forEach((todo) => {
      this.cache.set(todo.id, todo);
    });
  }

  /**
   * 캐시된 TODO 조회 (필터링 포함)
   */
  private getCachedTodos(filter?: FilterType): Todo[] {
    const allTodos = Array.from(this.cache.values());
    const sortedTodos = this.sortTodos(allTodos);

    switch (filter) {
      case "active":
        return sortedTodos.filter((todo) => !todo.completed);
      case "completed":
        return sortedTodos.filter((todo) => todo.completed);
      case "all":
      default:
        return sortedTodos;
    }
  }

  /**
   * 낙관적 TODO 생성 (오프라인용)
   */
  private createOptimisticTodo(title: string, priority: Priority): Todo {
    const optimisticTodo: Todo = {
      id: `temp-${this.generateId()}`,
      title,
      priority,
      completed: false,
      createdAt: this.getCurrentTimestamp(),
      updatedAt: this.getCurrentTimestamp(),
      userId: "", // 게스트 사용자
      isGuest: true,
    };

    // 캐시에 임시 저장
    this.cache.set(optimisticTodo.id, optimisticTodo);

    if (appConfig.features.debugMode) {
      console.log("📝 Optimistic todo created (offline):", optimisticTodo.id);
    }

    return optimisticTodo;
  }

  /**
   * 낙관적 TODO 업데이트 (오프라인용)
   */
  private updateOptimisticTodo(
    id: string,
    updates: Partial<Pick<Todo, "title" | "completed" | "priority">>,
  ): Todo {
    const existingTodo = this.cache.get(id);
    if (!existingTodo) {
      throw new Error(`Todo with id ${id} not found`);
    }

    const updatedTodo: Todo = {
      ...existingTodo,
      ...updates,
      updatedAt: this.getCurrentTimestamp(),
    };

    // 캐시 업데이트
    this.cache.set(id, updatedTodo);

    if (appConfig.features.debugMode) {
      console.log("📝 Optimistic todo updated (offline):", id);
    }

    return updatedTodo;
  }

  /**
   * 캐시 클리어
   */
  clearCache(): void {
    this.cache.clear();
    this.lastSyncTime = null;

    if (appConfig.features.debugMode) {
      console.log("🧹 API cache cleared");
    }
  }

  /**
   * 캐시 상태 정보
   */
  getCacheInfo(): {
    size: number;
    lastSyncTime: Date | null;
    isSyncing: boolean;
  } {
    return {
      size: this.cache.size,
      lastSyncTime: this.lastSyncTime,
      isSyncing: this.isSyncing,
    };
  }
}
