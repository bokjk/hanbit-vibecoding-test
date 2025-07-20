export enum Priority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface Todo {
  id: string;                    // UUID
  title: string;                // 할 일 제목 (필수)
  completed: boolean;           // 완료 상태
  priority: Priority;           // 우선순위
  createdAt: Date;             // 생성일시
  updatedAt: Date;             // 수정일시
  userId?: string;             // 사용자 ID (2단계에서 추가)
}

export enum FilterType {
  ALL = 'all',
  ACTIVE = 'active',
  COMPLETED = 'completed'
}

export enum SortBy {
  CREATED_DATE = 'createdDate',
  PRIORITY = 'priority',
  TITLE = 'title'
}

export interface TodoFilter {
  type: FilterType;
  sortBy: SortBy;
  sortOrder: 'asc' | 'desc';
}

export interface AppState {
  todos: Todo[];
  filter: TodoFilter;
  loading: boolean;
  error: string | null;
  user?: User; // 2단계에서 추가
}

export interface User {
  id: string;
  name: string;
  email: string;
}

// API 요청/응답 타입들
export interface CreateTodoRequest {
  title: string;
  priority: Priority;
}

export interface UpdateTodoRequest {
  title?: string;
  completed?: boolean;
  priority?: Priority;
}

// Repository 인터페이스
export interface TodoRepository {
  getTodos(): Promise<Todo[]>;
  addTodo(todo: CreateTodoRequest): Promise<Todo>;
  updateTodo(id: string, updates: UpdateTodoRequest): Promise<Todo>;
  deleteTodo(id: string): Promise<void>;
} 