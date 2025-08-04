# 9. 배포 전략 및 인프라

## 9.1 배포 단계별 전략

### 9.1.1 1단계: 프론트엔드 배포 (MVP)

```yaml
# GitHub Actions: .github/workflows/deploy-frontend.yml
name: Deploy Frontend (Stage 1)

on:
  push:
    branches: [main]
    paths: ['apps/client/**']
  
env:
  NODE_VERSION: '18'
  PNPM_VERSION: '8'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}
          
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Build application
        run: |
          cd apps/client
          pnpm build
          
      - name: Run tests
        run: |
          cd apps/client
          pnpm test:ci
          
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./apps/client/dist
          custom_domain: todo-app.example.com
```

### 9.1.2 2단계: AWS 서버리스 배포

```yaml
# GitHub Actions: .github/workflows/deploy-aws.yml
name: Deploy to AWS (Stage 2)

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  AWS_REGION: ap-northeast-2
  NODE_VERSION: '18'
  PNPM_VERSION: '8'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}
          
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Run backend tests
        run: |
          cd apps/server
          pnpm test:ci
          
      - name: Run frontend tests
        run: |
          cd apps/client
          pnpm test:ci

  deploy-infrastructure:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
          
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: 1.6.0
          
      - name: Terraform Init
        run: |
          cd infrastructure
          terraform init
          
      - name: Terraform Plan
        run: |
          cd infrastructure
          terraform plan -out=tfplan
          
      - name: Terraform Apply
        run: |
          cd infrastructure
          terraform apply -auto-approve tfplan

  deploy-backend:
    needs: deploy-infrastructure
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}
          
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Build backend
        run: |
          cd apps/server
          pnpm build
          
      - name: Deploy Lambda functions
        run: |
          cd apps/server
          pnpm deploy

  deploy-frontend:
    needs: deploy-backend
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Build frontend
        env:
          VITE_API_BASE_URL: ${{ secrets.API_BASE_URL }}
          VITE_COGNITO_USER_POOL_ID: ${{ secrets.COGNITO_USER_POOL_ID }}
          VITE_COGNITO_CLIENT_ID: ${{ secrets.COGNITO_CLIENT_ID }}
        run: |
          cd apps/client
          pnpm build
          
      - name: Deploy to S3 and CloudFront
        run: |
          aws s3 sync apps/client/dist s3://${{ secrets.S3_BUCKET_NAME }} --delete
          aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} --paths "/*"
```

## 9.2 인프라스트럭처 (Terraform)

### 9.2.1 메인 인프라 구성

```hcl
# infrastructure/main.tf
terraform {
  required_version = ">= 1.6"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  
  backend "s3" {
    bucket = "todo-app-terraform-state"
    key    = "terraform.tfstate"
    region = "ap-northeast-2"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "todo-app"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# 지역 및 환경 변수
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-northeast-2"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "todo-app.example.com"
}
```

### 9.2.2 DynamoDB 테이블

```hcl
# infrastructure/dynamodb.tf
resource "aws_dynamodb_table" "todos_table" {
  name           = "todos-app-data-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "PK"
  range_key      = "SK"
  
  attribute {
    name = "PK"
    type = "S"
  }
  
  attribute {
    name = "SK"
    type = "S"
  }
  
  attribute {
    name = "GSI1PK"
    type = "S"
  }
  
  attribute {
    name = "GSI1SK"
    type = "S"
  }
  
  global_secondary_index {
    name     = "GSI1"
    hash_key = "GSI1PK"
    range_key = "GSI1SK"
  }
  
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }
  
  point_in_time_recovery {
    enabled = true
  }
  
  tags = {
    Name = "todos-app-data"
  }
}
```

### 9.2.3 Cognito 사용자 풀

