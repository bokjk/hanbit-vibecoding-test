#!/usr/bin/env node

/**
 * 백업 및 복구 자동화 스크립트
 * AWS S3, DynamoDB를 통한 데이터 백업 및 복구 시스템
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
  log(`\n${'='.repeat(50)}`, 'cyan');
  log(`${title}`, 'bright');
  log(`${'='.repeat(50)}`, 'cyan');
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
 * 백업 설정
 */
const BACKUP_CONFIG = {
  s3: {
    bucketName: 'todo-app-backups',
    region: 'us-east-1',
    storageClass: 'STANDARD_IA', // 비용 최적화를 위한 Infrequent Access
  },
  dynamodb: {
    tableName: 'todos',
    region: 'us-east-1',
  },
  retention: {
    daily: 30,    // 30일간 일일 백업 보관
    weekly: 12,   // 12주간 주간 백업 보관  
    monthly: 12,  // 12개월간 월간 백업 보관
  },
  schedule: {
    daily: '0 2 * * *',      // 매일 새벽 2시
    weekly: '0 3 * * 0',     // 매주 일요일 새벽 3시
    monthly: '0 4 1 * *',    // 매월 1일 새벽 4시
  }
};

/**
 * 백업 버킷 생성 및 설정
 */
function setupBackupBucket() {
  logSection('백업 S3 버킷 설정');
  
  const bucketName = BACKUP_CONFIG.s3.bucketName;
  const region = BACKUP_CONFIG.s3.region;
  
  try {
    // 버킷 존재 확인
    try {
      execSync(`aws s3api head-bucket --bucket ${bucketName}`, { stdio: 'pipe' });
      logSuccess(`백업 버킷이 이미 존재합니다: ${bucketName}`);
    } catch (error) {
      // 버킷 생성
      logInfo('백업 버킷을 생성합니다...');
      if (region === 'us-east-1') {
        execSync(`aws s3api create-bucket --bucket ${bucketName}`);
      } else {
        execSync(`aws s3api create-bucket --bucket ${bucketName} --region ${region} --create-bucket-configuration LocationConstraint=${region}`);
      }
      logSuccess(`백업 버킷 생성됨: ${bucketName}`);
    }
    
    // 버킷 정책 설정 (접근 제한)
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Deny',
          Principal: '*',
          Action: 's3:*',
          Resource: [
            `arn:aws:s3:::${bucketName}`,
            `arn:aws:s3:::${bucketName}/*`
          ],
          Condition: {
            StringNotEquals: {
              'aws:SourceAccount': '{{AWS_ACCOUNT_ID}}'
            }
          }
        }
      ]
    };
    
    const policyFile = `/tmp/backup-bucket-policy-${Date.now()}.json`;
    fs.writeFileSync(policyFile, JSON.stringify(bucketPolicy, null, 2));
    
    // AWS 계정 ID 가져오기
    const identity = JSON.parse(execSync('aws sts get-caller-identity', { encoding: 'utf-8' }));
    const accountId = identity.Account;
    
    // 정책 파일에서 계정 ID 교체
    let policyContent = fs.readFileSync(policyFile, 'utf-8');
    policyContent = policyContent.replace('{{AWS_ACCOUNT_ID}}', accountId);
    fs.writeFileSync(policyFile, policyContent);
    
    // 버킷 정책 적용
    execSync(`aws s3api put-bucket-policy --bucket ${bucketName} --policy file://${policyFile}`);
    logSuccess('버킷 보안 정책 적용됨');
    
    // 버킷 암호화 설정
    const encryptionConfig = {
      Rules: [
        {
          ApplyServerSideEncryptionByDefault: {
            SSEAlgorithm: 'AES256'
          },
          BucketKeyEnabled: true
        }
      ]
    };
    
    const encryptionFile = `/tmp/bucket-encryption-${Date.now()}.json`;
    fs.writeFileSync(encryptionFile, JSON.stringify(encryptionConfig, null, 2));
    
    execSync(`aws s3api put-bucket-encryption --bucket ${bucketName} --server-side-encryption-configuration file://${encryptionFile}`);
    logSuccess('버킷 암호화 설정 완료');
    
    // 버킷 생명주기 정책 설정
    setupBucketLifecycle(bucketName);
    
    // 설정 파일 정리
    fs.unlinkSync(policyFile);
    fs.unlinkSync(encryptionFile);
    
  } catch (error) {
    logError(`백업 버킷 설정 실패: ${error.message}`);
    throw error;
  }
}

