import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Linear Design System Button 컴포넌트
 * 재사용 가능하고 일관된 스타일을 제공하는 버튼 컴포넌트
 */

const linearButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 ease-smooth disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        primary: 
          "bg-[#e6e6e6] text-[#08090a] border border-[#e6e6e6] hover:bg-[#d4d4d4] hover:-translate-y-px focus-visible:ring-[#e6e6e6]/20",
        secondary: 
          "bg-transparent text-[#8a8f98] border border-white/10 hover:bg-white/5 hover:text-[#f7f8f8] focus-visible:ring-white/20",
        ghost: 
          "bg-transparent text-[#8a8f98] border-none hover:bg-white/5 hover:text-[#f7f8f8] focus-visible:ring-white/20",
        success:
          "bg-[#10b981] text-white border border-[#10b981] hover:bg-[#059669] focus-visible:ring-[#10b981]/20",
        error:
          "bg-[#ef4444] text-white border border-[#ef4444] hover:bg-[#dc2626] focus-visible:ring-[#ef4444]/20",
        warning:
          "bg-[#f59e0b] text-white border border-[#f59e0b] hover:bg-[#d97706] focus-visible:ring-[#f59e0b]/20",
        info:
          "bg-[#3b82f6] text-white border border-[#3b82f6] hover:bg-[#2563eb] focus-visible:ring-[#3b82f6]/20",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-9 px-4 text-sm",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
      fullWidth: false,
    },
  }
);

export interface LinearButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof linearButtonVariants> {
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

const LinearButton = React.forwardRef<HTMLButtonElement, LinearButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    fullWidth,
    loading = false,
    icon,
    iconPosition = "left",
    children, 
    disabled,
    ...props 
  }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <button
        className={cn(linearButtonVariants({ variant, size, fullWidth, className }))}
        ref={ref}
        disabled={isDisabled}
        {...props}
      >
        {loading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {!loading && icon && iconPosition === "left" && (
          <span className="h-4 w-4 flex items-center justify-center">{icon}</span>
        )}
        {children}
        {!loading && icon && iconPosition === "right" && (
          <span className="h-4 w-4 flex items-center justify-center">{icon}</span>
        )}
      </button>
    );
  }
);

LinearButton.displayName = "LinearButton";

export { LinearButton, linearButtonVariants };