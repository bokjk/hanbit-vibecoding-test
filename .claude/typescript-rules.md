# TypeScript 개발 규칙

## 🎯 타입 안전성

### 기본 규칙
- **strict 설정을 반드시 사용하세요**
- **any 타입 사용을 금지하고, unknown과 런타임 체크를 사용하세요**
- 모든 함수의 입력/출력 타입을 명시적으로 지정하세요
- 확장 가능한 객체는 interface를, 유니온/교집합은 type을 사용하세요

### 고급 TypeScript 기능 활용
- Type guards를 사용한 런타임 타입 체크
- Mapped types로 타입 변환
- Conditional types로 조건부 타입 정의
- Utility types 적극 활용 (Partial, Pick, Omit, Record 등)

## 🏗️ 코드 패턴

### 함수 시그니처
```typescript
// ✅ 올바른 예시
function processUser(user: User): Promise<ProcessedUser> {
  // 구현
}

// ❌ 잘못된 예시
function processUser(user: any): any {
  // 구현
}
```

### 인터페이스 vs 타입
```typescript
// ✅ 확장 가능한 객체 - interface 사용
interface User {
  id: string;
  name: string;
}

interface AdminUser extends User {
  permissions: Permission[];
}

// ✅ 유니온/교집합 - type 사용
type Status = 'pending' | 'completed' | 'failed';
type UserWithStatus = User & { status: Status };
```

### 타입 가드
```typescript
// ✅ 타입 가드 구현
function isUser(obj: unknown): obj is User {
  return typeof obj === 'object' && 
         obj !== null && 
         'id' in obj && 
         'name' in obj;
}
```

## 📝 명명 규칙
- 인터페이스: PascalCase (예: `UserProfile`)
- 타입: PascalCase (예: `TodoStatus`)
- 제네릭: 단일 대문자 (예: `T`, `K`, `V`)
- 함수명: camelCase (예: `getUserById`)
- 상수명: UPPER_SNAKE_CASE (예: `MAX_RETRY_COUNT`)

## 🔧 타입 유틸리티
- 입력 검증을 위한 타입 가드 함수 작성
- API 응답 타입과 클라이언트 타입 분리
- 제네릭을 활용한 재사용 가능한 타입 정의
- 브랜드 타입으로 타입 안전성 강화