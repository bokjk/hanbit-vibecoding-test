#!/usr/bin/env node

import { DashboardGenerator } from '../../../infrastructure/monitoring/dashboard-config.js';
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  PutMetricFilterCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { CloudWatchClient, PutMetricAlarmCommand } from '@aws-sdk/client-cloudwatch';

/**
 * CloudWatch Dashboard 자동 설정 스크립트
 *
 * 사용법:
 * npm run setup:dashboard
 * npm run setup:dashboard -- --env dev
 * npm run setup:dashboard -- --env prod --update
 */

interface SetupOptions {
  environment: 'dev' | 'prod';
  update: boolean;
  createAlarms: boolean;
  createMetricFilters: boolean;
  verbose: boolean;
}

/**
 * 메트릭 필터 생성
 */
async function createMetricFilters(
  logsClient: CloudWatchLogsClient,
  config: SetupOptions
): Promise<void> {
  const generator = new DashboardGenerator(config.environment);
  const filters = generator.getMetricFilters();

  console.log(`📊 메트릭 필터 생성 중... (${config.environment})`);

  for (const filter of Object.values(filters)) {
    try {
      const command = new PutMetricFilterCommand({
        logGroupName: `/aws/lambda/TodoApp-${config.environment === 'prod' ? '' : 'Dev-'}`,
        filterName: filter.filterName,
        filterPattern: filter.filterPattern,
        metricTransformations: filter.metricTransformations,
      });

      await logsClient.send(command);
      console.log(`  ✅ ${filter.filterName} 생성 완료`);
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string };
      if (err.name === 'ResourceAlreadyExistsException') {
        console.log(`  ⚠️ ${filter.filterName} 이미 존재 - 건너뜀`);
      } else {
        console.error(`  ❌ ${filter.filterName} 생성 실패:`, err.message);
      }
    }
  }
}

/**
 * CloudWatch 알람 생성
 */
async function createAlarms(
  cloudWatchClient: CloudWatchClient,
  config: SetupOptions
): Promise<void> {
  const generator = new DashboardGenerator(config.environment);
  const alarms = generator.getAlarmConfigurations();

  console.log(`🚨 CloudWatch 알람 생성 중... (${config.environment})`);

  for (const [name, alarm] of Object.entries(alarms)) {
    try {
      const command = new PutMetricAlarmCommand({
        AlarmName: alarm.alarmName,
        AlarmDescription: `TodoApp ${config.environment} - ${name}`,
        MetricName: getMetricNameForAlarm(name),
        Namespace: `TodoApp/${config.environment}`,
        Statistic: 'Average',
        Period: alarm.period,
        EvaluationPeriods: alarm.evaluationPeriods,
        Threshold: alarm.threshold,
        ComparisonOperator: alarm.comparisonOperator as
          | 'GreaterThanThreshold'
          | 'GreaterThanOrEqualToThreshold'
          | 'LessThanThreshold'
          | 'LessThanOrEqualToThreshold'
          | 'LessThanLowerOrGreaterThanUpperThreshold'
          | 'LessThanLowerThreshold'
          | 'GreaterThanUpperThreshold',
        AlarmActions: [
          // SNS 토픽이나 이메일 알림을 여기에 추가 가능
        ],
        TreatMissingData: 'notBreaching',
        Unit: getUnitForAlarm(name),
      });

      await cloudWatchClient.send(command);
      console.log(`  ✅ ${alarm.alarmName} 생성 완료`);
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string };
      if (err.name === 'ValidationError' && err.message?.includes('already exists')) {
        console.log(`  ⚠️ ${alarm.alarmName} 이미 존재 - 건너뜀`);
      } else {
        console.error(`  ❌ ${alarm.alarmName} 생성 실패:`, err.message);
      }
    }
  }
}

/**
 * 알람별 메트릭 이름 매핑
 */
function getMetricNameForAlarm(alarmType: string): string {
  const mapping: Record<string, string> = {
    highErrorRate: 'ErrorCount',
    highResponseTime: 'Duration',
    throttling: 'Throttles',
  };
  return mapping[alarmType] || 'Unknown';
}

/**
 * 알람별 단위 매핑
 */
function getUnitForAlarm(alarmType: string): string {
  const mapping: Record<string, string> = {
    highErrorRate: 'Count',
    highResponseTime: 'Milliseconds',
    throttling: 'Count',
  };
  return mapping[alarmType] || 'None';
}

/**
 * 로그 그룹 생성 확인
 */
async function ensureLogGroups(
  logsClient: CloudWatchLogsClient,
  config: SetupOptions
): Promise<void> {
  const functions = ['CreateTodo', 'ListTodos', 'UpdateTodo', 'DeleteTodo', 'Login'];
  const prefix = config.environment === 'prod' ? 'TodoApp' : 'TodoApp-Dev';

  console.log(`📝 로그 그룹 확인 중... (${config.environment})`);

  for (const func of functions) {
    const logGroupName = `/aws/lambda/${prefix}-${func}`;

    try {
      const command = new CreateLogGroupCommand({
        logGroupName,
        retentionInDays: config.environment === 'prod' ? 14 : 7,
      });

      await logsClient.send(command);
      console.log(`  ✅ ${logGroupName} 생성 완료`);
    } catch (error: unknown) {
      const err = error as { name?: string; message?: string };
      if (err.name === 'ResourceAlreadyExistsException') {
        if (config.verbose) {
          console.log(`  ✓ ${logGroupName} 이미 존재`);
        }
      } else {
        console.error(`  ❌ ${logGroupName} 생성 실패:`, err.message);
      }
    }
  }
}

