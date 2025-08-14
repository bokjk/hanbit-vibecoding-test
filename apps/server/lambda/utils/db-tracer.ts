/**
 * DynamoDB X-Ray 추적 및 성능 모니터링 시스템
 * - DynamoDB 작업별 세부 추적
 * - 쿼리 성능 자동 모니터링
 * - 스로틀링 감지 및 대응
 * - 핫 파티션 감지
 * - 인덱스 사용 최적화 추천
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import AWSXRay from 'aws-xray-sdk-core';
import { traceAsyncWithMetrics, SubsystemType } from './xray-tracer';

// DynamoDB 성능 임계값
const DB_PERFORMANCE_THRESHOLDS = {
  SLOW_QUERY_MS: 100,
  VERY_SLOW_QUERY_MS: 500,
  HIGH_RCU_CONSUMPTION: 10,
  HIGH_WCU_CONSUMPTION: 5,
  THROTTLING_WARNING: 3, // 3회 이상 스로틀링 발생시 경고
} as const;

// DynamoDB 작업 유형
export enum DynamoOperation {
  GET = 'get',
  PUT = 'put',
  UPDATE = 'update',
  DELETE = 'delete',
  QUERY = 'query',
  SCAN = 'scan',
  BATCH_GET = 'batch_get',
  BATCH_WRITE = 'batch_write',
}

// 스로틀링 통계
interface ThrottleStats {
  count: number;
  lastOccurrence: Date;
  affectedOperations: string[];
}

// 쿼리 성능 메트릭
interface QueryMetrics {
  operation: DynamoOperation;
  tableName: string;
  indexName?: string;
  itemCount: number;
  scannedCount: number;
  consumedCapacity?: {
    readCapacity?: number;
    writeCapacity?: number;
  };
  isHotPartition: boolean;
  isInefficient: boolean;
}

// DynamoDB 성능 모니터링 클래스
class DynamoPerformanceMonitor {
  private static instance: DynamoPerformanceMonitor;
  private throttleStats: Map<string, ThrottleStats> = new Map();
  private hotPartitions: Set<string> = new Set();
  private queryMetrics: QueryMetrics[] = [];

  static getInstance(): DynamoPerformanceMonitor {
    if (!DynamoPerformanceMonitor.instance) {
      DynamoPerformanceMonitor.instance = new DynamoPerformanceMonitor();
    }
    return DynamoPerformanceMonitor.instance;
  }

  recordThrottling(tableName: string, operation: string): void {
    const key = `${tableName}:${operation}`;
    const existing = this.throttleStats.get(key);

    if (existing) {
      existing.count++;
      existing.lastOccurrence = new Date();
      existing.affectedOperations.push(operation);
    } else {
      this.throttleStats.set(key, {
        count: 1,
        lastOccurrence: new Date(),
        affectedOperations: [operation],
      });
    }

    // 스로틀링 경고 발생
    const currentStats = this.throttleStats.get(key);
    if (currentStats && currentStats.count >= DB_PERFORMANCE_THRESHOLDS.THROTTLING_WARNING) {
      console.warn(
        `[DynamoDB THROTTLING ALERT] ${key} has been throttled ${currentStats.count} times`,
        {
          recentOperations: existing?.affectedOperations || [operation],
          lastOccurrence: new Date(),
          recommendations: this.getThrottlingRecommendations(tableName),
        }
      );
    }
  }

  recordQueryMetrics(metrics: QueryMetrics): void {
    this.queryMetrics.push(metrics);

    // 핫 파티션 감지
    if (metrics.isHotPartition) {
      const partitionKey = `${metrics.tableName}:${metrics.indexName || 'primary'}`;
      this.hotPartitions.add(partitionKey);

      console.warn(`[HOT PARTITION DETECTED] ${partitionKey}`, {
        scannedVsReturned: `${metrics.scannedCount}/${metrics.itemCount}`,
        efficiency: `${((metrics.itemCount / metrics.scannedCount) * 100).toFixed(2)}%`,
        recommendations: this.getHotPartitionRecommendations(metrics),
      });
    }

    // 비효율적인 쿼리 감지
    if (metrics.isInefficient) {
      console.warn(`[INEFFICIENT QUERY] ${metrics.operation} on ${metrics.tableName}`, {
        efficiency: `${((metrics.itemCount / metrics.scannedCount) * 100).toFixed(2)}%`,
        consumedCapacity: metrics.consumedCapacity,
        recommendations: this.getQueryOptimizationRecommendations(metrics),
      });
    }
  }

  private getThrottlingRecommendations(tableName: string): string[] {
    return [
      `Consider increasing provisioned capacity for table ${tableName}`,
      'Implement exponential backoff with jitter',
      'Review access patterns for hot partitions',
      'Consider using on-demand billing mode',
      'Implement request coalescing or batching',
    ];
  }

  private getHotPartitionRecommendations(metrics: QueryMetrics): string[] {
    return [
      'Consider adding random suffix to partition key',
      'Review data distribution across partition keys',
      'Consider using composite sort key for better distribution',
      `Review access patterns for ${metrics.tableName}`,
      'Consider implementing write sharding',
    ];
  }

  private getQueryOptimizationRecommendations(metrics: QueryMetrics): string[] {
    const recommendations = [];

    if (metrics.scannedCount > metrics.itemCount * 10) {
      recommendations.push('Query is scanning too many items - consider better filtering');
    }

    if (!metrics.indexName && metrics.operation === DynamoOperation.QUERY) {
      recommendations.push('Consider creating a GSI for this access pattern');
    }

    if (metrics.consumedCapacity?.readCapacity && metrics.consumedCapacity.readCapacity > 5) {
      recommendations.push('High read capacity consumption - consider projection optimization');
    }

    return recommendations;
  }

  getPerformanceReport() {
    return {
      throttleStats: Object.fromEntries(this.throttleStats),
      hotPartitions: Array.from(this.hotPartitions),
      queryCount: this.queryMetrics.length,
      avgEfficiency:
        this.queryMetrics.length > 0
          ? `${((this.queryMetrics.reduce((sum, m) => sum + m.itemCount / m.scannedCount, 0) / this.queryMetrics.length) * 100).toFixed(2)}%`
          : 'N/A',
    };
  }
}

// 전역 모니터 인스턴스
const dbMonitor = DynamoPerformanceMonitor.getInstance();

/**
 * DynamoDB 클라이언트 팩토리 (X-Ray 통합)
 */
