/**
 * Linear Design System Theme
 * Linear.app에서 영감을 받은 디자인 시스템
 */

export const linearTheme = {
  colors: {
    primary: {
      50: "#f7f8f8",
      100: "#e6e6e6",
      200: "#d4d4d4",
      300: "#b3b3b3",
      400: "#8a8f98",
      500: "#616a73",
      600: "#4a5259",
      700: "#3a3f47",
      800: "#2d2d2d",
      900: "#1a1a1a",
      950: "#08090a"
    },
    background: {
      primary: "#08090a",
      secondary: "#0f1114",
      tertiary: "#1a1d21",
      elevated: "#252830",
      surface: "#2d3139"
    },
    text: {
      primary: "#f7f8f8",
      secondary: "rgba(255, 255, 255, 0.7)",
      tertiary: "rgba(255, 255, 255, 0.5)",
      muted: "#8a8f98",
      inverse: "#08090a"
    },
    border: {
      primary: "rgba(255, 255, 255, 0.1)",
      secondary: "rgba(255, 255, 255, 0.05)",
      focus: "#e6e6e6",
      muted: "rgba(97, 106, 115, 0.2)"
    },
    semantic: {
      success: {
        main: "#10b981",
        light: "#34d399",
        dark: "#059669"
      },
      warning: {
        main: "#f59e0b",
        light: "#fbbf24",
        dark: "#d97706"
      },
      error: {
        main: "#ef4444",
        light: "#f87171",
        dark: "#dc2626"
      },
      info: {
        main: "#3b82f6",
        light: "#60a5fa",
        dark: "#2563eb"
      }
    },
    accent: {
      purple: "#8b5cf6",
      blue: "#3b82f6",
      green: "#10b981",
      orange: "#f59e0b",
      red: "#ef4444",
      pink: "#ec4899"
    }
  },
  typography: {
    fontFamily: {
      sans: '"Inter Variable", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
      mono: '"JetBrains Mono", "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Source Code Pro", monospace'
    }
  },
  effects: {
    glassmorphism: {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)"
    }
  }
} as const;

export type LinearTheme = typeof linearTheme;