import * as React from "react";

import { cn } from "../../lib/utils";

function Card({ style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      style={{
        backgroundColor: 'var(--card)',
        color: 'var(--card-foreground)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        borderRadius: '0.75rem',
        border: '1px solid var(--border)',
        paddingTop: '1.5rem',
        paddingBottom: '1.5rem',
        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        ...style
      }}
      {...props}
    />
  )
}

function CardHeader({ style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      style={{
        display: 'grid',
        gridAutoRows: 'min-content',
        gridTemplateRows: 'auto auto',
        alignItems: 'start',
        gap: '0.375rem',
        paddingLeft: '1.5rem',
        paddingRight: '1.5rem',
        ...style
      }}
      {...props}
    />
  )
}

function CardTitle({ style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      style={{
        lineHeight: '1',
        fontWeight: '600',
        ...style
      }}
      {...props}
    />
  )
}

function CardDescription({ style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      style={{
        color: 'var(--muted-foreground)',
        fontSize: '0.875rem',
        lineHeight: '1.25rem',
        ...style
      }}
      {...props}
    />
  )
}

function CardAction({ style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      style={{
        gridColumnStart: 2,
        gridRowSpan: 2,
        gridRowStart: 1,
        alignSelf: 'start',
        justifySelf: 'end',
        ...style
      }}
      {...props}
    />
  )
}

function CardContent({ style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      style={{
        paddingLeft: '1.5rem',
        paddingRight: '1.5rem',
        ...style
      }}
      {...props}
    />
  )
}

function CardFooter({ style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      style={{
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '1.5rem',
        paddingRight: '1.5rem',
        ...style
      }}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}