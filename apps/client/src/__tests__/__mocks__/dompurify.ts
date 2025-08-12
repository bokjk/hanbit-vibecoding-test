/**
 * DOMPurify 모킹 파일
 * 보안 관련 테스트에서 사용
 */
import { vi } from 'vitest';

const mockDOMPurify = {
  sanitize: vi.fn((input: string) => input), // 기본적으로 입력을 그대로 반환
  isValidAttribute: vi.fn(() => true),
  addHook: vi.fn(),
  removeHook: vi.fn(),
  removeAllHooks: vi.fn(),
};

export default mockDOMPurify;