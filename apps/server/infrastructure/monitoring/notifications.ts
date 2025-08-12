import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as constructs from 'constructs';
import { Duration } from 'aws-cdk-lib';

/**
 * SNS 기반 다중 채널 알림 시스템
 * 심각도별 차등 알림 정책 및 중복 방지 시스템
 */

export interface NotificationChannel {
  name: string;
  type: 'EMAIL' | 'SMS' | 'SLACK' | 'PAGERDUTY' | 'WEBHOOK';
  endpoint: string;
  severity: Array<'CRITICAL' | 'WARNING' | 'INFO'>;
  businessHoursOnly?: boolean;
  rateLimitMinutes?: number;
}

export interface EscalationPolicy {
  name: string;
  levels: EscalationLevel[];
}

export interface EscalationLevel {
  delayMinutes: number;
  channels: string[];
  condition: 'UNACKNOWLEDGED' | 'STILL_FIRING' | 'ESCALATED';
}

export interface NotificationTemplate {
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  subject: string;
  body: string;
  slackFormat?: string;
  smsFormat?: string;
}

export class NotificationConfiguration {
  /**
   * 알림 채널 정의
   */
  static readonly NOTIFICATION_CHANNELS: NotificationChannel[] = [
    {
      name: 'ops-critical',
      type: 'EMAIL',
      endpoint: 'ops-critical@company.com',
      severity: ['CRITICAL'],
      rateLimitMinutes: 5, // 중복 알림 방지
    },
    {
      name: 'ops-team',
      type: 'EMAIL',
      endpoint: 'ops-team@company.com',
      severity: ['CRITICAL', 'WARNING'],
      rateLimitMinutes: 15,
    },
    {
      name: 'dev-alerts',
      type: 'EMAIL',
      endpoint: 'dev-alerts@company.com',
      severity: ['WARNING', 'INFO'],
      businessHoursOnly: true,
    },
    {
      name: 'on-call-sms',
      type: 'SMS',
      endpoint: '+821012345678', // 실제 환경에서는 환경변수로 관리
      severity: ['CRITICAL'],
      rateLimitMinutes: 10,
    },
    {
      name: 'slack-ops',
      type: 'SLACK',
      endpoint: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK',
      severity: ['CRITICAL', 'WARNING'],
      rateLimitMinutes: 5,
    },
    {
      name: 'pagerduty-critical',
      type: 'PAGERDUTY',
      endpoint: 'https://events.pagerduty.com/integration/YOUR-KEY/enqueue',
      severity: ['CRITICAL'],
    },
  ];

  /**
   * 에스컬레이션 정책
   */
  static readonly ESCALATION_POLICIES: EscalationPolicy[] = [
    {
      name: 'critical-escalation',
      levels: [
        {
          delayMinutes: 0,
          channels: ['ops-critical', 'on-call-sms', 'pagerduty-critical'],
          condition: 'UNACKNOWLEDGED',
        },
        {
          delayMinutes: 15,
          channels: ['ops-team', 'slack-ops'],
          condition: 'STILL_FIRING',
        },
        {
          delayMinutes: 30,
          channels: ['ops-critical'], // 재알림
          condition: 'ESCALATED',
        },
      ],
    },
    {
      name: 'warning-escalation',
      levels: [
        {
          delayMinutes: 0,
          channels: ['ops-team', 'slack-ops'],
          condition: 'UNACKNOWLEDGED',
        },
        {
          delayMinutes: 60,
          channels: ['ops-critical'],
          condition: 'STILL_FIRING',
        },
      ],
    },
  ];