/**
 * 버킷 생명주기 정책 설정
 */
function setupBucketLifecycle(bucketName) {
  const lifecycleConfig = {
    Rules: [
      {
        ID: 'DailyBackupRetention',
        Status: 'Enabled',
        Filter: {
          Prefix: 'daily/'
        },
        Expiration: {
          Days: BACKUP_CONFIG.retention.daily
        }
      },
      {
        ID: 'WeeklyBackupRetention',
        Status: 'Enabled',
        Filter: {
          Prefix: 'weekly/'
        },
        Expiration: {
          Days: BACKUP_CONFIG.retention.weekly * 7
        }
      },
      {
        ID: 'MonthlyBackupRetention',
        Status: 'Enabled',
        Filter: {
          Prefix: 'monthly/'
        },
        Expiration: {
          Days: BACKUP_CONFIG.retention.monthly * 30
        }
      },
      {
        ID: 'TransitionToIA',
        Status: 'Enabled',
        Filter: {},
        Transitions: [
          {
            Days: 30,
            StorageClass: 'STANDARD_IA'
          },
          {
            Days: 90,
            StorageClass: 'GLACIER'
          },
          {
            Days: 365,
            StorageClass: 'DEEP_ARCHIVE'
          }
        ]
      }
    ]
  };

  const lifecycleFile = `/tmp/bucket-lifecycle-${Date.now()}.json`;
  fs.writeFileSync(lifecycleFile, JSON.stringify(lifecycleConfig, null, 2));
  
  try {
    execSync(`aws s3api put-bucket-lifecycle-configuration --bucket ${bucketName} --lifecycle-configuration file://${lifecycleFile}`);
    logSuccess('버킷 생명주기 정책 설정 완료');
    fs.unlinkSync(lifecycleFile);
  } catch (error) {
    logError(`생명주기 정책 설정 실패: ${error.message}`);
    fs.unlinkSync(lifecycleFile);
  }
}

/**
 * DynamoDB 백업
 */
function backupDynamoDB(tableName, backupType = 'daily') {
  logSection('DynamoDB 테이블 백업');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `${tableName}-${backupType}-${timestamp}`;
  
  try {
    logInfo(`DynamoDB 테이블 백업 시작: ${tableName}`);
    
    // 온디맨드 백업 생성
    const backupCommand = `aws dynamodb create-backup --table-name ${tableName} --backup-name ${backupName}`;
    const result = JSON.parse(execSync(backupCommand, { encoding: 'utf-8' }));
    
    const backupArn = result.BackupDetails.BackupArn;
    logSuccess(`DynamoDB 백업 생성됨: ${backupName}`);
    logInfo(`백업 ARN: ${backupArn}`);
    
    // 백업 메타데이터를 S3에 저장
    const metadata = {
      tableName: tableName,
      backupName: backupName,
      backupArn: backupArn,
      backupType: backupType,
      timestamp: new Date().toISOString(),
      status: 'CREATING'
    };
    
    const metadataFile = `/tmp/backup-metadata-${timestamp}.json`;
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    
    const s3Key = `${backupType}/dynamodb/${tableName}/${timestamp}/metadata.json`;
    const uploadCommand = `aws s3 cp ${metadataFile} s3://${BACKUP_CONFIG.s3.bucketName}/${s3Key}`;
    execSync(uploadCommand);
    
    logSuccess('백업 메타데이터 S3에 저장됨');
    fs.unlinkSync(metadataFile);
    
    return {
      backupArn,
      backupName,
      s3Key
    };
    
  } catch (error) {
    logError(`DynamoDB 백업 실패: ${error.message}`);
    throw error;
  }
}

