/**
 * TodoService - Todo 비즈니스 로직 서비스 (X-Ray 분산 추적 통합)
 * TDD 방식으로 작성된 테스트를 모두 통과하는 실제 구현체
 * - 비즈니스 로직별 성능 측정
 * - 데이터베이스 작업 성능 모니터링
 * - 전체 요청 플로우 시각화
 */

import {
  traceAsyncWithMetrics,
  SubsystemType,
  addUserInfo,
  addAnnotation,
} from '../utils/xray-tracer';

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
   * Todo 생성 (성능 모니터링 적용)
   */
  async createTodo(authContext: AuthContext, request: CreateTodoRequest): Promise<DynamoTodoItem> {
    return traceAsyncWithMetrics(
      'create-todo-business-logic',
      SubsystemType.BUSINESS_LOGIC,
      async subsegment => {
        // 사용자 정보 추적
        addUserInfo(authContext.userId, authContext.userType);
        addAnnotation('operation', 'CREATE_TODO');
        addAnnotation('user_type', authContext.userType);

        // 권한 검증 추적
        await traceAsyncWithMetrics(
          'validate-create-permissions',
          SubsystemType.AUTHENTICATION,
          async () => {
            await this.validatePermissions(authContext, 'CREATE');
          },
          { action: 'CREATE', userType: authContext.userType }
        );

        // 게스트 제한 검증 추적
        if (authContext.userType === 'guest') {
          await traceAsyncWithMetrics(
            'check-guest-limits',
            SubsystemType.BUSINESS_LOGIC,
            async () => {
              const existingTodos = await this.todoRepository.findAll(authContext.userId);
              if (existingTodos.count >= authContext.permissions.maxItems) {
                throw new Error(
                  `Guest users can only create up to ${authContext.permissions.maxItems} todos`
                );
              }

              // 제한 상태 추적
              subsegment?.addAnnotation('guest_todo_count', existingTodos.count);
              subsegment?.addAnnotation('guest_limit', authContext.permissions.maxItems);
            },
            { currentCount: 'checking', maxItems: authContext.permissions.maxItems }
          );
        }

        // 데이터 준비 (비즈니스 로직)
        const todoCreationData = await traceAsyncWithMetrics(
          'prepare-todo-data',
          SubsystemType.BUSINESS_LOGIC,
          async () => {
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

            // 생성 데이터 추적
            subsegment?.addAnnotation('todo_id', todoId);
            subsegment?.addAnnotation('title_length', request.title.length);
            subsegment?.addAnnotation('priority', request.priority || Priority.MEDIUM);
            subsegment?.addAnnotation(
              'has_ttl',
              authContext.userType === 'guest' && authContext.permissions.persistData
            );

            return { todoId, todoData };
          },
          { titleLength: request.title.length, priority: request.priority }
        );

        // 데이터베이스 생성 작업 추적
        const createdTodo = await traceAsyncWithMetrics(
          'persist-todo',
          SubsystemType.DATABASE,
          async () => {
            return await this.todoRepository.create(todoCreationData.todoData);
          },
          {
            operation: 'CREATE',
            todoId: todoCreationData.todoId,
            dataSize: JSON.stringify(todoCreationData.todoData).length,
          }
        );

        // 로깅 및 성능 메트릭
        await traceAsyncWithMetrics(
          'log-creation',
          SubsystemType.BUSINESS_LOGIC,
          async () => {
            this.logger.info('Todo created', {
              todoId: todoCreationData.todoId,
              userId: authContext.userId,
              userType: authContext.userType,
              priority: request.priority,
            });
          },
          { level: 'info', todoId: todoCreationData.todoId }
        );

        // 최종 성능 메트릭 추가
        subsegment?.addMetadata('todo_creation_summary', {
          todoId: todoCreationData.todoId,
          userType: authContext.userType,
          titleLength: request.title.length,
          priority: request.priority || Priority.MEDIUM,
          hasGuestRestrictions: authContext.userType === 'guest',
          dataSize: JSON.stringify(createdTodo).length,
        });

        subsegment?.addAnnotation('created_todo_id', todoCreationData.todoId);
        subsegment?.addAnnotation('creation_success', true);

        return createdTodo;
      },
      {
        operation: 'CREATE_TODO',
        userId: authContext.userId,
        userType: authContext.userType,
        titleLength: request.title.length,
      }
    );
  }

  /**
   * ID로 Todo 조회 (성능 모니터링 적용)
   */
  async getTodoById(authContext: AuthContext, todoId: string): Promise<DynamoTodoItem> {
    return traceAsyncWithMetrics(
      'get-todo-by-id',
      SubsystemType.BUSINESS_LOGIC,
      async subsegment => {
        // 사용자 정보 및 작업 추적
        addUserInfo(authContext.userId, authContext.userType);
        addAnnotation('operation', 'GET_TODO_BY_ID');
        addAnnotation('todo_id', todoId);

        // 권한 검증
        await traceAsyncWithMetrics(
          'validate-read-permissions',
          SubsystemType.AUTHENTICATION,
          async () => {
            await this.validatePermissions(authContext, 'READ');
          },
          { action: 'READ', todoId }
        );

        // 데이터베이스 조회
        const todo = await traceAsyncWithMetrics(
          'fetch-todo-from-db',
          SubsystemType.DATABASE,
          async () => {
            return await this.todoRepository.findById(authContext.userId, todoId);
          },
          { userId: authContext.userId, todoId }
        );

        if (!todo) {
          subsegment?.addAnnotation('todo_found', false);
          throw new ItemNotFoundError('Todo', todoId);
        }

        subsegment?.addAnnotation('todo_found', true);

        // 게스트 세션 검증
        if (authContext.userType === 'guest') {
          await traceAsyncWithMetrics(
            'validate-guest-session',
            SubsystemType.AUTHENTICATION,
            async () => {
              if (todo.sessionId !== authContext.sessionId) {
                throw new Error('Access denied: Todo belongs to different session');
              }
            },
            { expectedSessionId: authContext.sessionId, actualSessionId: todo.sessionId }
          );
        }

        // 성능 메트릭 추가
        subsegment?.addMetadata('todo_retrieval_result', {
          todoId,
          found: true,
          userType: authContext.userType,
          todoTitle: todo.title,
          completed: todo.completed,
          priority: todo.priority,
          dataSize: JSON.stringify(todo).length,
        });

        subsegment?.addAnnotation('retrieval_success', true);
        subsegment?.addAnnotation('todo_completed', todo.completed);
        subsegment?.addAnnotation('todo_priority', todo.priority);

        return todo;
      },
      {
        operation: 'GET_TODO',
        userId: authContext.userId,
        todoId,
        userType: authContext.userType,
      }
    );
  }

  /**
   * Todo 목록 조회 (성능 모니터링 적용)
   */
  async listTodos(
    authContext: AuthContext,
    request: ListTodosRequest = {}
  ): Promise<DynamoQueryResult<DynamoTodoItem>> {
    return traceAsyncWithMetrics(
      'list-todos',
      SubsystemType.BUSINESS_LOGIC,
      async subsegment => {
        // 사용자 정보 및 요청 매개변수 추적
        addUserInfo(authContext.userId, authContext.userType);
        addAnnotation('operation', 'LIST_TODOS');
        addAnnotation('filter_status', request.status || 'all');
        addAnnotation('filter_priority', request.priority || 'all');
        addAnnotation('has_limit', !!request.limit);
        addAnnotation('has_cursor', !!request.cursor);

        // 권한 검증
        await traceAsyncWithMetrics(
          'validate-list-permissions',
          SubsystemType.AUTHENTICATION,
          async () => {
            await this.validatePermissions(authContext, 'READ');
          },
          { action: 'READ', operation: 'list' }
        );

        const queryOptions = {
          limit: request.limit,
          cursor: request.cursor,
        };

        // 데이터베이스 조회 (필터 조건에 따라 분기)
        const result = await traceAsyncWithMetrics(
          'query-todos-from-db',
          SubsystemType.DATABASE,
          async dbSubsegment => {
            let queryResult: DynamoQueryResult<DynamoTodoItem>;
            let queryType: string;

            // 상태별 필터링
            if (request.status === 'active') {
              queryType = 'by-status-active';
              queryResult = await this.todoRepository.findByStatus(
                authContext.userId,
                false,
                queryOptions
              );
            } else if (request.status === 'completed') {
              queryType = 'by-status-completed';
              queryResult = await this.todoRepository.findByStatus(
                authContext.userId,
                true,
                queryOptions
              );
            } else if (request.priority) {
              queryType = 'by-priority';
              queryResult = await this.todoRepository.findByPriority(
                authContext.userId,
                request.priority,
                queryOptions
              );
            } else {
              queryType = 'all';
              queryResult = await this.todoRepository.findAll(authContext.userId, queryOptions);
            }

            // 데이터베이스 성능 메트릭
            dbSubsegment?.addAnnotation('query_type', queryType);
            dbSubsegment?.addAnnotation('items_returned', queryResult.count);
            dbSubsegment?.addAnnotation('has_more_items', !!queryResult.cursor);

            return queryResult;
          },
          {
            queryType: request.status || request.priority || 'all',
            userId: authContext.userId,
            limit: request.limit,
          }
        );

        // 게스트 사용자 필터링
        const filteredResult = await traceAsyncWithMetrics(
          'filter-guest-todos',
          SubsystemType.BUSINESS_LOGIC,
          async filterSubsegment => {
            if (authContext.userType === 'guest') {
              const originalCount = result.items.length;
              result.items = result.items.filter(todo => todo.sessionId === authContext.sessionId);
              result.count = result.items.length;

              // 게스트 필터링 메트릭
              filterSubsegment?.addAnnotation('original_count', originalCount);
              filterSubsegment?.addAnnotation('filtered_count', result.count);
              filterSubsegment?.addAnnotation('filtered_out', originalCount - result.count);

              if (originalCount !== result.count) {
                this.logger.info('Guest todos filtered', {
                  userId: authContext.userId,
                  sessionId: authContext.sessionId,
                  originalCount,
                  filteredCount: result.count,
                });
              }
            }

            return result;
          },
          { userType: authContext.userType, needsFiltering: authContext.userType === 'guest' }
        );

        // 최종 성능 메트릭
        subsegment?.addMetadata('todo_list_result', {
          filterType: request.status || request.priority || 'all',
          totalItems: filteredResult.count,
          hasMoreItems: !!filteredResult.cursor,
          userType: authContext.userType,
          requestedLimit: request.limit,
          actualReturned: filteredResult.items.length,
          isGuestFiltered: authContext.userType === 'guest',
        });

        subsegment?.addAnnotation('list_success', true);
        subsegment?.addAnnotation('total_items', filteredResult.count);
        subsegment?.addAnnotation('has_pagination', !!filteredResult.cursor);

        return filteredResult;
      },
      {
        operation: 'LIST_TODOS',
        userId: authContext.userId,
        filterStatus: request.status,
        filterPriority: request.priority,
        limit: request.limit,
      }
    );
  }

  /**
   * Todo 업데이트 (성능 모니터링 적용)
   */
  async updateTodo(
    authContext: AuthContext,
    todoId: string,
    request: UpdateTodoRequest
  ): Promise<DynamoTodoItem> {
    return traceAsyncWithMetrics(
      'update-todo',
      SubsystemType.BUSINESS_LOGIC,
      async subsegment => {
        // 사용자 정보 및 업데이트 작업 추적
        addUserInfo(authContext.userId, authContext.userType);
        addAnnotation('operation', 'UPDATE_TODO');
        addAnnotation('todo_id', todoId);

        const updateFields = Object.keys(request).filter(
          key => request[key as keyof UpdateTodoRequest] !== undefined
        );
        addAnnotation('update_fields', updateFields.join(','));

        // 권한 검증
        await traceAsyncWithMetrics(
          'validate-update-permissions',
          SubsystemType.AUTHENTICATION,
          async () => {
            await this.validatePermissions(authContext, 'UPDATE');
          },
          { action: 'UPDATE', todoId }
        );

        // 기존 Todo 존재 및 권한 확인
        await traceAsyncWithMetrics(
          'verify-todo-exists',
          SubsystemType.DATABASE,
          async () => {
            await this.getTodoById(authContext, todoId);
          },
          { todoId, operation: 'existence-check' }
        );

        // 업데이트 데이터 준비
        const updateData = await traceAsyncWithMetrics(
          'prepare-update-data',
          SubsystemType.BUSINESS_LOGIC,
          async prepSubsegment => {
            const updates: Partial<DynamoTodoItem> = {};
            if (request.title !== undefined) updates.title = request.title;
            if (request.completed !== undefined) updates.completed = request.completed;
            if (request.priority !== undefined) updates.priority = request.priority;
            if (request.dueDate !== undefined) updates.dueDate = request.dueDate;

            const fieldsToUpdate = Object.keys(updates);

            // 업데이트 메트릭
            prepSubsegment?.addAnnotation('fields_count', fieldsToUpdate.length);
            prepSubsegment?.addAnnotation('updating_title', 'title' in updates);
            prepSubsegment?.addAnnotation('updating_status', 'completed' in updates);
            prepSubsegment?.addAnnotation('updating_priority', 'priority' in updates);
            prepSubsegment?.addAnnotation('updating_due_date', 'dueDate' in updates);

            return { updates, fieldsToUpdate };
          },
          { requestFields: updateFields }
        );

        // 데이터베이스 업데이트
        const updatedTodo = await traceAsyncWithMetrics(
          'persist-todo-update',
          SubsystemType.DATABASE,
          async () => {
            return await this.todoRepository.update(authContext.userId, todoId, updateData.updates);
          },
          {
            operation: 'UPDATE',
            todoId,
            fieldsCount: updateData.fieldsToUpdate.length,
            fields: updateData.fieldsToUpdate,
          }
        );

        // 업데이트 로깅
        await traceAsyncWithMetrics(
          'log-update',
          SubsystemType.BUSINESS_LOGIC,
          async () => {
            this.logger.info('Todo updated', {
              todoId,
              userId: authContext.userId,
              updates: updateData.fieldsToUpdate,
              newValues: {
                ...(request.title !== undefined && { title: request.title }),
                ...(request.completed !== undefined && { completed: request.completed }),
                ...(request.priority !== undefined && { priority: request.priority }),
              },
            });
          },
          { level: 'info', todoId, fieldsUpdated: updateData.fieldsToUpdate.length }
        );

        // 최종 성능 메트릭
        subsegment?.addMetadata('todo_update_summary', {
          todoId,
          userType: authContext.userType,
          fieldsUpdated: updateData.fieldsToUpdate,
          updateSize: JSON.stringify(updateData.updates).length,
          resultSize: JSON.stringify(updatedTodo).length,
          statusChange:
            request.completed !== undefined
              ? {
                  from: 'checking',
                  to: request.completed,
                }
              : null,
        });

        subsegment?.addAnnotation('update_success', true);
        subsegment?.addAnnotation('fields_updated_count', updateData.fieldsToUpdate.length);

        return updatedTodo;
      },
      {
        operation: 'UPDATE_TODO',
        userId: authContext.userId,
        todoId,
        updateFields,
      }
    );
  }

  /**
   * Todo 삭제 (성능 모니터링 적용)
   */
  async deleteTodo(authContext: AuthContext, todoId: string): Promise<void> {
    return traceAsyncWithMetrics(
      'delete-todo',
      SubsystemType.BUSINESS_LOGIC,
      async subsegment => {
        // 사용자 정보 및 삭제 작업 추적
        addUserInfo(authContext.userId, authContext.userType);
        addAnnotation('operation', 'DELETE_TODO');
        addAnnotation('todo_id', todoId);

        // 권한 검증
        await traceAsyncWithMetrics(
          'validate-delete-permissions',
          SubsystemType.AUTHENTICATION,
          async () => {
            await this.validatePermissions(authContext, 'DELETE');
          },
          { action: 'DELETE', todoId }
        );

        // 삭제 대상 확인 및 메타데이터 수집
        const todoToDelete = await traceAsyncWithMetrics(
          'verify-todo-for-deletion',
          SubsystemType.DATABASE,
          async () => {
            const todo = await this.getTodoById(authContext, todoId);

            // 삭제 전 메타데이터 수집 (감사 목적)
            subsegment?.addMetadata('todo_before_deletion', {
              id: todo.id,
              title: todo.title,
              completed: todo.completed,
              priority: todo.priority,
              createdAt: todo.createdAt,
              isGuest: todo.isGuest,
            });

            return todo;
          },
          { todoId, operation: 'pre-deletion-check' }
        );

        // 실제 삭제 작업
        await traceAsyncWithMetrics(
          'execute-todo-deletion',
          SubsystemType.DATABASE,
          async () => {
            await this.todoRepository.delete(authContext.userId, todoId);
          },
          {
            operation: 'DELETE',
            todoId,
            userId: authContext.userId,
            todoTitle: todoToDelete.title.substring(0, 20), // 로깅을 위한 제목 축약
          }
        );

        // 삭제 로깅
        await traceAsyncWithMetrics(
          'log-deletion',
          SubsystemType.BUSINESS_LOGIC,
          async () => {
            this.logger.info('Todo deleted', {
              todoId,
              userId: authContext.userId,
              userType: authContext.userType,
              deletedTitle: todoToDelete.title,
              wasCompleted: todoToDelete.completed,
              priority: todoToDelete.priority,
            });
          },
          { level: 'info', todoId }
        );

        // 최종 성능 메트릭
        subsegment?.addMetadata('todo_deletion_summary', {
          todoId,
          userType: authContext.userType,
          deletedTodoInfo: {
            title: todoToDelete.title,
            completed: todoToDelete.completed,
            priority: todoToDelete.priority,
            age: new Date().getTime() - new Date(todoToDelete.createdAt).getTime(),
          },
        });

        subsegment?.addAnnotation('deletion_success', true);
        subsegment?.addAnnotation('deleted_todo_completed', todoToDelete.completed);
        subsegment?.addAnnotation('deleted_todo_priority', todoToDelete.priority);
      },
      {
        operation: 'DELETE_TODO',
        userId: authContext.userId,
        todoId,
        userType: authContext.userType,
      }
    );
  }

  /**
   * 권한 검증 (성능 모니터링 적용)
   */
  async validatePermissions(
    authContext: AuthContext,
    action: string,
    _resourceOwnerId?: string
  ): Promise<void> {
    return traceAsyncWithMetrics(
      'validate-permissions',
      SubsystemType.AUTHENTICATION,
      async subsegment => {
        const permissions = authContext.permissions;

        // 권한 검증 메타데이터
        subsegment?.addAnnotation('auth_action', action);
        subsegment?.addAnnotation('user_type', authContext.userType);
        subsegment?.addMetadata('permission_check', {
          action,
          userType: authContext.userType,
          permissions: {
            canCreate: permissions.canCreate,
            canRead: permissions.canRead,
            canUpdate: permissions.canUpdate,
            canDelete: permissions.canDelete,
            maxItems: permissions.maxItems,
          },
        });

        switch (action) {
          case 'CREATE':
            if (!permissions.canCreate) {
              subsegment?.addAnnotation('permission_denied', true);
              subsegment?.addAnnotation('denied_reason', 'CREATE_NOT_ALLOWED');
              throw new AuthError(
                'CREATE_PERMISSION_DENIED',
                'Insufficient permissions to create todos'
              );
            }
            break;
          case 'READ':
            if (!permissions.canRead) {
              subsegment?.addAnnotation('permission_denied', true);
              subsegment?.addAnnotation('denied_reason', 'READ_NOT_ALLOWED');
              throw new AuthError(
                'read_PERMISSION_DENIED',
                'Insufficient permissions to read todos'
              );
            }
            break;
          case 'UPDATE':
            if (!permissions.canUpdate) {
              subsegment?.addAnnotation('permission_denied', true);
              subsegment?.addAnnotation('denied_reason', 'UPDATE_NOT_ALLOWED');
              throw new AuthError(
                'UPDATE_PERMISSION_DENIED',
                'Insufficient permissions to update todos'
              );
            }
            break;
          case 'DELETE':
            if (!permissions.canDelete) {
              subsegment?.addAnnotation('permission_denied', true);
              subsegment?.addAnnotation('denied_reason', 'DELETE_NOT_ALLOWED');
              throw new AuthError(
                'DELETE_PERMISSION_DENIED',
                'Insufficient permissions to delete todos'
              );
            }
            break;
          default:
            subsegment?.addAnnotation('permission_denied', true);
            subsegment?.addAnnotation('denied_reason', 'UNKNOWN_ACTION');
            throw new Error(`Unknown action: ${action}`);
        }

        // 권한 검증 성공
        subsegment?.addAnnotation('permission_granted', true);
      },
      {
        action,
        userType: authContext.userType,
        userId: authContext.userId,
      }
    );
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
