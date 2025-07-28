# GitHub Pages 배포 설정 가이드

## 📋 준비 완료된 설정

✅ **Vite 설정 업데이트** (`apps/client/vite.config.ts`)
- GitHub Pages용 base path 설정: `/hanbit-vibecoding-test/`
- 프로덕션 빌드 최적화 설정

✅ **GitHub Actions 워크플로우** (`.github/workflows/deploy.yml`)
- 자동 빌드 및 배포 설정
- main/master 브랜치 푸시 시 자동 실행

## 🚀 GitHub Repository 설정 단계

### 1단계: GitHub Repository 생성
```bash
# GitHub에서 새 repository 생성
# Repository 이름: hanbit-vibecoding-test
# Public으로 설정 (GitHub Pages 무료 사용)
```

### 2단계: 로컬 Git 설정
```bash
# 프로젝트 루트에서 실행
cd "D:\study\viveCoding\hanbit-vibecoding-test"

# Git 초기화 (이미 되어있다면 생략)
git init

# GitHub remote 연결 (YOUR_USERNAME을 실제 사용자명으로 변경)
git remote add origin https://github.com/YOUR_USERNAME/hanbit-vibecoding-test.git

# 현재 변경사항 확인
git status

# 모든 파일 스테이징
git add .

# 첫 커밋
git commit -m "feat: GitHub Pages 배포 설정 추가

- Vite 설정에 GitHub Pages용 base path 추가
- GitHub Actions 워크플로우 설정
- 자동 빌드 및 배포 환경 구성"

# GitHub에 푸시
git push -u origin main
```

### 3단계: GitHub Pages 활성화
1. GitHub repository → **Settings** 탭
2. 좌측 메뉴에서 **Pages** 클릭
3. Source 설정:
   - **Source**: Deploy from a branch → **GitHub Actions** 선택
4. 설정 저장

### 4단계: 배포 확인
- Actions 탭에서 워크플로우 실행 상태 확인
- 성공 시 `https://YOUR_USERNAME.github.io/hanbit-vibecoding-test/` 에서 앱 확인

## 📝 주요 설정 내용

### Vite 설정 (`apps/client/vite.config.ts`)
```typescript
base: process.env.NODE_ENV === 'production' ? '/hanbit-vibecoding-test/' : '/',
build: {
  outDir: 'dist',
  assetsDir: 'assets',
  sourcemap: false,
  minify: 'esbuild'
}
```

### GitHub Actions 워크플로우 특징
- **트리거**: main/master 브랜치 푸시 시
- **Node.js**: v18 사용
- **패키지 매니저**: pnpm 사용
- **빌드 경로**: `apps/client/dist`
- **자동 배포**: GitHub Pages에 자동 업로드

## 🔧 추가 설정 (선택사항)

### 커스텀 도메인 설정
1. `apps/client/public/CNAME` 파일 생성
2. 도메인명 입력 (예: `yourdomain.com`)
3. DNS 설정에서 GitHub Pages IP 주소로 A 레코드 설정

### HTTPS 강제 적용
- GitHub Pages Settings에서 "Enforce HTTPS" 체크

## 🚨 주의사항

1. **Repository 이름**: `hanbit-vibecoding-test`로 정확히 설정
2. **Public Repository**: GitHub Pages 무료 사용을 위해 Public 설정 필요
3. **브랜치명**: main 또는 master 브랜치 사용
4. **빌드 경로**: `apps/client` 내에서 빌드 실행

## 🔄 업데이트 프로세스

향후 코드 변경 시:
```bash
git add .
git commit -m "업데이트 내용"
git push
```

푸시 후 자동으로 GitHub Actions가 실행되어 사이트가 업데이트됩니다.