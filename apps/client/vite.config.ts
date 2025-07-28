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
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: [],
    },
  }
})
