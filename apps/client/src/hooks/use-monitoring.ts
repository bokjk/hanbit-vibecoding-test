/**
 * 모니터링 훅
 * React 애플리케이션과 성능 모니터링 및 에러 리포팅 시스템의 통합을 담당합니다.
 */

import { useEffect, useRef, useCallback, useMemo } from "react";
import PerformanceMonitor from "../utils/performance-monitor";
import ErrorReporter from "../utils/error-reporter";
import AnalyticsService from "../services/analytics.service";
import type { PerformanceMetric } from "../utils/performance-monitor";
import type { ErrorReport } from "../utils/error-reporter";
import type { AnalyticsConfig } from "../services/analytics.service";

export interface MonitoringConfig {
  performance?: {
    enabled: boolean;
    trackWebVitals: boolean;
    trackUserInteractions: boolean;
    trackMemoryUsage: boolean;
    trackNetworkRequests: boolean;
  };
  errorReporting?: {
    enabled: boolean;
    trackJavaScriptErrors: boolean;
    trackResourceErrors: boolean;
    trackApiErrors: boolean;
    trackUnhandledRejections: boolean;
    maxErrorsPerSession: number;
  };
  analytics?: Partial<AnalyticsConfig> & {
    enabled: boolean;
  };
  debug?: boolean;
}

export interface MonitoringStats {
  performance: {
    webVitals: Record<string, number>;
    interactionCount: number;
    networkRequestCount: number;
    memoryUsage?: {
      used: number;
      total: number;
      limit: number;
    };
  };
  errors: {
    sessionId: string;
    errorCount: number;
    sessionDuration: number;
  };
  analytics: {
    sessionId: string;
    queueSize: number;
    failedBatchesCount: number;
    lastFlushTime: number;
  };
}

/**
 * 모니터링 시스템을 React 애플리케이션에 통합하는 훅
 */
