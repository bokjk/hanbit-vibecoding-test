import { WriteRequest } from '@aws-sdk/client-dynamodb';
import { BatchGetCommand, BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getConnection, getCachedConfig } from '../utils/cold-start-optimizer';
import { logger } from '../utils/error-handler';
import { Todo, CreateTodoRequest } from '@hanbit/types';

/**
 * DynamoDB 배치 작업 최적화 서비스
 *
 * 주요 기능:
 * - 배치 읽기/쓰기 작업으로 네트워크 오버헤드 감소
 * - 재시도 로직과 에러 처리 개선
 * - 병렬 처리를 통한 성능 향상
 * - 연결 풀 재사용으로 콜드 스타트 최적화
 */
export class BatchOperationService {
  private readonly tableName: string;
  private readonly dynamoClient: import('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient;

  constructor() {
    const tableName = getCachedConfig('DYNAMODB_TABLE_NAME');
    if (!tableName) {
      throw new Error('DYNAMODB_TABLE_NAME environment variable is not set');
    }
    this.tableName = tableName;
    this.dynamoClient = getConnection('dynamodb');
  }

  /**
   * 여러 TODO 항목 배치 조회
   */
  async batchGetTodos(userIds: string[], todoIds?: string[]): Promise<Todo[]> {
    if (userIds.length === 0) return [];

    const startTime = Date.now();

    try {
      // 최대 100개씩 배치 처리 (DynamoDB 제한)
      const batchSize = 100;
      const results: Todo[] = [];

      for (let i = 0; i < userIds.length; i += batchSize) {
        const batchUserIds = userIds.slice(i, i + batchSize);
        const batchResults = await this.executeBatchGet(batchUserIds, todoIds);
        results.push(...batchResults);
      }

      const duration = Date.now() - startTime;
      logger.info('Batch get todos completed', {
        userCount: userIds.length,
        resultCount: results.length,
        duration,
        batchCount: Math.ceil(userIds.length / batchSize),
      });

      return results;
    } catch (error) {
      logger.error('Batch get todos failed', error as Error, {
        userIds: userIds.length,
        todoIds: todoIds?.length,
      });
      throw error;
    }
  }

  /**
   * 단일 배치에서 TODO 항목들 조회
   */
  private async executeBatchGet(userIds: string[], todoIds?: string[]): Promise<Todo[]> {
    const keys: Record<string, unknown>[] = [];

    // 사용자별 모든 TODO 조회 또는 특정 TODO 조회
    userIds.forEach(userId => {
      if (todoIds && todoIds.length > 0) {
        todoIds.forEach(todoId => {
          keys.push({
            PK: `USER#${userId}`,
            SK: `TODO#${todoId}`,
          });
        });
      } else {
        // 사용자의 모든 TODO를 가져오기 위해 Query 사용 (BatchGet은 정확한 키 필요)
        // 이 경우는 별도 처리가 필요하므로, 현재는 Query로 대체
        return this.queryUserTodos(userId);
      }
    });

    if (keys.length === 0) return [];

    const command = new BatchGetCommand({
      RequestItems: {
        [this.tableName]: {
          Keys: keys,
        },
      },
    });

    const response = await this.dynamoClient.send(command);
    const items = response.Responses?.[this.tableName] || [];

    return items.map(this.dynamoItemToTodo);
  }

  /**
   * 특정 사용자의 모든 TODO 조회 (Query 사용)
   */
  async queryUserTodos(
    userId: string,
    options?: {
      limit?: number;
      lastEvaluatedKey?: Record<string, unknown>;
      filterCompleted?: boolean;
    }
  ): Promise<{ todos: Todo[]; lastEvaluatedKey?: Record<string, unknown> }> {
    const startTime = Date.now();

    try {
      const queryParams: {
        TableName: string;
        KeyConditionExpression: string;
        ExpressionAttributeValues: Record<string, unknown>;
        ScanIndexForward: boolean;
        Limit?: number;
        ExclusiveStartKey?: Record<string, unknown>;
        FilterExpression?: string;
      } = {
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':sk': 'TODO#',
        },
        ScanIndexForward: false, // 최신 순 정렬 (createdAt 역순)
      };

      // 페이지네이션 지원
      if (options?.limit) {
        queryParams.Limit = options.limit;
      }

      if (options?.lastEvaluatedKey) {
        queryParams.ExclusiveStartKey = options.lastEvaluatedKey;
      }

      // 완료 상태 필터링
      if (options?.filterCompleted !== undefined) {
        queryParams.FilterExpression = 'completed = :completed';
        queryParams.ExpressionAttributeValues[':completed'] = options.filterCompleted;
      }

      const command = new QueryCommand(queryParams);
      const response = await this.dynamoClient.send(command);

      const todos = (response.Items || []).map(this.dynamoItemToTodo);

      const duration = Date.now() - startTime;
      logger.debug('Query user todos completed', {
        userId,
        resultCount: todos.length,
        duration,
        hasMore: !!response.LastEvaluatedKey,
      });

      return {
        todos,
        lastEvaluatedKey: response.LastEvaluatedKey,
      };
    } catch (error) {
      logger.error('Query user todos failed', error as Error, { userId });
      throw error;
    }
  }

