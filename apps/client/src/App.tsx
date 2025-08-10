import { useState, useEffect } from 'react';
import { TodoContainer } from './components/todo-container';
import { AuthProvider } from './contexts/auth.context';
import { MigrationDialog } from './components/auth/migration-dialog';
import { AuthPromptBanner } from './components/auth/auth-prompt';
import { useMigration } from './hooks/use-migration';
import { Loader2 } from 'lucide-react';
import './App.css';

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
        console.error('App initialization failed:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    // 인증 상태가 초기화된 후 앱 초기화 실행
    if (!migration.migration.isInProgress) {
      initializeApp();
    }
  }, [migration.migration.isInProgress]);

  // 마이그레이션 완료 처리
  const handleMigrationComplete = (result: any) => {
    console.log('Migration completed:', result);
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
    console.error('Migration error:', error);
    // 오류 발생 시에도 다이얼로그는 닫고 배너 표시
    setShowMigrationDialog(false);
    setShowAuthBanner(true);
  };

  // 배너 닫기 처리
  const handleBannerDismiss = () => {
    setShowAuthBanner(false);
    localStorage.setItem('auth-banner-dismissed', 'true');
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
        <div className="sticky top-0 z-10 p-4">
          <AuthPromptBanner
            onPromptOpen={() => {
              // TODO: AuthPrompt 다이얼로그 열기 (향후 구현)
              console.log('Auth prompt requested');
            }}
            onDismiss={handleBannerDismiss}
          />
        </div>
      )}

      {/* 메인 컨텐츠 */}
      <div className={showAuthBanner ? 'pt-4' : ''}>
        <TodoContainer />
      </div>

      {/* 마이그레이션 다이얼로그 */}
      <MigrationDialog
        isOpen={showMigrationDialog}
        onClose={() => setShowMigrationDialog(false)}
        autoStart={true}
        onComplete={handleMigrationComplete}
        onError={handleMigrationError}
      />
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
