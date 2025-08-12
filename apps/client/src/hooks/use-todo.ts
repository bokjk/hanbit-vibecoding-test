/**
 * TODO 관련 커스텀 훅
 *
 * TodoContext의 복잡한 비즈니스 로직을 캡슐화하고,
 * 컴포넌트에서 사용하기 편한 인터페이스를 제공합니다.
 */

import { useCallback, useMemo } from "react";
import type {
  CreateTodoRequest,
  UpdateTodoRequest,
  Priority,
} from "types/index";
import { useTodoContext } from "../contexts/todo.context";
import { useAuthContext } from "../contexts/auth.context";

/**
 * TODO 생성 시 옵션
 */
export interface CreateTodoOptions {
  priority?: Priority;
  dueDate?: string;
  tags?: string[];
  description?: string;
}

/**
 * TODO 업데이트 시 옵션
 */
export interface UpdateTodoOptions {
  title?: string;
  description?: string;
  priority?: Priority;
  dueDate?: string;
  tags?: string[];
  completed?: boolean;
}

/**
 * 필터링 관련 편의 메서드들
 */
export interface FilterHelpers {
  showAll: () => void;
  showActive: () => void;
  showCompleted: () => void;
  sortByCreatedAt: (order?: "asc" | "desc") => void;
  sortByPriority: (order?: "asc" | "desc") => void;
  sortByTitle: (order?: "asc" | "desc") => void;
}

/**
 * 동기화 관련 헬퍼
 */
export interface SyncHelpers {
  triggerSync: () => Promise<void>;
  retrySync: () => Promise<void>;
  clearErrors: () => void;
  toggleOfflineMode: () => void;
  getConnectionStatusText: () => string;
  getSyncStatusText: () => string;
  getLastSyncText: () => string;
}

/**
 * TODO 관련 메타데이터 및 통계
 */
export interface TodoMetadata {
  totalCount: number;
  activeCount: number;
  completedCount: number;
  completionRate: number;
  pendingOperations: number;
  isOnline: boolean;
  isSyncing: boolean;
  hasErrors: boolean;
  hasConflicts: boolean;
}

/**
 * useTodo 반환 타입
 */
export interface UseTodoReturn {
  // 기본 데이터
  todos: ReturnType<typeof useTodoContext>["filteredTodos"];
  stats: ReturnType<typeof useTodoContext>["stats"];
  loading: boolean;
  error: string | null;

  // CRUD 작업
  addTodo: (title: string, options?: CreateTodoOptions) => Promise<void>;
  updateTodo: (id: string, options: UpdateTodoOptions) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  toggleTodo: (id: string) => Promise<void>;

  // 필터링 헬퍼
  filter: FilterHelpers;

  // 동기화 헬퍼
  sync: SyncHelpers;

  // 메타데이터
  metadata: TodoMetadata;

  // 권한 확인
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

/**
 * TODO 관련 모든 기능을 제공하는 메인 커스텀 훅
 */
export function useTodo(): UseTodoReturn {
  const todoContext = useTodoContext();
  const authContext = useAuthContext();

  const {
    state,
    filteredTodos,
    stats,
    addTodo: contextAddTodo,
    updateTodo: contextUpdateTodo,
    deleteTodo: contextDeleteTodo,
    toggleTodo: contextToggleTodo,
    setFilter,
    syncData,
    retryFailedOperations,
    clearSyncErrors,
    setOfflineMode,
    isOffline,
    isSyncing,
    // needsSync: _needsSync, // TODO: 동기화 기능 완성 후 사용
    hasConflicts,
    hasSyncErrors,
    pendingOperationsCount,
  } = todoContext;

  // ================================
  // 기본 데이터 및 상태
  // ================================

  const todos = filteredTodos;
  const loading = state.loading;
  const error = state.error;

  // ================================
  // CRUD 작업 (간소화된 인터페이스)
  // ================================

  const addTodo = useCallback(
    async (title: string, options: CreateTodoOptions = {}) => {
      const todoData: CreateTodoRequest = {
        title,
        description: options.description,
        priority: options.priority || "medium",
        dueDate: options.dueDate,
        tags: options.tags,
        userId:
          authContext.state.user?.id || authContext.state.guestId || "guest",
      };

      await contextAddTodo(todoData);
    },
    [contextAddTodo, authContext.state.user?.id, authContext.state.guestId],
  );

  const updateTodo = useCallback(
    async (id: string, options: UpdateTodoOptions) => {
      const updates: UpdateTodoRequest = {
        ...(options.title !== undefined && { title: options.title }),
        ...(options.description !== undefined && {
          description: options.description,
        }),
        ...(options.priority !== undefined && { priority: options.priority }),
        ...(options.dueDate !== undefined && { dueDate: options.dueDate }),
        ...(options.tags !== undefined && { tags: options.tags }),
        ...(options.completed !== undefined && {
          completed: options.completed,
        }),
      };

      await contextUpdateTodo(id, updates);
    },
    [contextUpdateTodo],
  );

  const deleteTodo = useCallback(
    async (id: string) => {
      await contextDeleteTodo(id);
    },
    [contextDeleteTodo],
  );

  const toggleTodo = useCallback(
    async (id: string) => {
      await contextToggleTodo(id);
    },
    [contextToggleTodo],
  );

  // ================================
  // 필터링 헬퍼 메서드들
  // ================================

  const filter = useMemo<FilterHelpers>(
    () => ({
      showAll: () => {
        setFilter({ ...state.filter, type: "all" });
      },

      showActive: () => {
        setFilter({ ...state.filter, type: "active" });
      },

      showCompleted: () => {
        setFilter({ ...state.filter, type: "completed" });
      },

      sortByCreatedAt: (order: "asc" | "desc" = "desc") => {
        setFilter({ ...state.filter, sortBy: "createdAt", sortOrder: order });
      },

      sortByPriority: (order: "asc" | "desc" = "desc") => {
        setFilter({ ...state.filter, sortBy: "priority", sortOrder: order });
      },

      sortByTitle: (order: "asc" | "desc" = "asc") => {
        setFilter({ ...state.filter, sortBy: "title", sortOrder: order });
      },
    }),
    [state.filter, setFilter],
  );

  // ================================
  // 동기화 헬퍼 메서드들
  // ================================

  const sync = useMemo<SyncHelpers>(
    () => ({
      triggerSync: syncData,

      retrySync: retryFailedOperations,

      clearErrors: clearSyncErrors,

      toggleOfflineMode: () => {
        setOfflineMode(!state.isOfflineMode);
      },

      getConnectionStatusText: () => {
        switch (state.connectionStatus) {
          case "online":
            return "온라인";
          case "offline":
            return "오프라인";
          default:
            return "연결 확인 중";
        }
      },

      getSyncStatusText: () => {
        switch (state.syncStatus) {
          case "idle":
            return "대기 중";
          case "syncing":
            return "동기화 중";
          case "success":
            return "동기화 완료";
          case "error":
            return "동기화 오류";
          default:
            return "알 수 없음";
        }
      },

      getLastSyncText: () => {
        if (!state.lastSyncAt) {
          return "동기화 기록 없음";
        }

        const now = new Date();
        const lastSync = new Date(state.lastSyncAt);
        const diffMs = now.getTime() - lastSync.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) {
          return "방금 전";
        } else if (diffMins < 60) {
          return `${diffMins}분 전`;
        } else if (diffHours < 24) {
          return `${diffHours}시간 전`;
        } else {
          return `${diffDays}일 전`;
        }
      },
    }),
    [
      syncData,
      retryFailedOperations,
      clearSyncErrors,
      setOfflineMode,
      state.isOfflineMode,
      state.connectionStatus,
      state.syncStatus,
      state.lastSyncAt,
    ],
  );

