/**
 * 성능 벤치마크 테스트 스크립트
 * Lighthouse CI, Bundle Analyzer, API 성능 측정을 통합
 */

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PerformanceBenchmark {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:4173';
    this.outputDir = options.outputDir || './performance-reports';
    this.thresholds = {
      performance: options.performance || 90,
      accessibility: options.accessibility || 95,
      bestPractices: options.bestPractices || 90,
      seo: options.seo || 85,
      bundleSize: options.bundleSize || 500, // KB
      apiResponseTime: options.apiResponseTime || 200, // ms
      ...options.thresholds
    };
    
    this.results = {
      lighthouse: {},
      bundleAnalysis: {},
      apiPerformance: {},
      summary: {},
      passed: false
    };
  }

  /**
   * 전체 성능 벤치마크 실행
   */
  async run() {
    console.log('🚀 성능 벤치마크 테스트 시작...');
    
    try {
      // 출력 디렉토리 생성
      await this.ensureOutputDirectory();
      
      // 1. Lighthouse 성능 측정
      await this.runLighthouseTests();
      
      // 2. 번들 크기 분석
      await this.analyzeBundleSize();
      
      // 3. API 성능 측정 (개발 환경에서만)
      if (process.env.NODE_ENV !== 'production') {
        await this.measureApiPerformance();
      }
      
      // 4. 결과 분석 및 보고서 생성
      await this.generateReport();
      
      // 5. 임계값 검증
      this.validateThresholds();
      
      console.log('✅ 성능 벤치마크 테스트 완료');
      return this.results;
      
    } catch (error) {
      console.error('❌ 성능 벤치마크 테스트 실패:', error);
      this.results.passed = false;
      throw error;
    }
  }

  /**
   * Lighthouse 성능 테스트 실행
   */
  async runLighthouseTests() {
    console.log('📊 Lighthouse 성능 측정 중...');
    
    const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
    const options = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      port: chrome.port,
    };

    try {
      const runnerResult = await lighthouse(this.baseUrl, options);
      const reportJson = runnerResult.lhr;
      
      // 카테고리 점수 추출
      const categories = reportJson.categories;
      this.results.lighthouse = {
        performance: Math.round(categories.performance.score * 100),
        accessibility: Math.round(categories.accessibility.score * 100),
        bestPractices: Math.round(categories['best-practices'].score * 100),
        seo: Math.round(categories.seo.score * 100),
        timestamp: new Date().toISOString()
      };
      
      // Core Web Vitals 추출
      const audits = reportJson.audits;
      this.results.lighthouse.webVitals = {
        FCP: audits['first-contentful-paint']?.numericValue || null,
        LCP: audits['largest-contentful-paint']?.numericValue || null,
        CLS: audits['cumulative-layout-shift']?.numericValue || null,
        FID: audits['max-potential-fid']?.numericValue || null,
        TTI: audits['interactive']?.numericValue || null
      };
      
      // 상세 보고서 저장
      fs.writeFileSync(
        path.join(this.outputDir, 'lighthouse-report.json'),
        JSON.stringify(reportJson, null, 2)
      );
      
      // HTML 보고서 생성
      const reportHtml = runnerResult.report;
      fs.writeFileSync(
        path.join(this.outputDir, 'lighthouse-report.html'),
        reportHtml
      );
      
      console.log('  ✅ Lighthouse 측정 완료');
      
    } finally {
      await chrome.kill();
    }
  }

  /**
   * 번들 크기 분석
   */
  async analyzeBundleSize() {
    console.log('📦 번들 크기 분석 중...');
    
    try {
      // Webpack Bundle Analyzer 실행 (정적 모드)
      const clientDistPath = path.resolve('./apps/client/dist');
      
      if (!fs.existsSync(clientDistPath)) {
        console.warn('⚠️  클라이언트 빌드 파일을 찾을 수 없습니다. 빌드를 먼저 실행하세요.');
        return;
      }
      
      // 빌드된 파일 크기 계산
      const bundleStats = this.calculateBundleStats(clientDistPath);
      
      this.results.bundleAnalysis = {
        totalSize: bundleStats.totalSize,
        jsSize: bundleStats.jsSize,
        cssSize: bundleStats.cssSize,
        assetSize: bundleStats.assetSize,
        gzippedEstimate: Math.round(bundleStats.totalSize * 0.3), // 대략적인 gzip 압축률
        files: bundleStats.files,
        timestamp: new Date().toISOString()
      };
      
      // 번들 분석 결과 저장
      fs.writeFileSync(
        path.join(this.outputDir, 'bundle-analysis.json'),
        JSON.stringify(this.results.bundleAnalysis, null, 2)
      );
      
      console.log('  ✅ 번들 분석 완료');
      
    } catch (error) {
      console.error('  ❌ 번들 분석 실패:', error.message);
    }
  }

  /**
   * API 성능 측정
   */
  async measureApiPerformance() {
    console.log('🌐 API 성능 측정 중...');
    
    const apiEndpoints = [
      { name: 'Health Check', url: '/health', method: 'GET' },
      { name: 'Todo List', url: '/api/todos', method: 'GET' },
      { name: 'Create Todo', url: '/api/todos', method: 'POST', body: { title: 'Test Todo' } },
    ];
    
    const results = [];
    
    for (const endpoint of apiEndpoints) {
      try {
        const startTime = Date.now();
        
        const response = await fetch(`${this.baseUrl}${endpoint.url}`, {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          },
          body: endpoint.body ? JSON.stringify(endpoint.body) : undefined
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        results.push({
          name: endpoint.name,
          url: endpoint.url,
          method: endpoint.method,
          responseTime,
          statusCode: response.status,
          success: response.ok
        });
        
      } catch (error) {
        console.error(`  ❌ ${endpoint.name} 측정 실패:`, error.message);
        results.push({
          name: endpoint.name,
          url: endpoint.url,
          method: endpoint.method,
          responseTime: null,
          statusCode: null,
          success: false,
          error: error.message
        });
      }
    }
    
    this.results.apiPerformance = {
      endpoints: results,
      averageResponseTime: this.calculateAverageResponseTime(results),
      timestamp: new Date().toISOString()
    };
    
    // API 성능 결과 저장
    fs.writeFileSync(
      path.join(this.outputDir, 'api-performance.json'),
      JSON.stringify(this.results.apiPerformance, null, 2)
    );
    
    console.log('  ✅ API 성능 측정 완료');
  }

  /**
   * 번들 통계 계산
   */
  calculateBundleStats(distPath) {
    const files = this.getAllFiles(distPath);
    const stats = {
      totalSize: 0,
      jsSize: 0,
      cssSize: 0,
      assetSize: 0,
      files: []
    };
    
    files.forEach(file => {
      const stat = fs.statSync(file);
      const size = stat.size;
      const relativePath = path.relative(distPath, file);
      const ext = path.extname(file).toLowerCase();
      
      stats.totalSize += size;
      
      const fileInfo = {
        path: relativePath,
        size,
        sizeKB: Math.round(size / 1024 * 100) / 100
      };
      
      if (['.js', '.mjs'].includes(ext)) {
        stats.jsSize += size;
        fileInfo.type = 'javascript';
      } else if (ext === '.css') {
        stats.cssSize += size;
        fileInfo.type = 'stylesheet';
      } else {
        stats.assetSize += size;
        fileInfo.type = 'asset';
      }
      
      stats.files.push(fileInfo);
    });
    
    // KB 단위로 변환
    stats.totalSize = Math.round(stats.totalSize / 1024);
    stats.jsSize = Math.round(stats.jsSize / 1024);
    stats.cssSize = Math.round(stats.cssSize / 1024);
    stats.assetSize = Math.round(stats.assetSize / 1024);
    
    return stats;
  }

  /**
   * 디렉토리의 모든 파일 목록 가져오기
   */
  getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isDirectory()) {
        arrayOfFiles = this.getAllFiles(fullPath, arrayOfFiles);
      } else {
        arrayOfFiles.push(fullPath);
      }
    });
    
    return arrayOfFiles;
  }

  /**
   * 평균 응답 시간 계산
   */
  calculateAverageResponseTime(results) {
    const validResults = results.filter(r => r.responseTime !== null);
    if (validResults.length === 0) return 0;
    
    const total = validResults.reduce((sum, r) => sum + r.responseTime, 0);
    return Math.round(total / validResults.length);
  }

  /**
   * 임계값 검증
   */
  validateThresholds() {
    console.log('🎯 성능 임계값 검증 중...');
    
    const failures = [];
    
    // Lighthouse 점수 검증
    if (this.results.lighthouse.performance < this.thresholds.performance) {
      failures.push(`성능 점수: ${this.results.lighthouse.performance}% < ${this.thresholds.performance}%`);
    }
    
    if (this.results.lighthouse.accessibility < this.thresholds.accessibility) {
      failures.push(`접근성 점수: ${this.results.lighthouse.accessibility}% < ${this.thresholds.accessibility}%`);
    }
    
    if (this.results.lighthouse.bestPractices < this.thresholds.bestPractices) {
      failures.push(`모범 사례 점수: ${this.results.lighthouse.bestPractices}% < ${this.thresholds.bestPractices}%`);
    }
    
    if (this.results.lighthouse.seo < this.thresholds.seo) {
      failures.push(`SEO 점수: ${this.results.lighthouse.seo}% < ${this.thresholds.seo}%`);
    }
    
    // 번들 크기 검증
    if (this.results.bundleAnalysis.totalSize > this.thresholds.bundleSize) {
      failures.push(`번들 크기: ${this.results.bundleAnalysis.totalSize}KB > ${this.thresholds.bundleSize}KB`);
    }
    
    // API 성능 검증
    if (this.results.apiPerformance.averageResponseTime > this.thresholds.apiResponseTime) {
      failures.push(`API 응답 시간: ${this.results.apiPerformance.averageResponseTime}ms > ${this.thresholds.apiResponseTime}ms`);
    }
    
    this.results.passed = failures.length === 0;
    this.results.failures = failures;
    
    if (this.results.passed) {
      console.log('  ✅ 모든 성능 임계값 통과');
    } else {
      console.log('  ❌ 성능 임계값 실패:');
      failures.forEach(failure => console.log(`    - ${failure}`));
    }
  }

  /**
   * 성능 보고서 생성
   */
  async generateReport() {
    console.log('📄 성능 보고서 생성 중...');
    
    const report = this.generateMarkdownReport();
    
    // Markdown 보고서 저장
    fs.writeFileSync(
      path.join(this.outputDir, 'performance-report.md'),
      report
    );
    
    // JSON 요약 저장
    fs.writeFileSync(
      path.join(this.outputDir, 'performance-summary.json'),
      JSON.stringify(this.results, null, 2)
    );
    
    console.log('  ✅ 성능 보고서 생성 완료');
  }

  /**
   * Markdown 형식의 성능 보고서 생성
   */
  generateMarkdownReport() {
    const { lighthouse, bundleAnalysis, apiPerformance } = this.results;
    
    let report = `# 🚀 성능 벤치마크 보고서\n\n`;
    report += `**생성 시간**: ${new Date().toLocaleString('ko-KR')}\n\n`;
    
    // Lighthouse 결과
    report += `## 📊 Lighthouse 성능 점수\n\n`;
    report += `| 카테고리 | 점수 | 임계값 | 상태 |\n`;
    report += `|---------|------|--------|------|\n`;
    report += `| 성능 | ${lighthouse.performance}% | ${this.thresholds.performance}% | ${lighthouse.performance >= this.thresholds.performance ? '✅' : '❌'} |\n`;
    report += `| 접근성 | ${lighthouse.accessibility}% | ${this.thresholds.accessibility}% | ${lighthouse.accessibility >= this.thresholds.accessibility ? '✅' : '❌'} |\n`;
    report += `| 모범 사례 | ${lighthouse.bestPractices}% | ${this.thresholds.bestPractices}% | ${lighthouse.bestPractices >= this.thresholds.bestPractices ? '✅' : '❌'} |\n`;
    report += `| SEO | ${lighthouse.seo}% | ${this.thresholds.seo}% | ${lighthouse.seo >= this.thresholds.seo ? '✅' : '❌'} |\n\n`;
    
    // Core Web Vitals
    if (lighthouse.webVitals) {
      report += `### Core Web Vitals\n\n`;
      report += `- **First Contentful Paint (FCP)**: ${lighthouse.webVitals.FCP ? Math.round(lighthouse.webVitals.FCP) + 'ms' : 'N/A'}\n`;
      report += `- **Largest Contentful Paint (LCP)**: ${lighthouse.webVitals.LCP ? Math.round(lighthouse.webVitals.LCP) + 'ms' : 'N/A'}\n`;
      report += `- **Cumulative Layout Shift (CLS)**: ${lighthouse.webVitals.CLS ? lighthouse.webVitals.CLS.toFixed(3) : 'N/A'}\n`;
      report += `- **First Input Delay (FID)**: ${lighthouse.webVitals.FID ? Math.round(lighthouse.webVitals.FID) + 'ms' : 'N/A'}\n`;
      report += `- **Time to Interactive (TTI)**: ${lighthouse.webVitals.TTI ? Math.round(lighthouse.webVitals.TTI) + 'ms' : 'N/A'}\n\n`;
    }
    
    // 번들 크기 분석
    if (bundleAnalysis.totalSize) {
      report += `## 📦 번들 크기 분석\n\n`;
      report += `| 항목 | 크기 | 비율 |\n`;
      report += `|------|------|------|\n`;
      report += `| 전체 | ${bundleAnalysis.totalSize}KB | 100% |\n`;
      report += `| JavaScript | ${bundleAnalysis.jsSize}KB | ${Math.round(bundleAnalysis.jsSize / bundleAnalysis.totalSize * 100)}% |\n`;
      report += `| CSS | ${bundleAnalysis.cssSize}KB | ${Math.round(bundleAnalysis.cssSize / bundleAnalysis.totalSize * 100)}% |\n`;
      report += `| Assets | ${bundleAnalysis.assetSize}KB | ${Math.round(bundleAnalysis.assetSize / bundleAnalysis.totalSize * 100)}% |\n`;
      report += `| 압축 예상 | ${bundleAnalysis.gzippedEstimate}KB | ~30% |\n\n`;
      
      report += `**임계값 검증**: ${bundleAnalysis.totalSize <= this.thresholds.bundleSize ? '✅ 통과' : '❌ 실패'} (${bundleAnalysis.totalSize}KB / ${this.thresholds.bundleSize}KB)\n\n`;
    }
    
    // API 성능
    if (apiPerformance.endpoints && apiPerformance.endpoints.length > 0) {
      report += `## 🌐 API 성능\n\n`;
      report += `**평균 응답 시간**: ${apiPerformance.averageResponseTime}ms\n\n`;
      report += `| 엔드포인트 | 메서드 | 응답시간 | 상태 |\n`;
      report += `|----------|--------|----------|------|\n`;
      
      apiPerformance.endpoints.forEach(endpoint => {
        const responseTime = endpoint.responseTime ? `${endpoint.responseTime}ms` : 'N/A';
        const status = endpoint.success ? '✅' : '❌';
        report += `| ${endpoint.name} | ${endpoint.method} | ${responseTime} | ${status} |\n`;
      });
      
      report += `\n**임계값 검증**: ${apiPerformance.averageResponseTime <= this.thresholds.apiResponseTime ? '✅ 통과' : '❌ 실패'} (${apiPerformance.averageResponseTime}ms / ${this.thresholds.apiResponseTime}ms)\n\n`;
    }
    
    // 전체 결과
    report += `## 🎯 전체 결과\n\n`;
    if (this.results.passed) {
      report += `✅ **모든 성능 임계값을 통과했습니다!**\n\n`;
      report += `애플리케이션의 성능이 우수한 수준을 유지하고 있습니다.\n`;
    } else {
      report += `❌ **일부 성능 임계값을 통과하지 못했습니다.**\n\n`;
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
      if (['performance', 'accessibility', 'bestPractices', 'seo', 'bundleSize', 'apiResponseTime'].includes(key)) {
        options[key] = parseFloat(value);
      } else {
        options[key] = value;
      }
    }
  }
  
  const benchmark = new PerformanceBenchmark(options);
  
  benchmark.run()
    .then(results => {
      console.log('\n📊 성능 벤치마크 결과:');
      console.log(`전체 통과: ${results.passed ? '✅' : '❌'}`);
      
      if (!results.passed) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('성능 벤치마크 실행 실패:', error);
      process.exit(1);
    });
}

module.exports = PerformanceBenchmark;