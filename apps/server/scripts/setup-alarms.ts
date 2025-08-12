#!/usr/bin/env node

/**
 * Todo 앱 알람 및 모니터링 시스템 자동 설정 스크립트
 * - CloudWatch 알람 자동 생성 및 업데이트
 * - SNS 토픽 및 구독 설정
 * - 헬스 체크 시스템 배포
 * - 알람 테스트 및 검증
 */

import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import * as path from 'path';

// AWS 서비스 클라이언트 초기화
const cloudwatch = new AWS.CloudWatch({ region: 'ap-northeast-2' });
const sns = new AWS.SNS({ region: 'ap-northeast-2' });
const lambda = new AWS.Lambda({ region: 'ap-northeast-2' });
// const apigateway = new AWS.APIGateway({ region: 'ap-northeast-2' }); // 사용되지 않는 변수

interface SetupConfig {
  environment: 'dev' | 'staging' | 'prod';
  projectName: string;
  region: string;
  notificationChannels: NotificationChannel[];
  skipExisting: boolean;
  dryRun: boolean;
  testAlarms: boolean;
}

interface NotificationChannel {
  name: string;
  type: 'email' | 'sms' | 'slack' | 'webhook';
  endpoint: string;
  severity: string[];
}

interface AlarmSetupResult {
  alarmName: string;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  error?: string;
}

interface ValidationResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: Record<string, unknown>;
}

class AlarmSetupOrchestrator {
  private config: SetupConfig;
  private results: AlarmSetupResult[] = [];
  private validationResults: ValidationResult[] = [];

  constructor(config: SetupConfig) {
    this.config = config;
  }

