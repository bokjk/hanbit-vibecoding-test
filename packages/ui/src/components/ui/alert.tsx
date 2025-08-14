import * as React from "react";

const getAlertStyles = (variant?: "default" | "destructive"): React.CSSProperties => {
  const baseStyles: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    borderRadius: '0.5rem',
    border: '1px solid #e5e7eb',
    paddingLeft: '1rem',
    paddingRight: '1rem',
    paddingTop: '0.75rem',
    paddingBottom: '0.75rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem'
  };

  if (variant === "destructive") {
    return {
      ...baseStyles,
      borderColor: '#fecaca',
      color: '#991b1b',
      backgroundColor: '#fef2f2'
    };
  }

  return {
    ...baseStyles,
    backgroundColor: 'white',
    color: '#111827'
  };
};

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive";
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ style, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      style={{
        ...getAlertStyles(variant),
        ...style
      }}
      {...props}
    />
  )
)
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ style, ...props }, ref) => (
  <h5
    ref={ref}
    style={{
      marginBottom: '0.25rem',
      fontWeight: '500',
      lineHeight: '1',
      letterSpacing: '-0.025em',
      ...style
    }}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ style, children, ...props }, ref) => (
  <div
    ref={ref}
    style={{
      fontSize: '0.875rem',
      lineHeight: '1.25rem',
      ...style
    }}
    {...props}
  >
    <style>
      {`
        .alert-description p {
          line-height: 1.625;
        }
      `}
    </style>
    <div className="alert-description">
      {children}
    </div>
  </div>
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
