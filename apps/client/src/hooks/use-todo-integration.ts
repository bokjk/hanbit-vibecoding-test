import { useEffect, useCallback, useRef } from "react";
import { useTodoContext } from "../contexts/todo.context";
import { useTodoService } from "./use-todo-service";
import type { Todo, Priority } from "@vive/types";
import { appConfig } from "../config/app-config";

/**
 * TODO Context와 Service를 통합하는 훅
 * 기존 Context 인터페이스를 유지하면서 내부적으로 새로운 서비스를 사용합니다
 */
export function useTodoIntegration() {
  const context = useTodoContext();
  const todoService = useTodoService();
  const isInitialized = useRef(false);

  // ================================
  // 초기 데이터 로드
  // ================================

  const loadInitialData = useCallback(async () => {
    if (isInitialized.current) return;

    try {
      context.setLoading(true);
      context.setError(null);

      const todos = await todoService.getTodos();
      context.loadTodos(todos);

      if (appConfig.features.debugMode) {
        console.log(
          `📊 Loaded ${todos.length} todos from ${todoService.serviceState.storageMode}`,
        );
      }

      isInitialized.current = true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load todos";
      context.setError(errorMessage);

      if (appConfig.features.debugMode) {
        console.error("❌ Failed to load initial data:", error);
      }
    } finally {
      context.setLoading(false);
    }
  }, [context, todoService]);

  // ================================
  // 통합된 액션 메서드들 (Context 인터페이스 호환)
  // ================================

  const addTodo = useCallback(
    async (todoData: { title: string; priority: Priority }) => {
      try {
        context.setLoading(true);
        context.setError(null);

        const newTodo = await todoService.createTodo(
          todoData.title,
          todoData.priority,
        );
        context.addTodo({
          title: newTodo.title,
          priority: newTodo.priority,
          userId: newTodo.userId,
          isGuest: newTodo.isGuest,
        });

        if (appConfig.features.debugMode) {
          console.log("✅ Todo created:", newTodo.id);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to create todo";
        context.setError(errorMessage);
        throw error;
      } finally {
        context.setLoading(false);
      }
    },
    [context, todoService],
  );

  const updateTodo = useCallback(
    async (
      id: string,
      updates: Partial<Pick<Todo, "title" | "completed" | "priority">>,
    ) => {
      try {
        context.setLoading(true);
        context.setError(null);

        const updatedTodo = await todoService.updateTodo(id, updates);
        context.updateTodo(updatedTodo);

        if (appConfig.features.debugMode) {
          console.log("✅ Todo updated:", id);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to update todo";
        context.setError(errorMessage);
        throw error;
      } finally {
        context.setLoading(false);
      }
    },
    [context, todoService],
  );

  const deleteTodo = useCallback(
    async (id: string) => {
      try {
        context.setLoading(true);
        context.setError(null);

        await todoService.deleteTodo(id);
        context.deleteTodo(id);

        if (appConfig.features.debugMode) {
          console.log("✅ Todo deleted:", id);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to delete todo";
        context.setError(errorMessage);
        throw error;
      } finally {
        context.setLoading(false);
      }
    },
    [context, todoService],
  );

  const toggleTodo = useCallback(
    async (id: string) => {
      try {
        context.setLoading(true);
        context.setError(null);

        const updatedTodo = await todoService.toggleTodo(id);
        context.updateTodo(updatedTodo);

        if (appConfig.features.debugMode) {
          console.log("✅ Todo toggled:", id);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to toggle todo";
        context.setError(errorMessage);
        throw error;
      } finally {
        context.setLoading(false);
      }
    },
    [context, todoService],
  );

  const clearCompletedTodos = useCallback(async () => {
    try {
      context.setLoading(true);
      context.setError(null);

      const deletedCount = await todoService.clearCompletedTodos();

      // Context에서 완료된 TODO들 제거
      const currentTodos = context.state.todos;
      const remainingTodos = currentTodos.filter((todo) => !todo.completed);
      context.loadTodos(remainingTodos);

      if (appConfig.features.debugMode) {
        console.log(`✅ Cleared ${deletedCount} completed todos`);
      }

      return deletedCount;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to clear completed todos";
      context.setError(errorMessage);
      throw error;
    } finally {
      context.setLoading(false);
    }
  }, [context, todoService]);

  const clearAllTodos = useCallback(async () => {
    try {
      context.setLoading(true);
      context.setError(null);

      const deletedCount = await todoService.clearAllTodos();
      context.clearTodos();

      if (appConfig.features.debugMode) {
        console.log(`✅ Cleared ${deletedCount} todos`);
      }

      return deletedCount;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to clear all todos";
      context.setError(errorMessage);
      throw error;
    } finally {
      context.setLoading(false);
    }
  }, [context, todoService]);

  // ================================
  // 고급 기능들
  // ================================

  const searchTodos = useCallback(
    async (query: string) => {
      try {
        context.setLoading(true);
        return await todoService.searchTodos(query);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to search todos";
        context.setError(errorMessage);
        return [];
      } finally {
        context.setLoading(false);
      }
    },
    [context, todoService],
  );

  const getTodosByPriority = useCallback(
    async (priority: Priority) => {
      try {
        context.setLoading(true);
        return await todoService.getTodosByPriority(priority);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to get todos by priority";
        context.setError(errorMessage);
        return [];
      } finally {
        context.setLoading(false);
      }
    },
    [context, todoService],
  );

  const refreshTodos = useCallback(async () => {
    try {
      context.setLoading(true);
      context.setError(null);

      const todos = await todoService.getTodos();
      context.loadTodos(todos);

      if (appConfig.features.debugMode) {
        console.log(`🔄 Refreshed ${todos.length} todos`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to refresh todos";
      context.setError(errorMessage);
    } finally {
      context.setLoading(false);
    }
  }, [context, todoService]);

  const syncData = useCallback(async () => {
    try {
      context.setLoading(true);
      const syncedCount = await todoService.syncData();

      // 동기화 후 최신 데이터 다시 로드
      await refreshTodos();

      if (appConfig.features.debugMode) {
        console.log(`🔄 Synced ${syncedCount} todos`);
      }

      return syncedCount;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to sync data";
      context.setError(errorMessage);
      return 0;
    } finally {
      context.setLoading(false);
    }
  }, [context, todoService, refreshTodos]);

  // ================================
  // 스토리지 모드 관리
  // ================================

  const migrateToAPI = useCallback(async () => {
    try {
      context.setLoading(true);
      context.setError(null);

      const result = await todoService.migrateToAPI();

      if (result.success) {
        // 마이그레이션 성공 시 최신 데이터 로드
        await refreshTodos();

        if (appConfig.features.debugMode) {
          console.log(
            `🚀 Successfully migrated ${result.migratedCount} todos to API`,
          );
        }
      } else {
        context.setError(result.error || "Migration failed");
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Migration failed";
      context.setError(errorMessage);
      return { success: false, migratedCount: 0, error: errorMessage };
    } finally {
      context.setLoading(false);
    }
  }, [context, todoService, refreshTodos]);

  // ================================
  // 초기화 및 서비스 상태 동기화
  // ================================

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 서비스 에러를 Context에 동기화
  useEffect(() => {
    if (todoService.serviceState.error) {
      context.setError(todoService.serviceState.error);
    }
  }, [todoService.serviceState.error, context]);

  // 서비스 로딩 상태를 Context에 동기화
  useEffect(() => {
    context.setLoading(todoService.serviceState.isLoading);
  }, [todoService.serviceState.isLoading, context]);

  // ================================
  // 반환값
  // ================================

  return {
    // 기존 Context 인터페이스
    ...context,

    // 확장된 액션 메서드들
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
    clearCompletedTodos,
    clearAllTodos,

    // 고급 기능들
    searchTodos,
    getTodosByPriority,
    refreshTodos,
    syncData,
    migrateToAPI,

    // 서비스 상태 정보
    serviceState: todoService.serviceState,

    // 유틸리티
    clearServiceError: todoService.clearError,
    isInitialized: isInitialized.current,
  };
}
