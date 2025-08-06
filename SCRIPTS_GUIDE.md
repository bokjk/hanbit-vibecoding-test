# 📋 스크립트 사용 가이드

모노레포에서 사용할 수 있는 npm 스크립트 가이드입니다.

## 🚀 개발 시작

```bash
# 프론트엔드 개발 서버 시작
pnpm dev
# 또는
pnpm dev:client
```

## 🏗️ 빌드

```bash
# 전체 빌드 (프론트엔드 + 백엔드)
pnpm build

# 개별 빌드
pnpm build:client  # 프론트엔드만
pnpm build:server  # 백엔드만
```

## 🧪 테스트

```bash
# 전체 테스트
pnpm test

# 개별 테스트
pnpm test:client   # 프론트엔드 단위 테스트
pnpm test:server   # 백엔드 단위 테스트
pnpm test:e2e      # E2E 테스트
```

## 🔍 코드 품질 검사

```bash
# ESLint 검사
pnpm lint          # 전체 검사
pnpm lint:client   # 프론트엔드만
pnpm lint:server   # 백엔드만

# ESLint 자동 수정
pnpm lint:fix      # 전체 수정
pnpm lint:fix:client
pnpm lint:fix:server
```

## ✨ 코드 포맷팅

```bash
# Prettier 포맷팅
pnpm format        # 전체 포맷팅
pnpm format:client # 프론트엔드만
pnpm format:server # 백엔드만
```

## 🔧 타입 체크

```bash
# TypeScript 타입 체크
pnpm type-check    # 전체 체크
pnpm type-check:client
pnpm type-check:server
```

## 🚢 배포

```bash
# 백엔드 배포 (AWS Lambda)
pnpm deploy
# 또는
pnpm deploy:server
```

## 🧹 정리

```bash
# 빌드 파일 정리
pnpm clean         # 전체 정리
pnpm clean:client  # 프론트엔드 빌드 파일
pnpm clean:server  # 백엔드 빌드 파일
```

## 📝 개발 워크플로우 예시

### 일반적인 개발 흐름

1. **개발 시작**

   ```bash
   pnpm dev
   ```

2. **코드 작성 후 품질 체크**

   ```bash
   pnpm lint:fix
   pnpm format
   pnpm type-check
   ```

3. **테스트 실행**

   ```bash
   pnpm test
   ```

4. **빌드 확인**

   ```bash
   pnpm build
   ```

5. **커밋** (Git hook이 자동으로 품질 체크 실행)
   ```bash
   git add .
   git commit -m "feat: 기능 추가"
   ```

### 배포 전 체크리스트

```bash
# 전체 품질 체크
pnpm lint && pnpm type-check && pnpm test && pnpm build

# 성공시 배포
pnpm deploy
```

## 💡 팁

- **자동 수정**: `lint:fix`와 `format`은 대부분의 스타일 문제를 자동으로 수정합니다
- **Git Hook**: 커밋시 자동으로 코드 품질 검사가 실행됩니다
- **필터 명령어**: 특정 패키지만 작업하려면 `pnpm --filter @vive/client [명령어]` 형태로 사용하세요
