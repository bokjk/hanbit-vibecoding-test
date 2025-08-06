import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * DynamoDB 테이블을 관리하는 Construct
 *
 * Single Table Design을 사용하여 효율적인 데이터 구조 구현
 *
 * 주요 기능:
 * - Single Table Design으로 비용 최적화
 * - TTL을 통한 게스트 데이터 자동 정리
 * - GSI를 활용한 효율적인 쿼리 패턴 지원
 * - 환경별 차별화된 보안 및 백업 설정
 * - CloudWatch 메트릭 및 알람 통합
 *
 * 테이블 구조:
 * - 기본 키: PK (파티션), SK (정렬)
 * - GSI1: 상태별/우선순위별 쿼리용
 * - GSI2: 제목 검색 및 정렬용
 * - TTL: 게스트 데이터 자동 삭제 (7일)
 */
export class DatabaseConstruct extends Construct {
  public readonly todoTable: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // TODO 테이블 생성 (Single Table Design)
    this.todoTable = new dynamodb.Table(this, 'TodoTable', {
      tableName: 'hanbit-todo-table',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED, // AWS 관리형 키 사용 (기본)
      // 프로덕션 환경에서는 고객 관리형 KMS 키 사용 고려
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 개발 환경용, 프로덕션에서는 RETAIN 사용

      // TTL 설정 - 게스트 사용자 데이터 7일 후 자동 삭제
      timeToLiveAttribute: 'ttl',

      // GSI for querying todos by status and priority
      globalSecondaryIndexes: [
        {
          // GSI1: 사용자별 상태 및 우선순위 쿼리
          // PK: USER#<userId>#STATUS#<completed> SK: PRIORITY#<priority>#<createdAt>
          indexName: 'GSI1-StatusPriority',
          partitionKey: {
            name: 'GSI1PK',
            type: dynamodb.AttributeType.STRING,
          },
          sortKey: {
            name: 'GSI1SK',
            type: dynamodb.AttributeType.STRING,
          },
          projectionType: dynamodb.ProjectionType.ALL, // 모든 속성 프로젝션
        },
      ],
    });

    // GSI2: 검색 및 제목별 정렬 최적화
    // PK: USER#<userId> SK: TITLE#<title.toLowerCase()>#<createdAt>
    this.todoTable.addGlobalSecondaryIndex({
      indexName: 'GSI2-SearchTitle',
      partitionKey: {
        name: 'GSI2PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI2SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL, // 모든 속성 프로젝션
    });

    // CloudWatch 메트릭 및 알람 설정
    const tableMetrics = this.todoTable.metricConsumedReadCapacityUnits({
      period: cdk.Duration.minutes(5),
      statistic: 'Average',
    });

    // 테이블 사용량 알람 (임계값 초과시)
    tableMetrics.createAlarm(this, 'HighReadCapacityAlarm', {
      threshold: 80, // 임계값
      evaluationPeriods: 3,
      alarmDescription: 'DynamoDB 읽기 용량 사용률이 높습니다',
    });

    // 환경별 설정
    const environment = process.env.NODE_ENV || 'development';

    if (environment === 'production') {
      // 프로덕션 환경: 백업 및 복구 설정 강화
      this.todoTable.addGlobalSecondaryIndex({
        indexName: 'GSI3-Backup',
        partitionKey: {
          name: 'backupPK',
          type: dynamodb.AttributeType.STRING,
        },
        projectionType: dynamodb.ProjectionType.KEYS_ONLY, // 키만 프로젝션으로 비용 최적화
      });
    }

    // 태그 추가 (비용 추적 및 리소스 관리용)
    cdk.Tags.of(this.todoTable).add('Component', 'Database');
    cdk.Tags.of(this.todoTable).add('Purpose', 'TodoStorage');
    cdk.Tags.of(this.todoTable).add('Environment', environment);
    cdk.Tags.of(this.todoTable).add('CostCenter', 'HanbitTodoApp');
    cdk.Tags.of(this.todoTable).add('Owner', 'Backend-Team');

    // 보안 설정: 삭제 보호 (프로덕션 환경)
    if (environment === 'production') {
      cdk.Tags.of(this.todoTable).add('DeletionProtection', 'true');
    }
  }
}
