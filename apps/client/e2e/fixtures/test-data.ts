/**
 * E2E 테스트용 테스트 데이터
 * 일관된 테스트 데이터를 제공하여 테스트의 신뢰성을 보장합니다.
 */

export interface TestTodo {
  title: string;
  priority: "high" | "medium" | "low";
  completed?: boolean;
}

/**
 * 기본 테스트 할 일 목록
 */
export const sampleTodos: TestTodo[] = [
  {
    title: "리액트 컴포넌트 최적화",
    priority: "high",
    completed: false,
  },
  {
    title: "API 문서 작성",
    priority: "medium",
    completed: true,
  },
  {
    title: "코드 리뷰 참여",
    priority: "medium",
    completed: false,
  },
  {
    title: "팀 미팅 준비",
    priority: "low",
    completed: true,
  },
  {
    title: "E2E 테스트 작성",
    priority: "high",
    completed: false,
  },
];

/**
 * 우선순위별 테스트 데이터
 */
export const priorityTestData = {
  high: ["긴급 버그 수정", "프로덕션 배포", "보안 패치 적용"],
  medium: ["기능 개발", "코드 리팩토링", "문서 업데이트"],
  low: ["디자인 개선", "성능 최적화", "라이브러리 업그레이드"],
};

/**
 * 검색 테스트 데이터
 */
export const searchTestData = [
  {
    title: "리액트 학습하기",
    priority: "high" as const,
    keywords: ["리액트", "학습", "react"],
  },
  {
    title: "자바스크립트 ES6 복습",
    priority: "medium" as const,
    keywords: ["자바스크립트", "ES6", "javascript"],
  },
  {
    title: "타입스크립트 마이그레이션",
    priority: "high" as const,
    keywords: ["타입스크립트", "마이그레이션", "typescript"],
  },
  {
    title: "CSS 애니메이션 구현",
    priority: "low" as const,
    keywords: ["CSS", "애니메이션", "animation"],
  },
];

/**
 * 긴 텍스트 테스트 데이터
 */
export const longTextData = {
  shortTitle: "짧은 제목",
  mediumTitle: "중간 길이의 할 일 제목입니다",
  longTitle:
    "매우 긴 할 일 제목으로 UI에서 어떻게 처리되는지 확인하기 위한 테스트 데이터입니다. 이 텍스트는 카드 레이아웃에서 올바르게 래핑되고 표시되어야 합니다.",
  veryLongTitle:
    "극도로 긴 할 일 제목으로써 사용자 인터페이스의 경계 케이스를 테스트하기 위해 만들어졌습니다. 이러한 긴 텍스트가 있을 때 레이아웃이 깨지지 않고 사용자 경험이 유지되는지 확인해야 합니다. 또한 이 텍스트는 모바일 환경에서도 적절히 처리되어야 하며, 접근성 요구사항도 충족해야 합니다.",
};

/**
 * 특수 문자 테스트 데이터
 */
export const specialCharacterData = [
  "HTML & CSS 학습",
  "API 연동 (REST/GraphQL)",
  "배포 스크립트 작성 - 프로덕션용",
  "사용자 경험 개선 #UX #UI",
  "성능 최적화 @2024년 1분기",
  "할 일 목록: 1) 계획 2) 실행 3) 검토",
  "이모지 테스트 🚀 💻 📝 ✅",
  "URL 테스트 https://example.com",
  "수식 테스트 y = mx + b (기울기: m)",
  "다국어 테스트 こんにちは 世界",
];

/**
 * 에러 테스트 케이스
 */
export const errorTestCases = [
  {
    description: "빈 문자열",
    input: "",
    expectedError: "제목을 입력해주세요",
  },
  {
    description: "공백만 있는 문자열",
    input: "   ",
    expectedError: "제목을 입력해주세요",
  },
  {
    description: "너무 긴 제목",
    input: "a".repeat(1000),
    expectedError: "제목이 너무 깁니다",
  },
];

/**
 * 성능 테스트용 대량 데이터
 */
export function generateLargeTodoList(count: number): TestTodo[] {
  const todos: TestTodo[] = [];
  const priorities: ("high" | "medium" | "low")[] = ["high", "medium", "low"];

  for (let i = 1; i <= count; i++) {
    todos.push({
      title: `할 일 #${i.toString().padStart(3, "0")} - 성능 테스트용`,
      priority: priorities[i % 3],
      completed: Math.random() > 0.5,
    });
  }

  return todos;
}

/**
 * 날짜 기반 테스트 데이터
 */
export const dateTestData = [
  {
    title: "오늘 할 일",
    priority: "high" as const,
    daysFromNow: 0,
  },
  {
    title: "어제 만든 할 일",
    priority: "medium" as const,
    daysFromNow: -1,
  },
  {
    title: "일주일 전 할 일",
    priority: "low" as const,
    daysFromNow: -7,
  },
];
