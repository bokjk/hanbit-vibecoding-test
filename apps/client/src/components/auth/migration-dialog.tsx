/**
 * 마이그레이션 진행 다이얼로그 컴포넌트
 * 
 * 데이터 마이그레이션 진행 상황을 시각적으로 표시하고 사용자와 상호작용
 */

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
// import { Progress } from '@/components/ui/progress';
import { AlertCircle, CheckCircle, Loader2, Database, Cloud, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMigration, useMigrationProgress } from '../../hooks/use-migration';
import type { MigrationResult } from '../../services/data-migration.service';

/**
 * MigrationDialog Props
 */
interface MigrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  autoStart?: boolean;
  onComplete?: (result: MigrationResult) => void;
  onError?: (error: string) => void;
}

/**
 * 마이그레이션 진행 다이얼로그
 */
export function MigrationDialog({
  isOpen,
  onClose,
  autoStart = false,
  onComplete,
  onError,
}: MigrationDialogProps) {
  const migration = useMigration();
  const progress = useMigrationProgress();
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // 자동 시작 처리
  useEffect(() => {
    if (isOpen && autoStart && migration.canStart) {
      handleStartMigration();
    }
  }, [isOpen, autoStart, migration.canStart, handleStartMigration]);

  // 마이그레이션 완료/오류 처리
  useEffect(() => {
    if (migration.migration.isComplete && !migration.migration.error) {
      const report = migration.getStatusReport();
      if (report.state.stage === 'complete') {
        onComplete?.({
          success: true,
          message: '마이그레이션이 성공적으로 완료되었습니다.',
          migratedCount: migration.migration.migratedItems,
          skippedCount: 0,
          errorCount: 0,
          duration: 0,
        });
      }
    } else if (migration.migration.error) {
      onError?.(migration.migration.error);
    }
  }, [migration.migration.isComplete, migration.migration.error, migration, onComplete, onError]);

  /**
   * 마이그레이션 시작
   */
  const handleStartMigration = async () => {
    try {
      const migrationResult = await migration.startMigration();
      setResult(migrationResult);
    } catch (error) {
      console.error('Migration failed:', error);
    }
  };

  /**
   * 마이그레이션 취소
   */
  const handleCancelMigration = async () => {
    if (migration.migration.isInProgress) {
      await migration.cancelMigration();
    }
  };

  /**
   * 단계별 아이콘 렌더링
   */
  const renderStageIcon = () => {
    if (migration.migration.error) {
      return <AlertCircle className="w-6 h-6 text-red-500" />;
    }
    
    if (migration.migration.isComplete) {
      return <CheckCircle className="w-6 h-6 text-green-500" />;
    }
    
    if (migration.migration.isInProgress) {
      return <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />;
    }
    
    return <Database className="w-6 h-6 text-gray-400" />;
  };

  /**
   * 단계 설명 렌더링
   */
  const renderStageDescription = () => {
    const { stage } = migration.migration;
    
    switch (stage) {
      case 'checking':
        return '마이그레이션 필요성을 확인하고 있습니다...';
      case 'preparing':
        return '마이그레이션을 준비하고 있습니다...';
      case 'authenticating':
        return '게스트 계정을 생성하고 있습니다...';
      case 'migrating':
        return `할 일 데이터를 클라우드로 이동하고 있습니다... (${migration.migration.migratedItems}/${migration.migration.totalItems})`;
      case 'syncing':
        return '서버와 데이터를 동기화하고 있습니다...';
      case 'cleanup':
        return '마이그레이션을 완료하고 있습니다...';
      case 'complete':
        return '마이그레이션이 완료되었습니다!';
      case 'error':
        return '마이그레이션 중 오류가 발생했습니다.';
      default:
        return '준비 중...';
    }
  };

  /**
   * 진행률 색상 결정
   */
  // getProgressColor 함수 제거 - 사용하지 않음

  /**
   * 예상 시간 포맷팅
   */
  const formatETA = (seconds: number | null) => {
    if (!seconds) return null;
    if (seconds < 60) return `약 ${seconds}초`;
    const minutes = Math.ceil(seconds / 60);
    return `약 ${minutes}분`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {renderStageIcon()}
            <span>데이터 마이그레이션</span>
          </DialogTitle>
          <DialogDescription>
            로컬 데이터를 클라우드 계정으로 이동합니다
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 마이그레이션 플로우 시각화 */}
          <div className="flex items-center justify-between py-4">
            <div className="flex flex-col items-center gap-2">
              <Database className={`w-8 h-8 ${migration.migration.stage === 'checking' || migration.migration.stage === 'preparing' ? 'text-blue-500' : 'text-gray-300'}`} />
              <span className="text-xs text-gray-500">로컬 데이터</span>
            </div>
            <ArrowRight className={`w-6 h-6 ${migration.migration.isInProgress ? 'text-blue-500 animate-pulse' : 'text-gray-300'}`} />
            <div className="flex flex-col items-center gap-2">
              <Cloud className={`w-8 h-8 ${migration.migration.isComplete ? 'text-green-500' : migration.migration.isInProgress ? 'text-blue-500' : 'text-gray-300'}`} />
              <span className="text-xs text-gray-500">클라우드</span>
            </div>
          </div>

          {/* 진행률 표시 */}
          {migration.migration.totalItems > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>진행률</span>
                <span>{Math.round(progress.progress * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${progress.progress * 100}%` }}
                />
              </div>
              {progress.eta && (
                <p className="text-xs text-gray-500 text-center">
                  예상 완료 시간: {formatETA(progress.eta)}
                </p>
              )}
            </div>
          )}

          {/* 상태 메시지 */}
          <div className="text-center py-4">
            <p className="text-sm text-gray-600">
              {renderStageDescription()}
            </p>
          </div>

          {/* 오류 메시지 */}
          {migration.migration.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {migration.migration.error}
              </AlertDescription>
            </Alert>
          )}

          {/* 완료 메시지 */}
          {migration.migration.isComplete && !migration.migration.error && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {migration.migration.migratedItems}개의 할 일이 성공적으로 마이그레이션되었습니다.
              </AlertDescription>
            </Alert>
          )}

          {/* 세부 정보 토글 */}
          {migration.migration.totalItems > 0 && (
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="w-full"
              >
                {showDetails ? '세부 정보 숨기기' : '세부 정보 보기'}
              </Button>
              
              {showDetails && (
                <div className="text-xs text-gray-500 space-y-1 p-3 bg-gray-50 rounded-md">
                  <div className="flex justify-between">
                    <span>총 항목:</span>
                    <span>{migration.migration.totalItems}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>완료된 항목:</span>
                    <span>{migration.migration.migratedItems}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>현재 단계:</span>
                    <span>{migration.migration.stage}</span>
                  </div>
                  {migration.history.timestamp && (
                    <div className="flex justify-between">
                      <span>시작 시간:</span>
                      <span>{new Date(migration.history.timestamp).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-3 mt-6">
          {!migration.migration.isInProgress && !migration.migration.isComplete && (
            <>
              <Button 
                onClick={handleStartMigration}
                disabled={!migration.canStart}
                className="flex-1"
              >
                마이그레이션 시작
              </Button>
              <Button 
                variant="outline" 
                onClick={onClose}
                className="flex-1"
              >
                나중에 하기
              </Button>
            </>
          )}
          
          {migration.migration.isInProgress && (
            <>
              <Button 
                variant="destructive" 
                onClick={handleCancelMigration}
                className="flex-1"
              >
                취소
              </Button>
            </>
          )}
          
          {(migration.migration.isComplete || migration.migration.error) && (
            <Button 
              onClick={onClose}
              className="w-full"
            >
              {migration.migration.error ? '닫기' : '완료'}
            </Button>
          )}
        </div>

        {/* 도움말 링크 */}
        <div className="text-center mt-4">
          <button 
            className="text-xs text-blue-500 hover:underline"
            onClick={() => window.open('/help/migration', '_blank')}
          >
            마이그레이션에 대해 더 알아보기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 간단한 마이그레이션 상태 표시 컴포넌트
 */
interface MigrationStatusProps {
  className?: string;
}

export function MigrationStatus({ className = '' }: MigrationStatusProps) {
  const { migration, isRequired, progress } = useMigration();

  if (!isRequired) return null;

  const getStatusColor = () => {
    if (migration.error) return 'text-red-500';
    if (migration.isComplete) return 'text-green-500';
    if (migration.isInProgress) return 'text-blue-500';
    return 'text-gray-500';
  };

  const getStatusIcon = () => {
    if (migration.error) return <AlertCircle className="w-4 h-4" />;
    if (migration.isComplete) return <CheckCircle className="w-4 h-4" />;
    if (migration.isInProgress) return <Loader2 className="w-4 h-4 animate-spin" />;
    return <Database className="w-4 h-4" />;
  };

  return (
    <div className={`flex items-center gap-2 ${getStatusColor()} ${className}`}>
      {getStatusIcon()}
      <span className="text-sm">
        {migration.isInProgress ? `마이그레이션 중... ${Math.round(progress * 100)}%` : 
         migration.isComplete ? '마이그레이션 완료' :
         migration.error ? '마이그레이션 오류' :
         '마이그레이션 필요'}
      </span>
    </div>
  );
}