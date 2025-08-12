/**
 * 클라이언트 테스트 글로벌 설정
 */
import "@testing-library/jest-dom";
import { vi } from "vitest";

// DOMPurify 모킹
vi.mock("dompurify", () => {
  return {
    default: {
      sanitize: vi.fn((input: string) => input),
      isValidAttribute: vi.fn(() => true),
      addHook: vi.fn(),
      removeHook: vi.fn(),
      removeAllHooks: vi.fn(),
    },
  };
});

// LocalStorage 모킹
Object.defineProperty(window, "localStorage", {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  },
  writable: true,
});

// SessionStorage 모킹
Object.defineProperty(window, "sessionStorage", {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  },
  writable: true,
});

// IntersectionObserver 모킹 (필요시)
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// ResizeObserver 모킹 (필요시)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// 매 테스트 전에 localStorage mock 초기화
beforeEach(() => {
  vi.clearAllMocks();
  (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
    null,
  );
  (window.localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(
    () => {},
  );
  (
    window.localStorage.removeItem as ReturnType<typeof vi.fn>
  ).mockImplementation(() => {});
  (window.localStorage.clear as ReturnType<typeof vi.fn>).mockImplementation(
    () => {},
  );
});

// 콘솔 경고/에러 억제 (필요에 따라)
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = vi.fn();
  console.warn = vi.fn();
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});
