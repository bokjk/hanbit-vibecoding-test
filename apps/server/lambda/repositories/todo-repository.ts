/**
 * DynamoDB TodoRepository 구현체
 * Single Table Design 패턴을 사용한 DynamoDB 데이터 액세스 계층
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { Priority } from '../types/constants';
import { DynamoTodoItem, DynamoQueryResult, ItemNotFoundError } from '../types/database.types';
import { TodoRepository } from '../services/todo.service';
import { logger } from '../utils/logger';

/**
 * DynamoDB TodoRepository 구현체
 */
export class DynamoDBTodoRepository implements TodoRepository {
  private readonly docClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(dynamoClient: DynamoDBClient) {
    this.docClient = DynamoDBDocumentClient.from(dynamoClient, {
      marshallOptions: {
        convertEmptyValues: false,
        removeUndefinedValues: true,
        convertClassInstanceToMap: false,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });

    this.tableName = process.env.DYNAMODB_TABLE_NAME || '';

    if (!this.tableName) {
      throw new Error('DYNAMODB_TABLE_NAME environment variable is required');
    }
  }

  /**
   * Todo 생성
   */
  async create(
    todoData: Omit<
      DynamoTodoItem,
      | 'PK'
      | 'SK'
      | 'GSI1PK'
      | 'GSI1SK'
      | 'GSI2PK'
      | 'GSI2SK'
      | 'EntityType'
      | 'createdAt'
      | 'updatedAt'
    >
  ): Promise<DynamoTodoItem> {
    const now = new Date().toISOString();

    const dynamoTodo: DynamoTodoItem = {
      // 기본 필드
      id: todoData.id,
      userId: todoData.userId,
      title: todoData.title,
      completed: todoData.completed || false,
      priority: todoData.priority || Priority.MEDIUM,
      dueDate: todoData.dueDate,
      isGuest: todoData.isGuest || false,
      sessionId: todoData.sessionId,
      ttl: todoData.ttl,

      // DynamoDB 키 구조
      PK: `USER#${todoData.userId}`,
      SK: `TODO#${todoData.id}`,
      EntityType: 'TODO',

      // GSI1: 상태별 검색 (완료/미완료) + 우선순위 정렬
      GSI1PK: `USER#${todoData.userId}#STATUS#${todoData.completed || false}`,
      GSI1SK: `PRIORITY#${todoData.priority || Priority.MEDIUM}#${now}`,

      // GSI2: 제목 검색용
      GSI2PK: `USER#${todoData.userId}`,
      GSI2SK: `TITLE#${todoData.title.toLowerCase()}#${now}`,

      // 타임스탬프
      createdAt: now,
      updatedAt: now,
    };

    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: dynamoTodo,
          ConditionExpression: 'attribute_not_exists(PK)', // 중복 방지
        })
      );

      logger.info('Todo created in DynamoDB', {
        userId: todoData.userId,
        todoId: todoData.id,
        title: todoData.title,
      });

      return dynamoTodo;
    } catch (error) {
      logger.error('Failed to create todo in DynamoDB', error as Error, {
        userId: todoData.userId,
        todoId: todoData.id,
      });
      throw error;
    }
  }

  /**
   * ID로 Todo 조회
   */
  async findById(userId: string, todoId: string): Promise<DynamoTodoItem | null> {
    try {
      const response = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            PK: `USER#${userId}`,
            SK: `TODO#${todoId}`,
          },
        })
      );

      return (response.Item as DynamoTodoItem) || null;
    } catch (error) {
      logger.error('Failed to find todo by ID', error as Error, {
        userId,
        todoId,
      });
      throw error;
    }
  }

  /**
   * 사용자의 모든 Todo 조회 (페이지네이션 지원)
   */
  async findAll(
    userId: string,
    options: { limit?: number; cursor?: string } = {}
  ): Promise<DynamoQueryResult<DynamoTodoItem>> {
    try {
      const response = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: {
            ':pk': `USER#${userId}`,
            ':sk': 'TODO#',
          },
          ScanIndexForward: false, // 최신 순 정렬
          Limit: options.limit,
          ExclusiveStartKey: options.cursor ? JSON.parse(options.cursor) : undefined,
        })
      );

      return {
        items: (response.Items as DynamoTodoItem[]) || [],
        lastEvaluatedKey: response.LastEvaluatedKey,
        count: response.Count || 0,
        scannedCount: response.ScannedCount || 0,
        cursor: response.LastEvaluatedKey ? JSON.stringify(response.LastEvaluatedKey) : undefined,
      };
    } catch (error) {
      logger.error('Failed to find all todos', error as Error, { userId });
      throw error;
    }
  }

  /**
   * 상태별 Todo 조회 (완료/미완료)
   */
  async findByStatus(
    userId: string,
    completed: boolean,
    options: { limit?: number; cursor?: string } = {}
  ): Promise<DynamoQueryResult<DynamoTodoItem>> {
    try {
      const response = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :gsi1pk',
          ExpressionAttributeValues: {
            ':gsi1pk': `USER#${userId}#STATUS#${completed}`,
          },
          ScanIndexForward: false, // 최신 순 (우선순위 높은 순)
          Limit: options.limit,
          ExclusiveStartKey: options.cursor ? JSON.parse(options.cursor) : undefined,
        })
      );

      return {
        items: (response.Items as DynamoTodoItem[]) || [],
        lastEvaluatedKey: response.LastEvaluatedKey,
        count: response.Count || 0,
        scannedCount: response.ScannedCount || 0,
        cursor: response.LastEvaluatedKey ? JSON.stringify(response.LastEvaluatedKey) : undefined,
      };
    } catch (error) {
      logger.error('Failed to find todos by status', error as Error, {
        userId,
        completed,
      });
      throw error;
    }
  }

  /**
   * 우선순위별 Todo 조회 (미완료 아이템만)
   */
  async findByPriority(
    userId: string,
    priority: Priority,
    options: { limit?: number; cursor?: string } = {}
  ): Promise<DynamoQueryResult<DynamoTodoItem>> {
    try {
      const response = await this.docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :gsi1pk AND begins_with(GSI1SK, :priority)',
          ExpressionAttributeValues: {
            ':gsi1pk': `USER#${userId}#STATUS#false`, // 미완료 아이템에서만 검색
            ':priority': `PRIORITY#${priority}`,
          },
          ScanIndexForward: false, // 최신 순
          Limit: options.limit,
          ExclusiveStartKey: options.cursor ? JSON.parse(options.cursor) : undefined,
        })
      );

      return {
        items: (response.Items as DynamoTodoItem[]) || [],
        lastEvaluatedKey: response.LastEvaluatedKey,
        count: response.Count || 0,
        scannedCount: response.ScannedCount || 0,
        cursor: response.LastEvaluatedKey ? JSON.stringify(response.LastEvaluatedKey) : undefined,
      };
    } catch (error) {
      logger.error('Failed to find todos by priority', error as Error, {
        userId,
        priority,
      });
      throw error;
    }
  }

  /**
   * Todo 업데이트
   */
  async update(
    userId: string,
    todoId: string,
    updates: Partial<DynamoTodoItem>
  ): Promise<DynamoTodoItem> {
    try {
      // 업데이트할 필드들을 동적으로 구성
      const updateExpression: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, unknown> = {};

      let attrIndex = 0;
      Object.entries(updates).forEach(([key, value]) => {
        if (
          key !== 'PK' &&
          key !== 'SK' &&
          key !== 'EntityType' &&
          key !== 'createdAt' &&
          value !== undefined
        ) {
          const attrName = `#attr${attrIndex}`;
          const attrValue = `:val${attrIndex}`;
          updateExpression.push(`${attrName} = ${attrValue}`);
          expressionAttributeNames[attrName] = key;
          expressionAttributeValues[attrValue] = value;
          attrIndex++;
        }
      });

      // updatedAt 추가
      updateExpression.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      // GSI 키 업데이트 (상태나 우선순위 변경 시)
      if (updates.completed !== undefined || updates.priority !== undefined) {
        const existingTodo = await this.findById(userId, todoId);
        if (existingTodo) {
          const newCompleted =
            updates.completed !== undefined ? updates.completed : existingTodo.completed;
          const newPriority =
            updates.priority !== undefined ? updates.priority : existingTodo.priority;

          updateExpression.push('#gsi1pk = :gsi1pk', '#gsi1sk = :gsi1sk');
          expressionAttributeNames['#gsi1pk'] = 'GSI1PK';
          expressionAttributeNames['#gsi1sk'] = 'GSI1SK';
          expressionAttributeValues[':gsi1pk'] = `USER#${userId}#STATUS#${newCompleted}`;
          expressionAttributeValues[':gsi1sk'] =
            `PRIORITY#${newPriority}#${new Date().toISOString()}`;
        }
      }

      const response = await this.docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            PK: `USER#${userId}`,
            SK: `TODO#${todoId}`,
          },
          UpdateExpression: `SET ${updateExpression.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'ALL_NEW',
          ConditionExpression: 'attribute_exists(PK)', // 존재하는 아이템만 업데이트
        })
      );

      if (!response.Attributes) {
        throw new ItemNotFoundError('Todo', todoId);
      }

      logger.info('Todo updated in DynamoDB', {
        userId,
        todoId,
        updatedFields: Object.keys(updates),
      });

      return response.Attributes as DynamoTodoItem;
    } catch (error) {
      if (error instanceof ItemNotFoundError) {
        throw error;
      }

      logger.error('Failed to update todo', error as Error, {
        userId,
        todoId,
        updates: Object.keys(updates),
      });
      throw error;
    }
  }

  /**
   * Todo 삭제
   */
  async delete(userId: string, todoId: string): Promise<void> {
    try {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            PK: `USER#${userId}`,
            SK: `TODO#${todoId}`,
          },
          ConditionExpression: 'attribute_exists(PK)', // 존재하는 아이템만 삭제
        })
      );

      logger.info('Todo deleted from DynamoDB', {
        userId,
        todoId,
      });
    } catch (error) {
      logger.error('Failed to delete todo', error as Error, {
        userId,
        todoId,
      });
      throw error;
    }
  }
}

/**
 * 싱글톤 DynamoDB 클라이언트
 */
let dynamoClient: DynamoDBClient;

export function getDynamoDBClient(): DynamoDBClient {
  if (!dynamoClient) {
    dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'ap-northeast-2',
    });
  }
  return dynamoClient;
}

/**
 * TodoRepository 팩토리 함수
 */
export function createTodoRepository(): TodoRepository {
  const client = getDynamoDBClient();
  return new DynamoDBTodoRepository(client);
}
