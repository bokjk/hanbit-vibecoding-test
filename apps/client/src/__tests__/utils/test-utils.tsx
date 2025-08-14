/**
 * React Testing Library 유틸리티 확장
 */
/* eslint-disable react-refresh/only-export-components */
import React, { type ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodoProvider } from "../../contexts/todo.context";

// Provider로 감싸는 커스텀 렌더 함수
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return <TodoProvider>{children}</TodoProvider>;
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) => {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: AllTheProviders, ...options }),
  };
};

// React refresh 호환성을 위해 분리
export { customRender as render };
export * from "@testing-library/react";

// 테스트 데이터 생성 헬퍼
export const createMockTodo = (overrides = {}) => ({
  id: "test-todo-123",
  title: "Test Todo",
  priority: "medium" as const,
  completed: false,
  userId: "test-user-123",
  isGuest: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createMockTodos = (count: number) => {
  return Array.from({ length: count }, (_, index) =>
    createMockTodo({
      id: `test-todo-${index}`,
      title: `Test Todo ${index + 1}`,
      priority: ["high", "medium", "low"][index % 3],
      completed: index % 2 === 0,
    }),
  );
};

// 필터 테스트 헬퍼
export const createMockFilter = (overrides = {}) => ({
  type: "all" as const,
  sortBy: "createdDate" as const,
  sortOrder: "desc" as const,
  priority: undefined,
  ...overrides,
});

// localStorage 테스트 헬퍼
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((key) => delete store[key]);
    }),
    get store() {
      return { ...store };
    },
  };
};

// 에러 경계 테스트 헬퍼
export class TestErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return <div data-testid="error-boundary">Something went wrong</div>;
    }

    return this.props.children;
  }
}

// 성능 측정 헬퍼
export const measurePerformance = async (fn: () => Promise<void> | void) => {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return end - start;
};

// 접근성 테스트 헬퍼
export const checkA11y = async (container: Element) => {
  const axeCore = await import("@axe-core/react");
  const results = await axeCore.axe(container);
  expect(results).toHaveNoViolations();
};

// 컴포넌트 스냅샷 테스트 헬퍼
export const expectToMatchSnapshot = (component: ReactElement) => {
  const { container } = render(component);
  expect(container.firstChild).toMatchSnapshot();
};
