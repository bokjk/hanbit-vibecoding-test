import { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Todo, TodoFilter, TodoStats, Priority } from 'types/index';
import { todoReducer } from './todo.reducer';
import type { TodoState, TodoAction } from './todo.reducer';

const initialState: TodoState = {
  todos: [],
  filter: {
    type: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },
  loading: false,
  error: null,
};

// 유틸리티 함수들
function priorityOrder(priority: Priority): number {
  switch (priority) {
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

function sortTodos(todos: Todo[], sortBy: TodoFilter['sortBy'], sortOrder: TodoFilter['sortOrder']): Todo[] {
  const sorted = [...todos].sort((a, b) => {
    let compareValue = 0;
    
    switch (sortBy) {
      case 'createdAt':
        compareValue = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'priority':
        compareValue = priorityOrder(a.priority) - priorityOrder(b.priority);
        break;
      case 'title':
        compareValue = a.title.localeCompare(b.title);
        break;
    }
    
    return sortOrder === 'asc' ? compareValue : -compareValue;
  });
  
  return sorted;
}

function filterTodos(todos: Todo[], filterType: TodoFilter['type']): Todo[] {
  switch (filterType) {
    case 'active':
      return todos.filter(todo => !todo.completed);
    case 'completed':
      return todos.filter(todo => todo.completed);
    case 'all':
    default:
      return todos;
  }
}

function calculateStats(todos: Todo[]): TodoStats {
  const total = todos.length;
  const completed = todos.filter(todo => todo.completed).length;
  const active = total - completed;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  return {
    total,
    active,
    completed,
    completionRate,
  };
}

interface TodoContextType {
  state: TodoState;
  dispatch: React.Dispatch<TodoAction>;
  // 계산된 값들
  filteredTodos: Todo[];
  stats: TodoStats;
  // 액션 메서드들
  addTodo: (todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'completed'>) => void;
  updateTodo: (todo: Todo) => void;
  deleteTodo: (id: string) => void;
  toggleTodo: (id: string) => void;
  setFilter: (filter: TodoFilter) => void;
  loadTodos: (todos: Todo[]) => void;
  clearTodos: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const TodoContext = createContext<TodoContextType | undefined>(undefined);

interface TodoProviderProps {
  children: ReactNode;
}

export function TodoProvider({ children }: TodoProviderProps) {
  const [state, dispatch] = useReducer(todoReducer, initialState);

  // 계산된 값들
  const filteredTodos = useMemo(() => {
    const filtered = filterTodos(state.todos, state.filter.type);
    return sortTodos(filtered, state.filter.sortBy, state.filter.sortOrder);
  }, [state.todos, state.filter]);

  const stats = useMemo(() => {
    return calculateStats(state.todos);
  }, [state.todos]);

  // 액션 메서드들
  const addTodo = useCallback((todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'completed'>) => {
    dispatch({ type: 'ADD_TODO', payload: todo });
  }, []);

  const updateTodo = useCallback((todo: Todo) => {
    dispatch({ type: 'UPDATE_TODO', payload: todo });
  }, []);

  const deleteTodo = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TODO', payload: id });
  }, []);

  const toggleTodo = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_TODO', payload: id });
  }, []);

  const setFilter = useCallback((filter: TodoFilter) => {
    dispatch({ type: 'SET_FILTER', payload: filter });
  }, []);

  const loadTodos = useCallback((todos: Todo[]) => {
    dispatch({ type: 'LOAD_TODOS', payload: todos });
  }, []);

  const clearTodos = useCallback(() => {
    dispatch({ type: 'CLEAR_TODOS' });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

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
  };

  return (
    <TodoContext.Provider value={value}>
      {children}
    </TodoContext.Provider>
  );
}

export function useTodoContext(): TodoContextType {
  const context = useContext(TodoContext);
  if (context === undefined) {
    throw new Error('useTodoContext must be used within a TodoProvider');
  }
  return context;
}