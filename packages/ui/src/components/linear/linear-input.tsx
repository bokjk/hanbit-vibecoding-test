import * as React from "react";

/**
 * Linear Design System Input 컴포넌트
 * 다양한 상태와 스타일을 지원하는 입력 컴포넌트
 */

type LinearInputVariant = "default" | "ghost" | "solid";
type LinearInputState = "default" | "error" | "success" | "warning";
type LinearInputSize = "sm" | "default" | "lg";

export interface LinearInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /**
   * 입력 필드 변형
   */
  variant?: LinearInputVariant;
  /**
   * 입력 필드 상태
   */
  state?: LinearInputState;
  /**
   * 입력 필드 크기
   */
  size?: LinearInputSize;
  /**
   * 입력 필드 라벨
   */
  label?: string;
  /**
   * 도움말 텍스트
   */
  helperText?: string;
  /**
   * 에러 메시지
   */
  errorMessage?: string;
  /**
   * 앞쪽 아이콘
   */
  startIcon?: React.ReactNode;
  /**
   * 뒤쪽 아이콘
   */
  endIcon?: React.ReactNode;
}

const getInputStyles = (
  variant: LinearInputVariant = "default",
  state: LinearInputState = "default",
  size: LinearInputSize = "default",
  hasStartIcon: boolean = false,
  hasEndIcon: boolean = false
): React.CSSProperties => {
  const baseStyles: React.CSSProperties = {
    display: 'flex',
    width: '100%',
    borderRadius: '0.5rem',
    border: '1px solid',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    transition: 'all 150ms ease',
    outline: 'none',
    ...(hasStartIcon && { paddingLeft: '2.5rem' }),
    ...(hasEndIcon && { paddingRight: '2.5rem' })
  };

  // Variant styles
  const variantStyles: Record<LinearInputVariant, React.CSSProperties> = {
    default: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      color: '#f7f8f8'
    },
    ghost: {
      backgroundColor: 'transparent',
      borderColor: 'rgba(255, 255, 255, 0.05)',
      color: '#f7f8f8'
    },
    solid: {
      backgroundColor: '#252830',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      color: '#f7f8f8'
    }
  };

  // State styles
  const stateStyles: Record<LinearInputState, React.CSSProperties> = {
    default: {},
    error: {
      borderColor: '#ef4444'
    },
    success: {
      borderColor: '#10b981'
    },
    warning: {
      borderColor: '#f59e0b'
    }
  };

  // Size styles
  const sizeStyles: Record<LinearInputSize, React.CSSProperties> = {
    sm: { height: '2rem', paddingLeft: '0.75rem', paddingRight: '0.75rem', fontSize: '0.75rem', lineHeight: '1rem' },
    default: { height: '2.5rem', paddingLeft: '1rem', paddingRight: '1rem', fontSize: '0.875rem', lineHeight: '1.25rem' },
    lg: { height: '3rem', paddingLeft: '1rem', paddingRight: '1rem', fontSize: '1rem', lineHeight: '1.5rem' }
  };

  return {
    ...baseStyles,
    ...variantStyles[variant],
    ...stateStyles[state],
    ...sizeStyles[size]
  };
};

const LinearInput = React.forwardRef<HTMLInputElement, LinearInputProps>(
  ({ 
    variant = "default",
    state = "default",
    size = "default",
    label,
    helperText,
    errorMessage,
    startIcon,
    endIcon,
    style,
    onFocus,
    onBlur,
    ...props 
  }, ref) => {
    // 에러가 있으면 state를 error로 설정
    const inputState = errorMessage ? "error" : state;

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      const focusStyles: Record<LinearInputVariant, Partial<React.CSSProperties>> = {
        default: { 
          borderColor: '#e6e6e6', 
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          boxShadow: '0 0 0 3px rgba(230, 230, 230, 0.1)'
        },
        ghost: { 
          borderColor: 'rgba(255, 255, 255, 0.2)', 
          backgroundColor: 'rgba(255, 255, 255, 0.02)'
        },
        solid: { 
          borderColor: '#e6e6e6',
          boxShadow: '0 0 0 3px rgba(230, 230, 230, 0.1)'
        }
      };

      const stateFocusStyles: Record<LinearInputState, Partial<React.CSSProperties>> = {
        default: {},
        error: { borderColor: '#ef4444', boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.2)' },
        success: { borderColor: '#10b981', boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)' },
        warning: { borderColor: '#f59e0b', boxShadow: '0 0 0 3px rgba(245, 158, 11, 0.2)' }
      };

      Object.assign(e.currentTarget.style, focusStyles[variant], stateFocusStyles[inputState]);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const originalStyles = getInputStyles(variant, inputState, size, !!startIcon, !!endIcon);
      Object.assign(e.currentTarget.style, originalStyles);
      onBlur?.(e);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {label && (
          <label style={{ 
            display: 'block', 
            fontSize: '0.875rem', 
            lineHeight: '1.25rem', 
            fontWeight: '500', 
            color: '#f7f8f8' 
          }}>
            {label}
          </label>
        )}
        
        <div style={{ position: 'relative' }}>
          {startIcon && (
            <div style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              height: '1rem',
              width: '1rem',
              transform: 'translateY(-50%)',
              color: 'rgba(255, 255, 255, 0.5)'
            }}>
              {startIcon}
            </div>
          )}
          
          <input
            ref={ref}
            style={{
              ...getInputStyles(variant, inputState, size, !!startIcon, !!endIcon),
              ...style
            }}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...props}
          />
          
          {endIcon && (
            <div style={{
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              height: '1rem',
              width: '1rem',
              transform: 'translateY(-50%)',
              color: 'rgba(255, 255, 255, 0.5)'
            }}>
              {endIcon}
            </div>
          )}
        </div>
        
        {(helperText || errorMessage) && (
          <p style={{
            fontSize: '0.75rem',
            lineHeight: '1rem',
            color: errorMessage ? '#ef4444' : 'rgba(255, 255, 255, 0.5)'
          }}>
            {errorMessage || helperText}
          </p>
        )}
      </div>
    );
  }
);

LinearInput.displayName = "LinearInput";

export { LinearInput };