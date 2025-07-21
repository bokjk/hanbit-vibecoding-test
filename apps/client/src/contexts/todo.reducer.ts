import { Todo } from 'types';

export interface TodoState {
  todos: Todo[];
  loading: boolean;
  error: string | null;
}

export type TodoAction =
  | { type: 'ADD_TODO'; payload: Todo }
  | { type: 'UPDATE_TODO'; payload: Todo }
  | { type: 'DELETE_TODO'; payload: string }
  | { type: 'TOGGLE_TODO'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'LOAD_TODOS'; payload: Todo[] }
  | { type: 'CLEAR_TODOS' };

export function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case 'ADD_TODO':
      return {
        ...state,
        todos: [...state.todos, action.payload],
      };

    case 'UPDATE_TODO':
      const todoIndex = state.todos.findIndex(todo => todo.id === action.payload.id);
      if (todoIndex === -1) {
        return state;
      }
      
      const updatedTodos = [...state.todos];
      updatedTodos[todoIndex] = action.payload;
      
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
            ? { ...todo, completed: !todo.completed }
            : todo
        ),
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