
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Priority } from 'types/index';

interface TodoInputProps {
  onAddTodo: (title: string, priority: Priority) => void;
}

export function TodoInput({ onAddTodo }: TodoInputProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');

  const handleAddClick = () => {
    if (title.trim()) {
      onAddTodo(title.trim(), priority);
      setTitle('');
      setPriority('medium');
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
          type="text"
          placeholder="새로운 할 일을 입력하세요..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
        />
        <Select value={priority} onValueChange={(value: Priority) => setPriority(value)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="우선순위" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="high">높음</SelectItem>
            <SelectItem value="medium">보통</SelectItem>
            <SelectItem value="low">낮음</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleAddClick} className="px-6">
          할 일 추가
        </Button>
      </div>

      {/* 모바일 레이아웃 */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center space-x-2">
          <Input
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
        <Button onClick={handleAddClick} className="w-full">
          추가
        </Button>
      </div>
    </div>
  );
}
