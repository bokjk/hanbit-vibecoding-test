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
          <User style={{ width: '1.25rem', height: '1.25rem', color: 'rgb(59 130 246)' }} />
          회원가입
        </CardTitle>
        <CardDescription>
          새 계정을 만들어 모든 기능을 사용하세요
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* 개발 중 안내 */}
          <Alert>
            <Info style={{ height: '1rem', width: '1rem' }} />
            <AlertDescription style={{ fontSize: '0.875rem', lineHeight: '1.25rem' }}>
              회원가입 기능은 현재 개발 중입니다. 게스트 계정으로 모든 기능을
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

          {/* 이름 필드 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="name" style={{ fontSize: '0.875rem', lineHeight: '1.25rem', fontWeight: '500' }}>
              이름
            </label>
            <div style={{ position: 'relative' }}>
              <User style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: 'rgb(156 163 175)' }} />
              <Input
                id="name"
                type="text"
                placeholder="이름을 입력하세요"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
style={{ paddingLeft: '2.5rem', ...(validationErrors.name && { borderColor: 'rgb(239 68 68)' }) }}
                disabled={isLoading}
                autoComplete="name"
              />
            </div>
            {validationErrors.name && (
              <p style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'rgb(239 68 68)' }}>{validationErrors.name}</p>
            )}
          </div>

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
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
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

            {/* 비밀번호 강도 표시 */}
            {formData.password && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ flex: '1', backgroundColor: 'rgb(229 231 235)', borderRadius: '9999px', height: '0.5rem' }}>
                    <div
style={{ height: '0.5rem', borderRadius: '9999px', transition: 'all 300ms ease', ...getPasswordStrengthColor() }}
                      style={{
                        width: `${(passwordStrength.score / 4) * 100}%`,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.75rem', lineHeight: '1rem', color: 'rgb(75 85 99)' }}>
                    {getPasswordStrengthText()}
                  </span>
                </div>
                {passwordStrength.feedback.length > 0 && (
                  <ul style={{ fontSize: '0.75rem', lineHeight: '1rem', color: 'rgb(75 85 99)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {passwordStrength.feedback.map((item, index) => (
                      <li key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <X style={{ width: '0.75rem', height: '0.75rem', color: 'rgb(248 113 113)' }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {validationErrors.password && (
              <p style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'rgb(239 68 68)' }}>
                {validationErrors.password}
              </p>
            )}
          </div>

          {/* 비밀번호 확인 필드 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="confirmPassword" style={{ fontSize: '0.875rem', lineHeight: '1.25rem', fontWeight: '500' }}>
              비밀번호 확인
            </label>
            <div style={{ position: 'relative' }}>
              <Lock style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: 'rgb(156 163 175)' }} />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="비밀번호를 다시 입력하세요"
                value={formData.confirmPassword}
                onChange={(e) =>
                  handleInputChange("confirmPassword", e.target.value)
                }
                style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem', ...(validationErrors.confirmPassword && { borderColor: 'rgb(239 68 68)' }) }}
                disabled={isLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'rgb(156 163 175)', border: 'none', background: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(75 85 99)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(156 163 175)'}
                disabled={isLoading}
              >
                {showConfirmPassword ? (
                  <EyeOff style={{ width: '1rem', height: '1rem' }} />
                ) : (
                  <Eye style={{ width: '1rem', height: '1rem' }} />
                )}
              </button>
            </div>

            {/* 비밀번호 일치 표시 */}
            {formData.confirmPassword && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', lineHeight: '1rem' }}>
                {formData.password === formData.confirmPassword ? (
                  <>
                    <Check style={{ width: '0.75rem', height: '0.75rem', color: 'rgb(34 197 94)' }} />
                    <span style={{ color: 'rgb(22 163 74)' }}>
                      비밀번호가 일치합니다
                    </span>
                  </>
                ) : (
                  <>
                    <X style={{ width: '0.75rem', height: '0.75rem', color: 'rgb(239 68 68)' }} />
                    <span style={{ color: 'rgb(220 38 38)' }}>
                      비밀번호가 일치하지 않습니다
                    </span>
                  </>
                )}
              </div>
            )}

            {validationErrors.confirmPassword && (
              <p style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'rgb(239 68 68)' }}>
                {validationErrors.confirmPassword}
              </p>
            )}
          </div>

          {/* 약관 동의 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <input
                id="agreeToTerms"
                type="checkbox"
                checked={formData.agreeToTerms}
                onChange={(e) =>
                  handleInputChange("agreeToTerms", e.target.checked)
                }
style={{ marginTop: '0.25rem', width: '1rem', height: '1rem', accentColor: 'rgb(37 99 235)', border: '1px solid rgb(209 213 219)', borderRadius: '0.25rem' }}
                disabled={isLoading}
              />
              <label htmlFor="agreeToTerms" style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'rgb(55 65 81)' }}>
                <span style={{ color: 'rgb(239 68 68)' }}>*</span> 서비스 이용약관에
                동의합니다{" "}
                <button
                  type="button"
style={{ color: 'rgb(59 130 246)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(29 78 216)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(59 130 246)'}
                >
                  (보기)
                </button>
              </label>
            </div>
            {validationErrors.agreeToTerms && (
              <p style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'rgb(239 68 68)', marginLeft: '1.5rem' }}>
                {validationErrors.agreeToTerms}
              </p>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <input
                id="agreeToPrivacy"
                type="checkbox"
                checked={formData.agreeToPrivacy}
                onChange={(e) =>
                  handleInputChange("agreeToPrivacy", e.target.checked)
                }
style={{ marginTop: '0.25rem', width: '1rem', height: '1rem', accentColor: 'rgb(37 99 235)', border: '1px solid rgb(209 213 219)', borderRadius: '0.25rem' }}
                disabled={isLoading}
              />
              <label htmlFor="agreeToPrivacy" style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'rgb(55 65 81)' }}>
                <span style={{ color: 'rgb(239 68 68)' }}>*</span> 개인정보 처리방침에
                동의합니다{" "}
                <button
                  type="button"
style={{ color: 'rgb(59 130 246)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(29 78 216)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(59 130 246)'}
                >
                  (보기)
                </button>
              </label>
            </div>
            {validationErrors.agreeToPrivacy && (
              <p style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'rgb(239 68 68)', marginLeft: '1.5rem' }}>
                {validationErrors.agreeToPrivacy}
              </p>
            )}
          </div>

          {/* 제출 버튼 */}
          <Button type="submit" style={{ width: '100%' }} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 style={{ marginRight: '0.5rem', height: '1rem', width: '1rem', animation: 'spin 1s linear infinite' }} />
                계정 생성 중...
              </>
            ) : (
              "회원가입"
            )}
          </Button>

          {/* 로그인 링크 */}
          <div style={{ textAlign: 'center', paddingTop: '1rem', borderTop: '1px solid rgb(229 231 235)' }}>
            <p style={{ fontSize: '0.875rem', lineHeight: '1.25rem', color: 'rgb(75 85 99)' }}>
              이미 계정이 있으신가요?{" "}
              <button
                type="button"
                onClick={onSwitchToLogin}
style={{ color: 'rgb(59 130 246)', textDecoration: 'underline', fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'rgb(29 78 216)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgb(59 130 246)'}
                disabled={isLoading}
              >
                로그인
              </button>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
    </>
  );
}
