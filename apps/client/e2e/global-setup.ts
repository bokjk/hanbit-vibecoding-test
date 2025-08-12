import { chromium, FullConfig } from "@playwright/test";

/**
 * 글로벌 테스트 설정
 * 모든 테스트 실행 전에 한 번 실행됩니다.
 */
async function globalSetup(config: FullConfig) {
  console.log("🚀 Playwright E2E 테스트 환경 초기화 중...");

  // 브라우저 인스턴스 생성 및 사전 준비
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 애플리케이션 로드 확인
    console.log("📱 애플리케이션 로드 상태 확인 중...");
    await page.goto(config.projects[0].use?.baseURL || "http://localhost:5173");

    // 기본 요소들이 로드되었는지 확인
    await page.waitForSelector('[data-testid="todo-header"]', {
      timeout: 30000,
    });
    await page.waitForSelector('[data-testid="todo-dashboard"]', {
      timeout: 10000,
    });

    console.log("✅ 애플리케이션이 성공적으로 로드되었습니다.");

    // 테스트 데이터 초기화 (localStorage 클리어)
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    console.log("🧹 테스트 환경 데이터가 초기화되었습니다.");
  } catch (error) {
    console.error("❌ 글로벌 설정 중 오류 발생:", error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;
