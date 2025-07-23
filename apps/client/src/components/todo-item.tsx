
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { Todo, Priority } from 'types/index';

interface TodoItemProps {
  todo: Todo;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onEditTodo: (id: string, title: string) => void;
}

function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getPriorityLabel(priority: Priority): string {
  switch (priority) {
    case 'high':
      return 'HIGH';
    case 'medium':
      return 'MID';
    case 'low':
      return 'LOW';
    default:
      return 'MID';
  }
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

  const formattedDate = new Date(todo.createdAt).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${
      todo.completed ? 'bg-blue-50 border-blue-200' : 'bg-white'
    }`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between space-x-4">
          {/* 왼쪽: 체크박스와 내용 */}
          <div className="flex items-start space-x-3 flex-1 min-w-0">
            <Checkbox
              checked={todo.completed}
              onCheckedChange={() => onToggleTodo(todo.id)}
              className="mt-1"
            />
            
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  autoFocus
                  className="text-sm"
                />
              ) : (
                <>
                  <p className={`text-sm font-medium break-words ${
                    todo.completed 
                      ? 'line-through text-gray-500' 
                      : 'text-gray-900'
                  }`}>
                    {todo.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formattedDate} 생성
                  </p>
                </>
              )}
            </div>
          </div>

          {/* 오른쪽: 우선순위와 액션 버튼들 */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* 우선순위 배지 */}
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
              getPriorityColor(todo.priority)
            }`}>
              {getPriorityLabel(todo.priority)}
            </span>

            {/* 액션 버튼들 */}
            <div className="flex items-center space-x-1">
              {!isEditing && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEdit}
                    className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteTodo(todo.id)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
