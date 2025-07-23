
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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-red-500 bg-yellow-200 p-4 border-4 border-green-500">Todo App</h1>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <TodoInput onAddTodo={handleAddTodo} />
          <div className="mt-6">
            <TodoList
              todos={state.todos}
              onToggleTodo={handleToggleTodo}
              onDeleteTodo={handleDeleteTodo}
              onEditTodo={handleEditTodo}
            />
          </div>
        </div>
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
