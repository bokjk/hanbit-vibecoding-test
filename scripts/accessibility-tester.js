/**
 * 종합 접근성 테스트 자동화 스크립트
 * axe-core, Pa11y, Lighthouse 접근성 등을 통합 검사
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const axeCore = require('axe-core');
const { execSync } = require('child_process');

class AccessibilityTester {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:4173';
    this.outputDir = options.outputDir || './accessibility-reports';
    this.wcagLevel = options.wcagLevel || 'AA';
    this.wcagVersion = options.wcagVersion || '2.1';
    
    this.thresholds = {
      compliance: options.compliance || 95, // WCAG 준수율 %
      violations: {
        critical: options.critical || 0,
        serious: options.serious || 2,
        moderate: options.moderate || 5,
        minor: options.minor || 10
      },
      colorContrast: options.colorContrast || 4.5,
      keyboardNavigation: options.keyboardNavigation || 100, // %
      ...options.thresholds
    };
    
    this.results = {
      axe: {},
      pa11y: {},
      lighthouse: {},
      keyboard: {},
      colorContrast: {},
      screenReader: {},
      summary: {},
      passed: false
    };
  }

  /**
   * 전체 접근성 테스트 실행
   */
  async run() {
    console.log('♿ 종합 접근성 테스트 시작...');
    
    try {
      // 출력 디렉토리 생성
      await this.ensureOutputDirectory();
      
      // 1. axe-core 접근성 검사
      await this.runAxeTests();
      
      // 2. Pa11y 접근성 스캔
      await this.runPa11yTests();
      
      // 3. Lighthouse 접근성 검사
      await this.runLighthouseAccessibility();
      
      // 4. 키보드 네비게이션 테스트
      await this.testKeyboardNavigation();
      
      // 5. 색상 대비 검사
      await this.checkColorContrast();
      
      // 6. 스크린 리더 호환성 검사
      await this.testScreenReaderCompatibility();
      
      // 7. 결과 분석 및 보고서 생성
      await this.generateReport();
      
      // 8. 임계값 검증
      this.validateThresholds();
      
      console.log('✅ 종합 접근성 테스트 완료');
      return this.results;
      
    } catch (error) {
      console.error('❌ 접근성 테스트 실패:', error);
      this.results.passed = false;
      throw error;
    }
  }

  /**
   * axe-core 접근성 검사 실행
   */
  async runAxeTests() {
    console.log('🔍 axe-core 접근성 검사 중...');
    
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    try {
      // axe-core 스크립트 주입
      await page.addScriptTag({ 
        path: require.resolve('axe-core/axe.min.js')
      });
      
      const testPages = [
        { name: 'Home', url: this.baseUrl },
        { name: 'Todo List', url: `${this.baseUrl}/` },
        // 필요에 따라 추가 페이지 정의
      ];
      
      const axeResults = [];
      
      for (const testPage of testPages) {
        console.log(`  📄 ${testPage.name} 페이지 검사 중...`);
        
        await page.goto(testPage.url, { waitUntil: 'networkidle' });
        
        // axe-core 실행
        const result = await page.evaluate(async (wcagLevel, wcagVersion) => {
          return await axe.run(document, {
            tags: [`wcag${wcagVersion.replace('.', '')}${wcagLevel.toLowerCase()}`],
            rules: {
              'color-contrast': { enabled: true },
              'keyboard-navigation': { enabled: true },
              'focus-order': { enabled: true },
              'bypass-blocks': { enabled: true }
            }
          });
        }, this.wcagLevel, this.wcagVersion);
        
        // 결과 처리
        const pageResult = {
          name: testPage.name,
          url: testPage.url,
          violations: result.violations.map(violation => ({
            id: violation.id,
            impact: violation.impact,
            description: violation.description,
            help: violation.help,
            helpUrl: violation.helpUrl,
            nodes: violation.nodes.length,
            tags: violation.tags
          })),
          passes: result.passes.length,
          incomplete: result.incomplete.length,
          inapplicable: result.inapplicable.length,
          timestamp: new Date().toISOString()
        };
        
        axeResults.push(pageResult);
      }
      
      // 전체 결과 집계
      const totalViolations = axeResults.reduce((acc, page) => acc + page.violations.length, 0);
      const totalPasses = axeResults.reduce((acc, page) => acc + page.passes, 0);
      const totalTests = totalViolations + totalPasses;
      
      const violationsBySeverity = axeResults.reduce((acc, page) => {
        page.violations.forEach(violation => {
          const severity = this.mapAxeSeverity(violation.impact);
          acc[severity] = (acc[severity] || 0) + 1;
        });
        return acc;
      }, {});
      
      this.results.axe = {
        pages: axeResults,
        summary: {
          totalViolations,
          totalPasses,
          totalTests,
          complianceRate: totalTests > 0 ? Math.round((totalPasses / totalTests) * 100) : 100,
          violationsBySeverity
        }
      };
      
      // 상세 결과 저장
      fs.writeFileSync(
        path.join(this.outputDir, 'axe-results.json'),
        JSON.stringify(this.results.axe, null, 2)
      );
      
      console.log('  ✅ axe-core 검사 완료');
      
    } finally {
      await browser.close();
    }
  }

  /**
   * Pa11y 접근성 스캔 실행
   */
  async runPa11yTests() {
    console.log('🔍 Pa11y 접근성 스캔 중...');
    
    try {
      // Pa11y 설치 확인
      execSync('which pa11y', { stdio: 'ignore' });
    } catch {
      console.warn('  ⚠️ Pa11y가 설치되지 않아 건너뜁니다.');
      this.results.pa11y = { skipped: true };
      return;
    }
    
    try {
      const pa11yConfig = {
        standard: `WCAG${this.wcagVersion}${this.wcagLevel}`,
        ignore: [
          // 특정 규칙 무시 설정 (필요에 따라)
          'WCAG2AA.Principle4.Guideline4_1.4_1_2.H91.A.EmptyNoId'
        ],
        chromeLaunchConfig: {
          args: ['--no-sandbox', '--disable-dev-shm-usage']
        }
      };
      
      // Pa11y 실행
      const result = execSync(
        `pa11y ${this.baseUrl} --reporter json --standard ${pa11yConfig.standard}`,
        { encoding: 'utf8' }
      );
      
      const pa11yResults = JSON.parse(result);
      
      // 결과 처리
      const violationsBySeverity = pa11yResults.reduce((acc, issue) => {
        const severity = this.mapPa11ySeverity(issue.type);
        acc[severity] = (acc[severity] || 0) + 1;
        return acc;
      }, {});
      
      const totalIssues = pa11yResults.length;
      const complianceRate = Math.max(0, Math.round((1 - totalIssues / 100) * 100));
      
      this.results.pa11y = {
        totalIssues,
        issues: pa11yResults.map(issue => ({
          type: issue.type,
          code: issue.code,
          message: issue.message,
          context: issue.context,
          selector: issue.selector,
          runner: issue.runner,
          runnerExtras: issue.runnerExtras
        })),
        violationsBySeverity,
        complianceRate,
        timestamp: new Date().toISOString()
      };
      
      // 결과 저장
      fs.writeFileSync(
        path.join(this.outputDir, 'pa11y-results.json'),
        JSON.stringify(this.results.pa11y, null, 2)
      );
      
      console.log('  ✅ Pa11y 스캔 완료');
      
    } catch (error) {
      console.warn('  ⚠️ Pa11y 실행 실패:', error.message);
      this.results.pa11y = { error: error.message };
    }
  }

  /**
   * Lighthouse 접근성 검사 실행
   */
  async runLighthouseAccessibility() {
    console.log('🔍 Lighthouse 접근성 검사 중...');
    
    try {
      // Lighthouse CLI 설치 확인
      execSync('which lighthouse', { stdio: 'ignore' });
    } catch {
      console.warn('  ⚠️ Lighthouse가 설치되지 않아 건너뜁니다.');
      this.results.lighthouse = { skipped: true };
      return;
    }
    
    try {
      const result = execSync(
        `lighthouse ${this.baseUrl} --only-categories=accessibility --output=json --chrome-flags="--headless"`,
        { encoding: 'utf8' }
      );
      
      const lighthouseResult = JSON.parse(result);
      const accessibilityCategory = lighthouseResult.categories.accessibility;
      const audits = lighthouseResult.audits;
      
      // 접근성 관련 감사 항목 추출
      const accessibilityAudits = {};
      Object.entries(audits).forEach(([auditId, audit]) => {
        if (audit.id.includes('accessibility') || audit.score !== null) {
          accessibilityAudits[auditId] = {
            score: audit.score,
            displayValue: audit.displayValue,
            title: audit.title,
            description: audit.description
          };
        }
      });
      
      this.results.lighthouse = {
        score: Math.round(accessibilityCategory.score * 100),
        audits: accessibilityAudits,
        timestamp: new Date().toISOString()
      };
      
      // 결과 저장
      fs.writeFileSync(
        path.join(this.outputDir, 'lighthouse-accessibility.json'),
        JSON.stringify(this.results.lighthouse, null, 2)
      );
      
      console.log('  ✅ Lighthouse 접근성 검사 완료');
      
    } catch (error) {
      console.warn('  ⚠️ Lighthouse 실행 실패:', error.message);
      this.results.lighthouse = { error: error.message };
    }
  }

  /**
   * 키보드 네비게이션 테스트
   */
  async testKeyboardNavigation() {
    console.log('⌨️ 키보드 네비게이션 테스트 중...');
    
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    try {
      await page.goto(this.baseUrl, { waitUntil: 'networkidle' });
      
      // 모든 포커스 가능한 요소 찾기
      const focusableElements = await page.evaluate(() => {
        const selector = [
          'a[href]',
          'button:not([disabled])',
          'textarea:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          '[tabindex]:not([tabindex="-1"])'
        ].join(',');
        
        return Array.from(document.querySelectorAll(selector))
          .map(el => ({
            tagName: el.tagName,
            type: el.type,
            id: el.id,
            className: el.className,
            ariaLabel: el.getAttribute('aria-label'),
            tabIndex: el.tabIndex
          }));
      });
      
      // 탭 순서 테스트
      const tabOrder = [];
      let tabCount = 0;
      const maxTabs = Math.min(focusableElements.length + 5, 50); // 무한 루프 방지
      
      // 첫 번째 요소에 포커스
      await page.keyboard.press('Tab');
      
      while (tabCount < maxTabs) {
        const activeElement = await page.evaluate(() => {
          const el = document.activeElement;
          return el ? {
            tagName: el.tagName,
            id: el.id,
            className: el.className,
            tabIndex: el.tabIndex,
            isVisible: el.offsetParent !== null
          } : null;
        });
        
        if (activeElement && activeElement.isVisible) {
          tabOrder.push(activeElement);
        }
        
        await page.keyboard.press('Tab');
        tabCount++;
        
        // Body로 돌아오면 종료
        const currentFocus = await page.evaluate(() => document.activeElement.tagName);
        if (currentFocus === 'BODY' && tabCount > focusableElements.length) {
          break;
        }
      }
      
      // 키보드 네비게이션 결과 분석
      const navigationScore = this.calculateKeyboardScore(focusableElements, tabOrder);
      
      this.results.keyboard = {
        focusableElementsCount: focusableElements.length,
        tabOrder,
        navigationScore,
        issues: this.identifyKeyboardIssues(focusableElements, tabOrder),
        timestamp: new Date().toISOString()
      };
      
      // 결과 저장
      fs.writeFileSync(
        path.join(this.outputDir, 'keyboard-navigation.json'),
        JSON.stringify(this.results.keyboard, null, 2)
      );
      
      console.log('  ✅ 키보드 네비게이션 테스트 완료');
      
    } finally {
      await browser.close();
    }
  }

  /**
   * 색상 대비 검사
   */
  async checkColorContrast() {
    console.log('🎨 색상 대비 검사 중...');
    
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    try {
      await page.goto(this.baseUrl, { waitUntil: 'networkidle' });
      
      // 텍스트 요소들의 색상 대비 검사
      const contrastResults = await page.evaluate((wcagLevel) => {
        const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, button, label, li');
        const results = [];
        
        Array.from(textElements).forEach(element => {
          const styles = window.getComputedStyle(element);
          const textColor = styles.color;
          const backgroundColor = styles.backgroundColor;
          
          // 투명한 배경색인 경우 부모 요소의 배경색 찾기
          let bgColor = backgroundColor;
          let parent = element.parentElement;
          
          while (parent && (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent')) {
            const parentStyles = window.getComputedStyle(parent);
            bgColor = parentStyles.backgroundColor;
            parent = parent.parentElement;
          }
          
          // 기본 배경색 설정
          if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
            bgColor = 'rgb(255, 255, 255)'; // 기본 흰색
          }
          
          results.push({
            element: {
              tagName: element.tagName,
              id: element.id,
              className: element.className,
              text: element.textContent.trim().substring(0, 50)
            },
            colors: {
              text: textColor,
              background: bgColor
            },
            fontSize: parseFloat(styles.fontSize),
            fontWeight: styles.fontWeight
          });
        });
        
        return results;
      }, this.wcagLevel);
      
      // 색상 대비 비율 계산
      const contrastAnalysis = contrastResults.map(item => {
        const contrast = this.calculateContrastRatio(item.colors.text, item.colors.background);
        const requiredRatio = this.getRequiredContrastRatio(item.fontSize, item.fontWeight);
        
        return {
          ...item,
          contrast,
          requiredRatio,
          passed: contrast >= requiredRatio,
          wcagLevel: contrast >= 4.5 ? 'AA' : contrast >= 3 ? 'A' : 'Fail'
        };
      });
      
      const passedContrast = contrastAnalysis.filter(item => item.passed).length;
      const totalElements = contrastAnalysis.length;
      const contrastScore = totalElements > 0 ? Math.round((passedContrast / totalElements) * 100) : 100;
      
      this.results.colorContrast = {
        totalElements,
        passedElements: passedContrast,
        failedElements: totalElements - passedContrast,
        contrastScore,
        details: contrastAnalysis.filter(item => !item.passed), // 실패한 항목만 저장
        timestamp: new Date().toISOString()
      };
      
      // 결과 저장
      fs.writeFileSync(
        path.join(this.outputDir, 'color-contrast.json'),
        JSON.stringify(this.results.colorContrast, null, 2)
      );
      
      console.log('  ✅ 색상 대비 검사 완료');
      
    } finally {
      await browser.close();
    }
  }

  /**
   * 스크린 리더 호환성 검사
   */
  async testScreenReaderCompatibility() {
    console.log('📢 스크린 리더 호환성 검사 중...');
    
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    try {
      await page.goto(this.baseUrl, { waitUntil: 'networkidle' });
      
      // ARIA 속성 및 시맨틱 요소 검사
      const ariaAnalysis = await page.evaluate(() => {
        const results = {
          ariaLabels: 0,
          ariaDescriptions: 0,
          ariaRoles: 0,
          semanticElements: 0,
          images: { total: 0, withAlt: 0 },
          forms: { total: 0, withLabels: 0 },
          headings: { total: 0, properStructure: true },
          landmarks: 0
        };
        
        // ARIA 레이블 검사
        results.ariaLabels = document.querySelectorAll('[aria-label]').length;
        results.ariaDescriptions = document.querySelectorAll('[aria-describedby]').length;
        results.ariaRoles = document.querySelectorAll('[role]').length;
        
        // 시맨틱 요소 검사
        const semanticTags = ['header', 'nav', 'main', 'section', 'article', 'aside', 'footer'];
        results.semanticElements = semanticTags.reduce((count, tag) => 
          count + document.querySelectorAll(tag).length, 0
        );
        
        // 이미지 alt 속성 검사
        const images = document.querySelectorAll('img');
        results.images.total = images.length;
        results.images.withAlt = Array.from(images).filter(img => 
          img.hasAttribute('alt') && img.alt.trim() !== ''
        ).length;
        
        // 폼 레이블 검사
        const inputs = document.querySelectorAll('input, select, textarea');
        results.forms.total = inputs.length;
        results.forms.withLabels = Array.from(inputs).filter(input => {
          const id = input.id;
          const hasLabel = id && document.querySelector(`label[for="${id}"]`);
          const hasAriaLabel = input.hasAttribute('aria-label');
          const hasAriaLabelledby = input.hasAttribute('aria-labelledby');
          
          return hasLabel || hasAriaLabel || hasAriaLabelledby;
        }).length;
        
        // 헤딩 구조 검사
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        results.headings.total = headings.length;
        
        let previousLevel = 0;
        results.headings.properStructure = Array.from(headings).every(heading => {
          const currentLevel = parseInt(heading.tagName.charAt(1));
          const isValidLevel = currentLevel <= previousLevel + 1;
          previousLevel = currentLevel;
          return isValidLevel;
        });
        
        // 랜드마크 검사
        const landmarks = document.querySelectorAll('[role="banner"], [role="navigation"], [role="main"], [role="contentinfo"], [role="complementary"], [role="search"]');
        results.landmarks = landmarks.length;
        
        return results;
      });
      
      // 스크린 리더 점수 계산
      const screenReaderScore = this.calculateScreenReaderScore(ariaAnalysis);
      
      this.results.screenReader = {
        ...ariaAnalysis,
        score: screenReaderScore,
        recommendations: this.generateScreenReaderRecommendations(ariaAnalysis),
        timestamp: new Date().toISOString()
      };
      
      // 결과 저장
      fs.writeFileSync(
        path.join(this.outputDir, 'screen-reader-compatibility.json'),
        JSON.stringify(this.results.screenReader, null, 2)
      );
      
      console.log('  ✅ 스크린 리더 호환성 검사 완료');
      
    } finally {
      await browser.close();
    }
  }

  /**
   * axe 심각도 매핑
   */
  mapAxeSeverity(impact) {
    const mapping = {
      'critical': 'critical',
      'serious': 'serious',
      'moderate': 'moderate',
      'minor': 'minor'
    };
    return mapping[impact] || 'minor';
  }

  /**
   * Pa11y 심각도 매핑
   */
  mapPa11ySeverity(type) {
    const mapping = {
      'error': 'serious',
      'warning': 'moderate',
      'notice': 'minor'
    };
    return mapping[type] || 'minor';
  }

  /**
   * 키보드 점수 계산
   */
  calculateKeyboardScore(focusableElements, tabOrder) {
    if (focusableElements.length === 0) return 100;
    
    const validTabElements = tabOrder.filter(el => el && el.isVisible);
    const coverage = Math.min(validTabElements.length / focusableElements.length, 1);
    
    return Math.round(coverage * 100);
  }

  /**
   * 키보드 이슈 식별
   */
  identifyKeyboardIssues(focusableElements, tabOrder) {
    const issues = [];
    
    // 포커스 가능한 요소가 탭 순서에 없는 경우
    const tabOrderIds = new Set(tabOrder.map(el => el.id).filter(Boolean));
    const missingElements = focusableElements.filter(el => 
      el.id && !tabOrderIds.has(el.id)
    );
    
    if (missingElements.length > 0) {
      issues.push({
        type: 'missing-tab-order',
        message: `${missingElements.length}개 요소가 키보드 네비게이션에서 누락됨`,
        elements: missingElements
      });
    }
    
    // 잘못된 tabindex 값 검사
    const negativeTabIndex = focusableElements.filter(el => el.tabIndex < 0);
    if (negativeTabIndex.length > 0) {
      issues.push({
        type: 'negative-tabindex',
        message: `${negativeTabIndex.length}개 요소에 음수 tabindex 설정됨`,
        elements: negativeTabIndex
      });
    }
    
    return issues;
  }

  /**
   * 색상 대비 비율 계산
   */
  calculateContrastRatio(textColor, backgroundColor) {
    // 간단한 구현 (실제로는 더 정확한 계산이 필요)
    const getRGB = (color) => {
      const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
      }
      return [0, 0, 0]; // 기본값
    };
    
    const getLuminance = (rgb) => {
      const [r, g, b] = rgb.map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    
    const textRGB = getRGB(textColor);
    const bgRGB = getRGB(backgroundColor);
    
    const textLuminance = getLuminance(textRGB);
    const bgLuminance = getLuminance(bgRGB);
    
    const lighter = Math.max(textLuminance, bgLuminance);
    const darker = Math.min(textLuminance, bgLuminance);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * 필요한 대비 비율 계산
   */
  getRequiredContrastRatio(fontSize, fontWeight) {
    const isLargeText = fontSize >= 18 || (fontSize >= 14 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700));
    
    if (this.wcagLevel === 'AAA') {
      return isLargeText ? 4.5 : 7;
    } else {
      return isLargeText ? 3 : 4.5;
    }
  }

  /**
   * 스크린 리더 점수 계산
   */
  calculateScreenReaderScore(analysis) {
    let score = 0;
    let totalChecks = 0;
    
    // 이미지 alt 속성
    if (analysis.images.total > 0) {
      score += (analysis.images.withAlt / analysis.images.total) * 20;
      totalChecks += 20;
    }
    
    // 폼 레이블
    if (analysis.forms.total > 0) {
      score += (analysis.forms.withLabels / analysis.forms.total) * 25;
      totalChecks += 25;
    }
    
    // 헤딩 구조
    if (analysis.headings.total > 0) {
      score += analysis.headings.properStructure ? 15 : 0;
      totalChecks += 15;
    }
    
    // ARIA 사용
    const ariaScore = Math.min((analysis.ariaLabels + analysis.ariaDescriptions + analysis.ariaRoles) / 5, 1) * 20;
    score += ariaScore;
    totalChecks += 20;
    
    // 시맨틱 요소
    const semanticScore = Math.min(analysis.semanticElements / 3, 1) * 20;
    score += semanticScore;
    totalChecks += 20;
    
    return totalChecks > 0 ? Math.round(score / totalChecks * 100) : 100;
  }

  /**
   * 스크린 리더 권장사항 생성
   */
  generateScreenReaderRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.images.total > 0 && analysis.images.withAlt / analysis.images.total < 1) {
      recommendations.push('모든 이미지에 의미있는 alt 속성을 추가하세요.');
    }
    
    if (analysis.forms.total > 0 && analysis.forms.withLabels / analysis.forms.total < 1) {
      recommendations.push('모든 폼 요소에 적절한 레이블을 추가하세요.');
    }
    
    if (!analysis.headings.properStructure) {
      recommendations.push('헤딩 태그의 순서를 올바르게 구성하세요 (h1 → h2 → h3).');
    }
    
    if (analysis.ariaLabels + analysis.ariaDescriptions < 3) {
      recommendations.push('상호작용 요소에 ARIA 레이블을 추가하세요.');
    }
    
    if (analysis.semanticElements < 3) {
      recommendations.push('더 많은 시맨틱 HTML 요소를 사용하세요 (header, nav, main 등).');
    }
    
    if (analysis.landmarks < 2) {
      recommendations.push('페이지 구조를 나타내는 랜드마크 역할을 추가하세요.');
    }
    
    return recommendations;
  }

  /**
   * 임계값 검증
   */
  validateThresholds() {
    console.log('🎯 접근성 임계값 검증 중...');
    
    const failures = [];
    
    // axe-core 결과 검증
    if (this.results.axe.summary) {
      const axeCompliance = this.results.axe.summary.complianceRate;
      if (axeCompliance < this.thresholds.compliance) {
        failures.push(`axe-core 준수율: ${axeCompliance}% < ${this.thresholds.compliance}%`);
      }
      
      // 심각도별 위반 검증
      const violations = this.results.axe.summary.violationsBySeverity;
      Object.entries(this.thresholds.violations).forEach(([severity, threshold]) => {
        const count = violations[severity] || 0;
        if (count > threshold) {
          failures.push(`${severity} 수준 위반: ${count}개 > ${threshold}개`);
        }
      });
    }
    
    // Pa11y 결과 검증
    if (this.results.pa11y.complianceRate !== undefined) {
      const pa11yCompliance = this.results.pa11y.complianceRate;
      if (pa11yCompliance < this.thresholds.compliance) {
        failures.push(`Pa11y 준수율: ${pa11yCompliance}% < ${this.thresholds.compliance}%`);
      }
    }
    
    // 키보드 네비게이션 검증
    if (this.results.keyboard.navigationScore < this.thresholds.keyboardNavigation) {
      failures.push(`키보드 네비게이션: ${this.results.keyboard.navigationScore}% < ${this.thresholds.keyboardNavigation}%`);
    }
    
    // 색상 대비 검증
    if (this.results.colorContrast.contrastScore !== undefined) {
      const contrastRate = this.results.colorContrast.contrastScore;
      const requiredRate = 90; // 90% 이상 권장
      if (contrastRate < requiredRate) {
        failures.push(`색상 대비 통과율: ${contrastRate}% < ${requiredRate}%`);
      }
    }
    
    this.results.passed = failures.length === 0;
    this.results.failures = failures;
    
    // 전체 요약 생성
    this.results.summary = {
      overallCompliance: this.calculateOverallCompliance(),
      totalViolations: this.calculateTotalViolations(),
      recommendations: this.generateOverallRecommendations()
    };
    
    if (this.results.passed) {
      console.log('  ✅ 모든 접근성 임계값 통과');
    } else {
      console.log('  ❌ 접근성 임계값 실패:');
      failures.forEach(failure => console.log(`    - ${failure}`));
    }
  }

  /**
   * 전체 준수율 계산
   */
  calculateOverallCompliance() {
    const scores = [];
    
    if (this.results.axe.summary?.complianceRate !== undefined) {
      scores.push(this.results.axe.summary.complianceRate);
    }
    
    if (this.results.pa11y.complianceRate !== undefined) {
      scores.push(this.results.pa11y.complianceRate);
    }
    
    if (this.results.lighthouse.score !== undefined) {
      scores.push(this.results.lighthouse.score);
    }
    
    if (this.results.keyboard.navigationScore !== undefined) {
      scores.push(this.results.keyboard.navigationScore);
    }
    
    if (this.results.colorContrast.contrastScore !== undefined) {
      scores.push(this.results.colorContrast.contrastScore);
    }
    
    if (this.results.screenReader.score !== undefined) {
      scores.push(this.results.screenReader.score);
    }
    
    return scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 100;
  }

  /**
   * 전체 위반사항 개수 계산
   */
  calculateTotalViolations() {
    let total = 0;
    
    if (this.results.axe.summary?.totalViolations) {
      total += this.results.axe.summary.totalViolations;
    }
    
    if (this.results.pa11y.totalIssues) {
      total += this.results.pa11y.totalIssues;
    }
    
    return total;
  }

  /**
   * 전체 권장사항 생성
   */
  generateOverallRecommendations() {
    const recommendations = [];
    
    if (this.results.axe.summary?.violationsBySeverity.critical > 0) {
      recommendations.push('중요한 접근성 위반사항을 즉시 수정하세요.');
    }
    
    if (this.results.colorContrast.failedElements > 0) {
      recommendations.push('색상 대비가 부족한 텍스트를 개선하세요.');
    }
    
    if (this.results.keyboard.issues?.length > 0) {
      recommendations.push('키보드 네비게이션 문제를 해결하세요.');
    }
    
    if (this.results.screenReader.recommendations?.length > 0) {
      recommendations.push(...this.results.screenReader.recommendations);
    }
    
    return recommendations;
  }

  /**
   * 접근성 보고서 생성
   */
  async generateReport() {
    console.log('📄 접근성 보고서 생성 중...');
    
    const report = this.generateMarkdownReport();
    
    // Markdown 보고서 저장
    fs.writeFileSync(
      path.join(this.outputDir, 'accessibility-report.md'),
      report
    );
    
    // JSON 요약 저장
    fs.writeFileSync(
      path.join(this.outputDir, 'accessibility-summary.json'),
      JSON.stringify(this.results, null, 2)
    );
    
    console.log('  ✅ 접근성 보고서 생성 완료');
  }

  /**
   * Markdown 형식의 접근성 보고서 생성
   */
  generateMarkdownReport() {
    const { axe, pa11y, lighthouse, keyboard, colorContrast, screenReader, summary } = this.results;
    
    let report = `# ♿ 종합 접근성 테스트 보고서\n\n`;
    report += `**생성 시간**: ${new Date().toLocaleString('ko-KR')}\n`;
    report += `**WCAG 기준**: ${this.wcagVersion} ${this.wcagLevel}\n\n`;
    
    // 전체 요약
    report += `## 📊 전체 요약\n\n`;
    report += `- **전체 준수율**: ${summary.overallCompliance}%\n`;
    report += `- **총 위반사항**: ${summary.totalViolations}개\n`;
    report += `- **전체 통과**: ${this.results.passed ? '✅ 예' : '❌ 아니오'}\n\n`;
    
    // axe-core 결과
    if (axe.summary) {
      report += `## 🔍 axe-core 결과\n\n`;
      report += `- **준수율**: ${axe.summary.complianceRate}%\n`;
      report += `- **총 테스트**: ${axe.summary.totalTests}개\n`;
      report += `- **통과**: ${axe.summary.totalPasses}개\n`;
      report += `- **위반**: ${axe.summary.totalViolations}개\n\n`;
      
      if (axe.summary.violationsBySeverity) {
        report += `### 심각도별 위반사항\n\n`;
        Object.entries(axe.summary.violationsBySeverity).forEach(([severity, count]) => {
          report += `- **${severity.toUpperCase()}**: ${count}개\n`;
        });
        report += `\n`;
      }
    }
    
    // Lighthouse 결과
    if (lighthouse.score !== undefined) {
      report += `## 🔍 Lighthouse 접근성 점수\n\n`;
      report += `**점수**: ${lighthouse.score}%\n\n`;
    }
    
    // 키보드 네비게이션
    if (keyboard.navigationScore !== undefined) {
      report += `## ⌨️ 키보드 네비게이션\n\n`;
      report += `- **네비게이션 점수**: ${keyboard.navigationScore}%\n`;
      report += `- **포커스 가능 요소**: ${keyboard.focusableElementsCount}개\n`;
      
      if (keyboard.issues?.length > 0) {
        report += `\n### 발견된 문제\n\n`;
        keyboard.issues.forEach(issue => {
          report += `- ${issue.message}\n`;
        });
        report += `\n`;
      }
    }
    
    // 색상 대비
    if (colorContrast.contrastScore !== undefined) {
      report += `## 🎨 색상 대비\n\n`;
      report += `- **대비 점수**: ${colorContrast.contrastScore}%\n`;
      report += `- **검사 요소**: ${colorContrast.totalElements}개\n`;
      report += `- **통과**: ${colorContrast.passedElements}개\n`;
      report += `- **실패**: ${colorContrast.failedElements}개\n\n`;
    }
    
    // 스크린 리더 호환성
    if (screenReader.score !== undefined) {
      report += `## 📢 스크린 리더 호환성\n\n`;
      report += `- **호환성 점수**: ${screenReader.score}%\n`;
      report += `- **ARIA 레이블**: ${screenReader.ariaLabels}개\n`;
      report += `- **시맨틱 요소**: ${screenReader.semanticElements}개\n`;
      report += `- **이미지 alt**: ${screenReader.images.withAlt}/${screenReader.images.total}개\n`;
      report += `- **폼 레이블**: ${screenReader.forms.withLabels}/${screenReader.forms.total}개\n\n`;
    }
    
    // 권장사항
    if (summary.recommendations?.length > 0) {
      report += `## 💡 권장사항\n\n`;
      summary.recommendations.forEach(recommendation => {
        report += `- ${recommendation}\n`;
      });
      report += `\n`;
    }
    
    // 전체 결과
    report += `## 🎯 전체 결과\n\n`;
    if (this.results.passed) {
      report += `✅ **모든 접근성 임계값을 통과했습니다!**\n\n`;
      report += `웹 접근성 기준을 충족하여 모든 사용자가 편리하게 이용할 수 있습니다.\n`;
    } else {
      report += `❌ **일부 접근성 기준을 충족하지 못했습니다.**\n\n`;
      report += `개선이 필요한 항목:\n`;
      this.results.failures.forEach(failure => {
        report += `- ${failure}\n`;
      });
    }
    
    return report;
  }

  /**
   * 출력 디렉토리 확인 및 생성
   */
  async ensureOutputDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }
}

// CLI에서 직접 실행할 때
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  // 명령행 인수 파싱
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    
    if (key && value) {
      if (['compliance', 'critical', 'serious', 'moderate', 'minor', 'colorContrast', 'keyboardNavigation'].includes(key)) {
        options[key] = parseFloat(value);
      } else {
        options[key] = value;
      }
    }
  }
  
  const tester = new AccessibilityTester(options);
  
  tester.run()
    .then(results => {
      console.log('\n♿ 접근성 테스트 결과:');
      console.log(`전체 통과: ${results.passed ? '✅' : '❌'}`);
      console.log(`전체 준수율: ${results.summary.overallCompliance}%`);
      
      if (!results.passed) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('접근성 테스트 실행 실패:', error);
      process.exit(1);
    });
}

module.exports = AccessibilityTester;