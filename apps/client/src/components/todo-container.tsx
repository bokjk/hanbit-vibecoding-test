
import { useEffect, useRef } from 'react';
import { TodoProvider, useTodoContext } from '../contexts/todo.context';
import { LocalStorageService } from '../services/localStorage.service';
import { TodoInput } from './todo-input';
import { TodoList } from './todo-list';
import type { Priority, Todo } from 'types/index';

const localStorageService = new LocalStorageService();

function TodoContainerContent() {
  const { state, updateTodo, addTodo, toggleTodo, deleteTodo, loadTodos } = useTodoContext();
  const isInitialLoad = useRef(true);

  useEffect(() => {
    const loadData = async () => {
      const todos = await localStorageService.getTodos();
      loadTodos(todos);
      isInitialLoad.current = false;
    };
    loadData();
  }, [loadTodos]);

  useEffect(() => {
    if (!isInitialLoad.current) {
      localStorageService.saveTodos(state.todos);
    }
  }, [state.todos]);

  const handleAddTodo = (title: string, priority: Priority) => {
    const newTodo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt' | 'completed'> = { title, priority };
    addTodo(newTodo);
  };

  const handleToggleTodo = (id: string) => {
    toggleTodo(id);
  };

  const handleDeleteTodo = (id: string) => {
    deleteTodo(id);
  };

  const handleEditTodo = (id: string, title: string) => {
    const existingTodo = state.todos.find(todo => todo.id === id);
    if (existingTodo) {
      const updatedTodo: Todo = {
        ...existingTodo,
        title,
        updatedAt: new Date().toISOString(),
      };
      updateTodo(updatedTodo);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Todo App</h1>
      <TodoInput onAddTodo={handleAddTodo} />
      <div className="mt-4">
        <TodoList
          todos={state.todos}
          onToggleTodo={handleToggleTodo}
          onDeleteTodo={handleDeleteTodo}
          onEditTodo={handleEditTodo}
        />
      </div>
    </div>
  );
}

export function TodoContainer() {
  return (
    <TodoProvider>
      <TodoContainerContent />
    </TodoProvider>
  );
}
