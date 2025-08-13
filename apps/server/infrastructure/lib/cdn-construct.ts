import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

import { Construct } from 'constructs';

export interface CDNConstructProps {
  api: apigateway.RestApi;
  environment: string;
}

/**
 * CDN 및 정적 자산 배포를 위한 CloudFront 구성
 *
 * 주요 기능:
 * - 정적 자산 캐싱 최적화
 * - API 요청 캐싱 정책
 * - 지리적 분산 배포
 * - 보안 헤더 설정
 * - 성능 모니터링
 */
export class CDNConstruct extends Construct {
  public readonly distribution: cloudfront.Distribution;
  public readonly assetsBucket: s3.Bucket;
  public readonly domainName: string;

  constructor(scope: Construct, id: string, props: CDNConstructProps) {
    super(scope, id);

    const { api, environment } = props;

    // 정적 자산용 S3 버킷 생성
    this.assetsBucket = this.createAssetsBucket(environment);

    // CloudFront 분산 생성
    this.distribution = this.createDistribution(api, environment);

    // 도메인 이름 설정
    this.domainName = this.distribution.distributionDomainName;

    // 로깅 및 모니터링 설정
    this.setupMonitoring();

    // 태그 및 출력값 생성
    this.createTags(environment);
    this.createOutputs();
  }

  /**
   * 정적 자산용 S3 버킷 생성
   */
  private createAssetsBucket(environment: string): s3.Bucket {
    return new s3.Bucket(this, 'AssetsBucket', {
      bucketName: `hanbit-todo-assets-${environment}-${cdk.Stack.of(this).region}`,
      // 정적 웹사이트 호스팅 설정
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html',
      // 퍼블릭 읽기 권한 (CloudFront OAI를 통해서만 접근)
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      // CORS 설정
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      // 수명주기 관리 (오래된 버전 자동 삭제)
      lifecycleRules: [
        {
          id: 'delete-old-versions',
          enabled: true,
          noncurrentVersionExpiration: cdk.Duration.days(30),
        },
      ],
      // 환경별 제거 정책
      removalPolicy:
        environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'production',
    });
  }

