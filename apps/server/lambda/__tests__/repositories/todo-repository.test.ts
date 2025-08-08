/**
 * TodoRepository TDD 테스트 스위트
 * Repository Layer 단위 테스트 - TDD Red-Green-Refactor 사이클
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Priority } from '@vive/types';
import { DynamoTodoItem, DynamoQueryResult, ItemNotFoundError } from '@/types/database.types';
import {
  createDynamoTodoItem,
  createMultipleTodos,
  generateTestId,
  generateTTL,
} from '../helpers/test-factories';
import { createMockDynamoDBClient } from '../helpers/mock-providers';

// Repository 인터페이스 (구현 전 정의)
interface TodoRepository {
  create(
    todo: Omit<
      DynamoTodoItem,
      | 'PK'
      | 'SK'
      | 'GSI1PK'
      | 'GSI1SK'
      | 'GSI2PK'
      | 'GSI2SK'
      | 'EntityType'
      | 'createdAt'
      | 'updatedAt'
    >
  ): Promise<DynamoTodoItem>;
  findById(userId: string, todoId: string): Promise<DynamoTodoItem | null>;
  findAll(
    userId: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<DynamoQueryResult<DynamoTodoItem>>;
  findByStatus(
    userId: string,
    completed: boolean,
    options?: { limit?: number; cursor?: string }
  ): Promise<DynamoQueryResult<DynamoTodoItem>>;
  findByPriority(
    userId: string,
    priority: Priority,
    options?: { limit?: number; cursor?: string }
  ): Promise<DynamoQueryResult<DynamoTodoItem>>;
  update(userId: string, todoId: string, updates: Partial<DynamoTodoItem>): Promise<DynamoTodoItem>;
  delete(userId: string, todoId: string): Promise<void>;
}

// 실제 Repository 구현체를 import해서 사용
import { DynamoDBTodoRepository } from '@/repositories/todo-repository';

describe('TodoRepository - TDD 테스트 스위트', () => {
  let repository: TodoRepository;
  let mockDynamoClient: ReturnType<typeof createMockDynamoDBClient>;

  beforeEach(() => {
    mockDynamoClient = createMockDynamoDBClient();
    repository = new DynamoDBTodoRepository(mockDynamoClient);
  });

  describe('create() - Red-Green-Refactor', () => {
    // RED: 실패하는 테스트 작성
    it('should throw error when DynamoDB put fails', async () => {
      // Given
      const todoData = {
        id: generateTestId('todo'),
        userId: generateTestId('user'),
        title: 'Test Todo',
        completed: false,
        priority: Priority.MEDIUM,
        isGuest: false,
      };

      const dynamoError = new Error('DynamoDB put failed');
      mockDynamoClient = createMockDynamoDBClient({
        putItem: { error: dynamoError },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When & Then
      await expect(repository.create(todoData)).rejects.toThrow('DynamoDB put failed');
    });

    // GREEN: 테스트를 통과하는 최소 구현
    it('should create a new todo with correct DynamoDB structure', async () => {
      // Given
      const todoData = {
        id: generateTestId('todo'),
        userId: generateTestId('user'),
        title: 'Test Todo',
        completed: false,
        priority: Priority.MEDIUM,
        isGuest: false,
      };

      mockDynamoClient = createMockDynamoDBClient({
        putItem: { success: true },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When
      const result = await repository.create(todoData);

      // Then
      expect(result).toHaveDynamoDBItemStructure('TODO');
      expect(result.PK).toBe(`USER#${todoData.userId}`);
      expect(result.SK).toBe(`TODO#${todoData.id}`);
      expect(result.GSI1PK).toBe(`USER#${todoData.userId}#STATUS#${todoData.completed}`);
      expect(result.GSI1SK).toMatch(/^PRIORITY#MEDIUM#/);
      expect(result.GSI2PK).toBe(`USER#${todoData.userId}`);
      expect(result.GSI2SK).toMatch(/^TITLE#test todo#/);
      expect(result.title).toBe(todoData.title);
      expect(result.completed).toBe(todoData.completed);
      expect(result.priority).toBe(todoData.priority);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    // REFACTOR: 게스트 사용자 TTL 처리
    it('should set TTL for guest user todos', async () => {
      // Given
      const guestTodoData = {
        id: generateTestId('todo'),
        userId: generateTestId('guest'),
        title: 'Guest Todo',
        completed: false,
        priority: Priority.LOW,
        isGuest: true,
        sessionId: generateTestId('session'),
        ttl: generateTTL(),
      };

      mockDynamoClient = createMockDynamoDBClient({
        putItem: { success: true },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When
      const result = await repository.create(guestTodoData);

      // Then
      expect(result.ttl).toBe(guestTodoData.ttl);
      expect(result.isGuest).toBe(true);
      expect(result.sessionId).toBe(guestTodoData.sessionId);
    });

    // Edge Case: 제목이 매우 긴 경우
    it('should handle very long titles correctly', async () => {
      // Given
      const longTitle = 'A'.repeat(500);
      const todoData = {
        id: generateTestId('todo'),
        userId: generateTestId('user'),
        title: longTitle,
        completed: false,
        priority: Priority.HIGH,
        isGuest: false,
      };

      mockDynamoClient = createMockDynamoDBClient({
        putItem: { success: true },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When
      const result = await repository.create(todoData);

      // Then
      expect(result.title).toBe(longTitle);
      expect(result.GSI2SK).toMatch(/^TITLE#a+#/); // 소문자로 변환된 제목
    });
  });

  describe('findById() - TDD 시나리오', () => {
    it('should return null when todo not found', async () => {
      // Given
      const userId = generateTestId('user');
      const todoId = generateTestId('todo');

      mockDynamoClient = createMockDynamoDBClient({
        getItem: { item: null },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When
      const result = await repository.findById(userId, todoId);

      // Then
      expect(result).toBeNull();
    });

    it('should return todo when found', async () => {
      // Given
      const userId = generateTestId('user');
      const todoId = generateTestId('todo');
      const todoItem = createDynamoTodoItem({ userId, todoId });

      mockDynamoClient = createMockDynamoDBClient({
        getItem: { item: todoItem },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When
      const result = await repository.findById(userId, todoId);

      // Then
      expect(result).not.toBeNull();
      expect(result?.id).toBe(todoId);
      expect(result?.userId).toBe(userId);
    });

    it('should throw error when DynamoDB get fails', async () => {
      // Given
      const userId = generateTestId('user');
      const todoId = generateTestId('todo');
      const dynamoError = new Error('DynamoDB get failed');

      mockDynamoClient = createMockDynamoDBClient({
        getItem: { error: dynamoError },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When & Then
      await expect(repository.findById(userId, todoId)).rejects.toThrow('DynamoDB get failed');
    });
  });

  describe('findAll() - 페이지네이션 시나리오', () => {
    it('should return empty result when no todos exist', async () => {
      // Given
      const userId = generateTestId('user');

      mockDynamoClient = createMockDynamoDBClient({
        queryItems: { items: [] },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When
      const result = await repository.findAll(userId);

      // Then
      expect(result.items).toHaveLength(0);
      expect(result.count).toBe(0);
      expect(result.lastEvaluatedKey).toBeUndefined();
    });

    it('should return todos with pagination', async () => {
      // Given
      const userId = generateTestId('user');
      const todos = createMultipleTodos(5, { userId });

      mockDynamoClient = createMockDynamoDBClient({
        queryItems: {
          items: todos.slice(0, 3), // 3개만 반환
          lastEvaluatedKey: { PK: 'test', SK: 'test' },
        },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When
      const result = await repository.findAll(userId, { limit: 3 });

      // Then
      expect(result.items).toHaveLength(3);
      expect(result.lastEvaluatedKey).toBeDefined();
      expect(result.count).toBe(3);
    });

    it('should handle cursor-based pagination', async () => {
      // Given
      const userId = generateTestId('user');
      const cursor = JSON.stringify({ PK: `USER#${userId}`, SK: 'TODO#123' });
      const todos = createMultipleTodos(2, { userId });

      mockDynamoClient = createMockDynamoDBClient({
        queryItems: { items: todos },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When
      const result = await repository.findAll(userId, { cursor });

      // Then
      expect(result.items).toHaveLength(2);
      // DynamoDB 클라이언트가 올바른 ExclusiveStartKey로 호출되었는지 확인
      expect(mockDynamoClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          ExclusiveStartKey: JSON.parse(cursor),
        })
      );
    });
  });

  describe('findByStatus() - 상태별 조회', () => {
    it('should find completed todos only', async () => {
      // Given
      const userId = generateTestId('user');
      const completedTodos = createMultipleTodos(3, { userId, completed: true });

      mockDynamoClient = createMockDynamoDBClient({
        queryItems: { items: completedTodos },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When
      const result = await repository.findByStatus(userId, true);

      // Then
      expect(result.items).toHaveLength(3);
      result.items.forEach(todo => {
        expect(todo.completed).toBe(true);
      });

      // GSI1 인덱스 사용 확인
      expect(mockDynamoClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :gsi1pk',
          ExpressionAttributeValues: {
            ':gsi1pk': `USER#${userId}#STATUS#true`,
          },
        })
      );
    });

    it('should find active todos only', async () => {
      // Given
      const userId = generateTestId('user');
      const activeTodos = createMultipleTodos(2, { userId, completed: false });

      mockDynamoClient = createMockDynamoDBClient({
        queryItems: { items: activeTodos },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When
      const result = await repository.findByStatus(userId, false);

      // Then
      expect(result.items).toHaveLength(2);
      result.items.forEach(todo => {
        expect(todo.completed).toBe(false);
      });
    });
  });

  describe('findByPriority() - 우선순위별 조회', () => {
    it('should find high priority todos', async () => {
      // Given
      const userId = generateTestId('user');
      const highPriorityTodos = createMultipleTodos(2, {
        userId,
        priority: Priority.HIGH,
        completed: false,
      });

      mockDynamoClient = createMockDynamoDBClient({
        queryItems: { items: highPriorityTodos },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When
      const result = await repository.findByPriority(userId, Priority.HIGH);

      // Then
      expect(result.items).toHaveLength(2);
      result.items.forEach(todo => {
        expect(todo.priority).toBe(Priority.HIGH);
        expect(todo.completed).toBe(false); // 미완료만 검색
      });

      // 올바른 GSI1 쿼리 확인
      expect(mockDynamoClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :priority)',
          ExpressionAttributeValues: {
            ':gsi1pk': `USER#${userId}#STATUS#false`,
            ':priority': 'PRIORITY#HIGH',
          },
        })
      );
    });
  });

  describe('update() - 업데이트 시나리오', () => {
    it('should update todo fields correctly', async () => {
      // Given
      const userId = generateTestId('user');
      const todoId = generateTestId('todo');
      const updates = {
        title: 'Updated Title',
        completed: true,
        priority: Priority.HIGH,
      };
      const updatedTodo = createDynamoTodoItem({
        userId,
        todoId,
        ...updates,
        updatedAt: global.testUtils.getFixedTimestamp(),
      });

      mockDynamoClient = createMockDynamoDBClient({
        updateItem: { response: { Attributes: updatedTodo } },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When
      const result = await repository.update(userId, todoId, updates);

      // Then
      expect(result.title).toBe(updates.title);
      expect(result.completed).toBe(updates.completed);
      expect(result.priority).toBe(updates.priority);
      expect(result.updatedAt).toBeDefined();
    });

    it('should throw ItemNotFoundError when todo does not exist', async () => {
      // Given
      const userId = generateTestId('user');
      const todoId = generateTestId('todo');
      const updates = { title: 'Updated Title' };

      mockDynamoClient = createMockDynamoDBClient({
        updateItem: { response: { Attributes: null } },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When & Then
      await expect(repository.update(userId, todoId, updates)).rejects.toThrow(ItemNotFoundError);
    });

    it('should ignore undefined values in updates', async () => {
      // Given
      const userId = generateTestId('user');
      const todoId = generateTestId('todo');
      const updates = {
        title: 'Updated Title',
        completed: undefined, // 이 필드는 무시되어야 함
        priority: Priority.LOW,
      };

      const updatedTodo = createDynamoTodoItem({ userId, todoId });
      mockDynamoClient = createMockDynamoDBClient({
        updateItem: { response: { Attributes: updatedTodo } },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When
      await repository.update(userId, todoId, updates);

      // Then - UpdateExpression에 completed가 포함되지 않았는지 확인
      expect(mockDynamoClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          UpdateExpression: expect.not.stringContaining('completed'),
        })
      );
    });
  });

  describe('delete() - 삭제 시나리오', () => {
    it('should delete todo successfully', async () => {
      // Given
      const userId = generateTestId('user');
      const todoId = generateTestId('todo');

      mockDynamoClient = createMockDynamoDBClient({
        deleteItem: { success: true },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When & Then
      await expect(repository.delete(userId, todoId)).resolves.not.toThrow();

      // DynamoDB delete가 올바른 키로 호출되었는지 확인
      expect(mockDynamoClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          Key: {
            PK: `USER#${userId}`,
            SK: `TODO#${todoId}`,
          },
        })
      );
    });

    it('should handle delete errors gracefully', async () => {
      // Given
      const userId = generateTestId('user');
      const todoId = generateTestId('todo');
      const deleteError = new Error('DynamoDB delete failed');

      mockDynamoClient = createMockDynamoDBClient({
        deleteItem: { error: deleteError },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When & Then
      await expect(repository.delete(userId, todoId)).rejects.toThrow('DynamoDB delete failed');
    });
  });

  // 성능 테스트
  describe('Performance Tests', () => {
    it('should handle large batch queries efficiently', async () => {
      // Given
      const userId = generateTestId('user');
      const largeBatchTodos = createMultipleTodos(1000, { userId });

      mockDynamoClient = createMockDynamoDBClient({
        queryItems: { items: largeBatchTodos },
      });
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When
      const startTime = process.hrtime.bigint();
      const result = await repository.findAll(userId);
      const endTime = process.hrtime.bigint();

      // Then
      expect(result.items).toHaveLength(1000);

      // 성능 체크 (1초 이내)
      const executionTime = Number(endTime - startTime) / 1000000; // 밀리초로 변환
      expect(executionTime).toBeLessThan(1000);
    });

    it('should timeout on long operations', async () => {
      // Given
      const userId = generateTestId('user');

      // 5초 후에 응답하는 Promise
      mockDynamoClient = createMockDynamoDBClient();
      mockDynamoClient.send.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 5000))
      );
      repository = new DynamoDBTodoRepository(mockDynamoClient);

      // When & Then - 3초 타임아웃 설정
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), 3000)
      );

      await expect(Promise.race([repository.findAll(userId), timeoutPromise])).rejects.toThrow(
        'Operation timeout'
      );
    });
  });
});
