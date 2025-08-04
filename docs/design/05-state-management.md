# 5. 상태 관리 설계

## 5.1 Context 구조

```typescript
interface TodoContextType {
  state: AppState;
  dispatch: React.Dispatch<TodoAction>;
  // 편의 메서드들
  addTodo: (title: string, priority: Priority) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  editTodo: (id: string, title: string) => void;
  setFilter: (filter: TodoFilter) => void;
}
```

## 5.2 Reducer Actions

```typescript
type TodoAction =
  | { type: 'ADD_TODO'; payload: { title: string; priority: Priority } }
  | { type: 'TOGGLE_TODO'; payload: { id: string } }
  | { type: 'DELETE_TODO'; payload: { id: string } }
  | { type: 'EDIT_TODO'; payload: { id: string; title: string } }
  | { type: 'SET_FILTER'; payload: TodoFilter }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'LOAD_TODOS'; payload: Todo[] }
  // 2단계: 인증 관련 액션들
  | { type: 'SET_AUTH_STATE'; payload: AuthState }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'SYNC_START' }
  | { type: 'SYNC_SUCCESS'; payload: { lastSyncAt: string } }
  | { type: 'SYNC_ERROR'; payload: string };
```

## 5.3 Custom Hooks

### 5.3.1 useTodos Hook
```typescript
const useTodos = () => {
  const context = useContext(TodoContext);
  if (!context) {
    throw new Error('useTodos must be used within TodoProvider');
  }
  
  const { state, dispatch, addTodo, toggleTodo, deleteTodo, editTodo } = context;
  
  // 필터된 할 일 목록 계산
  const filteredTodos = useMemo(() => {
    return filterAndSortTodos(state.todos, state.filter);
  }, [state.todos, state.filter]);
  
  // 통계 계산
  const stats = useMemo(() => ({
    total: state.todos.length,
    active: state.todos.filter(todo => !todo.completed).length,
    completed: state.todos.filter(todo => todo.completed).length,
  }), [state.todos]);
  
  return {
    todos: filteredTodos,
    stats,
    filter: state.filter,
    loading: state.loading,
    error: state.error,
    addTodo,
    toggleTodo,
    deleteTodo,
    editTodo,
    setFilter: (filter: TodoFilter) => dispatch({ type: 'SET_FILTER', payload: filter }),
  };
};
```

### 5.3.2 useLocalStorage Hook
```typescript
const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });
  
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);
  
  return [storedValue, setValue] as const;
};
```

### 5.3.3 useTodoFilters Hook
```typescript
const useTodoFilters = () => {
  const filterAndSortTodos = useCallback((todos: Todo[], filter: TodoFilter): Todo[] => {
    let filtered = todos;
    
    // 완료 상태별 필터링
    switch (filter.type) {
      case FilterType.ACTIVE:
        filtered = todos.filter(todo => !todo.completed);
        break;
      case FilterType.COMPLETED:
        filtered = todos.filter(todo => todo.completed);
        break;
      default:
        filtered = todos;
    }
    
    // 정렬
    filtered.sort((a, b) => {
      switch (filter.sortBy) {
        case SortBy.CREATED_DATE:
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return filter.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
          
        case SortBy.PRIORITY:
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          const priorityA = priorityOrder[a.priority];
          const priorityB = priorityOrder[b.priority];
          return filter.sortOrder === 'asc' ? priorityA - priorityB : priorityB - priorityA;
          
        case SortBy.TITLE:
          return filter.sortOrder === 'asc' 
            ? a.title.localeCompare(b.title)
            : b.title.localeCompare(a.title);
            
        default:
          return 0;
      }
    });
    
    return filtered;
  }, []);
  
  return { filterAndSortTodos };
};
```

## 5.4 Reducer 구현

```typescript
const todoReducer = (state: AppState, action: TodoAction): AppState => {
  switch (action.type) {
    case 'ADD_TODO':
      const newTodo: Todo = {
        id: generateId(),
        title: action.payload.title,
        priority: action.payload.priority,
        completed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // 2단계에서 추가될 필드들
        userId: state.auth.user?.id || '',
        isGuest: state.auth.isGuest,
        sessionId: state.auth.isGuest ? generateSessionId() : undefined,
      };
      
      return {
        ...state,
        todos: [...state.todos, newTodo],
      };
      
    case 'TOGGLE_TODO':
      return {
        ...state,
        todos: state.todos.map(todo =>
          todo.id === action.payload.id
            ? { ...todo, completed: !todo.completed, updatedAt: new Date().toISOString() }
            : todo
        ),
      };
      
    case 'DELETE_TODO':
      return {
        ...state,
        todos: state.todos.filter(todo => todo.id !== action.payload.id),
      };
      
    case 'EDIT_TODO':
      return {
        ...state,
        todos: state.todos.map(todo =>
          todo.id === action.payload.id
            ? { ...todo, title: action.payload.title, updatedAt: new Date().toISOString() }
            : todo
        ),
      };
      
    case 'SET_FILTER':
      return {
        ...state,
        filter: action.payload,
      };
      
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
      };
      
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };
      
    case 'LOAD_TODOS':
      return {
        ...state,
        todos: action.payload,
        loading: false,
      };
      
    // 2단계: 인증 관련 케이스들
    case 'SET_AUTH_STATE':
      return {
        ...state,
        auth: action.payload,
      };
      
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        auth: {
          ...state.auth,
          isAuthenticated: true,
          isGuest: false,
          user: action.payload,
        },
      };
      
    case 'LOGOUT':
      return {
        ...state,
        auth: {
          isAuthenticated: false,
          isGuest: true,
          user: null,
          permissions: getGuestPermissions(),
          cognitoCredentials: null,
        },
        todos: [], // 로그아웃 시 로컬 데이터 클리어
      };
      
    default:
      return state;
  }
};
```

## 5.5 Context Provider 구현

```typescript
export const TodoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(todoReducer, getInitialState());
  
  // localStorage와 동기화
  useEffect(() => {
    const savedTodos = localStorage.getItem('todos');
    if (savedTodos) {
      try {
        const todos = JSON.parse(savedTodos);
        dispatch({ type: 'LOAD_TODOS', payload: todos });
      } catch (error) {
        console.error('Failed to load todos from localStorage:', error);
      }
    }
  }, []);
  
  // 상태 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(state.todos));
  }, [state.todos]);
  
  // 편의 메서드들
  const addTodo = useCallback((title: string, priority: Priority) => {
    dispatch({ type: 'ADD_TODO', payload: { title, priority } });
  }, []);
  
  const toggleTodo = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_TODO', payload: { id } });
  }, []);
  
  const deleteTodo = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TODO', payload: { id } });
  }, []);
  
  const editTodo = useCallback((id: string, title: string) => {
    dispatch({ type: 'EDIT_TODO', payload: { id, title } });
  }, []);
  
  const setFilter = useCallback((filter: TodoFilter) => {
    dispatch({ type: 'SET_FILTER', payload: filter });
  }, []);
  
  const contextValue: TodoContextType = {
    state,
    dispatch,
    addTodo,
    toggleTodo,
    deleteTodo,
    editTodo,
    setFilter,
  };
  
  return (
    <TodoContext.Provider value={contextValue}>
      {children}
    </TodoContext.Provider>
  );
};
```

---

**이전**: [컴포넌트 설계](04-components.md)  
**다음**: [데이터 플로우](06-data-flow.md)