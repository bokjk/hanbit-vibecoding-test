import type { Todo, TodoFilter } from "@vive/types";

/**
 * 대기 중인 작업 (낙관적 업데이트용)
 */
export interface PendingOperation {
  id: string;
  type: "create" | "update" | "delete";
  todoId: string;
  timestamp: Date;
  retryCount: number;
  data?: unknown;
}

/**
 * 동기화 상태
 */
export type SyncStatus = "idle" | "syncing" | "error" | "success";

/**
 * 연결 상태
 */
export type ConnectionStatus = "online" | "offline" | "unknown";

/**
 * 확장된 TODO 상태
 */
export interface TodoState {
  // 기존 상태
  todos: Todo[];
  filter: TodoFilter;
  loading: boolean;
  error: string | null;

  // 동기화 관련 새로운 상태
  syncStatus: SyncStatus;
  lastSyncAt: Date | null;
  pendingOperations: PendingOperation[];
  connectionStatus: ConnectionStatus;

  // 추가 메타데이터
  isOfflineMode: boolean;
  conflictedTodos: Todo[]; // 충돌이 발생한 TODO들
  syncErrors: string[]; // 동기화 오류 목록
}

/**
 * 확장된 TODO 액션
 */
export type TodoAction =
  // 기존 액션들
  | {
      type: "ADD_TODO";
      payload: Omit<Todo, "id" | "createdAt" | "updatedAt" | "completed">;
    }
  | { type: "UPDATE_TODO"; payload: Todo }
  | { type: "DELETE_TODO"; payload: string }
  | { type: "TOGGLE_TODO"; payload: string }
  | { type: "SET_FILTER"; payload: TodoFilter }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "LOAD_TODOS"; payload: Todo[] }
  | { type: "CLEAR_TODOS" }

  // 동기화 관련 새로운 액션들
  | { type: "SYNC_START" }
  | {
      type: "SYNC_SUCCESS";
      payload: { lastSyncAt: Date; syncedTodos?: Todo[] };
    }
  | { type: "SYNC_ERROR"; payload: string }
  | { type: "SET_SYNC_STATUS"; payload: SyncStatus }
  | {
      type: "ADD_PENDING_OPERATION";
      payload: Omit<PendingOperation, "id" | "timestamp" | "retryCount">;
    }
  | { type: "REMOVE_PENDING_OPERATION"; payload: string }
  | {
      type: "UPDATE_PENDING_OPERATION";
      payload: { id: string; retryCount: number };
    }
  | { type: "CLEAR_PENDING_OPERATIONS" }
  | { type: "SET_CONNECTION_STATUS"; payload: ConnectionStatus }
  | { type: "SET_OFFLINE_MODE"; payload: boolean }
  | { type: "ADD_CONFLICTED_TODO"; payload: Todo }
  | { type: "RESOLVE_CONFLICTED_TODO"; payload: string }
  | { type: "CLEAR_CONFLICTED_TODOS" }
  | { type: "ADD_SYNC_ERROR"; payload: string }
  | { type: "CLEAR_SYNC_ERRORS" }

  // 낙관적 업데이트 관련
  | { type: "OPTIMISTIC_ADD_TODO"; payload: Todo }
  | { type: "OPTIMISTIC_UPDATE_TODO"; payload: Todo }
  | { type: "OPTIMISTIC_DELETE_TODO"; payload: string }
  | {
      type: "ROLLBACK_OPTIMISTIC_OPERATION";
      payload: { operationId: string; previousState?: Todo[] };
    };

/**
 * 확장된 초기 상태
 */
const extendedInitialState: TodoState = {
  // 기존 상태
  todos: [],
  filter: {
    type: "all",
    sortBy: "createdAt",
    sortOrder: "desc",
  },
  loading: false,
  error: null,

  // 동기화 관련 새로운 상태
  syncStatus: "idle",
  lastSyncAt: null,
  pendingOperations: [],
  connectionStatus: "unknown",

  // 추가 메타데이터
  isOfflineMode: false,
  conflictedTodos: [],
  syncErrors: [],
};

