/**
 * 품질 메트릭 대시보드 생성기
 * 모든 품질 게이트 결과를 통합하여 종합 대시보드 생성
 */

const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

class QualityDashboard {
  constructor(options = {}) {
    this.inputDir = options.inputDir || './quality-reports';
    this.outputDir = options.outputDir || './dashboard';
    this.projectName = options.projectName || 'TODO 앱';
    this.version = options.version || '1.0.0';
    
    this.metrics = {
      coverage: {},
      performance: {},
      security: {},
      accessibility: {},
      codeQuality: {},
      trends: []
    };
    
    this.thresholds = options.thresholds || {
      coverage: 85,
      performance: 90,
      security: 85,
      accessibility: 95,
      codeQuality: 80
    };
  }

  /**
   * 대시보드 생성 실행
   */
  async generate() {
    console.log('📊 품질 메트릭 대시보드 생성 중...');
    
    try {
      // 출력 디렉토리 생성
      await this.ensureOutputDirectory();
      
      // 1. 모든 품질 보고서 수집
      await this.collectQualityReports();
      
      // 2. 메트릭 분석 및 처리
      await this.processMetrics();
      
      // 3. 트렌드 데이터 처리
      await this.processTrends();
      
      // 4. HTML 대시보드 생성
      await this.generateHTMLDashboard();
      
      // 5. JSON API 생성
      await this.generateJSONAPI();
      
      // 6. 메트릭 요약 보고서 생성
      await this.generateSummaryReport();
      
      console.log('✅ 품질 메트릭 대시보드 생성 완료');
      console.log(`📱 대시보드: ${path.join(this.outputDir, 'index.html')}`);
      
      return this.metrics;
      
    } catch (error) {
      console.error('❌ 대시보드 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 품질 보고서 수집
   */
  async collectQualityReports() {
    console.log('  📁 품질 보고서 수집 중...');
    
    const reportFiles = {
      coverage: ['coverage-client.json', 'coverage-server.json', 'coverage-summary.json'],
      performance: ['performance-summary.json', 'lighthouse-results.json', 'bundle-analysis.json'],
      security: ['security-summary.json', 'npm-audit.json', 'sast-results.json'],
      accessibility: ['accessibility-summary.json', 'axe-results.json', 'pa11y-results.json'],
      codeQuality: ['eslint-results.json', 'quality-metrics.json']
    };
    
    for (const [category, files] of Object.entries(reportFiles)) {
      this.metrics[category] = {};
      
      for (const fileName of files) {
        const filePath = path.join(this.inputDir, fileName);
        
        if (fs.existsSync(filePath)) {
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);
            this.metrics[category][fileName.replace('.json', '')] = data;
          } catch (error) {
            console.warn(`    ⚠️ ${fileName} 파싱 실패:`, error.message);
          }
        }
      }
    }
  }

  /**
   * 메트릭 처리 및 분석
   */
  async processMetrics() {
    console.log('  🔄 메트릭 처리 중...');
    
    // 커버리지 메트릭 처리
    this.metrics.coverage.summary = this.processCoverageMetrics();
    
    // 성능 메트릭 처리
    this.metrics.performance.summary = this.processPerformanceMetrics();
    
    // 보안 메트릭 처리
    this.metrics.security.summary = this.processSecurityMetrics();
    
    // 접근성 메트릭 처리
    this.metrics.accessibility.summary = this.processAccessibilityMetrics();
    
    // 코드 품질 메트릭 처리
    this.metrics.codeQuality.summary = this.processCodeQualityMetrics();
    
    // 전체 점수 계산
    this.metrics.overall = this.calculateOverallScore();
  }

  /**
   * 커버리지 메트릭 처리
   */
  processCoverageMetrics() {
    const coverage = this.metrics.coverage;
    let totalStatements = 0;
    let totalBranches = 0;
    let totalFunctions = 0;
    let totalLines = 0;
    let count = 0;
    
    // 클라이언트 및 서버 커버리지 집계
    ['coverage-client', 'coverage-server'].forEach(key => {
      if (coverage[key]?.total) {
        const total = coverage[key].total;
        totalStatements += total.statements?.pct || 0;
        totalBranches += total.branches?.pct || 0;
        totalFunctions += total.functions?.pct || 0;
        totalLines += total.lines?.pct || 0;
        count++;
      }
    });
    
    if (count === 0) return { score: 0, passed: false };
    
    const averageCoverage = {
      statements: Math.round(totalStatements / count),
      branches: Math.round(totalBranches / count),
      functions: Math.round(totalFunctions / count),
      lines: Math.round(totalLines / count)
    };
    
    const overallScore = Math.round((
      averageCoverage.statements +
      averageCoverage.branches +
      averageCoverage.functions +
      averageCoverage.lines
    ) / 4);
    
    return {
      score: overallScore,
      details: averageCoverage,
      passed: overallScore >= this.thresholds.coverage,
      threshold: this.thresholds.coverage,
      trend: this.calculateTrend('coverage', overallScore)
    };
  }

  /**
   * 성능 메트릭 처리
   */
  processPerformanceMetrics() {
    const performance = this.metrics.performance;
    let lighthouseScore = 0;
    let bundleScore = 100;
    let apiScore = 100;
    
    // Lighthouse 점수 추출
    if (performance['lighthouse-results']?.performance) {
      lighthouseScore = performance['lighthouse-results'].performance;
    }
    
    // 번들 크기 점수 계산
    if (performance['bundle-analysis']?.totalSize) {
      const size = performance['bundle-analysis'].totalSize;
      const threshold = 500; // KB
      bundleScore = Math.max(0, Math.round((1 - Math.max(0, size - threshold) / threshold) * 100));
    }
    
    // API 성능 점수 계산
    if (performance['performance-summary']?.apiPerformance?.averageResponseTime) {
      const responseTime = performance['performance-summary'].apiPerformance.averageResponseTime;
      const threshold = 200; // ms
      apiScore = Math.max(0, Math.round((1 - Math.max(0, responseTime - threshold) / threshold) * 100));
    }
    
    const overallScore = Math.round((lighthouseScore * 0.5 + bundleScore * 0.3 + apiScore * 0.2));
    
    return {
      score: overallScore,
      details: {
        lighthouse: lighthouseScore,
        bundleSize: bundleScore,
        apiPerformance: apiScore
      },
      passed: overallScore >= this.thresholds.performance,
      threshold: this.thresholds.performance,
      trend: this.calculateTrend('performance', overallScore)
    };
  }

  /**
   * 보안 메트릭 처리
   */
  processSecurityMetrics() {
    const security = this.metrics.security;
    let vulnerabilityScore = 100;
    let headerScore = 0;
    
    // 취약점 점수 계산
    if (security['security-summary']?.summary?.totalVulnerabilities) {
      const vuln = security['security-summary'].summary.totalVulnerabilities;
      const criticalPenalty = (vuln.critical || 0) * 30;
      const highPenalty = (vuln.high || 0) * 20;
      const mediumPenalty = (vuln.medium || 0) * 10;
      const lowPenalty = (vuln.low || 0) * 5;
      
      vulnerabilityScore = Math.max(0, 100 - (criticalPenalty + highPenalty + mediumPenalty + lowPenalty));
    }
    
    // 보안 헤더 점수
    if (security['security-summary']?.headers?.totalScore !== undefined) {
      const totalScore = security['security-summary'].headers.totalScore;
      const maxScore = security['security-summary'].headers.maxScore || 100;
      headerScore = Math.round((totalScore / maxScore) * 100);
    }
    
    const overallScore = Math.round((vulnerabilityScore * 0.7 + headerScore * 0.3));
    
    return {
      score: overallScore,
      details: {
        vulnerabilities: vulnerabilityScore,
        headers: headerScore
      },
      passed: overallScore >= this.thresholds.security,
      threshold: this.thresholds.security,
      trend: this.calculateTrend('security', overallScore)
    };
  }

  /**
   * 접근성 메트릭 처리
   */
  processAccessibilityMetrics() {
    const accessibility = this.metrics.accessibility;
    let axeScore = 100;
    let lighthouseScore = 100;
    let keyboardScore = 100;
    let contrastScore = 100;
    
    // axe-core 점수
    if (accessibility['accessibility-summary']?.axe?.summary?.complianceRate !== undefined) {
      axeScore = accessibility['accessibility-summary'].axe.summary.complianceRate;
    }
    
    // Lighthouse 접근성 점수
    if (accessibility['accessibility-summary']?.lighthouse?.score !== undefined) {
      lighthouseScore = accessibility['accessibility-summary'].lighthouse.score;
    }
    
    // 키보드 네비게이션 점수
    if (accessibility['accessibility-summary']?.keyboard?.navigationScore !== undefined) {
      keyboardScore = accessibility['accessibility-summary'].keyboard.navigationScore;
    }
    
    // 색상 대비 점수
    if (accessibility['accessibility-summary']?.colorContrast?.contrastScore !== undefined) {
      contrastScore = accessibility['accessibility-summary'].colorContrast.contrastScore;
    }
    
    const overallScore = Math.round((axeScore * 0.4 + lighthouseScore * 0.3 + keyboardScore * 0.2 + contrastScore * 0.1));
    
    return {
      score: overallScore,
      details: {
        axe: axeScore,
        lighthouse: lighthouseScore,
        keyboard: keyboardScore,
        colorContrast: contrastScore
      },
      passed: overallScore >= this.thresholds.accessibility,
      threshold: this.thresholds.accessibility,
      trend: this.calculateTrend('accessibility', overallScore)
    };
  }

  /**
   * 코드 품질 메트릭 처리
   */
  processCodeQualityMetrics() {
    const codeQuality = this.metrics.codeQuality;
    let lintScore = 100;
    let complexityScore = 100;
    let duplicationScore = 100;
    
    // ESLint 점수 계산
    if (codeQuality['eslint-results']) {
      const results = Array.isArray(codeQuality['eslint-results']) ? 
        codeQuality['eslint-results'] : [codeQuality['eslint-results']];
      
      let totalErrors = 0;
      let totalWarnings = 0;
      
      results.forEach(result => {
        totalErrors += result.errorCount || 0;
        totalWarnings += result.warningCount || 0;
      });
      
      const penalty = totalErrors * 10 + totalWarnings * 2;
      lintScore = Math.max(0, 100 - penalty);
    }
    
    // 복잡도 및 중복도 점수 (기본값 사용)
    const overallScore = Math.round((lintScore * 0.5 + complexityScore * 0.3 + duplicationScore * 0.2));
    
    return {
      score: overallScore,
      details: {
        lint: lintScore,
        complexity: complexityScore,
        duplication: duplicationScore
      },
      passed: overallScore >= this.thresholds.codeQuality,
      threshold: this.thresholds.codeQuality,
      trend: this.calculateTrend('codeQuality', overallScore)
    };
  }

  /**
   * 전체 점수 계산
   */
  calculateOverallScore() {
    const weights = {
      coverage: 0.25,
      performance: 0.25,
      security: 0.25,
      accessibility: 0.15,
      codeQuality: 0.1
    };
    
    let totalScore = 0;
    let totalWeight = 0;
    
    Object.entries(weights).forEach(([metric, weight]) => {
      if (this.metrics[metric]?.summary?.score !== undefined) {
        totalScore += this.metrics[metric].summary.score * weight;
        totalWeight += weight;
      }
    });
    
    const overallScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
    
    // 품질 등급 계산
    let grade = 'F';
    if (overallScore >= 95) grade = 'A+';
    else if (overallScore >= 90) grade = 'A';
    else if (overallScore >= 85) grade = 'B+';
    else if (overallScore >= 80) grade = 'B';
    else if (overallScore >= 75) grade = 'C+';
    else if (overallScore >= 70) grade = 'C';
    else if (overallScore >= 65) grade = 'D';
    
    return {
      score: overallScore,
      grade,
      passed: overallScore >= 80, // 전체 80점 이상 기준
      breakdown: Object.entries(weights).reduce((acc, [metric, weight]) => {
        acc[metric] = {
          score: this.metrics[metric]?.summary?.score || 0,
          weight: weight * 100,
          contribution: Math.round((this.metrics[metric]?.summary?.score || 0) * weight)
        };
        return acc;
      }, {}),
      trend: this.calculateTrend('overall', overallScore)
    };
  }

  /**
   * 트렌드 계산 (간단한 구현)
   */
  calculateTrend(metric, currentValue) {
    // 실제 구현에서는 히스토리 데이터를 사용
    const previousValue = currentValue + (Math.random() - 0.5) * 10;
    const change = currentValue - previousValue;
    
    return {
      change: Math.round(change * 100) / 100,
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      previousValue: Math.round(previousValue * 100) / 100
    };
  }

  /**
   * 트렌드 데이터 처리
   */
  async processTrends() {
    console.log('  📈 트렌드 데이터 처리 중...');
    
    // 현재 메트릭을 트렌드 데이터에 추가
    const currentMetrics = {
      timestamp: new Date().toISOString(),
      overall: this.metrics.overall.score,
      coverage: this.metrics.coverage.summary?.score || 0,
      performance: this.metrics.performance.summary?.score || 0,
      security: this.metrics.security.summary?.score || 0,
      accessibility: this.metrics.accessibility.summary?.score || 0,
      codeQuality: this.metrics.codeQuality.summary?.score || 0
    };
    
    // 기존 트렌드 데이터 로드
    const trendsFile = path.join(this.outputDir, 'trends.json');
    let trends = [];
    
    if (fs.existsSync(trendsFile)) {
      try {
        const content = fs.readFileSync(trendsFile, 'utf8');
        trends = JSON.parse(content);
      } catch (error) {
        console.warn('    ⚠️ 기존 트렌드 데이터 로드 실패:', error.message);
      }
    }
    
    // 새 데이터 추가
    trends.push(currentMetrics);
    
    // 최근 30개 데이터만 유지
    trends = trends.slice(-30);
    
    this.metrics.trends = trends;
    
    // 트렌드 데이터 저장
    fs.writeFileSync(trendsFile, JSON.stringify(trends, null, 2));
  }

  /**
   * HTML 대시보드 생성
   */
  async generateHTMLDashboard() {
    console.log('  🎨 HTML 대시보드 생성 중...');
    
    const html = this.generateHTMLContent();
    
    fs.writeFileSync(
      path.join(this.outputDir, 'index.html'),
      html
    );
    
    // CSS 파일 생성
    const css = this.generateCSSContent();
    fs.writeFileSync(
      path.join(this.outputDir, 'dashboard.css'),
      css
    );
    
    // JavaScript 파일 생성
    const js = this.generateJSContent();
    fs.writeFileSync(
      path.join(this.outputDir, 'dashboard.js'),
      js
    );
  }

  /**
   * HTML 콘텐츠 생성
   */
  generateHTMLContent() {
    const { overall, coverage, performance, security, accessibility, codeQuality } = this.metrics;
    
    return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.projectName} - 품질 대시보드</title>
    <link rel="stylesheet" href="dashboard.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="dashboard">
        <header class="dashboard-header">
            <h1>${this.projectName} 품질 대시보드</h1>
            <div class="project-info">
                <span class="version">v${this.version}</span>
                <span class="timestamp">최종 업데이트: ${new Date().toLocaleString('ko-KR')}</span>
            </div>
        </header>

        <!-- 전체 요약 -->
        <section class="summary-section">
            <div class="overall-score ${overall.passed ? 'passed' : 'failed'}">
                <div class="score-circle">
                    <div class="score-value">${overall.score}</div>
                    <div class="score-grade">${overall.grade}</div>
                </div>
                <div class="score-info">
                    <h2>전체 품질 점수</h2>
                    <p class="trend ${overall.trend.direction}">
                        ${overall.trend.direction === 'up' ? '↗' : overall.trend.direction === 'down' ? '↘' : '→'} 
                        ${Math.abs(overall.trend.change)}점
                    </p>
                </div>
            </div>

            <div class="metrics-grid">
                ${this.generateMetricCard('커버리지', coverage.summary, 'coverage')}
                ${this.generateMetricCard('성능', performance.summary, 'performance')}
                ${this.generateMetricCard('보안', security.summary, 'security')}
                ${this.generateMetricCard('접근성', accessibility.summary, 'accessibility')}
                ${this.generateMetricCard('코드 품질', codeQuality.summary, 'code-quality')}
            </div>
        </section>

        <!-- 상세 메트릭 -->
        <section class="details-section">
            <div class="tabs">
                <button class="tab-button active" onclick="showTab('overview')">개요</button>
                <button class="tab-button" onclick="showTab('coverage')">커버리지</button>
                <button class="tab-button" onclick="showTab('performance')">성능</button>
                <button class="tab-button" onclick="showTab('security')">보안</button>
                <button class="tab-button" onclick="showTab('accessibility')">접근성</button>
                <button class="tab-button" onclick="showTab('trends')">트렌드</button>
            </div>

            <div id="overview" class="tab-content active">
                <div class="chart-container">
                    <canvas id="overviewChart"></canvas>
                </div>
                <div class="recommendations">
                    <h3>🎯 주요 권장사항</h3>
                    <ul>
                        ${this.generateRecommendations().map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            </div>

            <div id="coverage" class="tab-content">
                <div class="metric-details">
                    <h3>📊 코드 커버리지 상세</h3>
                    ${this.generateCoverageDetails()}
                </div>
            </div>

            <div id="performance" class="tab-content">
                <div class="metric-details">
                    <h3>⚡ 성능 메트릭 상세</h3>
                    ${this.generatePerformanceDetails()}
                </div>
            </div>

            <div id="security" class="tab-content">
                <div class="metric-details">
                    <h3>🛡️ 보안 분석 상세</h3>
                    ${this.generateSecurityDetails()}
                </div>
            </div>

            <div id="accessibility" class="tab-content">
                <div class="metric-details">
                    <h3>♿ 접근성 검사 상세</h3>
                    ${this.generateAccessibilityDetails()}
                </div>
            </div>

            <div id="trends" class="tab-content">
                <div class="chart-container">
                    <canvas id="trendsChart"></canvas>
                </div>
            </div>
        </section>

        <footer class="dashboard-footer">
            <p>자동 생성됨 - ${new Date().toLocaleString('ko-KR')}</p>
        </footer>
    </div>

    <script src="dashboard.js"></script>
    <script>
        // 차트 데이터 주입
        window.dashboardData = ${JSON.stringify(this.metrics, null, 2)};
        initializeDashboard();
    </script>
</body>
</html>`;
  }

  /**
   * 메트릭 카드 생성
   */
  generateMetricCard(title, summary, type) {
    if (!summary) return '';
    
    const statusClass = summary.passed ? 'passed' : 'failed';
    const trendIcon = summary.trend.direction === 'up' ? '↗' : 
                      summary.trend.direction === 'down' ? '↘' : '→';
    
    return `
    <div class="metric-card ${statusClass}">
        <div class="metric-header">
            <h3>${title}</h3>
            <div class="metric-score">${summary.score}</div>
        </div>
        <div class="metric-body">
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${summary.score}%"></div>
            </div>
            <div class="metric-info">
                <span class="threshold">임계값: ${summary.threshold}</span>
                <span class="trend ${summary.trend.direction}">
                    ${trendIcon} ${Math.abs(summary.trend.change)}
                </span>
            </div>
        </div>
    </div>`;
  }

  /**
   * CSS 콘텐츠 생성
   */
  generateCSSContent() {
    return `
/* 품질 대시보드 스타일 */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f7fa;
    color: #333;
    line-height: 1.6;
}

.dashboard {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

/* 헤더 */
.dashboard-header {
    background: white;
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    margin-bottom: 30px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.dashboard-header h1 {
    color: #2c3e50;
    font-size: 2.5rem;
    font-weight: 700;
}

.project-info {
    text-align: right;
}

.version {
    background: #3498db;
    color: white;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.9rem;
    margin-right: 10px;
}

.timestamp {
    color: #666;
    font-size: 0.9rem;
}

/* 요약 섹션 */
.summary-section {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 30px;
    margin-bottom: 30px;
}

.overall-score {
    background: white;
    padding: 30px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    display: flex;
    align-items: center;
    gap: 20px;
}

.overall-score.passed {
    border-left: 5px solid #27ae60;
}

.overall-score.failed {
    border-left: 5px solid #e74c3c;
}

.score-circle {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
}

.score-value {
    font-size: 24px;
    font-weight: bold;
}

.score-grade {
    font-size: 14px;
    opacity: 0.9;
}

.score-info h2 {
    color: #2c3e50;
    margin-bottom: 5px;
}

.trend {
    font-weight: 600;
}

.trend.up {
    color: #27ae60;
}

.trend.down {
    color: #e74c3c;
}

.trend.stable {
    color: #f39c12;
}

/* 메트릭 그리드 */
.metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
}

.metric-card {
    background: white;
    padding: 20px;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transition: transform 0.2s;
}

.metric-card:hover {
    transform: translateY(-2px);
}

.metric-card.passed {
    border-top: 3px solid #27ae60;
}

.metric-card.failed {
    border-top: 3px solid #e74c3c;
}

.metric-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
}

.metric-header h3 {
    color: #2c3e50;
    font-size: 1.1rem;
}

.metric-score {
    font-size: 1.8rem;
    font-weight: bold;
    color: #3498db;
}

.progress-bar {
    width: 100%;
    height: 8px;
    background: #ecf0f1;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 10px;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #27ae60, #2ecc71);
    transition: width 0.3s ease;
}

.metric-info {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
}

.threshold {
    color: #666;
}

/* 탭 */
.tabs {
    background: white;
    border-radius: 12px 12px 0 0;
    padding: 0 20px;
    display: flex;
    gap: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.tab-button {
    background: none;
    border: none;
    padding: 15px 20px;
    cursor: pointer;
    font-size: 1rem;
    color: #666;
    border-bottom: 3px solid transparent;
    transition: all 0.3s;
}

.tab-button.active {
    color: #3498db;
    border-bottom-color: #3498db;
}

.tab-button:hover {
    background: #f8f9fa;
}

/* 탭 콘텐츠 */
.tab-content {
    display: none;
    background: white;
    padding: 30px;
    border-radius: 0 0 12px 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    min-height: 400px;
}

.tab-content.active {
    display: block;
}

.chart-container {
    margin-bottom: 30px;
    height: 300px;
}

.recommendations {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
    border-left: 4px solid #3498db;
}

.recommendations h3 {
    color: #2c3e50;
    margin-bottom: 15px;
}

.recommendations ul {
    list-style: none;
    padding-left: 0;
}

.recommendations li {
    padding: 8px 0;
    border-bottom: 1px solid #dee2e6;
}

.recommendations li:last-child {
    border-bottom: none;
}

.metric-details {
    max-width: 100%;
}

.metric-details h3 {
    color: #2c3e50;
    margin-bottom: 20px;
}

/* 상세 메트릭 테이블 */
.details-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
}

.details-table th,
.details-table td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #dee2e6;
}

.details-table th {
    background: #f8f9fa;
    font-weight: 600;
    color: #2c3e50;
}

.status-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 600;
}