  /**
   * CloudFront 분산 생성
   */
  private createDistribution(
    api: apigateway.RestApi,
    environment: string
  ): cloudfront.Distribution {
    // Origin Access Identity 생성 (S3 버킷에 안전한 접근)
    const oai = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: `OAI for hanbit-todo ${environment} assets`,
    });

    // S3 버킷에 OAI 권한 부여
    this.assetsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`${this.assetsBucket.bucketArn}/*`],
        principals: [
          new iam.CanonicalUserPrincipal(oai.cloudFrontOriginAccessIdentityS3CanonicalUserId),
        ],
      })
    );

    // 캐시 정책들 정의
    const staticAssetsCachePolicy = this.createStaticAssetsCachePolicy();
    const apiCachePolicy = this.createApiCachePolicy();
    const defaultCachePolicy = this.createDefaultCachePolicy();

    // 응답 헤더 정책 생성
    const securityHeadersPolicy = this.createSecurityHeadersPolicy();

    return new cloudfront.Distribution(this, 'Distribution', {
      comment: `Hanbit TODO App CDN - ${environment}`,

      // 기본 동작 (정적 자산)
      defaultBehavior: {
        origin: new origins.S3Origin(this.assetsBucket, {
          originAccessIdentity: oai,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: defaultCachePolicy,
        responseHeadersPolicy: securityHeadersPolicy,
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },

      // 추가 동작들
      additionalBehaviors: {
        // API 요청 캐싱
        '/api/*': {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: apiCachePolicy,
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
          responseHeadersPolicy: securityHeadersPolicy,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          compress: true,
        },

        // 정적 자산 (이미지, CSS, JS) - 장기 캐싱
        '/assets/*': {
          origin: new origins.S3Origin(this.assetsBucket, {
            originAccessIdentity: oai,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: staticAssetsCachePolicy,
          responseHeadersPolicy: securityHeadersPolicy,
          compress: true,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        },
      },

      // 에러 페이지 설정
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],

      // 성능 설정
      priceClass: this.selectPriceClass(environment),

      // 지리적 제한 (필요시)
      geoRestriction: cloudfront.GeoRestriction.allowlist('US', 'CA', 'KR', 'JP'),

      // HTTP 버전
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,

      // 웹 ACL (추후 WAF 통합시)
      // webAclId: webAcl?.attrArn,

      // 로깅 설정 (프로덕션 환경에서만)
      ...(environment === 'production' && {
        enableLogging: true,
        logBucket: this.createLogBucket(),
        logFilePrefix: 'cloudfront-logs/',
        logIncludesCookies: true,
      }),
    });
  }

  /**
   * 정적 자산용 캐시 정책 생성
   */
  private createStaticAssetsCachePolicy(): cloudfront.CachePolicy {
    return new cloudfront.CachePolicy(this, 'StaticAssetsCachePolicy', {
      cachePolicyName: `hanbit-static-assets-${cdk.Stack.of(this).stackName}`,
      comment: 'Long-term caching for static assets with versioning',
      defaultTtl: cdk.Duration.days(30), // 30일 기본 캐시
      maxTtl: cdk.Duration.days(365), // 최대 1년 캐시
      minTtl: cdk.Duration.days(1), // 최소 1일 캐시

      // 캐시 키에 포함할 요소들
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
        'CloudFront-Viewer-Country',
        'Accept-Encoding'
      ),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList('v'), // 버전 매개변수
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),

      // 압축 활성화
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });
  }

  /**
   * API용 캐시 정책 생성
   */
  private createApiCachePolicy(): cloudfront.CachePolicy {
    return new cloudfront.CachePolicy(this, 'ApiCachePolicy', {
      cachePolicyName: `hanbit-api-cache-${cdk.Stack.of(this).stackName}`,
      comment: 'Short-term caching for API responses',
      defaultTtl: cdk.Duration.minutes(5), // 5분 기본 캐시
      maxTtl: cdk.Duration.hours(1), // 최대 1시간 캐시
      minTtl: cdk.Duration.seconds(0), // 캐시 비활성화 가능

      // API별 적절한 캐시 키 설정
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
        'Authorization',
        'Content-Type',
        'X-Correlation-ID',
        'Accept',
        'Origin'
      ),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      cookieBehavior: cloudfront.CacheCookieBehavior.allowList('session-id'),

      // 압축 비활성화 (API 응답은 이미 압축됨)
      enableAcceptEncodingGzip: false,
      enableAcceptEncodingBrotli: false,
    });
  }

  /**
   * 기본 캐시 정책 생성
   */
  private createDefaultCachePolicy(): cloudfront.CachePolicy {
    return new cloudfront.CachePolicy(this, 'DefaultCachePolicy', {
      cachePolicyName: `hanbit-default-cache-${cdk.Stack.of(this).stackName}`,
      comment: 'Medium-term caching for HTML and other content',
      defaultTtl: cdk.Duration.hours(24), // 24시간 기본 캐시
      maxTtl: cdk.Duration.days(7), // 최대 7일 캐시
      minTtl: cdk.Duration.minutes(1), // 최소 1분 캐시

      headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
        'CloudFront-Viewer-Country',
        'Accept-Encoding',
        'Accept-Language'
      ),
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),

      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });
  }

  /**
   * 보안 헤더 정책 생성
   */
  private createSecurityHeadersPolicy(): cloudfront.ResponseHeadersPolicy {
    return new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeadersPolicy', {
      responseHeadersPolicyName: `hanbit-security-headers-${cdk.Stack.of(this).stackName}`,
      comment: 'Security headers for Hanbit TODO app',

      // 보안 헤더들
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: {
          referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
          override: true,
        },
        strictTransportSecurity: {
          accessControlMaxAge: cdk.Duration.seconds(31536000), // 1년
          includeSubdomains: true,
          preload: true,
          override: true,
        },
      },

      // 커스텀 헤더들
      customHeadersBehavior: {
        customHeaders: [
          {
            header: 'X-Powered-By',
            value: 'Hanbit TODO App',
            override: true,
          },
          {
            header: 'X-Content-Type-Options',
            value: 'nosniff',
            override: true,
          },
          {
            header: 'X-XSS-Protection',
            value: '1; mode=block',
            override: true,
          },
          // CSP 헤더 (환경별로 다르게 설정)
          {
            header: 'Content-Security-Policy',
            value: this.getContentSecurityPolicy(),
            override: true,
          },
        ],
      },

      // CORS 헤더들
      corsHeadersBehavior: {
        accessControlAllowCredentials: false,
        accessControlAllowHeaders: ['*'],
        accessControlAllowMethods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'DELETE'],
        accessControlAllowOrigins: ['*'], // 프로덕션에서는 특정 도메인으로 제한
        accessControlMaxAge: cdk.Duration.seconds(86400), // 24시간
        originOverride: true,
      },
    });
  }

  /**
   * 환경별 Content Security Policy 생성
   */
  private getContentSecurityPolicy(): string {
    const environment = process.env.NODE_ENV || 'development';

    const basePolicy = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // React 개발 모드 지원
      "style-src 'self' 'unsafe-inline'", // Tailwind CSS 지원
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
    ];

    if (environment === 'development') {
      // 개발 환경에서는 느슨한 정책
      basePolicy.push("connect-src 'self' ws: wss: http: https:");
    } else {
      // 프로덕션 환경에서는 엄격한 정책
      basePolicy[1] = "script-src 'self'"; // eval 제거
    }

    return basePolicy.join('; ');
  }

  /**
   * 환경별 가격 클래스 선택
   */
  private selectPriceClass(environment: string): cloudfront.PriceClass {
    switch (environment) {
      case 'production':
        return cloudfront.PriceClass.PRICE_CLASS_ALL; // 전세계 모든 엣지 로케이션
      case 'test':
        return cloudfront.PriceClass.PRICE_CLASS_200; // 대부분 지역
      default:
        return cloudfront.PriceClass.PRICE_CLASS_100; // 미국, 유럽, 아시아 주요 지역
    }
  }

  /**
   * 로그용 S3 버킷 생성
   */
  private createLogBucket(): s3.Bucket {
    return new s3.Bucket(this, 'CloudFrontLogsBucket', {
      bucketName: `hanbit-todo-cloudfront-logs-${cdk.Stack.of(this).region}`,
      lifecycleRules: [
        {
          id: 'delete-old-logs',
          enabled: true,
          expiration: cdk.Duration.days(90), // 90일 후 삭제
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(60),
            },
          ],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
  }

  /**
   * 모니터링 설정
   */
  private setupMonitoring(): void {
    // CloudWatch 메트릭 알람들
    const errorRateAlarm = this.distribution
      .metricErrorRate({
        period: cdk.Duration.minutes(5),
      })
      .createAlarm(this, 'HighErrorRateAlarm', {
        threshold: 5, // 5% 에러율
        evaluationPeriods: 3,
        alarmDescription: 'CloudFront 에러율이 높습니다',
      });

    const cacheHitRateAlarm = this.distribution
      .metricCacheHitRate({
        period: cdk.Duration.minutes(15),
      })
      .createAlarm(this, 'LowCacheHitRateAlarm', {
        threshold: 80, // 80% 미만
        evaluationPeriods: 3,
        comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        alarmDescription: 'CloudFront 캐시 적중률이 낮습니다',
      });

    // 태그 추가
    cdk.Tags.of(errorRateAlarm).add('AlertType', 'ErrorRate');
    cdk.Tags.of(cacheHitRateAlarm).add('AlertType', 'CachePerformance');
  }

  /**
   * 정적 자산 배포
   */
  deployAssets(assetsPath: string): s3deploy.BucketDeployment {
    return new s3deploy.BucketDeployment(this, 'AssetsDeployment', {
      sources: [s3deploy.Source.asset(assetsPath)],
      destinationBucket: this.assetsBucket,
      distribution: this.distribution,
      distributionPaths: ['/*'], // 모든 파일에 대해 무효화

      // 캐시 제어 헤더 설정
      cacheControl: [
        // HTML 파일: 짧은 캐시
        s3deploy.CacheControl.setPublic(),
        s3deploy.CacheControl.maxAge(cdk.Duration.hours(1)),
      ],

      // 메타데이터 설정
      metadata: {
        'Cache-Control': 'public, max-age=31536000', // 정적 자산: 1년 캐시
      },
    });
  }

  /**
   * 태그 생성
   */
  private createTags(environment: string): void {
    cdk.Tags.of(this).add('Component', 'CDN');
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Purpose', 'AssetDelivery');
    cdk.Tags.of(this).add('CostCenter', 'HanbitTodoApp');
  }

  /**
   * 출력값 생성
   */
  private createOutputs(): void {
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });

    new cdk.CfnOutput(this, 'AssetsBucketName', {
      value: this.assetsBucket.bucketName,
      description: 'Assets S3 Bucket Name',
    });
  }
}
