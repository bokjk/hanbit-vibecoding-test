/**
 * 인증 유도 프롬프트 컴포넌트
 *
 * 게스트 사용자에게 로그인/회원가입을 유도하는 UI 컴포넌트
 */

import { useState } from "react";
import { Button } from "@vive/ui";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@vive/ui";
// Dialog 컴포넌트는 현재 UI 패키지에 없으므로 간단한 모달로 대체
// import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from "@vive/ui";
import {
  User,
  UserPlus,
  Shield,
  Cloud,
  Smartphone,
  Zap,
  X,
  Info,
} from "lucide-react";
import { useAuth } from "../../hooks/use-auth";
import { useQuickMigrationCheck } from "../../hooks/use-migration";
import styles from "./auth-prompt.module.scss";

/**
 * AuthPrompt Props
 */
interface AuthPromptProps {
  isOpen: boolean;
  onClose: () => void;
  trigger?: "migration" | "feature_limit" | "data_sync" | "manual";
  onLogin?: () => void;
  onRegister?: () => void;
  onContinueAsGuest?: () => void;
  showBenefits?: boolean;
  className?: string;
}

/**
 * 인증 혜택 정보
 */
const AUTH_BENEFITS = [
  {
    icon: <Cloud className={styles.migrationIcon} />,
    title: "클라우드 동기화",
    description: "모든 기기에서 데이터 접근",
    guestSupport: false,
  },
  {
    icon: <Shield style={{ width: '1.25rem', height: '1.25rem', color: 'rgb(34 197 94)' }} />,
    title: "데이터 보안",
    description: "안전한 계정 기반 저장",
    guestSupport: false,
  },
  {
    icon: <Smartphone style={{ width: '1.25rem', height: '1.25rem', color: 'rgb(168 85 247)' }} />,
    title: "다중 기기 지원",
    description: "스마트폰, 태블릿, PC에서 사용",
    guestSupport: false,
  },
  {
    icon: <Zap style={{ width: '1.25rem', height: '1.25rem', color: 'rgb(234 179 8)' }} />,
    title: "고급 기능",
    description: "무제한 할 일, 고급 필터링",
    guestSupport: false,
  },
];

/**
 * 게스트 제한사항
 */
const GUEST_LIMITATIONS = [
  "할 일 최대 50개까지 생성 가능",
  "로컬 저장소만 사용 (기기별로 데이터 분리)",
  "데이터 백업 및 복원 불가",
  "고급 필터링 및 검색 기능 제한",
];

/**
 * 인증 유도 프롬프트 컴포넌트
 */
