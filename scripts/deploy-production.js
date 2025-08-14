#!/usr/bin/env node

/**
 * 프로덕션 배포 자동화 스크립트
 * 검증, 빌드, 배포, 검증의 전체 파이프라인 자동화
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 색상 출력을 위한 유틸리티
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`${title}`, 'bright');
  log(`${'='.repeat(60)}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

/**
 * 배포 설정
 */
const DEPLOYMENT_CONFIG = {
  environments: {
    staging: {
      s3Bucket: 'todo-app-staging',
      cloudFrontId: null,
      apiUrl: 'https://staging-api.todo-app.com',
      domain: 'staging.todo-app.com'
    },
    production: {
      s3Bucket: 'todo-app-production',
      cloudFrontId: null,
      apiUrl: 'https://api.todo-app.com',
      domain: 'todo-app.com'
    }
  },
  healthCheck: {
    maxRetries: 5,
    retryDelay: 30000, // 30초
    timeout: 10000     // 10초
  },
  rollback: {
    keepBackups: 3,
    autoRollback: true
  }
};

// 배포 상태 추적
const deploymentState = {
  startTime: null,
  currentStep: null,
  errors: [],
  warnings: [],
  backupVersion: null,
  deploymentId: null
};

/**
 * 배포 전 검증 실행
 */
function runPreDeploymentValidation() {
  logSection('배포 전 검증');
  
  try {
    deploymentState.currentStep = 'validation';
    
    // 프로덕션 검증 스크립트 실행
    logInfo('프로덕션 검증 스크립트 실행 중...');
    execSync('node scripts/production-validation.js', { stdio: 'inherit' });
    
    logSuccess('배포 전 검증 완료');
    return true;
    
  } catch (error) {
    logError('배포 전 검증 실패');
    deploymentState.errors.push(`Validation failed: ${error.message}`);
    return false;
  }
}

/**
 * 현재 배포 버전 백업
 */
function backupCurrentDeployment(environment) {
  logSection('현재 배포 백업');
  
  try {
    deploymentState.currentStep = 'backup';
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const config = DEPLOYMENT_CONFIG.environments[environment];
    
    // 현재 S3 버킷 내용 백업
    const backupKey = `backups/${environment}/${timestamp}/`;
    
    logInfo(`현재 배포 백업 중: ${config.s3Bucket}`);
    
    // S3 동기화로 백업 생성
    const backupCommand = `aws s3 sync s3://${config.s3Bucket}/ s3://${config.s3Bucket}-backups/${backupKey} --delete`;
    execSync(backupCommand, { stdio: 'pipe' });
    
    // 백업 메타데이터 저장
    const backupMetadata = {
      timestamp: new Date().toISOString(),
      environment: environment,
      backupKey: backupKey,
      s3Bucket: config.s3Bucket,
      gitCommit: execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim(),
      gitBranch: execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim()
    };
    
    const metadataFile = `/tmp/backup-metadata-${timestamp}.json`;
    fs.writeFileSync(metadataFile, JSON.stringify(backupMetadata, null, 2));
    
    const metadataKey = `${backupKey}metadata.json`;
    execSync(`aws s3 cp ${metadataFile} s3://${config.s3Bucket}-backups/${metadataKey}`);
    
    deploymentState.backupVersion = timestamp;
    
    logSuccess(`배포 백업 완료: ${backupKey}`);
    fs.unlinkSync(metadataFile);
    
    return true;
    
  } catch (error) {
    logError(`배포 백업 실패: ${error.message}`);
    deploymentState.errors.push(`Backup failed: ${error.message}`);
    return false;
  }
}

/**
 * 애플리케이션 빌드
 */
