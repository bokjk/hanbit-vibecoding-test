/**
 * 마이그레이션 진행 다이얼로그 컴포넌트
 *
 * 데이터 마이그레이션 진행 상황을 시각적으로 표시하고 사용자와 상호작용
 */

import { useEffect, useState, useCallback } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Alert,
  AlertDescription,
} from "@vive/ui";
// import { Progress } from '@/components/ui/progress';
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Database,
  Cloud,
  ArrowRight,
} from "lucide-react";
import { useMigration, useMigrationProgress } from "../../hooks/use-migration";
import type { MigrationResult } from "../../services/data-migration.service";

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
  // const [_result, setResult] = useState<MigrationResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  /**
   * 마이그레이션 시작
   */
  const handleStartMigration = useCallback(async () => {
    try {
      await migration.startMigration();
      // setResult(migrationResult);
    } catch (error) {
      console.error("Migration failed:", error);
    }
  }, [migration]);

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
      if (report.state.stage === "complete") {
        onComplete?.({
          success: true,
          message: "마이그레이션이 성공적으로 완료되었습니다.",
          migratedCount: migration.migration.migratedItems,
          skippedCount: 0,
          errorCount: 0,
          duration: 0,
        });
      }
    } else if (migration.migration.error) {
      onError?.(migration.migration.error);
    }
  }, [
    migration.migration.isComplete,
    migration.migration.error,
    migration,
    onComplete,
    onError,
  ]);

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
      return <AlertCircle style={{ width: '1.5rem', height: '1.5rem', color: '#ef4444' }} />;
    }

    if (migration.migration.isComplete) {
      return <CheckCircle style={{ width: '1.5rem', height: '1.5rem', color: '#22c55e' }} />;
    }

    if (migration.migration.isInProgress) {
      return <Loader2 style={{ width: '1.5rem', height: '1.5rem', color: '#3b82f6', animation: 'spin 1s linear infinite' }} />;
    }

    return <Database style={{ width: '1.5rem', height: '1.5rem', color: '#9ca3af' }} />;
  };

  /**
   * 단계 설명 렌더링
   */
  const renderStageDescription = () => {
    const { stage } = migration.migration;

    switch (stage) {
      case "checking":
        return "마이그레이션 필요성을 확인하고 있습니다...";
      case "preparing":
        return "마이그레이션을 준비하고 있습니다...";
      case "authenticating":
        return "게스트 계정을 생성하고 있습니다...";
      case "migrating":
        return `할 일 데이터를 클라우드로 이동하고 있습니다... (${migration.migration.migratedItems}/${migration.migration.totalItems})`;
      case "syncing":
        return "서버와 데이터를 동기화하고 있습니다...";
      case "cleanup":
        return "마이그레이션을 완료하고 있습니다...";
      case "complete":
        return "마이그레이션이 완료되었습니다!";
      case "error":
        return "마이그레이션 중 오류가 발생했습니다.";
      default:
        return "준비 중...";
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
      <DialogContent style={{ maxWidth: '28rem' }}>
        <DialogHeader>
          <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {renderStageIcon()}
            <span>데이터 마이그레이션</span>
          </DialogTitle>
          <DialogDescription>
            로컬 데이터를 클라우드 계정으로 이동합니다
          </DialogDescription>
        </DialogHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* 마이그레이션 플로우 시각화 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', paddingBottom: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <Database
                style={{
                  width: '2rem',
                  height: '2rem',
                  color: migration.migration.stage === "checking" || migration.migration.stage === "preparing" ? '#3b82f6' : '#d1d5db'
                }}
              />
              <span style={{ fontSize: '0.75rem', lineHeight: '1rem', color: '#6b7280' }}>로컬 데이터</span>
            </div>
            <ArrowRight
              style={{
                width: '1.5rem',
                height: '1.5rem',
                color: migration.migration.isInProgress ? '#3b82f6' : '#d1d5db',
                animation: migration.migration.isInProgress ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <Cloud
                style={{
                  width: '2rem',
                  height: '2rem',
                  color: migration.migration.isComplete ? '#22c55e' : migration.migration.isInProgress ? '#3b82f6' : '#d1d5db'
                }}
              />
              <span style={{ fontSize: '0.75rem', lineHeight: '1rem', color: '#6b7280' }}>클라우드</span>
            </div>
          </div>

          {/* 진행률 표시 */}
          {migration.migration.totalItems > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', lineHeight: '1.25rem' }}>
                <span>진행률</span>
                <span>{Math.round(progress.progress * 100)}%</span>
              </div>
              <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '0.5rem' }}>
                <div
                  style={{
                    backgroundColor: '#3b82f6',
                    height: '0.5rem',
                    borderRadius: '9999px',
                    transition: 'all 300ms ease',
                    width: `${progress.progress * 100}%`
                  }}
                />
              </div>
              {progress.eta && (
                <p style={{ fontSize: '0.75rem', lineHeight: '1rem', color: '#6b7280', textAlign: 'center' }}>
                  예상 완료 시간: {formatETA(progress.eta)}
                </p>
              )}
            </div>
          )}

          {/* 상태 메시지 */}
          <div style={{ textAlign: 'center', paddingTop: '1rem', paddingBottom: '1rem' }}>
            <p style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: '#4b5563' }}>{renderStageDescription()}</p>
          </div>

          {/* 오류 메시지 */}
          {migration.migration.error && (
            <Alert variant="destructive">
              <AlertCircle style={{ height: '1rem', width: '1rem' }} />
              <AlertDescription>{migration.migration.error}</AlertDescription>
            </Alert>
          )}

          {/* 완료 메시지 */}
          {migration.migration.isComplete && !migration.migration.error && (
            <Alert>
              <CheckCircle style={{ height: '1rem', width: '1rem' }} />
              <AlertDescription>
                {migration.migration.migratedItems}개의 할 일이 성공적으로
                마이그레이션되었습니다.
              </AlertDescription>
            </Alert>
          )}

          {/* 세부 정보 토글 */}
          {migration.migration.totalItems > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                style={{ width: '100%' }}
              >
                {showDetails ? "세부 정보 숨기기" : "세부 정보 보기"}
              </Button>

              {showDetails && (
                <div style={{
                  fontSize: '0.75rem',
                  lineHeight: '1rem',
                  color: '#6b7280',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  padding: '0.75rem',
                  backgroundColor: '#f9fafb',
                  borderRadius: '0.375rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>총 항목:</span>
                    <span>{migration.migration.totalItems}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>완료된 항목:</span>
                    <span>{migration.migration.migratedItems}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>현재 단계:</span>
                    <span>{migration.migration.stage}</span>
                  </div>
                  {migration.history.timestamp && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>시작 시간:</span>
                      <span>
                        {new Date(
                          migration.history.timestamp,
                        ).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 액션 버튼 */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
          {!migration.migration.isInProgress &&
            !migration.migration.isComplete && (
              <>
                <Button
                  onClick={handleStartMigration}
                  disabled={!migration.canStart}
                  style={{ flex: 1 }}
                >
                  마이그레이션 시작
                </Button>
                <Button variant="outline" onClick={onClose} style={{ flex: 1 }}>
                  나중에 하기
                </Button>
              </>
            )}

          {migration.migration.isInProgress && (
            <>
              <Button
                variant="destructive"
                onClick={handleCancelMigration}
                style={{ flex: 1 }}
              >
                취소
              </Button>
            </>
          )}

          {(migration.migration.isComplete || migration.migration.error) && (
            <Button onClick={onClose} style={{ width: '100%' }}>
              {migration.migration.error ? "닫기" : "완료"}
            </Button>
          )}
        </div>

        {/* 도움말 링크 */}
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button
            style={{
              fontSize: '0.75rem',
              lineHeight: '1rem',
              color: '#3b82f6',
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              textDecoration: 'none'
            }}
            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
            onClick={() => window.open("/help/migration", "_blank")}
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

export function MigrationStatus({ className = "" }: MigrationStatusProps) {
  const { migration, isRequired, progress } = useMigration();

  if (!isRequired) return null;

  const getStatusColor = () => {
    if (migration.error) return "#ef4444";
    if (migration.isComplete) return "#22c55e";
    if (migration.isInProgress) return "#3b82f6";
    return "#6b7280";
  };

  const getStatusIcon = () => {
    if (migration.error) return <AlertCircle style={{ width: '1rem', height: '1rem' }} />;
    if (migration.isComplete) return <CheckCircle style={{ width: '1rem', height: '1rem' }} />;
    if (migration.isInProgress)
      return <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 1s linear infinite' }} />;
    return <Database style={{ width: '1rem', height: '1rem' }} />;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      color: getStatusColor()
    }}>
      {getStatusIcon()}
      <span style={{ fontSize: '0.875rem', lineHeight: '1.25rem' }}>
        {migration.isInProgress
          ? `마이그레이션 중... ${Math.round(progress * 100)}%`
          : migration.isComplete
            ? "마이그레이션 완료"
            : migration.error
              ? "마이그레이션 오류"
              : "마이그레이션 필요"}
      </span>
    </div>
  );
}