export function createTracedDynamoClient(): DynamoDBDocumentClient {
  // 기본 DynamoDB 클라이언트 생성
  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });

  // X-Ray로 클라이언트 래핑
  const tracedClient = AWSXRay.captureAWSv3Client(client);

  // Document 클라이언트로 변환
  return DynamoDBDocumentClient.from(tracedClient, {
    marshallOptions: {
      removeUndefinedValues: true,
      convertEmptyValues: false,
    },
    unmarshallOptions: {
      wrapNumbers: false,
    },
  });
}

/**
 * DynamoDB GET 작업 추적
 */
export async function tracedGet<T = Record<string, unknown>>(
  client: DynamoDBDocumentClient,
  tableName: string,
  key: Record<string, unknown>,
  options?: {
    consistentRead?: boolean;
    projectionExpression?: string;
  }
): Promise<T | null> {
  return traceAsyncWithMetrics(
    `get-item`,
    SubsystemType.DATABASE,
    async subsegment => {
      const command = new GetCommand({
        TableName: tableName,
        Key: key,
        ConsistentRead: options?.consistentRead,
        ProjectionExpression: options?.projectionExpression,
        ReturnConsumedCapacity: 'TOTAL',
      });

      // 상세 메타데이터 추가
      subsegment?.addMetadata('dynamodb_operation', {
        operation: DynamoOperation.GET,
        tableName,
        key,
        consistentRead: options?.consistentRead || false,
        projectionExpression: options?.projectionExpression,
      });

      try {
        const result = await client.send(command);

        // 성능 메트릭 수집
        const metrics: QueryMetrics = {
          operation: DynamoOperation.GET,
          tableName,
          itemCount: result.Item ? 1 : 0,
          scannedCount: 1,
          consumedCapacity: result.ConsumedCapacity
            ? {
                readCapacity: result.ConsumedCapacity.CapacityUnits,
              }
            : undefined,
          isHotPartition: false,
          isInefficient: false,
        };

        dbMonitor.recordQueryMetrics(metrics);

        // 추가 추적 정보
        subsegment?.addMetadata('dynamodb_result', {
          itemFound: !!result.Item,
          consumedCapacity: result.ConsumedCapacity?.CapacityUnits || 0,
        });

        subsegment?.addAnnotation('table_name', tableName);
        subsegment?.addAnnotation('item_found', !!result.Item);

        return (result.Item as T) || null;
      } catch (error: unknown) {
        const dynamoError = error as { name?: string };
        // 스로틀링 감지
        if (dynamoError.name === 'ProvisionedThroughputExceededException') {
          dbMonitor.recordThrottling(tableName, DynamoOperation.GET);
          subsegment?.addAnnotation('throttled', true);
        }

        throw error;
      }
    },
    { tableName, keyAttributes: Object.keys(key) }
  );
}

