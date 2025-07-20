import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LocalStorageService } from './localStorage.service'
import { Todo, Priority, CreateTodoRequest, UpdateTodoRequest } from 'types'

// localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    })
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('LocalStorageService', () => {
  let service: LocalStorageService
  
  beforeEach(() => {
    service = new LocalStorageService()
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('getTodos', () => {
    it('빈 배열을 반환해야 함 (데이터가 없을 때)', async () => {
      localStorageMock.getItem.mockReturnValue(null)
      
      const todos = await service.getTodos()
      
      expect(todos).toEqual([])
      expect(localStorageMock.getItem).toHaveBeenCalledWith('todos')
    })

    it('저장된 todos를 반환해야 함', async () => {
      const mockTodos: Todo[] = [
        {
          id: '1',
          title: 'Test Todo',
          completed: false,
          priority: Priority.MEDIUM,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01')
        }
      ]
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockTodos))
      
      const todos = await service.getTodos()
      
      expect(todos).toEqual(mockTodos)
    })

    it('잘못된 JSON 데이터가 있을 때 빈 배열을 반환해야 함', async () => {
      localStorageMock.getItem.mockReturnValue('invalid json')
      
      const todos = await service.getTodos()
      
      expect(todos).toEqual([])
    })
  })

  describe('addTodo', () => {
    it('새로운 todo를 추가하고 반환해야 함', async () => {
      const request: CreateTodoRequest = {
        title: 'New Todo',
        priority: Priority.HIGH
      }
      
      const todo = await service.addTodo(request)
      
      expect(todo.id).toBeDefined()
      expect(todo.title).toBe(request.title)
      expect(todo.priority).toBe(request.priority)
      expect(todo.completed).toBe(false)
      expect(todo.createdAt).toBeInstanceOf(Date)
      expect(todo.updatedAt).toBeInstanceOf(Date)
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })

    it('기존 todos에 새 todo를 추가해야 함', async () => {
      const existingTodos: Todo[] = [
        {
          id: '1',
          title: 'Existing Todo',
          completed: false,
          priority: Priority.LOW,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01')
        }
      ]
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingTodos))
      
      const request: CreateTodoRequest = {
        title: 'New Todo',
        priority: Priority.HIGH
      }
      
      await service.addTodo(request)
      
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
      expect(savedData).toHaveLength(2)
      expect(savedData[1].title).toBe(request.title)
    })
  })

  describe('updateTodo', () => {
    it('기존 todo를 업데이트해야 함', async () => {
      const existingTodos: Todo[] = [
        {
          id: '1',
          title: 'Original Todo',
          completed: false,
          priority: Priority.LOW,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01')
        }
      ]
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingTodos))
      
      const updates: UpdateTodoRequest = {
        title: 'Updated Todo',
        completed: true,
        priority: Priority.HIGH
      }
      
      const updatedTodo = await service.updateTodo('1', updates)
      
      expect(updatedTodo.id).toBe('1')
      expect(updatedTodo.title).toBe(updates.title)
      expect(updatedTodo.completed).toBe(updates.completed)
      expect(updatedTodo.priority).toBe(updates.priority)
      expect(updatedTodo.updatedAt.getTime()).toBeGreaterThan(updatedTodo.createdAt.getTime())
    })

    it('존재하지 않는 todo 업데이트 시 에러를 던져야 함', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify([]))
      
      await expect(service.updateTodo('nonexistent', { title: 'Updated' }))
        .rejects.toThrow('Todo not found')
    })
  })

  describe('deleteTodo', () => {
    it('지정된 todo를 삭제해야 함', async () => {
      const existingTodos: Todo[] = [
        {
          id: '1',
          title: 'Todo 1',
          completed: false,
          priority: Priority.MEDIUM,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: '2',
          title: 'Todo 2',
          completed: false,
          priority: Priority.LOW,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingTodos))
      
      await service.deleteTodo('1')
      
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
      expect(savedData).toHaveLength(1)
      expect(savedData[0].id).toBe('2')
    })

    it('존재하지 않는 todo 삭제 시 에러를 던져야 함', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify([]))
      
      await expect(service.deleteTodo('nonexistent'))
        .rejects.toThrow('Todo not found')
    })
  })

  describe('saveTodos', () => {
    it('todos 배열을 localStorage에 저장해야 함', async () => {
      const todos: Todo[] = [
        {
          id: '1',
          title: 'Test Todo',
          completed: false,
          priority: Priority.MEDIUM,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]
      
      await service.saveTodos(todos)
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('todos', JSON.stringify(todos))
    })
  })
}) 