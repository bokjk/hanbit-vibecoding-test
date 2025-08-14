export type Priority = 'low' | 'medium' | 'high';

export type Todo = {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  tags?: string[];
  userId?: string;
  isGuest?: boolean;
}

export type FilterType = 'all' | 'active' | 'completed';

export type SortBy = 'createdAt' | 'priority' | 'title';

export type SortOrder = 'asc' | 'desc';

export interface TodoFilter {
  type: FilterType;
  sortBy: SortBy;
  sortOrder: SortOrder;
}

export interface TodoStats {
  total: number;
  active: number;
  completed: number;
  completionRate: number;
  byPriority: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface CreateTodoRequest {
  title: string;
  description?: string;
  priority: Priority;
  dueDate?: string;
  tags?: string[];
}

export interface UpdateTodoRequest {
  title?: string;
  description?: string;
  completed?: boolean;
  priority?: Priority;
  dueDate?: string;
  tags?: string[];
}