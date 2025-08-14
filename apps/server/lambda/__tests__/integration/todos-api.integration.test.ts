import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Context } from 'aws-lambda';
import { TestContainer } from '../utils/test-container';
import { TestDataFactory } from '../utils/test-data-factory';
import { createMockAPIGatewayEvent, createMockLambdaContext } from '../utils/mock-helpers';

// Lambda 핸들러 import (실제 경로에 맞게 수정 필요)
import { handler as getTodosHandler } from '../../handlers/todos/list';
import { handler as createTodoHandler } from '../../handlers/todos/create';
import { handler as updateTodoHandler } from '../../handlers/todos/update';
import { handler as deleteTodoHandler } from '../../handlers/todos/delete';

/**
 * Todo API 통합 테스트
 * 실제 DynamoDB Local과 Lambda 핸들러를 사용하여
 * 전체 API 워크플로우를 검증합니다.
 */
describe('Todo API 통합 테스트', () => {
  let testContainer: TestContainer;
  let lambdaContext: Context;

  beforeAll(async () => {
    testContainer = new TestContainer();
    await testContainer.setup();
    lambdaContext = createMockLambdaContext();
  });

  afterAll(async () => {
    await testContainer.teardown();
  });

  beforeEach(async () => {
    await testContainer.clearTables();
  });

  describe('GET /todos - Todo 목록 조회', () => {
    it('새 사용자의 빈 Todo 목록을 반환한다', async () => {
      // Given
      const userId = 'new-user-123';
      const event = createMockAPIGatewayEvent(
        'GET',
        '/todos',
        null,
        null,
        null,
        {},
        {
          userId,
          userType: 'authenticated',
          permissions: JSON.stringify({ maxItems: 1000 }),
        }
      );

      // When
      const response = await getTodosHandler(event, lambdaContext);

      // Then
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.todos).toEqual([]);
      expect(body.data.pagination.totalCount).toBe(0);
    });

    it('페이지네이션과 함께 사용자 Todo를 반환한다', async () => {
      // Given
      const userId = 'user-with-todos';
      const todos = TestDataFactory.createTodos(25, { userId });

      // 테스트 데이터 직접 삽입 (실제 DynamoDB에)
      const documentClient = testContainer.getDocumentClient();
      for (const todo of todos) {
        await documentClient.put({
          TableName: 'test-todos',
          Item: todo,
        });
      }

      const event = createMockAPIGatewayEvent(
        'GET',
        '/todos',
        null,
        { limit: '10', page: '1' },
        null,
        {},
        { userId, userType: 'authenticated' }
      );

      // When
      const response = await getTodosHandler(event, lambdaContext);

      // Then
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.todos).toHaveLength(10);
      expect(body.data.pagination.totalCount).toBe(25);
      expect(body.data.pagination.hasNextPage).toBe(true);
      expect(body.data.pagination.currentPage).toBe(1);
    });

    it('필터링된 Todo 목록을 반환한다', async () => {
      // Given
      const userId = 'filter-test-user';
      const completedTodos = TestDataFactory.createTodos(5, { userId, completed: true });
      const activeTodos = TestDataFactory.createTodos(10, { userId, completed: false });

      const documentClient = testContainer.getDocumentClient();
      for (const todo of [...completedTodos, ...activeTodos]) {
        await documentClient.put({
          TableName: 'test-todos',
          Item: todo,
        });
      }

      const event = createMockAPIGatewayEvent(
        'GET',
        '/todos',
        null,
        { status: 'active' },
        null,
        {},
        { userId, userType: 'authenticated' }
      );

      // When
      const response = await getTodosHandler(event, lambdaContext);

      // Then
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.todos).toHaveLength(10);
      expect(body.data.todos.every((todo: any) => !todo.completed)).toBe(true);
    });
  });

  describe('POST /todos - Todo 생성', () => {
    it('유효한 데이터로 새 Todo를 생성한다', async () => {
      // Given
      const userId = 'create-test-user';
      const todoData = TestDataFactory.createTodoRequest({
        title: '통합 테스트 Todo',
        priority: 'high',
      });

      const event = createMockAPIGatewayEvent(
        'POST',
        '/todos',
        todoData,
        null,
        null,
        {},
        { userId, userType: 'authenticated' }
      );

      // When
      const response = await createTodoHandler(event, lambdaContext);

      // Then
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.todo).toMatchObject({
        title: '통합 테스트 Todo',
        priority: 'high',
        completed: false,
        userId,
        isGuest: false,
      });
      expect(body.data.todo.id).toBeDefined();
      expect(body.data.todo.createdAt).toBeDefined();
      expect(body.data.todo.updatedAt).toBeDefined();

      // 실제 DB에 저장되었는지 확인
      const documentClient = testContainer.getDocumentClient();
      const stored = await documentClient.get({
        TableName: 'test-todos',
        Key: { userId, id: body.data.todo.id },
      });
      expect(stored.Item).toBeDefined();
    });

    it('잘못된 데이터는 거부한다', async () => {
      // Given
      const userId = 'validation-test-user';
      const invalidRequests = TestDataFactory.createInvalidTodoRequest();

      for (const invalidData of invalidRequests) {
        const event = createMockAPIGatewayEvent(
          'POST',
          '/todos',
          invalidData,
          null,
          null,
          {},
          { userId, userType: 'authenticated' }
        );

        // When
        const response = await createTodoHandler(event, lambdaContext);

        // Then
        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(false);
        expect(body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('게스트 사용자 할당량을 검증한다', async () => {
      // Given
      const guestUserId = 'guest-session-123';

      // 게스트 최대 할당량(10개)만큼 Todo 생성
      const maxTodos = TestDataFactory.createTodos(10, { userId: guestUserId, isGuest: true });
      const documentClient = testContainer.getDocumentClient();

      for (const todo of maxTodos) {
        await documentClient.put({
          TableName: 'test-todos',
          Item: todo,
        });
      }

      const todoData = TestDataFactory.createTodoRequest();
      const event = createMockAPIGatewayEvent(
        'POST',
        '/todos',
        todoData,
        null,
        null,
        {},
        {
          userId: guestUserId,
          userType: 'guest',
          permissions: JSON.stringify({ maxItems: 10 }),
        }
      );

      // When
      const response = await createTodoHandler(event, lambdaContext);

      // Then
      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('QUOTA_EXCEEDED');
    });
  });

  describe('PUT /todos/{id} - Todo 업데이트', () => {
    it('기존 Todo를 성공적으로 업데이트한다', async () => {
      // Given
      const userId = 'update-test-user';
      const originalTodo = TestDataFactory.createTodo({ userId });

      const documentClient = testContainer.getDocumentClient();
      await documentClient.put({
        TableName: 'test-todos',
        Item: originalTodo,
      });

      const updateData = {
        title: '업데이트된 Todo 제목',
        priority: 'low' as const,
        completed: true,
      };

      const event = createMockAPIGatewayEvent(
        'PUT',
        `/todos/${originalTodo.id}`,
        updateData,
        null,
        { id: originalTodo.id },
        {},
        { userId, userType: 'authenticated' }
      );

      // When
      const response = await updateTodoHandler(event, lambdaContext);

      // Then
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.todo).toMatchObject({
        id: originalTodo.id,
        title: '업데이트된 Todo 제목',
        priority: 'low',
        completed: true,
        userId,
      });
      expect(body.data.todo.updatedAt).not.toBe(originalTodo.updatedAt);
    });

    it('존재하지 않는 Todo 업데이트는 404를 반환한다', async () => {
      // Given
      const userId = 'not-found-user';
      const nonExistentId = 'non-existent-todo-id';
      const updateData = { title: '업데이트 시도' };

      const event = createMockAPIGatewayEvent(
        'PUT',
        `/todos/${nonExistentId}`,
        updateData,
        null,
        { id: nonExistentId },
        {},
        { userId, userType: 'authenticated' }
      );

      // When
      const response = await updateTodoHandler(event, lambdaContext);

      // Then
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('TODO_NOT_FOUND');
    });

    it('다른 사용자의 Todo 업데이트는 403을 반환한다', async () => {
      // Given
      const originalUserId = 'original-user';
      const otherUserId = 'other-user';
      const todo = TestDataFactory.createTodo({ userId: originalUserId });

      const documentClient = testContainer.getDocumentClient();
      await documentClient.put({
        TableName: 'test-todos',
        Item: todo,
      });

      const updateData = { title: '다른 사용자 Todo 수정 시도' };
      const event = createMockAPIGatewayEvent(
        'PUT',
        `/todos/${todo.id}`,
        updateData,
        null,
        { id: todo.id },
        {},
        { userId: otherUserId, userType: 'authenticated' }
      );

      // When
      const response = await updateTodoHandler(event, lambdaContext);

      // Then
      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('DELETE /todos/{id} - Todo 삭제', () => {
    it('기존 Todo를 성공적으로 삭제한다', async () => {
      // Given
      const userId = 'delete-test-user';
      const todo = TestDataFactory.createTodo({ userId });

      const documentClient = testContainer.getDocumentClient();
      await documentClient.put({
        TableName: 'test-todos',
        Item: todo,
      });

      const event = createMockAPIGatewayEvent(
        'DELETE',
        `/todos/${todo.id}`,
        null,
        null,
        { id: todo.id },
        {},
        { userId, userType: 'authenticated' }
      );

      // When
      const response = await deleteTodoHandler(event, lambdaContext);

      // Then
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      // 실제로 삭제되었는지 확인
      const deleted = await documentClient.get({
        TableName: 'test-todos',
        Key: { userId, id: todo.id },
      });
      expect(deleted.Item).toBeUndefined();
    });

    it('존재하지 않는 Todo 삭제는 404를 반환한다', async () => {
      // Given
      const userId = 'delete-not-found-user';
      const nonExistentId = 'non-existent-todo-id';

      const event = createMockAPIGatewayEvent(
        'DELETE',
        `/todos/${nonExistentId}`,
        null,
        null,
        { id: nonExistentId },
        {},
        { userId, userType: 'authenticated' }
      );

      // When
      const response = await deleteTodoHandler(event, lambdaContext);

      // Then
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('TODO_NOT_FOUND');
    });
  });

  describe('전체 워크플로우 테스트', () => {
    it('Todo의 전체 생명주기를 테스트한다', async () => {
      const userId = 'lifecycle-test-user';

      // 1. Todo 생성
      const createData = TestDataFactory.createTodoRequest({
        title: '생명주기 테스트 Todo',
        priority: 'medium',
      });

      const createEvent = createMockAPIGatewayEvent(
        'POST',
        '/todos',
        createData,
        null,
        null,
        {},
        { userId, userType: 'authenticated' }
      );

      const createResponse = await createTodoHandler(createEvent, lambdaContext);
      expect(createResponse.statusCode).toBe(201);
      const createdTodo = JSON.parse(createResponse.body).data.todo;

      // 2. Todo 목록에서 확인
      const listEvent = createMockAPIGatewayEvent(
        'GET',
        '/todos',
        null,
        null,
        null,
        {},
        { userId, userType: 'authenticated' }
      );

      const listResponse = await getTodosHandler(listEvent, lambdaContext);
      expect(listResponse.statusCode).toBe(200);
      const listBody = JSON.parse(listResponse.body);
      expect(listBody.data.todos).toHaveLength(1);
      expect(listBody.data.todos[0].id).toBe(createdTodo.id);

      // 3. Todo 업데이트
      const updateData = {
        title: '업데이트된 생명주기 테스트 Todo',
        completed: true,
      };

      const updateEvent = createMockAPIGatewayEvent(
        'PUT',
        `/todos/${createdTodo.id}`,
        updateData,
        null,
        { id: createdTodo.id },
        {},
        { userId, userType: 'authenticated' }
      );

      const updateResponse = await updateTodoHandler(updateEvent, lambdaContext);
      expect(updateResponse.statusCode).toBe(200);
      const updatedTodo = JSON.parse(updateResponse.body).data.todo;
      expect(updatedTodo.title).toBe('업데이트된 생명주기 테스트 Todo');
      expect(updatedTodo.completed).toBe(true);

      // 4. Todo 삭제
      const deleteEvent = createMockAPIGatewayEvent(
        'DELETE',
        `/todos/${createdTodo.id}`,
        null,
        null,
        { id: createdTodo.id },
        {},
        { userId, userType: 'authenticated' }
      );

      const deleteResponse = await deleteTodoHandler(deleteEvent, lambdaContext);
      expect(deleteResponse.statusCode).toBe(200);

      // 5. 삭제 후 목록이 비어있는지 확인
      const finalListResponse = await getTodosHandler(listEvent, lambdaContext);
      const finalListBody = JSON.parse(finalListResponse.body);
      expect(finalListBody.data.todos).toHaveLength(0);
    });
  });

  describe('동시성 및 경쟁 조건 테스트', () => {
    it('같은 Todo에 대한 동시 업데이트를 처리한다', async () => {
      // Given
      const userId = 'concurrency-test-user';
      const todo = TestDataFactory.createTodo({ userId });

      const documentClient = testContainer.getDocumentClient();
      await documentClient.put({
        TableName: 'test-todos',
        Item: todo,
      });

      // 동시에 여러 업데이트 요청 생성
      const updatePromises = Array.from({ length: 5 }, (_, index) => {
        const updateData = { title: `동시 업데이트 ${index}` };
        const event = createMockAPIGatewayEvent(
          'PUT',
          `/todos/${todo.id}`,
          updateData,
          null,
          { id: todo.id },
          {},
          { userId, userType: 'authenticated' }
        );

        return updateTodoHandler(event, lambdaContext);
      });

      // When
      const responses = await Promise.all(updatePromises);

      // Then
      // 모든 요청이 성공하거나 적절한 에러를 반환해야 함
      responses.forEach(response => {
        expect([200, 409, 500]).toContain(response.statusCode);
      });

      // 최종 상태 확인
      const finalTodo = await documentClient.get({
        TableName: 'test-todos',
        Key: { userId, id: todo.id },
      });
      expect(finalTodo.Item).toBeDefined();
    });
  });
});