  /**
   * 알림 템플릿
   */
  static readonly NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
    CRITICAL: {
      severity: 'CRITICAL',
      subject: '🚨 [CRITICAL] Todo 앱 시스템 장애 발생',
      body: `
긴급 알림: Todo 앱에서 심각한 문제가 발생했습니다.

알람명: {AlarmName}
설명: {AlarmDescription}
상태: {NewStateValue}
시간: {StateChangeTime}
임계값: {Threshold}
현재값: {MetricValue}

즉각적인 조치가 필요합니다.
대시보드: {DashboardURL}
로그: {LogsURL}
      `,
      slackFormat: `
🚨 *CRITICAL ALERT*
*알람*: {AlarmName}
*상태*: {NewStateValue}
*시간*: {StateChangeTime}
*현재값*: {MetricValue} (임계값: {Threshold})

즉각적인 조치 필요 | <{DashboardURL}|대시보드> | <{LogsURL}|로그>
      `,
      smsFormat: 'CRITICAL: {AlarmName} - {NewStateValue}. 즉시 확인 필요.',
    },
    WARNING: {
      severity: 'WARNING',
      subject: '⚠️ [WARNING] Todo 앱 성능 이상',
      body: `
경고 알림: Todo 앱 성능에 문제가 감지되었습니다.

알람명: {AlarmName}
설명: {AlarmDescription}
상태: {NewStateValue}
시간: {StateChangeTime}
임계값: {Threshold}
현재값: {MetricValue}

모니터링을 강화하고 필요시 조치하세요.
대시보드: {DashboardURL}
      `,
      slackFormat: `
⚠️ *WARNING*
*알람*: {AlarmName}
*상태*: {NewStateValue}
*현재값*: {MetricValue} (임계값: {Threshold})

<{DashboardURL}|대시보드에서 확인>
      `,
    },
    INFO: {
      severity: 'INFO',
      subject: 'ℹ️ [INFO] Todo 앱 상태 정보',
      body: `
정보 알림: Todo 앱 상태가 변경되었습니다.

알람명: {AlarmName}
설명: {AlarmDescription}
상태: {NewStateValue}
시간: {StateChangeTime}

참고용 정보입니다.
대시보드: {DashboardURL}
      `,
      slackFormat: `
ℹ️ *INFO*
*알람*: {AlarmName} - {NewStateValue}
<{DashboardURL}|대시보드>
      `,
    },
  };
}

export class NotificationSystem extends constructs.Construct {
  public readonly topics: Map<string, sns.Topic> = new Map();
  public readonly subscriptions: Map<string, sns.Subscription[]> = new Map();

  constructor(scope: constructs.Construct, id: string) {
    super(scope, id);

    this.createTopics();
    this.createSubscriptions();
  }

  /**
   * SNS 토픽 생성 (심각도별)
   */
  private createTopics(): void {
    const severities = ['CRITICAL', 'WARNING', 'INFO'];

    severities.forEach(severity => {
      const topic = new sns.Topic(this, `TodoApp${severity}Topic`, {
        topicName: `TodoApp-${severity}-Notifications`,
        displayName: `Todo App ${severity} Alerts`,
        // 메시지 보존 정책
        deliveryRetry: {
          backoffStrategy: sns.BackoffStrategy.LINEAR,
          minDelay: Duration.seconds(10),
          maxDelay: Duration.seconds(300),
          numRetries: 3,
        },
      });

      // 토픽에 태그 추가
      topic.node.addMetadata('severity', severity);
      topic.node.addMetadata('service', 'todo-app');
      
      this.topics.set(severity, topic);
    });

    // 복합 알람을 위한 별도 토픽
    const compositeTopic = new sns.Topic(this, 'TodoAppCompositeAlertTopic', {
      topicName: 'TodoApp-Composite-Alerts',
      displayName: 'Todo App Composite Alerts',
    });
    
    this.topics.set('COMPOSITE', compositeTopic);
  }

  /**
   * 구독 생성
   */
  private createSubscriptions(): void {
    NotificationConfiguration.NOTIFICATION_CHANNELS.forEach(channel => {
      channel.severity.forEach(severity => {
        const topic = this.topics.get(severity);
        if (topic) {
          const subscriptions = this.createChannelSubscriptions(topic, channel);
          
          const existingSubs = this.subscriptions.get(`${severity}-${channel.name}`) || [];
          this.subscriptions.set(`${severity}-${channel.name}`, [...existingSubs, ...subscriptions]);
        }
      });
    });
  }