export function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    // ================================
    // 기존 TODO CRUD 액션들
    // ================================

    case "ADD_TODO": {
      const newTodo: Todo = {
        ...action.payload,
        id: crypto.randomUUID(),
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return {
        ...state,
        todos: [...state.todos, newTodo],
      };
    }

    case "UPDATE_TODO": {
      const todoIndex = state.todos.findIndex(
        (todo) => todo.id === action.payload.id,
      );
      if (todoIndex === -1) {
        return state;
      }

      const updatedTodos = [...state.todos];
      updatedTodos[todoIndex] = {
        ...action.payload,
        updatedAt: new Date().toISOString(),
      };

      return {
        ...state,
        todos: updatedTodos,
      };
    }

    case "DELETE_TODO":
      return {
        ...state,
        todos: state.todos.filter((todo) => todo.id !== action.payload),
      };

    case "TOGGLE_TODO":
      return {
        ...state,
        todos: state.todos.map((todo) =>
          todo.id === action.payload
            ? {
                ...todo,
                completed: !todo.completed,
                updatedAt: new Date().toISOString(),
              }
            : todo,
        ),
      };

    case "SET_FILTER":
      return {
        ...state,
        filter: action.payload,
      };

    case "SET_LOADING":
      return {
        ...state,
        loading: action.payload,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
      };

    case "LOAD_TODOS":
      return {
        ...state,
        todos: action.payload,
      };

    case "CLEAR_TODOS":
      return {
        ...state,
        todos: [],
      };

    // ================================
    // 동기화 관련 새로운 액션들
    // ================================

    case "SYNC_START":
      return {
        ...state,
        syncStatus: "syncing",
        error: null,
      };

    case "SYNC_SUCCESS":
      return {
        ...state,
        syncStatus: "success",
        lastSyncAt: action.payload.lastSyncAt,
        // 동기화된 TODO가 있으면 업데이트
        todos: action.payload.syncedTodos || state.todos,
        // 성공 시 대기 중인 작업들과 에러 정리
        pendingOperations: [],
        syncErrors: [],
        error: null,
      };

    case "SYNC_ERROR":
      return {
        ...state,
        syncStatus: "error",
        error: action.payload,
        syncErrors: [...state.syncErrors, action.payload],
      };

    case "SET_SYNC_STATUS":
      return {
        ...state,
        syncStatus: action.payload,
      };

    // ================================
    // 대기 중인 작업 관리
    // ================================

    case "ADD_PENDING_OPERATION": {
      const newOperation: PendingOperation = {
        ...action.payload,
        id: crypto.randomUUID(),
        timestamp: new Date(),
        retryCount: 0,
      };

      return {
        ...state,
        pendingOperations: [...state.pendingOperations, newOperation],
      };
    }

    case "REMOVE_PENDING_OPERATION":
      return {
        ...state,
        pendingOperations: state.pendingOperations.filter(
          (op) => op.id !== action.payload,
        ),
      };

    case "UPDATE_PENDING_OPERATION":
      return {
        ...state,
        pendingOperations: state.pendingOperations.map((op) =>
          op.id === action.payload.id
            ? { ...op, retryCount: action.payload.retryCount }
            : op,
        ),
      };

    case "CLEAR_PENDING_OPERATIONS":
      return {
        ...state,
        pendingOperations: [],
      };

    // ================================
    // 연결 상태 및 오프라인 모드
    // ================================

    case "SET_CONNECTION_STATUS":
      return {
        ...state,
        connectionStatus: action.payload,
        // 온라인으로 돌아오면 오프라인 모드 해제
        isOfflineMode:
          action.payload === "offline" ? true : state.isOfflineMode,
      };

    case "SET_OFFLINE_MODE":
      return {
        ...state,
        isOfflineMode: action.payload,
      };

    // ================================
    // 충돌 관리
    // ================================

    case "ADD_CONFLICTED_TODO":
      return {
        ...state,
        conflictedTodos: [...state.conflictedTodos, action.payload],
      };

    case "RESOLVE_CONFLICTED_TODO":
      return {
        ...state,
        conflictedTodos: state.conflictedTodos.filter(
          (todo) => todo.id !== action.payload,
        ),
      };

    case "CLEAR_CONFLICTED_TODOS":
      return {
        ...state,
        conflictedTodos: [],
      };

    // ================================
    // 동기화 에러 관리
    // ================================

    case "ADD_SYNC_ERROR":
      return {
        ...state,
        syncErrors: [...state.syncErrors, action.payload],
      };

    case "CLEAR_SYNC_ERRORS":
      return {
        ...state,
        syncErrors: [],
      };

    // ================================
    // 낙관적 업데이트 관련
    // ================================

    case "OPTIMISTIC_ADD_TODO":
      return {
        ...state,
        todos: [...state.todos, action.payload],
      };

    case "OPTIMISTIC_UPDATE_TODO": {
      const optimisticUpdateIndex = state.todos.findIndex(
        (todo) => todo.id === action.payload.id,
      );
      if (optimisticUpdateIndex === -1) {
        return state;
      }

      const optimisticUpdatedTodos = [...state.todos];
      optimisticUpdatedTodos[optimisticUpdateIndex] = action.payload;

      return {
        ...state,
        todos: optimisticUpdatedTodos,
      };
    }

    case "OPTIMISTIC_DELETE_TODO":
      return {
        ...state,
        todos: state.todos.filter((todo) => todo.id !== action.payload),
      };

    case "ROLLBACK_OPTIMISTIC_OPERATION":
      // 이전 상태가 제공된 경우 롤백
      if (action.payload.previousState) {
        return {
          ...state,
          todos: action.payload.previousState,
        };
      }

      // 대기 중인 작업에서 해당 작업 제거
      return {
        ...state,
        pendingOperations: state.pendingOperations.filter(
          (op) => op.id !== action.payload.operationId,
        ),
      };

    default:
      return state;
  }
}

