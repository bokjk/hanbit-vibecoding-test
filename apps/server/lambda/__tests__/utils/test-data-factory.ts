import { v4 as uuidv4 } from 'uuid';
import { Todo, Priority, CreateTodoRequest, User } from '@vive/types';

/**
 * 테스트 데이터 팩토리
 * 일관된 테스트 데이터 생성을 위한 유틸리티 함수들
 */
export class TestDataFactory {
  /**
   * 테스트용 Todo 생성
   */
  static createTodo(overrides?: Partial<Todo>): Todo {
    const now = new Date().toISOString();
    
    return {
      id: uuidv4(),
      title: `Test Todo ${Date.now()}`,
      priority: 'medium' as Priority,
      completed: false,
      userId: 'test-user-id',
      isGuest: false,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  /**
   * 여러 개의 테스트 Todo 생성
   */
  static createTodos(count: number, overrides?: Partial<Todo>): Todo[] {
    return Array.from({ length: count }, (_, index) =>
      this.createTodo({
        title: `Test Todo ${index + 1}`,
        ...overrides,
      })
    );
  }

  /**
   * 완료된 Todo 생성
   */
  static createCompletedTodo(overrides?: Partial<Todo>): Todo {
    return this.createTodo({
      completed: true,
      ...overrides,
    });
  }

  /**
   * 게스트 Todo 생성
   */
  static createGuestTodo(overrides?: Partial<Todo>): Todo {
    return this.createTodo({
      userId: `guest-session-${uuidv4()}`,
      isGuest: true,
      ...overrides,
    });
  }

  /**
   * 우선순위별 Todo 생성
   */
  static createTodosByPriority(): Record<Priority, Todo> {
    const priorities: Priority[] = ['high', 'medium', 'low'];
    const todos: Record<Priority, Todo> = {} as Record<Priority, Todo>;

    priorities.forEach(priority => {
      todos[priority] = this.createTodo({
        title: `${priority} priority todo`,
        priority,
      });
    });

    return todos;
  }

  /**
   * 테스트용 CreateTodoRequest 생성
   */
  static createTodoRequest(overrides?: Partial<CreateTodoRequest>): CreateTodoRequest {
    return {
      title: `Test Todo Request ${Date.now()}`,
      priority: 'medium' as Priority,
      ...overrides,
    };
  }

  /**
   * 테스트용 사용자 생성
   */
  static createUser(overrides?: Partial<User>): User {
    return {
      id: uuidv4(),
      email: `test-user-${Date.now()}@example.com`,
      name: 'Test User',
      isGuest: false,
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * 게스트 사용자 생성
   */
  static createGuestUser(): User {
    return this.createUser({
      id: `guest-session-${uuidv4()}`,
      email: '',
      name: 'Guest User',
      isGuest: true,
    });
  }

  /**
   * 대량 테스트 데이터 생성 (성능 테스트용)
   */
  static createLargeDataSet(userId: string, count: number = 1000): Todo[] {
    const priorities: Priority[] = ['high', 'medium', 'low'];
    const todos: Todo[] = [];

    for (let i = 0; i < count; i++) {
      const priority = priorities[i % priorities.length];
      const completed = i % 4 === 0; // 25% 완료율
      
      todos.push(this.createTodo({
        title: `Performance Test Todo ${i + 1}`,
        priority,
        completed,
        userId,
        createdAt: new Date(Date.now() - (i * 1000)).toISOString(), // 시간 간격 조정
      }));
    }

    return todos;
  }

  /**
   * 에러 테스트용 잘못된 데이터 생성
   */
  static createInvalidTodoRequest(): Record<string, unknown>[] {
    return [
      // 빈 제목
      { title: '', priority: 'medium' },
      // 공백만 있는 제목
      { title: '   ', priority: 'high' },
      // 잘못된 우선순위
      { title: 'Valid title', priority: 'invalid-priority' },
      // 누락된 필수 필드
      { priority: 'low' },
      // 타입 오류
      { title: 123, priority: 'medium' },
      // 너무 긴 제목
      { title: 'a'.repeat(256), priority: 'high' },
    ];
  }

  /**
   * API 응답 모킹 데이터 생성
   */
  static createApiResponse<T>(data: T, success: boolean = true) {
    return {
      success,
      data: success ? data : undefined,
      error: success ? undefined : {
        code: 'TEST_ERROR',
        message: 'Test error message',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 에러 응답 생성
   */
  static createErrorResponse(code: string, message: string) {
    return this.createApiResponse(null, false).then((response: Record<string, unknown>) => {
      response.error = { code, message };
      return response;
    });
  }

  /**
   * JWT 토큰 모킹 데이터
   */
  static createMockTokens() {
    return {
      accessToken: 'mock-access-token-' + uuidv4(),
      refreshToken: 'mock-refresh-token-' + uuidv4(),
      expiresIn: 3600,
      tokenType: 'Bearer',
    };
  }

  /**
   * 페이지네이션 테스트 데이터
   */
  static createPaginatedTodos(userId: string, page: number = 1, limit: number = 10): { 
    todos: Todo[], 
    pagination: Record<string, unknown> 
  } {
    const totalItems = 50;
    const startIndex = (page - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalItems);
    
    const todos = [];
    for (let i = startIndex; i < endIndex; i++) {
      todos.push(this.createTodo({
        title: `Paginated Todo ${i + 1}`,
        userId,
        createdAt: new Date(Date.now() - (i * 1000)).toISOString(),
      }));
    }

    return {
      todos,
      pagination: {
        currentPage: page,
        limit,
        totalCount: totalItems,
        totalPages: Math.ceil(totalItems / limit),
        hasNextPage: page < Math.ceil(totalItems / limit),
        hasPrevPage: page > 1,
      },
    };
  }
}