  /**
   * 여러 TODO 항목 배치 생성/업데이트
   */
  async batchWriteTodos(
    operations: Array<{
      action: 'PUT' | 'DELETE';
      todo?: Todo | CreateTodoRequest;
      key?: { userId: string; todoId: string };
    }>
  ): Promise<{ successCount: number; failedItems: WriteRequest[] }> {
    if (operations.length === 0) return { successCount: 0, failedItems: [] };

    const startTime = Date.now();

    try {
      const batchSize = 25; // DynamoDB BatchWrite 최대 25개
      let successCount = 0;
      const failedItems: WriteRequest[] = [];

      for (let i = 0; i < operations.length; i += batchSize) {
        const batchOps = operations.slice(i, i + batchSize);
        const result = await this.executeBatchWrite(batchOps);
        successCount += result.successCount;
        failedItems.push(...result.failedItems);
      }

      const duration = Date.now() - startTime;
      logger.info('Batch write todos completed', {
        totalOperations: operations.length,
        successCount,
        failedCount: failedItems.length,
        duration,
        batchCount: Math.ceil(operations.length / batchSize),
      });

      return { successCount, failedItems };
    } catch (error) {
      logger.error('Batch write todos failed', error as Error, {
        operationCount: operations.length,
      });
      throw error;
    }
  }

  /**
   * 단일 배치에서 쓰기 작업 실행
   */
  private async executeBatchWrite(
    operations: Array<{
      action: 'PUT' | 'DELETE';
      todo?: Todo | CreateTodoRequest;
      key?: { userId: string; todoId: string };
    }>
  ): Promise<{ successCount: number; failedItems: WriteRequest[] }> {
    const writeRequests: WriteRequest[] = operations.map(op => {
      if (op.action === 'PUT' && op.todo) {
        return {
          PutRequest: {
            Item: this.todoToDynamoItem(op.todo as Todo),
          },
        };
      } else if (op.action === 'DELETE' && op.key) {
        return {
          DeleteRequest: {
            Key: {
              PK: `USER#${op.key.userId}`,
              SK: `TODO#${op.key.todoId}`,
            },
          },
        };
      }
      throw new Error('Invalid batch operation');
    });

    const command = new BatchWriteCommand({
      RequestItems: {
        [this.tableName]: writeRequests,
      },
    });

    const response = await this.dynamoClient.send(command);

    // 실패한 항목들에 대해 지수 백오프로 재시도
    let unprocessedItems = response.UnprocessedItems?.[this.tableName] || [];
    let retryCount = 0;
    const maxRetries = 3;

    while (unprocessedItems.length > 0 && retryCount < maxRetries) {
      await this.sleep(Math.pow(2, retryCount) * 100); // 지수 백오프

      const retryCommand = new BatchWriteCommand({
        RequestItems: {
          [this.tableName]: unprocessedItems,
        },
      });

      const retryResponse = await this.dynamoClient.send(retryCommand);
      unprocessedItems = retryResponse.UnprocessedItems?.[this.tableName] || [];
      retryCount++;
    }

    return {
      successCount: operations.length - unprocessedItems.length,
      failedItems: unprocessedItems,
    };
  }

  /**
   * GSI를 활용한 우선순위별 TODO 조회
   */
  async queryTodosByPriority(
    userId: string,
    priority: 'high' | 'medium' | 'low',
    completed?: boolean,
    options?: {
      limit?: number;
      lastEvaluatedKey?: Record<string, unknown>;
    }
  ): Promise<{ todos: Todo[]; lastEvaluatedKey?: Record<string, unknown> }> {
    const startTime = Date.now();

    try {
      // GSI1 사용: 사용자별 상태 및 우선순위 쿼리
      const gsi1PK = `USER#${userId}#STATUS#${completed ?? false}`;
      const gsi1SK = `PRIORITY#${priority}`;

      const queryParams: {
        TableName: string;
        IndexName: string;
        KeyConditionExpression: string;
        ExpressionAttributeValues: Record<string, unknown>;
        ScanIndexForward: boolean;
        Limit?: number;
        ExclusiveStartKey?: Record<string, unknown>;
      } = {
        TableName: this.tableName,
        IndexName: 'GSI1-StatusPriority',
        KeyConditionExpression: 'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :gsi1sk)',
        ExpressionAttributeValues: {
          ':gsi1pk': gsi1PK,
          ':gsi1sk': gsi1SK,
        },
        ScanIndexForward: false, // 최신 순 정렬
      };

      if (options?.limit) {
        queryParams.Limit = options.limit;
      }

      if (options?.lastEvaluatedKey) {
        queryParams.ExclusiveStartKey = options.lastEvaluatedKey;
      }

      const command = new QueryCommand(queryParams);
      const response = await this.dynamoClient.send(command);

      const todos = (response.Items || []).map(this.dynamoItemToTodo);

      const duration = Date.now() - startTime;
      logger.debug('Query todos by priority completed', {
        userId,
        priority,
        completed,
        resultCount: todos.length,
        duration,
      });

      return {
        todos,
        lastEvaluatedKey: response.LastEvaluatedKey,
      };
    } catch (error) {
      logger.error('Query todos by priority failed', error as Error, {
        userId,
        priority,
        completed,
      });
      throw error;
    }
  }

