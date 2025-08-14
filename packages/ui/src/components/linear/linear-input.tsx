import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Linear Design System Input 컴포넌트
 * 다양한 상태와 스타일을 지원하는 입력 컴포넌트
 */

const linearInputVariants = cva(
  "flex w-full rounded-lg border px-4 py-3 text-sm transition-all duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-white/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: 
          "bg-white/[0.05] border-white/[0.1] text-[#f7f8f8] focus:border-[#e6e6e6] focus:bg-white/[0.1] focus:ring-[3px] focus:ring-[#e6e6e6]/10",
        ghost: 
          "bg-transparent border-white/[0.05] text-[#f7f8f8] focus:border-white/[0.2] focus:bg-white/[0.02]",
        solid:
          "bg-[#252830] border-white/[0.1] text-[#f7f8f8] focus:border-[#e6e6e6] focus:ring-[3px] focus:ring-[#e6e6e6]/10",
      },
      state: {
        default: "",
        error: "border-[#ef4444] focus:border-[#ef4444] focus:ring-[#ef4444]/20",
        success: "border-[#10b981] focus:border-[#10b981] focus:ring-[#10b981]/20",
        warning: "border-[#f59e0b] focus:border-[#f59e0b] focus:ring-[#f59e0b]/20",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-4 text-sm",
        lg: "h-12 px-4 text-base",
      }
    },
    defaultVariants: {
      variant: "default",
      state: "default",
      size: "default",
    },
  }
);

export interface LinearInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof linearInputVariants> {
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

const LinearInput = React.forwardRef<HTMLInputElement, LinearInputProps>(
  ({ 
    className, 
    variant, 
    state, 
    size: inputSize,
    label,
    helperText,
    errorMessage,
    startIcon,
    endIcon,
    ...props 
  }, ref) => {
    // 에러가 있으면 state를 error로 설정
    const inputState = errorMessage ? "error" : state;

    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-[#f7f8f8]">
            {label}
          </label>
        )}
        
        <div className="relative">
          {startIcon && (
            <div className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50">
              {startIcon}
            </div>
          )}
          
          <input
            className={cn(
              linearInputVariants({ variant, state: inputState, size: inputSize }),
              startIcon && "pl-10",
              endIcon && "pr-10",
              className
            )}
            ref={ref}
            {...props}
          />
          
          {endIcon && (
            <div className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50">
              {endIcon}
            </div>
          )}
        </div>
        
        {(helperText || errorMessage) && (
          <p className={cn(
            "text-xs",
            errorMessage 
              ? "text-[#ef4444]" 
              : "text-white/50"
          )}>
            {errorMessage || helperText}
          </p>
        )}
      </div>
    );
  }
);

LinearInput.displayName = "LinearInput";

export { LinearInput, linearInputVariants };