
import type { Todo } from 'types/index';
import { TodoItem } from './todo-item';

interface TodoListProps {
  todos: Todo[];
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onEditTodo: (id: string, title: string) => void;
}

export function TodoList({ todos, onToggleTodo, onDeleteTodo, onEditTodo }: TodoListProps) {
  return (
    <div data-testid="todo-list">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggleTodo={onToggleTodo}
          onDeleteTodo={onDeleteTodo}
          onEditTodo={onEditTodo}
        />
      ))}
    </div>
  );
}
