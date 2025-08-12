/**
 * 마이그레이션 상태 관리 훅
 *
 * 데이터 마이그레이션의 상태를 관리하고 UI에 필요한 메서드들을 제공
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  dataMigrationService,
  type MigrationState,
  type MigrationResult,
  type MigrationEvent,
  type MigrationEventListener,
  migrationUtils,
} from "../services/data-migration.service";
import { useAuthContext } from "../contexts/auth.context";
import { localStorageService } from "../services/localStorage.service";

/**
 * 마이그레이션 훅 상태
 */
export interface UseMigrationState {
  // 마이그레이션 상태
  migration: MigrationState;

  // 유틸리티 상태
  isRequired: boolean;
  canStart: boolean;
  progress: number;
  statusMessage: string;

  // 히스토리
  history: {
    completed: boolean;
    timestamp: string | null;
    version: string;
  };
}

/**
 * 마이그레이션 훅 액션
 */
export interface UseMigrationActions {
  // 주요 액션
  startMigration: () => Promise<MigrationResult>;
  cancelMigration: () => Promise<boolean>;
  resetMigration: () => void;
  checkMigrationRequired: () => Promise<boolean>;

  // 유틸리티 액션
  getStatusReport: () => ReturnType<
    typeof dataMigrationService.getStatusReport
  >;
  restoreFromBackup: () => boolean;

  // 옵션 설정
  updateOptions: (
    options: Parameters<typeof dataMigrationService.updateOptions>[0],
  ) => void;
}

/**
 * 마이그레이션 훅 반환 타입
 */
export interface UseMigrationReturn
  extends UseMigrationState,
    UseMigrationActions {}

/**
 * 마이그레이션 상태 관리 훅
 */
export function useMigration(): UseMigrationReturn {
  const { state: authState } = useAuthContext();
  const [migrationState, setMigrationState] = useState<MigrationState>(
    dataMigrationService.getState(),
  );
  // const [_lastResult, setLastResult] = useState<MigrationResult | null>(null);
  const eventListenersRef = useRef<Map<MigrationEvent, MigrationEventListener>>(
    new Map(),
  );

  // ================================
  // 상태 업데이트
  // ================================

  /**
   * 마이그레이션 상태 동기화
   */
  const syncMigrationState = useCallback(() => {
    const currentState = dataMigrationService.getState();
    setMigrationState(currentState);
  }, []);

  /**
   * 이벤트 리스너 설정
   */
  useEffect(() => {
    const listeners = eventListenersRef.current;

    // 이벤트 리스너 정의
    const onStageChange: MigrationEventListener = () => {
      syncMigrationState();
    };

    const onProgress: MigrationEventListener = () => {
      syncMigrationState();
    };

    const onComplete: MigrationEventListener = (_, data) => {
      syncMigrationState();
      if (data && typeof data === "object" && "result" in data) {
        setLastResult(data.result as MigrationResult);
      }
    };

    const onError: MigrationEventListener = (_, data) => {
      syncMigrationState();
      if (data && typeof data === "object" && "result" in data) {
        setLastResult(data.result as MigrationResult);
      }
    };

    // 이벤트 리스너 등록
    listeners.set("stage_change", onStageChange);
    listeners.set("migration_progress", onProgress);
    listeners.set("migration_complete", onComplete);
    listeners.set("migration_error", onError);

    listeners.forEach((listener, event) => {
      dataMigrationService.addEventListener(event, listener);
    });

    // 초기 상태 동기화
    syncMigrationState();

    // 정리
    return () => {
      listeners.forEach((listener, event) => {
        dataMigrationService.removeEventListener(event, listener);
      });
      listeners.clear();
    };
  }, [syncMigrationState]);

  // ================================
  // 계산된 상태값들
  // ================================

  /**
   * 마이그레이션 필요 여부
   */
  const isRequired = migrationState.isRequired;

  /**
   * 마이그레이션 시작 가능 여부
   */
  const canStart =
    isRequired &&
    !migrationState.isInProgress &&
    !migrationState.isComplete &&
    authState.isInitialized;

  /**
   * 진행률 계산
   */
  const progress =
    migrationState.totalItems > 0
      ? migrationState.migratedItems / migrationState.totalItems
      : 0;

  /**
   * 상태 메시지 생성
   */
  const statusMessage = useMemo(() => {
    if (migrationState.error) {
      return `오류: ${migrationState.error}`;
    }

    switch (migrationState.stage) {
      case "checking":
        return "마이그레이션 필요성을 확인하고 있습니다...";
      case "preparing":
        return "마이그레이션을 준비하고 있습니다...";
      case "authenticating":
        return "인증을 처리하고 있습니다...";
      case "migrating":
        return `데이터를 마이그레이션하고 있습니다... (${migrationState.migratedItems}/${migrationState.totalItems})`;
      case "syncing":
        return "서버와 동기화하고 있습니다...";
      case "cleanup":
        return "마이그레이션을 완료하고 있습니다...";
      case "complete":
        return "마이그레이션이 완료되었습니다.";
      case "error":
        return "마이그레이션 중 오류가 발생했습니다.";
      default:
        return "준비 중...";
    }
  }, [
    migrationState.stage,
    migrationState.error,
    migrationState.migratedItems,
    migrationState.totalItems,
  ]);

  /**
   * 마이그레이션 히스토리
   */
  const history = useMemo(() => {
    return migrationUtils.getMigrationHistory();
  }, []);

  // ================================
  // 액션 메서드들
  // ================================

  /**
   * 마이그레이션 시작
   */
  const startMigration = useCallback(async (): Promise<MigrationResult> => {
    if (!canStart) {
      throw new Error("Cannot start migration: conditions not met");
    }

    try {
      const result = await dataMigrationService.performMigration();
      setLastResult(result);
      return result;
    } catch (error) {
      const errorResult: MigrationResult = {
        success: false,
        message: error instanceof Error ? error.message : "Migration failed",
        migratedCount: migrationState.migratedItems,
        skippedCount: 0,
        errorCount: migrationState.totalItems - migrationState.migratedItems,
        duration: 0,
      };
      setLastResult(errorResult);
      throw error;
    }
  }, [canStart, migrationState.migratedItems, migrationState.totalItems]);

  /**
   * 마이그레이션 취소
   */
  const cancelMigration = useCallback(async (): Promise<boolean> => {
    return await dataMigrationService.cancelMigration();
  }, []);

  /**
   * 마이그레이션 재설정
   */
  const resetMigration = useCallback(() => {
    dataMigrationService.resetMigration();
    setLastResult(null);
    syncMigrationState();
  }, [syncMigrationState]);

  /**
   * 마이그레이션 필요성 확인
   */
  const checkMigrationRequired = useCallback(async (): Promise<boolean> => {
    const required =
      await dataMigrationService.checkMigrationRequired(authState);
    syncMigrationState();
    return required;
  }, [authState, syncMigrationState]);

  /**
   * 상태 리포트 조회
   */
  const getStatusReport = useCallback(() => {
    return dataMigrationService.getStatusReport();
  }, []);

  /**
   * 백업 데이터 복원
   */
  const restoreFromBackup = useCallback(() => {
    const restored = migrationUtils.restoreFromBackup();
    if (restored) {
      syncMigrationState();
    }
    return restored;
  }, [syncMigrationState]);

  /**
   * 마이그레이션 옵션 업데이트
   */
  const updateOptions = useCallback(
    (options: Parameters<typeof dataMigrationService.updateOptions>[0]) => {
      dataMigrationService.updateOptions(options);
    },
    [],
  );

  // ================================
  // 자동 마이그레이션 확인
  // ================================

  /**
   * 인증 상태 변경 시 마이그레이션 필요성 자동 확인
   */
  useEffect(() => {
    let isMounted = true;

    const checkMigration = async () => {
      if (
        authState.isInitialized &&
        !migrationState.isInProgress &&
        !migrationState.isComplete
      ) {
        try {
          await checkMigrationRequired();
        } catch (error) {
          console.error("Auto migration check failed:", error);
        }
      }
    };

    if (isMounted) {
      checkMigration();
    }

    return () => {
      isMounted = false;
    };
  }, [
    authState.isInitialized,
    authState.isAuthenticated,
    authState.isGuest,
    checkMigrationRequired,
    migrationState.isComplete,
    migrationState.isInProgress,
  ]);

  // ================================
  // 반환값 구성
  // ================================

  return {
    // 상태
    migration: migrationState,
    isRequired,
    canStart,
    progress,
    statusMessage,
    history,

    // 액션
    startMigration,
    cancelMigration,
    resetMigration,
    checkMigrationRequired,
    getStatusReport,
    restoreFromBackup,
    updateOptions,
  };
}

