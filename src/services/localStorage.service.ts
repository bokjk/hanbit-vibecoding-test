import { Todo, Priority, CreateTodoRequest, UpdateTodoRequest, TodoRepository } from 'types'

export class LocalStorageService implements TodoRepository {
  private readonly TODOS_KEY = 'todos'

  async getTodos(): Promise<Todo[]> {
    try {
      const todosJson = localStorage.getItem(this.TODOS_KEY)
      if (!todosJson) {
        return []
      }
      
      const todos = JSON.parse(todosJson)
      // Date 객체로 변환
      return todos.map((todo: any) => ({
        ...todo,
        createdAt: new Date(todo.createdAt),
        updatedAt: new Date(todo.updatedAt)
      }))
    } catch (error) {
      console.error('Failed to parse todos from localStorage:', error)
      return []
    }
  }

  async saveTodos(todos: Todo[]): Promise<void> {
    localStorage.setItem(this.TODOS_KEY, JSON.stringify(todos))
  }

  async addTodo(request: CreateTodoRequest): Promise<Todo> {
    const todos = await this.getTodos()
    
    const newTodo: Todo = {
      id: this.generateId(),
      title: request.title,
      completed: false,
      priority: request.priority,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    todos.push(newTodo)
    await this.saveTodos(todos)
    
    return newTodo
  }

  async updateTodo(id: string, updates: UpdateTodoRequest): Promise<Todo> {
    const todos = await this.getTodos()
    const todoIndex = todos.findIndex(todo => todo.id === id)
    
    if (todoIndex === -1) {
      throw new Error('Todo not found')
    }
    
    const updatedTodo: Todo = {
      ...todos[todoIndex],
      ...updates,
      updatedAt: new Date()
    }
    
    todos[todoIndex] = updatedTodo
    await this.saveTodos(todos)
    
    return updatedTodo
  }

  async deleteTodo(id: string): Promise<void> {
    const todos = await this.getTodos()
    const todoIndex = todos.findIndex(todo => todo.id === id)
    
    if (todoIndex === -1) {
      throw new Error('Todo not found')
    }
    
    todos.splice(todoIndex, 1)
    await this.saveTodos(todos)
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substring(2)
  }
} 