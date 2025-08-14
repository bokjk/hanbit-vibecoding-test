import {
  CloudWatchClient,
  PutMetricDataCommand,
  PutMetricDataCommandInput,
  MetricDatum,
  Dimension,
} from '@aws-sdk/client-cloudwatch';
import { Logger } from './logger';

/**
 * CloudWatch 메트릭 유틸리티 클래스
 * AWS CloudWatch에 커스텀 메트릭을 전송하고 관리
 */
export class CloudWatchMetrics {
  private cloudWatchClient: CloudWatchClient;
  private logger: Logger;
  private namespace: string;
  private metricBuffer: MetricDatum[] = [];
  private bufferSize: number;
  private flushInterval: number;
  private flushTimer?: NodeJS.Timeout;

  constructor(
    options: {
      namespace?: string;
      bufferSize?: number;
      flushIntervalMs?: number;
      region?: string;
    } = {}
  ) {
    this.namespace = options.namespace || 'Hanbit/TodoApp';
    this.bufferSize = options.bufferSize || 20; // AWS 최대 20개 메트릭 per request
    this.flushInterval = options.flushIntervalMs || 60000; // 1분

    this.cloudWatchClient = new CloudWatchClient({
      region: options.region || process.env.AWS_REGION || 'ap-northeast-2',
    });

    this.logger = new Logger('CloudWatchMetrics');
    this.startFlushTimer();
  }

  /**
   * 비즈니스 메트릭 전송 - TODO CRUD 작업 통계
   */
  async recordBusinessMetric(
    metricName: string,
    value: number,
    unit: 'Count' | 'Seconds' | 'Percent' | 'Bytes' = 'Count',
    dimensions: Record<string, string> = {}
  ): Promise<void> {
    const metric: MetricDatum = {
      MetricName: metricName,
      Value: value,
      Unit: unit,
      Timestamp: new Date(),
      Dimensions: this.formatDimensions(dimensions),
    };

    this.addToBuffer(metric);
  }

  /**
   * 성능 메트릭 전송 - 응답시간, 메모리 사용량
   */
  async recordPerformanceMetric(
    operation: string,
    responseTime: number,
    memoryUsed?: number
  ): Promise<void> {
    const dimensions = { Operation: operation };

    // 응답 시간 메트릭
    await this.recordBusinessMetric('ResponseTime', responseTime, 'Seconds', dimensions);

    // 메모리 사용량 메트릭 (있는 경우)
    if (memoryUsed !== undefined) {
      await this.recordBusinessMetric('MemoryUsage', memoryUsed, 'Bytes', dimensions);
    }

    // 요청 카운트
    await this.recordBusinessMetric('RequestCount', 1, 'Count', dimensions);
  }

  /**
   * 에러 메트릭 전송 - 에러율, 에러 유형별
   */
  async recordErrorMetric(
    operation: string,
    errorType: string,
    errorMessage?: string
  ): Promise<void> {
    const dimensions = {
      Operation: operation,
      ErrorType: errorType,
    };

    // 에러 카운트
    await this.recordBusinessMetric('ErrorCount', 1, 'Count', dimensions);

    // 특정 에러 타입별 카운트
    await this.recordBusinessMetric(`Error_${errorType}`, 1, 'Count', { Operation: operation });

    this.logger.warn('Error metric recorded', {
      operation,
      errorType,
      errorMessage,
    });
  }

  /**
   * TODO 관련 비즈니스 메트릭
   */
  async recordTodoMetric(
    action: 'create' | 'read' | 'update' | 'delete',
    userId?: string,
    success: boolean = true
  ): Promise<void> {
    const dimensions: Record<string, string> = {
      Action: action,
      Status: success ? 'Success' : 'Failed',
    };

    if (userId) {
      dimensions.UserId = userId;
    }

    await this.recordBusinessMetric('TodoOperation', 1, 'Count', dimensions);

    // 성공/실패별 메트릭
    if (success) {
      await this.recordBusinessMetric('TodoOperationSuccess', 1, 'Count', { Action: action });
    } else {
      await this.recordBusinessMetric('TodoOperationFailure', 1, 'Count', { Action: action });
    }
  }

