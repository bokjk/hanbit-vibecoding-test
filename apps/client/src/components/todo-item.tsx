import { useState } from "react";
import { Button } from "@vive/ui";
import { Card, CardContent, Checkbox, Input } from "@vive/ui";
import type { Todo, Priority } from "@vive/types";
import styles from "./todo-item.module.scss";

interface TodoItemProps {
  todo: Todo;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onEditTodo: (id: string, title: string) => void;
}

const priorityBadgeMap: Record<Priority, { label: string; icon: string; className: string }> = {
  high: { label: "긴급", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z", className: styles.high },
  medium: { label: "보통", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", className: styles.medium },
  low: { label: "낮음", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", className: styles.low },
};

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

  const priorityBadge = priorityBadgeMap[todo.priority] || priorityBadgeMap.medium;
  const cardClasses = [
    styles.card,
    todo.completed ? styles.completed : '',
    styles[`priority${todo.priority.charAt(0).toUpperCase() + todo.priority.slice(1)}`]
  ].join(' ');

  return (
    <Card data-testid="todo-item" className={cardClasses}>
      <CardContent className={styles.content}>
        <div className={styles.mainContainer}>
          {/* 상단: 체크박스와 제목 */}
          <div className={styles.topSection}>
            <Checkbox
              data-testid="todo-checkbox"
              checked={todo.completed}
              onCheckedChange={() => onToggleTodo(todo.id)}
              className={styles.checkbox}
            />

            <div className={styles.titleContainer}>
              {isEditing ? (
                <Input
                  data-testid="edit-input"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  autoFocus
                  className={styles.editInput}
                />
              ) : (
                <div className={styles.titleContent}>
                  <h3
                    data-testid="todo-title"
                    className={`${styles.title} ${todo.completed ? styles.completed : ''}`}>
                    {todo.title}
                  </h3>

                  {/* 메타데이터 */}
                  <div className={styles.metaContainer}>
                    <span className={styles.metaItem}>
                      <svg
                        className={styles.metaIcon}
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
                      <span className={`${styles.metaItem} ${styles.completedText}`}>
                        <svg
                          className={styles.metaIcon}
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
          <div className={styles.bottomSection}>
            <div className={styles.priorityContainer}>
              {/* 우선순위 배지 */}
              <div className={`${styles.priorityBadge} ${priorityBadge.className}`}>
                <svg
                  className={styles.badgeIcon}
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
                <div className={styles.statusIndicator}>
                  <div className={styles.statusDot}></div>
                  진행 중
                </div>
              )}
            </div>

            {/* 액션 버튼들 */}
            {!isEditing && (
              <div className={styles.actionsContainer}>
                <Button
                  data-testid="edit-button"
                  variant="ghost"
                  size="sm"
                  onClick={handleEdit}
                  className={`${styles.actionButton} ${styles.edit}`}>
                  <svg
                    className={styles.actionIcon}
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
                  className={`${styles.actionButton} ${styles.delete}`}>
                  <svg
                    className={styles.actionIcon}
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
                  className={`${styles.actionButton} ${styles.more}`}>
                  <svg
                    className={styles.actionIcon}
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