/**
 * 애플리케이션 설정 백업
 */
function backupApplicationConfig(backupType = 'daily') {
  logSection('애플리케이션 설정 백업');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  try {
    // 백업할 설정 파일들
    const configFiles = [
      '.env.production',
      'config/domain-config.json',
      'config/monitoring-config.json',
      'package.json',
      'pnpm-lock.yaml'
    ];
    
    // 임시 백업 디렉토리 생성
    const tempBackupDir = `/tmp/config-backup-${timestamp}`;
    fs.mkdirSync(tempBackupDir, { recursive: true });
    
    let backedUpFiles = [];
    
    for (const configFile of configFiles) {
      if (fs.existsSync(configFile)) {
        const destFile = path.join(tempBackupDir, path.basename(configFile));
        fs.copyFileSync(configFile, destFile);
        backedUpFiles.push(configFile);
        logSuccess(`설정 파일 백업됨: ${configFile}`);
      } else {
        logWarning(`설정 파일 없음: ${configFile}`);
      }
    }
    
    // 백업 메타데이터 생성
    const metadata = {
      timestamp: new Date().toISOString(),
      backupType: backupType,
      files: backedUpFiles,
      version: process.env.npm_package_version || '1.0.0'
    };
    
    const metadataFile = path.join(tempBackupDir, 'backup-metadata.json');
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    
    // ZIP 압축
    const zipFile = `/tmp/config-backup-${timestamp}.zip`;
    execSync(`cd ${tempBackupDir} && zip -r ${zipFile} .`, { stdio: 'pipe' });
    
    // S3 업로드
    const s3Key = `${backupType}/config/${timestamp}/config-backup.zip`;
    const uploadCommand = `aws s3 cp ${zipFile} s3://${BACKUP_CONFIG.s3.bucketName}/${s3Key} --storage-class ${BACKUP_CONFIG.s3.storageClass}`;
    execSync(uploadCommand);
    
    logSuccess(`설정 백업 S3 업로드 완료: ${s3Key}`);
    
    // 임시 파일 정리
    execSync(`rm -rf ${tempBackupDir} ${zipFile}`);
    
    return s3Key;
    
  } catch (error) {
    logError(`애플리케이션 설정 백업 실패: ${error.message}`);
    throw error;
  }
}

/**
 * 코드 저장소 백업
 */
function backupCodeRepository(backupType = 'daily') {
  logSection('코드 저장소 백업');
  
  const timestamp = new Date().toIISOString().replace(/[:.]/g, '-');
  
  try {
    // Git 저장소 확인
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8' });
    if (gitStatus.trim()) {
      logWarning('커밋되지 않은 변경사항이 있습니다');
      logInfo('백업 전에 모든 변경사항을 커밋하는 것을 권장합니다');
    }
    
    // 현재 브랜치 및 커밋 정보
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    const currentCommit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    
    logInfo(`현재 브랜치: ${currentBranch}`);
    logInfo(`현재 커밋: ${currentCommit}`);
    
    // Git bundle 생성 (전체 히스토리 포함)
    const bundleFile = `/tmp/repo-backup-${timestamp}.bundle`;
    execSync(`git bundle create ${bundleFile} --all`);
    
    logSuccess('Git bundle 생성 완료');
    
    // 백업 메타데이터 생성
    const repoMetadata = {
      timestamp: new Date().toISOString(),
      backupType: backupType,
      branch: currentBranch,
      commit: currentCommit,
      uncommittedChanges: gitStatus.trim() !== '',
      bundleSize: fs.statSync(bundleFile).size
    };
    
    const metadataFile = `/tmp/repo-metadata-${timestamp}.json`;
    fs.writeFileSync(metadataFile, JSON.stringify(repoMetadata, null, 2));
    
    // S3 업로드
    const bundleS3Key = `${backupType}/repository/${timestamp}/repository.bundle`;
    const metadataS3Key = `${backupType}/repository/${timestamp}/metadata.json`;
    
    execSync(`aws s3 cp ${bundleFile} s3://${BACKUP_CONFIG.s3.bucketName}/${bundleS3Key} --storage-class ${BACKUP_CONFIG.s3.storageClass}`);
    execSync(`aws s3 cp ${metadataFile} s3://${BACKUP_CONFIG.s3.bucketName}/${metadataS3Key}`);
    
    logSuccess(`저장소 백업 S3 업로드 완료: ${bundleS3Key}`);
    
    // 임시 파일 정리
    fs.unlinkSync(bundleFile);
    fs.unlinkSync(metadataFile);
    
    return {
      bundleS3Key,
      metadataS3Key,
      commit: currentCommit
    };
    
  } catch (error) {
    logError(`코드 저장소 백업 실패: ${error.message}`);
    throw error;
  }
}

