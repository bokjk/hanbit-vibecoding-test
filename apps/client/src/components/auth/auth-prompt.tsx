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
    icon: <Cloud style={{ width: '1.25rem', height: '1.25rem', color: 'rgb(59 130 246)' }} />,
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
        return 'border-red-200 bg-red-50';
      case "medium":
        return 'border-yellow-200 bg-yellow-50';
      case "low":
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  return isOpen ? (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <Card style={{ width: '100%', maxWidth: '42rem', margin: '0 1rem', maxHeight: '90vh', overflowY: 'auto' }}>
        <CardHeader>
          <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem', lineHeight: '1.75rem' }}>
            <User style={{ width: '1.5rem', height: '1.5rem', color: 'rgb(59 130 246)' }} />
            {triggerInfo.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* 트리거 메시지 */}
            <Alert style={{ border: '1px solid', borderRadius: '0.5rem', padding: '1rem' }} className={getUrgencyStyle()}>
              <Info style={{ height: '1rem', width: '1rem' }} />
              <AlertDescription style={{ fontSize: '0.875rem', lineHeight: '1.25rem' }}>
                {triggerInfo.description}
              </AlertDescription>
            </Alert>

            {/* 마이그레이션 관련 정보 */}
            {trigger === "migration" && migrationCheck.hasLocalData && (
              <Card style={{ backgroundColor: 'rgb(239 246 255)', borderColor: 'rgb(191 219 254)', border: '1px solid' }}>
                <CardContent style={{ paddingTop: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Cloud style={{ width: '1.25rem', height: '1.25rem', color: 'rgb(59 130 246)' }} />
                    <span style={{ fontWeight: '500', color: 'rgb(29 78 216)' }}>
                      데이터 마이그레이션
                    </span>
                  </div>
                  <p style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'rgb(37 99 235)' }}>
                    현재 로컬에 저장된 할 일들을 클라우드 계정으로 안전하게
                    이동할 수 있습니다. 계정을 만들면 데이터 손실 없이 모든
                    기기에서 접근 가능합니다.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* 혜택/제한사항 탭 */}
            {showBenefits && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'rgb(243 244 246)', borderRadius: '0.5rem', padding: '0.25rem' }}>
                  <button
                    onClick={() => setCurrentTab("benefits")}
                    style={{
                      flex: '1',
                      paddingTop: '0.5rem',
                      paddingBottom: '0.5rem',
                      paddingLeft: '1rem',
                      paddingRight: '1rem',
                      fontSize: '0.875rem',
                      lineHeight: '1.25rem',
                      fontWeight: '500',
                      borderRadius: '0.375rem',
                      transition: 'colors 200ms ease',
                      border: 'none',
                      cursor: 'pointer',
                      ...(currentTab === "benefits" 
                        ? { backgroundColor: 'white', color: 'rgb(17 24 39)', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' } 
                        : { backgroundColor: 'transparent', color: 'rgb(107 114 128)' })
                    }}
                    onMouseEnter={(e) => {
                      if (currentTab !== "benefits") {
                        e.currentTarget.style.color = 'rgb(55 65 81)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentTab !== "benefits") {
                        e.currentTarget.style.color = 'rgb(107 114 128)';
                      }
                    }}
                  >
                    계정의 혜택
                  </button>
                  <button
                    onClick={() => setCurrentTab("limitations")}
                    style={{
                      flex: '1',
                      paddingTop: '0.5rem',
                      paddingBottom: '0.5rem',
                      paddingLeft: '1rem',
                      paddingRight: '1rem',
                      fontSize: '0.875rem',
                      lineHeight: '1.25rem',
                      fontWeight: '500',
                      borderRadius: '0.375rem',
                      transition: 'colors 200ms ease',
                      border: 'none',
                      cursor: 'pointer',
                      ...(currentTab === "limitations" 
                        ? { backgroundColor: 'white', color: 'rgb(17 24 39)', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' } 
                        : { backgroundColor: 'transparent', color: 'rgb(107 114 128)' })
                    }}
                    onMouseEnter={(e) => {
                      if (currentTab !== "limitations") {
                        e.currentTarget.style.color = 'rgb(55 65 81)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (currentTab !== "limitations") {
                        e.currentTarget.style.color = 'rgb(107 114 128)';
                      }
                    }}
                  >
                    게스트 제한사항
                  </button>
                </div>

                {/* 혜택 탭 */}
                {currentTab === "benefits" && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    <style>
                      {`
                        @media (min-width: 640px) {
                          .benefits-grid { grid-template-columns: repeat(2, 1fr) !important; }
                        }
                      `}
                    </style>
                    <div className="benefits-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    {AUTH_BENEFITS.map((benefit, index) => (
                      <Card key={index} style={{ position: 'relative' }}>
                        <CardContent style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                            {benefit.icon}
                            <div>
                              <h4 style={{ fontWeight: '500', fontSize: '0.875rem', lineHeight: '1.25rem', marginBottom: '0.25rem' }}>
                                {benefit.title}
                              </h4>
                              <p style={{ fontSize: '0.75rem', lineHeight: '1rem', color: 'rgb(75 85 99)' }}>
                                {benefit.description}
                              </p>
                            </div>
                          </div>
                          {!benefit.guestSupport && (
                            <span style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', backgroundColor: 'rgb(243 244 246)', color: 'rgb(75 85 99)', fontSize: '0.75rem', lineHeight: '1rem', paddingLeft: '0.5rem', paddingRight: '0.5rem', paddingTop: '0.25rem', paddingBottom: '0.25rem', borderRadius: '0.375rem' }}>
                              계정 필요
                            </span>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    </div>
                  </div>
                )}

                {/* 제한사항 탭 */}
                {currentTab === "limitations" && (
                  <Card>
                    <CardHeader>
                      <CardTitle style={{ fontSize: '0.875rem', lineHeight: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <X style={{ width: '1rem', height: '1rem', color: 'rgb(239 68 68)' }} />
                        게스트 계정 제한사항
                      </CardTitle>
                      <CardDescription style={{ fontSize: '0.75rem', lineHeight: '1rem' }}>
                        게스트로 계속 사용하면 다음과 같은 제한이 있습니다
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {GUEST_LIMITATIONS.map((limitation, index) => (
                          <li
                            key={index}
style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.875rem', lineHeight: '1.25rem', color: 'rgb(75 85 99)' }}
                          >
                            <X style={{ width: '1rem', height: '1rem', color: 'rgb(248 113 113)', marginTop: '0.125rem', flexShrink: 0 }} />
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
                <Info style={{ height: '1rem', width: '1rem' }} />
                <AlertDescription style={{ fontSize: '0.875rem', lineHeight: '1.25rem' }}>
                  현재 게스트 계정으로 사용 중입니다.
                  {authState.user?.permissions && (
                    <span style={{ marginLeft: '0.25rem' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
            <style>
              {`
                @media (min-width: 640px) {
                  .action-buttons { flex-direction: row !important; }
                }
              `}
            </style>
            <div className="action-buttons" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Button
              onClick={handleRegister}
              style={{ flex: '1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <UserPlus style={{ width: '1rem', height: '1rem' }} />
              계정 만들기
            </Button>
            <Button
              variant="outline"
              onClick={handleLogin}
              style={{ flex: '1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <User style={{ width: '1rem', height: '1rem' }} />
              로그인
            </Button>
            </div>
          </div>

          {/* 게스트 계속 사용 옵션 */}
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleContinueAsGuest}
style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'rgb(107 114 128)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(55 65 81)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(107 114 128)'}
            >
              게스트로 계속 사용하기
            </button>
          </div>

          {/* 미래 기능 안내 */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.75rem', lineHeight: '1rem', color: 'rgb(156 163 175)' }}>
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
    <div
      style={{
        backgroundColor: 'rgb(239 246 255)',
        borderColor: 'rgb(191 219 254)',
        border: '1px solid',
        borderRadius: '0.5rem',
        padding: '0.75rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1' }}>
          <User style={{ width: '1rem', height: '1rem', color: 'rgb(59 130 246)' }} />
          <div>
            <p style={{ fontSize: '0.875rem', lineHeight: '1.25rem', fontWeight: '500', color: 'rgb(29 78 216)' }}>
              더 많은 기능을 사용해보세요
            </p>
            <p style={{ fontSize: '0.75rem', lineHeight: '1rem', color: 'rgb(37 99 235)' }}>
              계정을 만들면 무제한으로 할 일을 관리할 수 있습니다
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Button
            size="sm"
            onClick={onPromptOpen}
style={{ backgroundColor: 'rgb(59 130 246)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgb(37 99 235)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgb(59 130 246)'}
          >
            시작하기
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
style={{ color: 'rgb(107 114 128)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(55 65 81)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(107 114 128)'}
          >
            <X style={{ width: '1rem', height: '1rem' }} />
          </Button>
        </div>
      </div>
    </div>
  );
}
