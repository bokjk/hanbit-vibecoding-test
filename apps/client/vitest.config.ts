import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/e2e/**", // E2E 테스트 폴더 제외
      "**/*.e2e.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
      "**/*.spec.ts", // .spec.ts 파일들 제외 (E2E 테스트)
    ],
    include: [
      "**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}", // 일반 테스트만 포함
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "e2e/",
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/index.{ts,tsx}",
        "**/*.d.ts",
        "src/main.tsx", // 앱 진입점
        "src/vite-env.d.ts",
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        "./src/services/": {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        "./src/contexts/": {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@/components": resolve(__dirname, "./src/components"),
      "@/contexts": resolve(__dirname, "./src/contexts"),
      "@/services": resolve(__dirname, "./src/services"),
      "@/utils": resolve(__dirname, "./src/utils"),
      "@/types": resolve(__dirname, "./src/types"),
    },
  },
});