/**
 * 정적 파일 백업 (빌드 결과물)
 */
function backupStaticFiles(backupType = 'daily') {
  logSection('정적 파일 백업');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  try {
    const buildDirs = ['dist', 'build', 'apps/client/dist'];
    let backedUpDir = null;
    
    // 빌드 디렉토리 찾기
    for (const buildDir of buildDirs) {
      if (fs.existsSync(buildDir)) {
        backedUpDir = buildDir;
        break;
      }
    }
    
    if (!backedUpDir) {
      logWarning('빌드 디렉토리를 찾을 수 없습니다. 빌드를 먼저 실행하세요.');
      return null;
    }
    
    logInfo(`정적 파일 백업 중: ${backedUpDir}`);
    
    // 빌드 디렉토리 압축
    const tarFile = `/tmp/static-files-${timestamp}.tar.gz`;
    execSync(`tar -czf ${tarFile} -C ${path.dirname(backedUpDir)} ${path.basename(backedUpDir)}`);
    
    const fileSize = fs.statSync(tarFile).size;
    logSuccess(`정적 파일 압축 완료 (${Math.round(fileSize / 1024)} KB)`);
    
    // 백업 메타데이터
    const metadata = {
      timestamp: new Date().toISOString(),
      backupType: backupType,
      sourceDir: backedUpDir,
      fileSize: fileSize,
      fileCount: execSync(`find ${backedUpDir} -type f | wc -l`, { encoding: 'utf-8' }).trim()
    };
    
    const metadataFile = `/tmp/static-metadata-${timestamp}.json`;
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
    
    // S3 업로드
    const tarS3Key = `${backupType}/static/${timestamp}/static-files.tar.gz`;
    const metadataS3Key = `${backupType}/static/${timestamp}/metadata.json`;
    
    execSync(`aws s3 cp ${tarFile} s3://${BACKUP_CONFIG.s3.bucketName}/${tarS3Key} --storage-class ${BACKUP_CONFIG.s3.storageClass}`);
    execSync(`aws s3 cp ${metadataFile} s3://${BACKUP_CONFIG.s3.bucketName}/${metadataS3Key}`);
    
    logSuccess(`정적 파일 백업 업로드 완료: ${tarS3Key}`);
    
    // 임시 파일 정리
    fs.unlinkSync(tarFile);
    fs.unlinkSync(metadataFile);
    
    return {
      tarS3Key,
      metadataS3Key,
      fileSize
    };
    
  } catch (error) {
    logError(`정적 파일 백업 실패: ${error.message}`);
    return null;
  }
}

/**
 * 전체 백업 실행
 */