function buildApplication(environment) {
  logSection('애플리케이션 빌드');
  
  try {
    deploymentState.currentStep = 'build';
    
    // 환경별 환경 변수 설정
    const envFile = `.env.${environment}`;
    if (fs.existsSync(envFile)) {
      logInfo(`환경 변수 로드: ${envFile}`);
      // 환경 변수를 프로세스에 로드
      const envContent = fs.readFileSync(envFile, 'utf-8');
      envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          process.env[key.trim()] = value.trim();
        }
      });
    } else {
      logWarning(`환경 변수 파일이 없습니다: ${envFile}`);
    }
    
    // 의존성 설치
    logInfo('의존성 설치 중...');
    execSync('pnpm install --frozen-lockfile', { stdio: 'inherit' });
    
    // 타입 체크
    logInfo('TypeScript 타입 체크 중...');
    execSync('pnpm type-check', { stdio: 'inherit' });
    
    // 린트 체크
    logInfo('ESLint 검사 중...');
    execSync('pnpm lint', { stdio: 'inherit' });
    
    // 테스트 실행
    logInfo('테스트 실행 중...');
    execSync('pnpm test --run', { stdio: 'inherit' });
    
    // 프로덕션 빌드
    logInfo('프로덕션 빌드 중...');
    execSync(`NODE_ENV=${environment} pnpm build`, { stdio: 'inherit' });
    
    // 빌드 결과 검증
    const buildDirs = ['dist', 'build', 'apps/client/dist'];
    let buildDir = null;
    
    for (const dir of buildDirs) {
      if (fs.existsSync(dir)) {
        buildDir = dir;
        break;
      }
    }
    
    if (!buildDir) {
      throw new Error('빌드 결과물을 찾을 수 없습니다');
    }
    
    const buildFiles = fs.readdirSync(buildDir);
    if (buildFiles.length === 0) {
      throw new Error('빌드 결과물이 비어있습니다');
    }
    
    logSuccess(`빌드 완료: ${buildFiles.length}개 파일 생성됨`);
    return buildDir;
    
  } catch (error) {
    logError(`빌드 실패: ${error.message}`);
    deploymentState.errors.push(`Build failed: ${error.message}`);
    return null;
  }
}

/**
 * S3에 빌드 결과물 배포
 */
function deployToS3(buildDir, environment) {
  logSection('S3 배포');
  
  try {
    deploymentState.currentStep = 'deploy';
    
    const config = DEPLOYMENT_CONFIG.environments[environment];
    const s3Bucket = config.s3Bucket;
    
    logInfo(`S3 배포 시작: s3://${s3Bucket}`);
    
    // 빌드 결과물을 S3에 동기화
    const syncCommand = `aws s3 sync ${buildDir}/ s3://${s3Bucket}/ --delete --cache-control "public,max-age=31536000" --exclude "*.html" --exclude "service-worker.js"`;
    execSync(syncCommand, { stdio: 'inherit' });
    
    // HTML 파일은 별도 캐시 정책 적용
    const htmlCommand = `aws s3 sync ${buildDir}/ s3://${s3Bucket}/ --exclude "*" --include "*.html" --include "service-worker.js" --cache-control "public,max-age=0,must-revalidate"`;
    execSync(htmlCommand, { stdio: 'inherit' });
    
    // 배포 메타데이터 생성
    const deploymentMetadata = {
      timestamp: new Date().toISOString(),
      environment: environment,
      deploymentId: deploymentState.deploymentId,
      s3Bucket: s3Bucket,
      gitCommit: execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim(),
      gitBranch: execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim(),
      buildDir: buildDir,
      fileCount: fs.readdirSync(buildDir).length
    };
    
    const metadataFile = `/tmp/deployment-metadata-${Date.now()}.json`;
    fs.writeFileSync(metadataFile, JSON.stringify(deploymentMetadata, null, 2));
    
    execSync(`aws s3 cp ${metadataFile} s3://${s3Bucket}/deployment-metadata.json --cache-control "public,max-age=60"`);
    
    logSuccess('S3 배포 완료');
    fs.unlinkSync(metadataFile);
    
    return true;
    
  } catch (error) {
    logError(`S3 배포 실패: ${error.message}`);
    deploymentState.errors.push(`S3 deployment failed: ${error.message}`);
    return false;
  }
}

/**
 * CloudFront 캐시 무효화
 */
function invalidateCloudFront(environment) {
  logSection('CloudFront 캐시 무효화');
  
  try {
    const config = DEPLOYMENT_CONFIG.environments[environment];
    
    if (!config.cloudFrontId) {
      // 설정 파일에서 CloudFront ID 로드 시도
      const domainConfigFile = 'config/domain-config.json';
      if (fs.existsSync(domainConfigFile)) {
        const domainConfig = JSON.parse(fs.readFileSync(domainConfigFile, 'utf-8'));
        config.cloudFrontId = domainConfig.distributionId;
      }
    }
    
    if (!config.cloudFrontId) {
      logWarning('CloudFront 배포 ID가 설정되지 않았습니다. 캐시 무효화를 건너뜁니다.');
      return true;
    }
    
    logInfo(`CloudFront 캐시 무효화 중: ${config.cloudFrontId}`);
    
    const invalidationCommand = `aws cloudfront create-invalidation --distribution-id ${config.cloudFrontId} --paths "/*"`;
    const result = JSON.parse(execSync(invalidationCommand, { encoding: 'utf-8' }));
    
    const invalidationId = result.Invalidation.Id;
    logSuccess(`캐시 무효화 요청됨: ${invalidationId}`);
    
    // 무효화 완료 대기 (선택적)
    logInfo('캐시 무효화 완료 대기 중...');
    const waitCommand = `aws cloudfront wait invalidation-completed --distribution-id ${config.cloudFrontId} --id ${invalidationId}`;
    execSync(waitCommand, { stdio: 'pipe', timeout: 300000 }); // 5분 타임아웃
    
    logSuccess('CloudFront 캐시 무효화 완료');
    return true;
    
  } catch (error) {
    logWarning(`CloudFront 캐시 무효화 실패: ${error.message}`);
    deploymentState.warnings.push(`CloudFront invalidation failed: ${error.message}`);
    return true; // 무효화 실패는 배포 실패로 간주하지 않음
  }
}

