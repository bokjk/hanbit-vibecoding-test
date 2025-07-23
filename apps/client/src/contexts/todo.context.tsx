import { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import type { Todo } from 'types/index';
import { todoReducer } from './todo.reducer';
import type { TodoState, TodoAction } from './todo.reducer';

const initialState: TodoState = {
  todos: [],
  loading: false,
  error: null,
};

interface TodoContextType {
  state: TodoState;
  dispatch: React.Dispatch<TodoAction>;
  addTodo: (todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'completed'>) => void;
  updateTodo: (todo: Todo) => void;
  deleteTodo: (id: string) => void;
  toggleTodo: (id: string) => void;
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
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
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