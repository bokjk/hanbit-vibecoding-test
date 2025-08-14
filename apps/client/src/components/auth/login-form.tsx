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
import styles from "./login-form.module.scss";

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
    <Card className={`${styles.card} ${className}`}>
      <CardHeader className={styles.cardHeader}>
        <CardTitle className={styles.cardTitle}>
          <Mail className={styles.titleIcon} />
          로그인
        </CardTitle>
        <CardDescription>
          계정에 로그인하여 모든 기능을 사용하세요
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className={styles.form}>
          {/* 개발 중 안내 */}
          <Alert>
            <Info className={styles.alertIcon} />
            <AlertDescription className={styles.alertDescription}>
              로그인 기능은 현재 개발 중입니다. 게스트 계정으로 모든 기능을
              체험해보세요.
            </AlertDescription>
          </Alert>

          {/* 전역 에러 메시지 */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className={styles.alertIcon} />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 이메일 필드 */}
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>
              이메일
            </label>
            <div className={styles.inputWrapper}>
              <Mail className={styles.inputIcon} />
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className={`${styles.input} ${validationErrors.email ? styles.error : ''}`}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>
            {validationErrors.email && (
              <p className={styles.errorMessage}>{validationErrors.email}</p>
            )}
          </div>

          {/* 비밀번호 필드 */}
          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              비밀번호
            </label>
            <div className={styles.inputWrapper}>
              <Lock className={styles.inputIcon} />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="비밀번호를 입력하세요"
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                className={`${styles.input} ${styles.passwordInput} ${validationErrors.password ? styles.error : ''}`}
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className={styles.passwordToggle}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className={styles.toggleIcon} />
                ) : (
                  <Eye className={styles.toggleIcon} />
                )}
              </button>
            </div>
            {validationErrors.password && (
              <p className={styles.errorMessage}>
                {validationErrors.password}
              </p>
            )}
          </div>

          {/* 기억하기 체크박스 */}
          <div className={styles.checkboxWrapper}>
            <input
              id="rememberMe"
              type="checkbox"
              checked={formData.rememberMe}
              onChange={(e) =>
                handleInputChange("rememberMe", e.target.checked)
              }
              className={styles.checkbox}
              disabled={isLoading}
            />
            <label htmlFor="rememberMe" className={styles.checkboxLabel}>
              로그인 상태 유지
            </label>
          </div>

          {/* 제출 버튼 */}
          <Button type="submit" className={styles.submitButton} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className={styles.loadingIcon} />
                로그인 중...
              </>
            ) : (
              "로그인"
            )}
          </Button>

          {/* 비밀번호 찾기 */}
          <div className={styles.forgotPasswordContainer}>
            <button
              type="button"
              onClick={onForgotPassword}
              className={styles.forgotPasswordButton}
              disabled={isLoading}
            >
              비밀번호를 잊으셨나요?
            </button>
          </div>

          {/* 회원가입 링크 */}
          <div className={styles.registerContainer}>
            <p className={styles.registerText}>
              계정이 없으신가요?{" "}
              <button
                type="button"
                onClick={onSwitchToRegister}
                className={styles.registerButton}
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
      className={`${styles.loginButton} ${className}`}>
      <Mail className={styles.actionIcon} />
      로그인
    </Button>
  );
}