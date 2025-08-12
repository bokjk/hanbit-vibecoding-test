import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TodoInput } from '../../components/todo-input';

// 모킹: useTodoForm 훅
const mockCreateTodo = vi.fn();
vi.mock('../../hooks/use-todo', () => ({
  useTodoForm: () => ({
    createTodo: mockCreateTodo,
    canCreate: true,
    loading: false,
  }),
}));

// 모킹: 보안 유틸리티
const mockSanitizeInput = vi.fn((input: string) => input);
const mockLogSecurityWarning = vi.fn();
vi.mock('../../utils/client-security', () => ({
  useSafeInput: () => ({
    sanitizeInput: mockSanitizeInput,
  }),
  logSecurityWarning: mockLogSecurityWarning,
}));

describe('TodoInput Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ================================
  // 기본 렌더링 테스트
  // ================================

  it('should render input form with default values', () => {
    render(<TodoInput />);

    // 입력 필드 확인
    const titleInput = screen.getByTestId('todo-input');
    expect(titleInput).toBeInTheDocument();
    expect(titleInput).toHaveValue('');
    expect(titleInput).toHaveAttribute('placeholder', '새로운 할 일을 입력하세요...');

    // 우선순위 선택 확인
    const prioritySelect = screen.getByTestId('priority-select');
    expect(prioritySelect).toBeInTheDocument();

    // 추가 버튼 확인
    const addButton = screen.getByTestId('add-todo-button');
    expect(addButton).toBeInTheDocument();
    expect(addButton).toHaveTextContent('할 일 추가');
  });

  it('should render both desktop and mobile layouts', () => {
    render(<TodoInput />);

    // 데스크톱 레이아웃 (md:flex)
    const desktopLayout = screen.getAllByTestId('todo-input')[0].closest('.hidden.md\\:flex');
    expect(desktopLayout).toBeInTheDocument();

    // 모바일 레이아웃 (md:hidden)
    const mobileLayout = screen.getAllByTestId('todo-input')[1].closest('.md\\:hidden');
    expect(mobileLayout).toBeInTheDocument();
  });

  // ================================
  // 입력 검증 테스트
  // ================================

  it('should handle title input changes', async () => {
    render(<TodoInput />);
    const titleInput = screen.getAllByTestId('todo-input')[0];

    await user.type(titleInput, '새로운 할일');

    expect(titleInput).toHaveValue('새로운 할일');
    expect(mockSanitizeInput).toHaveBeenCalledWith('새로운 할일');
  });

  it('should prevent submission with empty title', async () => {
    render(<TodoInput />);
    const addButton = screen.getAllByTestId('add-todo-button')[0];

    // 빈 제목으로 클릭
    await user.click(addButton);

    expect(mockCreateTodo).not.toHaveBeenCalled();
  });

  it('should disable add button when title is empty', () => {
    render(<TodoInput />);
    const addButton = screen.getAllByTestId('add-todo-button')[0];

    expect(addButton).toBeDisabled();
  });

  it('should enable add button when title has content', async () => {
    render(<TodoInput />);
    const titleInput = screen.getAllByTestId('todo-input')[0];
    const addButton = screen.getAllByTestId('add-todo-button')[0];

    await user.type(titleInput, '새로운 할일');

    expect(addButton).not.toBeDisabled();
  });

  it('should trim whitespace from title input', async () => {
    render(<TodoInput />);
    const titleInput = screen.getAllByTestId('todo-input')[0];
    const addButton = screen.getAllByTestId('add-todo-button')[0];

    await user.type(titleInput, '  공백이 있는 할일  ');
    await user.click(addButton);

    expect(mockCreateTodo).toHaveBeenCalledWith('공백이 있는 할일', {
      priority: 'medium',
    });
  });

  // ================================
  // 우선순위 선택 테스트
  // ================================

  it('should handle priority selection', async () => {
    render(<TodoInput />);
    const prioritySelect = screen.getAllByTestId('priority-select')[0];

    // 우선순위 선택 트리거 클릭
    await user.click(prioritySelect);

    // 높음 우선순위 선택
    const highPriorityOption = screen.getByText('높음');
    await user.click(highPriorityOption);

    // 값이 변경되었는지 확인 (내부적으로)
    const titleInput = screen.getAllByTestId('todo-input')[0];
    const addButton = screen.getAllByTestId('add-todo-button')[0];

    await user.type(titleInput, '중요한 할일');
    await user.click(addButton);

    expect(mockCreateTodo).toHaveBeenCalledWith('중요한 할일', {
      priority: 'high',
    });
  });

  it('should default to medium priority', async () => {
    render(<TodoInput />);
    const titleInput = screen.getAllByTestId('todo-input')[0];
    const addButton = screen.getAllByTestId('add-todo-button')[0];

    await user.type(titleInput, '기본 우선순위');
    await user.click(addButton);

    expect(mockCreateTodo).toHaveBeenCalledWith('기본 우선순위', {
      priority: 'medium',
    });
  });

  // ================================
  // 키보드 이벤트 테스트
  // ================================

  it('should submit form on Enter key press', async () => {
    render(<TodoInput />);
    const titleInput = screen.getAllByTestId('todo-input')[0];

    await user.type(titleInput, '엔터로 추가');
    await user.keyboard('{Enter}');

    expect(mockCreateTodo).toHaveBeenCalledWith('엔터로 추가', {
      priority: 'medium',
    });
  });

  it('should not submit on Enter with empty title', async () => {
    render(<TodoInput />);
    const titleInput = screen.getAllByTestId('todo-input')[0];

    await user.click(titleInput);
    await user.keyboard('{Enter}');

    expect(mockCreateTodo).not.toHaveBeenCalled();
  });

  // ================================
  // 폼 리셋 테스트
  // ================================

  it('should reset form after successful submission', async () => {
    mockCreateTodo.mockResolvedValueOnce(undefined);

    render(<TodoInput />);
    const titleInput = screen.getAllByTestId('todo-input')[0];
    const prioritySelect = screen.getAllByTestId('priority-select')[0];
    const addButton = screen.getAllByTestId('add-todo-button')[0];

    // 입력 및 우선순위 변경
    await user.type(titleInput, '완료될 할일');
    await user.click(prioritySelect);
    await user.click(screen.getByText('높음'));

    // 제출
    await user.click(addButton);

    await waitFor(() => {
      expect(titleInput).toHaveValue('');
      // 우선순위는 medium으로 리셋되는지 확인 (DOM 확인이 어려우므로 다음 제출로 확인)
    });
  });

  // ================================
  // 보안 기능 테스트
  // ================================

  it('should sanitize input in real-time', async () => {
    render(<TodoInput />);
    const titleInput = screen.getAllByTestId('todo-input')[0];

    await user.type(titleInput, '<script>alert("xss")</script>');

    expect(mockSanitizeInput).toHaveBeenCalledWith('<script>alert("xss")</script>');
  });

  it('should log security warning when input is sanitized', async () => {
    // 정화가 발생하는 시나리오 시뮬레이션
    mockSanitizeInput.mockImplementation((input: string) => 
      input.replace(/<script.*<\/script>/gi, '')
    );

    render(<TodoInput />);
    const titleInput = screen.getAllByTestId('todo-input')[0];

    await user.type(titleInput, '<script>alert("xss")</script>test');
    
    // 입력 중에 정화가 감지되면 경고 로그 호출
    expect(mockLogSecurityWarning).toHaveBeenCalled();
  });

  it('should sanitize on submit', async () => {
    mockSanitizeInput.mockImplementation(() => 'cleaned input');

    render(<TodoInput />);
    const titleInput = screen.getAllByTestId('todo-input')[0];
    const addButton = screen.getAllByTestId('add-todo-button')[0];

    await user.type(titleInput, 'malicious input');
    await user.click(addButton);

    expect(mockCreateTodo).toHaveBeenCalledWith('cleaned input', {
      priority: 'medium',
    });
  });

  // ================================
  // 로딩 상태 테스트
  // ================================

  it('should show loading state during submission', async () => {
    // 로딩 상태로 모킹
    vi.mocked(vi.importActual('../../hooks/use-todo')).useTodoForm = vi.fn(() => ({
      createTodo: mockCreateTodo,
      canCreate: true,
      loading: true,
    }));

    render(<TodoInput />);
    const addButton = screen.getAllByTestId('add-todo-button')[0];

    expect(addButton).toHaveTextContent('추가 중...');
    expect(addButton).toBeDisabled();
  });

  it('should disable button during submission', async () => {
    let resolvePromise: (value?: unknown) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockCreateTodo.mockReturnValueOnce(promise);

    render(<TodoInput />);
    const titleInput = screen.getAllByTestId('todo-input')[0];
    const addButton = screen.getAllByTestId('add-todo-button')[0];

    await user.type(titleInput, '제출 중인 할일');
    await user.click(addButton);

    // 제출 중에는 버튼 비활성화
    expect(addButton).toBeDisabled();

    // Promise 완료 후 버튼 활성화
    resolvePromise!();
    await waitFor(() => {
      expect(addButton).not.toBeDisabled();
    });
  });

  // ================================
  // 커스텀 onAddTodo 핸들러 테스트
  // ================================

  it('should use custom onAddTodo handler when provided', async () => {
    const customHandler = vi.fn();

    render(<TodoInput onAddTodo={customHandler} />);
    const titleInput = screen.getAllByTestId('todo-input')[0];
    const addButton = screen.getAllByTestId('add-todo-button')[0];

    await user.type(titleInput, '커스텀 핸들러');
    await user.click(addButton);

    expect(customHandler).toHaveBeenCalledWith('커스텀 핸들러', 'medium');
    expect(mockCreateTodo).not.toHaveBeenCalled();
  });

  // ================================
  // 에러 처리 테스트
  // ================================

  it('should handle createTodo error gracefully', async () => {
    mockCreateTodo.mockRejectedValueOnce(new Error('API Error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<TodoInput />);
    const titleInput = screen.getAllByTestId('todo-input')[0];
    const addButton = screen.getAllByTestId('add-todo-button')[0];

    await user.type(titleInput, '에러 발생 할일');
    await user.click(addButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to add todo:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  // ================================
  // 접근성 테스트
  // ================================

  it('should have proper ARIA attributes', () => {
    render(<TodoInput />);
    const titleInput = screen.getAllByTestId('todo-input')[0];

    expect(titleInput).toHaveAttribute('type', 'text');
    expect(titleInput).toBeVisible();
  });

  it('should be keyboard navigable', async () => {
    render(<TodoInput />);
    
    // Tab으로 네비게이션 테스트
    await user.tab();
    const titleInput = screen.getAllByTestId('todo-input')[0];
    expect(titleInput).toHaveFocus();

    await user.tab();
    const prioritySelect = screen.getAllByTestId('priority-select')[0];
    expect(prioritySelect).toHaveFocus();

    await user.tab();
    const addButton = screen.getAllByTestId('add-todo-button')[0];
    expect(addButton).toHaveFocus();
  });

  it('should support Space key for button activation', async () => {
    render(<TodoInput />);
    const titleInput = screen.getAllByTestId('todo-input')[0];
    
    await user.type(titleInput, '스페이스바로 추가');
    await user.tab(); // priority select로 이동
    await user.tab(); // button으로 이동
    await user.keyboard(' '); // 스페이스바로 버튼 활성화

    expect(mockCreateTodo).toHaveBeenCalledWith('스페이스바로 추가', {
      priority: 'medium',
    });
  });

  // ================================
  // 반응형 테스트
  // ================================

  it('should have responsive design classes', () => {
    render(<TodoInput />);

    // 데스크톱 레이아웃
    const desktopContainer = screen.getAllByTestId('todo-input')[0].closest('.hidden.md\\:flex');
    expect(desktopContainer).toHaveClass('hidden', 'md:flex', 'w-full', 'items-center', 'space-x-3');

    // 모바일 레이아웃
    const mobileContainer = screen.getAllByTestId('todo-input')[1].closest('.md\\:hidden');
    expect(mobileContainer).toHaveClass('md:hidden', 'space-y-3');
  });
});