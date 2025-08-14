import { useCallback, useEffect, useState } from "react";
import type { Todo, Priority, FilterType, TodoStats } from "@vive/types";
import {
  unifiedTodoService,
  StorageMode,
} from "../services/unified-todo.service";
import { appConfig } from "../config/app-config";
import { APIError } from "../errors/api-error";

/**
 * 서비스 상태 인터페이스
 */
interface ServiceState {
  isLoading: boolean;
  error: string | null;
  storageMode: StorageMode;
  isSynced: boolean;
}

/**
 * TODO 서비스 훅의 반환 타입
 */
export interface UseTodoServiceReturn {
  // 상태
  serviceState: ServiceState;

  // CRUD 작업
  getTodos: () => Promise<Todo[]>;
  getTodoById: (id: string) => Promise<Todo | null>;
  createTodo: (title: string, priority?: Priority) => Promise<Todo>;
  updateTodo: (
    id: string,
    updates: Partial<Pick<Todo, "title" | "completed" | "priority">>,
  ) => Promise<Todo>;
  toggleTodo: (id: string) => Promise<Todo>;
  deleteTodo: (id: string) => Promise<string>;
  clearAllTodos: () => Promise<number>;
  clearCompletedTodos: () => Promise<number>;

  // 필터링 및 검색
  getFilteredTodos: (filter: FilterType) => Promise<Todo[]>;
  searchTodos: (query: string) => Promise<Todo[]>;
  getTodosByPriority: (priority: Priority) => Promise<Todo[]>;
  getTodoStats: () => Promise<TodoStats>;

  // 스토리지 관리
  switchStorageMode: (mode: StorageMode) => Promise<void>;
  migrateToAPI: () => Promise<{
    success: boolean;
    migratedCount: number;
    error?: string;
  }>;
  syncData: () => Promise<number>;

  // 유틸리티
  refreshServiceState: () => Promise<void>;
  clearError: () => void;
}

/**
 * TODO 서비스를 관리하는 커스텀 훅
 * UnifiedTodoService와 React 상태를 연결합니다
 */
