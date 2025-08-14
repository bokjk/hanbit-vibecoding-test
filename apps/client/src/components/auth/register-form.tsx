/**
 * 회원가입 폼 컴포넌트 (스켈레톤)
 *
 * 향후 실제 회원가입 기능 구현을 위한 기본 구조
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
  User,
  Loader2,
  AlertCircle,
  Info,
  Check,
  X,
} from "lucide-react";
import styles from "./register-form.module.scss";

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
  onSubmit?: (data: Omit<RegisterFormData, "confirmPassword">) => Promise<void>;
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
  className = "",
}: RegisterFormProps) {
  const [formData, setFormData] = useState<RegisterFormData>({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
    agreeToPrivacy: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Partial<Record<keyof RegisterFormData, string>>
  >({});
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
      feedback.push("8자 이상 입력해주세요");
    }

    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      feedback.push("영문 소문자를 포함해주세요");
    }

    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push("영문 대문자를 포함해주세요");
    }

    if (/[0-9]/.test(password)) {
      score += 1;
    } else {
      feedback.push("숫자를 포함해주세요");
    }

    if (/[^a-zA-Z0-9]/.test(password)) {
      score += 1;
    } else {
      feedback.push("특수문자를 포함해주세요");
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
      errors.name = "이름을 입력해주세요.";
    } else if (formData.name.trim().length < 2) {
      errors.name = "이름은 2자 이상 입력해주세요.";
    }

    // 이메일 검증
    if (!formData.email) {
      errors.email = "이메일을 입력해주세요.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "올바른 이메일 형식을 입력해주세요.";
    }

    // 비밀번호 검증
    if (!formData.password) {
      errors.password = "비밀번호를 입력해주세요.";
    } else if (!passwordStrength.isValid) {
      errors.password = "비밀번호 요구사항을 충족해주세요.";
    }

    // 비밀번호 확인 검증
    if (!formData.confirmPassword) {
      errors.confirmPassword = "비밀번호 확인을 입력해주세요.";
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "비밀번호가 일치하지 않습니다.";
    }

    // 약관 동의 검증
    if (!formData.agreeToTerms) {
      errors.agreeToTerms = "서비스 이용약관에 동의해주세요.";
    }

    if (!formData.agreeToPrivacy) {
      errors.agreeToPrivacy = "개인정보 처리방침에 동의해주세요.";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * 입력값 변경 처리
   */
  const handleInputChange = (
    field: keyof RegisterFormData,
    value: string | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // 비밀번호 강도 체크
    if (field === "password" && typeof value === "string") {
      const strength = checkPasswordStrength(value);
      setPasswordStrength(strength);
    }

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
        const { confirmPassword, ...submitData } = formData;
        void confirmPassword; // 사용되지 않는 변수 경고 방지
        await onSubmit(submitData);
      } else {
        // 기본 동작: 미구현 메시지 표시
        alert(
          "회원가입 기능은 현재 개발 중입니다. 게스트로 계속 사용해주세요.",
        );
      }
    } catch (error) {
      console.error("Registration failed:", error);
    }
  };

  /**
   * 비밀번호 강도 색상
   */
  const getPasswordStrengthColor = () => {
    if (passwordStrength.score <= 1) return { backgroundColor: 'rgb(239 68 68)' };
    if (passwordStrength.score === 2) return { backgroundColor: 'rgb(249 115 22)' };
    if (passwordStrength.score === 3) return { backgroundColor: 'rgb(234 179 8)' };
    if (passwordStrength.score >= 4) return { backgroundColor: 'rgb(34 197 94)' };
    return { backgroundColor: 'rgb(229 231 235)' };
  };

  /**
   * 비밀번호 강도 텍스트
   */
  const getPasswordStrengthText = () => {
    if (passwordStrength.score <= 1) return "매우 약함";
    if (passwordStrength.score === 2) return "약함";
    if (passwordStrength.score === 3) return "보통";
    if (passwordStrength.score >= 4) return "강함";
    return "";
  };

  return (
    <Card className={`${styles.card} ${className}`}>
      <CardHeader className={styles.cardHeader}>
        <CardTitle className={styles.cardTitle}>
          <User className={styles.titleIcon} />
          회원가입
        </CardTitle>
        <CardDescription>
          새 계정을 만들어 모든 기능을 사용하세요
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className={styles.form}>
          {/* 개발 중 안내 */}
          <Alert>
            <Info className={styles.alertIcon} />
            <AlertDescription className={styles.alertDescription}>
              회원가입 기능은 현재 개발 중입니다. 게스트 계정으로 모든 기능을
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

          {/* 이름 필드 */}
          <div className={styles.field}>
            <label htmlFor="name" className={styles.label}>
              이름
            </label>
            <div className={styles.inputWrapper}>
              <User className={styles.inputIcon} />
              <Input
                id="name"
                type="text"
                placeholder="이름을 입력하세요"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className={`${styles.input} ${validationErrors.name ? styles.error : ''}`}
                disabled={isLoading}
                autoComplete="name"
              />
            </div>
            {validationErrors.name && (
              <p className={styles.errorMessage}>{validationErrors.name}</p>
            )}
          </div>

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
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
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

            {/* 비밀번호 강도 표시 */}
            {formData.password && (
              <div className={styles.passwordStrengthContainer}>
                <div className={styles.passwordStrengthBarContainer}>
                  <div className={styles.passwordStrengthBar}>
                    <div
                      className={styles.passwordStrengthIndicator}
                      style={{
                        width: `${(passwordStrength.score / 5) * 100}%`,
                        ...getPasswordStrengthColor(),
                      }}
                    />
                  </div>
                  <span className={styles.passwordStrengthText}>
                    {getPasswordStrengthText()}
                  </span>
                </div>
                {passwordStrength.feedback.length > 0 && !passwordStrength.isValid && (
                  <ul className={styles.passwordFeedbackList}>
                    {passwordStrength.feedback.map((item, index) => (
                      <li key={index} className={styles.passwordFeedbackItem}>
                        <X className={styles.passwordFeedbackIcon} />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {validationErrors.password && (
              <p className={styles.errorMessage}>
                {validationErrors.password}
              </p>
            )}
          </div>

          {/* 비밀번호 확인 필드 */}
          <div className={styles.field}>
            <label htmlFor="confirmPassword" className={styles.label}>
              비밀번호 확인
            </label>
            <div className={styles.inputWrapper}>
              <Lock className={styles.inputIcon} />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="비밀번호를 다시 입력하세요"
                value={formData.confirmPassword}
                onChange={(e) =>
                  handleInputChange("confirmPassword", e.target.value)
                }
                className={`${styles.input} ${styles.passwordInput} ${validationErrors.confirmPassword ? styles.error : ''}`}
                disabled={isLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className={styles.passwordToggle}
                disabled={isLoading}
              >
                {showConfirmPassword ? (
                  <EyeOff className={styles.toggleIcon} />
                ) : (
                  <Eye className={styles.toggleIcon} />
                )}
              </button>
            </div>

            {/* 비밀번호 일치 표시 */}
            {formData.confirmPassword && (
              <div className={styles.passwordMatchContainer}>
                {formData.password === formData.confirmPassword ? (
                  <>
                    <Check className={`${styles.passwordMatchIcon} ${styles.passwordMatchTextSuccess}`} />
                    <span className={styles.passwordMatchTextSuccess}>
                      비밀번호가 일치합니다
                    </span>
                  </>
                ) : (
                  <>
                    <X className={`${styles.passwordMatchIcon} ${styles.passwordMatchTextError}`} />
                    <span className={styles.passwordMatchTextError}>
                      비밀번호가 일치하지 않습니다
                    </span>
                  </>
                )}
              </div>
            )}

            {validationErrors.confirmPassword && (
              <p className={styles.errorMessage}>
                {validationErrors.confirmPassword}
              </p>
            )}
          </div>

          {/* 약관 동의 */}
          <div className={styles.termsContainer}>
            <div className={styles.termsItem}>
              <input
                id="agreeToTerms"
                type="checkbox"
                checked={formData.agreeToTerms}
                onChange={(e) =>
                  handleInputChange("agreeToTerms", e.target.checked)
                }
                className={styles.checkbox}
                disabled={isLoading}
              />
              <label htmlFor="agreeToTerms" className={styles.termsLabel}>
                <span className={styles.termsRequired}>*</span> 서비스 이용약관에
                동의합니다{" "}
                <button
                  type="button"
                  className={styles.termsLink}>
                  (보기)
                </button>
              </label>
            </div>
            {validationErrors.agreeToTerms && (
              <p className={styles.termsErrorMessage}>
                {validationErrors.agreeToTerms}
              </p>
            )}

            <div className={styles.termsItem}>
              <input
                id="agreeToPrivacy"
                type="checkbox"
                checked={formData.agreeToPrivacy}
                onChange={(e) =>
                  handleInputChange("agreeToPrivacy", e.target.checked)
                }
                className={styles.checkbox}
                disabled={isLoading}
              />
              <label htmlFor="agreeToPrivacy" className={styles.termsLabel}>
                <span className={styles.termsRequired}>*</span> 개인정보 처리방침에
                동의합니다{" "}
                <button
                  type="button"
                  className={styles.termsLink}>
                  (보기)
                </button>
              </label>
            </div>
            {validationErrors.agreeToPrivacy && (
              <p className={styles.termsErrorMessage}>
                {validationErrors.agreeToPrivacy}
              </p>
            )}
          </div>

          {/* 제출 버튼 */}
          <Button type="submit" className={styles.submitButton} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className={styles.loadingIcon} />
                계정 생성 중...
              </>
            ) : (
              "회원가입"
            )}
          </Button>

          {/* 로그인 링크 */}
          <div className={styles.loginContainer}>
            <p className={styles.loginText}>
              이미 계정이 있으신가요?{" "}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className={styles.loginButton}
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