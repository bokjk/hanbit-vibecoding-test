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
