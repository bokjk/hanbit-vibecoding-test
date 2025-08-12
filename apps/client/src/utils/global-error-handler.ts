/**
 * 전역 에러 처리 유틸리티
 * React Error Boundary로 잡히지 않는 에러들을 처리합니다.
 */

interface GlobalErrorHandlerConfig {
  enableConsoleLogging?: boolean;
  enableReporting?: boolean;
  reportEndpoint?: string;
  onError?: (error: Error, context: string) => void;
}

class GlobalErrorHandler {
  private config: GlobalErrorHandlerConfig;
  private static instance: GlobalErrorHandler;

  private constructor(config: GlobalErrorHandlerConfig = {}) {
    this.config = {
      enableConsoleLogging: true,
      enableReporting: false,
      ...config,
    };
  }

  /**
   * 싱글톤 인스턴스 생성/반환
   */
  static getInstance(config?: GlobalErrorHandlerConfig): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler(config);
    }
    return GlobalErrorHandler.instance;
  }

  /**
   * 전역 에러 리스너 초기화
   */
  initialize(): void {
    // JavaScript 런타임 에러 처리
    window.addEventListener("error", this.handleGlobalError);

    // Promise rejection 처리
    window.addEventListener(
      "unhandledrejection",
      this.handleUnhandledRejection,
    );

    // 리소스 로딩 에러 처리 (이미지, 스크립트 등)
    window.addEventListener("error", this.handleResourceError, true);

    if (
      this.config.enableConsoleLogging &&
      process.env.NODE_ENV === "development"
    ) {
      console.info("🛡️ Global Error Handler initialized");
    }
  }

  /**
   * 전역 에러 리스너 제거
   */
  cleanup(): void {
    window.removeEventListener("error", this.handleGlobalError);
    window.removeEventListener(
      "unhandledrejection",
      this.handleUnhandledRejection,
    );
    window.removeEventListener("error", this.handleResourceError, true);
  }

  /**
   * 일반 JavaScript 에러 처리
   */
  private handleGlobalError = (event: ErrorEvent): void => {
    const error = event.error || new Error(event.message);
    const context = `Global Error - ${event.filename}:${event.lineno}:${event.colno}`;

    this.logError(error, context);
    this.reportError(error, context);
    this.callCustomHandler(error, context);
  };

  /**
   * 처리되지 않은 Promise rejection 처리
   */
  private handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const error =
      event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));
    const context = "Unhandled Promise Rejection";

    this.logError(error, context);
    this.reportError(error, context);
    this.callCustomHandler(error, context);

    // 브라우저 콘솔 에러 방지 (선택적)
    event.preventDefault();
  };

  /**
   * 리소스 로딩 에러 처리 (이미지, 스크립트 등)
   */
  private handleResourceError = (event: Event): void => {
    const target = event.target as HTMLElement;

    if (target && target !== window) {
      const error = new Error(
        `Failed to load resource: ${this.getResourceInfo(target)}`,
      );
      const context = "Resource Loading Error";

      this.logError(error, context);
      this.reportError(error, context);
      this.callCustomHandler(error, context);
    }
  };

  /**
   * 리소스 정보 추출
   */
  private getResourceInfo(element: HTMLElement): string {
    if (element.tagName === "IMG") {
      return (element as HTMLImageElement).src;
    }
    if (element.tagName === "SCRIPT") {
      return (element as HTMLScriptElement).src;
    }
    if (element.tagName === "LINK") {
      return (element as HTMLLinkElement).href;
    }
    return element.tagName.toLowerCase();
  }

  /**
   * 에러 로깅
   */
  private logError(error: Error, context: string): void {
    if (this.config.enableConsoleLogging) {
      console.group(`🚨 ${context}`);
      console.error("Error:", error.message);
      console.error("Stack:", error.stack);
      console.error("Context:", context);
      console.error("Timestamp:", new Date().toISOString());
      console.error("URL:", window.location.href);
      console.error("User Agent:", navigator.userAgent);
      console.groupEnd();
    }
  }

  /**
   * 에러 리포팅
   */
  private async reportError(error: Error, context: string): Promise<void> {
    if (!this.config.enableReporting || !this.config.reportEndpoint) {
      return;
    }

    try {
      const payload = {
        id: `global_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        context,
        url: window.location.href,
        userAgent: navigator.userAgent,
        environment: process.env.NODE_ENV,
        type: "global_error",
      };

      await fetch(this.config.reportEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (reportError) {
      if (this.config.enableConsoleLogging) {
        console.error("Failed to report error:", reportError);
      }
    }
  }

  /**
   * 사용자 정의 에러 핸들러 호출
   */
  private callCustomHandler(error: Error, context: string): void {
    if (this.config.onError) {
      try {
        this.config.onError(error, context);
      } catch (handlerError) {
        if (this.config.enableConsoleLogging) {
          console.error("Error in custom global error handler:", handlerError);
        }
      }
    }
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: Partial<GlobalErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * 전역 에러 핸들러 초기화 함수
 */
export function initializeGlobalErrorHandler(
  config?: GlobalErrorHandlerConfig,
): GlobalErrorHandler {
  const handler = GlobalErrorHandler.getInstance(config);
  handler.initialize();
  return handler;
}

/**
 * 전역 에러 핸들러 정리 함수
 */
export function cleanupGlobalErrorHandler(): void {
  GlobalErrorHandler.getInstance().cleanup();
}

/**
 * 수동 에러 리포팅 함수
 */
export function reportError(
  error: Error,
  context: string = "Manual Report",
): void {
  const handler = GlobalErrorHandler.getInstance();
  handler["reportError"](error, context);
}