```hcl
# infrastructure/cognito.tf
resource "aws_cognito_user_pool" "todo_user_pool" {
  name = "todo-app-users-${var.environment}"
  
  # 사용자 속성
  alias_attributes = ["email"]
  
  # 비밀번호 정책
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }
  
  # 계정 복구 설정
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
  
  # 이메일 설정
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }
  
  # 사용자 풀 도메인
  domain = "todo-app-${var.environment}"
  
  tags = {
    Name = "todo-app-user-pool"
  }
}

resource "aws_cognito_user_pool_client" "todo_app_client" {
  name         = "todo-app-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.todo_user_pool.id
  
  # 인증 플로우
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]
  
  # 토큰 만료 시간
  access_token_validity  = 60    # 1시간
  id_token_validity     = 60    # 1시간
  refresh_token_validity = 30   # 30일
  
  # OAuth 설정
  supported_identity_providers = ["COGNITO"]
  
  callback_urls = [
    "https://${var.domain_name}/auth/callback"
  ]
  
  logout_urls = [
    "https://${var.domain_name}/auth/logout"
  ]
}

resource "aws_cognito_identity_pool" "todo_identity_pool" {
  identity_pool_name               = "todo_app_identity_pool_${var.environment}"
  allow_unauthenticated_identities = true
  
  cognito_identity_providers {
    client_id     = aws_cognito_user_pool_client.todo_app_client.id
    provider_name = aws_cognito_user_pool.todo_user_pool.endpoint
  }
  
  tags = {
    Name = "todo-app-identity-pool"
  }
}
```

### 9.2.4 Lambda 함수

```hcl
# infrastructure/lambda.tf
resource "aws_iam_role" "lambda_execution_role" {
  name = "todo-app-lambda-role-${var.environment}"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_dynamodb_policy" {
  name = "lambda-dynamodb-policy"
  role = aws_iam_role.lambda_execution_role.id
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem"
        ]
        Resource = [
          aws_dynamodb_table.todos_table.arn,
          "${aws_dynamodb_table.todos_table.arn}/*"
        ]
      }
    ]
  })
}

# Lambda functions (예시: getTodos)
resource "aws_lambda_function" "get_todos" {
  filename         = "../apps/server/dist/get-todos.zip"
  function_name    = "todo-app-get-todos-${var.environment}"
  role            = aws_iam_role.lambda_execution_role.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 30
  memory_size     = 256
  
  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.todos_table.name
      NODE_ENV           = var.environment
    }
  }
  
  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy.lambda_dynamodb_policy,
  ]
}
```

### 9.2.5 API Gateway

```hcl
# infrastructure/api-gateway.tf
resource "aws_api_gateway_rest_api" "todo_api" {
  name        = "todo-app-api-${var.environment}"
  description = "Todo App REST API"
  
  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# Cognito Authorizer
resource "aws_api_gateway_authorizer" "cognito_authorizer" {
  name                   = "todo-app-cognito-authorizer"
  rest_api_id           = aws_api_gateway_rest_api.todo_api.id
  type                  = "COGNITO_USER_POOLS"
  identity_source       = "method.request.header.Authorization"
  provider_arns         = [aws_cognito_user_pool.todo_user_pool.arn]
}

# /todos resource
resource "aws_api_gateway_resource" "todos_resource" {
  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  parent_id   = aws_api_gateway_rest_api.todo_api.root_resource_id
  path_part   = "todos"
}

# GET /todos method
resource "aws_api_gateway_method" "get_todos" {
  rest_api_id   = aws_api_gateway_rest_api.todo_api.id
  resource_id   = aws_api_gateway_resource.todos_resource.id
  http_method   = "GET"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito_authorizer.id
}

resource "aws_api_gateway_integration" "get_todos_integration" {
  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  resource_id = aws_api_gateway_resource.todos_resource.id
  http_method = aws_api_gateway_method.get_todos.http_method
  
  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.get_todos.invoke_arn
}

# Lambda permission
resource "aws_lambda_permission" "api_gateway_lambda" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_todos.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.todo_api.execution_arn}/*/*"
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "todo_api_deployment" {
  depends_on = [
    aws_api_gateway_method.get_todos,
    aws_api_gateway_integration.get_todos_integration,
  ]
  
  rest_api_id = aws_api_gateway_rest_api.todo_api.id
  stage_name  = var.environment
}
```

