import { FullConfig } from '@playwright/test';

/**
 * 글로벌 테스트 정리
 * 모든 테스트 완료 후에 한 번 실행됩니다.
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Playwright E2E 테스트 환경 정리 중...');
  
  try {
    // 테스트 결과 요약
    console.log('📊 테스트 실행 완료');
    console.log(`🌐 테스트된 프로젝트 수: ${config.projects.length}`);
    
    // 추가 정리 작업이 필요한 경우 여기에 구현
    // 예: 테스트 데이터베이스 정리, 임시 파일 삭제 등
    
    console.log('✅ 테스트 환경 정리가 완료되었습니다.');
    
  } catch (error) {
    console.error('❌ 글로벌 정리 중 오류 발생:', error);
  }
}

export default globalTeardown;