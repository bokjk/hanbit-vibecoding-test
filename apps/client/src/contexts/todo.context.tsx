import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import type { ReactNode } from "react";
import type {
  Todo,
  TodoFilter,
  TodoStats,
  Priority,
  CreateTodoRequest,
  UpdateTodoRequest,
} from "@vive/types";
import { todoReducer, initialTodoState, todoSelectors } from "./todo.reducer";
import type { TodoState, TodoAction, ConnectionStatus } from "./todo.reducer";
import {
  integratedStorage,
  storageUtils,
} from "../services/integrated-storage.service";
import { syncManager } from "../services/sync-manager";
import { useAuthContext } from "./auth.context";

// 유틸리티 함수들
function priorityOrder(priority: Priority): number {
  switch (priority) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function sortTodos(
  todos: Todo[],
  sortBy: TodoFilter["sortBy"],
  sortOrder: TodoFilter["sortOrder"],
): Todo[] {
  const sorted = [...todos].sort((a, b) => {
    let compareValue = 0;

    switch (sortBy) {
      case "createdAt":
        compareValue =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case "priority":
        compareValue = priorityOrder(a.priority) - priorityOrder(b.priority);
        break;
      case "title":
        compareValue = a.title.localeCompare(b.title);
        break;
    }

    return sortOrder === "asc" ? compareValue : -compareValue;
  });

  return sorted;
}

function filterTodos(todos: Todo[], filterType: TodoFilter["type"]): Todo[] {
  switch (filterType) {
    case "active":
      return todos.filter((todo) => !todo.completed);
    case "completed":
      return todos.filter((todo) => todo.completed);
    case "all":
    default:
      return todos;
  }
}

function calculateStats(todos: Todo[]): TodoStats {
  const total = todos.length;
  const completed = todos.filter((todo) => todo.completed).length;
  const active = total - completed;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const byPriority = todos.reduce(
    (acc, todo) => {
      acc[todo.priority] = (acc[todo.priority] || 0) + 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 } as Record<string, number>,
  );

  return {
    total,
    active,
    completed,
    completionRate,
    byPriority: {
      high: byPriority.high || 0,
      medium: byPriority.medium || 0,
      low: byPriority.low || 0,
    },
  };
}

interface TodoContextType {
  state: TodoState;
  dispatch: React.Dispatch<TodoAction>;

  // 계산된 값들
  filteredTodos: Todo[];
  stats: TodoStats;

  // 기본 CRUD 액션 메서드들
  addTodo: (todo: CreateTodoRequest) => Promise<void>;
  updateTodo: (id: string, updates: UpdateTodoRequest) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  toggleTodo: (id: string) => Promise<void>;

  // 상태 관리
  setFilter: (filter: TodoFilter) => void;
  loadTodos: () => Promise<void>;
  clearTodos: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // 동기화 관련 메서드들
  syncData: () => Promise<void>;
  retryFailedOperations: () => Promise<void>;
  clearSyncErrors: () => void;

  // 연결 상태 관리
  setConnectionStatus: (status: ConnectionStatus) => void;
  setOfflineMode: (enabled: boolean) => void;

  // 충돌 해결
  resolveConflict: (
    todoId: string,
    resolution: "local" | "remote",
  ) => Promise<void>;

  // 상태 선택자들 (편의 메서드)
  isOffline: boolean;
  isSyncing: boolean;
  needsSync: boolean;
  hasConflicts: boolean;
  hasSyncErrors: boolean;
  pendingOperationsCount: number;
}

const TodoContext = createContext<TodoContextType | undefined>(undefined);

interface TodoProviderProps {
  children: ReactNode;
  enableAutoSync?: boolean;
}

export function TodoProvider({
  children,
  enableAutoSync = true,
}: TodoProviderProps) {
  const [state, dispatch] = useReducer(todoReducer, initialTodoState);
  const { state: authState } = useAuthContext();
  const isInitialized = useRef(false);
  // const _syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ================================
  // 초기화 및 이벤트 리스너
  // ================================

  useEffect(() => {
    if (!isInitialized.current) {
      initializeTodoContext();
      isInitialized.current = true;
    }
  }, [initializeTodoContext]);

  useEffect(() => {
    // 인증 상태 변경시 TODO 데이터 다시 로드
    if (authState.isInitialized && authState.isAuthenticated) {
      loadTodos();
    }
  }, [authState.isInitialized, authState.isAuthenticated, loadTodos]);

  // 동기화 관리자 이벤트 리스너 등록
  useEffect(() => {
    const handleSyncStart = () => {
      dispatch({ type: "SYNC_START" });
    };

    const handleSyncSuccess = (
      _event: string,
      data: { syncedTodos?: unknown },
    ) => {
      dispatch({
        type: "SYNC_SUCCESS",
        payload: {
          lastSyncAt: new Date(),
          syncedTodos: data?.syncedTodos,
        },
      });
    };

    const handleSyncError = (_event: string, data: { error?: string }) => {
      dispatch({
        type: "SYNC_ERROR",
        payload: data?.error || "Sync failed",
      });
    };

    const handleConnectionChange = (
      _event: string,
      data: { isOnline?: boolean },
    ) => {
      dispatch({
        type: "SET_CONNECTION_STATUS",
        payload: data?.isOnline ? "online" : "offline",
      });
    };

    syncManager.addEventListener("sync_start", handleSyncStart);
    syncManager.addEventListener("sync_success", handleSyncSuccess);
    syncManager.addEventListener("sync_error", handleSyncError);
    syncManager.addEventListener("connection_change", handleConnectionChange);

    return () => {
      syncManager.removeEventListener("sync_start", handleSyncStart);
      syncManager.removeEventListener("sync_success", handleSyncSuccess);
      syncManager.removeEventListener("sync_error", handleSyncError);
      syncManager.removeEventListener(
        "connection_change",
        handleConnectionChange,
      );
    };
  }, []);

  // ================================
  // 초기화 메서드
  // ================================

  const initializeTodoContext = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // 네트워크 상태 설정
      const connectionStatus = navigator.onLine ? "online" : "offline";
      dispatch({ type: "SET_CONNECTION_STATUS", payload: connectionStatus });

      // 초기 데이터 로드
      await loadTodos();

      // 자동 동기화 설정
      if (enableAutoSync) {
        integratedStorage.updateConfig({ autoSync: true });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to initialize todos";
      dispatch({ type: "SET_ERROR", payload: errorMessage });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [enableAutoSync, loadTodos]);

  // ================================
  // 계산된 값들
  // ================================

  const filteredTodos = useMemo(() => {
    const filtered = filterTodos(state.todos, state.filter.type);
    return sortTodos(filtered, state.filter.sortBy, state.filter.sortOrder);
  }, [state.todos, state.filter]);

  const stats = useMemo(() => {
    return calculateStats(state.todos);
  }, [state.todos]);

  // 상태 선택자들
  const isOffline = useMemo(() => todoSelectors.isOffline(state), [state]);
  const isSyncing = useMemo(() => todoSelectors.isSyncing(state), [state]);
  const needsSync = useMemo(() => todoSelectors.needsSync(state), [state]);
  const hasConflicts = useMemo(
    () => todoSelectors.hasConflicts(state),
    [state],
  );
  const hasSyncErrors = useMemo(
    () => todoSelectors.hasSyncErrors(state),
    [state],
  );
  const pendingOperationsCount = useMemo(
    () => todoSelectors.getPendingOperationsCount(state),
    [state],
  );

  // ================================
  // CRUD 액션 메서드들 (통합 스토리지 사용)
  // ================================

  const addTodo = useCallback(async (todoData: CreateTodoRequest) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const result = await integratedStorage.createTodo(todoData);

      if (storageUtils.isSuccess(result)) {
        if (result.isOptimistic) {
          // 낙관적 업데이트
          dispatch({ type: "OPTIMISTIC_ADD_TODO", payload: result.data });
          if (result.operationId) {
            dispatch({
              type: "ADD_PENDING_OPERATION",
              payload: {
                type: "create",
                todoId: result.data.id,
                data: todoData,
              },
            });
          }
        } else {
          // 서버 확정 응답
          dispatch({ type: "ADD_TODO", payload: todoData });
        }
      } else {
        throw new Error(storageUtils.getErrorMessage(result));
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to add todo";
      dispatch({ type: "SET_ERROR", payload: errorMessage });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  const updateTodo = useCallback(
    async (id: string, updates: UpdateTodoRequest) => {
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        const result = await integratedStorage.updateTodo(id, updates);

        if (storageUtils.isSuccess(result)) {
          if (result.isOptimistic) {
            // 낙관적 업데이트
            dispatch({ type: "OPTIMISTIC_UPDATE_TODO", payload: result.data });
            if (result.operationId) {
              dispatch({
                type: "ADD_PENDING_OPERATION",
                payload: { type: "update", todoId: id, data: updates },
              });
            }
          } else {
            // 서버 확정 응답
            dispatch({ type: "UPDATE_TODO", payload: result.data });
          }
        } else {
          throw new Error(storageUtils.getErrorMessage(result));
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to update todo";
        dispatch({ type: "SET_ERROR", payload: errorMessage });
      }
    },
    [],
  );

  const deleteTodo = useCallback(async (id: string) => {
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const result = await integratedStorage.deleteTodo(id);

      if (result.success || result.isOptimistic) {
        if (result.isOptimistic) {
          // 낙관적 업데이트 (이미 삭제됨)
          dispatch({ type: "OPTIMISTIC_DELETE_TODO", payload: id });
          if (result.operationId) {
            dispatch({
              type: "ADD_PENDING_OPERATION",
              payload: { type: "delete", todoId: id },
            });
          }
        } else {
          // 서버 확정 응답
          dispatch({ type: "DELETE_TODO", payload: id });
        }
      } else {
        throw new Error(storageUtils.getErrorMessage(result));
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete todo";
      dispatch({ type: "SET_ERROR", payload: errorMessage });
    }
  }, []);

  const toggleTodo = useCallback(
    async (id: string) => {
      const todo = state.todos.find((t) => t.id === id);
      if (!todo) {
        dispatch({ type: "SET_ERROR", payload: "Todo not found" });
        return;
      }

      await updateTodo(id, { completed: !todo.completed });
    },
    [state.todos, updateTodo],
  );

  // ================================
  // 상태 관리 메서드들
  // ================================

  const setFilter = useCallback((filter: TodoFilter) => {
    dispatch({ type: "SET_FILTER", payload: filter });
  }, []);

  const loadTodos = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const result = await integratedStorage.getTodos();

      if (storageUtils.isSuccess(result)) {
        dispatch({ type: "LOAD_TODOS", payload: result.data });
      } else {
        // 부분적 실패 (로컬 데이터라도 로드)
        const localData = storageUtils.getData(result);
        if (localData) {
          dispatch({ type: "LOAD_TODOS", payload: localData });
        }

        if (result.error) {
          dispatch({ type: "ADD_SYNC_ERROR", payload: result.error });
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load todos";
      dispatch({ type: "SET_ERROR", payload: errorMessage });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  const clearTodos = useCallback(() => {
    dispatch({ type: "CLEAR_TODOS" });
    integratedStorage.clearLocalData();
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: "SET_LOADING", payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: "SET_ERROR", payload: error });
  }, []);

  // ================================
  // 동기화 관련 메서드들
  // ================================

  const syncData = useCallback(async () => {
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const result = await integratedStorage.syncData();

      if (!result.success) {
        dispatch({
          type: "ADD_SYNC_ERROR",
          payload: result.error || "Sync failed",
        });
      } else {
        // 동기화 성공 후 데이터 다시 로드
        await loadTodos();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Sync failed";
      dispatch({ type: "ADD_SYNC_ERROR", payload: errorMessage });
    }
  }, [loadTodos]);

  const retryFailedOperations = useCallback(async () => {
    await syncData();
  }, [syncData]);

  const clearSyncErrors = useCallback(() => {
    dispatch({ type: "CLEAR_SYNC_ERRORS" });
  }, []);

  // ================================
  // 연결 상태 관리
  // ================================

  const setConnectionStatus = useCallback((status: ConnectionStatus) => {
    dispatch({ type: "SET_CONNECTION_STATUS", payload: status });
  }, []);

  const setOfflineMode = useCallback((enabled: boolean) => {
    dispatch({ type: "SET_OFFLINE_MODE", payload: enabled });
    integratedStorage.updateConfig({ offlineMode: enabled });
  }, []);

  // ================================
  // 충돌 해결
  // ================================

  const resolveConflict = useCallback(
    async (todoId: string, resolution: "local" | "remote") => {
      void resolution; // 현재 미구현으로 사용되지 않음
      const conflict = state.conflictedTodos.find((c) => c.id === todoId);
      if (!conflict) {
        return;
      }

      try {
        // TODO: syncManager.resolveConflict 구현 필요
        // const success = await syncManager.resolveConflict(todoId, resolution, conflict);

        // 임시로 충돌 제거
        dispatch({ type: "RESOLVE_CONFLICTED_TODO", payload: todoId });

        // 데이터 다시 로드
        await loadTodos();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to resolve conflict";
        dispatch({ type: "SET_ERROR", payload: errorMessage });
      }
    },
    [state.conflictedTodos, loadTodos],
  );

  // ================================
  // Context 값 생성
  // ================================

  const value: TodoContextType = {
    state,
    dispatch,
    filteredTodos,
    stats,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
    setFilter,
    loadTodos,
    clearTodos,
    setLoading,
    setError,
    syncData,
    retryFailedOperations,
    clearSyncErrors,
    setConnectionStatus,
    setOfflineMode,
    resolveConflict,
    isOffline,
    isSyncing,
    needsSync,
    hasConflicts,
    hasSyncErrors,
    pendingOperationsCount,
  };

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTodoContext(): TodoContextType {
  const context = useContext(TodoContext);
  if (context === undefined) {
    throw new Error("useTodoContext must be used within a TodoProvider");
  }
  return context;
}