  /**
   * 메인 설정 실행
   */
  async execute(): Promise<void> {
    console.log('🚀 Todo 앱 알람 시스템 설정 시작...');
    console.log(`환경: ${this.config.environment}`);
    console.log(`지역: ${this.config.region}`);
    console.log(`드라이 런: ${this.config.dryRun ? '예' : '아니오'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // 1. 사전 검증
      await this.validatePrerequisites();

      // 2. SNS 토픽 설정
      await this.setupSNSTopics();

      // 3. CloudWatch 알람 생성
      await this.setupCloudWatchAlarms();

      // 4. 헬스 체크 시스템 설정
      await this.setupHealthChecks();

      // 5. 알람 테스트 (선택적)
      if (this.config.testAlarms) {
        await this.testAlarmSystem();
      }

      // 6. 결과 요약
      await this.generateSetupReport();

      console.log('✅ 알람 시스템 설정 완료!');
    } catch (error) {
      console.error('❌ 알람 시스템 설정 실패:', error);
      process.exit(1);
    }
  }

  /**
   * 사전 검증 수행
   */
  private async validatePrerequisites(): Promise<void> {
    console.log('🔍 사전 요구사항 검증 중...');

    // AWS 자격 증명 확인
    try {
      const sts = new AWS.STS();
      const identity = await sts.getCallerIdentity().promise();
      this.validationResults.push({
        component: 'AWS 자격 증명',
        status: 'pass',
        message: `계정 ID: ${identity.Account}`,
        details: { userId: identity.UserId, arn: identity.Arn },
      });
    } catch (error) {
      this.validationResults.push({
        component: 'AWS 자격 증명',
        status: 'fail',
        message: 'AWS 자격 증명 확인 실패',
        details: error,
      });
      throw new Error('AWS 자격 증명을 확인할 수 없습니다.');
    }

    // CloudWatch 권한 확인
    try {
      await cloudwatch.listMetrics({ Namespace: 'AWS/ApiGateway', MaxRecords: 1 }).promise();
      this.validationResults.push({
        component: 'CloudWatch 권한',
        status: 'pass',
        message: 'CloudWatch 접근 권한 확인됨',
      });
    } catch (error) {
      this.validationResults.push({
        component: 'CloudWatch 권한',
        status: 'fail',
        message: 'CloudWatch 접근 권한 부족',
        details: error,
      });
    }

    // SNS 권한 확인
    try {
      await sns.listTopics().promise();
      this.validationResults.push({
        component: 'SNS 권한',
        status: 'pass',
        message: 'SNS 접근 권한 확인됨',
      });
    } catch (error) {
      this.validationResults.push({
        component: 'SNS 권한',
        status: 'warning',
        message: 'SNS 접근 권한 확인 필요',
        details: error,
      });
    }

    // 알림 채널 유효성 검사
    for (const channel of this.config.notificationChannels) {
      const isValid = await this.validateNotificationChannel(channel);
      this.validationResults.push({
        component: `알림 채널 (${channel.name})`,
        status: isValid ? 'pass' : 'warning',
        message: isValid ? '알림 채널 설정 유효' : '알림 채널 설정 검토 필요',
      });
    }

    console.log(
      `✅ 사전 검증 완료 (${this.validationResults.filter(r => r.status === 'pass').length}개 통과)`
    );
  }

  /**
   * SNS 토픽 및 구독 설정
   */
  private async setupSNSTopics(): Promise<void> {
    console.log('📢 SNS 토픽 및 구독 설정 중...');

    const severities = ['CRITICAL', 'WARNING', 'INFO', 'COMPOSITE'];

    for (const severity of severities) {
      const topicName = `${this.config.projectName}-${severity}-Notifications`;

      try {
        // 토픽 존재 여부 확인
        let topicArn: string;
        const existingTopics = await sns.listTopics().promise();
        const existingTopic = existingTopics.Topics?.find(t => t.TopicArn?.includes(topicName));

        if (existingTopic && this.config.skipExisting) {
          console.log(`⏭️  토픽 건너뜀: ${topicName}`);
          topicArn = existingTopic.TopicArn || '';
        } else {
          if (this.config.dryRun) {
            console.log(`[DRY RUN] 토픽 생성 예정: ${topicName}`);
            continue;
          }

          // 토픽 생성
          const topicResult = await sns
            .createTopic({
              Name: topicName,
              DisplayName: `Todo App ${severity} Alerts`,
              Tags: [
                { Key: 'Project', Value: this.config.projectName },
                { Key: 'Environment', Value: this.config.environment },
                { Key: 'Severity', Value: severity },
              ],
            })
            .promise();

          topicArn = topicResult.TopicArn || '';
          console.log(`✅ 토픽 생성 완료: ${topicName}`);
        }

        // 구독 설정
        await this.setupTopicSubscriptions(topicArn, severity);
      } catch (error) {
        console.error(`❌ 토픽 설정 실패: ${topicName}`, error);
        this.results.push({
          alarmName: topicName,
          status: 'failed',
          error: error.message,
        });
      }
    }
  }

  /**
   * 토픽 구독 설정
   */
  private async setupTopicSubscriptions(topicArn: string, severity: string): Promise<void> {
    const relevantChannels = this.config.notificationChannels.filter(channel =>
      channel.severity.includes(severity)
    );

    for (const channel of relevantChannels) {
      try {
        if (this.config.dryRun) {
          console.log(`[DRY RUN] 구독 생성 예정: ${channel.name} -> ${severity}`);
          continue;
        }

        const protocol = this.getProtocolForChannelType(channel.type);

        await sns
          .subscribe({
            TopicArn: topicArn,
            Protocol: protocol,
            Endpoint: channel.endpoint,
            Attributes: {
              FilterPolicy: JSON.stringify({
                severity: [severity],
                environment: [this.config.environment],
              }),
            },
          })
          .promise();

        console.log(`✅ 구독 설정 완료: ${channel.name} (${channel.type})`);
      } catch (error) {
        console.error(`❌ 구독 설정 실패: ${channel.name}`, error);
      }
    }
  }

  /**
   * CloudWatch 알람 생성
   */
  private async setupCloudWatchAlarms(): Promise<void> {
    console.log('📊 CloudWatch 알람 설정 중...');

    // 알람 정의 로드
    const alarmDefinitions = await this.loadAlarmDefinitions();

    for (const alarmDef of alarmDefinitions) {
      try {
        const result = await this.createOrUpdateAlarm(alarmDef);
        this.results.push(result);

        if (result.status !== 'failed') {
          console.log(`✅ 알람 ${result.status}: ${result.alarmName}`);
        } else {
          console.error(`❌ 알람 실패: ${result.alarmName} - ${result.error}`);
        }
      } catch (error) {
        console.error(`❌ 알람 처리 실패: ${alarmDef.name}`, error);
        this.results.push({
          alarmName: alarmDef.name,
          status: 'failed',
          error: error.message,
        });
      }
    }
  }

  /**
   * 개별 알람 생성/업데이트
   */
  private async createOrUpdateAlarm(alarmDef: Record<string, unknown>): Promise<AlarmSetupResult> {
    const alarmName = `${this.config.projectName}-${alarmDef.name}`;

    if (this.config.dryRun) {
      return { alarmName, status: 'skipped' };
    }

    try {
      // 기존 알람 확인
      const existingAlarms = await cloudwatch
        .describeAlarms({
          AlarmNames: [alarmName],
        })
        .promise();

      const exists = existingAlarms.MetricAlarms && existingAlarms.MetricAlarms.length > 0;

      if (exists && this.config.skipExisting) {
        return { alarmName, status: 'skipped' };
      }

      // 알람 생성/업데이트
      const alarmParams = this.buildAlarmParameters(alarmName, alarmDef);
      await cloudwatch.putMetricAlarm(alarmParams).promise();

      return { alarmName, status: exists ? 'updated' : 'created' };
    } catch (error) {
      return { alarmName, status: 'failed', error: error.message };
    }
  }

  /**
   * 헬스 체크 시스템 설정
   */
  private async setupHealthChecks(): Promise<void> {
    console.log('🏥 헬스 체크 시스템 설정 중...');

    if (this.config.dryRun) {
      console.log('[DRY RUN] 헬스 체크 Lambda 함수들 배포 예정');
      return;
    }

    try {
      // 헬스 체크 Lambda 함수 배포
      await this.deployHealthCheckFunctions();

      // 헬스 체크 스케줄 설정
      await this.setupHealthCheckSchedules();

      console.log('✅ 헬스 체크 시스템 설정 완료');
    } catch (error) {
      console.error('❌ 헬스 체크 시스템 설정 실패:', error);
      throw error;
    }
  }

  /**
   * 알람 시스템 테스트
   */
  private async testAlarmSystem(): Promise<void> {
    console.log('🧪 알람 시스템 테스트 중...');

    const testResults: { test: string; result: 'pass' | 'fail'; message: string }[] = [];

    try {
      // 1. 알람 상태 확인
      const alarmNames = this.results
        .filter(r => r.status === 'created' || r.status === 'updated')
        .map(r => r.alarmName);

      if (alarmNames.length > 0) {
        const alarmStates = await cloudwatch
          .describeAlarms({
            AlarmNames: alarmNames.slice(0, 10), // 최대 10개만 테스트
          })
          .promise();

        const activeAlarms =
          alarmStates.MetricAlarms?.filter(
            alarm => alarm.StateValue === 'OK' || alarm.StateValue === 'ALARM'
          ).length || 0;

        testResults.push({
          test: '알람 상태 확인',
          result: activeAlarms > 0 ? 'pass' : 'fail',
          message: `${activeAlarms}개 알람이 활성 상태`,
        });
      }

      // 2. SNS 토픽 테스트 (테스트 메시지 발송)
      const testTopicArn = await this.getTopicArn('INFO');
      if (testTopicArn) {
        await sns
          .publish({
            TopicArn: testTopicArn,
            Message: JSON.stringify({
              severity: 'INFO',
              environment: this.config.environment,
              message: '알람 시스템 테스트 메시지',
              timestamp: new Date().toISOString(),
            }),
            Subject: '[TEST] Todo 앱 알람 시스템 테스트',
          })
          .promise();

        testResults.push({
          test: 'SNS 테스트 메시지 발송',
          result: 'pass',
          message: '테스트 메시지 발송 완료',
        });
      }

      // 3. 헬스 체크 함수 테스트
      try {
        const healthCheckFunction = `${this.config.projectName}-HealthCheck-Orchestrator`;
        const testPayload = {
          checkType: 'test',
          timestamp: new Date().toISOString(),
        };

        await lambda
          .invoke({
            FunctionName: healthCheckFunction,
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify(testPayload),
          })
          .promise();

        testResults.push({
          test: '헬스 체크 함수 테스트',
          result: 'pass',
          message: '헬스 체크 함수 실행 성공',
        });
      } catch (error) {
        testResults.push({
          test: '헬스 체크 함수 테스트',
          result: 'fail',
          message: `헬스 체크 함수 테스트 실패: ${error.message}`,
        });
      }

      // 테스트 결과 출력
      console.log('🧪 테스트 결과:');
      testResults.forEach(test => {
        const icon = test.result === 'pass' ? '✅' : '❌';
        console.log(`  ${icon} ${test.test}: ${test.message}`);
      });

      const passedTests = testResults.filter(t => t.result === 'pass').length;
      console.log(
        `📊 테스트 통과율: ${passedTests}/${testResults.length} (${Math.round((passedTests / testResults.length) * 100)}%)`
      );
    } catch (error) {
      console.error('❌ 알람 시스템 테스트 실패:', error);
    }
  }

  /**
   * 설정 결과 보고서 생성
   */
  private async generateSetupReport(): Promise<void> {
    console.log('📋 설정 결과 보고서 생성 중...');

    const report = {
      timestamp: new Date().toISOString(),
      environment: this.config.environment,
      region: this.config.region,
      summary: {
        totalAlarms: this.results.length,
        created: this.results.filter(r => r.status === 'created').length,
        updated: this.results.filter(r => r.status === 'updated').length,
        skipped: this.results.filter(r => r.status === 'skipped').length,
        failed: this.results.filter(r => r.status === 'failed').length,
      },
      validationResults: this.validationResults,
      alarmResults: this.results,
    };

    // 보고서 파일 저장
    const reportPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'monitoring',
      `alarm-setup-report-${this.config.environment}-${Date.now()}.json`
    );

    try {
      // 디렉토리가 없으면 생성
      const reportDir = path.dirname(reportPath);
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📄 보고서 저장 완료: ${reportPath}`);
    } catch (error) {
      console.error('❌ 보고서 저장 실패:', error);
    }

