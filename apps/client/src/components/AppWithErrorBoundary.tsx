/**
 * Error Boundary가 적용된 App 컴포넌트 통합 예시
 * 이 파일은 기존 App.tsx에 Error Boundary를 적용하는 방법을 보여줍니다.
 */
import { useState, useEffect } from "react";
import { TodoContainer } from "./todo-container";
import { AuthProvider } from "../contexts/auth.context";
import { MigrationDialog } from "./auth/migration-dialog";
import { AuthPromptBanner } from "./auth/auth-prompt";
import { useMigration } from "../hooks/use-migration";
import { Loader2 } from "lucide-react";
import { ErrorBoundary } from "./ErrorBoundary";
import { initializeGlobalErrorHandler } from "../utils/global-error-handler";
import "../App.css";

/**
 * 앱 초기화 상태 관리 컴포넌트
 */
function AppContent() {
  const migration = useMigration();
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [showAuthBanner, setShowAuthBanner] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // 앱 초기화 완료 처리
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 마이그레이션 필요성 확인
        const migrationRequired = await migration.checkMigrationRequired();

        if (migrationRequired) {
          setShowMigrationDialog(true);
        } else if (!migration.history.completed) {
          // 마이그레이션 히스토리가 없고 필요하지 않다면 배너 표시
          setShowAuthBanner(true);
        }
      } catch (error) {
        console.error("App initialization failed:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    // 인증 상태가 초기화된 후 앱 초기화 실행
    if (!migration.migration.isInProgress) {
      initializeApp();
    }
  }, [migration.migration.isInProgress, migration]);

  // 마이그레이션 완료 처리
  const handleMigrationComplete = (result: unknown) => {
    console.log("Migration completed:", result);
    setShowMigrationDialog(false);

    // 성공 시 배너 숨김, 실패 시 배너 표시
    if (result.success) {
      setShowAuthBanner(false);
    } else {
      setShowAuthBanner(true);
    }
  };

  // 마이그레이션 오류 처리
  const handleMigrationError = (error: string) => {
    console.error("Migration error:", error);
    // 오류 발생 시에도 다이얼로그는 닫고 배너 표시
    setShowMigrationDialog(false);
    setShowAuthBanner(true);
  };

  // 배너 닫기 처리
  const handleBannerDismiss = () => {
    setShowAuthBanner(false);
    localStorage.setItem("auth-banner-dismissed", "true");
  };

  // 앱 초기화 중 로딩 표시
  if (isInitializing) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-sm text-gray-600">앱을 초기화하고 있습니다...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 인증 유도 배너 */}
      {showAuthBanner && (
        <ErrorBoundary>
          <div className="sticky top-0 z-10 p-4">
            <AuthPromptBanner
              onPromptOpen={() => {
                // TODO: AuthPrompt 다이얼로그 열기 (향후 구현)
                console.log("Auth prompt requested");
              }}
              onDismiss={handleBannerDismiss}
            />
          </div>
        </ErrorBoundary>
      )}

      {/* 메인 컨텐츠 */}
      <ErrorBoundary
        enableReporting={true}
        reportEndpoint="/api/errors" // 실제 에러 리포팅 엔드포인트
        onError={(error) => {
          // 커스텀 에러 핸들링 로직
          console.warn("Main content error caught:", error.message);

          // 사용자 분석 도구에 에러 전송 (예: Google Analytics, Sentry 등)
          // analytics.track('Error', {
          //   message: error.message,
          //   component: 'MainContent'
          // });
        }}
      >
        <div className={showAuthBanner ? "pt-4" : ""}>
          <TodoContainer />
        </div>
      </ErrorBoundary>

      {/* 마이그레이션 다이얼로그 */}
      <ErrorBoundary>
        <MigrationDialog
          isOpen={showMigrationDialog}
          onClose={() => setShowMigrationDialog(false)}
          autoStart={true}
          onComplete={handleMigrationComplete}
          onError={handleMigrationError}
        />
      </ErrorBoundary>
    </main>
  );
}

/**
 * 메인 App 컴포넌트 with Error Boundaries
 * 각 주요 영역을 Error Boundary로 감싸서 격리합니다.
 */
function AppWithErrorBoundary() {
  // 전역 에러 핸들러 초기화
  useEffect(() => {
    const globalHandler = initializeGlobalErrorHandler({
      enableConsoleLogging: true,
      enableReporting: process.env.NODE_ENV === "production",
      reportEndpoint: "/api/errors/global",
      onError: (error) => {
        // 전역 에러에 대한 커스텀 처리
        console.warn("Global error:", error.message);

        // 중요한 에러인 경우 사용자에게 알림
        if (
          error.message.includes("ChunkLoadError") ||
          error.message.includes("Loading CSS chunk")
        ) {
          // 코드 스플리팅 관련 에러는 페이지 새로고침 권장
          const shouldReload = confirm(
            "애플리케이션 업데이트가 있습니다. 페이지를 새로고침하시겠습니까?",
          );
          if (shouldReload) {
            window.location.reload();
          }
        }
      },
    });

    // 컴포넌트 언마운트 시 정리
    return () => {
      globalHandler.cleanup();
    };
  }, []);

  return (
    // 최상위 Error Boundary - 전체 앱 레벨
    <ErrorBoundary
      enableReporting={true}
      reportEndpoint="/api/errors/app"
      onError={(error) => {
        console.error("Top-level app error:", error.message);

        // 심각한 에러의 경우 사용자에게 안내
        if (
          error.message.includes("Cannot read properties of undefined") ||
          error.message.includes("TypeError")
        ) {
          console.warn("Critical application error detected");
        }
      }}
      fallback={(error, errorInfo, onRetry) => (
        // 앱 전체 레벨 에러 시 표시할 최소한의 UI
        <div className="min-h-screen flex items-center justify-center p-4 bg-red-50">
          <div className="max-w-md text-center space-y-4">
            <div className="text-red-600 text-6xl mb-4">😵</div>
            <h1 className="text-xl font-semibold text-red-800">
              애플리케이션 오류
            </h1>
            <p className="text-red-600">
              예상치 못한 오류로 인해 애플리케이션을 실행할 수 없습니다.
            </p>
            <div className="space-y-2">
              <button
                onClick={onRetry}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                다시 시도
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 transition-colors"
              >
                페이지 새로고침
              </button>
            </div>
            <div className="text-xs text-red-500">
              문제가 지속되면 브라우저 캐시를 삭제해 보세요.
            </div>
          </div>
        </div>
      )}
    >
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;
