import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // GitHub Pages 배포를 위한 base path 설정
  const isProduction = mode === "production";
  const isCI = process.env.CI === "true";
  const isGitHubPages = process.env.GITHUB_PAGES === "true";

  // 로컬 개발 시에는 '/', GitHub Pages 배포 시에는 '/hanbit-vibecoding-test/'
  const base =
    isProduction || isCI || isGitHubPages ? "/hanbit-vibecoding-test/" : "/";

  console.log("Vite config:", {
    mode,
    isProduction,
    isCI,
    isGitHubPages,
    base,
  });

  return {
    plugins: [react(), tsconfigPaths()],
    base,
    build: {
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: false,
      minify: "esbuild",
      // 번들 최적화 설정
      rollupOptions: {
        output: {
          // 청크 분할 최적화
          manualChunks: {
            // React 라이브러리 청크
            react: ["react", "react-dom"],
            // 유틸리티 라이브러리 청크
            utils: ["uuid", "date-fns"],
            // UI 컴포넌트 청크
            ui: ["@vive/ui"],
            // 타입 라이브러리 청크 (타입만이므로 런타임에 포함되지 않음)
            // types: ['@hanbit/types'], // 타입만이므로 제거
          },
          // 에셋 파일명 최적화
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name?.split(".") || [];
            const ext = info[info.length - 1] || "";

            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return `assets/images/[name]-[hash][extname]`;
            }
            if (/css/i.test(ext)) {
              return `assets/styles/[name]-[hash][extname]`;
            }
            if (/woff2?|eot|ttf|otf/i.test(ext)) {
              return `assets/fonts/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
          // 청크 파일명 최적화
          chunkFileNames: "assets/js/[name]-[hash].js",
          entryFileNames: "assets/js/[name]-[hash].js",
        },
      },
      // 청크 크기 경고 임계값 조정
      chunkSizeWarningLimit: 500, // KB
      // CSS 코드 스플리팅 활성화
      cssCodeSplit: true,
      // 빌드 타겟 최적화
      target: ["es2020", "chrome80", "safari13"],
      // 압축 최적화
      reportCompressedSize: true,
    },
    server: {
      port: 3000,
      host: true,
      headers: {
        // 개발 환경에서도 보안 헤더 적용
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        // 개발 환경용 CSP (느슨한 설정)
        "Content-Security-Policy": [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // 개발 환경에서는 eval 허용
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "connect-src 'self' ws: wss: http: https:", // 개발 서버 WebSocket 허용
          "frame-ancestors 'none'",
        ].join("; "),
      },
    },
    preview: {
      port: 4173,
      headers: {
        // 프리뷰 환경용 보안 헤더 (프로덕션에 가까운 설정)
        "X-Frame-Options": "DENY",
        "X-Content-Type-Options": "nosniff",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Strict-Transport-Security": "max-age=86400",
        "Content-Security-Policy": [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'", // Tailwind CSS 인라인 스타일 허용
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'self' https:",
          "frame-ancestors 'none'",
          "base-uri 'self'",
        ].join("; "),
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/__tests__/setup.ts"],
    },
  };
});
