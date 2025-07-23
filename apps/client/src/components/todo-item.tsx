
import { useState } from 'react';
import type { Todo } from 'types/index';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

interface TodoItemProps {
  todo: Todo;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onEditTodo: (id: string, title: string) => void;
}

export function TodoItem({ todo, onToggleTodo, onDeleteTodo, onEditTodo }: TodoItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(todo.title);

  const handleSave = () => {
    if (newTitle.trim()) {
      onEditTodo(todo.id, newTitle.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setNewTitle(todo.title);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleBlur = () => {
    handleSave();
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
              onBlur={handleBlur}
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
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={handleSave}>
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCancel}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={handleEdit}>
                Edit
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={() => onDeleteTodo(todo.id)}>
                Delete
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
