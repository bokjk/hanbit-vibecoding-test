import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // GitHub Pages 배포를 위한 base path 설정
  const isProduction = mode === 'production'
  const isCI = process.env.CI === 'true'
  const isGitHubPages = process.env.GITHUB_PAGES === 'true'
  
  // 로컬 개발 시에는 '/', GitHub Pages 배포 시에는 '/hanbit-vibecoding-test/'
  const base = (isProduction || isCI || isGitHubPages) ? '/hanbit-vibecoding-test/' : '/'
  
  console.log('Vite config:', { mode, isProduction, isCI, isGitHubPages, base })
  
  return {
    plugins: [react(), tsconfigPaths()],
    base,
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      minify: 'esbuild'
    },
    server: {
      port: 3000,
      host: true,
      headers: {
        // 개발 환경에서도 보안 헤더 적용
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        // 개발 환경용 CSP (느슨한 설정)
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // 개발 환경에서는 eval 허용
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "connect-src 'self' ws: wss: http: https:", // 개발 서버 WebSocket 허용
          "frame-ancestors 'none'"
        ].join('; ')
      }
    },
    preview: {
      port: 4173,
      headers: {
        // 프리뷰 환경용 보안 헤더 (프로덕션에 가까운 설정)
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff', 
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Strict-Transport-Security': 'max-age=86400',
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'", // Tailwind CSS 인라인 스타일 허용
          "img-src 'self' data: https:",
          "font-src 'self' data:",
          "connect-src 'self' https:",
          "frame-ancestors 'none'",
          "base-uri 'self'"
        ].join('; ')
      }
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: [],
    },
  }
})