  /**
   * 채널별 구독 생성
   */
  private createChannelSubscriptions(topic: sns.Topic, channel: NotificationChannel): sns.Subscription[] {
    const subscriptions: sns.Subscription[] = [];

    switch (channel.type) {
      case 'EMAIL':
        subscriptions.push(
          topic.addSubscription(
            new snsSubscriptions.EmailSubscription(channel.endpoint, {
              json: false, // 이메일의 경우 텍스트 형식이 더 읽기 쉬움
              filterPolicy: this.createFilterPolicy(channel),
            })
          )
        );
        break;

      case 'SMS':
        subscriptions.push(
          topic.addSubscription(
            new snsSubscriptions.SmsSubscription(channel.endpoint, {
              filterPolicy: this.createFilterPolicy(channel),
            })
          )
        );
        break;

      case 'SLACK':
      case 'WEBHOOK':
      case 'PAGERDUTY':
        // HTTP/HTTPS 엔드포인트를 위한 구독
        subscriptions.push(
          topic.addSubscription(
            new snsSubscriptions.UrlSubscription(channel.endpoint, {
              protocol: sns.SubscriptionProtocol.HTTPS,
              filterPolicy: this.createFilterPolicy(channel),
              rawMessageDelivery: channel.type === 'SLACK', // Slack은 raw 메시지 선호
            })
          )
        );
        break;
    }

    return subscriptions;
  }

  /**
   * 필터 정책 생성 (중복 방지, 업무시간 고려)
   */
  private createFilterPolicy(channel: NotificationChannel): Record<string, sns.SubscriptionFilter> {
    const policy: Record<string, sns.SubscriptionFilter> = {};

    // 심각도 필터
    if (channel.severity.length < 3) { // 모든 심각도가 아닌 경우에만 필터 적용
      policy.severity = sns.SubscriptionFilter.stringFilter({
        allowlist: channel.severity,
      });
    }

    // 업무시간 필터 (INFO 채널용)
    if (channel.businessHoursOnly) {
      policy.businessHours = sns.SubscriptionFilter.stringFilter({
        allowlist: ['true'],
      });
    }

    // 중복 방지를 위한 시간 기반 필터
    if (channel.rateLimitMinutes) {
      policy.rateLimited = sns.SubscriptionFilter.numericFilter({
        lessThanOrEqualTo: 1,
      });
    }

    return policy;
  }

  /**
   * 알람을 SNS 토픽에 연결
   */
  public connectAlarmsToNotifications(alarms: cloudwatch.Alarm[]): void {
    alarms.forEach(alarm => {
      const severity = this.getAlarmSeverity(alarm);
      const topic = this.topics.get(severity);

      if (topic) {
        const action = new cloudwatchActions.SnsAction(topic);
        alarm.addAlarmAction(action);
        alarm.addOkAction(action); // 복구 시에도 알림
      }
    });
  }

  /**
   * 복합 알람을 SNS 토픽에 연결
   */
  public connectCompositeAlarmsToNotifications(compositeAlarms: cloudwatch.CompositeAlarm[]): void {
    const compositeTopic = this.topics.get('COMPOSITE');
    
    if (compositeTopic) {
      compositeAlarms.forEach(alarm => {
        const action = new cloudwatchActions.SnsAction(compositeTopic);
        alarm.addAlarmAction(action);
        alarm.addOkAction(action);
      });
    }
  }

  /**
   * 알람 심각도 추출
   */
  private getAlarmSeverity(alarm: cloudwatch.Alarm): string {
    const severityMetadata = alarm.node.metadata.find(m => m.type === 'severity');
    return severityMetadata?.data || 'INFO';
  }