function performFullBackup(backupType = 'daily') {
  logSection(`전체 백업 실행 (${backupType})`);
  
  const backupResults = {
    timestamp: new Date().toISOString(),
    backupType: backupType,
    results: {}
  };
  
  try {
    // 1. DynamoDB 백업
    if (BACKUP_CONFIG.dynamodb.tableName) {
      logInfo('DynamoDB 백업 시작...');
      backupResults.results.dynamodb = backupDynamoDB(BACKUP_CONFIG.dynamodb.tableName, backupType);
    }
    
    // 2. 애플리케이션 설정 백업
    logInfo('애플리케이션 설정 백업 시작...');
    backupResults.results.config = backupApplicationConfig(backupType);
    
    // 3. 코드 저장소 백업
    logInfo('코드 저장소 백업 시작...');
    backupResults.results.repository = backupCodeRepository(backupType);
    
    // 4. 정적 파일 백업
    logInfo('정적 파일 백업 시작...');
    backupResults.results.static = backupStaticFiles(backupType);
    
    // 백업 결과 요약 저장
    const summaryFile = `/tmp/backup-summary-${Date.now()}.json`;
    fs.writeFileSync(summaryFile, JSON.stringify(backupResults, null, 2));
    
    const summaryS3Key = `${backupType}/summary/${backupResults.timestamp.replace(/[:.]/g, '-')}/backup-summary.json`;
    execSync(`aws s3 cp ${summaryFile} s3://${BACKUP_CONFIG.s3.bucketName}/${summaryS3Key}`);
    
    logSuccess('백업 요약 정보 저장됨');
    fs.unlinkSync(summaryFile);
    
    return backupResults;
    
  } catch (error) {
    logError(`전체 백업 실패: ${error.message}`);
    backupResults.error = error.message;
    return backupResults;
  }
}

/**
 * 백업 목록 조회
 */
function listBackups(backupType = 'all') {
  logSection('백업 목록 조회');
  
  try {
    const bucketName = BACKUP_CONFIG.s3.bucketName;
    let prefix = '';
    
    if (backupType !== 'all') {
      prefix = `--prefix ${backupType}/`;
    }
    
    const listCommand = `aws s3 ls s3://${bucketName}/ ${prefix} --recursive --human-readable`;
    const backupList = execSync(listCommand, { encoding: 'utf-8' });
    
    logSuccess('백업 목록:');
    log(backupList, 'cyan');
    
    // 백업 요약 정보만 추출
    const summaryCommand = `aws s3 ls s3://${bucketName}/ --recursive | grep "backup-summary.json"`;
    try {
      const summaries = execSync(summaryCommand, { encoding: 'utf-8' });
      logInfo('\n백업 요약 파일들:');
      log(summaries, 'blue');
    } catch (error) {
      logWarning('백업 요약 파일을 찾을 수 없습니다');
    }
    
  } catch (error) {
    logError(`백업 목록 조회 실패: ${error.message}`);
  }
}

/**
 * 복구 실행
 */