/**
 * 대시보드 설정 검증
 */
async function validateDashboardSetup(config: SetupOptions): Promise<boolean> {
  console.log(`🔍 대시보드 설정 검증 중... (${config.environment})`);

  // AWS 자격 증명 확인
  if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE) {
    console.error('❌ AWS 자격 증명이 설정되지 않았습니다.');
    console.log('AWS_ACCESS_KEY_ID 환경 변수를 설정하거나 AWS CLI 프로필을 구성하세요.');
    return false;
  }

  // 필요한 환경 변수 확인
  const requiredEnvVars = ['AWS_REGION'];
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.warn(`⚠️ ${envVar} 환경 변수가 설정되지 않았습니다. 기본값을 사용합니다.`);
    }
  }

  console.log('✅ 설정 검증 완료');
  return true;
}

/**
 * 설정 요약 출력
 */
function printConfigSummary(config: SetupOptions): void {
  console.log('\\n📋 설정 요약:');
  console.log(`   환경: ${config.environment.toUpperCase()}`);
  console.log(`   업데이트 모드: ${config.update ? '예' : '아니오'}`);
  console.log(`   알람 생성: ${config.createAlarms ? '예' : '아니오'}`);
  console.log(`   메트릭 필터 생성: ${config.createMetricFilters ? '예' : '아니오'}`);
  console.log(`   상세 출력: ${config.verbose ? '예' : '아니오'}`);
  console.log('');
}

/**
 * 메인 실행 함수
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // 명령행 인수 파싱
  const config: SetupOptions = {
    environment: args.includes('--env')
      ? (args[args.indexOf('--env') + 1] as 'dev' | 'prod')
      : 'prod',
    update: args.includes('--update'),
    createAlarms: !args.includes('--no-alarms'),
    createMetricFilters: !args.includes('--no-filters'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };

  // 도움말 표시
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
CloudWatch Dashboard 설정 도구

사용법:
  npm run setup:dashboard [옵션]

옵션:
  --env <dev|prod>     환경 설정 (기본: prod)
  --update             기존 대시보드 업데이트
  --no-alarms          알람 생성 건너뛰기
  --no-filters         메트릭 필터 생성 건너뛰기
  --verbose, -v        상세 출력
  --help, -h           도움말 표시

예시:
  npm run setup:dashboard
  npm run setup:dashboard -- --env dev
  npm run setup:dashboard -- --env prod --update --verbose
    `);
    return;
  }

  printConfigSummary(config);

  try {
    // 설정 검증
    const isValid = await validateDashboardSetup(config);
    if (!isValid) {
      process.exit(1);
    }

    // AWS 클라이언트 초기화
    const region = process.env.AWS_REGION || 'us-east-1';
    const cloudWatchClient = new CloudWatchClient({ region });
    const logsClient = new CloudWatchLogsClient({ region });

    console.log(`🚀 TodoApp 대시보드 설정 시작... (${config.environment})`);
    console.log(`📍 리전: ${region}\\n`);

    // 1. 로그 그룹 확인/생성
    await ensureLogGroups(logsClient, config);

    // 2. 메트릭 필터 생성
    if (config.createMetricFilters) {
      await createMetricFilters(logsClient, config);
    }

    // 3. 알람 생성
    if (config.createAlarms) {
      await createAlarms(cloudWatchClient, config);
    }

    // 4. 대시보드 생성/업데이트
    console.log(`📊 대시보드 ${config.update ? '업데이트' : '생성'} 중...`);
    const generator = new DashboardGenerator(config.environment);

    if (config.update) {
      await generator.updateDashboard(`TodoApp-${config.environment.toUpperCase()}-Operations`);
    } else {
      await generator.createDashboard();
    }

    // 5. 추가 대시보드 생성 (상세 모니터링)
    await generator.createDashboard(`TodoApp-${config.environment.toUpperCase()}-Detailed`);

    console.log('\\n🎉 대시보드 설정이 완료되었습니다!');
    console.log('\\n📱 접근 링크:');
    console.log(
      `   운영 대시보드: https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#dashboards:name=TodoApp-${config.environment.toUpperCase()}-Operations`
    );
    console.log(
      `   상세 대시보드: https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#dashboards:name=TodoApp-${config.environment.toUpperCase()}-Detailed`
    );

    if (config.createAlarms) {
      console.log(
        `   알람 목록: https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#alarmsV2:`
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('\\n❌ 대시보드 설정 실패:', errorMessage);
    if (config.verbose) {
      console.error('상세 오류:', error);
    }
    process.exit(1);
  }
}

/**
 * 스크립트가 직접 실행될 때만 main 함수 호출
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as setupDashboard };
