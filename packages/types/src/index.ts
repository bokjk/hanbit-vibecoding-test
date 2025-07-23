export type Priority = 'low' | 'medium' | 'high';

export type Todo = {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
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
}
