# 스타일링 및 UI 규칙

> **참조 설계 문서**: 
> - [컴포넌트 설계](../docs/design/04-components.md) - UI 컴포넌트 구조, 공통 컴포넌트
> - [문서 개요](../docs/design/01-overview.md) - 기술 스택 (Tailwind CSS, shadcn/ui)

## 🎨 Tailwind CSS

### 기본 원칙
- **Tailwind CSS utility-first 접근법을 사용하세요**
- **절대 필요한 경우가 아니면 커스텀 CSS를 피하세요**
- 모바일 우선 반응형 디자인을 구현하세요
- 일관된 테마를 위해 CSS 변수를 사용하세요

### 설정 참조
- **Tailwind CSS 설정**: 반드시 https://tailwindcss.com/docs/installation/using-vite 공식 문서를 참조하세요

### 반응형 디자인 패턴
```typescript
// ✅ 모바일 우선 접근법
<div className="
  w-full p-4
  md:w-1/2 md:p-6
  lg:w-1/3 lg:p-8
">
  {/* 콘텐츠 */}
</div>
```

## 🧩 shadcn/ui 컴포넌트

### 컴포넌트 활용
- **shadcn/ui 컴포넌트를 적극 활용하세요**
- 컴포넌트 목록: https://ui.shadcn.com/docs/components 참조

### 기본 임포트 패턴
```typescript
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
```

### 사용 가능한 컴포넌트들
- Button
- Card
- Checkbox
- Dialog
- Input
- Select
- Tooltip

## 🎯 디자인 시스템

### 색상과 테마
```css
/* CSS 변수 활용 예시 */
:root {
  --primary: 222.2 84% 4.9%;
  --primary-foreground: 210 40% 98%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
}
```

### 컴포넌트 확장 패턴
```typescript
// ✅ shadcn/ui 컴포넌트 확장
interface CustomButtonProps extends React.ComponentProps<typeof Button> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export function CustomButton({ className, ...props }: CustomButtonProps) {
  return (
    <Button 
      className={cn("custom-styles", className)} 
      {...props} 
    />
  );
}
```

## 📱 반응형 가이드라인
- xs: 모바일 (기본)
- sm: 640px+ (작은 태블릿)
- md: 768px+ (태블릿)
- lg: 1024px+ (데스크톱)
- xl: 1280px+ (큰 데스크톱)

## 🚫 금지 사항
- 인라인 스타일 사용 금지
- !important 사용 최소화
- 커스텀 CSS 클래스 남용 금지
- 색상 하드코딩 금지 (CSS 변수 사용)