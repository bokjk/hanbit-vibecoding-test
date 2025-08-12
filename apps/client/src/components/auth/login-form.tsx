/**
 * 로그인 폼 컴포넌트 (스켈레톤)
 * 
 * 향후 실제 로그인 기능 구현을 위한 기본 구조
 * 현재는 UI만 제공하고 실제 인증은 미구현
 */

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  Loader2,
  AlertCircle,
  Info 
} from 'lucide-react';

/**
 * 로그인 폼 데이터
 */
interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

/**
 * LoginForm Props
 */
interface LoginFormProps {
  onSubmit?: (data: LoginFormData) => Promise<void>;
  onForgotPassword?: () => void;
  onSwitchToRegister?: () => void;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

/**
 * 로그인 폼 컴포넌트
 */
export function LoginForm({
  onSubmit,
  onForgotPassword,
  onSwitchToRegister,
  isLoading = false,
  error,
  className = '',
}: LoginFormProps) {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Partial<LoginFormData>>({});
  const formRef = useRef<HTMLFormElement>(null);

  /**
   * 폼 검증
   */
  const validateForm = (): boolean => {
    const errors: Partial<LoginFormData> = {};

    if (!formData.email) {
      errors.email = '이메일을 입력해주세요.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = '올바른 이메일 형식을 입력해주세요.';
    }

    if (!formData.password) {
      errors.password = '비밀번호를 입력해주세요.';
    } else if (formData.password.length < 6) {
      errors.password = '비밀번호는 최소 6자 이상이어야 합니다.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * 입력값 변경 처리
   */
  const handleInputChange = (field: keyof LoginFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // 해당 필드의 검증 에러 제거
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  /**
   * 폼 제출 처리
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      if (onSubmit) {
        await onSubmit(formData);
      } else {
        // 기본 동작: 미구현 메시지 표시
        alert('로그인 기능은 현재 개발 중입니다. 게스트로 계속 사용해주세요.');
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  /**
   * 비밀번호 표시/숨김 토글
   */
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Card className={`w-full max-w-md ${className}`}>
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Mail className="w-5 h-5 text-blue-500" />
          로그인
        </CardTitle>
        <CardDescription>
          계정에 로그인하여 모든 기능을 사용하세요
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {/* 개발 중 안내 */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              로그인 기능은 현재 개발 중입니다. 게스트 계정으로 모든 기능을 체험해보세요.
            </AlertDescription>
          </Alert>

          {/* 전역 에러 메시지 */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 이메일 필드 */}
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              이메일
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`pl-10 ${validationErrors.email ? 'border-red-500' : ''}`}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
            {validationErrors.email && (
              <p className="text-sm text-red-500">{validationErrors.email}</p>
            )}
          </div>

          {/* 비밀번호 필드 */}
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              비밀번호
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="비밀번호를 입력하세요"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className={`pl-10 pr-10 ${validationErrors.password ? 'border-red-500' : ''}`}
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {validationErrors.password && (
              <p className="text-sm text-red-500">{validationErrors.password}</p>
            )}
          </div>

          {/* 기억하기 체크박스 */}
          <div className="flex items-center space-x-2">
            <input
              id="rememberMe"
              type="checkbox"
              checked={formData.rememberMe}
              onChange={(e) => handleInputChange('rememberMe', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              disabled={isLoading}
            />
            <label htmlFor="rememberMe" className="text-sm text-gray-700">
              로그인 상태 유지
            </label>
          </div>

          {/* 제출 버튼 */}
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                로그인 중...
              </>
            ) : (
              '로그인'
            )}
          </Button>

          {/* 비밀번호 찾기 */}
          <div className="text-center">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm text-blue-500 hover:text-blue-700 underline"
              disabled={isLoading}
            >
              비밀번호를 잊으셨나요?
            </button>
          </div>

          {/* 회원가입 링크 */}
          <div className="text-center pt-4 border-t">
            <p className="text-sm text-gray-600">
              계정이 없으신가요?{' '}
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-blue-500 hover:text-blue-700 underline font-medium"
                disabled={isLoading}
              >
                회원가입
              </button>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * 간단한 로그인 버튼 컴포넌트
 */
interface LoginButtonProps {
  onClick: () => void;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  disabled?: boolean;
}

export function LoginButton({ 
  onClick, 
  className = '', 
  variant = 'default',
  size = 'default',
  disabled = false 
}: LoginButtonProps) {
  return (
    <Button 
      onClick={onClick}
      variant={variant}
      size={size}
      disabled={disabled}
      className={`flex items-center gap-2 ${className}`}
    >
      <Mail className="w-4 h-4" />
      로그인
    </Button>
  );
}