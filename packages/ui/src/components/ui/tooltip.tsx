"use client"

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "../../lib/utils";

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  style,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        style={{
          backgroundColor: 'var(--primary)',
          color: 'var(--primary-foreground)',
          zIndex: 50,
          width: 'fit-content',
          borderRadius: '0.375rem',
          paddingLeft: '0.75rem',
          paddingRight: '0.75rem',
          paddingTop: '0.375rem',
          paddingBottom: '0.375rem',
          fontSize: '0.75rem',
          lineHeight: '1rem',
          textWrap: 'balance',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          ...style
        }}
        className={className}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow 
          style={{
            backgroundColor: 'var(--primary)',
            fill: 'var(--primary)',
            zIndex: 50,
            width: '0.625rem',
            height: '0.625rem',
            transform: 'translateY(calc(-50% - 2px)) rotate(45deg)',
            borderRadius: '2px'
          }}
        />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }