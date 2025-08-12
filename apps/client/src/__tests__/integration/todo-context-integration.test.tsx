import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TodoProvider } from '../../contexts/todo.context';
import { AuthProvider } from '../../contexts/auth.context';
import { useTodo } from '../../hooks/use-todo';
import { useAuth } from '../../hooks/use-auth';
import { Priority } from '@vive/types';

/**
 * 테스트용 Todo 관리 컴포넌트
 */
function TestTodoManager() {
  const { 
    todos, 
    filter,
    loading,
    error,
    addTodo, 
    toggleTodo, 
    updateTodo,
    deleteTodo, 
    setFilter 
  } = useTodo();

  const { user } = useAuth();

  return (
    <div>
      <div data-testid="user-info">
        {user ? `사용자: ${user.name}` : '게스트'}
      </div>
      
      <div data-testid="loading">{loading ? '로딩중...' : '준비됨'}</div>
      
      {error && <div data-testid="error">{error}</div>}

      <div data-testid="todo-count">{todos.length}</div>
      
      <input
        data-testid="todo-input"
        placeholder="새 할일 입력"
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            const target = e.target as HTMLInputElement;
            if (target.value.trim()) {
              addTodo(target.value, 'medium');
              target.value = '';
            }
          }
        }}
      />

      <select
        data-testid="filter-select"
        value={filter.type}
        onChange={(e) => setFilter({ 
          ...filter, 
          type: e.target.value as 'all' | 'active' | 'completed' 
        })}
      >
        <option value="all">모든 할일</option>
        <option value="active">진행중</option>
        <option value="completed">완료</option>
      </select>

      <div data-testid="todo-list">
        {todos.map(todo => (
          <div key={todo.id} data-testid={`todo-${todo.id}`}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
              data-testid={`checkbox-${todo.id}`}
            />
            
            <span 
              data-testid={`title-${todo.id}`}
              className={todo.completed ? 'line-through' : ''}
            >
              {todo.title}
            </span>
            
            <span data-testid={`priority-${todo.id}`}>{todo.priority}</span>
            
            <button
              onClick={() => updateTodo(todo.id, { title: `수정된 ${todo.title}` })}
              data-testid={`edit-${todo.id}`}
            >
              수정
            </button>
            
            <button
              onClick={() => deleteTodo(todo.id)}
              data-testid={`delete-${todo.id}`}
            >
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 테스트용 Provider 래퍼
 */
function TestProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TodoProvider>
        {children}
      </TodoProvider>
    </AuthProvider>
  );
}

/**
 * Todo Context 통합 테스트
 * Context, Reducer, Storage 서비스 간의 전체적인 통합을 검증합니다.
 */
describe('Todo Context 통합 테스트', () => {
  beforeEach(() => {
    // localStorage 초기화
    localStorage.clear();
    // Mock 초기화
    vi.clearAllMocks();
  });

  describe('초기 상태 및 로딩', () => {
    it('초기 상태가 올바르게 설정된다', () => {
      render(
        <TestProviders>
          <TestTodoManager />
        </TestProviders>
      );

      expect(screen.getByTestId('todo-count')).toHaveTextContent('0');
      expect(screen.getByTestId('loading')).toHaveTextContent('준비됨');
      expect(screen.getByTestId('user-info')).toHaveTextContent('게스트');
      expect(screen.queryByTestId('error')).not.toBeInTheDocument();
    });

    it('localStorage에서 기존 Todo를 로드한다', () => {
      // Given - localStorage에 기존 데이터 설정
      const existingTodos = [
        {
          id: 'todo-1',
          title: '기존 할일 1',
          priority: 'high' as Priority,
          completed: false,
          userId: 'guest-session',
          isGuest: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'todo-2',
          title: '기존 할일 2',
          priority: 'low' as Priority,
          completed: true,
          userId: 'guest-session',
          isGuest: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      
      localStorage.setItem('todos', JSON.stringify(existingTodos));

      // When
      render(
        <TestProviders>
          <TestTodoManager />
        </TestProviders>
      );

      // Then
      expect(screen.getByTestId('todo-count')).toHaveTextContent('2');
      expect(screen.getByText('기존 할일 1')).toBeInTheDocument();
      expect(screen.getByText('기존 할일 2')).toBeInTheDocument();
    });
  });

  describe('Todo CRUD 작업', () => {
    it('새 Todo를 추가한다', async () => {
      const user = userEvent.setup();
      
      render(
        <TestProviders>
          <TestTodoManager />
        </TestProviders>
      );

      // Given
      const input = screen.getByTestId('todo-input');

      // When - 새 할일 추가
      await user.type(input, '새로운 할일');
      await user.keyboard('{Enter}');

      // Then
      await waitFor(() => {
        expect(screen.getByTestId('todo-count')).toHaveTextContent('1');
      });
      
      expect(screen.getByText('새로운 할일')).toBeInTheDocument();
      
      // localStorage에 저장되었는지 확인
      const storedTodos = JSON.parse(localStorage.getItem('todos') || '[]');
      expect(storedTodos).toHaveLength(1);
      expect(storedTodos[0].title).toBe('새로운 할일');
    });

    it('Todo 완료 상태를 토글한다', async () => {
      // Given - 기존 Todo 설정
      const existingTodo = {
        id: 'toggle-test-todo',
        title: '토글 테스트 할일',
        priority: 'medium' as Priority,
        completed: false,
        userId: 'guest-session',
        isGuest: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      localStorage.setItem('todos', JSON.stringify([existingTodo]));

      render(
        <TestProviders>
          <TestTodoManager />
        </TestProviders>
      );

      const checkbox = screen.getByTestId(`checkbox-${existingTodo.id}`);
      const title = screen.getByTestId(`title-${existingTodo.id}`);

      // 초기 상태 확인
      expect(checkbox).not.toBeChecked();
      expect(title).not.toHaveClass('line-through');

      // When - 완료 상태로 토글
      fireEvent.click(checkbox);

      // Then
      await waitFor(() => {
        expect(checkbox).toBeChecked();
        expect(title).toHaveClass('line-through');
      });

      // localStorage 업데이트 확인
      const storedTodos = JSON.parse(localStorage.getItem('todos') || '[]');
      expect(storedTodos[0].completed).toBe(true);
    });

    it('Todo를 수정한다', async () => {
      // Given
      const existingTodo = {
        id: 'edit-test-todo',
        title: '원본 할일',
        priority: 'medium' as Priority,
        completed: false,
        userId: 'guest-session',
        isGuest: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      localStorage.setItem('todos', JSON.stringify([existingTodo]));

      render(
        <TestProviders>
          <TestTodoManager />
        </TestProviders>
      );

      // When - 수정 버튼 클릭
      fireEvent.click(screen.getByTestId(`edit-${existingTodo.id}`));

      // Then
      await waitFor(() => {
        expect(screen.getByText('수정된 원본 할일')).toBeInTheDocument();
      });

      // localStorage 업데이트 확인
      const storedTodos = JSON.parse(localStorage.getItem('todos') || '[]');
      expect(storedTodos[0].title).toBe('수정된 원본 할일');
    });

    it('Todo를 삭제한다', async () => {
      // Given
      const existingTodo = {
        id: 'delete-test-todo',
        title: '삭제될 할일',
        priority: 'medium' as Priority,
        completed: false,
        userId: 'guest-session',
        isGuest: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      localStorage.setItem('todos', JSON.stringify([existingTodo]));

      render(
        <TestProviders>
          <TestTodoManager />
        </TestProviders>
      );

      expect(screen.getByText('삭제될 할일')).toBeInTheDocument();
      expect(screen.getByTestId('todo-count')).toHaveTextContent('1');

      // When - 삭제 버튼 클릭
      fireEvent.click(screen.getByTestId(`delete-${existingTodo.id}`));

      // Then
      await waitFor(() => {
        expect(screen.getByTestId('todo-count')).toHaveTextContent('0');
      });
      
      expect(screen.queryByText('삭제될 할일')).not.toBeInTheDocument();

      // localStorage에서 제거 확인
      const storedTodos = JSON.parse(localStorage.getItem('todos') || '[]');
      expect(storedTodos).toHaveLength(0);
    });
  });

  describe('필터링 기능', () => {
    beforeEach(() => {
      // 테스트용 혼합 데이터 설정
      const testTodos = [
        {
          id: 'active-1',
          title: '진행중 할일 1',
          priority: 'high' as Priority,
          completed: false,
          userId: 'guest-session',
          isGuest: true,
          createdAt: new Date(Date.now() - 3000).toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'completed-1',
          title: '완료된 할일 1',
          priority: 'medium' as Priority,
          completed: true,
          userId: 'guest-session',
          isGuest: true,
          createdAt: new Date(Date.now() - 2000).toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'active-2',
          title: '진행중 할일 2',
          priority: 'low' as Priority,
          completed: false,
          userId: 'guest-session',
          isGuest: true,
          createdAt: new Date(Date.now() - 1000).toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      
      localStorage.setItem('todos', JSON.stringify(testTodos));
    });

    it('모든 할일을 표시한다', () => {
      render(
        <TestProviders>
          <TestTodoManager />
        </TestProviders>
      );

      expect(screen.getByTestId('todo-count')).toHaveTextContent('3');
      expect(screen.getByText('진행중 할일 1')).toBeInTheDocument();
      expect(screen.getByText('완료된 할일 1')).toBeInTheDocument();
      expect(screen.getByText('진행중 할일 2')).toBeInTheDocument();
    });

    it('진행중인 할일만 필터링한다', () => {
      render(
        <TestProviders>
          <TestTodoManager />
        </TestProviders>
      );

      // When - 진행중 필터 선택
      fireEvent.change(screen.getByTestId('filter-select'), {
        target: { value: 'active' }
      });

      // Then
      expect(screen.getByTestId('todo-count')).toHaveTextContent('2');
      expect(screen.getByText('진행중 할일 1')).toBeInTheDocument();
      expect(screen.getByText('진행중 할일 2')).toBeInTheDocument();
      expect(screen.queryByText('완료된 할일 1')).not.toBeInTheDocument();
    });

    it('완료된 할일만 필터링한다', () => {
      render(
        <TestProviders>
          <TestTodoManager />
        </TestProviders>
      );

      // When - 완료된 필터 선택
      fireEvent.change(screen.getByTestId('filter-select'), {
        target: { value: 'completed' }
      });

      // Then
      expect(screen.getByTestId('todo-count')).toHaveTextContent('1');
      expect(screen.getByText('완료된 할일 1')).toBeInTheDocument();
      expect(screen.queryByText('진행중 할일 1')).not.toBeInTheDocument();
      expect(screen.queryByText('진행중 할일 2')).not.toBeInTheDocument();
    });

    it('필터 변경 후 다시 모든 할일을 표시한다', () => {
      render(
        <TestProviders>
          <TestTodoManager />
        </TestProviders>
      );

      // Given - 진행중 필터 적용
      fireEvent.change(screen.getByTestId('filter-select'), {
        target: { value: 'active' }
      });
      expect(screen.getByTestId('todo-count')).toHaveTextContent('2');

      // When - 모든 할일 필터로 변경
      fireEvent.change(screen.getByTestId('filter-select'), {
        target: { value: 'all' }
      });

      // Then
      expect(screen.getByTestId('todo-count')).toHaveTextContent('3');
    });
  });

  describe('실시간 동기화 테스트', () => {
    it('여러 작업이 순차적으로 동기화된다', async () => {
      const user = userEvent.setup();
      
      render(
        <TestProviders>
          <TestTodoManager />
        </TestProviders>
      );

      const input = screen.getByTestId('todo-input');

      // 1. Todo 추가
      await user.type(input, '첫 번째 할일');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByTestId('todo-count')).toHaveTextContent('1');
      });

      // 2. 두 번째 Todo 추가
      await user.type(input, '두 번째 할일');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByTestId('todo-count')).toHaveTextContent('2');
      });

      // 3. 첫 번째 Todo 완료로 변경
      const firstTodoCheckbox = screen.getByDisplayValue('첫 번째 할일')
        ?.closest('[data-testid^="todo-"]')
        ?.querySelector('[data-testid^="checkbox-"]') as HTMLInputElement;
      
      if (firstTodoCheckbox) {
        fireEvent.click(firstTodoCheckbox);
      }

      await waitFor(() => {
        expect(firstTodoCheckbox).toBeChecked();
      });

      // 4. localStorage 최종 상태 확인
      const storedTodos = JSON.parse(localStorage.getItem('todos') || '[]');
      expect(storedTodos).toHaveLength(2);
      expect(storedTodos.find((t: {title: string; completed: boolean}) => t.title === '첫 번째 할일')?.completed).toBe(true);
      expect(storedTodos.find((t: {title: string; completed: boolean}) => t.title === '두 번째 할일')?.completed).toBe(false);
    });
  });

  describe('에러 처리', () => {
    it('잘못된 localStorage 데이터를 처리한다', () => {
      // Given - 잘못된 JSON 데이터
      localStorage.setItem('todos', 'invalid json data');

      // When
      render(
        <TestProviders>
          <TestTodoManager />
        </TestProviders>
      );

      // Then - 에러가 발생하지 않고 빈 상태로 시작
      expect(screen.getByTestId('todo-count')).toHaveTextContent('0');
      expect(screen.queryByTestId('error')).not.toBeInTheDocument();
    });

    it('빈 제목의 Todo 추가를 방지한다', async () => {
      const user = userEvent.setup();
      
      render(
        <TestProviders>
          <TestTodoManager />
        </TestProviders>
      );

      const input = screen.getByTestId('todo-input');

      // When - 빈 제목으로 추가 시도
      await user.type(input, '   '); // 공백만 입력
      await user.keyboard('{Enter}');

      // Then
      expect(screen.getByTestId('todo-count')).toHaveTextContent('0');
      expect(localStorage.getItem('todos')).toBe('[]');
    });
  });

  describe('성능 최적화 검증', () => {
    it('대량의 Todo가 있어도 필터링이 원활하다', async () => {
      // Given - 100개의 테스트 Todo 생성
      const largeTodoSet = Array.from({ length: 100 }, (_, index) => ({
        id: `todo-${index}`,
        title: `할일 ${index}`,
        priority: (['high', 'medium', 'low'] as Priority[])[index % 3],
        completed: index % 4 === 0, // 25% 완료율
        userId: 'guest-session',
        isGuest: true,
        createdAt: new Date(Date.now() - index * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      
      localStorage.setItem('todos', JSON.stringify(largeTodoSet));

      const startTime = performance.now();
      
      render(
        <TestProviders>
          <TestTodoManager />
        </TestProviders>
      );

      const renderTime = performance.now() - startTime;
      
      // 렌더링 시간이 합리적인 범위 내에 있는지 확인 (100ms 이하)
      expect(renderTime).toBeLessThan(100);
      expect(screen.getByTestId('todo-count')).toHaveTextContent('100');

      // 필터링 성능 테스트
      const filterStartTime = performance.now();
      
      fireEvent.change(screen.getByTestId('filter-select'), {
        target: { value: 'active' }
      });

      const filterTime = performance.now() - filterStartTime;
      
      // 필터링 시간이 합리적인 범위 내에 있는지 확인 (50ms 이하)
      expect(filterTime).toBeLessThan(50);
      expect(screen.getByTestId('todo-count')).toHaveTextContent('75'); // 75% active
    });
  });
});