/**
 * 확장된 초기 상태 내보내기
 */
export { extendedInitialState as initialTodoState };

/**
 * 상태 선택자들 (헬퍼 함수들)
 */
export const todoSelectors = {
  /**
   * 동기화가 필요한지 확인
   */
  needsSync: (state: TodoState): boolean => {
    return (
      state.pendingOperations.length > 0 ||
      state.syncStatus === "error" ||
      (state.connectionStatus === "online" && state.lastSyncAt === null)
    );
  },

  /**
   * 오프라인 상태인지 확인
   */
  isOffline: (state: TodoState): boolean => {
    return state.connectionStatus === "offline" || state.isOfflineMode;
  },

  /**
   * 동기화 중인지 확인
   */
  isSyncing: (state: TodoState): boolean => {
    return state.syncStatus === "syncing";
  },

  /**
   * 충돌이 있는지 확인
   */
  hasConflicts: (state: TodoState): boolean => {
    return state.conflictedTodos.length > 0;
  },

  /**
   * 동기화 에러가 있는지 확인
   */
  hasSyncErrors: (state: TodoState): boolean => {
    return state.syncErrors.length > 0;
  },

  /**
   * 대기 중인 작업 개수
   */
  getPendingOperationsCount: (state: TodoState): number => {
    return state.pendingOperations.length;
  },

  /**
   * 마지막 동기화 시간부터 경과 시간 (분 단위)
   */
  getTimeSinceLastSync: (state: TodoState): number | null => {
    if (!state.lastSyncAt) return null;
    return Math.floor((Date.now() - state.lastSyncAt.getTime()) / (1000 * 60));
  },

  /**
   * 연결 상태 표시 텍스트
   */
  getConnectionStatusText: (state: TodoState): string => {
    switch (state.connectionStatus) {
      case "online":
        return "온라인";
      case "offline":
        return "오프라인";
      default:
        return "연결 상태 확인 중";
    }
  },

  /**
   * 동기화 상태 표시 텍스트
   */
  getSyncStatusText: (state: TodoState): string => {
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
};
