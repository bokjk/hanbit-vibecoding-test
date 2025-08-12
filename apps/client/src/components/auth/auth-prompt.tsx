/**
 * 인증 유도 프롬프트 컴포넌트
 * 
 * 게스트 사용자에게 로그인/회원가입을 유도하는 UI 컴포넌트
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
// import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  User, 
  UserPlus, 
  Shield, 
  Cloud, 
  Smartphone, 
  Zap,
  X,
  Info
} from 'lucide-react';
import { useAuth } from '../../hooks/use-auth';
import { useQuickMigrationCheck } from '../../hooks/use-migration';

/**
 * AuthPrompt Props
 */
interface AuthPromptProps {
  isOpen: boolean;
  onClose: () => void;
  trigger?: 'migration' | 'feature_limit' | 'data_sync' | 'manual';
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
    icon: <Cloud className="w-5 h-5 text-blue-500" />,
    title: "클라우드 동기화",
    description: "모든 기기에서 데이터 접근",
    guestSupport: false,
  },
  {
    icon: <Shield className="w-5 h-5 text-green-500" />,
    title: "데이터 보안",
    description: "안전한 계정 기반 저장",
    guestSupport: false,
  },
  {
    icon: <Smartphone className="w-5 h-5 text-purple-500" />,
    title: "다중 기기 지원",
    description: "스마트폰, 태블릿, PC에서 사용",
    guestSupport: false,
  },
  {
    icon: <Zap className="w-5 h-5 text-yellow-500" />,
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
  trigger = 'manual',
  onLogin,
  onRegister,
  onContinueAsGuest,
  showBenefits = true,
}: AuthPromptProps) {
  const { state: authState } = useAuth();
  const migrationCheck = useQuickMigrationCheck();
  const [currentTab, setCurrentTab] = useState<'benefits' | 'limitations'>('benefits');

  /**
   * 트리거별 메시지 생성
   */
  const getTriggerMessage = () => {
    switch (trigger) {
      case 'migration':
        return {
          title: "데이터를 안전하게 보관하세요",
          description: "계정을 만들면 할 일 데이터가 클라우드에 안전하게 저장되어 어디서든 접근할 수 있습니다.",
          urgency: "high" as const,
        };
      case 'feature_limit':
        return {
          title: "더 많은 기능을 사용하세요",
          description: "게스트 계정의 제한을 해제하고 모든 기능을 자유롭게 이용하세요.",
          urgency: "medium" as const,
        };
      case 'data_sync':
        return {
          title: "다른 기기에서도 사용하세요",
          description: "계정을 만들면 모든 기기에서 동일한 할 일 목록에 접근할 수 있습니다.",
          urgency: "medium" as const,
        };
      case 'manual':
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
    console.log('Login triggered');
  };

  /**
   * 회원가입 처리
   */
  const handleRegister = () => {
    onRegister?.();
    // TODO: 실제 회원가입 구현 시 연결
    console.log('Register triggered');
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
      case 'high':
        return 'border-red-200 bg-red-50';
      case 'medium':
        return 'border-yellow-200 bg-yellow-50';
      case 'low':
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <User className="w-6 h-6 text-blue-500" />
            {triggerInfo.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 트리거 메시지 */}
          <Alert className={getUrgencyStyle()}>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {triggerInfo.description}
            </AlertDescription>
          </Alert>

          {/* 마이그레이션 관련 정보 */}
          {trigger === 'migration' && migrationCheck.hasLocalData && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Cloud className="w-5 h-5 text-blue-500" />
                  <span className="font-medium text-blue-700">데이터 마이그레이션</span>
                </div>
                <p className="text-sm text-blue-600">
                  현재 로컬에 저장된 할 일들을 클라우드 계정으로 안전하게 이동할 수 있습니다.
                  계정을 만들면 데이터 손실 없이 모든 기기에서 접근 가능합니다.
                </p>
              </CardContent>
            </Card>
          )}

          {/* 혜택/제한사항 탭 */}
          {showBenefits && (
            <div className="space-y-4">
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setCurrentTab('benefits')}
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                    currentTab === 'benefits'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  계정의 혜택
                </button>
                <button
                  onClick={() => setCurrentTab('limitations')}
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                    currentTab === 'limitations'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  게스트 제한사항
                </button>
              </div>

              {/* 혜택 탭 */}
              {currentTab === 'benefits' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {AUTH_BENEFITS.map((benefit, index) => (
                    <Card key={index} className="relative">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {benefit.icon}
                          <div>
                            <h4 className="font-medium text-sm mb-1">{benefit.title}</h4>
                            <p className="text-xs text-gray-600">{benefit.description}</p>
                          </div>
                        </div>
                        {!benefit.guestSupport && (
                          <span className="absolute top-2 right-2 bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-md">
                            계정 필요
                          </span>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* 제한사항 탭 */}
              {currentTab === 'limitations' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <X className="w-4 h-4 text-red-500" />
                      게스트 계정 제한사항
                    </CardTitle>
                    <CardDescription className="text-xs">
                      게스트로 계속 사용하면 다음과 같은 제한이 있습니다
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {GUEST_LIMITATIONS.map((limitation, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                          <X className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
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
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                현재 게스트 계정으로 사용 중입니다. 
                {authState.user?.permissions && (
                  <span className="ml-1">
                    할 일 {authState.user.permissions.maxTodos - (authState.user.permissions.currentTodos || 0)}개를 더 만들 수 있습니다.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Button 
            onClick={handleRegister}
            className="flex-1 flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            계정 만들기
          </Button>
          <Button 
            variant="outline" 
            onClick={handleLogin}
            className="flex-1 flex items-center gap-2"
          >
            <User className="w-4 h-4" />
            로그인
          </Button>
        </div>

        {/* 게스트 계속 사용 옵션 */}
        <div className="text-center">
          <button
            onClick={handleContinueAsGuest}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            게스트로 계속 사용하기
          </button>
        </div>

        {/* 미래 기능 안내 */}
        <div className="text-center">
          <p className="text-xs text-gray-400">
            * 로그인/회원가입 기능은 곧 출시 예정입니다
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 간단한 인증 유도 배너
 */
interface AuthPromptBannerProps {
  onPromptOpen: () => void;
  onDismiss: () => void;
  className?: string;
}

export function AuthPromptBanner({ onPromptOpen, onDismiss, className = '' }: AuthPromptBannerProps) {
  const { state: authState } = useAuth();
  
  if (!authState.isGuest) return null;

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <User className="w-4 h-4 text-blue-500" />
          <div>
            <p className="text-sm font-medium text-blue-700">
              더 많은 기능을 사용해보세요
            </p>
            <p className="text-xs text-blue-600">
              계정을 만들면 무제한으로 할 일을 관리할 수 있습니다
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            size="sm" 
            onClick={onPromptOpen}
            className="bg-blue-500 hover:bg-blue-600"
          >
            시작하기
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onDismiss}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}