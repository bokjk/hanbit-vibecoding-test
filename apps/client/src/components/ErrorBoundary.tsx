import React, { Component, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@vive/ui";
import { Button } from "@vive/ui";
import styles from "./ErrorBoundary.module.scss";

interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  eventId: string | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (
    error: Error,
    errorInfo: ErrorInfo,
    onRetry: () => void,
  ) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableReporting?: boolean;
  reportEndpoint?: string;
}

/**
 * 에러 정보를 저장하고 전송하는 서비스
 */
/* eslint-disable react-refresh/only-export-components */
class ErrorReportingService {
  private static readonly STORAGE_KEY = "vive_error_logs";
  private static readonly MAX_STORED_ERRORS = 10;

  /**
   * 에러를 로컬 스토리지에 저장
   */
  static saveErrorToLocalStorage(
    error: Error,
    errorInfo: ErrorInfo,
    eventId: string,
  ): void {
    try {
      const errorLog = {
        id: eventId,
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        environment: process.env.NODE_ENV,
      };

      const existingLogs = this.getStoredErrors();
      const newLogs = [errorLog, ...existingLogs].slice(
        0,
        this.MAX_STORED_ERRORS,
      );

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newLogs));

      console.warn("Error saved to localStorage:", errorLog);
    } catch (storageError) {
      console.error("Failed to save error to localStorage:", storageError);
    }
  }

  /**
   * 저장된 에러 로그 조회
   */
  static getStoredErrors(): Array<Record<string, unknown>> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * 저장된 에러 로그 삭제
   */
  static clearStoredErrors(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear error logs:", error);
    }
  }

  /**
   * 원격 서버로 에러 전송
   */
  static async reportToServer(
    error: Error,
    errorInfo: ErrorInfo,
    eventId: string,
    endpoint?: string,
  ): Promise<boolean> {
    if (!endpoint) {
      console.warn("No reporting endpoint configured");
      return false;
    }

    try {
      const payload = {
        id: eventId,
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        environment: process.env.NODE_ENV,
        type: "react_error_boundary",
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.info("Error reported successfully:", eventId);
        return true;
      } else {
        console.error("Failed to report error:", response.statusText);
        return false;
      }
    } catch (reportError) {
      console.error("Error reporting failed:", reportError);
      return false;
    }
  }
}

/**
 * 기본 에러 UI 컴포넌트
 */
interface DefaultErrorUIProps {
  error: Error;
  errorInfo: ErrorInfo;
  eventId: string | null;
  onRetry: () => void;
  onClearLogs: () => void;
  storedErrorCount: number;
}