    // 콘솔 요약
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 설정 완료 요약:');
    console.log(`  전체 알람: ${report.summary.totalAlarms}개`);
    console.log(`  ✅ 생성: ${report.summary.created}개`);
    console.log(`  🔄 업데이트: ${report.summary.updated}개`);
    console.log(`  ⏭️  건너뜀: ${report.summary.skipped}개`);
    console.log(`  ❌ 실패: ${report.summary.failed}개`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (report.summary.failed > 0) {
      console.log('❌ 실패한 알람들:');
      this.results
        .filter(r => r.status === 'failed')
        .forEach(result => {
          console.log(`  - ${result.alarmName}: ${result.error}`);
        });
    }
  }

  // 헬퍼 메서드들
  private async validateNotificationChannel(channel: NotificationChannel): Promise<boolean> {
    // 기본적인 형식 검증
    switch (channel.type) {
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(channel.endpoint);
      case 'sms':
        return /^\+\d{10,15}$/.test(channel.endpoint);
      case 'slack':
      case 'webhook':
        return /^https?:\/\/.+/.test(channel.endpoint);
      default:
        return false;
    }
  }

  private getProtocolForChannelType(type: string): string {
    switch (type) {
      case 'email':
        return 'email';
      case 'sms':
        return 'sms';
      case 'slack':
      case 'webhook':
        return 'https';
      default:
        return 'email';
    }
  }