### 9.2.6 CloudFront 및 S3

```hcl
# infrastructure/cloudfront.tf
resource "aws_s3_bucket" "frontend_bucket" {
  bucket = "todo-app-frontend-${var.environment}-${random_id.bucket_suffix.hex}"
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket_website_configuration" "frontend_website" {
  bucket = aws_s3_bucket.frontend_bucket.id
  
  index_document {
    suffix = "index.html"
  }
  
  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_public_access_block" "frontend_bucket_pab" {
  bucket = aws_s3_bucket.frontend_bucket.id
  
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_cloudfront_distribution" "frontend_distribution" {
  origin {
    domain_name = aws_s3_bucket.frontend_bucket.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.frontend_bucket.id}"
    
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.frontend_oai.cloudfront_access_identity_path
    }
  }
  
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  
  aliases = [var.domain_name]
  
  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.frontend_bucket.id}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
    
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
    
    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }
  
  # SPA 지원을 위한 커스텀 에러 페이지
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }
  
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  
  viewer_certificate {
    acm_certificate_arn = aws_acm_certificate.frontend_cert.arn
    ssl_support_method  = "sni-only"
  }
}

resource "aws_cloudfront_origin_access_identity" "frontend_oai" {
  comment = "Todo App Frontend OAI"
}
```

## 9.3 모니터링 및 로깅

### 9.3.1 CloudWatch 설정

```hcl
# infrastructure/monitoring.tf
resource "aws_cloudwatch_log_group" "lambda_logs" {
  for_each = toset([
    "get-todos",
    "create-todo",
    "update-todo",
    "delete-todo"
  ])
  
  name              = "/aws/lambda/todo-app-${each.key}-${var.environment}"
  retention_in_days = 14
}

# API Gateway 로그 그룹
resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/aws/apigateway/todo-app-${var.environment}"
  retention_in_days = 7
}

# CloudWatch 대시보드
resource "aws_cloudwatch_dashboard" "todo_app_dashboard" {
  dashboard_name = "todo-app-${var.environment}"
  
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        
        properties = {
          metrics = [
            ["AWS/Lambda", "Duration", "FunctionName", "todo-app-get-todos-${var.environment}"],
            [".", "Errors", ".", "."],
            [".", "Invocations", ".", "."]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "Lambda Metrics"
        }
      }
    ]
  })
}
```

## 9.4 환경별 배포 설정

### 9.4.1 개발 환경

```hcl
# environments/dev.tfvars
aws_region    = "ap-northeast-2"
environment   = "development"
domain_name   = "dev-todo-app.example.com"
```

### 9.4.2 프로덕션 환경

```hcl
# environments/prod.tfvars
aws_region    = "ap-northeast-2"
environment   = "production"
domain_name   = "todo-app.example.com"
```

## 9.5 출력 값

```hcl
# infrastructure/outputs.tf
output "api_gateway_url" {
  description = "API Gateway URL"
  value       = aws_api_gateway_deployment.todo_api_deployment.invoke_url
}

output "cloudfront_distribution_id" {
  description = "CloudFront Distribution ID"
  value       = aws_cloudfront_distribution.frontend_distribution.id
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID"
  value       = aws_cognito_user_pool.todo_user_pool.id
}

output "cognito_client_id" {
  description = "Cognito Client ID"
  value       = aws_cognito_user_pool_client.todo_app_client.id
}

output "s3_bucket_name" {
  description = "S3 Bucket Name"
  value       = aws_s3_bucket.frontend_bucket.id
}
```

---

**이전**: [보안 설계](08-security.md)  
**다음**: [테스트 전략](10-testing.md)