  // ================================
  // 메타데이터 및 통계
  // ================================

  const metadata = useMemo<TodoMetadata>(
    () => ({
      totalCount: stats.total,
      activeCount: stats.active,
      completedCount: stats.completed,
      completionRate: stats.completionRate,
      pendingOperations: pendingOperationsCount,
      isOnline: !isOffline,
      isSyncing,
      hasErrors: hasSyncErrors || !!error,
      hasConflicts,
    }),
    [
      stats,
      pendingOperationsCount,
      isOffline,
      isSyncing,
      hasSyncErrors,
      error,
      hasConflicts,
    ],
  );

  // ================================
  // 권한 확인
  // ================================

  const canCreate = useMemo(() => {
    return authContext.canCreateTodos();
  }, [authContext]);

  const canUpdate = useMemo(() => {
    return authContext.canUpdateTodos();
  }, [authContext]);

  const canDelete = useMemo(() => {
    return authContext.canDeleteTodos();
  }, [authContext]);

  // ================================
  // 반환 값
  // ================================

  return {
    todos,
    stats,
    loading,
    error,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
    filter,
    sync,
    metadata,
    canCreate,
    canUpdate,
    canDelete,
  };
}

/**
 * TODO 목록을 위한 최적화된 훅 (읽기 전용)
 */
export function useTodoList() {
  const { todos, stats, loading, error, metadata, filter } = useTodo();

  return {
    todos,
    stats,
    loading,
    error,
    metadata,
    filter,
  };
}

/**
 * 단일 TODO 관리를 위한 훅
 */
export function useSingleTodo(todoId: string) {
  const { todos, updateTodo, deleteTodo, toggleTodo, canUpdate, canDelete } =
    useTodo();

  const todo = useMemo(() => {
    return todos.find((t) => t.id === todoId) || null;
  }, [todos, todoId]);

  const updateThisTodo = useCallback(
    async (options: UpdateTodoOptions) => {
      await updateTodo(todoId, options);
    },
    [updateTodo, todoId],
  );

  const deleteThisTodo = useCallback(async () => {
    await deleteTodo(todoId);
  }, [deleteTodo, todoId]);

  const toggleThisTodo = useCallback(async () => {
    await toggleTodo(todoId);
  }, [toggleTodo, todoId]);

  return {
    todo,
    updateTodo: updateThisTodo,
    deleteTodo: deleteThisTodo,
    toggleTodo: toggleThisTodo,
    canUpdate,
    canDelete,
  };
}

/**
 * 동기화 상태만 필요한 경우를 위한 경량 훅
 */
export function useTodoSync() {
  const { sync, metadata } = useTodo();

  return {
    ...sync,
    isOnline: metadata.isOnline,
    isSyncing: metadata.isSyncing,
    hasErrors: metadata.hasErrors,
    hasConflicts: metadata.hasConflicts,
    pendingOperations: metadata.pendingOperations,
  };
}

/**
 * TODO 통계만 필요한 경우를 위한 훅
 */
export function useTodoStats() {
  const { stats, metadata } = useTodo();

  return {
    ...stats,
    ...metadata,
  };
}

/**
 * TODO 작성 폼을 위한 특별한 훅
 */
export function useTodoForm() {
  const { addTodo, canCreate, loading } = useTodo();

  const createTodo = useCallback(
    async (title: string, options: CreateTodoOptions = {}) => {
      if (!canCreate) {
        throw new Error("권한이 없습니다");
      }

      if (!title.trim()) {
        throw new Error("제목을 입력해주세요");
      }

      await addTodo(title.trim(), options);
    },
    [addTodo, canCreate],
  );

  return {
    createTodo,
    canCreate,
    loading,
  };
}
