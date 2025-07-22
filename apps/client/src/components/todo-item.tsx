
import { useState } from 'react';
import { Todo } from 'packages/types/src';
import { Button } from 'packages/ui/src/components/ui/button';
import { Checkbox } from 'packages/ui/src/components/ui/checkbox';
import { Input } from 'packages/ui/src/components/ui/input';
import { Card, CardContent } from 'packages/ui/src/components/ui/card';

interface TodoItemProps {
  todo: Todo;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onEditTodo: (id: string, title: string) => void;
}

export function TodoItem({ todo, onToggleTodo, onDeleteTodo, onEditTodo }: TodoItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(todo.title);

  const handleEdit = () => {
    if (isEditing && newTitle.trim()) {
      onEditTodo(todo.id, newTitle.trim());
    }
    setIsEditing(!isEditing);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleEdit();
    }
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-4">
          <Checkbox
            checked={todo.completed}
            onCheckedChange={() => onToggleTodo(todo.id)}
          />
          {isEditing ? (
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleEdit}
              autoFocus
            />
          ) : (
            <span className={`flex-grow ${todo.completed ? 'line-through text-gray-500' : ''}`}>
              {todo.title}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500 capitalize">{todo.priority}</span>
            <Button variant="outline" size="sm" onClick={handleEdit}>
                {isEditing ? 'Save' : 'Edit'}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => onDeleteTodo(todo.id)}>
                Delete
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
