import type { Todo } from "types/index";

export class LocalStorageService {
  private readonly TODOS_KEY = "todos";

  static save<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Error saving to localStorage:", error);
      throw new Error("Failed to save data to local storage.");
    }
  }

  static get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error("Error retrieving from localStorage:", error);
      throw new Error("Failed to retrieve data from local storage.");
    }
  }

  static remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error("Error removing from localStorage:", error);
      throw new Error("Failed to remove data from local storage.");
    }
  }

  async getTodos(): Promise<Todo[]> {
    try {
      const todos = LocalStorageService.get<Todo[]>(this.TODOS_KEY);
      return todos || [];
    } catch (error) {
      console.error("Error getting todos:", error);
      return [];
    }
  }

  async saveTodos(todos: Todo[]): Promise<void> {
    try {
      LocalStorageService.save(this.TODOS_KEY, todos);
    } catch (error) {
      console.error("Error saving todos:", error);
      throw new Error("Failed to save todos to local storage.");
    }
  }
}
