/**
 * ErrorBoundary 컴포넌트 테스트
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, withErrorBoundary, throwError } from './ErrorBoundary';

// 에러를 발생시키는 테스트 컴포넌트
function ThrowErrorComponent({ shouldThrow = false, errorMessage = 'Test error' }) {
  if (shouldThrow) {
    throwError(errorMessage);
  }
  return <div>No error</div>;
}

// 정상 동작하는 테스트 컴포넌트
function NormalComponent() {
  return <div>Working component</div>;
}

// 로컬 스토리지 모킹
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// fetch 모킹
const mockFetch = vi.fn();
global.fetch = mockFetch;

// console 메서드 모킹
const originalConsole = {
  error: console.error,
  warn: console.warn,
  info: console.info,
  group: console.group,
  groupEnd: console.groupEnd,
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // console 메서드 모킹
    console.error = vi.fn();
    console.warn = vi.fn();
    console.info = vi.fn();
    console.group = vi.fn();
    console.groupEnd = vi.fn();
    
    // localStorage 초기 상태 설정
    mockLocalStorage.getItem.mockReturnValue('[]');
  });

  afterEach(() => {
    // console 메서드 복원
    Object.assign(console, originalConsole);
  });

  describe('정상 동작 시', () => {
    it('에러가 없을 때 자식 컴포넌트를 정상적으로 렌더링해야 한다', () => {
      render(
        <ErrorBoundary>
          <NormalComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Working component')).toBeInTheDocument();
    });

    it('여러 자식 컴포넌트를 정상적으로 렌더링해야 한다', () => {
      render(
        <ErrorBoundary>
          <NormalComponent />
          <div>Another component</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Working component')).toBeInTheDocument();
      expect(screen.getByText('Another component')).toBeInTheDocument();
    });
  });

  describe('에러 발생 시', () => {
    it('에러가 발생하면 기본 에러 UI를 표시해야 한다', () => {
      // 콘솔 에러를 무시 (의도적인 에러)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={true} errorMessage="Test error message" />
        </ErrorBoundary>
      );

      // 기본 에러 UI 요소들 확인
      expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument();
      expect(screen.getByText(/애플리케이션에서 예상치 못한 오류가 발생했습니다/)).toBeInTheDocument();
      expect(screen.getByText('다시 시도')).toBeInTheDocument();
      expect(screen.getByText('새로고침')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('개발 환경에서는 에러 상세 정보를 표시해야 한다', () => {
      // NODE_ENV를 development로 설정
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={true} errorMessage="Detailed test error" />
        </ErrorBoundary>
      );

      // 개발자 정보 섹션 확인
      const detailsButton = screen.getByText('개발자 정보 (개발 환경에서만 표시)');
      expect(detailsButton).toBeInTheDocument();

      // details 요소 클릭
      fireEvent.click(detailsButton);
      expect(screen.getByText('Detailed test error')).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
      consoleSpy.mockRestore();
    });

    it('에러 ID를 생성하고 표시해야 한다', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // 에러 ID가 표시되는지 확인
      expect(screen.getByText('오류 ID:')).toBeInTheDocument();
      expect(screen.getByText(/error_\d+_\w+/)).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('에러 리포팅', () => {
    it('로컬 스토리지에 에러를 저장해야 한다', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockLocalStorage.getItem.mockReturnValue('[]');

      render(
        <ErrorBoundary enableReporting={true}>
          <ThrowErrorComponent shouldThrow={true} errorMessage="Storage test error" />
        </ErrorBoundary>
      );

      // localStorage.setItem이 호출되었는지 확인
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'vive_error_logs',
        expect.stringContaining('Storage test error')
      );

      consoleSpy.mockRestore();
    });

    it('원격 서버로 에러를 전송해야 한다', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce({ ok: true });

      render(
        <ErrorBoundary 
          enableReporting={true} 
          reportEndpoint="/api/errors/test"
        >
          <ThrowErrorComponent shouldThrow={true} errorMessage="Remote test error" />
        </ErrorBoundary>
      );

      // fetch가 호출될 때까지 대기
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/errors/test',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining('Remote test error'),
        })
      );

      consoleSpy.mockRestore();
    });

    it('커스텀 에러 핸들러를 호출해야 한다', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const customHandler = vi.fn();

      render(
        <ErrorBoundary onError={customHandler}>
          <ThrowErrorComponent shouldThrow={true} errorMessage="Custom handler test" />
        </ErrorBoundary>
      );

      expect(customHandler).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Custom handler test' }),
        expect.objectContaining({ componentStack: expect.any(String) })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('에러 복구', () => {
    it('다시 시도 버튼을 클릭하면 컴포넌트가 다시 렌더링되어야 한다', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { rerender } = render(
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // 에러 UI가 표시되는지 확인
      expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument();

      // 다시 시도 버튼 클릭
      const retryButton = screen.getByText('다시 시도');
      fireEvent.click(retryButton);

      // 컴포넌트를 정상 상태로 다시 렌더링
      rerender(
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('No error')).toBeInTheDocument();
      expect(screen.queryByText('문제가 발생했습니다')).not.toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('새로고침 버튼을 클릭하면 페이지를 새로고침해야 한다', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockReload = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: mockReload },
        writable: true,
      });

      render(
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      const refreshButton = screen.getByText('새로고침');
      fireEvent.click(refreshButton);

      expect(mockReload).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('커스텀 fallback UI', () => {
    it('커스텀 fallback UI를 사용해야 한다', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const customFallback = (error: Error, errorInfo: any, onRetry: () => void) => (
        <div>
          <h1>Custom Error UI</h1>
          <p>Error: {error.message}</p>
          <button onClick={onRetry}>Custom Retry</button>
        </div>
      );

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowErrorComponent shouldThrow={true} errorMessage="Custom fallback test" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
      expect(screen.getByText('Error: Custom fallback test')).toBeInTheDocument();
      expect(screen.getByText('Custom Retry')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('HOC (withErrorBoundary)', () => {
    it('HOC로 감싼 컴포넌트가 정상 동작해야 한다', () => {
      const TestComponent = () => <div>HOC Test Component</div>;
      const WrappedComponent = withErrorBoundary(TestComponent);

      render(<WrappedComponent />);

      expect(screen.getByText('HOC Test Component')).toBeInTheDocument();
    });

    it('HOC로 감싼 컴포넌트에서 에러가 발생하면 Error Boundary가 처리해야 한다', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const ErrorComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
        if (shouldThrow) throwError('HOC error test');
        return <div>HOC working</div>;
      };
      
      const WrappedComponent = withErrorBoundary(ErrorComponent);

      render(<WrappedComponent shouldThrow={true} />);

      expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('로그 관리', () => {
    it('저장된 에러 로그 수를 표시해야 한다', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockLogs = [
        { id: 'error1', message: 'Error 1' },
        { id: 'error2', message: 'Error 2' }
      ];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockLogs));

      render(
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('로그 삭제 (2)')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('로그 삭제 버튼을 클릭하면 로그가 삭제되어야 한다', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockLogs = [{ id: 'error1', message: 'Error 1' }];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockLogs));

      render(
        <ErrorBoundary>
          <ThrowErrorComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      const clearButton = screen.getByText('로그 삭제 (1)');
      fireEvent.click(clearButton);

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('vive_error_logs');

      consoleSpy.mockRestore();
    });
  });
});