import * as React from "react";

/**
 * Linear Design System Card 컴포넌트
 * 글래스모피즘 효과를 포함한 재사용 가능한 카드 컴포넌트
 */

type LinearCardVariant = "default" | "elevated" | "glass" | "solid" | "ghost";
type LinearCardPadding = "none" | "sm" | "default" | "lg";

interface LinearCardVariantProps {
  variant?: LinearCardVariant;
  padding?: LinearCardPadding;
  interactive?: boolean;
}

const getCardStyles = (variant: LinearCardVariant = "default", padding: LinearCardPadding = "default", interactive: boolean = false): React.CSSProperties => {
  const baseStyles: React.CSSProperties = {
    borderRadius: '0.75rem',
    backdropFilter: 'blur(20px)',
    transition: 'all 300ms ease',
  };

  // Variant styles
  const variantStyles: Record<LinearCardVariant, React.CSSProperties> = {
    default: {
      backgroundColor: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    },
    elevated: {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    },
    glass: {
      background: 'linear-gradient(to bottom right, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02), transparent)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
    },
    solid: {
      backgroundColor: '#252830',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    },
    ghost: {
      backgroundColor: 'transparent',
      border: '1px solid rgba(255, 255, 255, 0.05)',
    },
  };

  // Padding styles
  const paddingStyles: Record<LinearCardPadding, React.CSSProperties> = {
    none: {},
    sm: { padding: '1rem' },
    default: { padding: '1.5rem' },
    lg: { padding: '2rem' },
  };

  // Interactive styles
  const interactiveStyles: React.CSSProperties = interactive ? {
    cursor: 'pointer',
  } : {};

  return {
    ...baseStyles,
    ...variantStyles[variant],
    ...paddingStyles[padding],
    ...interactiveStyles,
  };
};

export interface LinearCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    LinearCardVariantProps {}

const LinearCard = React.forwardRef<HTMLDivElement, LinearCardProps>(
  ({ variant = "default", padding = "default", interactive = false, style, onMouseEnter, onMouseLeave, ...props }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false);

    const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
      if (interactive) {
        setIsHovered(true);
        e.currentTarget.style.transform = 'translateY(-0.25rem)';
        e.currentTarget.style.boxShadow = '0 12px 40px 0 rgba(0, 0, 0, 0.5)';
      }
      if (variant === "elevated") {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
      }
      if (variant === "ghost") {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
      }
      onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      if (interactive) {
        setIsHovered(false);
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = getCardStyles(variant).boxShadow || '';
      }
      if (variant === "elevated") {
        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
      }
      if (variant === "ghost") {
        e.currentTarget.style.backgroundColor = 'transparent';
      }
      onMouseLeave?.(e);
    };

    return (
      <div
        ref={ref}
        style={{
          ...getCardStyles(variant, padding, interactive),
          ...style
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      />
    );
  }
);

LinearCard.displayName = "LinearCard";

const LinearCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ style, ...props }, ref) => (
  <div
    ref={ref}
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.375rem',
      ...style
    }}
    {...props}
  />
));
LinearCardHeader.displayName = "LinearCardHeader";

const LinearCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ style, children, ...props }, ref) => (
  <h3
    ref={ref}
    style={{
      fontSize: '1.25rem',
      fontWeight: '600',
      lineHeight: '1',
      letterSpacing: '-0.025em',
      color: '#f7f8f8',
      ...style
    }}
    {...props}
  >
    {children}
  </h3>
));
LinearCardTitle.displayName = "LinearCardTitle";

const LinearCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ style, ...props }, ref) => (
  <p
    ref={ref}
    style={{
      fontSize: '0.875rem',
      color: 'rgba(255, 255, 255, 0.7)',
      ...style
    }}
    {...props}
  />
));
LinearCardDescription.displayName = "LinearCardDescription";

const LinearCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ style, ...props }, ref) => (
  <div 
    ref={ref} 
    style={{
      paddingTop: '0',
      ...style
    }}
    {...props} 
  />
));
LinearCardContent.displayName = "LinearCardContent";

const LinearCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ style, ...props }, ref) => (
  <div
    ref={ref}
    style={{
      display: 'flex',
      alignItems: 'center',
      paddingTop: '1.5rem',
      ...style
    }}
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
};