/**
 * DynamoDB PUT 작업 추적
 */
export async function tracedPut(
  client: DynamoDBDocumentClient,
  tableName: string,
  item: Record<string, unknown>,
  options?: {
    conditionExpression?: string;
    returnValues?: 'NONE' | 'ALL_OLD';
  }
): Promise<unknown> {
  return traceAsyncWithMetrics(
    `put-item`,
    SubsystemType.DATABASE,
    async subsegment => {
      const command = new PutCommand({
        TableName: tableName,
        Item: item,
        ConditionExpression: options?.conditionExpression,
        ReturnValues: options?.returnValues,
        ReturnConsumedCapacity: 'TOTAL',
      });

      subsegment?.addMetadata('dynamodb_operation', {
        operation: DynamoOperation.PUT,
        tableName,
        itemSize: JSON.stringify(item).length,
        hasCondition: !!options?.conditionExpression,
      });

      try {
        const result = await client.send(command);

        const metrics: QueryMetrics = {
          operation: DynamoOperation.PUT,
          tableName,
          itemCount: 1,
          scannedCount: 1,
          consumedCapacity: result.ConsumedCapacity
            ? {
                writeCapacity: result.ConsumedCapacity.CapacityUnits,
              }
            : undefined,
          isHotPartition: false,
          isInefficient: false,
        };

        dbMonitor.recordQueryMetrics(metrics);

        subsegment?.addMetadata('dynamodb_result', {
          success: true,
          consumedCapacity: result.ConsumedCapacity?.CapacityUnits || 0,
        });

        subsegment?.addAnnotation('table_name', tableName);
        subsegment?.addAnnotation('write_success', true);

        return result;
      } catch (error: unknown) {
        const dynamoError = error as { name?: string };
        if (dynamoError.name === 'ProvisionedThroughputExceededException') {
          dbMonitor.recordThrottling(tableName, DynamoOperation.PUT);
          subsegment?.addAnnotation('throttled', true);
        }
        throw error;
      }
    },
    { tableName, itemKeys: Object.keys(item) }
  );
}

/**
 * DynamoDB QUERY 작업 추적 (가장 중요한 성능 모니터링)
 */
