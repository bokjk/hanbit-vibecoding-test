/**
 * 모니터링 시스템 데모 컴포넌트
 * 개발 환경에서 모니터링 기능을 테스트하고 확인할 수 있는 데모를 제공합니다.
 */

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@vive/ui";
import { Button } from "@vive/ui";
import useMonitoring from "../hooks/use-monitoring";
import type { MonitoringStats } from "../hooks/use-monitoring";

export function MonitoringDemo() {
  const {
    isEnabled,
    isInitialized,
    trackUserInteraction,
    trackCustomMetric,
    trackEvent,
    reportApiError,
    flushNow,
    getStats,
    debugLog,
  } = useMonitoring();

  const [stats, setStats] = useState<MonitoringStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 통계 업데이트
  const updateStats = useCallback(() => {
    const currentStats = getStats();
    setStats(currentStats);
    debugLog("Stats updated", currentStats);
  }, [getStats, debugLog]);

  // 주기적으로 통계 업데이트
  useEffect(() => {
    if (!isEnabled) return;

    updateStats();
    const interval = setInterval(updateStats, 5000); // 5초마다 업데이트

    return () => clearInterval(interval);
  }, [isEnabled, updateStats]);

  // 클릭 이벤트 시뮬레이션
  const simulateClick = useCallback(() => {
    trackUserInteraction("demo", "button_click", "simulate_click", 1, {
      timestamp: Date.now(),
      component: "MonitoringDemo",
    });
    debugLog("Click event simulated");
  }, [trackUserInteraction, debugLog]);

  // 커스텀 메트릭 전송
  const sendCustomMetric = useCallback(() => {
    const randomValue = Math.floor(Math.random() * 100);
    trackCustomMetric("demo_metric", randomValue, {
      source: "demo_component",
      timestamp: Date.now(),
    });
    debugLog("Custom metric sent", { value: randomValue });
  }, [trackCustomMetric, debugLog]);

  // 커스텀 이벤트 전송
  const sendCustomEvent = useCallback(() => {
    trackEvent("demo", "custom_action", "user_triggered", undefined, {
      source: "demo_component",
      timestamp: Date.now(),
      userAgent: navigator.userAgent.substring(0, 50) + "...",
    });
    debugLog("Custom event sent");
  }, [trackEvent, debugLog]);

  // API 에러 시뮬레이션
  const simulateApiError = useCallback(() => {
    reportApiError(
      "https://api.example.com/demo-error",
      "GET",
      500,
      "Internal Server Error",
      1500,
      "Server error occurred",
      undefined,
    );
    debugLog("API error simulated");
  }, [reportApiError, debugLog]);

  // JavaScript 에러 시뮬레이션
  const simulateJSError = useCallback(() => {
    try {
      // 의도적으로 에러 발생
      throw new Error(
        "Demo JavaScript error - this is intentional for testing",
      );
    } catch (error) {
      console.error("Simulated error:", error);
      debugLog("JavaScript error simulated", {
        error: (error as Error).message,
      });
    }
  }, [debugLog]);

  // 성능 집약적 작업 시뮬레이션
  const simulateHeavyTask = useCallback(() => {
    const startTime = performance.now();

    // CPU 집약적 작업 시뮬레이션
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += Math.random();
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    trackCustomMetric("heavy_task_duration", duration, {
      iterations: 1000000,
      result: result.toFixed(2),
    });

    debugLog("Heavy task completed", { duration, result });
  }, [trackCustomMetric, debugLog]);

  // 메모리 사용량 확인
  const checkMemoryUsage = useCallback(() => {
    const memory = (
      performance as unknown as {
        memory?: {
          usedJSHeapSize: number;
          totalJSHeapSize: number;
          jsHeapSizeLimit: number;
        };
      }
    ).memory;
    if (memory) {
      trackCustomMetric("manual_memory_check", memory.usedJSHeapSize, {
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usagePercentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
      });
      debugLog("Memory usage checked", memory);
    } else {
      debugLog("Memory API not available");
    }
  }, [trackCustomMetric, debugLog]);

  // 즉시 데이터 전송
  const handleFlushNow = useCallback(async () => {
    setIsLoading(true);
    try {
      await flushNow();
      debugLog("Data flushed successfully");
      updateStats();
    } catch (error) {
      debugLog("Flush failed", error);
    } finally {
      setIsLoading(false);
    }
  }, [flushNow, debugLog, updateStats]);

  if (!isEnabled) {
    return (
      <Card className="w-full max-w-4xl mx-auto m-4">
        <CardHeader>
          <CardTitle className="text-amber-600">
            모니터링 시스템 비활성화
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>모니터링 시스템이 비활성화되어 있습니다.</p>
          <p>환경변수를 확인하거나 개발 모드에서 실행해 주세요.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
      {/* 상태 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${isInitialized ? "bg-green-500" : "bg-red-500"}`}
            />
            모니터링 시스템 상태
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">활성화:</span>
              <span className={isEnabled ? "text-green-600" : "text-red-600"}>
                {isEnabled ? "예" : "아니오"}
              </span>
            </div>
            <div>
              <span className="font-medium">초기화:</span>
              <span
                className={isInitialized ? "text-green-600" : "text-amber-600"}
              >
                {isInitialized ? "완료" : "진행중"}
              </span>
            </div>
            <div>
              <span className="font-medium">환경:</span>
              <span className="text-blue-600">{import.meta.env.MODE}</span>
            </div>
            <div>
              <span className="font-medium">디버그:</span>
              <span
                className={
                  import.meta.env.VITE_DEBUG === "true"
                    ? "text-green-600"
                    : "text-gray-600"
                }
              >
                {import.meta.env.VITE_DEBUG === "true" ? "활성화" : "비활성화"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 테스트 버튼들 */}
      <Card>
        <CardHeader>
          <CardTitle>모니터링 기능 테스트</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <Button onClick={simulateClick} variant="outline">
              클릭 이벤트
            </Button>
            <Button onClick={sendCustomMetric} variant="outline">
              커스텀 메트릭
            </Button>
            <Button onClick={sendCustomEvent} variant="outline">
              커스텀 이벤트
            </Button>
            <Button onClick={simulateApiError} variant="outline">
              API 에러
            </Button>
            <Button onClick={simulateJSError} variant="outline">
              JS 에러
            </Button>
            <Button onClick={simulateHeavyTask} variant="outline">
              무거운 작업
            </Button>
            <Button onClick={checkMemoryUsage} variant="outline">
              메모리 확인
            </Button>
            <Button
              onClick={handleFlushNow}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? "전송중..." : "즉시 전송"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 통계 정보 */}
      {stats && (
        <div className="grid md:grid-cols-3 gap-4">
          {/* 성능 통계 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">성능 메트릭</CardTitle>
            </CardHeader>
            <CardContent style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              fontSize: '0.875rem',
              lineHeight: '1.25rem'
            }}>
              <div className="flex justify-between">
                <span>Web Vitals:</span>
                <span className="font-medium">
                  {Object.keys(stats.performance.webVitals).length}개
                </span>
              </div>
              <div className="flex justify-between">
                <span>상호작용:</span>
                <span className="font-medium">
                  {stats.performance.interactionCount}회
                </span>
              </div>
              <div className="flex justify-between">
                <span>네트워크 요청:</span>
                <span className="font-medium">
                  {stats.performance.networkRequestCount}개
                </span>
              </div>
              {stats.performance.memoryUsage && (
                <div className="pt-2 border-t">
                  <div className="flex justify-between">
                    <span>메모리 사용:</span>
                    <span className="font-medium">
                      {(
                        stats.performance.memoryUsage.used /
                        1024 /
                        1024
                      ).toFixed(1)}
                      MB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>총 메모리:</span>
                    <span className="font-medium">
                      {(
                        stats.performance.memoryUsage.total /
                        1024 /
                        1024
                      ).toFixed(1)}
                      MB
                    </span>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <div className="text-xs text-gray-600">Web Vitals 상세:</div>
                {Object.entries(stats.performance.webVitals).map(
                  ([key, value]) => (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-gray-600">{key}:</span>
                      <span className="font-medium">{value?.toFixed(2)}ms</span>
                    </div>
                  ),
                )}
              </div>
            </CardContent>
          </Card>

          {/* 에러 통계 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">에러 리포팅</CardTitle>
            </CardHeader>
            <CardContent style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              fontSize: '0.875rem',
              lineHeight: '1.25rem'
            }}>
              <div className="flex justify-between">
                <span>세션 ID:</span>
                <span className="font-mono text-xs">
                  {stats.errors.sessionId.substring(0, 12)}...
                </span>
              </div>
              <div className="flex justify-between">
                <span>에러 수:</span>
                <span
                  className={`font-medium ${stats.errors.errorCount > 0 ? "text-red-600" : "text-green-600"}`}
                >
                  {stats.errors.errorCount}개
                </span>
              </div>
              <div className="flex justify-between">
                <span>세션 시간:</span>
                <span className="font-medium">
                  {Math.floor(stats.errors.sessionDuration / 1000 / 60)}분
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Analytics 통계 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Analytics</CardTitle>
            </CardHeader>
            <CardContent style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              fontSize: '0.875rem',
              lineHeight: '1.25rem'
            }}>
              <div className="flex justify-between">
                <span>세션 ID:</span>
                <span className="font-mono text-xs">
                  {stats.analytics.sessionId.substring(0, 12)}...
                </span>
              </div>
              <div className="flex justify-between">
                <span>큐 크기:</span>
                <span
                  className={`font-medium ${stats.analytics.queueSize > 10 ? "text-amber-600" : "text-green-600"}`}
                >
                  {stats.analytics.queueSize}개
                </span>
              </div>
              <div className="flex justify-between">
                <span>실패한 배치:</span>
                <span
                  className={`font-medium ${stats.analytics.failedBatchesCount > 0 ? "text-red-600" : "text-green-600"}`}
                >
                  {stats.analytics.failedBatchesCount}개
                </span>
              </div>
              <div className="flex justify-between">
                <span>마지막 전송:</span>
                <span className="font-medium text-xs">
                  {stats.analytics.lastFlushTime > 0
                    ? new Date(
                        stats.analytics.lastFlushTime,
                      ).toLocaleTimeString()
                    : "없음"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 개발자 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">개발자 정보</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p className="text-gray-600">
            이 데모는 개발 환경에서만 표시됩니다. 프로덕션에서는 모니터링이
            백그라운드에서 자동으로 실행됩니다.
          </p>
          <div className="bg-gray-50 p-3 rounded text-xs space-y-1">
            <div>
              <strong>환경변수:</strong>
            </div>
            <div>
              VITE_ENABLE_MONITORING:{" "}
              {import.meta.env.VITE_ENABLE_MONITORING || "undefined"}
            </div>
            <div>
              VITE_ENABLE_ERROR_REPORTING:{" "}
              {import.meta.env.VITE_ENABLE_ERROR_REPORTING || "undefined"}
            </div>
            <div>
              VITE_ENABLE_ANALYTICS:{" "}
              {import.meta.env.VITE_ENABLE_ANALYTICS || "undefined"}
            </div>
            <div>VITE_DEBUG: {import.meta.env.VITE_DEBUG || "undefined"}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default MonitoringDemo;
