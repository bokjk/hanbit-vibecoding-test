import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  ListTablesCommand,
  DescribeTableCommand,
  waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand as DocScanCommand,
  DeleteCommand as DocDeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoTodoItem } from '@/types/database.types';

/**
 * DynamoDB Local을 사용한 테스트 컨테이너
 * 통합 테스트에서 실제 DynamoDB 환경을 시뮬레이션합니다.
 */
export class TestContainer {
  private dynamoClient: DynamoDBClient;
  private documentClient: DynamoDBDocumentClient;

  constructor() {
    // DynamoDB Local 연결 (기본 포트 8000)
    this.dynamoClient = new DynamoDBClient({
      region: 'us-east-1',
      endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    });

    this.documentClient = DynamoDBDocumentClient.from(this.dynamoClient);
  }

  /**
   * 테스트 환경 초기 설정
   */
  async setup(): Promise<void> {
    try {
      // DynamoDB Local 연결 확인
      await this.verifyDynamoDBLocal();

      // 기존 테스트 테이블이 있으면 삭제
      await this.cleanupExistingTables();

      // 새 테이블 생성
      await this.createTodoTable();
      await this.createRateLimitTable();

      // 테이블 활성화 대기
      await this.waitForTablesActive();

      console.log('테스트 테이블 생성 완료');
    } catch (error) {
      console.error('테스트 환경 설정 실패:', error);
      throw error;
    }
  }

  /**
   * 테스트 환경 정리
   */
  async teardown(): Promise<void> {
    try {
      const tables = await this.listTables();

      for (const tableName of tables) {
        if (
          tableName.startsWith('test-') ||
          tableName.includes('todo') ||
          tableName.includes('rate-limit')
        ) {
          await this.deleteTable(tableName);
        }
      }

      console.log('테스트 테이블 정리 완료');
    } catch (error) {
      console.error('테스트 환경 정리 실패:', error);
    }
  }

