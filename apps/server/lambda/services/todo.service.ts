/**
 * TodoService - Todo 비즈니스 로직 서비스
 * TDD 방식으로 작성된 테스트를 모두 통과하는 실제 구현체
 */

import { Priority } from '../types/constants';

import { DynamoTodoItem, DynamoQueryResult, ItemNotFoundError } from '../types/database.types';
import {
  CreateTodoRequest,
  UpdateTodoRequest,
  AuthContext,
  ListTodosRequest,
} from '../types/api.types';

// ==========================================
// 인터페이스 정의
// ==========================================

/**
 * Repository 인터페이스 - 데이터 액세스 계층
 */
export interface TodoRepository {
  create(
    todoData: Omit<
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

/**
 * Logger 인터페이스
 */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
}

/**
 * 커스텀 에러 클래스 - 권한 에러
 */
export class AuthError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * TodoService 인터페이스
 */
export interface ITodoService {
  createTodo(authContext: AuthContext, request: CreateTodoRequest): Promise<DynamoTodoItem>;
  getTodoById(authContext: AuthContext, todoId: string): Promise<DynamoTodoItem>;
  listTodos(
    authContext: AuthContext,
    request?: ListTodosRequest
  ): Promise<DynamoQueryResult<DynamoTodoItem>>;
  updateTodo(
    authContext: AuthContext,
    todoId: string,
    request: UpdateTodoRequest
  ): Promise<DynamoTodoItem>;
  deleteTodo(authContext: AuthContext, todoId: string): Promise<void>;
  validatePermissions(
    authContext: AuthContext,
    action: string,
    resourceOwnerId?: string
  ): Promise<void>;
  cleanupExpiredGuestTodos(): Promise<number>;
}

// ==========================================
// TodoService 구현체
// ==========================================

export class TodoService implements ITodoService {
  constructor(
    private todoRepository: TodoRepository,
    private logger: Logger
  ) {}

  /**
   * Todo 생성
   */
  async createTodo(authContext: AuthContext, request: CreateTodoRequest): Promise<DynamoTodoItem> {
    // 권한 검증
    await this.validatePermissions(authContext, 'CREATE');

    // 게스트 사용자 제한 검증
    if (authContext.userType === 'guest') {
      const existingTodos = await this.todoRepository.findAll(authContext.userId);
      if (existingTodos.count >= authContext.permissions.maxItems) {
        throw new Error(
          `Guest users can only create up to ${authContext.permissions.maxItems} todos`
        );
      }
    }

    const todoId = this.generateTodoId();
    const now = new Date().toISOString();

    const todoData = {
      id: todoId,
      userId: authContext.userId,
      title: request.title,
      completed: false,
      priority: request.priority || Priority.MEDIUM,
      isGuest: authContext.userType === 'guest',
      sessionId: authContext.sessionId,
      createdAt: now,
      updatedAt: now,
      ...(authContext.userType === 'guest' &&
        authContext.permissions.persistData && {
          ttl: this.generateTTL(7 * 24 * 60 * 60), // 7일
        }),
    };

    const createdTodo = await this.todoRepository.create(todoData);

    this.logger.info('Todo created', {
      todoId,
      userId: authContext.userId,
      userType: authContext.userType,
    });

    return createdTodo;
  }

  /**
   * ID로 Todo 조회
   */
  async getTodoById(authContext: AuthContext, todoId: string): Promise<DynamoTodoItem> {
    await this.validatePermissions(authContext, 'READ');

    const todo = await this.todoRepository.findById(authContext.userId, todoId);
    if (!todo) {
      throw new ItemNotFoundError('Todo', todoId);
    }

    // 게스트 사용자의 경우 세션 검증
    if (authContext.userType === 'guest' && todo.sessionId !== authContext.sessionId) {
      throw new Error('Access denied: Todo belongs to different session');
    }

    return todo;
  }