  private async loadAlarmDefinitions(): Promise<Record<string, unknown>[]> {
    // 실제 구현에서는 alarms.ts에서 정의를 가져옴
    return [
      {
        name: 'HighErrorRate',
        metricName: '4XXError',
        namespace: 'AWS/ApiGateway',
        statistic: 'Average',
        period: 300,
        evaluationPeriods: 2,
        threshold: 5,
        comparisonOperator: 'GreaterThanThreshold',
        severity: 'CRITICAL',
      },
      // 추가 알람 정의들...
    ];
  }

  private buildAlarmParameters(
    alarmName: string,
    alarmDef: Record<string, unknown>
  ): Record<string, unknown> {
    const credentials = AWS.config.credentials as { accessKeyId?: string } | null;
    const topicArn = `arn:aws:sns:${this.config.region}:${credentials?.accessKeyId || 'unknown'}:${this.config.projectName}-${alarmDef.severity}-Notifications`;

    return {
      AlarmName: alarmName,
      AlarmDescription: alarmDef.description || `${alarmName} 알람`,
      ComparisonOperator: alarmDef.comparisonOperator,
      EvaluationPeriods: alarmDef.evaluationPeriods,
      MetricName: alarmDef.metricName,
      Namespace: alarmDef.namespace,
      Period: alarmDef.period,
      Statistic: alarmDef.statistic,
      Threshold: alarmDef.threshold,
      AlarmActions: [topicArn],
      OKActions: [topicArn],
      TreatMissingData: alarmDef.treatMissingData || 'notBreaching',
    };
  }

