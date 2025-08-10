
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Priority } from 'types/index';
import { useTodoForm } from '../hooks/use-todo';

interface TodoInputProps {
  // Props는 선택적이며, 커스텀 처리를 원할 경우 사용
  onAddTodo?: (title: string, priority: Priority) => void;
}

export function TodoInput({ onAddTodo }: TodoInputProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { createTodo, canCreate, loading } = useTodoForm();

  const handleAddClick = async () => {
    if (!title.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      
      if (onAddTodo) {
        // 외부에서 제공된 핸들러 사용
        onAddTodo(title.trim(), priority);
      } else {
        // 내장된 useTodo 훅 사용
        await createTodo(title.trim(), {
          priority,
        });
      }
      
      // 성공적으로 추가되면 폼 리셋
      setTitle('');
      setPriority('medium');
    } catch (error) {
      console.error('Failed to add todo:', error);
      // 에러는 Context 레벨에서 처리되므로 여기서는 로깅만
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddClick();
    }
  };

  return (
    <div className="space-y-4">
      {/* 데스크톱 레이아웃 */}
      <div className="hidden md:flex w-full items-center space-x-3">
        <Input
          data-testid="todo-input"
          type="text"
          placeholder="새로운 할 일을 입력하세요..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Select value={priority} onValueChange={(value: Priority) => setPriority(value)}>
          <SelectTrigger data-testid="priority-select" className="w-[140px]">
            <SelectValue placeholder="우선순위" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="high">높음</SelectItem>
            <SelectItem value="medium">보통</SelectItem>
            <SelectItem value="low">낮음</SelectItem>
          </SelectContent>
        </Select>
        <Button 
          data-testid="add-todo-button" 
          onClick={handleAddClick} 
          className="px-6"
          disabled={!canCreate || isSubmitting || loading || !title.trim()}
        >
          {isSubmitting || loading ? '추가 중...' : '할 일 추가'}
        </Button>
      </div>

      {/* 모바일 레이아웃 */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center space-x-2">
          <Input
            data-testid="todo-input"
            type="text"
            placeholder="새로운 할 일을 입력하세요..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Select value={priority} onValueChange={(value: Priority) => setPriority(value)}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">높음</SelectItem>
              <SelectItem value="medium">보통</SelectItem>
              <SelectItem value="low">낮음</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button 
          data-testid="add-todo-button" 
          onClick={handleAddClick} 
          className="w-full"
          disabled={!canCreate || isSubmitting || loading || !title.trim()}
        >
          {isSubmitting || loading ? '추가 중...' : '추가'}
        </Button>
      </div>
    </div>
  );
}