/**
 * 배포 후 헬스체크
 */
function performHealthCheck(environment) {
  logSection('배포 후 헬스체크');
  
  const config = DEPLOYMENT_CONFIG.environments[environment];
  const healthCheckUrl = `https://${config.domain}/health`;
  const maxRetries = DEPLOYMENT_CONFIG.healthCheck.maxRetries;
  const retryDelay = DEPLOYMENT_CONFIG.healthCheck.retryDelay;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logInfo(`헬스체크 시도 ${attempt}/${maxRetries}: ${healthCheckUrl}`);
      
      // curl을 사용한 헬스체크
      const curlCommand = `curl -f -s -o /dev/null -w "%{http_code}" --max-time 10 ${healthCheckUrl}`;
      const statusCode = execSync(curlCommand, { encoding: 'utf-8' }).trim();
      
      if (statusCode === '200') {
        logSuccess('헬스체크 통과');
        
        // 추가적인 기능 테스트
        return performFunctionalTests(environment);
      }
      
      logWarning(`헬스체크 실패 (HTTP ${statusCode})`);
      
      if (attempt < maxRetries) {
        logInfo(`${retryDelay / 1000}초 후 재시도...`);
        // JavaScript에서 sleep 구현
        execSync(`sleep ${retryDelay / 1000}`, { stdio: 'pipe' });
      }
      
    } catch (error) {
      logWarning(`헬스체크 오류: ${error.message}`);
      
      if (attempt < maxRetries) {
        logInfo(`${retryDelay / 1000}초 후 재시도...`);
        execSync(`sleep ${retryDelay / 1000}`, { stdio: 'pipe' });
      }
    }
  }
  
  logError('헬스체크 최종 실패');
  deploymentState.errors.push('Health check failed after maximum retries');
  return false;
}

/**
 * 기능 테스트 실행
 */
function performFunctionalTests(environment) {
  logSection('기능 테스트');
  
  try {
    const config = DEPLOYMENT_CONFIG.environments[environment];
    const baseUrl = `https://${config.domain}`;
    
    // 기본적인 페이지 로드 테스트
    const testCases = [
      { name: '메인 페이지', url: baseUrl },
      { name: 'API 상태', url: `${config.apiUrl}/health` },
    ];
    
    for (const testCase of testCases) {
      logInfo(`테스트: ${testCase.name}`);
      
      try {
        const curlCommand = `curl -f -s -o /dev/null -w "%{http_code}" --max-time 10 "${testCase.url}"`;
        const statusCode = execSync(curlCommand, { encoding: 'utf-8' }).trim();
        
        if (statusCode === '200') {
          logSuccess(`✓ ${testCase.name} 통과`);
        } else {
          logWarning(`⚠ ${testCase.name} 실패 (HTTP ${statusCode})`);
          deploymentState.warnings.push(`Functional test failed: ${testCase.name}`);
        }
      } catch (error) {
        logWarning(`⚠ ${testCase.name} 오류: ${error.message}`);
        deploymentState.warnings.push(`Functional test error: ${testCase.name}`);
      }
    }
    
    // E2E 테스트 실행 (선택적)
    if (fs.existsSync('e2e') && environment === 'staging') {
      logInfo('E2E 테스트 실행 중...');
      try {
        execSync(`pnpm test:e2e --baseURL=${baseUrl}`, { stdio: 'inherit' });
        logSuccess('E2E 테스트 통과');
      } catch (error) {
        logWarning('E2E 테스트 실패');
        deploymentState.warnings.push('E2E tests failed');
      }
    }
    
    return true;
    
  } catch (error) {
    logError(`기능 테스트 실패: ${error.message}`);
    deploymentState.errors.push(`Functional tests failed: ${error.message}`);
    return false;
  }
}

/**
 * 롤백 실행
 */