/**
 * 마이그레이션 필요성 빠른 확인 훅
 */
export function useQuickMigrationCheck(): {
  isRequired: boolean;
  hasLocalData: boolean;
  isCompleted: boolean;
} {
  const [state, setState] = useState({
    isRequired: false,
    hasLocalData: false,
    isCompleted: false,
  });

  useEffect(() => {
    const isRequired = migrationUtils.quickCheck();
    const history = migrationUtils.getMigrationHistory();
    const hasLocalData = localStorageService.getTodos().length > 0;

    setState({
      isRequired,
      hasLocalData,
      isCompleted: history.completed,
    });
  }, []);

  return state;
}

/**
 * 마이그레이션 진행률 표시용 훅
 */
export function useMigrationProgress(): {
  progress: number;
  stage: string;
  isActive: boolean;
  eta: number | null; // 예상 완료 시간 (초)
} {
  const { migration } = useMigration();
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (
      migration.isInProgress &&
      migration.stage === "migrating" &&
      !startTime
    ) {
      setStartTime(Date.now());
    } else if (!migration.isInProgress) {
      setStartTime(null);
    }
  }, [migration.isInProgress, migration.stage, startTime]);

  const eta = useMemo(() => {
    if (
      !startTime ||
      !migration.isInProgress ||
      migration.migratedItems === 0
    ) {
      return null;
    }

    const elapsed = Date.now() - startTime;
    const avgTimePerItem = elapsed / migration.migratedItems;
    const remainingItems = migration.totalItems - migration.migratedItems;

    return Math.ceil((remainingItems * avgTimePerItem) / 1000);
  }, [
    startTime,
    migration.isInProgress,
    migration.migratedItems,
    migration.totalItems,
  ]);

  return {
    progress:
      migration.totalItems > 0
        ? migration.migratedItems / migration.totalItems
        : 0,
    stage: migration.stage,
    isActive: migration.isInProgress,
    eta,
  };
}
