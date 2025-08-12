/**
 * 모니터링 시스템 조기 초기화
 * React 애플리케이션이 시작되기 전에 전역 에러 핸들러와 모니터링을 설정합니다.
 */

import PerformanceMonitor from "./performance-monitor";
import ErrorReporter from "./error-reporter";
import AnalyticsService from "../services/analytics.service";

/**
 * 모니터링 시스템 조기 초기화
 * 이 함수는 React 앱이 시작되기 전에 실행되어 전역 에러와 성능을 추적합니다.
 */
function initializeMonitoring(): void {
  const isEnabled = shouldEnableMonitoring();

  if (!isEnabled) {
    console.log("[Monitoring] Monitoring is disabled");
    return;
  }

  console.log("[Monitoring] Initializing early monitoring systems");

  try {
    // Performance Monitor 초기화
    const performanceMonitor = PerformanceMonitor.getInstance();

    // Error Reporter 초기화
    const errorReporter = ErrorReporter.getInstance();

    // Analytics Service 초기화
    const analyticsService = AnalyticsService.getInstance({
      enableDebugLogging: import.meta.env.VITE_DEBUG === "true",
      batchSize: 15, // 조금 더 작은 배치 크기로 빠른 전송
      flushInterval: 8000, // 8초마다 플러시
    });

    // Performance Monitor와 Analytics Service 연결
    performanceMonitor.onMetric((metric) => {
      analyticsService.trackPerformanceMetric(metric);
    });

    // Error Reporter와 Analytics Service 연결
    errorReporter.onError((error) => {
      analyticsService.trackError(error);
    });

    // 전역 React 에러 핸들러 설정
    setupReactErrorHandler(errorReporter);

    // 초기 페이지 로드 이벤트 추적
    analyticsService.trackEvent({
      type: "user_interaction",
      category: "application",
      action: "startup",
      label: "app_initialization",
      metadata: {
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        url: window.location.href,
      },
    });

    console.log(
      "[Monitoring] Early monitoring systems initialized successfully",
    );

    // 개발 환경에서 모니터링 통계를 콘솔에 출력
    if (import.meta.env.VITE_DEBUG === "true") {
      // 5초 후 초기 통계 출력
      setTimeout(() => {
        const performanceMetrics = performanceMonitor.getMetrics();
        const errorStats = errorReporter.getStats();
        const analyticsStats = analyticsService.getStats();

        console.group("[Monitoring] Initial Statistics");
        console.log("Performance:", performanceMetrics);
        console.log("Errors:", errorStats);
        console.log("Analytics:", analyticsStats);
        console.groupEnd();
      }, 5000);
    }
  } catch (error) {
    console.error(
      "[Monitoring] Failed to initialize monitoring systems:",
      error,
    );
  }
}

/**
 * 모니터링 활성화 여부 확인
 */
function shouldEnableMonitoring(): boolean {
  const isProduction = import.meta.env.MODE === "production";
  const isDebugMode = import.meta.env.VITE_DEBUG === "true";
  const enableMonitoring = import.meta.env.VITE_ENABLE_MONITORING !== "false";

  return enableMonitoring && (isProduction || isDebugMode);
}

/**
 * React 에러 핸들러 설정
 */
function setupReactErrorHandler(errorReporter: ErrorReporter): void {
  // React Error Boundary에서 사용할 수 있도록 전역 함수로 설정
  (
    window as unknown as {
      __reportReactError: (error: Error, errorInfo: React.ErrorInfo) => void;
    }
  ).__reportReactError = (error: Error, errorInfo: React.ErrorInfo) => {
    errorReporter.reportReactError(error, errorInfo);
  };

  // 개발 환경에서 React 에러 추가 정보 수집
  if (import.meta.env.VITE_DEBUG === "true") {
    // React DevTools가 있을 때 추가 정보 수집
    if (
      (window as unknown as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: unknown })
        .__REACT_DEVTOOLS_GLOBAL_HOOK__
    ) {
      console.log(
        "[Monitoring] React DevTools detected, enhanced error reporting enabled",
      );
    }
  }
}

/**
 * 애플리케이션 종료 시 모니터링 정리
 */
function setupCleanupHandlers(): void {
  const cleanup = () => {
    console.log(
      "[Monitoring] Application shutting down, cleaning up monitoring systems",
    );

    try {
      const performanceMonitor = PerformanceMonitor.getInstance();
      const errorReporter = ErrorReporter.getInstance();
      const analyticsService = AnalyticsService.getInstance();

      // 마지막 데이터 전송 시도
      analyticsService.trackEvent({
        type: "user_interaction",
        category: "application",
        action: "shutdown",
        label: "app_termination",
        metadata: {
          timestamp: Date.now(),
          sessionDuration: Date.now() - performance.timing.navigationStart,
        },
      });

      // 즉시 플러시
      analyticsService.flushNow();

      // 리소스 정리
      performanceMonitor.destroy();
      errorReporter.destroy();
      analyticsService.destroy();
    } catch (error) {
      console.error("[Monitoring] Error during cleanup:", error);
    }
  };

  // 다양한 종료 이벤트에 대응
  window.addEventListener("beforeunload", cleanup);
  window.addEventListener("pagehide", cleanup);

  // 모바일 환경 대응
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      cleanup();
    }
  });
}

// 즉시 초기화 실행
initializeMonitoring();
setupCleanupHandlers();

// 모듈 내보내기 (필요시 수동으로 초기화할 수 있도록)
export { initializeMonitoring, shouldEnableMonitoring };
export default initializeMonitoring;