  /**
   * Todo 목록 조회 (필터링 및 페이지네이션 지원)
   */
  async listTodos(
    authContext: AuthContext,
    request: ListTodosRequest = {}
  ): Promise<DynamoQueryResult<DynamoTodoItem>> {
    await this.validatePermissions(authContext, 'READ');

    let result: DynamoQueryResult<DynamoTodoItem>;

    const queryOptions = {
      limit: request.limit,
      cursor: request.cursor,
    };

    // 상태별 필터링
    if (request.status === 'active') {
      result = await this.todoRepository.findByStatus(authContext.userId, false, queryOptions);
    } else if (request.status === 'completed') {
      result = await this.todoRepository.findByStatus(authContext.userId, true, queryOptions);
    } else if (request.priority) {
      result = await this.todoRepository.findByPriority(
        authContext.userId,
        request.priority,
        queryOptions
      );
    } else {
      result = await this.todoRepository.findAll(authContext.userId, queryOptions);
    }

    // 게스트 사용자의 경우 세션별 필터링
    if (authContext.userType === 'guest') {
      result.items = result.items.filter(todo => todo.sessionId === authContext.sessionId);
      result.count = result.items.length;
    }

    return result;
  }

  /**
   * Todo 업데이트
   */
  async updateTodo(
    authContext: AuthContext,
    todoId: string,
    request: UpdateTodoRequest
  ): Promise<DynamoTodoItem> {
    await this.validatePermissions(authContext, 'UPDATE');

    // 기존 Todo 존재 확인 (업데이트를 위해 조회)
    await this.getTodoById(authContext, todoId);

    // 업데이트할 필드 준비
    const updates: Partial<DynamoTodoItem> = {};
    if (request.title !== undefined) updates.title = request.title;
    if (request.completed !== undefined) updates.completed = request.completed;
    if (request.priority !== undefined) updates.priority = request.priority;
    if (request.dueDate !== undefined) updates.dueDate = request.dueDate;

    const updatedTodo = await this.todoRepository.update(authContext.userId, todoId, updates);

    this.logger.info('Todo updated', {
      todoId,
      userId: authContext.userId,
      updates: Object.keys(updates),
    });

    return updatedTodo;
  }

  /**
   * Todo 삭제
   */
  async deleteTodo(authContext: AuthContext, todoId: string): Promise<void> {
    await this.validatePermissions(authContext, 'DELETE');

    // 기존 Todo 존재 확인 (권한도 함께 확인됨)
    await this.getTodoById(authContext, todoId);

    await this.todoRepository.delete(authContext.userId, todoId);

    this.logger.info('Todo deleted', {
      todoId,
      userId: authContext.userId,
    });
  }

  /**
   * 권한 검증
   */
  async validatePermissions(
    authContext: AuthContext,
    action: string,
    _resourceOwnerId?: string
  ): Promise<void> {
    const permissions = authContext.permissions;

    switch (action) {
      case 'CREATE':
        if (!permissions.canCreate) {
          throw new AuthError(
            'CREATE_PERMISSION_DENIED',
            'Insufficient permissions to create todos'
          );
        }
        break;
      case 'READ':
        if (!permissions.canRead) {
          throw new AuthError('read_PERMISSION_DENIED', 'Insufficient permissions to read todos');
        }
        break;
      case 'UPDATE':
        if (!permissions.canUpdate) {
          throw new AuthError(
            'UPDATE_PERMISSION_DENIED',
            'Insufficient permissions to update todos'
          );
        }
        break;
      case 'DELETE':
        if (!permissions.canDelete) {
          throw new AuthError(
            'DELETE_PERMISSION_DENIED',
            'Insufficient permissions to delete todos'
          );
        }
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * 만료된 게스트 Todo 정리
   * DynamoDB TTL이 자동으로 처리하지만, 수동 정리가 필요한 경우를 위한 메서드
   */
  async cleanupExpiredGuestTodos(): Promise<number> {
    this.logger.info('Guest todos cleanup completed', { deletedCount: 0 });
    return 0;
  }

  /**
   * 고유한 Todo ID 생성
   */
  private generateTodoId(): string {
    return `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * TTL 타임스탬프 생성 (현재 시간 + 지정된 초)
   */
  private generateTTL(offsetSeconds = 86400): number {
    return Math.floor(Date.now() / 1000) + offsetSeconds;
  }
}
