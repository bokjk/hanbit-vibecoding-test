export declare enum Priority {
    HIGH = "high",
    MEDIUM = "medium",
    LOW = "low"
}
export interface Todo {
    id: string;
    title: string;
    completed: boolean;
    priority: Priority;
    createdAt: Date;
    updatedAt: Date;
    userId?: string;
}
export declare enum FilterType {
    ALL = "all",
    ACTIVE = "active",
    COMPLETED = "completed"
}
export declare enum SortBy {
    CREATED_DATE = "createdDate",
    PRIORITY = "priority",
    TITLE = "title"
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
    user?: User;
}
export interface User {
    id: string;
    name: string;
    email: string;
}
export interface CreateTodoRequest {
    title: string;
    priority: Priority;
}
export interface UpdateTodoRequest {
    title?: string;
    completed?: boolean;
    priority?: Priority;
}
export interface TodoRepository {
    getTodos(): Promise<Todo[]>;
    addTodo(todo: CreateTodoRequest): Promise<Todo>;
    updateTodo(id: string, updates: UpdateTodoRequest): Promise<Todo>;
    deleteTodo(id: string): Promise<void>;
}
