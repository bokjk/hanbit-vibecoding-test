import { useState, useEffect, Suspense, lazy } from "react";
import { AuthProvider } from "./contexts/auth.context";
import { useMigration } from "./hooks/use-migration";
import type { MigrationResult } from "./services/data-migration.service";
import { Loader2 } from "lucide-react";
import {
  initializeServiceWorker,
  showUpdateNotification,
  setupOfflineHandling,
} from "./utils/service-worker";
import "./App.css";

// 코드 스플리팅을 위한 lazy import
const TodoContainer = lazy(() =>
  import("./components/todo-container").then((module) => ({
    default: module.TodoContainer,
  })),
);

const MigrationDialog = lazy(() =>
  import("./components/auth/migration-dialog").then((module) => ({
    default: module.MigrationDialog,
  })),
);

const AuthPromptBanner = lazy(() =>
  import("./components/auth/auth-prompt").then((module) => ({
    default: module.AuthPromptBanner,
  })),
);

/**
 * 코드 스플리팅 로딩 fallback 컴포넌트
 */
function LoadingFallback({ message = "로딩 중..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <p className="text-sm text-gray-600">{message}</p>
      </div>
    </div>
  );
}

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
        // Service Worker 및 PWA 기능 초기화
        await initializeServiceWorker();
        showUpdateNotification();
        setupOfflineHandling();

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

  // 타입 가드 함수
  const isMigrationResult = (result: unknown): result is MigrationResult => {
    return (
      typeof result === "object" &&
      result !== null &&
      "success" in result &&
      typeof (result as MigrationResult).success === "boolean"
    );
  };

  // 마이그레이션 완료 처리
  const handleMigrationComplete = (result: unknown) => {
    console.log("Migration completed:", result);
    setShowMigrationDialog(false);

    // 성공 시 배너 숨김, 실패 시 배너 표시
    if (isMigrationResult(result) && result.success) {
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
      {/* 인증 유도 배너 - 독립적으로 로딩 */}
      {showAuthBanner && (
        <Suspense fallback={<LoadingFallback message="배너를 로딩 중..." />}>
          <div className="sticky top-0 z-10 p-4">
            <AuthPromptBanner
              onPromptOpen={() => {
                // TODO: AuthPrompt 다이얼로그 열기 (향후 구현)
                console.log("Auth prompt requested");
              }}
              onDismiss={handleBannerDismiss}
            />
          </div>
        </Suspense>
      )}

      {/* 메인 컨텐츠 - 독립적으로 로딩 */}
      <div className={showAuthBanner ? "pt-4" : ""}>
        <Suspense fallback={<LoadingFallback message="TODO 앱을 로딩 중..." />}>
          <TodoContainer />
        </Suspense>
      </div>

      {/* 마이그레이션 다이얼로그 - 필요시에만 로딩 */}
      {showMigrationDialog && (
        <Suspense
          fallback={
            <LoadingFallback message="마이그레이션 도구를 로딩 중..." />
          }
        >
          <MigrationDialog
            isOpen={showMigrationDialog}
            onClose={() => setShowMigrationDialog(false)}
            autoStart={true}
            onComplete={handleMigrationComplete}
            onError={handleMigrationError}
          />
        </Suspense>
      )}
    </main>
  );
}

/**
 * 메인 App 컴포넌트
 * AuthProvider로 전체 앱을 감싸서 인증 상태 관리
 */
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
