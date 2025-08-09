import type { Todo, Priority, FilterType, TodoStats } from 'types/index';

/**
 * 스토리지 서비스의 추상 기본 클래스
 * localStorage와 API 스토리지 구현체가 이를 상속받아 구현합니다
 */
export abstract class AbstractStorageService {
  // ================================
  // TODO CRUD 추상 메서드들
  // ================================

  /**
   * 모든 TODO 조회
   * @param filter 필터 옵션
   * @returns TODO 배열
   */
  abstract getTodos(filter?: FilterType): Promise<Todo[]>;

  /**
   * 특정 TODO 조회
   * @param id TODO ID
   * @returns TODO 객체 또는 null
   */
  abstract getTodoById(id: string): Promise<Todo | null>;

  /**
   * 새로운 TODO 생성
   * @param title 제목
   * @param priority 우선순위
   * @returns 생성된 TODO
   */
  abstract createTodo(title: string, priority: Priority): Promise<Todo>;

  /**
   * TODO 수정
   * @param id TODO ID
   * @param updates 수정할 데이터
   * @returns 수정된 TODO
   */
  abstract updateTodo(
    id: string, 
    updates: Partial<Pick<Todo, 'title' | 'completed' | 'priority'>>
  ): Promise<Todo>;

  /**
   * TODO 삭제
   * @param id TODO ID
   * @returns 삭제된 TODO ID
   */
  abstract deleteTodo(id: string): Promise<string>;

  /**
   * 모든 TODO 삭제
   * @returns 삭제된 TODO 개수
   */
  abstract clearAllTodos(): Promise<number>;

  // ================================
  // 편의 메서드들 (기본 구현 제공)
  // ================================

  /**
   * TODO 완료 상태 토글
   * @param id TODO ID
   * @returns 수정된 TODO
   */
  async toggleTodo(id: string): Promise<Todo> {
    const todo = await this.getTodoById(id);
    if (!todo) {
      throw new Error(`Todo with id ${id} not found`);
    }
    
    return this.updateTodo(id, { completed: !todo.completed });
  }

  /**
   * 완료된 TODO들 삭제
   * @returns 삭제된 TODO 개수
   */
  async clearCompletedTodos(): Promise<number> {
    const todos = await this.getTodos();
    const completedTodos = todos.filter(todo => todo.completed);
    
    await Promise.all(
      completedTodos.map(todo => this.deleteTodo(todo.id))
    );
    
    return completedTodos.length;
  }

  /**
   * TODO 통계 조회
   * @returns 통계 정보
   */
  async getTodoStats(): Promise<TodoStats> {
    const todos = await this.getTodos();
    
    const total = todos.length;
    const completed = todos.filter(todo => todo.completed).length;
    const active = total - completed;
    
    const byPriority = {
      high: todos.filter(todo => todo.priority === 'high').length,
      medium: todos.filter(todo => todo.priority === 'medium').length,
      low: todos.filter(todo => todo.priority === 'low').length,
    };

    return {
      total,
      completed,
      active,
      byPriority,
    };
  }

  /**
   * 필터링된 TODO 조회
   * @param filter 필터 타입
   * @returns 필터링된 TODO 배열
   */
  async getFilteredTodos(filter: FilterType): Promise<Todo[]> {
    const todos = await this.getTodos();
    
    switch (filter) {
      case 'active':
        return todos.filter(todo => !todo.completed);
      case 'completed':
        return todos.filter(todo => todo.completed);
      case 'all':
      default:
        return todos;
    }
  }

  /**
   * 우선순위별 TODO 조회
   * @param priority 우선순위
   * @returns 해당 우선순위의 TODO 배열
   */
  async getTodosByPriority(priority: Priority): Promise<Todo[]> {
    const todos = await this.getTodos();
    return todos.filter(todo => todo.priority === priority);
  }

  /**
   * 제목으로 TODO 검색
   * @param query 검색어
   * @returns 검색 결과 TODO 배열
   */
  async searchTodos(query: string): Promise<Todo[]> {
    const todos = await this.getTodos();
    const lowerQuery = query.toLowerCase();
    
    return todos.filter(todo => 
      todo.title.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * TODO 정렬
   * @param todos TODO 배열
   * @param sortBy 정렬 기준
   * @param order 정렬 순서
   * @returns 정렬된 TODO 배열
   */
  protected sortTodos(
    todos: Todo[], 
    sortBy: 'createdAt' | 'priority' | 'title' = 'createdAt',
    order: 'asc' | 'desc' = 'desc'
  ): Todo[] {
    return [...todos].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
      }
      
      return order === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * TODO 데이터 유효성 검사
   * @param title 제목
   * @param priority 우선순위
   * @throws 유효하지 않은 경우 에러
   */
  protected validateTodoData(title: string, priority: Priority): void {
    if (!title || title.trim().length === 0) {
      throw new Error('Todo title cannot be empty');
    }
    
    if (title.trim().length > 200) {
      throw new Error('Todo title cannot exceed 200 characters');
    }
    
    if (!['high', 'medium', 'low'].includes(priority)) {
      throw new Error('Invalid priority level');
    }
  }

  /**
   * 고유 ID 생성 (UUID v4 형식)
   * @returns 고유 ID 문자열
   */
  protected generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * 현재 시각을 ISO 문자열로 반환
   * @returns ISO 형식 시각 문자열
   */
  protected getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  // ================================
  // 선택적 구현 메서드들 (기본적으로 지원되지 않음)
  // ================================

  /**
   * 데이터 내보내기 (선택적)
   * @returns 내보내기 URL 또는 데이터
   */
  async exportData?(): Promise<string | Todo[]> {
    throw new Error('Export is not supported by this storage service');
  }

  /**
   * 데이터 가져오기 (선택적)
   * @param data 가져올 데이터
   * @returns 가져온 TODO 개수
   */
  async importData?(data: Todo[]): Promise<number> {
    throw new Error('Import is not supported by this storage service');
  }

  /**
   * 동기화 상태 확인 (선택적)
   * @returns 동기화 여부
   */
  async isSynced?(): Promise<boolean> {
    return true; // localStorage는 항상 동기화된 상태
  }

  /**
   * 수동 동기화 (선택적)
   * @returns 동기화된 TODO 개수
   */
  async syncData?(): Promise<number> {
    return 0; // 기본적으로 동기화할 데이터 없음
  }
}