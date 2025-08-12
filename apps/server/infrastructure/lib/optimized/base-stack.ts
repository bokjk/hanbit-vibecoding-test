import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../../config/environment';

/**
 * 기본 스택 클래스 - 모든 스택이 상속받는 베이스 클래스
 * 공통 태깅, 비용 할당, 환경별 설정을 처리
 */
export abstract class BaseStack extends cdk.Stack {
  protected readonly config: EnvironmentConfig;
  protected readonly isProd: boolean;
  protected readonly isTest: boolean;
  protected readonly isDev: boolean;

  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps & { environmentConfig: EnvironmentConfig }
  ) {
    super(scope, id, props);

    this.config = props.environmentConfig;
    this.isProd = this.config.name === 'production';
    this.isTest = this.config.name === 'test';
    this.isDev = this.config.name === 'development';

    // 스택 레벨 태그 적용
    this.applyGlobalTags();

    // 스택 설명 추가
    this.addDescription(`Hanbit Todo App - ${this.config.name} Environment`);

    // 비용 할당 태그 적용
    this.applyCostAllocationTags();
  }

  /**
   * 전역 태그 적용
   */
  private applyGlobalTags(): void {
    const mandatoryTags = {
      Environment: this.config.name,
      Project: 'HanbitTodo',
      ManagedBy: 'CDK',
      Stack: this.stackName,
      Region: this.region,
      Version: process.env.VERSION || '1.0.0',
      CreatedAt: new Date().toISOString().split('T')[0],
    };

    Object.entries(mandatoryTags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });

    // 환경별 추가 태그
    Object.entries(this.config.tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }

  /**
   * 비용 할당 태그 적용
   */
  private applyCostAllocationTags(): void {
    const costTags = {
      'cost:environment': this.config.name,
      'cost:project': 'hanbit-todo',
      'cost:team': this.config.tags.Owner || 'Unknown',
      'cost:center': this.config.tags.CostCenter || 'Default',
      'cost:automation': 'true',
    };

    Object.entries(costTags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }

  /**
   * 리소스 이름 생성 헬퍼
   */
  protected resourceName(baseName: string): string {
    return `${baseName}-${this.config.name}`;
  }

  /**
   * 환경별 조건부 리소스 생성
   */
  protected conditionalResource<T>(
    prodResource: () => T,
    testResource: () => T,
    devResource: () => T
  ): T {
    if (this.isProd) {
      return prodResource();
    } else if (this.isTest) {
      return testResource();
    } else {
      return devResource();
    }
  }

  /**
   * 환경별 값 선택
   */
  protected selectByEnvironment<T>(prod: T, test: T, dev: T): T {
    if (this.isProd) return prod;
    if (this.isTest) return test;
    return dev;
  }

  /**
   * 리소스 삭제 정책 설정
   */
  protected getRemovalPolicy(): cdk.RemovalPolicy {
    return this.isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;
  }

  /**
   * 스택 출력 생성 헬퍼
   */
  protected createOutput(name: string, value: string, description?: string): cdk.CfnOutput {
    return new cdk.CfnOutput(this, `${name}${this.config.stackSuffix}`, {
      value,
      description: description || `${name} for ${this.config.name} environment`,
      exportName: `${this.stackName}-${name}-${this.config.name}`,
    });
  }

  /**
   * 비용 알림 설정
   */
  protected setupCostAlerts(threshold: number): void {
    if (this.isProd || this.isTest) {
      // 비용 알림은 별도의 Billing 스택에서 처리
      cdk.Tags.of(this).add('cost:alert:threshold', threshold.toString());
      cdk.Tags.of(this).add('cost:alert:enabled', 'true');
    }
  }
}
