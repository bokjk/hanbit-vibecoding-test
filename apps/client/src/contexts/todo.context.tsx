import { createContext, useContext, useReducer, ReactNode } from 'react';
import { Todo } from 'types';
import { todoReducer, TodoState, TodoAction } from './todo.reducer';

const initialState: TodoState = {
  todos: [],
  loading: false,
  error: null,
};

interface TodoContextType {
  state: TodoState;
  dispatch: React.Dispatch<TodoAction>;
  addTodo: (todo: Todo) => void;
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

  const addTodo = (todo: Todo) => {
    dispatch({ type: 'ADD_TODO', payload: todo });
  };

  const updateTodo = (todo: Todo) => {
    dispatch({ type: 'UPDATE_TODO', payload: todo });
  };

  const deleteTodo = (id: string) => {
    dispatch({ type: 'DELETE_TODO', payload: id });
  };

  const toggleTodo = (id: string) => {
    dispatch({ type: 'TOGGLE_TODO', payload: id });
  };

  const loadTodos = (todos: Todo[]) => {
    dispatch({ type: 'LOAD_TODOS', payload: todos });
  };

  const clearTodos = () => {
    dispatch({ type: 'CLEAR_TODOS' });
  };

  const setLoading = (loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  };

  const setError = (error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  };

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