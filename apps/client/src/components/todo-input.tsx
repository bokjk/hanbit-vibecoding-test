
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
    <div className="flex w-full items-center space-x-2">
      <Input
        type="text"
        placeholder="Enter a new todo..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-grow"
      />
      <Select value={priority} onValueChange={(value: Priority) => setPriority(value)}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>
      <Button onClick={handleAddClick}>Add</Button>
    </div>
  );
}
