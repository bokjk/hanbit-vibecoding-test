"use client"

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { cn } from "../../lib/utils";

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = "default",
  children,
  style,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  const triggerStyle: React.CSSProperties = {
    border: '1px solid var(--input)',
    color: 'var(--foreground)',
    display: 'flex',
    width: 'fit-content',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    borderRadius: '0.375rem',
    backgroundColor: 'transparent',
    paddingLeft: '0.75rem',
    paddingRight: '0.75rem',
    paddingTop: '0.5rem',
    paddingBottom: '0.5rem',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    whiteSpace: 'nowrap',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    transition: 'color 150ms ease, box-shadow 150ms ease',
    outline: 'none',
    cursor: 'pointer',
    height: size === 'sm' ? '2rem' : '2.25rem',
    ...(props.disabled && {
      cursor: 'not-allowed',
      opacity: 0.5
    }),
    ...style
  };

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      style={triggerStyle}
      className={className}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon style={{ width: '1rem', height: '1rem', opacity: 0.5 }} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = "popper",
  style,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        style={{
          backgroundColor: 'var(--popover)',
          color: 'var(--popover-foreground)',
          position: 'relative',
          zIndex: 50,
          maxHeight: 'var(--radix-select-content-available-height)',
          minWidth: '8rem',
          overflowX: 'hidden',
          overflowY: 'auto',
          borderRadius: '0.375rem',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          ...(position === "popper" && {
            transform: 'translateY(1px)'
          }),
          ...style
        }}
        position={position}
        className={className}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          style={{
            padding: '0.25rem',
            ...(position === "popper" && {
              height: 'var(--radix-select-trigger-height)',
              width: '100%',
              minWidth: 'var(--radix-select-trigger-width)',
              scrollMarginTop: '0.25rem',
              scrollMarginBottom: '0.25rem'
            })
          }}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  style,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      style={{
        color: 'var(--muted-foreground)',
        paddingLeft: '0.5rem',
        paddingRight: '0.5rem',
        paddingTop: '0.375rem',
        paddingBottom: '0.375rem',
        fontSize: '0.75rem',
        lineHeight: '1rem',
        ...style
      }}
      className={className}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  style,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      style={{
        position: 'relative',
        display: 'flex',
        width: '100%',
        cursor: 'default',
        alignItems: 'center',
        gap: '0.5rem',
        borderRadius: '0.125rem',
        paddingTop: '0.375rem',
        paddingBottom: '0.375rem',
        paddingRight: '2rem',
        paddingLeft: '0.5rem',
        fontSize: '0.875rem',
        lineHeight: '1.25rem',
        outline: 'none',
        userSelect: 'none',
        transition: 'background-color 150ms ease, color 150ms ease',
        ...(props.disabled && {
          pointerEvents: 'none',
          opacity: 0.5
        }),
        ...style
      }}
      className={className}
      {...props}
    >
      <span style={{
        position: 'absolute',
        right: '0.5rem',
        display: 'flex',
        width: '0.875rem',
        height: '0.875rem',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <SelectPrimitive.ItemIndicator>
          <CheckIcon style={{ width: '1rem', height: '1rem' }} />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  style,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      style={{
        backgroundColor: 'var(--border)',
        pointerEvents: 'none',
        marginLeft: '-0.25rem',
        marginRight: '-0.25rem',
        marginTop: '0.25rem',
        marginBottom: '0.25rem',
        height: '1px',
        ...style
      }}
      className={className}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  style,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      style={{
        display: 'flex',
        cursor: 'default',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: '0.25rem',
        paddingBottom: '0.25rem',
        ...style
      }}
      className={className}
      {...props}
    >
      <ChevronUpIcon style={{ width: '1rem', height: '1rem' }} />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  style,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      style={{
        display: 'flex',
        cursor: 'default',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: '0.25rem',
        paddingBottom: '0.25rem',
        ...style
      }}
      className={className}
      {...props}
    >
      <ChevronDownIcon style={{ width: '1rem', height: '1rem' }} />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}