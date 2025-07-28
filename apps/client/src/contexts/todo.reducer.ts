import type { Todo, TodoFilter } from 'types/index';

export interface TodoState {
  todos: Todo[];
  filter: TodoFilter;
  loading: boolean;
  error: string | null;
}

export type TodoAction =
  | { type: 'ADD_TODO'; payload: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'completed'> }
  | { type: 'UPDATE_TODO'; payload: Todo }
  | { type: 'DELETE_TODO'; payload: string }
  | { type: 'TOGGLE_TODO'; payload: string }
  | { type: 'SET_FILTER'; payload: TodoFilter }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'LOAD_TODOS'; payload: Todo[] }
  | { type: 'CLEAR_TODOS' };

export function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case 'ADD_TODO':
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

    case 'UPDATE_TODO':
      const todoIndex = state.todos.findIndex(todo => todo.id === action.payload.id);
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

    case 'DELETE_TODO':
      return {
        ...state,
        todos: state.todos.filter(todo => todo.id !== action.payload),
      };

    case 'TOGGLE_TODO':
      return {
        ...state,
        todos: state.todos.map(todo =>
          todo.id === action.payload
            ? { 
                ...todo, 
                completed: !todo.completed,
                updatedAt: new Date().toISOString(),
              }
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
      };

    case 'CLEAR_TODOS':
      return {
        ...state,
        todos: [],
      };

    default:
      return state;
  }
}