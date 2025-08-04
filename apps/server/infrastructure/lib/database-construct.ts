import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * DynamoDB 테이블을 관리하는 Construct
 * Single Table Design을 사용하여 효율적인 데이터 구조 구현
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
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // 개발 환경용, 프로덕션에서는 RETAIN 사용
      
      // GSI for querying todos by status and priority
      globalSecondaryIndexes: [
        {
          indexName: 'GSI1',
          partitionKey: {
            name: 'GSI1PK',
            type: dynamodb.AttributeType.STRING,
          },
          sortKey: {
            name: 'GSI1SK',
            type: dynamodb.AttributeType.STRING,
          },
        },
      ],
    });

    // TTL 설정 (게스트 사용자 데이터 자동 삭제용)
    this.todoTable.addLocalSecondaryIndex({
      indexName: 'LSI1',
      sortKey: {
        name: 'ttl',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // 태그 추가
    cdk.Tags.of(this.todoTable).add('Component', 'Database');
    cdk.Tags.of(this.todoTable).add('Purpose', 'TodoStorage');
  }
}