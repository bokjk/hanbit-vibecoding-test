/**
 * 로그인 폼 컴포넌트 (스켈레톤)
 *
 * 향후 실제 로그인 기능 구현을 위한 기본 구조
 * 현재는 UI만 제공하고 실제 인증은 미구현
 */

import { useState, useRef } from "react";
import { Button } from "@vive/ui";
import {
  Input,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Alert,
  AlertDescription,
} from "@vive/ui";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  Info,
} from "lucide-react";

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
  className = "",
}: LoginFormProps) {
  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Partial<LoginFormData>
  >({});
  const formRef = useRef<HTMLFormElement>(null);

  /**
   * 폼 검증
   */
  const validateForm = (): boolean => {
    const errors: Partial<LoginFormData> = {};

    if (!formData.email) {
      errors.email = "이메일을 입력해주세요.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "올바른 이메일 형식을 입력해주세요.";
    }

    if (!formData.password) {
      errors.password = "비밀번호를 입력해주세요.";
    } else if (formData.password.length < 6) {
      errors.password = "비밀번호는 최소 6자 이상이어야 합니다.";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * 입력값 변경 처리
   */
  const handleInputChange = (
    field: keyof LoginFormData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // 해당 필드의 검증 에러 제거
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
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
        alert("로그인 기능은 현재 개발 중입니다. 게스트로 계속 사용해주세요.");
      }
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  /**
   * 비밀번호 표시/숨김 토글
   */
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <Card style={{ width: '100%', maxWidth: '28rem' }}>
      <CardHeader style={{ textAlign: 'center' }}>
        <CardTitle style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <Mail style={{ width: '1.25rem', height: '1.25rem', color: 'rgb(59 130 246)' }} />
          로그인
        </CardTitle>
        <CardDescription>
          계정에 로그인하여 모든 기능을 사용하세요
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* 개발 중 안내 */}
          <Alert>
            <Info style={{ height: '1rem', width: '1rem' }} />
            <AlertDescription style={{ fontSize: '0.875rem', lineHeight: '1.25rem' }}>
              로그인 기능은 현재 개발 중입니다. 게스트 계정으로 모든 기능을
              체험해보세요.
            </AlertDescription>
          </Alert>

          {/* 전역 에러 메시지 */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle style={{ height: '1rem', width: '1rem' }} />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 이메일 필드 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="email" style={{ fontSize: '0.875rem', lineHeight: '1.25rem', fontWeight: '500' }}>
              이메일
            </label>
            <div style={{ position: 'relative' }}>
              <Mail style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: 'rgb(156 163 175)' }} />
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
style={{ paddingLeft: '2.5rem', ...(validationErrors.email && { borderColor: 'rgb(239 68 68)' }) }}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
            {validationErrors.email && (
              <p style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'rgb(239 68 68)' }}>{validationErrors.email}</p>
            )}
          </div>

          {/* 비밀번호 필드 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="password" style={{ fontSize: '0.875rem', lineHeight: '1.25rem', fontWeight: '500' }}>
              비밀번호
            </label>
            <div style={{ position: 'relative' }}>
              <Lock style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: 'rgb(156 163 175)' }} />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="비밀번호를 입력하세요"
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', ...(validationErrors.password && { borderColor: 'rgb(239 68 68)' }) }}
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgb(156 163 175)', border: 'none', background: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(75 85 99)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(156 163 175)'}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff style={{ width: '1rem', height: '1rem' }} />
                ) : (
                  <Eye style={{ width: '1rem', height: '1rem' }} />
                )}
              </button>
            </div>
            {validationErrors.password && (
              <p style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'rgb(239 68 68)' }}>
                {validationErrors.password}
              </p>
            )}
          </div>

          {/* 기억하기 체크박스 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              id="rememberMe"
              type="checkbox"
              checked={formData.rememberMe}
              onChange={(e) =>
                handleInputChange("rememberMe", e.target.checked)
              }
style={{ width: '1rem', height: '1rem', accentColor: 'rgb(37 99 235)', border: '1px solid rgb(209 213 219)', borderRadius: '0.25rem' }}
              disabled={isLoading}
            />
            <label htmlFor="rememberMe" style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'rgb(55 65 81)' }}>
              로그인 상태 유지
            </label>
          </div>

          {/* 제출 버튼 */}
          <Button type="submit" style={{ width: '100%' }} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 style={{ marginRight: '0.5rem', height: '1rem', width: '1rem', animation: 'spin 1s linear infinite' }} />
                로그인 중...
              </>
            ) : (
              "로그인"
            )}
          </Button>

          {/* 비밀번호 찾기 */}
          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={onForgotPassword}
style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'rgb(59 130 246)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(29 78 216)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(59 130 246)'}
              disabled={isLoading}
            >
              비밀번호를 잊으셨나요?
            </button>
          </div>

          {/* 회원가입 링크 */}
          <div style={{ textAlign: 'center', paddingTop: '1rem', borderTop: '1px solid rgb(229 231 235)' }}>
            <p style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'rgb(75 85 99)' }}>
              계정이 없으신가요?{" "}
              <button
                type="button"
                onClick={onSwitchToRegister}
style={{ color: 'rgb(59 130 246)', textDecoration: 'underline', fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(29 78 216)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(59 130 246)'}
                disabled={isLoading}
              >
                회원가입
              </button>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
    </>
  );
}

/**
 * 간단한 로그인 버튼 컴포넌트
 */
interface LoginButtonProps {
  onClick: () => void;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  disabled?: boolean;
}

export function LoginButton({
  onClick,
  className = "",
  variant = "default",
  size = "default",
  disabled = false,
}: LoginButtonProps) {
  return (
    <Button
      onClick={onClick}
      variant={variant}
      size={size}
      disabled={disabled}
style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
    >
      <Mail style={{ width: '1rem', height: '1rem' }} />
      로그인
    </Button>
  );
}
