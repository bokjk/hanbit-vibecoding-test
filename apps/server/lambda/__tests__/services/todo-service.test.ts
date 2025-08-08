/**
 * TodoService TDD 테스트 스위트
 * Service Layer 비즈니스 로직 테스트 - TDD Red-Green-Refactor 사이클
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Priority } from '@/types/constants';
import { DynamoTodoItem, DynamoQueryResult, ItemNotFoundError } from '@/types/database.types';
import { ListTodosRequest } from '@/types/api.types';
import {
  createCreateTodoRequest,
  createUpdateTodoRequest,
  createAuthContext,
  createDynamoTodoItem,
  createMultipleTodos,
  generateTestId,
  generateTTL,
} from '../helpers/test-factories';
import { createMockTodoRepository } from '../helpers/mock-providers';
import { TodoService, Logger } from '@/services/todo.service';

describe('TodoService - TDD 테스트 스위트', () => {
  let service: TodoService;
  let mockRepository: any;
  let mockLogger: Logger;

  beforeEach(() => {
    mockRepository = createMockTodoRepository();
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    service = new TodoService(mockRepository, mockLogger);
  });

  describe('createTodo() - Red-Green-Refactor', () => {
    // RED: 실패하는 테스트 작성
    it('should throw error when user lacks create permission', async () => {
      // Given
      const authContext = createAuthContext({
        permissions: { canCreate: false },
      });
      const request = createCreateTodoRequest();

      // When & Then
      await expect(service.createTodo(authContext, request)).rejects.toThrow(
        'CREATE_PERMISSION_DENIED'
      );
    });

    // GREEN: 테스트를 통과하는 최소 구현
    it('should create todo successfully with valid permissions', async () => {
      // Given
      const authContext = createAuthContext();
      const request = createCreateTodoRequest({
        title: 'Test Todo',
        priority: Priority.HIGH,
      });
      const createdTodo = createDynamoTodoItem({
        userId: authContext.userId,
        title: request.title,
        priority: request.priority,
      });

      mockRepository.create.mockResolvedValue(createdTodo);

      // When
      const result = await service.createTodo(authContext, request);

      // Then
      expect(result.title).toBe(request.title);
      expect(result.priority).toBe(request.priority);
      expect(result.completed).toBe(false);
      expect(result.userId).toBe(authContext.userId);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: request.title,
          priority: request.priority,
          completed: false,
          userId: authContext.userId,
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Todo created',
        expect.objectContaining({
          userId: authContext.userId,
          userType: authContext.userType,
        })
      );
    });

    // REFACTOR: 게스트 사용자 제한 처리
    it('should enforce guest user todo limit', async () => {
      // Given
      const guestAuthContext = createAuthContext({
        userType: 'guest',
        permissions: { canCreate: true, maxItems: 2 },
      });
      const request = createCreateTodoRequest();

      // 이미 2개의 Todo가 존재
      mockRepository.findAll.mockResolvedValue({
        items: createMultipleTodos(2),
        count: 2,
      });

      // When & Then
      await expect(service.createTodo(guestAuthContext, request)).rejects.toThrow(
        'Guest users can only create up to 2 todos'
      );
    });

    it('should set TTL for guest todos when persistData is true', async () => {
      // Given
      const guestAuthContext = createAuthContext({
        userType: 'guest',
        sessionId: generateTestId('session'),
        permissions: { canCreate: true, persistData: true, maxItems: 10 },
      });
      const request = createCreateTodoRequest();
      const createdTodo = createDynamoTodoItem({
        isGuest: true,
        sessionId: guestAuthContext.sessionId,
        ttl: generateTTL(),
      });

      mockRepository.findAll.mockResolvedValue({ count: 0, items: [] });
      mockRepository.create.mockResolvedValue(createdTodo);

      // When
      const result = await service.createTodo(guestAuthContext, request);

      // Then
      expect(result.isGuest).toBe(true);
      expect(result.sessionId).toBe(guestAuthContext.sessionId);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isGuest: true,
          sessionId: guestAuthContext.sessionId,
          ttl: expect.any(Number),
        })
      );
    });

    it('should use default priority when not specified', async () => {
      // Given
      const authContext = createAuthContext();
      const request = createCreateTodoRequest();
      delete request.priority; // priority 제거

      const createdTodo = createDynamoTodoItem({
        priority: Priority.MEDIUM,
      });
      mockRepository.create.mockResolvedValue(createdTodo);

      // When
      await service.createTodo(authContext, request);

      // Then
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: Priority.MEDIUM,
        })
      );
    });
  });

  describe('getTodoById() - 조회 및 권한 검증', () => {
    it('should throw error when todo not found', async () => {
      // Given
      const authContext = createAuthContext();
      const todoId = generateTestId('todo');

      mockRepository.findById.mockResolvedValue(null);

      // When & Then
      await expect(service.getTodoById(authContext, todoId)).rejects.toThrow(ItemNotFoundError);
    });

    it('should return todo when found and user has permission', async () => {
      // Given
      const authContext = createAuthContext();
      const todoId = generateTestId('todo');
      const todo = createDynamoTodoItem({
        userId: authContext.userId,
        todoId,
      });

      mockRepository.findById.mockResolvedValue(todo);

      // When
      const result = await service.getTodoById(authContext, todoId);

      // Then
      expect(result.id).toBe(todoId);
      expect(result.userId).toBe(authContext.userId);
    });

    it('should deny access to todo from different guest session', async () => {
      // Given
      const guestAuthContext = createAuthContext({
        userType: 'guest',
        sessionId: 'session-1',
      });
      const todoId = generateTestId('todo');
      const todo = createDynamoTodoItem({
        userId: guestAuthContext.userId,
        todoId,
        isGuest: true,
        sessionId: 'session-2', // 다른 세션
      });

      mockRepository.findById.mockResolvedValue(todo);

      // When & Then
      await expect(service.getTodoById(guestAuthContext, todoId)).rejects.toThrow(
        'Access denied: Todo belongs to different session'
      );
    });

    it('should throw error when user lacks read permission', async () => {
      // Given
      const authContext = createAuthContext({
        permissions: { canRead: false },
      });
      const todoId = generateTestId('todo');

      // When & Then
      await expect(service.getTodoById(authContext, todoId)).rejects.toThrow(
        'read_PERMISSION_DENIED'
      );
    });
  });

  describe('listTodos() - 필터링 및 페이지네이션', () => {
    it('should list all todos when no filter specified', async () => {
      // Given
      const authContext = createAuthContext();
      const todos = createMultipleTodos(3, { userId: authContext.userId });
      const queryResult: DynamoQueryResult<DynamoTodoItem> = {
        items: todos,
        count: todos.length,
        scannedCount: todos.length,
      };

      mockRepository.findAll.mockResolvedValue(queryResult);

      // When
      const result = await service.listTodos(authContext);

      // Then
      expect(result.items).toHaveLength(3);
      expect(result.count).toBe(3);
      expect(mockRepository.findAll).toHaveBeenCalledWith(
        authContext.userId,
        expect.objectContaining({})
      );
    });

    it('should filter active todos', async () => {
      // Given
      const authContext = createAuthContext();
      const activeTodos = createMultipleTodos(2, {
        userId: authContext.userId,
        completed: false,
      });
      const queryResult: DynamoQueryResult<DynamoTodoItem> = {
        items: activeTodos,
        count: activeTodos.length,
        scannedCount: activeTodos.length,
      };

      mockRepository.findByStatus.mockResolvedValue(queryResult);

      // When
      const result = await service.listTodos(authContext, { status: 'active' });

      // Then
      expect(result.items).toHaveLength(2);
      result.items.forEach(todo => expect(todo.completed).toBe(false));
      expect(mockRepository.findByStatus).toHaveBeenCalledWith(
        authContext.userId,
        false,
        expect.any(Object)
      );
    });

    it('should filter completed todos', async () => {
      // Given
      const authContext = createAuthContext();
      const completedTodos = createMultipleTodos(1, {
        userId: authContext.userId,
        completed: true,
      });
      const queryResult: DynamoQueryResult<DynamoTodoItem> = {
        items: completedTodos,
        count: completedTodos.length,
        scannedCount: completedTodos.length,
      };

      mockRepository.findByStatus.mockResolvedValue(queryResult);

      // When
      const result = await service.listTodos(authContext, { status: 'completed' });

      // Then
      expect(result.items).toHaveLength(1);
      result.items.forEach(todo => expect(todo.completed).toBe(true));
    });

    it('should filter by priority', async () => {
      // Given
      const authContext = createAuthContext();
      const highPriorityTodos = createMultipleTodos(2, {
        userId: authContext.userId,
        priority: Priority.HIGH,
      });
      const queryResult: DynamoQueryResult<DynamoTodoItem> = {
        items: highPriorityTodos,
        count: highPriorityTodos.length,
        scannedCount: highPriorityTodos.length,
      };

      mockRepository.findByPriority.mockResolvedValue(queryResult);

      // When
      const result = await service.listTodos(authContext, { priority: Priority.HIGH });

      // Then
      expect(result.items).toHaveLength(2);
      result.items.forEach(todo => expect(todo.priority).toBe(Priority.HIGH));
    });

    it('should filter guest todos by session', async () => {
      // Given
      const guestAuthContext = createAuthContext({
        userType: 'guest',
        sessionId: 'session-1',
      });

      const mixedTodos = [
        createDynamoTodoItem({
          userId: guestAuthContext.userId,
          sessionId: 'session-1', // 같은 세션
        }),
        createDynamoTodoItem({
          userId: guestAuthContext.userId,
          sessionId: 'session-2', // 다른 세션
        }),
        createDynamoTodoItem({
          userId: guestAuthContext.userId,
          sessionId: 'session-1', // 같은 세션
        }),
      ];

      const queryResult: DynamoQueryResult<DynamoTodoItem> = {
        items: mixedTodos,
        count: mixedTodos.length,
        scannedCount: mixedTodos.length,
      };

      mockRepository.findAll.mockResolvedValue(queryResult);

      // When
      const result = await service.listTodos(guestAuthContext);

      // Then
      expect(result.items).toHaveLength(2); // session-1에 속한 2개만
      expect(result.count).toBe(2);
      result.items.forEach(todo => expect(todo.sessionId).toBe('session-1'));
    });

    it('should handle pagination options', async () => {
      // Given
      const authContext = createAuthContext();
      const request: ListTodosRequest = {
        limit: 10,
        cursor: 'some-cursor',
      };

      mockRepository.findAll.mockResolvedValue({
        items: [],
        count: 0,
        scannedCount: 0,
      });

      // When
      await service.listTodos(authContext, request);

      // Then
      expect(mockRepository.findAll).toHaveBeenCalledWith(
        authContext.userId,
        expect.objectContaining({
          limit: 10,
          cursor: 'some-cursor',
        })
      );
    });
  });

  describe('updateTodo() - 업데이트 및 권한 검증', () => {
    it('should update todo successfully', async () => {
      // Given
      const authContext = createAuthContext();
      const todoId = generateTestId('todo');
      const updateRequest = createUpdateTodoRequest({
        title: 'Updated Title',
        completed: true,
        priority: Priority.LOW,
      });

      const existingTodo = createDynamoTodoItem({
        userId: authContext.userId,
        todoId,
      });
      const updatedTodo = { ...existingTodo, ...updateRequest };

      mockRepository.findById.mockResolvedValue(existingTodo);
      mockRepository.update.mockResolvedValue(updatedTodo);

      // When
      const result = await service.updateTodo(authContext, todoId, updateRequest);

      // Then
      expect(result.title).toBe(updateRequest.title);
      expect(result.completed).toBe(updateRequest.completed);
      expect(result.priority).toBe(updateRequest.priority);
      expect(mockRepository.update).toHaveBeenCalledWith(
        authContext.userId,
        todoId,
        expect.objectContaining(updateRequest)
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Todo updated',
        expect.objectContaining({
          todoId,
          userId: authContext.userId,
        })
      );
    });

    it('should throw error when todo not found', async () => {
      // Given
      const authContext = createAuthContext();
      const todoId = generateTestId('todo');
      const updateRequest = createUpdateTodoRequest();

      mockRepository.findById.mockResolvedValue(null);

      // When & Then
      await expect(service.updateTodo(authContext, todoId, updateRequest)).rejects.toThrow(
        ItemNotFoundError
      );
    });

    it('should only update specified fields', async () => {
      // Given
      const authContext = createAuthContext();
      const todoId = generateTestId('todo');
      const updateRequest = { title: 'Updated Title' }; // completed, priority는 undefined

      const existingTodo = createDynamoTodoItem({
        userId: authContext.userId,
        todoId,
      });

      mockRepository.findById.mockResolvedValue(existingTodo);
      mockRepository.update.mockResolvedValue(existingTodo);

      // When
      await service.updateTodo(authContext, todoId, updateRequest);

      // Then
      expect(mockRepository.update).toHaveBeenCalledWith(authContext.userId, todoId, {
        title: 'Updated Title',
      });
    });
  });

  describe('deleteTodo() - 삭제 및 권한 검증', () => {
    it('should delete todo successfully', async () => {
      // Given
      const authContext = createAuthContext();
      const todoId = generateTestId('todo');
      const existingTodo = createDynamoTodoItem({
        userId: authContext.userId,
        todoId,
      });

      mockRepository.findById.mockResolvedValue(existingTodo);
      mockRepository.delete.mockResolvedValue(undefined);

      // When
      await service.deleteTodo(authContext, todoId);

      // Then
      expect(mockRepository.delete).toHaveBeenCalledWith(authContext.userId, todoId);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Todo deleted',
        expect.objectContaining({
          todoId,
          userId: authContext.userId,
        })
      );
    });

    it('should throw error when todo not found', async () => {
      // Given
      const authContext = createAuthContext();
      const todoId = generateTestId('todo');

      mockRepository.findById.mockResolvedValue(null);

      // When & Then
      await expect(service.deleteTodo(authContext, todoId)).rejects.toThrow(ItemNotFoundError);
    });
  });

  describe('validatePermissions() - 권한 검증', () => {
    it('should validate CREATE permission', async () => {
      // Given
      const authContext = createAuthContext({
        permissions: { canCreate: false },
      });

      // When & Then
      await expect(service.validatePermissions(authContext, 'CREATE')).rejects.toThrow(
        'CREATE_PERMISSION_DENIED'
      );
    });

    it('should validate READ permission', async () => {
      // Given
      const authContext = createAuthContext({
        permissions: { canRead: false },
      });

      // When & Then
      await expect(service.validatePermissions(authContext, 'READ')).rejects.toThrow(
        'read_PERMISSION_DENIED'
      );
    });

    it('should validate UPDATE permission', async () => {
      // Given
      const authContext = createAuthContext({
        permissions: { canUpdate: false },
      });

      // When & Then
      await expect(service.validatePermissions(authContext, 'UPDATE')).rejects.toThrow(
        'UPDATE_PERMISSION_DENIED'
      );
    });

    it('should validate DELETE permission', async () => {
      // Given
      const authContext = createAuthContext({
        permissions: { canDelete: false },
      });

      // When & Then
      await expect(service.validatePermissions(authContext, 'DELETE')).rejects.toThrow(
        'DELETE_PERMISSION_DENIED'
      );
    });

    it('should throw error for unknown action', async () => {
      // Given
      const authContext = createAuthContext();

      // When & Then
      await expect(service.validatePermissions(authContext, 'UNKNOWN')).rejects.toThrow(
        'Unknown action: UNKNOWN'
      );
    });

    it('should pass when user has required permission', async () => {
      // Given
      const authContext = createAuthContext({
        permissions: { canCreate: true },
      });

      // When & Then
      await expect(service.validatePermissions(authContext, 'CREATE')).resolves.not.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle repository errors gracefully', async () => {
      // Given
      const authContext = createAuthContext();
      const request = createCreateTodoRequest();
      const repositoryError = new Error('Database connection failed');

      mockRepository.create.mockRejectedValue(repositoryError);

      // When & Then
      await expect(service.createTodo(authContext, request)).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle concurrent access for guest user limits', async () => {
      // Given
      const guestAuthContext = createAuthContext({
        userType: 'guest',
        permissions: { canCreate: true, maxItems: 1 },
      });
      const request = createCreateTodoRequest();

      // 동시에 두 개의 Todo 생성 시도
      mockRepository.findAll
        .mockResolvedValueOnce({ count: 0, items: [] }) // 첫 번째 호출
        .mockResolvedValueOnce({ count: 1, items: [createDynamoTodoItem()] }); // 두 번째 호출

      const createdTodo = createDynamoTodoItem();
      mockRepository.create.mockResolvedValue(createdTodo);

      // When
      const [result1, result2] = await Promise.allSettled([
        service.createTodo(guestAuthContext, request),
        service.createTodo(guestAuthContext, request),
      ]);

      // Then - 하나는 성공, 하나는 실패해야 함
      const results = [result1, result2];
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(1);
    });
  });
});