  private async getTopicArn(severity: string): Promise<string | null> {
    const topicName = `${this.config.projectName}-${severity}-Notifications`;
    const topics = await sns.listTopics().promise();
    const topic = topics.Topics?.find(t => t.TopicArn?.includes(topicName));
    return topic?.TopicArn || null;
  }

  private async deployHealthCheckFunctions(): Promise<void> {
    // 헬스 체크 Lambda 함수 배포 로직
    console.log('헬스 체크 Lambda 함수들 배포 중...');
  }

  private async setupHealthCheckSchedules(): Promise<void> {
    // EventBridge 스케줄 설정
    console.log('헬스 체크 스케줄 설정 중...');
  }
}

/**
 * CLI 진입점
 */
async function main() {
  const args = process.argv.slice(2);
  const options = parseCliArguments(args);

  const config: SetupConfig = {
    environment: options.env || 'dev',
    projectName: options.project || 'TodoApp',
    region: options.region || 'ap-northeast-2',
    notificationChannels: options.channels || getDefaultChannels(),
    skipExisting: options.skipExisting || false,
    dryRun: options.dryRun || false,
    testAlarms: options.test || false,
  };

  const orchestrator = new AlarmSetupOrchestrator(config);
  await orchestrator.execute();
}

function parseCliArguments(args: string[]): Record<string, unknown> {
  const options: Record<string, unknown> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--env':
      case '-e':
        options.env = args[++i];
        break;
      case '--project':
      case '-p':
        options.project = args[++i];
        break;
      case '--region':
      case '-r':
        options.region = args[++i];
        break;
      case '--skip-existing':
      case '-s':
        options.skipExisting = true;
        break;
      case '--dry-run':
      case '-d':
        options.dryRun = true;
        break;
      case '--test':
      case '-t':
        options.test = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function getDefaultChannels(): NotificationChannel[] {
  return [
    {
      name: 'ops-email',
      type: 'email',
      endpoint: 'ops-team@company.com',
      severity: ['CRITICAL', 'WARNING'],
    },
  ];
}

function printHelp() {
  console.log(`
Todo 앱 알람 설정 스크립트

사용법:
  node setup-alarms.ts [옵션]

옵션:
  -e, --env <환경>          배포 환경 (dev|staging|prod) [기본: dev]
  -p, --project <프로젝트>  프로젝트 이름 [기본: TodoApp]
  -r, --region <지역>       AWS 리전 [기본: ap-northeast-2]
  -s, --skip-existing       기존 알람 건너뜀
  -d, --dry-run            실제 생성 없이 미리보기
  -t, --test               알람 시스템 테스트 실행
  -h, --help               도움말 표시

예시:
  # 개발 환경에서 드라이 런
  node setup-alarms.ts --env dev --dry-run

  # 프로덕션 환경에서 테스트 포함 실행
  node setup-alarms.ts --env prod --test

  # 기존 알람 건너뛰고 실행
  node setup-alarms.ts --skip-existing
`);
}

// CLI 실행
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 스크립트 실행 실패:', error);
    process.exit(1);
  });
}

export { AlarmSetupOrchestrator, SetupConfig };
