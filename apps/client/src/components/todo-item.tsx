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

function getPriorityColor(priority: Priority): string {
  switch (priority) {
    case "high":
      return "border-l-red-500 bg-gradient-to-r from-red-50 to-white";
    case "medium":
      return "border-l-orange-500 bg-gradient-to-r from-orange-50 to-white";
    case "low":
      return "border-l-green-500 bg-gradient-to-r from-green-50 to-white";
    default:
      return "border-l-gray-500 bg-gradient-to-r from-gray-50 to-white";
  }
}

function getPriorityBadge(priority: Priority): {
  color: string;
  label: string;
  icon: string;
} {
  switch (priority) {
    case "high":
      return {
        color: "bg-red-500 text-white",
        label: "긴급",
        icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z",
      };
    case "medium":
      return {
        color: "bg-orange-500 text-white",
        label: "보통",
        icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
      };
    case "low":
      return {
        color: "bg-green-500 text-white",
        label: "낮음",
        icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
      };
    default:
      return {
        color: "bg-gray-500 text-white",
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
      className={`border-l-4 ${getPriorityColor(todo.priority)} transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${
        todo.completed ? "opacity-75 saturate-50" : ""
      }`}
    >
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* 상단: 체크박스와 제목 */}
          <div className="flex items-start space-x-4">
            <Checkbox
              data-testid="todo-checkbox"
              checked={todo.completed}
              onCheckedChange={() => onToggleTodo(todo.id)}
              className="mt-1 scale-125"
            />

            <div className="flex-1 min-w-0">
              {isEditing ? (
                <Input
                  data-testid="edit-input"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleBlur}
                  autoFocus
                  className="text-lg font-medium"
                />
              ) : (
                <div className="space-y-2">
                  <h3
                    data-testid="todo-title"
                    className={`text-lg font-semibold leading-tight ${
                      todo.completed
                        ? "line-through text-gray-500"
                        : "text-gray-900"
                    }`}
                  >
                    {todo.title}
                  </h3>

                  {/* 메타데이터 */}
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span className="flex items-center">
                      <svg
                        className="h-4 w-4 mr-1"
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
                      <span className="flex items-center text-green-600">
                        <svg
                          className="h-4 w-4 mr-1"
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
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* 우선순위 배지 */}
              <div
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${priorityBadge.color}`}
              >
                <svg
                  className="h-3 w-3 mr-1"
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
                <div className="flex items-center text-xs text-gray-500">
                  <div className="w-2 h-2 bg-orange-400 rounded-full mr-2 animate-pulse"></div>
                  진행 중
                </div>
              )}
            </div>

            {/* 액션 버튼들 */}
            {!isEditing && (
              <div className="flex items-center space-x-2">
                <Button
                  data-testid="edit-button"
                  variant="ghost"
                  size="sm"
                  onClick={handleEdit}
                  className="h-9 w-9 p-0 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                >
                  <svg
                    className="h-4 w-4"
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
                  className="h-9 w-9 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                >
                  <svg
                    className="h-4 w-4"
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
                  className="h-9 w-9 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
                >
                  <svg
                    className="h-4 w-4"
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
