# SuperClaude Framework 완전 사용 가이드

## 📋 목차
1. [개요](#개요)
2. [설치 방법](#설치-방법)
3. [기본 설정](#기본-설정)
4. [핵심 기능](#핵심-기능)
5. [명령어 완전 가이드](#명령어-완전-가이드)
6. [AI 페르소나 시스템](#ai-페르소나-시스템)
7. [MCP 서버 통합](#mcp-서버-통합)
8. [실전 사용 예제](#실전-사용-예제)
9. [고급 설정](#고급-설정)
10. [문제 해결](#문제-해결)

## 🎯 개요

SuperClaude Framework는 Claude Code를 강력한 개발 도구로 변신시켜주는 Python 기반 설정 프레임워크입니다.

### 🚀 주요 기능
- **16개의 전문 명령어**: 개발, 분석, 품질 관리 전용 명령어
- **스마트 AI 페르소나**: 도메인별 전문가 AI 자동 활성화
- **MCP 서버 통합**: 외부 도구와의 seamless 연동
- **작업 관리 시스템**: 체계적인 프로젝트 관리
- **토큰 최적화**: 효율적인 대화 및 리소스 관리

### 📊 프로젝트 정보
- **GitHub**: https://github.com/SuperClaude-Org/SuperClaude_Framework
- **라이선스**: MIT
- **버전**: 3.0.0 (초기 릴리즈)
- **언어**: Python 3.8+
- **스타**: 10,366⭐ | **포크**: 935🍴

---

## 🔧 설치 방법

### 사전 요구사항
```bash
# Python 3.8+ 확인
python3 --version

# uv 패키지 매니저 설치 (권장)
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 1️⃣ PyPI를 통한 설치 (권장)
```bash
# uv 사용 (가장 빠름)
uv add SuperClaude

# 또는 pip 사용
pip install SuperClaude
```

### 2️⃣ 소스에서 설치
```bash
git clone https://github.com/SuperClaude-Org/SuperClaude_Framework.git
cd SuperClaude_Framework
uv sync
```

### 3️⃣ 설치 옵션
```bash
# 🚀 빠른 설정
python3 -m SuperClaude install

# 🎯 대화형 설치 (추천 초보자용)
python3 -m SuperClaude install --interactive

# 📦 최소 설치
python3 -m SuperClaude install --minimal

# 👨‍💻 개발자 프로필
python3 -m SuperClaude install --profile developer
```

---

## ⚙️ 기본 설정

설치 후 Claude Code에서 SuperClaude가 자동으로 활성화됩니다.

### 설정 파일 위치
```
~/.claude/
├── settings.json          # 기본 설정
├── CLAUDE.md              # 프레임워크 메인 설정
├── COMMANDS.md            # 명령어 설정
├── PERSONAS.md            # 페르소나 설정
├── FLAGS.md               # 플래그 설정
└── MCP.md                 # MCP 서버 설정
```

### 기본 설정 확인
Claude Code에서 다음 명령어로 설치 확인:
```
/sc:help
```

---

## 🏗️ 핵심 기능

### 1. 전문 명령어 시스템
16개의 전문화된 `/sc:` 명령어로 개발 워크플로우를 혁신합니다.

### 2. 스마트 페르소나
상황에 맞는 AI 전문가가 자동으로 활성화되어 최적의 솔루션을 제공합니다.

### 3. MCP 서버 통합
외부 도구들과 완벽하게 연동되어 강력한 개발 환경을 구축합니다.

### 4. 토큰 최적화
대화 효율성을 극대화하여 더 많은 작업을 적은 비용으로 처리합니다.

---

## 📚 명령어 완전 가이드

### 🔨 개발 명령어

#### `/sc:implement` - 기능 구현
**용도**: 새로운 기능, 컴포넌트, API 구현
```bash
# 기본 사용법
/sc:implement 사용자 인증 시스템

# 옵션 사용
/sc:implement --type component --framework react 로그인 폼
/sc:implement --type api --backend express 사용자 API
/sc:implement --type service --database postgresql 데이터 서비스
```

**주요 기능**:
- 🎯 자동 페르소나 활성화 (Frontend, Backend, Architect)
- 🔧 MCP 서버 통합 (Magic for UI, Context7 for patterns)
- 📝 체계적인 구현 계획 수립

#### `/sc:build` - 프로젝트 빌드
**용도**: 프레임워크 감지 및 최적화된 빌드
```bash
# 전체 프로젝트 빌드
/sc:build

# 특정 타겟 빌드
/sc:build frontend
/sc:build @src/components

# 플래그 활용
/sc:build --optimize --test
```

**주요 기능**:
- 🚀 자동 프레임워크 감지
- ⚡ 성능 최적화
- 🧪 자동 테스트 실행

#### `/sc:design` - 디자인 오케스트레이션
**용도**: 시스템 설계 및 아키텍처 계획
```bash
# 시스템 설계
/sc:design 마이크로서비스 아키텍처

# UI 디자인
/sc:design --domain frontend 반응형 대시보드

# 데이터베이스 설계
/sc:design --domain backend 사용자 스키마
```

### 🔍 분석 명령어

#### `/sc:analyze` - 다차원 분석
**용도**: 코드, 시스템, 성능 종합 분석
```bash
# 전체 분석
/sc:analyze

# 특정 경로 분석
/sc:analyze @src/utils

# 포커스 분석
/sc:analyze --focus performance
/sc:analyze --focus security
/sc:analyze --focus quality
```

**주요 기능**:
- 🧠 Wave 모드 지원 (복잡한 분석)
- 📊 다차원 메트릭 수집
- 🔍 근본 원인 분석

#### `/sc:troubleshoot` - 문제 해결
**용도**: 버그 조사 및 해결책 제시
```bash
# 증상 기반 분석
/sc:troubleshoot "로그인이 안됩니다"

# 로그 기반 분석
/sc:troubleshoot --logs error.log

# 성능 문제 해결
/sc:troubleshoot --focus performance
```

#### `/sc:explain` - 교육적 설명
**용도**: 코드, 개념, 아키텍처 상세 설명
```bash
# 코드 설명
/sc:explain @src/auth.js

# 개념 설명
/sc:explain "리액트 훅스의 원리"

# 상세 설명
/sc:explain --detailed JWT 인증 플로우
```

### ✨ 품질 명령어

#### `/sc:improve` - 코드 개선
**용도**: 증거 기반 코드 품질 향상
```bash
# 전체 개선
/sc:improve

# 특정 영역 개선
/sc:improve @src/components --focus performance
/sc:improve --type refactoring legacy-code.js
```

**주요 기능**:
- 🔄 Wave 모드 지원
- 📈 성능 최적화
- 🛡️ 보안 강화
- 📝 코드 품질 향상

#### `/sc:test` - 테스팅 워크플로우
**용도**: 포괄적인 테스트 전략 및 실행
```bash
# 전체 테스트
/sc:test

# 특정 타입 테스트
/sc:test --type unit
/sc:test --type e2e
/sc:test --type performance
```

#### `/sc:cleanup` - 프로젝트 정리
**용도**: 기술 부채 감소 및 코드 정리
```bash
# 전체 정리
/sc:cleanup

# 특정 영역 정리
/sc:cleanup @src/legacy --focus debt
```

### 📖 기타 명령어

#### `/sc:document` - 문서화
**용도**: 전문적인 문서 생성
```bash
# API 문서
/sc:document --type api @src/routes

# 사용자 가이드
/sc:document --type guide --style detailed

# README 생성
/sc:document --type readme
```

#### `/sc:git` - Git 워크플로우
**용도**: 버전 관리 및 배포 지원
```bash
# 스마트 커밋
/sc:git commit

# 브랜치 전략
/sc:git --operation branch-strategy

# 릴리즈 준비
/sc:git --operation release
```

#### `/sc:estimate` - 증거 기반 추정
**용도**: 개발 시간 및 복잡도 추정
```bash
# 기능 추정
/sc:estimate "사용자 대시보드 개발"

# 프로젝트 추정
/sc:estimate @project-spec.md
```

#### `/sc:task` - 장기 프로젝트 관리
**용도**: 복잡한 프로젝트 오케스트레이션
```bash
# 프로젝트 계획
/sc:task plan "전체 시스템 리팩토링"

# 진행 상황 추적
/sc:task status

# 우선순위 조정
/sc:task prioritize
```

---

## 🎭 AI 페르소나 시스템

SuperClaude의 핵심 기능 중 하나인 스마트 페르소나 시스템은 상황에 맞는 전문가 AI를 자동으로 활성화합니다.

### 🏗️ architect (시스템 아키텍트)
**전문 분야**: 시스템 설계, 장기 아키텍처
**우선순위**: 장기 유지보수성 > 확장성 > 성능 > 단기 이익

```bash
# 자동 활성화 키워드
"architecture", "design", "scalability"

# 수동 활성화
/sc:analyze --persona-architect
```

**최적화된 명령어**: `/sc:analyze`, `/sc:estimate`, `/sc:improve --arch`, `/sc:design`

### 🎨 frontend (프론트엔드 전문가)
**전문 분야**: UX/UI, 접근성, 성능 최적화
**우선순위**: 사용자 경험 > 접근성 > 성능 > 기술적 우아함

```bash
# 성능 예산
- 로드 타임: 3G에서 <3초, WiFi에서 <1초
- 번들 크기: 초기 <500KB, 전체 <2MB
- 접근성: WCAG 2.1 AA 최소 90%
```

### ⚙️ backend (백엔드 전문가)
**전문 분야**: API, 데이터 무결성, 신뢰성
**우선순위**: 신뢰성 > 보안 > 성능 > 기능 > 편의성

```bash
# 신뢰성 예산
- 가동시간: 99.9% (연간 8.7시간 다운타임)
- 에러율: 중요 작업 <0.1%
- 응답시간: API 호출 <200ms
```

### 🔍 analyzer (분석 전문가)
**전문 분야**: 근본 원인 분석, 체계적 조사
**우선순위**: 증거 > 체계적 접근 > 완전성 > 속도

```bash
# 조사 방법론
1. 증거 수집 → 가설 형성 전
2. 패턴 인식 → 상관관계 및 이상 징후
3. 가설 검증 → 체계적 원인 검증
4. 근본 원인 확인 → 재현 가능한 테스트
```

### 🛡️ security (보안 전문가)
**전문 분야**: 위협 모델링, 취약점 분석
**우선순위**: 보안 > 컴플라이언스 > 신뢰성 > 성능 > 편의성

```bash
# 위협 평가 매트릭스
- 위협 수준: Critical(즉시), High(24h), Medium(7일), Low(30일)
- 공격 표면: 외부 노출(100%), 내부(70%), 격리(40%)
```

### ✍️ scribe (문서화 전문가)
**전문 분야**: 전문 문서 작성, 현지화
**우선순위**: 명확성 > 독자 요구 > 문화적 민감성 > 완전성

```bash
# 언어 지원
en (기본), es, fr, de, ja, zh, pt, it, ru, ko

# 컨텐츠 유형
기술 문서, 사용자 가이드, 위키, PR 내용, 커밋 메시지
```

### 기타 페르소나
- **🔧 refactorer**: 코드 품질, 기술 부채 관리
- **⚡ performance**: 최적화, 병목 제거
- **✅ qa**: 품질 보증, 테스팅
- **🚀 devops**: 인프라, 배포 자동화
- **👨‍🏫 mentor**: 교육, 지식 전수

### 페르소나 자동 활성화
```bash
# 멀티팩터 활성화 스코어링
- 키워드 매칭: 30%
- 컨텍스트 분석: 40%
- 사용자 히스토리: 20%
- 성능 메트릭: 10%
```

---

## 🔌 MCP 서버 통합

MCP (Model Context Protocol) 서버들이 SuperClaude의 능력을 확장합니다.

### 📚 Context7 - 문서화 & 연구
**목적**: 공식 라이브러리 문서, 코드 예제, 모범 사례

```bash
# 자동 활성화
- 외부 라이브러리 import 감지
- 프레임워크 관련 질문
- scribe 페르소나 활성화

# 수동 활성화
--c7, --context7
```

**워크플로우**:
1. 라이브러리 감지 → import, package.json 스캔
2. ID 해결 → `resolve-library-id`
3. 문서 검색 → `get-library-docs`
4. 패턴 추출 → 관련 코드 패턴
5. 구현 → 버전 호환성 적용

### 🧠 Sequential - 복잡한 분석
**목적**: 다단계 문제 해결, 아키텍처 분석

```bash
# 자동 활성화
- 복잡한 디버깅 시나리오
- 시스템 설계 질문
- --think 플래그

# 사고 모드
--think (4K): 모듈 수준 분석
--think-hard (10K): 시스템 전체 분석
--ultrathink (32K): 중요 시스템 분석
```

### ✨ Magic - UI 컴포넌트 생성
**목적**: 최신 UI 컴포넌트, 디자인 시스템 통합

```bash
# 자동 활성화
- UI 컴포넌트 요청
- 디자인 시스템 쿼리
- frontend 페르소나 활성화

# 컴포넌트 카테고리
- Interactive: 버튼, 폼, 모달, 드롭다운
- Layout: 그리드, 컨테이너, 카드, 패널
- Display: 타이포그래피, 이미지, 차트, 테이블
```

### 🎭 Playwright - 브라우저 자동화
**목적**: E2E 테스팅, 성능 모니터링

```bash
# 자동 활성화
- 테스팅 워크플로우
- 성능 모니터링 요청
- qa 페르소나 활성화

# 기능
- 멀티 브라우저: Chrome, Firefox, Safari, Edge
- 시각적 테스팅: 스크린샷, 회귀 감지
- 성능 메트릭: Core Web Vitals
```

### 서버 선택 알고리즘
```bash
1. 작업-서버 친화도: 능력 매트릭스 기반 매칭
2. 성능 메트릭: 응답 시간, 성공률
3. 컨텍스트 인식: 현재 페르소나, 명령 깊이
4. 부하 분산: 지능적 큐잉
5. 폴백 준비: 중요 작업용 백업 서버
```

---

## 💡 실전 사용 예제

### 🚀 풀스택 웹 애플리케이션 개발

#### 1단계: 프로젝트 분석 및 설계
```bash
/sc:analyze @project-requirements.md --focus architecture
```
**결과**: architect 페르소나 활성화, 시스템 아키텍처 제안

#### 2단계: 백엔드 API 구현
```bash
/sc:implement --type api --framework express "사용자 인증 API"
```
**결과**: backend 페르소나 + Context7 서버로 Express 패턴 활용

#### 3단계: 프론트엔드 컴포넌트 생성
```bash
/sc:implement --type component --framework react "로그인 폼"
```
**결과**: frontend 페르소나 + Magic 서버로 React 컴포넌트 생성

#### 4단계: 테스트 작성
```bash
/sc:test --type e2e "로그인 플로우"
```
**결과**: qa 페르소나 + Playwright로 E2E 테스트

#### 5단계: 성능 최적화
```bash
/sc:improve --focus performance @src/
```
**결과**: performance 페르소나로 병목 지점 분석 및 최적화

### 🔧 레거시 시스템 개선

#### 1단계: 전체 시스템 분석
```bash
/sc:analyze --ultrathink @legacy-system/
```
**결과**: analyzer 페르소나 + Sequential 서버로 종합 분석

#### 2단계: 리팩토링 계획
```bash
/sc:improve --type refactoring --plan @analysis-report.md
```
**결과**: refactorer 페르소나로 체계적 개선 계획

#### 3단계: 점진적 개선
```bash
/sc:task plan "레거시 시스템 현대화"
```
**결과**: 장기 프로젝트 관리로 단계별 실행

### 🐛 복잡한 버그 해결

#### 1단계: 증상 분석
```bash
/sc:troubleshoot "사용자가 로그인 후 대시보드가 비어있음"
```
**결과**: analyzer 페르소나로 체계적 조사

#### 2단계: 근본 원인 분석
```bash
/sc:analyze --think-hard @auth-flow/ --focus debugging
```
**결과**: Sequential 서버로 다단계 분석

#### 3단계: 해결책 구현
```bash
/sc:implement --type fix "세션 관리 개선"
```
**결과**: 원인 기반 해결책 구현

---

## ⚙️ 고급 설정

### 플래그 시스템

#### 🧠 사고 깊이 플래그
```bash
--think          # 4K 토큰: 모듈 수준 분석
--think-hard     # 10K 토큰: 시스템 전체 분석  
--ultrathink     # 32K 토큰: 중요 시스템 분석
```

#### 🔧 MCP 서버 제어
```bash
--c7, --context7     # Context7 활성화
--seq, --sequential  # Sequential 활성화
--magic             # Magic 활성화
--play, --playwright # Playwright 활성화
--all-mcp           # 모든 MCP 서버
--no-mcp            # MCP 서버 비활성화
```

#### ⚡ 효율성 플래그
```bash
--uc, --ultracompressed  # 30-50% 토큰 절약
--validate              # 사전 검증
--safe-mode            # 최대 안전 모드
```

#### 🔄 반복 개선 플래그
```bash
--loop              # 반복 개선 모드
--iterations [n]    # 개선 사이클 수 (기본: 3)
--interactive       # 사이클 간 확인
```

### Wave 시스템

**다단계 복잡한 작업을 위한 compound intelligence**

#### 자동 활성화 조건
```bash
복잡도 ≥ 0.7 AND 파일 수 > 20 AND 작업 유형 > 2
```

#### Wave 전략
```bash
--wave-strategy progressive   # 점진적 향상
--wave-strategy systematic    # 체계적 분석  
--wave-strategy adaptive      # 동적 구성
--wave-strategy enterprise    # 대규모 오케스트레이션
```

### 작업 위임 시스템

#### Sub-Agent 위임
```bash
--delegate files     # 파일별 분석 위임
--delegate folders   # 디렉토리별 위임
--delegate auto      # 자동 전략 감지
--concurrency [n]    # 동시 실행 수 (1-15)
```

#### 자동 위임 트리거
```bash
디렉토리 수 > 7     → --delegate --parallel-dirs
파일 수 > 50       → --delegate files  
복잡도 > 0.8       → --delegate auto
```

### 설정 파일 커스터마이징

#### ~/.claude/settings.json
```json
{
  "orchestrator_config": {
    "enable_caching": true,
    "parallel_operations": true,
    "max_parallel": 3,
    "confidence_threshold": 0.7,
    "wave_mode": {
      "enable_auto_detection": true,
      "wave_score_threshold": 0.7,
      "max_waves_per_operation": 5
    }
  }
}
```

---

## 🔧 문제 해결

### 일반적인 문제들

#### 1. 설치 문제
```bash
# Python 버전 확인
python3 --version  # 3.8+ 필요

# 권한 문제
sudo python3 -m SuperClaude install

# 의존성 충돌
uv sync --force
```

#### 2. MCP 서버 연결 문제
```bash
# 서버 상태 확인
/sc:analyze --no-mcp  # MCP 없이 실행

# 특정 서버 비활성화
/sc:implement --no-magic  # Magic 서버 제외
```

#### 3. 성능 문제
```bash
# 토큰 사용량 최적화
/sc:improve --uc  # 압축 모드

# 병렬 처리 활성화
/sc:analyze --delegate auto
```

#### 4. 품질 문제
```bash
# 검증 모드 활성화
/sc:implement --validate

# 안전 모드
/sc:build --safe-mode
```

### 리소스 관리

#### 토큰 사용량 모니터링
```bash
# 그린존 (0-60%): 전체 작업
# 옐로우존 (60-75%): 리소스 최적화, --uc 제안  
# 오렌지존 (75-85%): 경고, 비중요 작업 연기
# 레드존 (85-95%): 효율성 모드 강제
# 크리티컬존 (95%+): 필수 작업만
```

### 에러 복구 패턴
```bash
# MCP 타임아웃 → 폴백 서버 사용
# 토큰 제한 → 압축 활성화  
# 도구 실패 → 대안 도구 시도
# 파싱 에러 → 명확화 요청
```

### 로그 및 디버깅
```bash
# 자세한 로그
/sc:analyze --verbose

# 내부 추론 과정 확인
/sc:troubleshoot --introspect

# 설정 검증
python3 -m SuperClaude validate
```

---

## 📚 참고 자료

### 공식 문서
- **GitHub 리포지토리**: https://github.com/SuperClaude-Org/SuperClaude_Framework
- **이슈 트래킹**: https://github.com/SuperClaude-Org/SuperClaude_Framework/issues
- **로드맵**: ROADMAP.md

### 커뮤니티
- **기여 가이드**: CONTRIBUTING.md
- **행동 강령**: CODE_OF_CONDUCT.md
- **보안 정책**: SECURITY.md

### 라이선스
MIT License - 상업적 사용 가능

---

## 🚀 다음 단계

### v4.0 계획 (예정)
- 🔄 재설계된 훅 시스템
- 🔧 더 많은 MCP 도구 통합
- ⚡ 성능 개선
- 🎭 추가 페르소나

### 시작하기
1. **설치**: `uv add SuperClaude`
2. **설정**: `python3 -m SuperClaude install --interactive`
3. **첫 명령어**: `/sc:help`
4. **실험**: `/sc:analyze @your-project/`

---

**💡 팁**: SuperClaude는 초기 릴리즈입니다. 실험적인 사용에 적합하며, 일부 거친 부분이 있을 수 있습니다. 활발한 개발이 진행 중이므로 피드백과 기여를 환영합니다!

**🎯 목표**: Claude Code를 강력한 개발 파트너로 만들어 개발 생산성을 혁신적으로 향상시키는 것입니다.