  /**
   * GSI를 활용한 제목 검색
   */
  async searchTodosByTitle(
    userId: string,
    titlePrefix: string,
    options?: {
      limit?: number;
      lastEvaluatedKey?: Record<string, unknown>;
    }
  ): Promise<{ todos: Todo[]; lastEvaluatedKey?: Record<string, unknown> }> {
    const startTime = Date.now();

    try {
      // GSI2 사용: 제목 검색 및 정렬
      const gsi2PK = `USER#${userId}`;
      const gsi2SK = `TITLE#${titlePrefix.toLowerCase()}`;

      const queryParams: {
        TableName: string;
        IndexName: string;
        KeyConditionExpression: string;
        ExpressionAttributeValues: Record<string, unknown>;
        ScanIndexForward: boolean;
        Limit?: number;
        ExclusiveStartKey?: Record<string, unknown>;
      } = {
        TableName: this.tableName,
        IndexName: 'GSI2-SearchTitle',
        KeyConditionExpression: 'GSI2PK = :gsi2pk AND begins_with(GSI2SK, :gsi2sk)',
        ExpressionAttributeValues: {
          ':gsi2pk': gsi2PK,
          ':gsi2sk': gsi2SK,
        },
        ScanIndexForward: true, // 제목 알파벳 순 정렬
      };

      if (options?.limit) {
        queryParams.Limit = options.limit;
      }

      if (options?.lastEvaluatedKey) {
        queryParams.ExclusiveStartKey = options.lastEvaluatedKey;
      }

      const command = new QueryCommand(queryParams);
      const response = await this.dynamoClient.send(command);

      const todos = (response.Items || []).map(this.dynamoItemToTodo);

      const duration = Date.now() - startTime;
      logger.info('Search todos by title completed', {
        userId,
        titlePrefix,
        resultCount: todos.length,
        duration,
      });

      return {
        todos,
        lastEvaluatedKey: response.LastEvaluatedKey,
      };
    } catch (error) {
      logger.error('Search todos by title failed', error as Error, {
        userId,
        titlePrefix,
      });
      throw error;
    }
  }

  /**
   * DynamoDB 아이템을 Todo 객체로 변환
   */
  private dynamoItemToTodo(item: Record<string, unknown>): Todo {
    return {
      id: (item.SK as string).replace('TODO#', ''),
      userId: (item.PK as string).replace('USER#', ''),
      title: item.title as string,
      completed: item.completed as boolean,
      priority: (item.priority as string) || 'medium',
      dueDate: item.dueDate as string,
      createdAt: item.createdAt as string,
      updatedAt: item.updatedAt as string,
      isGuest: (item.isGuest as boolean) || false,
    };
  }

  /**
   * Todo 객체를 DynamoDB 아이템으로 변환
   */
  private todoToDynamoItem(todo: Todo): Record<string, unknown> {
    const now = new Date().toISOString();

    return {
      PK: `USER#${todo.userId}`,
      SK: `TODO#${todo.id}`,
      GSI1PK: `USER#${todo.userId}#STATUS#${todo.completed}`,
      GSI1SK: `PRIORITY#${todo.priority || 'medium'}#${todo.createdAt}`,
      GSI2PK: `USER#${todo.userId}`,
      GSI2SK: `TITLE#${todo.title.toLowerCase()}#${todo.createdAt}`,
      title: todo.title,
      completed: todo.completed,
      priority: todo.priority || 'medium',
      dueDate: todo.dueDate,
      createdAt: todo.createdAt || now,
      updatedAt: now,
      isGuest: todo.isGuest || false,
      // TTL for guest users (7 days)
      ...(todo.isGuest && {
        ttl: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      }),
    };
  }

  /**
   * 지연 함수 (재시도를 위한 대기)
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 연결 상태 확인 및 성능 메트릭
   */
  async healthCheck(): Promise<{
    connected: boolean;
    responseTime: number;
    tableName: string;
  }> {
    const startTime = Date.now();

    try {
      // 간단한 쿼리로 연결 상태 확인
      await this.dynamoClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk',
          ExpressionAttributeValues: {
            ':pk': 'HEALTH_CHECK',
          },
          Limit: 1,
        })
      );

      return {
        connected: true,
        responseTime: Date.now() - startTime,
        tableName: this.tableName,
      };
    } catch (error) {
      logger.warn('DynamoDB health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime,
      });

      return {
        connected: false,
        responseTime: Date.now() - startTime,
        tableName: this.tableName,
      };
    }
  }
}
