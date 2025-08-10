/**
 * 회원가입 폼 컴포넌트 (스켈레톤)
 * 
 * 향후 실제 회원가입 기능 구현을 위한 기본 구조
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
  User,
  Loader2,
  AlertCircle,
  Info,
  Check,
  X
} from 'lucide-react';

/**
 * 회원가입 폼 데이터
 */
interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
  agreeToPrivacy: boolean;
}

/**
 * 비밀번호 강도 체크 결과
 */
interface PasswordStrength {
  score: number; // 0-4
  feedback: string[];
  isValid: boolean;
}

/**
 * RegisterForm Props
 */
interface RegisterFormProps {
  onSubmit?: (data: Omit<RegisterFormData, 'confirmPassword'>) => Promise<void>;
  onSwitchToLogin?: () => void;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

/**
 * 회원가입 폼 컴포넌트
 */
export function RegisterForm({
  onSubmit,
  onSwitchToLogin,
  isLoading = false,
  error,
  className = '',
}: RegisterFormProps) {
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
    agreeToPrivacy: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof RegisterFormData, string>>>({});
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    score: 0,
    feedback: [],
    isValid: false,
  });
  const formRef = useRef<HTMLFormElement>(null);

  /**
   * 비밀번호 강도 체크
   */
  const checkPasswordStrength = (password: string): PasswordStrength => {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) {
      score += 1;
    } else {
      feedback.push('8자 이상 입력해주세요');
    }

    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('영문 소문자를 포함해주세요');
    }

    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('영문 대문자를 포함해주세요');
    }

    if (/[0-9]/.test(password)) {
      score += 1;
    } else {
      feedback.push('숫자를 포함해주세요');
    }

    if (/[^a-zA-Z0-9]/.test(password)) {
      score += 1;
    } else {
      feedback.push('특수문자를 포함해주세요');
    }

    return {
      score,
      feedback,
      isValid: score >= 3 && password.length >= 8,
    };
  };

  /**
   * 폼 검증
   */
  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof RegisterFormData, string>> = {};

    // 이름 검증
    if (!formData.name.trim()) {
      errors.name = '이름을 입력해주세요.';
    } else if (formData.name.trim().length < 2) {
      errors.name = '이름은 2자 이상 입력해주세요.';
    }

    // 이메일 검증
    if (!formData.email) {
      errors.email = '이메일을 입력해주세요.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = '올바른 이메일 형식을 입력해주세요.';
    }

    // 비밀번호 검증
    if (!formData.password) {
      errors.password = '비밀번호를 입력해주세요.';
    } else if (!passwordStrength.isValid) {
      errors.password = '비밀번호 요구사항을 충족해주세요.';
    }

    // 비밀번호 확인 검증
    if (!formData.confirmPassword) {
      errors.confirmPassword = '비밀번호 확인을 입력해주세요.';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = '비밀번호가 일치하지 않습니다.';
    }

    // 약관 동의 검증
    if (!formData.agreeToTerms) {
      errors.agreeToTerms = '서비스 이용약관에 동의해주세요.';
    }

    if (!formData.agreeToPrivacy) {
      errors.agreeToPrivacy = '개인정보 처리방침에 동의해주세요.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * 입력값 변경 처리
   */
  const handleInputChange = (field: keyof RegisterFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // 비밀번호 강도 체크
    if (field === 'password' && typeof value === 'string') {
      const strength = checkPasswordStrength(value);
      setPasswordStrength(strength);
    }
    
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
        const { confirmPassword, ...submitData } = formData;
        await onSubmit(submitData);
      } else {
        // 기본 동작: 미구현 메시지 표시
        alert('회원가입 기능은 현재 개발 중입니다. 게스트로 계속 사용해주세요.');
      }
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };

  /**
   * 비밀번호 강도 색상
   */
  const getPasswordStrengthColor = () => {
    if (passwordStrength.score <= 1) return 'bg-red-500';
    if (passwordStrength.score === 2) return 'bg-orange-500';
    if (passwordStrength.score === 3) return 'bg-yellow-500';
    if (passwordStrength.score >= 4) return 'bg-green-500';
    return 'bg-gray-200';
  };

  /**
   * 비밀번호 강도 텍스트
   */
  const getPasswordStrengthText = () => {
    if (passwordStrength.score <= 1) return '매우 약함';
    if (passwordStrength.score === 2) return '약함';
    if (passwordStrength.score === 3) return '보통';
    if (passwordStrength.score >= 4) return '강함';
    return '';
  };

  return (
    <Card className={`w-full max-w-md ${className}`}>
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <User className="w-5 h-5 text-blue-500" />
          회원가입
        </CardTitle>
        <CardDescription>
          새 계정을 만들어 모든 기능을 사용하세요
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {/* 개발 중 안내 */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              회원가입 기능은 현재 개발 중입니다. 게스트 계정으로 모든 기능을 체험해보세요.
            </AlertDescription>
          </Alert>

          {/* 전역 에러 메시지 */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 이름 필드 */}
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              이름
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="name"
                type="text"
                placeholder="이름을 입력하세요"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`pl-10 ${validationErrors.name ? 'border-red-500' : ''}`}
                disabled={isLoading}
                autoComplete="name"
              />
            </div>
            {validationErrors.name && (
              <p className="text-sm text-red-500">{validationErrors.name}</p>
            )}
          </div>

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
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            {/* 비밀번호 강도 표시 */}
            {formData.password && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor()}`}
                      style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600">
                    {getPasswordStrengthText()}
                  </span>
                </div>
                {passwordStrength.feedback.length > 0 && (
                  <ul className="text-xs text-gray-600 space-y-1">
                    {passwordStrength.feedback.map((item, index) => (
                      <li key={index} className="flex items-center gap-1">
                        <X className="w-3 h-3 text-red-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            
            {validationErrors.password && (
              <p className="text-sm text-red-500">{validationErrors.password}</p>
            )}
          </div>

          {/* 비밀번호 확인 필드 */}
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              비밀번호 확인
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="비밀번호를 다시 입력하세요"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                className={`pl-10 pr-10 ${validationErrors.confirmPassword ? 'border-red-500' : ''}`}
                disabled={isLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={isLoading}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            
            {/* 비밀번호 일치 표시 */}
            {formData.confirmPassword && (
              <div className="flex items-center gap-1 text-xs">
                {formData.password === formData.confirmPassword ? (
                  <>
                    <Check className="w-3 h-3 text-green-500" />
                    <span className="text-green-600">비밀번호가 일치합니다</span>
                  </>
                ) : (
                  <>
                    <X className="w-3 h-3 text-red-500" />
                    <span className="text-red-600">비밀번호가 일치하지 않습니다</span>
                  </>
                )}
              </div>
            )}
            
            {validationErrors.confirmPassword && (
              <p className="text-sm text-red-500">{validationErrors.confirmPassword}</p>
            )}
          </div>

          {/* 약관 동의 */}
          <div className="space-y-3">
            <div className="flex items-start space-x-2">
              <input
                id="agreeToTerms"
                type="checkbox"
                checked={formData.agreeToTerms}
                onChange={(e) => handleInputChange('agreeToTerms', e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={isLoading}
              />
              <label htmlFor="agreeToTerms" className="text-sm text-gray-700">
                <span className="text-red-500">*</span> 서비스 이용약관에 동의합니다{' '}
                <button type="button" className="text-blue-500 underline hover:text-blue-700">
                  (보기)
                </button>
              </label>
            </div>
            {validationErrors.agreeToTerms && (
              <p className="text-sm text-red-500 ml-6">{validationErrors.agreeToTerms}</p>
            )}

            <div className="flex items-start space-x-2">
              <input
                id="agreeToPrivacy"
                type="checkbox"
                checked={formData.agreeToPrivacy}
                onChange={(e) => handleInputChange('agreeToPrivacy', e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                disabled={isLoading}
              />
              <label htmlFor="agreeToPrivacy" className="text-sm text-gray-700">
                <span className="text-red-500">*</span> 개인정보 처리방침에 동의합니다{' '}
                <button type="button" className="text-blue-500 underline hover:text-blue-700">
                  (보기)
                </button>
              </label>
            </div>
            {validationErrors.agreeToPrivacy && (
              <p className="text-sm text-red-500 ml-6">{validationErrors.agreeToPrivacy}</p>
            )}
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
                계정 생성 중...
              </>
            ) : (
              '회원가입'
            )}
          </Button>

          {/* 로그인 링크 */}
          <div className="text-center pt-4 border-t">
            <p className="text-sm text-gray-600">
              이미 계정이 있으신가요?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-blue-500 hover:text-blue-700 underline font-medium"
                disabled={isLoading}
              >
                로그인
              </button>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}