function DefaultErrorUI({
  error,
  errorInfo,
  eventId,
  onRetry,
  onClearLogs,
  storedErrorCount,
}: DefaultErrorUIProps) {
  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <div className={styles.wrapper}>
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle className={styles.cardTitle}>
            <svg
              className={styles.titleIcon}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            문제가 발생했습니다
          </CardTitle>
        </CardHeader>
        <CardContent className={styles.cardContent}>
          <div className={styles.description}>
            <p>애플리케이션에서 예상치 못한 오류가 발생했습니다.</p>
            <p>잠시 후 다시 시도하시거나 페이지를 새로고침해 주세요.</p>
          </div>

          {eventId && (
            <div className={styles.errorIdBox}>
              <strong>오류 ID:</strong> {eventId}
              <br />
              <span className={styles.errorIdLabel}>
                문의 시 이 ID를 함께 전달해 주세요.
              </span>
            </div>
          )}

          {isDevelopment && (
            <div className={styles.devInfoWrapper}>
              <details className="group">
                <summary className={styles.devInfoSummary}>
                  개발자 정보 (개발 환경에서만 표시)
                </summary>
                <div className={styles.devInfoDetails}>
                  <div className={styles.errorMessageBox}>
                    <strong className={styles.errorMessageLabel}>에러 메시지:</strong>
                    <pre className={styles.errorMessageText}>
                      {error.message}
                    </pre>
                  </div>

                  {error.stack && (
                    <div className={styles.stackTraceBox}>
                      <strong className={styles.stackTraceLabel}>스택 추적:</strong>
                      <pre className={styles.stackTraceText}>
                        {error.stack}
                      </pre>
                    </div>
                  )}

                  <div className={styles.componentStackBox}>
                    <strong className={styles.componentStackLabel}>컴포넌트 스택:</strong>
                    <pre className={styles.componentStackText}>
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                </div>
              </details>
            </div>
          )}

          <div className={styles.actionsWrapper}>
            <Button onClick={onRetry} className={styles.actionButton}>
              <svg
                style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              다시 시도
            </Button>

            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className={styles.actionButton}
            >
              <svg
                style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              새로고침
            </Button>

            {storedErrorCount > 0 && (
              <Button
                variant="outline"
                onClick={onClearLogs}
                className={styles.actionButtonSmallText}
              >
                로그 삭제 ({storedErrorCount})
              </Button>
            )}
          </div>

          <div className={styles.footerText}>
            이 문제가 계속 발생하면 브라우저의 캐시와 쿠키를 삭제하거나 다른
            브라우저를 사용해 보세요.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * React Error Boundary 컴포넌트
 * 하위 컴포넌트에서 발생하는 JavaScript 에러를 포착하고 처리합니다.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  private retryTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
    };
  }

  /**
   * 에러 발생 시 상태 업데이트
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 에러 ID 생성
    const eventId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      hasError: true,
      error,
      eventId,
    };
  }

  /**
   * 에러 정보를 받고 로깅 및 리포팅 처리
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, enableReporting = true, reportEndpoint } = this.props;
    const { eventId } = this.state;

    // 상태에 에러 정보 저장
    this.setState({ errorInfo });

    // 사용자 정의 에러 핸들러 실행
    if (onError) {
      try {
        onError(error, errorInfo);
      } catch (handlerError) {
        console.error("Error in custom error handler:", handlerError);
      }
    }

    // 모니터링 시스템에 React 에러 보고
    try {
      if (
        (
          window as Window & {
            __reportReactError?: (error: Error, errorInfo: unknown) => void;
          }
        ).__reportReactError
      ) {
        (
          window as Window & {
            __reportReactError?: (error: Error, errorInfo: unknown) => void;
          }
        ).__reportReactError(error, errorInfo);
      }
    } catch (monitoringError) {
      console.error("Failed to report to monitoring system:", monitoringError);
    }

    // 에러 로깅 및 리포팅 (기존 시스템 유지)
    if (enableReporting && eventId) {
      // 로컬 스토리지에 저장
      ErrorReportingService.saveErrorToLocalStorage(error, errorInfo, eventId);

      // 원격 서버로 전송 (백그라운드에서 실행)
      if (reportEndpoint) {
        ErrorReportingService.reportToServer(
          error,
          errorInfo,
          eventId,
          reportEndpoint,
        ).catch((reportError) => {
          console.error("Background error reporting failed:", reportError);
        });
      }
    }

    // 개발 환경에서는 콘솔에 상세 정보 출력
    if (process.env.NODE_ENV === "development") {
      console.group(`🚨 Error Boundary Caught Error (${eventId})`);
      console.error("Error:", error);
      console.error("Component Stack:", errorInfo.componentStack);
      console.groupEnd();
    }
  }

  /**
   * 컴포넌트가 언마운트될 때 타이머 정리
   */
  componentWillUnmount() {
    if (this.retryTimeoutId) {
      window.clearTimeout(this.retryTimeoutId);
    }
  }

  /**
   * 에러 상태 초기화 및 재시도
   */
  handleRetry = () => {
    // 즉시 UI 업데이트를 위해 상태 리셋
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
    });

    // 약간의 지연 후 강제 리렌더링 (React의 에러 복구 메커니즘)
    this.retryTimeoutId = window.setTimeout(() => {
      this.forceUpdate();
    }, 100);
  };

  /**
   * 저장된 에러 로그 삭제
   */
  handleClearLogs = () => {
    ErrorReportingService.clearStoredErrors();
    // 사용자에게 피드백 제공 (옵션)
    if (process.env.NODE_ENV === "development") {
      console.info("Error logs cleared");
    }
  };

  render() {
    const { children, fallback } = this.props;
    const { hasError, error, errorInfo, eventId } = this.state;

    if (hasError && error && errorInfo) {
      // 사용자 정의 fallback UI가 있으면 사용
      if (fallback) {
        try {
          return fallback(error, errorInfo, this.handleRetry);
        } catch (fallbackError) {
          console.error("Error in custom fallback component:", fallbackError);
          // fallback 컴포넌트에서 에러가 발생하면 기본 UI로 폴백
        }
      }

      // 기본 에러 UI 렌더링
      const storedErrorCount = ErrorReportingService.getStoredErrors().length;

      return (
        <DefaultErrorUI
          error={error}
          errorInfo={errorInfo}
          eventId={eventId}
          onRetry={this.handleRetry}
          onClearLogs={this.handleClearLogs}
          storedErrorCount={storedErrorCount}
        />
      );
    }

    return children;
  }
}

/**
 * 함수형 컴포넌트를 위한 HOC (Higher Order Component)
 */

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">,
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * 수동으로 에러를 발생시키는 유틸리티 (테스트용)
 */
export function throwError(message: string = "Test error"): never {
  throw new Error(message);
}

/**
 * 비동기 에러를 처리하기 위한 유틸리티
 */
export function handleAsyncError(
  error: Error,
  context: string = "Async operation",
) {
  console.error(`${context}:`, error);

  // 에러를 전역 에러 핸들러에 전달
  window.dispatchEvent(
    new ErrorEvent("error", {
      error,
      message: error.message,
      filename: context,
    }),
  );
}
