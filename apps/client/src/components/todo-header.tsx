import { Button } from '@/components/ui/button';

interface TodoHeaderProps {
  onToggleSidebar?: () => void;
  showSidebar?: boolean;
}

export function TodoHeader({ onToggleSidebar, showSidebar = false }: TodoHeaderProps) {
  return (
    <header className="bg-blue-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* 왼쪽: 로고와 햄버거 메뉴 */}
          <div className="flex items-center space-x-4">
            {/* 모바일 햄버거 메뉴 */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden text-white hover:bg-blue-700"
              onClick={onToggleSidebar}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={showSidebar ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
                />
              </svg>
            </Button>

            {/* 로고 */}
            <div className="flex items-center space-x-2">
              <div className="bg-white text-blue-600 p-2 rounded-lg font-bold text-sm">
                TODO
              </div>
              <h1 className="text-xl font-bold hidden sm:block">할 일 관리 시스템</h1>
              <h1 className="text-lg font-bold sm:hidden">할 일 관리</h1>
            </div>
          </div>

          {/* 오른쪽: 사용자 정보 */}
          <div className="flex items-center space-x-4">
            {/* 사용자 아바타 */}
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-medium">
                U
              </div>
              <span className="hidden sm:inline text-sm">사용자</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
} 