function performRestore(backupTimestamp, restoreType = 'config') {
  logSection(`데이터 복구 실행 (${restoreType})`);
  
  const bucketName = BACKUP_CONFIG.s3.bucketName;
  
  try {
    if (restoreType === 'config') {
      // 설정 파일 복구
      const configS3Key = `daily/config/${backupTimestamp}/config-backup.zip`;
      const tempZipFile = `/tmp/restore-config-${Date.now()}.zip`;
      const tempRestoreDir = `/tmp/restore-config-${Date.now()}`;
      
      // S3에서 다운로드
      execSync(`aws s3 cp s3://${bucketName}/${configS3Key} ${tempZipFile}`);
      
      // 압축 해제
      fs.mkdirSync(tempRestoreDir, { recursive: true });
      execSync(`cd ${tempRestoreDir} && unzip ${tempZipFile}`);
      
      // 메타데이터 확인
      const metadataFile = path.join(tempRestoreDir, 'backup-metadata.json');
      if (fs.existsSync(metadataFile)) {
        const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
        logInfo(`백업 생성 시간: ${metadata.timestamp}`);
        logInfo(`백업된 파일들: ${metadata.files.join(', ')}`);
        
        // 파일 복구 (기존 파일 백업 후)
        for (const file of metadata.files) {
          const sourceFile = path.join(tempRestoreDir, path.basename(file));
          if (fs.existsSync(sourceFile)) {
            // 기존 파일 백업
            if (fs.existsSync(file)) {
              const backupFile = `${file}.backup-${Date.now()}`;
              fs.copyFileSync(file, backupFile);
              logInfo(`기존 파일 백업됨: ${backupFile}`);
            }
            
            // 디렉토리 생성 (필요시)
            const fileDir = path.dirname(file);
            if (!fs.existsSync(fileDir)) {
              fs.mkdirSync(fileDir, { recursive: true });
            }
            
            // 파일 복구
            fs.copyFileSync(sourceFile, file);
            logSuccess(`파일 복구됨: ${file}`);
          }
        }
      }
      
      // 임시 파일 정리
      execSync(`rm -rf ${tempRestoreDir} ${tempZipFile}`);
      
    } else if (restoreType === 'repository') {
      // 코드 저장소 복구
      const bundleS3Key = `daily/repository/${backupTimestamp}/repository.bundle`;
      const tempBundleFile = `/tmp/restore-repo-${Date.now()}.bundle`;
      
      // S3에서 다운로드
      execSync(`aws s3 cp s3://${bucketName}/${bundleS3Key} ${tempBundleFile}`);
      
      // 새 디렉토리에서 복구
      const restoreDir = `/tmp/restored-repo-${Date.now()}`;
      fs.mkdirSync(restoreDir, { recursive: true });
      
      execSync(`cd ${restoreDir} && git clone ${tempBundleFile} .`);
      
      logSuccess(`저장소 복구 완료: ${restoreDir}`);
      logInfo('복구된 저장소를 검토한 후 필요시 현재 저장소에 병합하세요');
      
      // 임시 파일 정리
      fs.unlinkSync(tempBundleFile);
      
    } else {
      logError(`지원되지 않는 복구 타입: ${restoreType}`);
      return false;
    }
    
    logSuccess(`${restoreType} 복구가 완료되었습니다`);
    return true;
    
  } catch (error) {
    logError(`복구 실패: ${error.message}`);
    return false;
  }
}

/**
 * 백업 스케줄러 설정 (cron 기반)
 */