  /**
   * 사용자 활동 메트릭
   */
  async recordUserActivityMetric(
    userId: string,
    activityType: string,
    value: number = 1
  ): Promise<void> {
    await this.recordBusinessMetric('UserActivity', value, 'Count', {
      UserId: userId,
      ActivityType: activityType,
    });
  }

  /**
   * 배치로 메트릭을 CloudWatch에 전송
   */
  async flushMetrics(force: boolean = false): Promise<void> {
    if (this.metricBuffer.length === 0) {
      return;
    }

    if (!force && this.metricBuffer.length < this.bufferSize) {
      return;
    }

    const metricsToSend = this.metricBuffer.splice(0, this.bufferSize);

    try {
      const params: PutMetricDataCommandInput = {
        Namespace: this.namespace,
        MetricData: metricsToSend,
      };

      const command = new PutMetricDataCommand(params);
      await this.cloudWatchClient.send(command);

      this.logger.info('Metrics flushed to CloudWatch', {
        count: metricsToSend.length,
        namespace: this.namespace,
      });
    } catch (error) {
      this.logger.error('Failed to flush metrics to CloudWatch', error as Error);

      // 실패한 메트릭을 다시 버퍼에 추가 (재시도를 위해)
      this.metricBuffer.unshift(...metricsToSend);
    }
  }

  /**
   * Lambda 함수 종료 시 호출되는 정리 함수
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // 남은 메트릭을 모두 전송
    await this.flushMetrics(true);

    this.logger.info('CloudWatch metrics service shutdown completed');
  }

  /**
   * 메트릭을 버퍼에 추가
   */
  private addToBuffer(metric: MetricDatum): void {
    this.metricBuffer.push(metric);

    // 버퍼가 가득 찬 경우 즉시 전송
    if (this.metricBuffer.length >= this.bufferSize) {
      this.flushMetrics().catch(error => {
        this.logger.error('Failed to auto-flush metrics', error);
      });
    }
  }

  /**
   * 차원을 AWS CloudWatch 형식으로 변환
   */
  private formatDimensions(dimensions: Record<string, string>): Dimension[] {
    return Object.entries(dimensions).map(([name, value]) => ({
      Name: name,
      Value: value,
    }));
  }

  /**
   * 자동 플러시 타이머 시작
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushMetrics(true).catch(error => {
        this.logger.error('Failed to flush metrics on timer', error);
      });
    }, this.flushInterval);
  }
}

/**
 * 싱글톤 인스턴스
 */
let cloudWatchMetricsInstance: CloudWatchMetrics | null = null;

/**
 * CloudWatch 메트릭 인스턴스 반환
 */
export function getCloudWatchMetrics(): CloudWatchMetrics {
  if (!cloudWatchMetricsInstance) {
    cloudWatchMetricsInstance = new CloudWatchMetrics({
      namespace: process.env.CLOUDWATCH_NAMESPACE || 'Hanbit/TodoApp',
      bufferSize: parseInt(process.env.METRICS_BUFFER_SIZE || '20'),
      flushIntervalMs: parseInt(process.env.METRICS_FLUSH_INTERVAL || '60000'),
    });
  }
  return cloudWatchMetricsInstance;
}

/**
 * 메트릭 수집 데코레이터 - 함수 실행 시간 자동 측정
 */
export function withMetrics(operation: string) {
  return function (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const startTime = Date.now();
      const metrics = getCloudWatchMetrics();

      try {
        const result = await originalMethod.apply(this, args);

        // 성공 메트릭 기록
        const responseTime = (Date.now() - startTime) / 1000;
        await metrics.recordPerformanceMetric(operation, responseTime);

        return result;
      } catch (error) {
        // 에러 메트릭 기록
        const responseTime = (Date.now() - startTime) / 1000;
        await metrics.recordPerformanceMetric(operation, responseTime);
        await metrics.recordErrorMetric(
          operation,
          error instanceof Error ? error.constructor.name : 'UnknownError',
          error instanceof Error ? error.message : 'Unknown error'
        );

        throw error;
      }
    };

    return descriptor;
  };
}
