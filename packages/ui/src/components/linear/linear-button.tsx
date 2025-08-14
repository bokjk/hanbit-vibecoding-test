import * as React from "react";

/**
 * Linear Design System Button 컴포넌트
 * 재사용 가능하고 일관된 스타일을 제공하는 버튼 컴포넌트
 */

type LinearButtonVariant = "primary" | "secondary" | "ghost" | "success" | "error" | "warning" | "info";
type LinearButtonSize = "sm" | "default" | "lg" | "icon";

export interface LinearButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * 버튼 스타일 변형
   */
  variant?: LinearButtonVariant;
  /**
   * 버튼 크기
   */
  size?: LinearButtonSize;
  /**
   * 전체 너비 사용 여부
   */
  fullWidth?: boolean;
  /**
   * 로딩 상태 표시
   */
  loading?: boolean;
  /**
   * 아이콘 (React 노드)
   */
  icon?: React.ReactNode;
  /**
   * 아이콘 위치
   */
  iconPosition?: "left" | "right";
}

const getButtonStyles = (
  variant: LinearButtonVariant = "primary",
  size: LinearButtonSize = "default",
  fullWidth: boolean = false,
  disabled: boolean = false,
  loading: boolean = false
): React.CSSProperties => {
  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    whiteSpace: 'nowrap',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontWeight: '500',
    transition: 'all 150ms ease',
    outline: 'none',
    border: '1px solid transparent',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    opacity: disabled || loading ? 0.5 : 1,
    ...(fullWidth && { width: '100%' })
  };

  // Variant styles
  const variantStyles: Record<LinearButtonVariant, React.CSSProperties> = {
    primary: {
      backgroundColor: '#e6e6e6',
      color: '#08090a',
      borderColor: '#e6e6e6'
    },
    secondary: {
      backgroundColor: 'transparent',
      color: '#8a8f98',
      borderColor: 'rgba(255, 255, 255, 0.1)'
    },
    ghost: {
      backgroundColor: 'transparent',
      color: '#8a8f98',
      borderColor: 'transparent'
    },
    success: {
      backgroundColor: '#10b981',
      color: 'white',
      borderColor: '#10b981'
    },
    error: {
      backgroundColor: '#ef4444',
      color: 'white',
      borderColor: '#ef4444'
    },
    warning: {
      backgroundColor: '#f59e0b',
      color: 'white',
      borderColor: '#f59e0b'
    },
    info: {
      backgroundColor: '#3b82f6',
      color: 'white',
      borderColor: '#3b82f6'
    }
  };

  // Size styles
  const sizeStyles: Record<LinearButtonSize, React.CSSProperties> = {
    sm: { height: '2rem', paddingLeft: '0.75rem', paddingRight: '0.75rem', fontSize: '0.75rem', lineHeight: '1rem' },
    default: { height: '2.25rem', paddingLeft: '1rem', paddingRight: '1rem', fontSize: '0.875rem', lineHeight: '1.25rem' },
    lg: { height: '2.75rem', paddingLeft: '1.5rem', paddingRight: '1.5rem', fontSize: '1rem', lineHeight: '1.5rem' },
    icon: { height: '2.25rem', width: '2.25rem', padding: 0 }
  };

  return {
    ...baseStyles,
    ...variantStyles[variant],
    ...sizeStyles[size]
  };
};

const LinearButton = React.forwardRef<HTMLButtonElement, LinearButtonProps>(
  ({ 
    variant = "primary",
    size = "default",
    fullWidth = false,
    loading = false,
    icon,
    iconPosition = "left",
    children, 
    disabled = false,
    style,
    onMouseEnter,
    onMouseLeave,
    ...props 
  }, ref) => {
    const isDisabled = disabled || loading;

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isDisabled) {
        const hoverStyles: Record<LinearButtonVariant, Partial<React.CSSProperties>> = {
          primary: { backgroundColor: '#d4d4d4', transform: 'translateY(-1px)' },
          secondary: { backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#f7f8f8' },
          ghost: { backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#f7f8f8' },
          success: { backgroundColor: '#059669' },
          error: { backgroundColor: '#dc2626' },
          warning: { backgroundColor: '#d97706' },
          info: { backgroundColor: '#2563eb' }
        };
        Object.assign(e.currentTarget.style, hoverStyles[variant]);
      }
      onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isDisabled) {
        const originalStyles = getButtonStyles(variant, size, fullWidth, disabled, loading);
        Object.assign(e.currentTarget.style, originalStyles);
      }
      onMouseLeave?.(e);
    };

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        style={{
          ...getButtonStyles(variant, size, fullWidth, disabled, loading),
          ...style
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {loading && (
          <div style={{
            height: '1rem',
            width: '1rem',
            borderRadius: '50%',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            animation: 'spin 1s linear infinite'
          }} />
        )}
        {!loading && icon && iconPosition === "left" && (
          <span style={{ height: '1rem', width: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </span>
        )}
        {children}
        {!loading && icon && iconPosition === "right" && (
          <span style={{ height: '1rem', width: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </span>
        )}
      </button>
    );
  }
);

LinearButton.displayName = "LinearButton";

export { LinearButton };