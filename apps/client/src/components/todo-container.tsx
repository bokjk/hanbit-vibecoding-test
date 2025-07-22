
import { useReducer, useEffect } from 'react';
import { todoReducer } from '../contexts/todo.reducer';
import { TodoProvider } from '../contexts/todo.context';
import { LocalStorageService } from '../services/localStorage.service';
import { TodoInput } from './todo-input';
import { TodoList } from './todo-list';
import type { Priority, Todo } from 'types/index';

const localStorageService = new LocalStorageService();

export function TodoContainer() {
  const [state, dispatch] = useReducer(todoReducer, {
    todos: [],
    filteredTodos: [],
  });

  useEffect(() => {
    const loadTodos = async () => {
      const todos = await localStorageService.getTodos();
      dispatch({ type: 'SET_TODOS', payload: todos });
    };
    loadTodos();
  }, []);

  useEffect(() => {
    localStorageService.saveTodos(state.todos);
  }, [state.todos]);

  const handleAddTodo = (title: string, priority: Priority) => {
    const newTodo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'completed'> = { title, priority };
    dispatch({ type: 'ADD_TODO', payload: newTodo });
  };

  const handleToggleTodo = (id: string) => {
    dispatch({ type: 'TOGGLE_TODO', payload: { id } });
  };

  const handleDeleteTodo = (id: string) => {
    dispatch({ type: 'DELETE_TODO', payload: { id } });
  };

  const handleEditTodo = (id: string, title: string) => {
    dispatch({ type: 'EDIT_TODO', payload: { id, title } });
  };

  return (
    <TodoProvider value={{ state, dispatch }}>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Todo App</h1>
        <TodoInput onAddTodo={handleAddTodo} />
        <div className="mt-4">
          <TodoList
            todos={state.todos} // Or state.filteredTodos based on filter implementation
            onToggleTodo={handleToggleTodo}
            onDeleteTodo={handleDeleteTodo}
            onEditTodo={handleEditTodo}
          />
        </div>
      </div>
    </TodoProvider>
  );
}
