# 한빛 TODO 앱

현대적이고 사용자 친화적인 할일 관리 웹 애플리케이션입니다.

[![Build Status](https://github.com/hanbit/todo-app/workflows/CI/badge.svg)](https://github.com/hanbit/todo-app/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

## ✨ 주요 기능

- **🎯 할일 관리**: 생성, 수정, 삭제, 완료 처리
- **🏷️ 우선순위 설정**: 낮음/보통/높음 3단계 우선순위
- **🔍 필터링**: 전체/활성/완료 상태별 보기
- **📊 통계**: 실시간 진행률 및 완료 통계
- **🔄 오프라인 지원**: 인터넷 연결 없이도 사용 가능
- **👤 게스트 모드**: 회원가입 없이 즉시 사용 가능
- **🔐 안전한 인증**: AWS Cognito를 통한 보안 인증
- **☁️ 클라우드 동기화**: 여러 기기 간 실시간 동기화
- **📱 반응형 디자인**: 모바일, 태블릿, 데스크톱 최적화
- **♿ 접근성**: WCAG 2.1 AA 표준 준수

## 🚀 빠른 시작

### 사용자용 (즉시 사용)

1. **웹사이트 방문**: [https://todo-app.hanbit.com](https://todo-app.hanbit.com)
2. **게스트로 시작하기** 또는 **회원가입**
3. 할일을 추가하고 관리하세요!

### 개발자용 (로컬 개발)

```bash
# 저장소 클론
git clone https://github.com/hanbit/todo-app.git
cd todo-app

# 의존성 설치 (pnpm 권장)
pnpm install

# 개발 서버 시작
pnpm dev

# http://localhost:5173에서 확인
```

## 📋 필수 요구사항

- **Node.js**: 18.17.0 이상
- **pnpm**: 8.0.0 이상 (권장 패키지 매니저)
- **Git**: 2.30 이상
- **현대적인 웹 브라우저**: Chrome, Firefox, Safari, Edge

## 🏗️ 프로젝트 구조

```
hanbit-todo-app/
├── apps/
│   ├── client/          # React 프론트엔드 앱
│   └── server/          # Node.js 백엔드 (미래)
├── packages/
│   ├── types/           # 공유 TypeScript 타입
│   └── ui/              # 공유 UI 컴포넌트 (shadcn/ui)
├── docs/                # 프로젝트 문서
│   ├── guides/          # 사용자 및 개발자 가이드
│   ├── design/          # 시스템 설계 문서
│   └── api/             # API 문서
├── .claude/             # Claude AI 개발 규칙
└── scripts/             # 유틸리티 스크립트
```

## 🛠️ 기술 스택

### 프론트엔드

- **[React 18](https://react.dev/)**: 선언적 UI 라이브러리
- **[TypeScript](https://www.typescriptlang.org/)**: 정적 타입 검사
- **[Vite](https://vitejs.dev/)**: 빠른 빌드 도구
- **[Tailwind CSS](https://tailwindcss.com/)**: 유틸리티 CSS 프레임워크
- **[shadcn/ui](https://ui.shadcn.com/)**: 접근 가능한 UI 컴포넌트

### 상태 관리

- **React Context + useReducer**: 전역 상태 관리
- **커스텀 훅**: 비즈니스 로직 캡슐화

### 개발 도구

- **[Vitest](https://vitest.dev/)**: 단위 테스트 프레임워크
- **[Playwright](https://playwright.dev/)**: E2E 테스트
- **[ESLint](https://eslint.org/)**: 코드 품질 분석
- **[Prettier](https://prettier.io/)**: 코드 포맷팅
- **[pnpm](https://pnpm.io/)**: 효율적인 패키지 매니저

### 인프라 (클라우드)

- **[AWS S3](https://aws.amazon.com/s3/)**: 정적 웹사이트 호스팅
- **[AWS CloudFront](https://aws.amazon.com/cloudfront/)**: CDN
- **[AWS Lambda](https://aws.amazon.com/lambda/)**: 서버리스 API
- **[AWS DynamoDB](https://aws.amazon.com/dynamodb/)**: NoSQL 데이터베이스
- **[AWS Cognito](https://aws.amazon.com/cognito/)**: 사용자 인증

## 📚 문서

- 📖 **[사용자 가이드](docs/guides/user-guide.md)**: 앱 사용법 완벽 가이드
- 👨‍💻 **[개발자 가이드](docs/guides/developer-guide.md)**: 개발 환경 설정 및 기여 방법
- 🔧 **[운영 매뉴얼](docs/guides/operations-manual.md)**: 시스템 운영 및 배포 가이드
- 🏗️ **[시스템 설계](docs/design.md)**: 아키텍처 및 기술적 의사결정
- 📡 **[API 문서](docs/api/openapi.yaml)**: RESTful API 명세 (OpenAPI 3.0)

## 🚀 개발 명령어

```bash
# 개발 서버 시작
pnpm dev

# 타입 체크
pnpm type-check

# 린트 체크
pnpm lint

# 코드 포맷팅
pnpm format

# 테스트 실행
pnpm test

# E2E 테스트
pnpm test:e2e

# 프로덕션 빌드
pnpm build

# 빌드 미리보기
pnpm preview
```

## 🧪 테스트

### 단위 테스트 실행

```bash
# 모든 단위 테스트
pnpm test

# 감시 모드로 테스트
pnpm test:watch

# 커버리지 리포트
pnpm test:coverage
```

### E2E 테스트 실행

```bash
# 헤드리스 모드
pnpm test:e2e

# UI 모드로 디버깅
pnpm test:e2e:ui

# 특정 브라우저에서만
pnpm playwright test --project=chromium
```

## 📈 성능

### 최적화 포인트

- **번들 크기**: Gzipped < 100KB
- **첫 페이지 로딩**: < 2초 (3G 네트워크)
- **Time to Interactive**: < 3초
- **Lighthouse 점수**: 90+ (모든 카테고리)

### 모니터링

- **Core Web Vitals** 추적
- **실시간 사용자 모니터링** (RUM)
- **에러 추적 및 보고**

## 🔐 보안

- **HTTPS 강제**: 모든 통신 암호화
- **JWT 토큰**: 보안 인증
- **입력 검증**: XSS 및 injection 공격 방지
- **CORS 정책**: 적절한 크로스 오리진 제한
- **Content Security Policy**: XSS 추가 방어

## 🌍 브라우저 지원

- **Chrome**: 90+ ✅
- **Firefox**: 88+ ✅
- **Safari**: 14+ ✅
- **Edge**: 90+ ✅

모바일:

- **iOS Safari**: 14+ ✅
- **Android Chrome**: 90+ ✅

## 🤝 기여 방법

프로젝트에 기여해주셔서 감사합니다! 다음 단계를 따라 기여해주세요:

1. **Fork** 저장소를 포크합니다
2. **Branch** 새 기능 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. **Commit** 변경사항을 커밋합니다 (`git commit -m 'feat: 놀라운 기능 추가'`)
4. **Push** 브랜치에 푸시합니다 (`git push origin feature/amazing-feature`)
5. **Pull Request** Pull Request를 생성합니다

### 커밋 컨벤션

[Conventional Commits](https://www.conventionalcommits.org/) 규칙을 따릅니다:

```bash
feat: 새 기능 추가
fix: 버그 수정
docs: 문서 업데이트
style: 코드 스타일 변경 (기능 변경 없음)
refactor: 리팩토링
test: 테스트 추가/수정
chore: 빌드 프로세스 또는 도구 변경
```

### 개발 가이드라인

- **TypeScript**: strict 모드 사용, `any` 타입 금지
- **테스트**: 새 기능에 대한 테스트 필수
- **접근성**: WCAG 2.1 AA 표준 준수
- **성능**: Core Web Vitals 최적화
- **문서**: 코드 변경 시 문서 업데이트

자세한 내용은 [개발자 가이드](docs/guides/developer-guide.md)를 참조하세요.

## 📊 프로젝트 상태

### 개발 진행률

- [x] **1단계**: 모노레포 설정 ✅
- [x] **2단계**: 공유 패키지 ✅
- [x] **3단계**: 핵심 로직 ✅
- [x] **4단계**: UI 개발 ✅
- [x] **5단계**: 백엔드 개발 ✅
- [x] **6단계**: 프론트엔드-백엔드 통합 ✅
- [x] **7단계**: 보안 및 품질 ✅
- [x] **8단계**: 배포 및 운영 ✅
- [x] **9단계**: 최종 검증 및 문서화 ✅

### 품질 지표

- **테스트 커버리지**: 90%+
- **타입 안전성**: 100% (strict TypeScript)
- **접근성 점수**: AA 등급
- **성능 점수**: 90+ (Lighthouse)
- **보안 점수**: A+ (Security Headers)

## 🐛 버그 리포트 및 기능 요청

문제를 발견하거나 새로운 기능을 제안하고 싶으시면:

1. **GitHub Issues**에서 기존 이슈 확인
2. 새 이슈 생성 시 템플릿 사용
3. 상세한 설명과 재현 단계 포함
4. 스크린샷이나 에러 로그 첨부

## 📞 지원 및 연락처

- 📧 **이메일**: support@todo-app.com
- 💬 **디스코드**: [개발자 커뮤니티](https://discord.gg/todo-app)
- 🐛 **버그 리포트**: [GitHub Issues](https://github.com/hanbit/todo-app/issues)
- 📚 **문서**: [Documentation](https://docs.todo-app.com)

## 📄 라이선스

이 프로젝트는 [MIT License](LICENSE) 하에 배포됩니다.

```
MIT License

Copyright (c) 2024 한빛 TODO 앱 팀

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🙏 감사 인사

이 프로젝트는 다음 오픈소스 프로젝트들의 도움을 받았습니다:

- [React](https://react.dev/) - 사용자 인터페이스 구축
- [TypeScript](https://www.typescriptlang.org/) - 타입 안전성
- [Tailwind CSS](https://tailwindcss.com/) - 스타일링
- [shadcn/ui](https://ui.shadcn.com/) - UI 컴포넌트
- [Vite](https://vitejs.dev/) - 빌드 도구
- [Vitest](https://vitest.dev/) - 테스트 프레임워크
- [Playwright](https://playwright.dev/) - E2E 테스트

그리고 이 프로젝트에 기여해주신 모든 개발자분들께 감사드립니다! 🚀

---

<div align="center">

**[🏠 홈페이지](https://todo-app.hanbit.com) | [📚 문서](docs/) | [🐛 이슈 리포트](https://github.com/hanbit/todo-app/issues) | [💬 커뮤니티](https://discord.gg/todo-app)**

Made with ❤️ by 한빛 TODO 앱 팀

</div>
