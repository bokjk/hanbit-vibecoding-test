import { z } from 'zod';
import { InputSanitizer, SecurityMiddleware } from '@/middleware/input-sanitizer';

/**
 * 입력 검증 스키마 및 유틸리티 (보안 정화 통합)
 */

// Priority enum 검증
const PrioritySchema = z.enum(['low', 'medium', 'high'] as const);

// TODO 생성 요청 검증 (보안 정화 포함)
export const CreateTodoRequestSchema = z.object({
  title: z.string()
    .min(1, '제목은 필수입니다')
    .max(200, '제목은 200자를 초과할 수 없습니다')
    .trim()
    .transform((title) => {
      // 보안 정화 적용
      const sanitized = InputSanitizer.sanitizeHtml(title);
      const validation = InputSanitizer.detectMaliciousPattern(sanitized);
      
      if (!validation.isSafe) {
        throw new Error(`제목에 위험한 패턴이 탐지되었습니다: ${validation.detectedPatterns.join(', ')}`);
      }
      
      return sanitized;
    }),
  priority: PrioritySchema.optional().default('medium'),
  dueDate: z.string()
    .datetime({ message: '올바른 날짜 형식이 아닙니다' })
    .optional()
    .transform((date) => date ? InputSanitizer.sanitizeText(date) : date),
});

// TODO 업데이트 요청 검증 (보안 정화 포함)
export const UpdateTodoRequestSchema = z.object({
  title: z.string()
    .min(1, '제목은 필수입니다')
    .max(200, '제목은 200자를 초과할 수 없습니다')
    .trim()
    .transform((title) => {
      const sanitized = InputSanitizer.sanitizeHtml(title);
      const validation = InputSanitizer.detectMaliciousPattern(sanitized);
      
      if (!validation.isSafe) {
        throw new Error(`제목에 위험한 패턴이 탐지되었습니다: ${validation.detectedPatterns.join(', ')}`);
      }
      
      return sanitized;
    })
    .optional(),
  completed: z.boolean().optional(),
  priority: PrioritySchema.optional(),
  dueDate: z.string()
    .datetime({ message: '올바른 날짜 형식이 아닙니다' })
    .nullable()
    .transform((date) => date ? InputSanitizer.sanitizeText(date) : date)
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

// 로그인 요청 검증 (보안 정화 포함)
export const LoginRequestSchema = z.object({
  username: z.string()
    .min(3, '사용자명은 최소 3자 이상이어야 합니다')
    .max(30, '사용자명은 30자를 초과할 수 없습니다')
    .regex(/^[a-zA-Z0-9_]+$/, '사용자명은 영문, 숫자, 언더스코어만 사용 가능합니다')
    .transform((username) => InputSanitizer.sanitizeText(username)),
  password: z.string()
    .min(6, '비밀번호는 최소 6자 이상이어야 합니다')
    .max(50, '비밀번호는 50자를 초과할 수 없습니다')
    .transform((password) => {
      // 비밀번호는 특별한 정화 없이 기본 보안 검증만
      const validation = InputSanitizer.detectMaliciousPattern(password);
      if (!validation.isSafe) {
        throw new Error('비밀번호에 허용되지 않은 문자가 포함되어 있습니다');
      }
      return password;
    }),
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
 * 요청 본문 파싱 및 검증 (보안 강화)
 */
export function parseAndValidate<T>(
  body: string | null,
  schema: z.ZodSchema<T>
): T {
  if (!body) {
    throw new Error('요청 본문이 필요합니다');
  }

  // 입력 크기 검증 (DoS 공격 방지)
  if (!InputSanitizer.validateInputSize(body, 100000)) { // 100KB 제한
    throw new Error('요청 본문이 너무 큽니다');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    throw new Error('올바른 JSON 형식이 아닙니다');
  }

  // 보안 미들웨어를 통한 추가 정화
  const sanitizedData = SecurityMiddleware.sanitizeRequestBody(parsed);

  const result = schema.safeParse(sanitizedData);
  if (!result.success) {
    const errors = result.error.errors
      .map(err => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`검증 실패: ${errors}`);
  }

  return result.data;
}

/**
 * 보안 강화된 요청 본문 파싱 (상세 로깅 포함)
 */
export function parseAndValidateSecure<T>(
  body: string | null,
  schema: z.ZodSchema<T>,
  context?: { requestId?: string; userId?: string }
): T {
  try {
    return parseAndValidate(body, schema);
  } catch (error) {
    // 보안 관련 오류 로깅 (민감한 정보는 마스킹)
    if (context?.requestId) {
      console.warn(`보안 검증 실패 [${context.requestId}]:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: context.userId ? InputSanitizer.sanitizeText(context.userId) : 'unknown'
      });
    }
    throw error;
  }
}

/**
 * 쿼리 파라미터 검증 (보안 강화)
 */
export function validateQueryParams<T>(
  queryParams: Record<string, string | undefined> | null,
  schema: z.ZodSchema<T>
): T {
  // 보안 정화 적용
  const sanitizedParams = SecurityMiddleware.sanitizeQueryParams(queryParams || {});
  
  const result = schema.safeParse(sanitizedParams);
  if (!result.success) {
    const errors = result.error.errors
      .map(err => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`쿼리 파라미터 검증 실패: ${errors}`);
  }

  return result.data;
}

/**
 * 경로 파라미터 검증 (보안 강화)
 */
export function validatePathParams<T>(
  pathParams: Record<string, string | undefined> | null,
  schema: z.ZodSchema<T>
): T {
  // 보안 정화 적용
  const sanitizedParams = SecurityMiddleware.sanitizePathParams(pathParams || {});
  
  const result = schema.safeParse(sanitizedParams);
  if (!result.success) {
    const errors = result.error.errors
      .map(err => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    throw new Error(`경로 파라미터 검증 실패: ${errors}`);
  }

  return result.data;
}