function performRollback(environment) {
  logSection('배포 롤백');
  
  try {
    if (!deploymentState.backupVersion) {
      logError('롤백할 백업 버전이 없습니다');
      return false;
    }
    
    const config = DEPLOYMENT_CONFIG.environments[environment];
    const backupKey = `backups/${environment}/${deploymentState.backupVersion}/`;
    
    logInfo(`롤백 시작: ${backupKey}`);
    
    // 백업에서 복구
    const restoreCommand = `aws s3 sync s3://${config.s3Bucket}-backups/${backupKey} s3://${config.s3Bucket}/ --delete`;
    execSync(restoreCommand, { stdio: 'inherit' });
    
    // CloudFront 캐시 무효화
    invalidateCloudFront(environment);
    
    logSuccess('롤백 완료');
    
    // 롤백 후 헬스체크
    if (performHealthCheck(environment)) {
      logSuccess('롤백 후 헬스체크 통과');
      return true;
    } else {
      logError('롤백 후에도 헬스체크 실패');
      return false;
    }
    
  } catch (error) {
    logError(`롤백 실패: ${error.message}`);
    return false;
  }
}

/**
 * 배포 완료 알림
 */
function sendDeploymentNotification(environment, success, deploymentTime) {
  logSection('배포 완료 알림');
  
  try {
    const config = DEPLOYMENT_CONFIG.environments[environment];
    
    const notificationData = {
      environment: environment,
      status: success ? 'SUCCESS' : 'FAILED',
      deploymentId: deploymentState.deploymentId,
      deploymentTime: deploymentTime,
      domain: config.domain,
      gitCommit: execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim(),
      gitBranch: execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim(),
      errors: deploymentState.errors,
      warnings: deploymentState.warnings
    };
    
    // Slack 웹훅 또는 이메일 알림 (설정이 있는 경우)
    const monitoringConfigFile = 'config/monitoring-config.json';
    if (fs.existsSync(monitoringConfigFile)) {
      const monitoringConfig = JSON.parse(fs.readFileSync(monitoringConfigFile, 'utf-8'));
      
      if (monitoringConfig.snsTopics && monitoringConfig.snsTopics['info-alerts']) {
        const message = JSON.stringify(notificationData, null, 2);
        const subject = `TODO App 배포 ${success ? '성공' : '실패'} - ${environment}`;
        
        const publishCommand = `aws sns publish --topic-arn ${monitoringConfig.snsTopics['info-alerts']} --subject "${subject}" --message '${message}'`;
        execSync(publishCommand, { stdio: 'pipe' });
        
        logSuccess('배포 알림 전송됨');
      }
    }
    
    // 배포 로그 저장
    const logFile = `logs/deployment-${environment}-${deploymentState.deploymentId}.json`;
    const logDir = path.dirname(logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    fs.writeFileSync(logFile, JSON.stringify(notificationData, null, 2));
    logSuccess(`배포 로그 저장됨: ${logFile}`);
    
  } catch (error) {
    logWarning(`배포 알림 전송 실패: ${error.message}`);
  }
}

/**
 * 배포 상태 요약 출력
 */
function printDeploymentSummary(environment, success, deploymentTime) {
  logSection('배포 결과 요약');
  
  const config = DEPLOYMENT_CONFIG.environments[environment];
  
  log(`\n환경: ${environment.toUpperCase()}`, 'bright');
  log(`도메인: https://${config.domain}`, 'cyan');
  log(`배포 ID: ${deploymentState.deploymentId}`, 'cyan');
  log(`소요 시간: ${Math.round(deploymentTime / 1000)}초`, 'cyan');
  log(`Git 커밋: ${execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()}`, 'cyan');
  
  if (success) {
    log('\n🎉 배포가 성공적으로 완료되었습니다!', 'green');
  } else {
    log('\n💥 배포가 실패했습니다', 'red');
  }
  
  if (deploymentState.errors.length > 0) {
    log('\n❌ 오류:', 'red');
    deploymentState.errors.forEach(error => {
      log(`  • ${error}`, 'red');
    });
  }
  
  if (deploymentState.warnings.length > 0) {
    log('\n⚠️  경고:', 'yellow');
    deploymentState.warnings.forEach(warning => {
      log(`  • ${warning}`, 'yellow');
    });
  }
  
  log('\n🔗 유용한 링크:', 'bright');
  log(`  • 웹사이트: https://${config.domain}`);
  log(`  • CloudWatch: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=TodoApp-Production`);
  log(`  • S3 버킷: https://console.aws.amazon.com/s3/buckets/${config.s3Bucket}`);
  
  if (config.cloudFrontId) {
    log(`  • CloudFront: https://console.aws.amazon.com/cloudfront/home?region=us-east-1#distribution-settings:${config.cloudFrontId}`);
  }
}

/**
 * 메인 배포 함수
 */
async function deployToEnvironment(environment) {
  deploymentState.startTime = Date.now();
  deploymentState.deploymentId = `deploy-${environment}-${Date.now()}`;
  
  log(`🚀 ${environment.toUpperCase()} 환경 배포 시작`, 'bright');
  log(`배포 ID: ${deploymentState.deploymentId}`, 'cyan');
  
  try {
    // 1. 배포 전 검증
    if (!runPreDeploymentValidation()) {
      throw new Error('배포 전 검증 실패');
    }
    
    // 2. 현재 배포 백업
    if (!backupCurrentDeployment(environment)) {
      throw new Error('배포 백업 실패');
    }
    
    // 3. 애플리케이션 빌드
    const buildDir = buildApplication(environment);
    if (!buildDir) {
      throw new Error('애플리케이션 빌드 실패');
    }
    
    // 4. S3에 배포
    if (!deployToS3(buildDir, environment)) {
      throw new Error('S3 배포 실패');
    }
    
    // 5. CloudFront 캐시 무효화
    invalidateCloudFront(environment);
    
    // 6. 배포 후 헬스체크
    if (!performHealthCheck(environment)) {
      if (DEPLOYMENT_CONFIG.rollback.autoRollback) {
        logWarning('헬스체크 실패로 자동 롤백 시작');
        if (performRollback(environment)) {
          throw new Error('배포 실패 후 롤백 완료');
        } else {
          throw new Error('배포 실패 및 롤백도 실패');
        }
      } else {
        throw new Error('배포 후 헬스체크 실패');
      }
    }
    
    const deploymentTime = Date.now() - deploymentState.startTime;
    
    // 7. 배포 완료 알림
    sendDeploymentNotification(environment, true, deploymentTime);
    
    // 8. 결과 요약
    printDeploymentSummary(environment, true, deploymentTime);
    
    return true;
    
  } catch (error) {
    const deploymentTime = Date.now() - deploymentState.startTime;
    
    logError(`배포 실패: ${error.message}`);
    
    // 실패 알림
    sendDeploymentNotification(environment, false, deploymentTime);
    
    // 결과 요약
    printDeploymentSummary(environment, false, deploymentTime);
    
    return false;
  }
}

/**
 * 사용법 출력
 */
function showUsage() {
  log('🚀 TODO 앱 프로덕션 배포 스크립트', 'bright');
  log('\n사용법:', 'bright');
  log('  node deploy-production.js <환경> [옵션]');
  
  log('\n환경:', 'bright');
  log('  staging     - 스테이징 환경 배포');
  log('  production  - 프로덕션 환경 배포');
  
  log('\n옵션:', 'bright');
  log('  --skip-validation    - 배포 전 검증 건너뛰기');
  log('  --skip-backup        - 배포 백업 건너뛰기');
  log('  --skip-tests         - 테스트 건너뛰기');
  log('  --no-rollback        - 자동 롤백 비활성화');
  
  log('\n예시:', 'bright');
  log('  node deploy-production.js staging');
  log('  node deploy-production.js production --skip-tests');
  log('  node deploy-production.js production --no-rollback');
}

/**
 * 메인 실행 함수
 */
function main() {
  const args = process.argv.slice(2);
  const environment = args[0];
  
  if (!environment || !['staging', 'production'].includes(environment)) {
    showUsage();
    process.exit(1);
  }
  
  // 옵션 파싱
  const options = {
    skipValidation: args.includes('--skip-validation'),
    skipBackup: args.includes('--skip-backup'),
    skipTests: args.includes('--skip-tests'),
    noRollback: args.includes('--no-rollback')
  };
  
  if (options.noRollback) {
    DEPLOYMENT_CONFIG.rollback.autoRollback = false;
  }
  
  // 프로덕션 배포 시 추가 확인
  if (environment === 'production') {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('프로덕션 환경에 배포하시겠습니까? (yes/no): ', (answer) => {
      rl.close();
      
      if (answer.toLowerCase() !== 'yes') {
        log('배포가 취소되었습니다.', 'yellow');
        process.exit(0);
      }
      
      // 배포 실행
      deployToEnvironment(environment).then(success => {
        process.exit(success ? 0 : 1);
      });
    });
  } else {
    // 스테이징은 바로 배포
    deployToEnvironment(environment).then(success => {
      process.exit(success ? 0 : 1);
    });
  }
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = {
  deployToEnvironment,
  runPreDeploymentValidation,
  buildApplication,
  deployToS3,
  performHealthCheck,
  performRollback,
};