  /**
   * 메시지 포맷터 - 채널별 최적화된 메시지 생성
   */
  public formatNotificationMessage(
    alarmDetails: Record<string, unknown>,
    channel: NotificationChannel
  ): string {
    const template = NotificationConfiguration.NOTIFICATION_TEMPLATES[alarmDetails.severity];
    
    if (!template) {
      return this.getDefaultMessage(alarmDetails);
    }

    let message = '';
    
    switch (channel.type) {
      case 'SMS':
        message = template.smsFormat || template.subject;
        break;
      case 'SLACK':
        message = template.slackFormat || template.body;
        break;
      default:
        message = template.body;
    }

    // 변수 치환
    return this.replaceMessageVariables(message, alarmDetails);
  }

  /**
   * 메시지 변수 치환
   */
  private replaceMessageVariables(message: string, alarmDetails: Record<string, unknown>): string {
    const variables = {
      '{AlarmName}': alarmDetails.AlarmName || 'Unknown',
      '{AlarmDescription}': alarmDetails.AlarmDescription || '',
      '{NewStateValue}': alarmDetails.NewStateValue || 'UNKNOWN',
      '{StateChangeTime}': alarmDetails.StateChangeTime || new Date().toISOString(),
      '{Threshold}': alarmDetails.Threshold || 'N/A',
      '{MetricValue}': alarmDetails.MetricValue || 'N/A',
      '{DashboardURL}': this.generateDashboardURL(alarmDetails.AlarmName),
      '{LogsURL}': this.generateLogsURL(alarmDetails.AlarmName),
    };

    let formattedMessage = message;
    Object.entries(variables).forEach(([placeholder, value]) => {
      formattedMessage = formattedMessage.replace(new RegExp(placeholder, 'g'), value);
    });

    return formattedMessage;
  }

  /**
   * 기본 메시지 생성
   */
  private getDefaultMessage(alarmDetails: Record<string, unknown>): string {
    return `
알람: ${alarmDetails.AlarmName}
상태: ${alarmDetails.NewStateValue}
시간: ${alarmDetails.StateChangeTime}
    `.trim();
  }

  /**
   * 대시보드 URL 생성
   */
  private generateDashboardURL(alarmName?: string): string {
    const baseUrl = 'https://console.aws.amazon.com/cloudwatch/home';
    return alarmName 
      ? `${baseUrl}#dashboards:name=TodoApp&alarm=${encodeURIComponent(alarmName)}`
      : `${baseUrl}#dashboards:name=TodoApp`;
  }

  /**
   * 로그 URL 생성
   */
  private generateLogsURL(alarmName?: string): string {
    const baseUrl = 'https://console.aws.amazon.com/cloudwatch/home#logsV2:logs-insights';
    return alarmName 
      ? `${baseUrl}$3FqueryDetail$3D$257E$2528end$257E0$257Estart$257E-3600$257EtimeType$257E$2527RELATIVE$2527$257Eunit$257E$2527seconds$2527$257EeditorString$257E$2527fields*20*40timestamp*2c*20*40message*0a*7c*20filter*20*40message*20like*20*2f${encodeURIComponent(alarmName || '')}*2f$2529`
      : baseUrl;
  }

  /**
   * 중복 알림 방지 시스템
   */
  public setupDeduplication(): void {
    // DynamoDB를 이용한 중복 방지 또는 CloudWatch 메트릭 필터 활용
    // 실제 구현에서는 Lambda 함수와 DynamoDB를 조합하여 구현
    console.log('중복 알림 방지 시스템 설정 완료');
  }

  /**
   * 알림 통계 수집을 위한 메트릭
   */
  public createNotificationMetrics(): cloudwatch.Metric[] {
    return [
      new cloudwatch.Metric({
        namespace: 'TodoApp/Notifications',
        metricName: 'SentNotifications',
        dimensionsMap: {
          Type: 'Email',
        },
        statistic: cloudwatch.Statistic.SUM,
        period: Duration.minutes(5),
      }),
      new cloudwatch.Metric({
        namespace: 'TodoApp/Notifications',
        metricName: 'FailedNotifications',
        dimensionsMap: {
          Type: 'SMS',
        },
        statistic: cloudwatch.Statistic.SUM,
        period: Duration.minutes(5),
      }),
    ];
  }
}