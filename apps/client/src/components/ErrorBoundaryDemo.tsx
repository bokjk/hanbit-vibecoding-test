/**
 * Error Boundary 데모 및 테스트 컴포넌트
 * 개발 환경에서 Error Boundary의 동작을 테스트할 수 있습니다.
 */
import React, { useState, useEffect } from "react";
import { Button } from "@vive/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@vive/ui";
import {
  ErrorBoundary,
  withErrorBoundary,
  throwError,
  handleAsyncError,
} from "./ErrorBoundary";

/**
 * 의도적으로 에러를 발생시키는 테스트 컴포넌트
 */
function ErrorThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throwError("테스트용 컴포넌트 에러입니다!");
  }

  return (
    <div className="p-4 bg-green-100 rounded-md">
      ✅ 컴포넌트가 정상적으로 렌더링되었습니다.
    </div>
  );
}

/**
 * 비동기 에러를 발생시키는 테스트 컴포넌트
 */
function AsyncErrorComponent() {
  const [isLoading, setIsLoading] = useState(false);

  const handleAsyncOperation = async () => {
    setIsLoading(true);
    try {
      // 의도적으로 실패하는 비동기 작업 시뮬레이션
      await new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("비동기 작업 중 에러가 발생했습니다!"));
        }, 1000);
      });
    } catch (error) {
      handleAsyncError(error as Error, "AsyncErrorComponent");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleAsyncOperation}
        disabled={isLoading}
        variant="outline"
      >
        {isLoading ? "로딩 중..." : "비동기 에러 발생시키기"}
      </Button>
      {isLoading && (
        <div className="text-sm text-gray-600">
          비동기 작업 실행 중... (1초 후 에러 발생)
        </div>
      )}
    </div>
  );
}

/**
 * useEffect에서 에러를 발생시키는 컴포넌트
 */
function EffectErrorComponent({ shouldThrow }: { shouldThrow: boolean }) {
  useEffect(() => {
    if (shouldThrow) {
      // useEffect 내부의 에러는 Error Boundary로 잡히지 않음
      setTimeout(() => {
        throw new Error("useEffect에서 발생한 에러입니다!");
      }, 100);
    }
  }, [shouldThrow]);

  return (
    <div className="p-4 bg-blue-100 rounded-md">
      useEffect 테스트 컴포넌트 (에러는 전역 핸들러가 처리)
    </div>
  );
}

/**
 * HOC로 감싸진 컴포넌트 테스트
 */
const WrappedComponent = withErrorBoundary(
  function TestComponent({ shouldThrow }: { shouldThrow: boolean }) {
    if (shouldThrow) {
      throwError("HOC로 감싸진 컴포넌트에서 에러 발생!");
    }
    return (
      <div className="p-4 bg-purple-100 rounded-md">
        ✅ HOC로 감싸진 컴포넌트가 정상 렌더링됨
      </div>
    );
  },
  {
    onError: (error) => {
      console.log("HOC 에러 핸들러:", error.message);
    },
  },
);

/**
 * 커스텀 Error UI 예시
 */
function CustomErrorUI(error: Error, _errorInfo: unknown, onRetry: () => void) {
  return (
    <div className="p-6 border-2 border-red-300 rounded-lg bg-red-50">
      <h3 className="text-lg font-semibold text-red-800 mb-2">
        커스텀 에러 UI
      </h3>
      <p className="text-red-600 mb-4">{error.message}</p>
      <Button onClick={onRetry} variant="outline" size="sm">
        다시 시도
      </Button>
    </div>
  );
}

/**
 * 메인 데모 컴포넌트
 */
export function ErrorBoundaryDemo() {
  const [testStates, setTestStates] = useState({
    renderError: false,
    asyncError: false,
    effectError: false,
    hocError: false,
  });

  const toggleState = (key: keyof typeof testStates) => {
    setTestStates((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const resetAll = () => {
    setTestStates({
      renderError: false,
      asyncError: false,
      effectError: false,
      hocError: false,
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Error Boundary 데모</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-gray-600">
            이 페이지는 Error Boundary의 다양한 기능을 테스트할 수 있습니다.
            개발 환경에서만 사용하세요.
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={resetAll} variant="outline">
              전체 리셋
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline">
              페이지 새로고침
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 기본 Error Boundary 테스트 */}
      <Card>
        <CardHeader>
          <CardTitle>1. 기본 렌더링 에러 (Error Boundary로 포착)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => toggleState("renderError")}
            variant={testStates.renderError ? "destructive" : "default"}
          >
            {testStates.renderError ? "에러 해제" : "렌더링 에러 발생"}
          </Button>

          <ErrorBoundary>
            <ErrorThrowingComponent shouldThrow={testStates.renderError} />
          </ErrorBoundary>
        </CardContent>
      </Card>

      {/* 커스텀 Error UI 테스트 */}
      <Card>
        <CardHeader>
          <CardTitle>2. 커스텀 Error UI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => toggleState("asyncError")}
            variant={testStates.asyncError ? "destructive" : "default"}
          >
            {testStates.asyncError ? "에러 해제" : "커스텀 UI 에러 발생"}
          </Button>

          <ErrorBoundary fallback={CustomErrorUI}>
            <ErrorThrowingComponent shouldThrow={testStates.asyncError} />
          </ErrorBoundary>
        </CardContent>
      </Card>

      {/* 비동기 에러 테스트 */}
      <Card>
        <CardHeader>
          <CardTitle>3. 비동기 에러 (전역 핸들러가 처리)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-yellow-600">
            ⚠️ 비동기 에러는 Error Boundary로 잡히지 않고 전역 에러 핸들러가
            처리합니다.
          </div>
          <AsyncErrorComponent />
        </CardContent>
      </Card>

      {/* useEffect 에러 테스트 */}
      <Card>
        <CardHeader>
          <CardTitle>4. useEffect 에러 (전역 핸들러가 처리)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => toggleState("effectError")}
            variant={testStates.effectError ? "destructive" : "default"}
          >
            {testStates.effectError ? "에러 해제" : "useEffect 에러 발생"}
          </Button>

          <div className="text-sm text-yellow-600">
            ⚠️ useEffect 내부의 에러는 Error Boundary로 잡히지 않습니다.
          </div>

          <ErrorBoundary>
            <EffectErrorComponent shouldThrow={testStates.effectError} />
          </ErrorBoundary>
        </CardContent>
      </Card>

      {/* HOC 테스트 */}
      <Card>
        <CardHeader>
          <CardTitle>5. HOC로 감싸진 컴포넌트</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => toggleState("hocError")}
            variant={testStates.hocError ? "destructive" : "default"}
          >
            {testStates.hocError ? "에러 해제" : "HOC 컴포넌트 에러 발생"}
          </Button>

          <WrappedComponent shouldThrow={testStates.hocError} />
        </CardContent>
      </Card>

      {/* 에러 로그 정보 */}
      <Card>
        <CardHeader>
          <CardTitle>6. 저장된 에러 로그</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600 mb-2">
            브라우저 개발자 도구의 콘솔과 Local Storage를 확인해보세요.
          </div>
          <Button
            onClick={() => {
              const logs = JSON.parse(
                localStorage.getItem("vive_error_logs") || "[]",
              );
              console.log("저장된 에러 로그:", logs);
              alert(`저장된 에러 로그: ${logs.length}개`);
            }}
            variant="outline"
            size="sm"
          >
            에러 로그 확인
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
