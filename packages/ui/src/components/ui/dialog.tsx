import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { cn } from "../../lib/utils";

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  style,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        ...style
      }}
      className={className}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  style,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        style={{
          backgroundColor: 'var(--background)',
          position: 'fixed',
          top: '50%',
          left: '50%',
          zIndex: 50,
          display: 'grid',
          width: '100%',
          maxWidth: 'calc(100% - 2rem)',
          transform: 'translate(-50%, -50%)',
          gap: '1rem',
          borderRadius: '0.5rem',
          border: '1px solid var(--border)',
          padding: '1.5rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          transitionDuration: '200ms',
          ...style,
          '@media (min-width: 640px)': {
            maxWidth: '32rem'
          }
        }}
        className={className}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              borderRadius: '0.125rem',
              opacity: 0.7,
              transition: 'opacity 150ms ease',
              cursor: 'pointer',
              outline: 'none',
              border: 'none',
              background: 'transparent',
              padding: '0.25rem',
              color: 'var(--muted-foreground)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
          >
            <XIcon style={{ width: '1rem', height: '1rem' }} />
            <span style={{ 
              position: 'absolute',
              width: '1px',
              height: '1px',
              padding: 0,
              margin: '-1px',
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              border: 0
            }}>Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        textAlign: 'center',
        ...style,
        '@media (min-width: 640px)': {
          textAlign: 'left'
        }
      }}
      className={className}
      {...props}
    />
  )
}

function DialogFooter({ className, style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      style={{
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '0.5rem',
        ...style,
        '@media (min-width: 640px)': {
          flexDirection: 'row',
          justifyContent: 'flex-end'
        }
      }}
      className={className}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  style,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      style={{
        fontSize: '1.125rem',
        lineHeight: '1',
        fontWeight: '600',
        ...style
      }}
      className={className}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  style,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      style={{
        color: 'var(--muted-foreground)',
        fontSize: '0.875rem',
        lineHeight: '1.25rem',
        ...style
      }}
      className={className}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}