import { Button, Input } from "@vive/ui";
import { useState } from "react";

interface TodoHeaderProps {
  onSearch?: (query: string) => void;
}

export function TodoHeader({ onSearch }: TodoHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  return (
    <header
      data-testid="todo-header"
      className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-700 text-white shadow-xl"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* 왼쪽: 로고와 제목 */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl shadow-lg">
                <svg
                  className="h-6 w-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                  TaskFlow
                </h1>
                <p className="text-sm text-blue-100 hidden sm:block">
                  생산성을 위한 스마트 할 일 관리
                </p>
              </div>
            </div>
          </div>

          {/* 가운데: 검색 */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-blue-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <Input
                data-testid="search-input"
                type="text"
                placeholder="할 일 검색..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder-blue-200 focus:bg-white/20 focus:border-white/40"
              />
            </div>
          </div>

          {/* 오른쪽: 액션 버튼들과 프로필 */}
          <div className="flex items-center space-x-4">
            {/* 테마 토글 */}
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 p-2 rounded-lg"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            </Button>

            {/* 알림 */}
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 p-2 rounded-lg relative"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-5 5v-5zM11 19H6a2 2 0 01-2-2V7a2 2 0 012-2h5m-1 11a4 4 0 01-4-4V7a4 4 0 014-4h5a4 4 0 014 4v1"
                />
              </svg>
              <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-400 rounded-full"></div>
            </Button>

            {/* 프로필 드롭다운 */}
            <div className="flex items-center space-x-3 bg-white/10 rounded-lg px-3 py-2 hover:bg-white/20 transition-colors cursor-pointer">
              <div className="w-8 h-8 bg-gradient-to-r from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                K
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium">김사용자</p>
                <p className="text-xs text-blue-200">관리자</p>
              </div>
              <svg
                className="h-4 w-4 text-blue-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
