import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { BaseStack } from './base-stack';
import { EnvironmentConfig } from '../../config/environment';

/**
 * 최적화된 데이터베이스 스택
 * 환경별로 다른 설정을 적용하여 비용과 성능을 최적화
 */
export class OptimizedDatabaseStack extends BaseStack {
  public readonly todoTable: dynamodb.Table;
  public readonly encryptionKey?: kms.Key;

  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps & { environmentConfig: EnvironmentConfig }
  ) {
    super(scope, id, props);

    // 프로덕션 환경에서만 KMS 키 생성
    if (this.isProd) {
      this.encryptionKey = new kms.Key(this, 'TableEncryptionKey', {
        alias: this.resourceName('hanbit-todo-table-key'),
        description: 'KMS key for DynamoDB table encryption in production',
        enableKeyRotation: true,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      });
    }

    // DynamoDB 테이블 생성
    this.todoTable = this.createDynamoDBTable();

    // 환경별 추가 설정
    this.applyEnvironmentSpecificSettings();

    // 모니터링 설정
    this.setupMonitoring();

    // 비용 최적화 설정
    this.applyCostOptimizations();

    // 출력값 생성
    this.createOutputs();
  }

  /**
   * DynamoDB 테이블 생성
   */
  private createDynamoDBTable(): dynamodb.Table {
    const table = new dynamodb.Table(this, 'TodoTable', {
      tableName: this.resourceName('hanbit-todo-table'),
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },

      // 환경별 빌링 모드 설정
      billingMode: this.selectByEnvironment(
        dynamodb.BillingMode.PROVISIONED, // 프로덕션: 예측 가능한 비용
        dynamodb.BillingMode.PAY_PER_REQUEST, // 테스트: 유연한 처리량
        dynamodb.BillingMode.PAY_PER_REQUEST // 개발: 최소 비용
      ),

      // 환경별 암호화 설정
      encryption:
        this.isProd && this.encryptionKey
          ? dynamodb.TableEncryption.customerManagedKey(this.encryptionKey)
          : dynamodb.TableEncryption.AWS_MANAGED,

      // 환경별 백업 설정
      pointInTimeRecovery: this.selectByEnvironment(true, true, false),

      // 삭제 정책
      removalPolicy: this.getRemovalPolicy(),

      // TTL 설정 (모든 환경)
      timeToLiveAttribute: 'ttl',

      // 스트림 설정 (프로덕션/테스트만)
      stream: this.isProd || this.isTest ? dynamodb.StreamViewType.NEW_AND_OLD_IMAGES : undefined,
    });

    // 프로비전드 모드인 경우 용량 설정
    if (this.isProd) {
      const cfnTable = table.node.defaultChild as dynamodb.CfnTable;
      cfnTable.provisionedThroughput = {
        readCapacityUnits: this.config.database.readCapacity,
        writeCapacityUnits: this.config.database.writeCapacity,
      };
    }

    // GSI 추가
    this.addGlobalSecondaryIndexes(table);

    return table;
  }

  /**
   * Global Secondary Indexes 추가
   */
  private addGlobalSecondaryIndexes(table: dynamodb.Table): void {
    // GSI1: 상태 및 우선순위별 쿼리
    table.addGlobalSecondaryIndex({
      indexName: 'GSI1-StatusPriority',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
      // 환경별 프로젝션 타입
      projectionType: this.selectByEnvironment(
        dynamodb.ProjectionType.ALL, // 프로덕션: 전체 속성
        dynamodb.ProjectionType.INCLUDE, // 테스트: 선택적 속성
        dynamodb.ProjectionType.KEYS_ONLY // 개발: 키만 (비용 절감)
      ),
      // 테스트 환경에서 포함할 속성
      nonKeyAttributes: this.isTest ? ['title', 'completed', 'priority'] : undefined,
    });

    // GSI2: 제목 검색 (프로덕션/테스트만)
    if (this.isProd || this.isTest) {
      table.addGlobalSecondaryIndex({
        indexName: 'GSI2-SearchTitle',
        partitionKey: {
          name: 'GSI2PK',
          type: dynamodb.AttributeType.STRING,
        },
        sortKey: {
          name: 'GSI2SK',
          type: dynamodb.AttributeType.STRING,
        },
        projectionType: this.isProd ? dynamodb.ProjectionType.ALL : dynamodb.ProjectionType.INCLUDE,
        nonKeyAttributes: this.isTest ? ['title', 'completed'] : undefined,
      });
    }
  }

  /**
   * 환경별 특수 설정 적용
   */
  private applyEnvironmentSpecificSettings(): void {
    if (this.isProd) {
      // 프로덕션: 자동 스케일링 설정
      const readScaling = this.todoTable.autoScaleReadCapacity({
        minCapacity: 5,
        maxCapacity: 100,
      });

      readScaling.scaleOnUtilization({
        targetUtilizationPercent: 70,
      });

      const writeScaling = this.todoTable.autoScaleWriteCapacity({
        minCapacity: 5,
        maxCapacity: 100,
      });

      writeScaling.scaleOnUtilization({
        targetUtilizationPercent: 70,
      });

      // 기여자 인사이트 활성화
      const cfnTable = this.todoTable.node.defaultChild as dynamodb.CfnTable;
      cfnTable.contributorInsightsSpecification = {
        enabled: true,
      };
    } else if (this.isTest) {
      // 테스트: 중간 수준의 모니터링
      const cfnTable = this.todoTable.node.defaultChild as dynamodb.CfnTable;
      cfnTable.contributorInsightsSpecification = {
        enabled: true,
      };
    }
    // 개발 환경은 최소 설정 유지
  }

  /**
   * 모니터링 설정
   */
  private setupMonitoring(): void {
    // 환경별 알람 임계값
    const alarmThresholds = {
      throttled: this.selectByEnvironment(5, 10, 20),
      userErrors: this.selectByEnvironment(10, 20, 50),
      systemErrors: this.selectByEnvironment(1, 5, 10),
    };

    // 스로틀링 알람
    new cloudwatch.Alarm(this, 'ThrottledRequestsAlarm', {
      metric: this.todoTable.metricThrottledRequestsForOperations({
        operations: [dynamodb.Operation.GET_ITEM, dynamodb.Operation.PUT_ITEM],
        period: cdk.Duration.minutes(5),
      }),
      threshold: alarmThresholds.throttled,
      evaluationPeriods: 2,
      alarmDescription: `DynamoDB throttled requests alarm for ${this.config.name}`,
    });

    // 사용자 오류 알람
    new cloudwatch.Alarm(this, 'UserErrorsAlarm', {
      metric: this.todoTable.metricUserErrors({
        period: cdk.Duration.minutes(5),
      }),
      threshold: alarmThresholds.userErrors,
      evaluationPeriods: 2,
      alarmDescription: `DynamoDB user errors alarm for ${this.config.name}`,
    });

    // 시스템 오류 알람 (프로덕션/테스트만)
    if (this.isProd || this.isTest) {
      new cloudwatch.Alarm(this, 'SystemErrorsAlarm', {
        metric: this.todoTable.metricSystemErrorsForOperations({
          operations: [dynamodb.Operation.GET_ITEM, dynamodb.Operation.PUT_ITEM],
          period: cdk.Duration.minutes(5),
        }),
        threshold: alarmThresholds.systemErrors,
        evaluationPeriods: 1,
        alarmDescription: `DynamoDB system errors alarm for ${this.config.name}`,
      });
    }
  }

  /**
   * 비용 최적화 설정
   */
  private applyCostOptimizations(): void {
    // 개발 환경: 적극적인 비용 절감
    if (this.isDev) {
      // 태그로 비용 절감 모드 표시
      cdk.Tags.of(this.todoTable).add('CostOptimization', 'aggressive');
      cdk.Tags.of(this.todoTable).add('AutoShutdown', 'enabled');
    }

    // 테스트 환경: 균형잡힌 비용 관리
    if (this.isTest) {
      cdk.Tags.of(this.todoTable).add('CostOptimization', 'balanced');
      cdk.Tags.of(this.todoTable).add('AutoShutdown', 'weekend');
    }

    // 프로덕션: 성능 우선, 예약 용량 고려
    if (this.isProd) {
      cdk.Tags.of(this.todoTable).add('CostOptimization', 'performance-first');
      cdk.Tags.of(this.todoTable).add('ReservedCapacity', 'eligible');
    }
  }

  /**
   * 출력값 생성
   */
  private createOutputs(): void {
    this.createOutput('TodoTableName', this.todoTable.tableName, 'DynamoDB table name');
    this.createOutput('TodoTableArn', this.todoTable.tableArn, 'DynamoDB table ARN');

    if (this.todoTable.tableStreamArn) {
      this.createOutput('TodoTableStreamArn', this.todoTable.tableStreamArn, 'DynamoDB stream ARN');
    }

    if (this.encryptionKey) {
      this.createOutput('EncryptionKeyArn', this.encryptionKey.keyArn, 'KMS encryption key ARN');
    }

    // 비용 추적을 위한 메타데이터
    this.createOutput(
      'BillingMode',
      this.isProd ? 'PROVISIONED' : 'PAY_PER_REQUEST',
      'DynamoDB billing mode'
    );
  }
}