export async function tracedQuery<T = Record<string, unknown>>(
  client: DynamoDBDocumentClient,
  tableName: string,
  keyCondition: string,
  options?: {
    indexName?: string;
    filterExpression?: string;
    projectionExpression?: string;
    limit?: number;
    exclusiveStartKey?: Record<string, unknown>;
    scanIndexForward?: boolean;
    expressionAttributeNames?: Record<string, string>;
    expressionAttributeValues?: Record<string, unknown>;
  }
): Promise<{
  items: T[];
  lastEvaluatedKey?: Record<string, unknown>;
  count: number;
  scannedCount: number;
}> {
  return traceAsyncWithMetrics(
    `query-items`,
    SubsystemType.DATABASE,
    async subsegment => {
      const command = new QueryCommand({
        TableName: tableName,
        IndexName: options?.indexName,
        KeyConditionExpression: keyCondition,
        FilterExpression: options?.filterExpression,
        ProjectionExpression: options?.projectionExpression,
        Limit: options?.limit,
        ExclusiveStartKey: options?.exclusiveStartKey,
        ScanIndexForward: options?.scanIndexForward,
        ExpressionAttributeNames: options?.expressionAttributeNames,
        ExpressionAttributeValues: options?.expressionAttributeValues,
        ReturnConsumedCapacity: 'TOTAL',
      });

      subsegment?.addMetadata('dynamodb_operation', {
        operation: DynamoOperation.QUERY,
        tableName,
        indexName: options?.indexName,
        keyCondition,
        filterExpression: options?.filterExpression,
        limit: options?.limit,
        hasFilter: !!options?.filterExpression,
      });

      try {
        const result = await client.send(command);

        const itemCount = result.Count || 0;
        const scannedCount = result.ScannedCount || 0;
        const efficiency = scannedCount > 0 ? itemCount / scannedCount : 1;

        // 성능 문제 감지
        const isInefficient = efficiency < 0.3; // 30% 미만 효율성
        const isHotPartition = scannedCount > 100 && efficiency < 0.1; // 매우 비효율적

        const metrics: QueryMetrics = {
          operation: DynamoOperation.QUERY,
          tableName,
          indexName: options?.indexName,
          itemCount,
          scannedCount,
          consumedCapacity: result.ConsumedCapacity
            ? {
                readCapacity: result.ConsumedCapacity.CapacityUnits,
              }
            : undefined,
          isHotPartition,
          isInefficient,
        };

        dbMonitor.recordQueryMetrics(metrics);

        // 추가 성능 정보
        subsegment?.addMetadata('dynamodb_result', {
          itemCount,
          scannedCount,
          efficiency: `${(efficiency * 100).toFixed(2)}%`,
          consumedCapacity: result.ConsumedCapacity?.CapacityUnits || 0,
          isInefficient,
          isHotPartition,
        });

        subsegment?.addAnnotation('table_name', tableName);
        subsegment?.addAnnotation('index_name', options?.indexName || 'primary');
        subsegment?.addAnnotation('query_efficiency', Math.round(efficiency * 100));
        subsegment?.addAnnotation('items_returned', itemCount);
        subsegment?.addAnnotation('items_scanned', scannedCount);

        return {
          items: result.Items as T[],
          lastEvaluatedKey: result.LastEvaluatedKey,
          count: itemCount,
          scannedCount,
        };
      } catch (error: unknown) {
        const dynamoError = error as { name?: string };
        if (dynamoError.name === 'ProvisionedThroughputExceededException') {
          dbMonitor.recordThrottling(tableName, DynamoOperation.QUERY);
          subsegment?.addAnnotation('throttled', true);
        }
        throw error;
      }
    },
    {
      tableName,
      indexName: options?.indexName,
      hasFilter: !!options?.filterExpression,
      keyCondition,
    }
  );
}

/**
 * DynamoDB UPDATE 작업 추적
 */
