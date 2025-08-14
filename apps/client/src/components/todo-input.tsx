import { useState } from "react";
import { Button } from "@vive/ui";
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vive/ui";
import type { Priority } from "@vive/types";
import { useTodoForm } from "../hooks/use-todo";
import { useSafeInput, logSecurityWarning } from "../utils/client-security";

interface TodoInputProps {
  // Props는 선택적이며, 커스텀 처리를 원할 경우 사용
  onAddTodo?: (title: string, priority: Priority) => void;
}

export function TodoInput({ onAddTodo }: TodoInputProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { createTodo, canCreate, loading } = useTodoForm();
  const { sanitizeInput } = useSafeInput();

  const handleAddClick = async () => {
    if (!title.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);

      // 입력 정화 (XSS 방지)
      const sanitizedTitle = sanitizeInput(title.trim());

      // 보안 경고 로깅 (개발 모드에서만)
      if (sanitizedTitle !== title.trim()) {
        logSecurityWarning("제목에서 위험한 내용이 정화되었습니다", {
          original: title.trim(),
          sanitized: sanitizedTitle,
        });
      }

      if (onAddTodo) {
        // 외부에서 제공된 핸들러 사용
        onAddTodo(sanitizedTitle, priority);
      } else {
        // 내장된 useTodo 훅 사용
        await createTodo(sanitizedTitle, {
          priority,
        });
      }

      // 성공적으로 추가되면 폼 리셋
      setTitle("");
      setPriority("medium");
    } catch (error) {
      console.error("Failed to add todo:", error);
      // 에러는 Context 레벨에서 처리되므로 여기서는 로깅만
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAddClick();
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    // 실시간 입력 정화 (타이핑 중에는 기본 정화만 적용)
    const sanitized = sanitizeInput(value);

    // 보안 경고 (개발 모드에서만)
    if (sanitized !== value && value.length > 0) {
      logSecurityWarning("입력 중 위험한 내용이 감지되어 정화되었습니다", {
        original: value,
        sanitized,
      });
    }

    setTitle(sanitized);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* 데스크톱 레이아웃 */}
      <div style={{ display: 'none', '@media (min-width: 768px)': { display: 'flex' }, width: '100%', alignItems: 'center', gap: '0.75rem' }}>
        <style>
          {`
            @media (min-width: 768px) {
              .desktop-layout { display: flex !important; }
            }
          `}
        </style>
        <div className="desktop-layout" style={{ display: 'none', width: '100%', alignItems: 'center', gap: '0.75rem' }}>
          <Input
            data-testid="todo-input"
            type="text"
            placeholder="새로운 할 일을 입력하세요..."
            value={title}
            onChange={handleTitleChange}
            onKeyDown={handleKeyDown}
            style={{ flex: 1 }}
          />
          <Select
            value={priority}
            onValueChange={(value: Priority) => setPriority(value)}
          >
            <SelectTrigger data-testid="priority-select" style={{ width: '8.75rem' }}>
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
            style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}
            disabled={!canCreate || isSubmitting || loading || !title.trim()}
          >
            {isSubmitting || loading ? "추가 중..." : "할 일 추가"}
          </Button>
        </div>
      </div>

      {/* 모바일 레이아웃 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', '@media (min-width: 768px)': { display: 'none' } }}>
        <style>
          {`
            @media (min-width: 768px) {
              .mobile-layout { display: none !important; }
            }
          `}
        </style>
        <div className="mobile-layout" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Input
              data-testid="todo-input"
              type="text"
              placeholder="새로운 할 일을 입력하세요..."
              value={title}
              onChange={handleTitleChange}
              onKeyDown={handleKeyDown}
              style={{ flex: 1 }}
            />
            <Select
              value={priority}
              onValueChange={(value: Priority) => setPriority(value)}
            >
              <SelectTrigger style={{ width: '5rem' }}>
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
            style={{ width: '100%' }}
            disabled={!canCreate || isSubmitting || loading || !title.trim()}
          >
            {isSubmitting || loading ? "추가 중..." : "추가"}
          </Button>
        </div>
      </div>
    </div>
  );
}