function setupBackupSchedule() {
  logSection('백업 스케줄러 설정');
  
  try {
    const scriptPath = path.resolve(__filename);
    const logFile = path.resolve('logs/backup.log');
    
    // 로그 디렉토리 생성
    const logDir = path.dirname(logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Crontab 엔트리 생성
    const cronEntries = [
      `# TODO App 백업 스케줄`,
      `${BACKUP_CONFIG.schedule.daily} /usr/bin/node ${scriptPath} backup daily >> ${logFile} 2>&1`,
      `${BACKUP_CONFIG.schedule.weekly} /usr/bin/node ${scriptPath} backup weekly >> ${logFile} 2>&1`,
      `${BACKUP_CONFIG.schedule.monthly} /usr/bin/node ${scriptPath} backup monthly >> ${logFile} 2>&1`,
    ];
    
    const cronFile = `/tmp/todo-app-backup-cron-${Date.now()}`;
    fs.writeFileSync(cronFile, cronEntries.join('\n') + '\n');
    
    logSuccess('Cron 엔트리 생성됨');
    logInfo('다음 명령으로 crontab에 추가하세요:');
    logInfo(`crontab -l > current_cron && cat ${cronFile} >> current_cron && crontab current_cron && rm current_cron`);
    logInfo(`또는: crontab -e로 직접 편집`);
    
    log('\nCron 엔트리:', 'bright');
    cronEntries.forEach(entry => log(`  ${entry}`, 'cyan'));
    
    return cronFile;
    
  } catch (error) {
    logError(`백업 스케줄러 설정 실패: ${error.message}`);
    return null;
  }
}

/**
 * 백업 상태 확인
 */
function checkBackupHealth() {
  logSection('백업 시스템 상태 확인');
  
  const bucketName = BACKUP_CONFIG.s3.bucketName;
  
  try {
    // 버킷 접근 가능성 확인
    execSync(`aws s3 ls s3://${bucketName}/`, { stdio: 'pipe' });
    logSuccess('백업 버킷 접근 가능');
    
    // 최근 백업 확인
    const recentBackups = execSync(`aws s3 ls s3://${bucketName}/ --recursive | grep backup-summary.json | tail -5`, { encoding: 'utf-8' });
    
    if (recentBackups.trim()) {
      logSuccess('최근 백업 파일들:');
      log(recentBackups, 'green');
    } else {
      logWarning('최근 백업 파일이 없습니다');
    }
    
    // DynamoDB 백업 상태 확인
    try {
      const tableName = BACKUP_CONFIG.dynamodb.tableName;
      const backupList = execSync(`aws dynamodb list-backups --table-name ${tableName} --max-results 5`, { encoding: 'utf-8' });
      const backups = JSON.parse(backupList);
      
      if (backups.BackupSummaries.length > 0) {
        logSuccess(`DynamoDB 백업 ${backups.BackupSummaries.length}개 확인됨`);
        backups.BackupSummaries.forEach((backup, index) => {
          logInfo(`${index + 1}. ${backup.BackupName} (${backup.BackupStatus})`);
        });
      } else {
        logWarning('DynamoDB 백업이 없습니다');
      }
    } catch (error) {
      logWarning('DynamoDB 백업 상태 확인 실패');
    }
    
    return true;
    
  } catch (error) {
    logError(`백업 시스템 상태 확인 실패: ${error.message}`);
    return false;
  }
}

/**
 * 메뉴 기반 인터페이스
 */
function showMenu() {
  logSection('백업 및 복구 관리');
  
  log('사용 가능한 명령:', 'bright');
  log('  setup     - 백업 시스템 초기 설정');
  log('  backup    - 백업 실행 (daily|weekly|monthly)');
  log('  list      - 백업 목록 조회');
  log('  restore   - 복구 실행');
  log('  schedule  - 백업 스케줄 설정');
  log('  health    - 백업 시스템 상태 확인');
  log('  help      - 도움말 표시');
  
  log('\n예시:', 'bright');
  log('  node backup-restore.js setup');
  log('  node backup-restore.js backup daily');
  log('  node backup-restore.js list');
  log('  node backup-restore.js restore 2024-01-15T10-30-00-000Z config');
}

/**
 * 메인 실행 함수
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === 'help') {
    showMenu();
    return;
  }
  
  log('🗄️  백업 및 복구 시스템', 'bright');
  
  try {
    switch (command) {
      case 'setup':
        setupBackupBucket();
        logSuccess('백업 시스템 초기 설정이 완료되었습니다');
        break;
        
      case 'backup':
        const backupType = args[1] || 'daily';
        if (!['daily', 'weekly', 'monthly'].includes(backupType)) {
          logError('백업 타입은 daily, weekly, monthly 중 하나여야 합니다');
          process.exit(1);
        }
        performFullBackup(backupType);
        break;
        
      case 'list':
        const listType = args[1] || 'all';
        listBackups(listType);
        break;
        
      case 'restore':
        const timestamp = args[1];
        const restoreType = args[2] || 'config';
        if (!timestamp) {
          logError('복구할 백업의 타임스탬프를 지정해주세요');
          logInfo('예: node backup-restore.js restore 2024-01-15T10-30-00-000Z config');
          process.exit(1);
        }
        performRestore(timestamp, restoreType);
        break;
        
      case 'schedule':
        setupBackupSchedule();
        break;
        
      case 'health':
        checkBackupHealth();
        break;
        
      default:
        logError(`알 수 없는 명령: ${command}`);
        showMenu();
        process.exit(1);
    }
    
  } catch (error) {
    logError(`실행 중 오류 발생: ${error.message}`);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  main();
}

module.exports = {
  setupBackupBucket,
  performFullBackup,
  performRestore,
  listBackups,
  checkBackupHealth,
  setupBackupSchedule,
};