  /**
   * 테스트 데이터 초기화
   */
  async clearTables(): Promise<void> {
    try {
      // Todo 테이블 데이터 삭제
      await this.clearTodoTable();

      // Rate Limit 테이블 데이터 삭제
      await this.clearRateLimitTable();

      console.log('테스트 데이터 초기화 완료');
    } catch (error) {
      console.error('테스트 데이터 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * DynamoDB 클라이언트 반환
   */
  getDynamoClient(): DynamoDBClient {
    return this.dynamoClient;
  }

  /**
   * Document 클라이언트 반환
   */
  getDocumentClient(): DynamoDBDocumentClient {
    return this.documentClient;
  }

  /**
   * Todo 테이블 생성 - Single Table Design 기반
   */
  private async createTodoTable(): Promise<void> {
    const command = new CreateTableCommand({
      TableName: 'test-todos',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: 'S' },
        { AttributeName: 'SK', AttributeType: 'S' },
        { AttributeName: 'GSI1PK', AttributeType: 'S' },
        { AttributeName: 'GSI1SK', AttributeType: 'S' },
        { AttributeName: 'GSI2PK', AttributeType: 'S' },
        { AttributeName: 'GSI2SK', AttributeType: 'S' },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'GSI1PK', KeyType: 'HASH' },
            { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          },
        },
        {
          IndexName: 'GSI2',
          KeySchema: [
            { AttributeName: 'GSI2PK', KeyType: 'HASH' },
            { AttributeName: 'GSI2SK', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          },
        },
      ],
      BillingMode: 'PROVISIONED',
      ProvisionedThroughput: {
        ReadCapacityUnits: 10,
        WriteCapacityUnits: 10,
      },
      TimeToLiveSpecification: {
        AttributeName: 'ttl',
        Enabled: true,
      },
    });

    try {
      await this.dynamoClient.send(command);
      console.log('Todo 테이블 생성됨: test-todos');
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'ResourceInUseException') {
        throw error;
      }
      console.log('Todo 테이블 이미 존재함: test-todos');
    }
  }

  /**
   * Rate Limit 테이블 생성
   */
  private async createRateLimitTable(): Promise<void> {
    const command = new CreateTableCommand({
      TableName: 'test-rate-limits',
      KeySchema: [
        { AttributeName: 'identifier', KeyType: 'HASH' },
        { AttributeName: 'window', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'identifier', AttributeType: 'S' },
        { AttributeName: 'window', AttributeType: 'N' },
      ],
      BillingMode: 'PROVISIONED',
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
      TimeToLiveSpecification: {
        AttributeName: 'ttl',
        Enabled: true,
      },
    });

    try {
      await this.dynamoClient.send(command);
      console.log('Rate Limit 테이블 생성됨: test-rate-limits');
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'ResourceInUseException') {
        throw error;
      }
      console.log('Rate Limit 테이블 이미 존재함: test-rate-limits');
    }
  }

  /**
   * 테이블 목록 조회
   */
  private async listTables(): Promise<string[]> {
    const command = new ListTablesCommand({});
    const response = await this.dynamoClient.send(command);
    return response.TableNames || [];
  }

  /**
   * 테이블 삭제
   */
  private async deleteTable(tableName: string): Promise<void> {
    try {
      const command = new DeleteTableCommand({ TableName: tableName });
      await this.dynamoClient.send(command);
      console.log(`테이블 삭제됨: ${tableName}`);
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'ResourceNotFoundException') {
        console.error(`테이블 삭제 실패: ${tableName}`, error);
      }
    }
  }

  /**
   * DynamoDB Local 연결 확인
   */
  private async verifyDynamoDBLocal(): Promise<void> {
    try {
      await this.dynamoClient.send(new ListTablesCommand({}));
      console.log('DynamoDB Local 연결 확인됨');
    } catch (error) {
      console.error('DynamoDB Local 연결 실패. DynamoDB Local이 실행 중인지 확인하세요.');
      throw new Error(
        'DynamoDB Local 연결 실패. ' +
          'Docker를 사용하여 DynamoDB Local을 실행하세요: ' +
          'docker run -p 8000:8000 amazon/dynamodb-local'
      );
    }
  }

  /**
   * 기존 테스트 테이블 정리
   */
  private async cleanupExistingTables(): Promise<void> {
    const tables = await this.listTables();
    const testTables = tables.filter(
      name => name.startsWith('test-') || name.includes('todo') || name.includes('rate-limit')
    );

    for (const tableName of testTables) {
      await this.deleteTable(tableName);
    }

    // 테이블 삭제 대기
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * 테이블 활성화 대기
   */
  private async waitForTablesActive(): Promise<void> {
    try {
      await waitUntilTableExists(
        { client: this.dynamoClient, maxWaitTime: 60 },
        { TableName: 'test-todos' }
      );

      await waitUntilTableExists(
        { client: this.dynamoClient, maxWaitTime: 60 },
        { TableName: 'test-rate-limits' }
      );

      console.log('모든 테이블이 활성화됨');
    } catch (error) {
      console.error('테이블 활성화 대기 중 오류:', error);
      throw error;
    }
  }

  /**
   * Todo 테이블 데이터 삭제
   */
  private async clearTodoTable(): Promise<void> {
    const scanCommand = new DocScanCommand({
      TableName: 'test-todos',
      ProjectionExpression: 'PK, SK',
    });

    const result = await this.documentClient.send(scanCommand);

    if (result.Items && result.Items.length > 0) {
      const deletePromises = result.Items.map(item => {
        return this.documentClient.send(
          new DocDeleteCommand({
            TableName: 'test-todos',
            Key: { PK: item.PK, SK: item.SK },
          })
        );
      });

      await Promise.all(deletePromises);
      console.log(`Todo 테이블에서 ${result.Items.length}개 항목 삭제됨`);
    }
  }

  /**
   * Rate Limit 테이블 데이터 삭제
   */
  private async clearRateLimitTable(): Promise<void> {
    const scanCommand = new DocScanCommand({
      TableName: 'test-rate-limits',
      ProjectionExpression: 'identifier, window',
    });

    const result = await this.documentClient.send(scanCommand);

    if (result.Items && result.Items.length > 0) {
      const deletePromises = result.Items.map(item => {
        return this.documentClient.send(
          new DocDeleteCommand({
            TableName: 'test-rate-limits',
            Key: { identifier: item.identifier, window: item.window },
          })
        );
      });

      await Promise.all(deletePromises);
      console.log(`Rate Limit 테이블에서 ${result.Items.length}개 항목 삭제됨`);
    }
  }

  /**
   * 테이블에 테스트 데이터 삽입
   */
  async insertTestData(todos: DynamoTodoItem[]): Promise<void> {
    const insertPromises = todos.map(todo =>
      this.documentClient.put({
        TableName: 'test-todos',
        Item: todo,
      })
    );

    await Promise.all(insertPromises);
    console.log(`${todos.length}개 테스트 데이터 삽입됨`);
  }

  /**
   * 테이블 상태 확인
   */
  async getTableStatus(tableName: string): Promise<string | undefined> {
    try {
      const command = new DescribeTableCommand({ TableName: tableName });
      const result = await this.dynamoClient.send(command);
      return result.Table?.TableStatus;
    } catch (error) {
      return 'NOT_FOUND';
    }
  }
}

/**
 * 테스트용 DynamoDB 환경 변수 설정
 */
export function setupTestEnvironment(): void {
  process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000';
  process.env.AWS_REGION = 'us-east-1';
  process.env.AWS_ACCESS_KEY_ID = 'test';
  process.env.AWS_SECRET_ACCESS_KEY = 'test';
  process.env.DYNAMODB_TABLE_NAME = 'test-todos';
  process.env.RATE_LIMIT_TABLE_NAME = 'test-rate-limits';
}
