import { useState } from "react";
import { Button } from "@vive/ui";
import { Card, CardContent, Checkbox, Input } from "@vive/ui";
import type { Todo, Priority } from "@vive/types";

interface TodoItemProps {
  todo: Todo;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onEditTodo: (id: string, title: string) => void;
}

function getPriorityColor(priority: Priority): React.CSSProperties {
  switch (priority) {
    case "high":
      return {
        borderLeftWidth: '4px',
        borderLeftColor: '#ef4444',
        background: 'linear-gradient(to right, #fef2f2, white)'
      };
    case "medium":
      return {
        borderLeftWidth: '4px',
        borderLeftColor: '#f97316',
        background: 'linear-gradient(to right, #fff7ed, white)'
      };
    case "low":
      return {
        borderLeftWidth: '4px',
        borderLeftColor: '#22c55e',
        background: 'linear-gradient(to right, #f0fdf4, white)'
      };
    default:
      return {
        borderLeftWidth: '4px',
        borderLeftColor: '#6b7280',
        background: 'linear-gradient(to right, #f9fafb, white)'
      };
  }
}

function getPriorityBadge(priority: Priority): {
  color: React.CSSProperties;
  label: string;
  icon: string;
} {
  switch (priority) {
    case "high":
      return {
        color: { backgroundColor: '#ef4444', color: 'white' },
        label: "긴급",
        icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z",
      };
    case "medium":
      return {
        color: { backgroundColor: '#f97316', color: 'white' },
        label: "보통",
        icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
      };
    case "low":
      return {
        color: { backgroundColor: '#22c55e', color: 'white' },
        label: "낮음",
        icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
      };
    default:
      return {
        color: { backgroundColor: '#6b7280', color: 'white' },
        label: "보통",
        icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
      };
  }
}

export function TodoItem({
  todo,
  onToggleTodo,
  onDeleteTodo,
  onEditTodo,
}: TodoItemProps) {
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
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  const formattedDate = new Date(todo.createdAt).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const priorityBadge = getPriorityBadge(todo.priority);

  return (
    <Card
      data-testid="todo-item"
      style={{
        ...getPriorityColor(todo.priority),
        transition: 'all 300ms ease',
        cursor: 'pointer',
        opacity: todo.completed ? 0.75 : 1,
        filter: todo.completed ? 'saturate(0.5)' : 'none'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
        e.currentTarget.style.transform = 'scale(1.02)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <CardContent style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* 상단: 체크박스와 제목 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <Checkbox
              data-testid="todo-checkbox"
              checked={todo.completed}
              onCheckedChange={() => onToggleTodo(todo.id)}
              style={{ marginTop: '0.25rem', transform: 'scale(1.25)' }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              {isEditing ? (
                <Input
                  data-testid="edit-input"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  autoFocus
                  style={{ fontSize: '1.125rem', lineHeight: '1.75rem', fontWeight: '500' }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h3
                    data-testid="todo-title"
                    style={{
                      fontSize: '1.125rem',
                      lineHeight: '1.75rem',
                      fontWeight: '600',
                      lineHeight: '1.25',
                      textDecoration: todo.completed ? 'line-through' : 'none',
                      color: todo.completed ? '#6b7280' : '#111827'
                    }}
                  >
                    {todo.title}
                  </h3>

                  {/* 메타데이터 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', lineHeight: '1.25rem', color: '#6b7280' }}>
                    <span style={{ display: 'flex', alignItems: 'center' }}>
                      <svg
                        style={{ height: '1rem', width: '1rem', marginRight: '0.25rem' }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      {formattedDate}
                    </span>
                    {todo.completed && (
                      <span style={{ display: 'flex', alignItems: 'center', color: '#16a34a' }}>
                        <svg
                          style={{ height: '1rem', width: '1rem', marginRight: '0.25rem' }}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        완료됨
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 하단: 우선순위와 액션 버튼들 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* 우선순위 배지 */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  paddingLeft: '0.75rem',
                  paddingRight: '0.75rem',
                  paddingTop: '0.25rem',
                  paddingBottom: '0.25rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  lineHeight: '1rem',
                  fontWeight: '600',
                  ...priorityBadge.color
                }}
              >
                <svg
                  style={{ height: '0.75rem', width: '0.75rem', marginRight: '0.25rem' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={priorityBadge.icon}
                  />
                </svg>
                {priorityBadge.label}
              </div>

              {/* 진행 상태 표시 */}
              {!todo.completed && (
                <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', lineHeight: '1rem', color: '#6b7280' }}>
                  <div style={{
                    width: '0.5rem',
                    height: '0.5rem',
                    backgroundColor: '#fb923c',
                    borderRadius: '50%',
                    marginRight: '0.5rem',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }}></div>
                  진행 중
                </div>
              )}
            </div>

            {/* 액션 버튼들 */}
            {!isEditing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Button
                  data-testid="edit-button"
                  variant="ghost"
                  size="sm"
                  onClick={handleEdit}
                  style={{
                    height: '2.25rem',
                    width: '2.25rem',
                    padding: 0,
                    color: '#9ca3af',
                    borderRadius: '50%',
                    transition: 'colors 200ms ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#2563eb';
                    e.currentTarget.style.backgroundColor = '#eff6ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#9ca3af';
                    e.currentTarget.style.backgroundColor = '';
                  }}
                >
                  <svg
                    style={{ height: '1rem', width: '1rem' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </Button>
                <Button
                  data-testid="delete-button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteTodo(todo.id)}
                  style={{
                    height: '2.25rem',
                    width: '2.25rem',
                    padding: 0,
                    color: '#9ca3af',
                    borderRadius: '50%',
                    transition: 'colors 200ms ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#dc2626';
                    e.currentTarget.style.backgroundColor = '#fef2f2';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#9ca3af';
                    e.currentTarget.style.backgroundColor = '';
                  }}
                >
                  <svg
                    style={{ height: '1rem', width: '1rem' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  style={{
                    height: '2.25rem',
                    width: '2.25rem',
                    padding: 0,
                    color: '#9ca3af',
                    borderRadius: '50%',
                    transition: 'colors 200ms ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#4b5563';
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#9ca3af';
                    e.currentTarget.style.backgroundColor = '';
                  }}
                >
                  <svg
                    style={{ height: '1rem', width: '1rem' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}