export async function tracedUpdate(
  client: DynamoDBDocumentClient,
  tableName: string,
  key: Record<string, unknown>,
  updateExpression: string,
  options?: {
    conditionExpression?: string;
    expressionAttributeNames?: Record<string, string>;
    expressionAttributeValues?: Record<string, unknown>;
    returnValues?: 'NONE' | 'ALL_OLD' | 'UPDATED_OLD' | 'ALL_NEW' | 'UPDATED_NEW';
  }
): Promise<unknown> {
  return traceAsyncWithMetrics(
    `update-item`,
    SubsystemType.DATABASE,
    async subsegment => {
      const command = new UpdateCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ConditionExpression: options?.conditionExpression,
        ExpressionAttributeNames: options?.expressionAttributeNames,
        ExpressionAttributeValues: options?.expressionAttributeValues,
        ReturnValues: options?.returnValues,
        ReturnConsumedCapacity: 'TOTAL',
      });

      subsegment?.addMetadata('dynamodb_operation', {
        operation: DynamoOperation.UPDATE,
        tableName,
        updateExpression,
        hasCondition: !!options?.conditionExpression,
        keyAttributes: Object.keys(key),
      });

      try {
        const result = await client.send(command);

        const metrics: QueryMetrics = {
          operation: DynamoOperation.UPDATE,
          tableName,
          itemCount: 1,
          scannedCount: 1,
          consumedCapacity: result.ConsumedCapacity
            ? {
                writeCapacity: result.ConsumedCapacity.CapacityUnits,
              }
            : undefined,
          isHotPartition: false,
          isInefficient: false,
        };

        dbMonitor.recordQueryMetrics(metrics);

        subsegment?.addMetadata('dynamodb_result', {
          success: true,
          consumedCapacity: result.ConsumedCapacity?.CapacityUnits || 0,
        });

        subsegment?.addAnnotation('table_name', tableName);
        subsegment?.addAnnotation('update_success', true);

        return result;
      } catch (error: unknown) {
        const dynamoError = error as { name?: string };
        if (dynamoError.name === 'ProvisionedThroughputExceededException') {
          dbMonitor.recordThrottling(tableName, DynamoOperation.UPDATE);
          subsegment?.addAnnotation('throttled', true);
        }
        throw error;
      }
    },
    { tableName, keyAttributes: Object.keys(key) }
  );
}

/**
 * DynamoDB DELETE 작업 추적
 */
export async function tracedDelete(
  client: DynamoDBDocumentClient,
  tableName: string,
  key: Record<string, unknown>,
  options?: {
    conditionExpression?: string;
    returnValues?: 'NONE' | 'ALL_OLD';
  }
): Promise<unknown> {
  return traceAsyncWithMetrics(
    `delete-item`,
    SubsystemType.DATABASE,
    async subsegment => {
      const command = new DeleteCommand({
        TableName: tableName,
        Key: key,
        ConditionExpression: options?.conditionExpression,
        ReturnValues: options?.returnValues,
        ReturnConsumedCapacity: 'TOTAL',
      });

      subsegment?.addMetadata('dynamodb_operation', {
        operation: DynamoOperation.DELETE,
        tableName,
        keyAttributes: Object.keys(key),
        hasCondition: !!options?.conditionExpression,
      });

      try {
        const result = await client.send(command);

        const metrics: QueryMetrics = {
          operation: DynamoOperation.DELETE,
          tableName,
          itemCount: 1,
          scannedCount: 1,
          consumedCapacity: result.ConsumedCapacity
            ? {
                writeCapacity: result.ConsumedCapacity.CapacityUnits,
              }
            : undefined,
          isHotPartition: false,
          isInefficient: false,
        };

        dbMonitor.recordQueryMetrics(metrics);

        subsegment?.addMetadata('dynamodb_result', {
          success: true,
          consumedCapacity: result.ConsumedCapacity?.CapacityUnits || 0,
        });

        subsegment?.addAnnotation('table_name', tableName);
        subsegment?.addAnnotation('delete_success', true);

        return result;
      } catch (error: unknown) {
        const dynamoError = error as { name?: string };
        if (dynamoError.name === 'ProvisionedThroughputExceededException') {
          dbMonitor.recordThrottling(tableName, DynamoOperation.DELETE);
          subsegment?.addAnnotation('throttled', true);
        }
        throw error;
      }
    },
    { tableName, keyAttributes: Object.keys(key) }
  );
}

/**
 * DynamoDB 성능 리포트 생성
 */
export function getDynamoPerformanceReport() {
  return dbMonitor.getPerformanceReport();
}

/**
 * 테스트용 모니터링 데이터 초기화
 */
export function resetDynamoMonitoring(): void {
  // private 필드 접근을 위한 타입 캐스팅
  const monitor = dbMonitor as {
    throttleStats: Map<string, ThrottleStats>;
    hotPartitions: Set<string>;
    queryMetrics: QueryMetrics[];
  };
  monitor.throttleStats.clear();
  monitor.hotPartitions.clear();
  monitor.queryMetrics = [];
}