export function useMonitoring(config?: MonitoringConfig) {
  const configRef = useRef<MonitoringConfig | null>(null);
  const performanceMonitorRef = useRef<PerformanceMonitor | null>(null);
  const errorReporterRef = useRef<ErrorReporter | null>(null);
  const analyticsServiceRef = useRef<AnalyticsService | null>(null);
  const isInitializedRef = useRef(false);

  // 기본 설정
  const defaultConfig: MonitoringConfig = useMemo(
    () => ({
      performance: {
        enabled: true,
        trackWebVitals: true,
        trackUserInteractions: true,
        trackMemoryUsage: true,
        trackNetworkRequests: true,
      },
      errorReporting: {
        enabled: true,
        trackJavaScriptErrors: true,
        trackResourceErrors: true,
        trackApiErrors: true,
        trackUnhandledRejections: true,
        maxErrorsPerSession: 100,
      },
      analytics: {
        enabled: true,
        batchSize: 20,
        flushInterval: 10000,
        maxRetries: 3,
        retryDelay: 1000,
        enableCompression: true,
        enableQueuePersistence: true,
        maxQueueSize: 1000,
        enableDebugLogging: import.meta.env.VITE_DEBUG === "true",
      },
      debug: import.meta.env.VITE_DEBUG === "true",
    }),
    [],
  );

  // 설정 병합
  const mergedConfig = useMemo(() => {
    return {
      ...defaultConfig,
      ...config,
      performance: { ...defaultConfig.performance, ...config?.performance },
      errorReporting: {
        ...defaultConfig.errorReporting,
        ...config?.errorReporting,
      },
      analytics: { ...defaultConfig.analytics, ...config?.analytics },
    };
  }, [defaultConfig, config]);

  // 환경변수 기반 활성화 여부 확인
  const isEnabled = useMemo(() => {
    const isProduction = import.meta.env.MODE === "production";
    const isDebugMode = import.meta.env.VITE_DEBUG === "true";
    const enableMonitoring = import.meta.env.VITE_ENABLE_MONITORING !== "false";

    return enableMonitoring && (isProduction || isDebugMode);
  }, []);

  // 디버그 로깅
  const debugLog = useCallback(
    (message: string, data?: unknown) => {
      if (mergedConfig.debug) {
        console.log(`[Monitoring] ${message}`, data || "");
      }
    },
    [mergedConfig.debug],
  );

  /**
   * 모니터링 시스템 초기화
   */
  const initializeMonitoring = useCallback(() => {
    if (!isEnabled || isInitializedRef.current) return;

    debugLog("Initializing monitoring systems");

    // Performance Monitor 초기화
    if (mergedConfig.performance?.enabled) {
      performanceMonitorRef.current = PerformanceMonitor.getInstance();

      performanceMonitorRef.current.onMetric((metric: PerformanceMetric) => {
        debugLog("Performance metric received", {
          name: metric.name,
          value: metric.value,
        });

        // Analytics 서비스로 전송
        if (analyticsServiceRef.current) {
          analyticsServiceRef.current.trackPerformanceMetric(metric);
        }
      });

      debugLog("Performance monitoring enabled");
    }

    // Error Reporter 초기화
    if (mergedConfig.errorReporting?.enabled) {
      errorReporterRef.current = ErrorReporter.getInstance();

      errorReporterRef.current.onError((error: ErrorReport) => {
        debugLog("Error report received", {
          type: error.type,
          message: error.message.substring(0, 50) + "...",
          severity: error.severity,
        });

        // Analytics 서비스로 전송
        if (analyticsServiceRef.current) {
          analyticsServiceRef.current.trackError(error);
        }
      });

      debugLog("Error reporting enabled");
    }

    // Analytics 서비스 초기화
    if (mergedConfig.analytics?.enabled) {
      analyticsServiceRef.current = AnalyticsService.getInstance(
        mergedConfig.analytics,
      );
      debugLog("Analytics service enabled");
    }

    configRef.current = mergedConfig as MonitoringConfig;
    isInitializedRef.current = true;
    debugLog("Monitoring initialization complete");
  }, [isEnabled, mergedConfig, debugLog]);

  /**
   * 모니터링 시스템 정리
   */
  const cleanupMonitoring = useCallback(() => {
    if (!isInitializedRef.current) return;

    debugLog("Cleaning up monitoring systems");

    if (performanceMonitorRef.current) {
      performanceMonitorRef.current.destroy();
      performanceMonitorRef.current = null;
    }

    if (errorReporterRef.current) {
      errorReporterRef.current.destroy();
      errorReporterRef.current = null;
    }

    if (analyticsServiceRef.current) {
      analyticsServiceRef.current.destroy();
      analyticsServiceRef.current = null;
    }

    isInitializedRef.current = false;
    debugLog("Monitoring cleanup complete");
  }, [debugLog]);

  // React Error Boundary 에러 리포팅
  const reportReactError = useCallback(
    (error: Error, errorInfo: React.ErrorInfo) => {
      if (errorReporterRef.current) {
        errorReporterRef.current.reportReactError(error, errorInfo);
        debugLog("React error reported", { message: error.message });
      }
    },
    [debugLog],
  );

  // API 에러 리포팅
  const reportApiError = useCallback(
    (
      url: string,
      method: string,
      status: number,
      statusText: string,
      duration: number,
      responseText?: string,
      requestBody?: unknown,
    ) => {
      if (errorReporterRef.current) {
        errorReporterRef.current.reportApiError({
          url,
          method,
          status,
          statusText,
          responseText,
          requestBody,
          timestamp: Date.now(),
          duration,
        });
        debugLog("API error reported", { url, method, status });
      }
    },
    [debugLog],
  );

  // API 호출 성능 추적
  const trackApiCall = useCallback(
    (url: string, method: string, duration: number, status: number) => {
      if (performanceMonitorRef.current) {
        performanceMonitorRef.current.trackApiCall(
          url,
          method,
          duration,
          status,
        );
        debugLog("API call tracked", { url, method, duration, status });
      }
    },
    [debugLog],
  );

  // 사용자 상호작용 추적
  const trackUserInteraction = useCallback(
    (
      category: string,
      action: string,
      label?: string,
      value?: number,
      metadata?: Record<string, unknown>,
    ) => {
      if (analyticsServiceRef.current) {
        analyticsServiceRef.current.trackUserInteraction(
          category,
          action,
          label,
          value,
          metadata,
        );
        debugLog("User interaction tracked", { category, action, label });
      }
    },
    [debugLog],
  );

  // 페이지 뷰 추적
  const trackPageView = useCallback(
    (page?: string) => {
      if (analyticsServiceRef.current) {
        analyticsServiceRef.current.trackPageView(page);
        debugLog("Page view tracked", {
          page: page || window.location.pathname,
        });
      }
    },
    [debugLog],
  );

  // 커스텀 메트릭 추적
  const trackCustomMetric = useCallback(
    (name: string, value: number, metadata?: Record<string, unknown>) => {
      if (analyticsServiceRef.current) {
        analyticsServiceRef.current.trackCustomMetric(name, value, metadata);
        debugLog("Custom metric tracked", { name, value });
      }
    },
    [debugLog],
  );

  // 커스텀 이벤트 추적
  const trackEvent = useCallback(
    (
      category: string,
      action: string,
      label?: string,
      value?: number,
      metadata?: Record<string, unknown>,
    ) => {
      if (analyticsServiceRef.current) {
        analyticsServiceRef.current.trackEvent({
          type: "custom",
          category,
          action,
          label,
          value,
          metadata,
        });
        debugLog("Custom event tracked", { category, action, label });
      }
    },
    [debugLog],
  );

  // 즉시 데이터 전송
  const flushNow = useCallback(async () => {
    if (analyticsServiceRef.current) {
      await analyticsServiceRef.current.flushNow();
      debugLog("Analytics data flushed");
    }
  }, [debugLog]);

  // 통계 조회
  const getStats = useCallback((): MonitoringStats | null => {
    if (!isInitializedRef.current) return null;

    const performanceStats = performanceMonitorRef.current?.getMetrics();
    const errorStats = errorReporterRef.current?.getStats();
    const analyticsStats = analyticsServiceRef.current?.getStats();

    return {
      performance: {
        webVitals: performanceStats?.webVitals || {},
        interactionCount: performanceStats?.interactions.length || 0,
        networkRequestCount: performanceStats?.networkMetrics.length || 0,
        memoryUsage: performanceStats?.memoryMetrics.length
          ? performanceStats.memoryMetrics[
              performanceStats.memoryMetrics.length - 1
            ]
          : undefined,
      },
      errors: {
        sessionId: errorStats?.sessionId || "",
        errorCount: errorStats?.errorCount || 0,
        sessionDuration: errorStats?.sessionDuration || 0,
      },
      analytics: {
        sessionId: analyticsStats?.sessionId || "",
        queueSize: analyticsStats?.queueSize || 0,
        failedBatchesCount: analyticsStats?.failedBatchesCount || 0,
        lastFlushTime: analyticsStats?.lastFlushTime || 0,
      },
    };
  }, []);

  // 초기화 및 정리
  useEffect(() => {
    initializeMonitoring();

    return () => {
      cleanupMonitoring();
    };
  }, [initializeMonitoring, cleanupMonitoring]);

  // 페이지 변경 감지 및 추적
  useEffect(() => {
    if (!isInitializedRef.current) return;

    // 초기 페이지 뷰 추적
    trackPageView();

    // URL 변경 감지 (SPA용)
    let currentUrl = window.location.href;

    const checkUrlChange = () => {
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        trackPageView();
        currentUrl = newUrl;
      }
    };

    // MutationObserver로 DOM 변경 감지 (React Router 등)
    const observer = new MutationObserver(() => {
      setTimeout(checkUrlChange, 0); // 다음 틱에서 확인
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [trackPageView]);

  return {
    // 상태
    isEnabled,
    isInitialized: isInitializedRef.current,
    config: configRef.current,

    // 에러 리포팅
    reportReactError,
    reportApiError,

    // 성능 추적
    trackApiCall,

    // Analytics 추적
    trackUserInteraction,
    trackPageView,
    trackCustomMetric,
    trackEvent,

    // 유틸리티
    flushNow,
    getStats,

    // 디버그
    debugLog,
  };
}

/**
 * React Error Boundary와 함께 사용하기 위한 헬퍼 훅
 */
export function useErrorBoundaryReporting() {
  const { reportReactError } = useMonitoring();

  const reportError = useCallback(
    (error: Error, errorInfo: React.ErrorInfo) => {
      reportReactError(error, errorInfo);
    },
    [reportReactError],
  );

  return { reportError };
}

/**
 * API 요청과 함께 사용하기 위한 헬퍼 훅
 */
export function useApiMonitoring() {
  const { reportApiError, trackApiCall } = useMonitoring();

  const trackRequest = useCallback(
    (
      url: string,
      method: string,
      startTime: number,
      response?: Response,
      error?: Error,
    ) => {
      const duration = Date.now() - startTime;

      if (response) {
        trackApiCall(url, method, duration, response.status);

        if (!response.ok) {
          reportApiError(
            url,
            method,
            response.status,
            response.statusText,
            duration,
          );
        }
      } else if (error) {
        reportApiError(url, method, 0, error.message, duration);
      }
    },
    [reportApiError, trackApiCall],
  );

  return { trackRequest };
}

export default useMonitoring;
