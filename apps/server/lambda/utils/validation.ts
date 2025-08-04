import { z } from 'zod';

/**
 * 입력 검증 스키마 및 유틸리티
 */

// Priority enum 검증
const PrioritySchema = z.enum(['low', 'medium', 'high'] as const);

// TODO 생성 요청 검증
export const CreateTodoRequestSchema = z.object({
  title: z.string()
    .min(1, '제목은 필수입니다')
    .max(200, '제목은 200자를 초과할 수 없습니다')
    .trim(),
  priority: PrioritySchema.optional().default('medium'),
  dueDate: z.string()
    .datetime({ message: '올바른 날짜 형식이 아닙니다' })
    .optional(),
});

// TODO 업데이트 요청 검증
export const UpdateTodoRequestSchema = z.object({
  title: z.string()
    .min(1, '제목은 필수입니다')
    .max(200, '제목은 200자를 초과할 수 없습니다')
    .trim()
    .optional(),
  completed: z.boolean().optional(),
  priority: PrioritySchema.optional(),
  dueDate: z.string()
    .datetime({ message: '올바른 날짜 형식이 아닙니다' })
    .nullable()
    .optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: '최소 하나의 필드는 업데이트되어야 합니다' }
);

// TODO 목록 조회 요청 검증
export const ListTodosRequestSchema = z.object({
  status: z.enum(['all', 'active', 'completed']).optional().default('all'),
  priority: PrioritySchema.optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});

// 로그인 요청 검증
export const LoginRequestSchema = z.object({
  username: z.string()
    .min(3, '사용자명은 최소 3자 이상이어야 합니다')
    .max(30, '사용자명은 30자를 초과할 수 없습니다')
    .regex(/^[a-zA-Z0-9_]+$/, '사용자명은 영문, 숫자, 언더스코어만 사용 가능합니다'),
  password: z.string()
    .min(6, '비밀번호는 최소 6자 이상이어야 합니다')
    .max(50, '비밀번호는 50자를 초과할 수 없습니다'),
});

// 토큰 갱신 요청 검증
export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1, '리프레시 토큰이 필요합니다'),
});

// ID 파라미터 검증
export const IdParamSchema = z.object({
  id: z.string()
    .min(1, 'ID는 필수입니다')
    .regex(/^[a-zA-Z0-9-_]+$/, '올바른 ID 형식이 아닙니다'),
});

/**
 * 요청 본문 파싱 및 검증
 */
export function parseAndValidate<T>(
  body: string | null,
  schema: z.ZodSchema<T>
): T {
  if (!body) {
    throw new Error('요청 본문이 필요합니다');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    throw new Error('올바른 JSON 형식이 아닙니다');
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.errors
      .map(err => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`검증 실패: ${errors}`);
  }

  return result.data;
}

/**
 * 쿼리 파라미터 검증
 */
export function validateQueryParams<T>(
  queryParams: Record<string, string | undefined> | null,
  schema: z.ZodSchema<T>
): T {
  const result = schema.safeParse(queryParams || {});
  if (!result.success) {
    const errors = result.error.errors
      .map(err => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`쿼리 파라미터 검증 실패: ${errors}`);
  }

  return result.data;
}

/**
 * 경로 파라미터 검증  
 */
export function validatePathParams<T>(
  pathParams: Record<string, string | undefined> | null,
  schema: z.ZodSchema<T>
): T {
  const result = schema.safeParse(pathParams || {});
  if (!result.success) {
    const errors = result.error.errors
      .map(err => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`경로 파라미터 검증 실패: ${errors}`);
  }

  return result.data;
}