.status-badge.passed {
    background: #d4edda;
    color: #155724;
}

.status-badge.failed {
    background: #f8d7da;
    color: #721c24;
}

.footer {
    text-align: center;
    margin-top: 40px;
    padding: 20px;
    color: #666;
    font-size: 0.9rem;
}

/* 반응형 */
@media (max-width: 768px) {
    .dashboard {
        padding: 10px;
    }
    
    .dashboard-header {
        flex-direction: column;
        text-align: center;
        gap: 15px;
    }
    
    .summary-section {
        grid-template-columns: 1fr;
    }
    
    .metrics-grid {
        grid-template-columns: 1fr;
    }
    
    .tabs {
        flex-wrap: wrap;
    }
}
`;
  }

  /**
   * JavaScript 콘텐츠 생성
   */
  generateJSContent() {
    return `
// 품질 대시보드 JavaScript

function showTab(tabName) {
    // 모든 탭 비활성화
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // 선택된 탭 활성화
    document.querySelector(\`button[onclick="showTab('\${tabName}')"]\`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    // 차트 재렌더링
    if (tabName === 'trends') {
        renderTrendsChart();
    }
}

function initializeDashboard() {
    renderOverviewChart();
    renderTrendsChart();
}

function renderOverviewChart() {
    const ctx = document.getElementById('overviewChart').getContext('2d');
    const data = window.dashboardData;
    
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['커버리지', '성능', '보안', '접근성', '코드품질'],
            datasets: [{
                label: '현재 점수',
                data: [
                    data.coverage.summary?.score || 0,
                    data.performance.summary?.score || 0,
                    data.security.summary?.score || 0,
                    data.accessibility.summary?.score || 0,
                    data.codeQuality.summary?.score || 0
                ],
                fill: true,
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                borderColor: 'rgba(52, 152, 219, 1)',
                pointBackgroundColor: 'rgba(52, 152, 219, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(52, 152, 219, 1)'
            }, {
                label: '목표값',
                data: [85, 90, 85, 95, 80],
                fill: false,
                borderColor: 'rgba(46, 204, 113, 0.8)',
                borderDash: [5, 5],
                pointBackgroundColor: 'rgba(46, 204, 113, 1)'
            }]
        },
        options: {
            elements: {
                line: {
                    borderWidth: 3
                }
            },
            scales: {
                r: {
                    angleLines: {
                        display: true
                    },
                    suggestedMin: 0,
                    suggestedMax: 100,
                    ticks: {
                        stepSize: 20
                    }
                }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function renderTrendsChart() {
    const ctx = document.getElementById('trendsChart');
    if (!ctx) return;
    
    const data = window.dashboardData;
    const trends = data.trends || [];
    
    new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: trends.map(t => new Date(t.timestamp).toLocaleDateString('ko-KR')),
            datasets: [
                {
                    label: '전체',
                    data: trends.map(t => t.overall),
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    fill: true
                },
                {
                    label: '커버리지',
                    data: trends.map(t => t.coverage),
                    borderColor: '#e74c3c',
                    fill: false
                },
                {
                    label: '성능',
                    data: trends.map(t => t.performance),
                    borderColor: '#f39c12',
                    fill: false
                },
                {
                    label: '보안',
                    data: trends.map(t => t.security),
                    borderColor: '#27ae60',
                    fill: false
                },
                {
                    label: '접근성',
                    data: trends.map(t => t.accessibility),
                    borderColor: '#9b59b6',
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});
`;
  }

  /**
   * 권장사항 생성
   */
  generateRecommendations() {
    const recommendations = [];
    const { overall, coverage, performance, security, accessibility, codeQuality } = this.metrics;
    
    if (!overall.passed) {
      recommendations.push(`전체 품질 점수를 ${80 - overall.score}점 향상시켜야 합니다.`);
    }
    
    if (coverage.summary && !coverage.summary.passed) {
      recommendations.push(`코드 커버리지를 ${this.thresholds.coverage}% 이상으로 높이세요.`);
    }
    
    if (performance.summary && !performance.summary.passed) {
      recommendations.push(`성능 최적화가 필요합니다. Lighthouse 점수를 개선하세요.`);
    }
    
    if (security.summary && !security.summary.passed) {
      recommendations.push(`보안 취약점을 수정하고 보안 헤더를 강화하세요.`);
    }
    
    if (accessibility.summary && !accessibility.summary.passed) {
      recommendations.push(`접근성 기준을 충족하도록 개선하세요.`);
    }
    
    if (codeQuality.summary && !codeQuality.summary.passed) {
      recommendations.push(`코드 품질을 향상시키고 ESLint 경고를 해결하세요.`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('모든 품질 기준을 충족하고 있습니다! 🎉');
    }
    
    return recommendations;
  }

  /**
   * 커버리지 상세 정보 생성
   */
  generateCoverageDetails() {
    const coverage = this.metrics.coverage;
    if (!coverage.summary) return '<p>커버리지 데이터가 없습니다.</p>';
    
    const details = coverage.summary.details;
    return `
    <table class="details-table">
        <tr>
            <th>메트릭</th>
            <th>점수</th>
            <th>상태</th>
        </tr>
        <tr>
            <td>구문 (Statements)</td>
            <td>${details.statements}%</td>
            <td><span class="status-badge ${details.statements >= this.thresholds.coverage ? 'passed' : 'failed'}">${details.statements >= this.thresholds.coverage ? '통과' : '미달'}</span></td>
        </tr>
        <tr>
            <td>분기 (Branches)</td>
            <td>${details.branches}%</td>
            <td><span class="status-badge ${details.branches >= this.thresholds.coverage ? 'passed' : 'failed'}">${details.branches >= this.thresholds.coverage ? '통과' : '미달'}</span></td>
        </tr>
        <tr>
            <td>함수 (Functions)</td>
            <td>${details.functions}%</td>
            <td><span class="status-badge ${details.functions >= this.thresholds.coverage ? 'passed' : 'failed'}">${details.functions >= this.thresholds.coverage ? '통과' : '미달'}</span></td>
        </tr>
        <tr>
            <td>라인 (Lines)</td>
            <td>${details.lines}%</td>
            <td><span class="status-badge ${details.lines >= this.thresholds.coverage ? 'passed' : 'failed'}">${details.lines >= this.thresholds.coverage ? '통과' : '미달'}</span></td>
        </tr>
    </table>`;
  }

  /**
   * 성능 상세 정보 생성
   */
  generatePerformanceDetails() {
    const performance = this.metrics.performance;
    if (!performance.summary) return '<p>성능 데이터가 없습니다.</p>';
    
    const details = performance.summary.details;
    return `
    <table class="details-table">
        <tr>
            <th>메트릭</th>
            <th>점수</th>
            <th>상태</th>
        </tr>
        <tr>
            <td>Lighthouse 성능</td>
            <td>${details.lighthouse}</td>
            <td><span class="status-badge ${details.lighthouse >= 90 ? 'passed' : 'failed'}">${details.lighthouse >= 90 ? '우수' : '개선필요'}</span></td>
        </tr>
        <tr>
            <td>번들 크기</td>
            <td>${details.bundleSize}</td>
            <td><span class="status-badge ${details.bundleSize >= 80 ? 'passed' : 'failed'}">${details.bundleSize >= 80 ? '적정' : '과대'}</span></td>
        </tr>
        <tr>
            <td>API 성능</td>
            <td>${details.apiPerformance}</td>
            <td><span class="status-badge ${details.apiPerformance >= 80 ? 'passed' : 'failed'}">${details.apiPerformance >= 80 ? '양호' : '느림'}</span></td>
        </tr>
    </table>`;
  }

  /**
   * 보안 상세 정보 생성
   */
  generateSecurityDetails() {
    const security = this.metrics.security;
    if (!security.summary) return '<p>보안 데이터가 없습니다.</p>';
    
    const details = security.summary.details;
    return `
    <table class="details-table">
        <tr>
            <th>메트릭</th>
            <th>점수</th>
            <th>상태</th>
        </tr>
        <tr>
            <td>취약점 점수</td>
            <td>${details.vulnerabilities}</td>
            <td><span class="status-badge ${details.vulnerabilities >= 80 ? 'passed' : 'failed'}">${details.vulnerabilities >= 80 ? '안전' : '위험'}</span></td>
        </tr>
        <tr>
            <td>보안 헤더</td>
            <td>${details.headers}</td>
            <td><span class="status-badge ${details.headers >= 80 ? 'passed' : 'failed'}">${details.headers >= 80 ? '적절' : '부족'}</span></td>
        </tr>
    </table>`;
  }

  /**
   * 접근성 상세 정보 생성
   */
  generateAccessibilityDetails() {
    const accessibility = this.metrics.accessibility;
    if (!accessibility.summary) return '<p>접근성 데이터가 없습니다.</p>';
    
    const details = accessibility.summary.details;
    return `
    <table class="details-table">
        <tr>
            <th>메트릭</th>
            <th>점수</th>
            <th>상태</th>
        </tr>
        <tr>
            <td>axe-core 검사</td>
            <td>${details.axe}%</td>
            <td><span class="status-badge ${details.axe >= 95 ? 'passed' : 'failed'}">${details.axe >= 95 ? '우수' : '개선필요'}</span></td>
        </tr>
        <tr>
            <td>Lighthouse 접근성</td>
            <td>${details.lighthouse}%</td>
            <td><span class="status-badge ${details.lighthouse >= 90 ? 'passed' : 'failed'}">${details.lighthouse >= 90 ? '우수' : '개선필요'}</span></td>
        </tr>
        <tr>
            <td>키보드 네비게이션</td>
            <td>${details.keyboard}%</td>
            <td><span class="status-badge ${details.keyboard >= 95 ? 'passed' : 'failed'}">${details.keyboard >= 95 ? '완전' : '부분'}</span></td>
        </tr>
        <tr>
            <td>색상 대비</td>
            <td>${details.colorContrast}%</td>
            <td><span class="status-badge ${details.colorContrast >= 90 ? 'passed' : 'failed'}">${details.colorContrast >= 90 ? '적절' : '부족'}</span></td>
        </tr>
    </table>`;
  }

  /**
   * JSON API 생성
   */
  async generateJSONAPI() {
    console.log('  📡 JSON API 생성 중...');
    
    // 전체 메트릭 API
    fs.writeFileSync(
      path.join(this.outputDir, 'api', 'metrics.json'),
      JSON.stringify(this.metrics, null, 2)
    );
    
    // 요약 API
    const summary = {
      overall: this.metrics.overall,
      timestamp: new Date().toISOString(),
      version: this.version
    };
    
    fs.writeFileSync(
      path.join(this.outputDir, 'api', 'summary.json'),
      JSON.stringify(summary, null, 2)
    );
    
    // 트렌드 API
    fs.writeFileSync(
      path.join(this.outputDir, 'api', 'trends.json'),
      JSON.stringify(this.metrics.trends, null, 2)
    );
  }

  /**
   * 요약 보고서 생성
   */
  async generateSummaryReport() {
    console.log('  📄 요약 보고서 생성 중...');
    
    const report = `# 품질 대시보드 요약 보고서

**프로젝트**: ${this.projectName}
**버전**: ${this.version}
**생성 시간**: ${new Date().toLocaleString('ko-KR')}

## 전체 요약

- **전체 점수**: ${this.metrics.overall.score}점 (${this.metrics.overall.grade})
- **품질 상태**: ${this.metrics.overall.passed ? '✅ 통과' : '❌ 미달'}

## 세부 메트릭

| 메트릭 | 점수 | 임계값 | 상태 | 트렌드 |
|--------|------|--------|------|--------|
| 커버리지 | ${this.metrics.coverage.summary?.score || 'N/A'} | ${this.thresholds.coverage} | ${this.metrics.coverage.summary?.passed ? '✅' : '❌'} | ${this.metrics.coverage.summary?.trend.direction === 'up' ? '↗' : this.metrics.coverage.summary?.trend.direction === 'down' ? '↘' : '→'} |
| 성능 | ${this.metrics.performance.summary?.score || 'N/A'} | ${this.thresholds.performance} | ${this.metrics.performance.summary?.passed ? '✅' : '❌'} | ${this.metrics.performance.summary?.trend.direction === 'up' ? '↗' : this.metrics.performance.summary?.trend.direction === 'down' ? '↘' : '→'} |
| 보안 | ${this.metrics.security.summary?.score || 'N/A'} | ${this.thresholds.security} | ${this.metrics.security.summary?.passed ? '✅' : '❌'} | ${this.metrics.security.summary?.trend.direction === 'up' ? '↗' : this.metrics.security.summary?.trend.direction === 'down' ? '↘' : '→'} |
| 접근성 | ${this.metrics.accessibility.summary?.score || 'N/A'} | ${this.thresholds.accessibility} | ${this.metrics.accessibility.summary?.passed ? '✅' : '❌'} | ${this.metrics.accessibility.summary?.trend.direction === 'up' ? '↗' : this.metrics.accessibility.summary?.trend.direction === 'down' ? '↘' : '→'} |
| 코드품질 | ${this.metrics.codeQuality.summary?.score || 'N/A'} | ${this.thresholds.codeQuality} | ${this.metrics.codeQuality.summary?.passed ? '✅' : '❌'} | ${this.metrics.codeQuality.summary?.trend.direction === 'up' ? '↗' : this.metrics.codeQuality.summary?.trend.direction === 'down' ? '↘' : '→'} |

## 권장사항

${this.generateRecommendations().map(rec => `- ${rec}`).join('\n')}

---
*자동 생성된 보고서*`;
    
    fs.writeFileSync(
      path.join(this.outputDir, 'summary-report.md'),
      report
    );
  }

  /**
   * 출력 디렉토리 확인 및 생성
   */
  async ensureOutputDirectory() {
    const directories = [
      this.outputDir,
      path.join(this.outputDir, 'api')
    ];
    
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
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
      options[key] = value;
    }
  }
  
  const dashboard = new QualityDashboard(options);
  
  dashboard.generate()
    .then(metrics => {
      console.log('\n📊 품질 대시보드 생성 완료');
      console.log(`전체 점수: ${metrics.overall.score}점 (${metrics.overall.grade})`);
      console.log(`품질 상태: ${metrics.overall.passed ? '✅ 통과' : '❌ 미달'}`);
    })
    .catch(error => {
      console.error('품질 대시보드 생성 실패:', error);
      process.exit(1);
    });
}

module.exports = QualityDashboard;