export function useTodoService(): UseTodoServiceReturn {
  const [serviceState, setServiceState] = useState<ServiceState>({
    isLoading: false,
    error: null,
    storageMode: unifiedTodoService.getCurrentMode(),
    isSynced: true,
  });

  // ================================
  // 상태 관리 유틸리티
  // ================================

  const setLoading = useCallback((loading: boolean) => {
    setServiceState((prev) => ({ ...prev, isLoading: loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setServiceState((prev) => ({ ...prev, error }));
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const updateStorageMode = useCallback(() => {
    const currentMode = unifiedTodoService.getCurrentMode();
    setServiceState((prev) => ({ ...prev, storageMode: currentMode }));
  }, []);

  const updateSyncStatus = useCallback(async () => {
    try {
      const isSynced = await unifiedTodoService.isSynced();
      setServiceState((prev) => ({ ...prev, isSynced }));
    } catch {
      setServiceState((prev) => ({ ...prev, isSynced: false }));
    }
  }, []);

  const refreshServiceState = useCallback(async () => {
    updateStorageMode();
    await updateSyncStatus();
  }, [updateStorageMode, updateSyncStatus]);

  // ================================
  // 에러 처리 래퍼
  // ================================

  const withErrorHandling = useCallback(
    <T>(operation: () => Promise<T>, operationName: string): Promise<T> => {
      return new Promise((resolve, reject) => {
        (async () => {
          setLoading(true);
          setError(null);

          try {
            const result = await operation();
            resolve(result);
          } catch (error) {
            let errorMessage = `${operationName} 중 오류가 발생했습니다.`;

            if (error instanceof APIError) {
              errorMessage = error.getUserFriendlyMessage();
            } else if (error instanceof Error) {
              errorMessage = error.message;
            }

            if (appConfig.features.debugMode) {
              console.error(`❌ ${operationName} error:`, error);
            }

            setError(errorMessage);
            reject(error);
          } finally {
            setLoading(false);
            // 작업 완료 후 동기화 상태 업데이트
            updateSyncStatus();
          }
        })();
      });
    },
    [setLoading, setError, updateSyncStatus],
  );

  // ================================
  // CRUD 작업 메서드들
  // ================================

  const getTodos = useCallback((): Promise<Todo[]> => {
    return withErrorHandling(
      () => unifiedTodoService.getTodos(),
      "TODO 목록 조회",
    );
  }, [withErrorHandling]);

  const getTodoById = useCallback(
    (id: string): Promise<Todo | null> => {
      return withErrorHandling(
        () => unifiedTodoService.getTodoById(id),
        "TODO 조회",
      );
    },
    [withErrorHandling],
  );

  const createTodo = useCallback(
    (title: string, priority: Priority = "medium"): Promise<Todo> => {
      return withErrorHandling(
        () => unifiedTodoService.createTodo(title, priority),
        "TODO 생성",
      );
    },
    [withErrorHandling],
  );

  const updateTodo = useCallback(
    (
      id: string,
      updates: Partial<Pick<Todo, "title" | "completed" | "priority">>,
    ): Promise<Todo> => {
      return withErrorHandling(
        () => unifiedTodoService.updateTodo(id, updates),
        "TODO 수정",
      );
    },
    [withErrorHandling],
  );

  const toggleTodo = useCallback(
    (id: string): Promise<Todo> => {
      return withErrorHandling(
        () => unifiedTodoService.toggleTodo(id),
        "TODO 상태 변경",
      );
    },
    [withErrorHandling],
  );

  const deleteTodo = useCallback(
    (id: string): Promise<string> => {
      return withErrorHandling(
        () => unifiedTodoService.deleteTodo(id),
        "TODO 삭제",
      );
    },
    [withErrorHandling],
  );

  const clearAllTodos = useCallback((): Promise<number> => {
    return withErrorHandling(
      () => unifiedTodoService.clearAllTodos(),
      "모든 TODO 삭제",
    );
  }, [withErrorHandling]);

  const clearCompletedTodos = useCallback((): Promise<number> => {
    return withErrorHandling(
      () => unifiedTodoService.clearCompletedTodos(),
      "완료된 TODO 삭제",
    );
  }, [withErrorHandling]);

  // ================================
  // 필터링 및 검색 메서드들
  // ================================

  const getFilteredTodos = useCallback(
    (filter: FilterType): Promise<Todo[]> => {
      return withErrorHandling(
        () => unifiedTodoService.getFilteredTodos(filter),
        "TODO 필터링",
      );
    },
    [withErrorHandling],
  );

  const searchTodos = useCallback(
    (query: string): Promise<Todo[]> => {
      return withErrorHandling(
        () => unifiedTodoService.searchTodos(query),
        "TODO 검색",
      );
    },
    [withErrorHandling],
  );

  const getTodosByPriority = useCallback(
    (priority: Priority): Promise<Todo[]> => {
      return withErrorHandling(
        () => unifiedTodoService.getTodosByPriority(priority),
        "우선순위별 TODO 조회",
      );
    },
    [withErrorHandling],
  );

  const getTodoStats = useCallback((): Promise<TodoStats> => {
    return withErrorHandling(
      () => unifiedTodoService.getTodoStats(),
      "TODO 통계 조회",
    );
  }, [withErrorHandling]);

  // ================================
  // 스토리지 관리 메서드들
  // ================================

  const switchStorageMode = useCallback(
    async (mode: StorageMode): Promise<void> => {
      return withErrorHandling(async () => {
        await unifiedTodoService.switchStorageMode(mode);
        updateStorageMode();
      }, "스토리지 모드 전환");
    },
    [withErrorHandling, updateStorageMode],
  );

  const migrateToAPI = useCallback((): Promise<{
    success: boolean;
    migratedCount: number;
    error?: string;
  }> => {
    return withErrorHandling(async () => {
      const result = await unifiedTodoService.migrateToAPI();
      if (result.success) {
        updateStorageMode();
      }
      return result;
    }, "API 마이그레이션");
  }, [withErrorHandling, updateStorageMode]);

  const syncData = useCallback((): Promise<number> => {
    return withErrorHandling(async () => {
      const result = await unifiedTodoService.syncData();
      await updateSyncStatus();
      return result;
    }, "데이터 동기화");
  }, [withErrorHandling, updateSyncStatus]);

  // ================================
  // 초기화 및 이벤트 리스너
  // ================================

  useEffect(() => {
    // 초기 상태 로드
    refreshServiceState();

    // 온라인/오프라인 상태 감지
    const handleOnline = () => {
      if (appConfig.features.debugMode) {
        console.log("🌐 Network is online");
      }
      updateSyncStatus();
    };

    const handleOffline = () => {
      if (appConfig.features.debugMode) {
        console.log("🌐 Network is offline");
      }
      setServiceState((prev) => ({ ...prev, isSynced: false }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // 주기적 동기화 상태 체크 (API 모드에서만)
    const syncCheckInterval = setInterval(() => {
      if (serviceState.storageMode === StorageMode.API) {
        updateSyncStatus();
      }
    }, 30000); // 30초마다 체크

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(syncCheckInterval);
    };
  }, [refreshServiceState, updateSyncStatus, serviceState.storageMode]);

  // ================================
  // 설정 변화 감지
  // ================================

  useEffect(() => {
    // 앱 설정에 따른 스토리지 모드 자동 전환
    const configStorageMode = appConfig.features.apiMode
      ? StorageMode.API
      : StorageMode.LOCAL_STORAGE;

    if (configStorageMode !== serviceState.storageMode) {
      switchStorageMode(configStorageMode).catch((error) => {
        console.warn("Failed to auto-switch storage mode:", error);
      });
    }
  }, [serviceState.storageMode, switchStorageMode]);

  return {
    serviceState,
    getTodos,
    getTodoById,
    createTodo,
    updateTodo,
    toggleTodo,
    deleteTodo,
    clearAllTodos,
    clearCompletedTodos,
    getFilteredTodos,
    searchTodos,
    getTodosByPriority,
    getTodoStats,
    switchStorageMode,
    migrateToAPI,
    syncData,
    refreshServiceState,
    clearError,
  };
}
