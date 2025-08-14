import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, style, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    style={{
      height: '1.25rem',
      width: '1.25rem',
      flexShrink: 0,
      borderRadius: '0.25rem',
      border: '2px solid #6b7280',
      backgroundColor: 'white',
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      outline: 'none',
      cursor: props.disabled ? 'not-allowed' : 'pointer',
      opacity: props.disabled ? 0.5 : 1,
      transition: 'all 200ms ease',
      ...style
    }}
    className={className}
    onMouseEnter={(e) => {
      if (!props.disabled) {
        e.currentTarget.style.borderColor = '#4b5563';
        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
      }
    }}
    onMouseLeave={(e) => {
      if (!props.disabled) {
        e.currentTarget.style.borderColor = '#6b7280';
        e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
      }
    }}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'currentColor'
      }}
    >
      <Check style={{ height: '1rem', width: '1rem', strokeWidth: 3 }} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }