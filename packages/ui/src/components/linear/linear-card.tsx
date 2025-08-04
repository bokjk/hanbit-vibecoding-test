import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Linear Design System Card 컴포넌트
 * 글래스모피즘 효과를 포함한 재사용 가능한 카드 컴포넌트
 */

const linearCardVariants = cva(
  "rounded-xl backdrop-blur-[20px] transition-all duration-300",
  {
    variants: {
      variant: {
        default: 
          "bg-white/[0.02] border border-white/[0.05] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]",
        elevated: 
          "bg-white/[0.05] border border-white/[0.1] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:bg-white/[0.08]",
        glass: 
          "bg-gradient-to-br from-white/[0.08] via-white/[0.02] to-transparent border border-white/[0.05] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]",
        solid:
          "bg-[#252830] border border-white/[0.1] shadow-lg",
        ghost:
          "bg-transparent border border-white/[0.05] hover:bg-white/[0.02]",
      },
      padding: {
        none: "",
        sm: "p-4",
        default: "p-6",
        lg: "p-8",
      },
      interactive: {
        true: "cursor-pointer hover:-translate-y-1 hover:shadow-[0_12px_40px_0_rgba(0,0,0,0.5)]",
        false: "",
      }
    },
    defaultVariants: {
      variant: "default",
      padding: "default",
      interactive: false,
    },
  }
);

export interface LinearCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof linearCardVariants> {}

const LinearCard = React.forwardRef<HTMLDivElement, LinearCardProps>(
  ({ className, variant, padding, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(linearCardVariants({ variant, padding, interactive, className }))}
      {...props}
    />
  )
);

LinearCard.displayName = "LinearCard";

const LinearCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5", className)}
    {...props}
  />
));
LinearCardHeader.displayName = "LinearCardHeader";

const LinearCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-semibold leading-none tracking-tight text-[#f7f8f8]",
      className
    )}
    {...props}
  >
    {children}
  </h3>
));
LinearCardTitle.displayName = "LinearCardTitle";

const LinearCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-white/70", className)}
    {...props}
  />
));
LinearCardDescription.displayName = "LinearCardDescription";

const LinearCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div 
    ref={ref} 
    className={cn("pt-0", className)} 
    {...props} 
  />
));
LinearCardContent.displayName = "LinearCardContent";

const LinearCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center pt-6", className)}
    {...props}
  />
));
LinearCardFooter.displayName = "LinearCardFooter";

export {
  LinearCard,
  LinearCardHeader,
  LinearCardFooter,
  LinearCardTitle,
  LinearCardDescription,
  LinearCardContent,
  linearCardVariants,
};