import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as waf from 'aws-cdk-lib/aws-wafv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { BaseStack } from './base-stack';
import { EnvironmentConfig } from '../../config/environment';

/**
 * 네트워크 및 보안 스택
 * VPC, WAF, Secrets 관리를 포함한 보안 인프라
 */
export class NetworkSecurityStack extends BaseStack {
  public readonly vpc?: ec2.Vpc;
  public readonly webAcl?: waf.CfnWebACL;
  public readonly secretsKey: kms.Key;
  public readonly jwtSecret: secretsmanager.Secret;
  public readonly apiKeysSecret: secretsmanager.Secret;

  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps & { environmentConfig: EnvironmentConfig }
  ) {
    super(scope, id, props);

    // VPC 생성 (프로덕션/테스트만)
    if (this.isProd || this.isTest) {
      this.vpc = this.createVpc();
    }

    // WAF 설정 (프로덕션만)
    if (this.isProd) {
      this.webAcl = this.createWebAcl();
    }

    // Secrets 관리
    this.secretsKey = this.createSecretsKey();
    this.jwtSecret = this.createJwtSecret();
    this.apiKeysSecret = this.createApiKeysSecret();

    // IAM 정책 생성
    this.createIamPolicies();

    // 네트워크 보안 그룹 설정
    if (this.vpc) {
      this.setupNetworkSecurity();
    }

    // 출력값 생성
    this.createOutputs();
  }

  /**
   * VPC 생성
   */
  private createVpc(): ec2.Vpc {
    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: this.resourceName('hanbit-vpc'),
      maxAzs: this.isProd ? 3 : 2, // 프로덕션: 3개 AZ, 테스트: 2개 AZ
      natGateways: this.isProd ? 2 : 1, // 프로덕션: 고가용성, 테스트: 비용 절감

      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        // 프로덕션만 격리된 서브넷 추가
        ...(this.isProd
          ? [
              {
                cidrMask: 24,
                name: 'Isolated',
                subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
              },
            ]
          : []),
      ],

      // VPC 플로우 로그 (프로덕션/테스트)
      flowLogs: {
        default: {
          destination: ec2.FlowLogDestination.toCloudWatchLogs(),
          trafficType: ec2.FlowLogTrafficType.ALL,
        },
      },
    });

    // VPC 엔드포인트 생성 (비용 절감 및 보안 강화)
    this.createVpcEndpoints(vpc);

    return vpc;
  }

  /**
   * VPC 엔드포인트 생성
   */
  private createVpcEndpoints(vpc: ec2.Vpc): void {
    // S3 게이트웨이 엔드포인트 (무료)
    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
    });

    // DynamoDB 게이트웨이 엔드포인트 (무료)
    vpc.addGatewayEndpoint('DynamoDBEndpoint', {
      service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
      subnets: [{ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }],
    });

    // 프로덕션만 추가 인터페이스 엔드포인트
    if (this.isProd) {
      // Secrets Manager 엔드포인트
      vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      });

      // KMS 엔드포인트
      vpc.addInterfaceEndpoint('KmsEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.KMS,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      });

      // Lambda 엔드포인트
      vpc.addInterfaceEndpoint('LambdaEndpoint', {
        service: ec2.InterfaceVpcEndpointAwsService.LAMBDA,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      });
    }
  }

  /**
   * WAF Web ACL 생성
   */
  private createWebAcl(): waf.CfnWebACL {
    const webAcl = new waf.CfnWebACL(this, 'WebAcl', {
      name: this.resourceName('hanbit-waf'),
      scope: 'REGIONAL',
      defaultAction: { allow: {} },

      rules: [
        // Rate limiting 규칙
        {
          name: 'RateLimitRule',
          priority: 1,
          statement: {
            rateBasedStatement: {
              aggregateKeyType: 'IP',
              limit: this.isProd ? 2000 : 500, // 5분당 요청 수
            },
          },
          action: { block: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'RateLimitRule',
          },
        },
        // SQL 인젝션 방지
        {
          name: 'SqlInjectionRule',
          priority: 2,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesSQLiRuleSet',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'SqlInjectionRule',
          },
        },
        // 알려진 악성 IP 차단
        {
          name: 'IpReputationRule',
          priority: 3,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesAmazonIpReputationList',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'IpReputationRule',
          },
        },
        // 크로스 사이트 스크립팅 방지
        {
          name: 'XssRule',
          priority: 4,
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          overrideAction: { none: {} },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: 'XssRule',
          },
        },
      ],

      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'HanbitWafMetric',
      },
    });

    // WAF 로깅 설정
    cdk.Tags.of(webAcl).add('waf:logging:enabled', 'true');

    return webAcl;
  }

  /**
   * Secrets 암호화 키 생성
   */
  private createSecretsKey(): kms.Key {
    return new kms.Key(this, 'SecretsKey', {
      alias: this.resourceName('hanbit-secrets-key'),
      description: `KMS key for secrets encryption in ${this.config.name}`,
      enableKeyRotation: this.isProd, // 프로덕션만 키 로테이션
      removalPolicy: this.getRemovalPolicy(),

      keyPolicy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            sid: 'Enable IAM User Permissions',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            sid: 'Allow use of the key for Secrets Manager',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ServicePrincipal('secretsmanager.amazonaws.com')],
            actions: ['kms:Decrypt', 'kms:DescribeKey', 'kms:GenerateDataKey'],
            resources: ['*'],
          }),
        ],
      }),
    });
  }

  /**
   * JWT Secret 생성
   */
  private createJwtSecret(): secretsmanager.Secret {
    return new secretsmanager.Secret(this, 'JwtSecret', {
      secretName: this.resourceName('hanbit-jwt-secret'),
      description: `JWT signing secret for ${this.config.name}`,
      encryptionKey: this.secretsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: 'secret',
        passwordLength: this.isProd ? 64 : 32,
        excludeCharacters: ' \t\n\\',
      },
      removalPolicy: this.getRemovalPolicy(),
    });
  }

  /**
   * API Keys Secret 생성
   */
  private createApiKeysSecret(): secretsmanager.Secret {
    return new secretsmanager.Secret(this, 'ApiKeysSecret', {
      secretName: this.resourceName('hanbit-api-keys'),
      description: `API keys for ${this.config.name}`,
      encryptionKey: this.secretsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          internal: '',
          external: '',
          monitoring: '',
        }),
        generateStringKey: 'internal',
        passwordLength: 32,
        excludeCharacters: ' \t\n\\',
      },
      removalPolicy: this.getRemovalPolicy(),
    });
  }

  /**
   * IAM 정책 생성
   */
  private createIamPolicies(): void {
    // 개발자 액세스 정책 (개발/테스트만)
    if (this.isDev || this.isTest) {
      new iam.ManagedPolicy(this, 'DeveloperAccessPolicy', {
        managedPolicyName: this.resourceName('hanbit-developer-access'),
        description: `Developer access policy for ${this.config.name}`,
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'logs:DescribeLogGroups',
              'logs:DescribeLogStreams',
              'logs:GetLogEvents',
              'cloudwatch:GetMetricData',
              'cloudwatch:GetMetricStatistics',
              'xray:GetTraceGraph',
              'xray:GetTraceSummaries',
            ],
            resources: ['*'],
          }),
        ],
      });
    }

    // 운영 팀 액세스 정책 (프로덕션만)
    if (this.isProd) {
      new iam.ManagedPolicy(this, 'OperationsAccessPolicy', {
        managedPolicyName: this.resourceName('hanbit-operations-access'),
        description: 'Operations team access policy for production',
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'cloudwatch:DescribeAlarms',
              'cloudwatch:GetMetricData',
              'logs:FilterLogEvents',
              'dynamodb:DescribeTable',
              'lambda:GetFunction',
              'lambda:ListFunctions',
            ],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.DENY,
            actions: ['dynamodb:DeleteTable', 'lambda:DeleteFunction', 'kms:ScheduleKeyDeletion'],
            resources: ['*'],
          }),
        ],
      });
    }
  }

  /**
   * 네트워크 보안 설정
   */
  private setupNetworkSecurity(): void {
    if (!this.vpc) return;

    // 기본 보안 그룹 생성
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: this.resourceName('hanbit-lambda-sg'),
      description: `Lambda security group for ${this.config.name}`,
      allowAllOutbound: false, // 명시적 아웃바운드 규칙 설정
    });

    // HTTPS 아웃바운드만 허용
    lambdaSecurityGroup.addEgressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS outbound'
    );

    // DynamoDB 포트 허용 (VPC 엔드포인트 통신)
    lambdaSecurityGroup.addEgressRule(
      ec2.Peer.ipv4(this.vpc.vpcCidrBlock),
      ec2.Port.tcp(443),
      'Allow DynamoDB via VPC endpoint'
    );

    // 프로덕션: 추가 보안 그룹
    if (this.isProd) {
      const adminSecurityGroup = new ec2.SecurityGroup(this, 'AdminSecurityGroup', {
        vpc: this.vpc,
        securityGroupName: this.resourceName('hanbit-admin-sg'),
        description: 'Admin access security group for production',
      });

      // 특정 IP 범위에서만 접근 허용 (예: 회사 IP)
      const adminIpRanges = process.env.ADMIN_IP_RANGES?.split(',') || [];
      adminIpRanges.forEach(ipRange => {
        adminSecurityGroup.addIngressRule(
          ec2.Peer.ipv4(ipRange),
          ec2.Port.tcp(443),
          `Allow HTTPS from ${ipRange}`
        );
      });
    }
  }

  /**
   * 출력값 생성
   */
  private createOutputs(): void {
    if (this.vpc) {
      this.createOutput('VpcId', this.vpc.vpcId, 'VPC ID');
      this.createOutput('VpcCidr', this.vpc.vpcCidrBlock, 'VPC CIDR block');
    }

    if (this.webAcl) {
      this.createOutput('WebAclArn', this.webAcl.attrArn, 'WAF Web ACL ARN');
    }

    this.createOutput('SecretsKeyArn', this.secretsKey.keyArn, 'Secrets KMS key ARN');
    this.createOutput('JwtSecretArn', this.jwtSecret.secretArn, 'JWT secret ARN');
    this.createOutput('ApiKeysSecretArn', this.apiKeysSecret.secretArn, 'API keys secret ARN');

    // 보안 설정 요약
    this.createOutput(
      'SecurityLevel',
      this.isProd ? 'HIGH' : this.isTest ? 'MEDIUM' : 'BASIC',
      'Security configuration level'
    );
  }
}