export function AuthPrompt({
  isOpen,
  onClose,
  trigger = "manual",
  onLogin,
  onRegister,
  onContinueAsGuest,
  showBenefits = true,
}: AuthPromptProps) {
  const { state: authState } = useAuth();
  const migrationCheck = useQuickMigrationCheck();
  const [currentTab, setCurrentTab] = useState<"benefits" | "limitations">(
    "benefits",
  );

  /**
   * 트리거별 메시지 생성
   */
  const getTriggerMessage = () => {
    switch (trigger) {
      case "migration":
        return {
          title: "데이터를 안전하게 보관하세요",
          description:
            "계정을 만들면 할 일 데이터가 클라우드에 안전하게 저장되어 어디서든 접근할 수 있습니다.",
          urgency: "high" as const,
        };
      case "feature_limit":
        return {
          title: "더 많은 기능을 사용하세요",
          description:
            "게스트 계정의 제한을 해제하고 모든 기능을 자유롭게 이용하세요.",
          urgency: "medium" as const,
        };
      case "data_sync":
        return {
          title: "다른 기기에서도 사용하세요",
          description:
            "계정을 만들면 모든 기기에서 동일한 할 일 목록에 접근할 수 있습니다.",
          urgency: "medium" as const,
        };
      case "manual":
      default:
        return {
          title: "더 나은 경험을 위해",
          description: "계정을 만들어 모든 기능을 활용해보세요.",
          urgency: "low" as const,
        };
    }
  };

  const triggerInfo = getTriggerMessage();

  /**
   * 로그인 처리
   */
  const handleLogin = () => {
    onLogin?.();
    // TODO: 실제 로그인 구현 시 연결
    console.log("Login triggered");
  };

  /**
   * 회원가입 처리
   */
  const handleRegister = () => {
    onRegister?.();
    // TODO: 실제 회원가입 구현 시 연결
    console.log("Register triggered");
  };

  /**
   * 게스트 계속 사용
   */
  const handleContinueAsGuest = () => {
    onContinueAsGuest?.();
    onClose();
  };

  /**
   * 긴급도별 스타일 클래스
   */
  const getUrgencyStyle = () => {
    switch (triggerInfo.urgency) {
      case "high":
        return styles.urgencyHigh;
      case "medium":
        return styles.urgencyMedium;
      case "low":
      default:
        return styles.urgencyLow;
    }
  };

  return isOpen ? (
    <div className={styles.modalOverlay}>
      <Card className={styles.modalCard}>
        <CardHeader>
          <CardTitle className={styles.cardTitle}>
            <User className={styles.titleIcon} />
            {triggerInfo.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={styles.contentWrapper}>
            {/* 트리거 메시지 */}
            <Alert className={`${styles.alert} ${getUrgencyStyle()}`}>
              <Info className={styles.alertIcon} />
              <AlertDescription className={styles.alertDescription}>
                {triggerInfo.description}
              </AlertDescription>
            </Alert>

            {/* 마이그레이션 관련 정보 */}
            {trigger === "migration" && migrationCheck.hasLocalData && (
              <Card className={styles.migrationCard}>
                <CardContent className={styles.migrationCardContent}>
                  <div className={styles.migrationTitleContainer}>
                    <Cloud className={styles.migrationIcon} />
                    <span className={styles.migrationTitle}>
                      데이터 마이그레이션
                    </span>
                  </div>
                  <p className={styles.migrationDescription}>
                    현재 로컬에 저장된 할 일들을 클라우드 계정으로 안전하게
                    이동할 수 있습니다. 계정을 만들면 데이터 손실 없이 모든
                    기기에서 접근 가능합니다.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* 혜택/제한사항 탭 */}
            {showBenefits && (
              <div className={styles.tabContainer}>
                <div className={styles.tabList}>
                  <button
                    onClick={() => setCurrentTab("benefits")}
                    className={`${styles.tabButton} ${currentTab === 'benefits' ? styles.active : ''}`}>
                    계정의 혜택
                  </button>
                  <button
                    onClick={() => setCurrentTab("limitations")}
                    className={`${styles.tabButton} ${currentTab === 'limitations' ? styles.active : ''}`}>
                    게스트 제한사항
                  </button>
                </div>

                {/* 혜택 탭 */}
                {currentTab === "benefits" && (
                  <div className={styles.benefitsGrid}>
                    {AUTH_BENEFITS.map((benefit, index) => (
                      <Card key={index} className={styles.benefitCard}>
                        <CardContent className={styles.benefitContent}>
                          <div className={styles.benefitBody}>
                            {benefit.icon}
                            <div>
                              <h4 className={styles.benefitTitle}>
                                {benefit.title}
                              </h4>
                              <p className={styles.benefitDescription}>
                                {benefit.description}
                              </p>
                            </div>
                          </div>
                          {!benefit.guestSupport && (
                            <span className={styles.benefitBadge}>
                              계정 필요
                            </span>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* 제한사항 탭 */}
                {currentTab === "limitations" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className={styles.limitationTitle}>
                        <X className={styles.limitationIcon} />
                        게스트 계정 제한사항
                      </CardTitle>
                      <CardDescription className={styles.limitationDescription}>
                        게스트로 계속 사용하면 다음과 같은 제한이 있습니다
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className={styles.limitationList}>
                        {GUEST_LIMITATIONS.map((limitation, index) => (
                          <li
                            key={index}
                            className={styles.limitationItem}>
                            <X className={styles.limitationItemIcon} />
                            <span>{limitation}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* 현재 상태 표시 */}
            {authState.isGuest && (
              <Alert>
                <Info className={styles.alertIcon} />
                <AlertDescription className={styles.alertDescription}>
                  현재 게스트 계정으로 사용 중입니다.
                  {authState.user?.permissions && (
                    <span className={styles.statusAlert}>
                      할 일{" "}
                      {authState.user.permissions.maxTodos -
                        (authState.user.permissions.currentTodos || 0)}
                      개를 더 만들 수 있습니다.
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* 액션 버튼 */}
          <div className={styles.actionButtonContainer}>
            <div className={styles.actionButtons}>
            <Button
              onClick={handleRegister}
              className={styles.actionButton}>
              <UserPlus className={styles.actionIcon} />
              계정 만들기
            </Button>
            <Button
              variant="outline"
              onClick={handleLogin}
              className={styles.actionButton}>
              <User className={styles.actionIcon} />
              로그인
            </Button>
            </div>
          </div>

          {/* 게스트 계속 사용 옵션 */}
          <div className={styles.guestButtonContainer}>
            <button
              onClick={handleContinueAsGuest}
              className={styles.guestButton}>
              게스트로 계속 사용하기
            </button>
          </div>

          {/* 미래 기능 안내 */}
          <div className={styles.noticeContainer}>
            <p className={styles.noticeText}>
              * 로그인/회원가입 기능은 곧 출시 예정입니다
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  ) : null;
}

/**
 * 간단한 인증 유도 배너
 */
interface AuthPromptBannerProps {
  onPromptOpen: () => void;
  onDismiss: () => void;
  className?: string;
}

export function AuthPromptBanner({
  onPromptOpen,
  onDismiss,
  className = "",
}: AuthPromptBannerProps) {
  const { state: authState } = useAuth();

  if (!authState.isGuest) return null;

  return (
    <div className={`${styles.bannerContainer} ${className}`}>
      <div className={styles.bannerContent}>
        <div className={styles.bannerTextContainer}>
          <User className={styles.bannerIcon} />
          <div>
            <p className={styles.bannerTitle}>
              더 많은 기능을 사용해보세요
            </p>
            <p className={styles.bannerDescription}>
              계정을 만들면 무제한으로 할 일을 관리할 수 있습니다
            </p>
          </div>
        </div>
        <div className={styles.bannerActions}>
          <Button
            size="sm"
            onClick={onPromptOpen}
            className={styles.bannerButton}>
            시작하기
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className={styles.bannerDismissButton}>
            <X className={styles.actionIcon} />
          </Button>
        </div>
      </div>
    </div>
  );
}