# 백엔드 개발 환경 설정

## 🔧 Git Hook 설정

이 프로젝트는 코드 품질 유지를 위해 pre-commit hook을 사용합니다.

### 자동 실행되는 작업들

커밋 전에 다음 작업들이 자동으로 실행됩니다:

1. **📝 코드 스타일 검사 및 자동 수정** (ESLint + Prettier)
2. **🔍 TypeScript 타입 체크**
3. **🏗️ 빌드 테스트**
4. **🧪 단위 테스트 실행**

### 수동 실행 명령어

필요시 개별적으로 실행할 수 있습니다:

```bash
# ESLint 검사
pnpm lint

# ESLint 자동 수정
pnpm lint:fix

# Prettier 포맷팅
pnpm format

# Prettier 검사만
pnpm format:check

# TypeScript 타입 체크
pnpm type-check

# 빌드
pnpm build

# 테스트
pnpm test
```

### 설정 파일들

- `.eslintrc.js` - ESLint 규칙 설정
- `.prettierrc` - Prettier 포맷팅 규칙
- `.prettierignore` - Prettier 제외 파일
- `.husky/pre-commit` - pre-commit hook 스크립트
- `package.json` - lint-staged 설정

### 개발 팁

1. **자동 수정**: 대부분의 스타일 문제는 자동으로 수정됩니다
2. **커밋 실패**: hook에서 오류가 발생하면 커밋이 차단됩니다
3. **수동 수정**: 자동 수정되지 않는 문제는 수동으로 해결해야 합니다
4. **테스트 필수**: 테스트가 실패하면 커밋할 수 없습니다

### 문제 해결

커밋이 실패하는 경우:

1. 오류 메시지를 확인하세요
2. `pnpm lint:fix`로 자동 수정을 시도하세요
3. `pnpm format`로 코드 포맷팅을 적용하세요
4. `pnpm type-check`로 타입 오류를 확인하세요
5. `pnpm test`로 테스트 실패 원인을 파악하세요

모든 검사를 통과한 후에 다시 커밋해주세요.
