import { Button } from "@vive/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@vive/ui";
import type { TodoFilter, FilterType, SortBy, SortOrder } from "@vive/types";
import type {
  FilterHelpers,
  SyncHelpers,
  TodoMetadata,
} from "../hooks/use-todo";

interface TodoFiltersProps {
  filter: FilterHelpers | TodoFilter;
  onFilterChange: FilterHelpers | ((filter: TodoFilter) => void);
  syncHelpers?: SyncHelpers;
  metadata?: TodoMetadata;
  className?: string;
}

interface FilterChipProps {
  label: string;
  icon?: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  count?: number;
}

function FilterChip({
  label,
  icon,
  isActive,
  onClick,
  count,
}: FilterChipProps) {
  const testId = `filter-${label === "전체" ? "all" : label === "진행 중" ? "active" : label === "완료됨" ? "completed" : label.toLowerCase()}`;

  return (
    <Button
      data-testid={testId}
      variant={isActive ? "default" : "outline"}
      onClick={onClick}
      className={`h-10 px-4 transition-all duration-200 hover:scale-105 ${
        isActive
          ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg border-0"
          : "hover:bg-gray-50 border-gray-200"
      }`}
    >
      <div className="flex items-center space-x-2">
        {icon}
        <span className="font-medium">{label}</span>
        {count !== undefined && (
          <span
            className={`text-xs px-2 py-1 rounded-full ${
              isActive ? "bg-white/20" : "bg-gray-100"
            }`}
          >
            {count}
          </span>
        )}
      </div>
    </Button>
  );
}

export function TodoFilters({
  filter,
  onFilterChange,
  syncHelpers,
  metadata,
  className = "",
}: TodoFiltersProps) {
  const isLegacyFilter = typeof onFilterChange === "function";

  const handleFilterTypeChange = (type: FilterType) => {
    if (isLegacyFilter && typeof filter === "object" && "type" in filter) {
      (onFilterChange as (filter: TodoFilter) => void)({ ...filter, type });
    } else if (typeof filter === "object" && "showAll" in filter) {
      const filterHelpers = filter as FilterHelpers;
      switch (type) {
        case "all":
          filterHelpers.showAll();
          break;
        case "active":
          filterHelpers.showActive();
          break;
        case "completed":
          filterHelpers.showCompleted();
          break;
      }
    }
  };

  const handleSortByChange = (sortBy: SortBy) => {
    if (isLegacyFilter && typeof filter === "object" && "sortBy" in filter) {
      (onFilterChange as (filter: TodoFilter) => void)({ ...filter, sortBy });
    } else if (typeof filter === "object" && "sortByCreatedAt" in filter) {
      const filterHelpers = filter as FilterHelpers;
      switch (sortBy) {
        case "createdAt":
          filterHelpers.sortByCreatedAt();
          break;
        case "priority":
          filterHelpers.sortByPriority();
          break;
        case "title":
          filterHelpers.sortByTitle();
          break;
      }
    }
  };

  const handleSortOrderChange = (sortOrder: SortOrder) => {
    if (isLegacyFilter && typeof filter === "object" && "sortOrder" in filter) {
      (onFilterChange as (filter: TodoFilter) => void)({
        ...filter,
        sortOrder,
      });
    } else if (typeof filter === "object" && "sortByCreatedAt" in filter) {
      const filterHelpers = filter as FilterHelpers;
      // 정렬 순서는 메서드 파라미터로 전달
      filterHelpers.sortByCreatedAt(sortOrder);
    }
  };

  // 현재 필터 상태 추출 (레거시 호환성)
  const currentFilter = isLegacyFilter
    ? (filter as TodoFilter)
    : {
        type: "all" as FilterType,
        sortBy: "createdAt" as SortBy,
        sortOrder: "desc" as SortOrder,
      };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 스마트 필터 칩들 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center">
          <svg
            className="h-4 w-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z"
            />
          </svg>
          필터
        </h3>

        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="전체"
            icon={
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            }
            isActive={currentFilter.type === "all"}
            onClick={() => handleFilterTypeChange("all")}
          />

          <FilterChip
            label="진행 중"
            icon={
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            isActive={currentFilter.type === "active"}
            onClick={() => handleFilterTypeChange("active")}
          />

          <FilterChip
            label="완료됨"
            icon={
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            isActive={currentFilter.type === "completed"}
            onClick={() => handleFilterTypeChange("completed")}
          />
        </div>
      </div>

      {/* 우선순위 필터 (새로운 기능) */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center">
          <svg
            className="h-4 w-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          우선순위
        </h3>

        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="긴급"
            icon={<div className="w-3 h-3 bg-red-500 rounded-full"></div>}
            isActive={false}
            onClick={() => {}}
          />

          <FilterChip
            label="보통"
            icon={<div className="w-3 h-3 bg-orange-500 rounded-full"></div>}
            isActive={false}
            onClick={() => {}}
          />

          <FilterChip
            label="낮음"
            icon={<div className="w-3 h-3 bg-green-500 rounded-full"></div>}
            isActive={false}
            onClick={() => {}}
          />
        </div>
      </div>

      {/* 정렬 옵션 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center">
          <svg
            className="h-4 w-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
            />
          </svg>
          정렬
        </h3>

        <div className="grid grid-cols-1 gap-3">
          <Select
            value={currentFilter.sortBy}
            onValueChange={handleSortByChange}
          >
            <SelectTrigger
              data-testid="sort-by-select"
              className="h-10 bg-white border-gray-200 hover:border-gray-300 focus:border-blue-500 transition-colors"
            >
              <SelectValue placeholder="정렬 기준" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt" className="flex items-center">
                <span className="flex items-center">
                  <svg
                    className="h-4 w-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  생성일순
                </span>
              </SelectItem>
              <SelectItem value="priority" className="flex items-center">
                <span className="flex items-center">
                  <svg
                    className="h-4 w-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  우선순위순
                </span>
              </SelectItem>
              <SelectItem value="title" className="flex items-center">
                <span className="flex items-center">
                  <svg
                    className="h-4 w-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                    />
                  </svg>
                  제목순
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={currentFilter.sortOrder}
            onValueChange={handleSortOrderChange}
          >
            <SelectTrigger
              data-testid="sort-order-select"
              className="h-10 bg-white border-gray-200 hover:border-gray-300 focus:border-blue-500 transition-colors"
            >
              <SelectValue placeholder="정렬 순서" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc" className="flex items-center">
                <span className="flex items-center">
                  <svg
                    className="h-4 w-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                  내림차순
                </span>
              </SelectItem>
              <SelectItem value="asc" className="flex items-center">
                <span className="flex items-center">
                  <svg
                    className="h-4 w-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 10l7-7m0 0l7 7m-7-7v18"
                    />
                  </svg>
                  오름차순
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 동기화 상태 섹션 */}
      {syncHelpers && metadata && (
        <div className="space-y-3 pt-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center">
            <svg
              className="h-4 w-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            동기화 상태
          </h3>

          <div className="space-y-2">
            {/* 연결 상태 */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">연결 상태:</span>
              <span
                className={`px-2 py-1 rounded-full ${
                  metadata.isOnline
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {syncHelpers.getConnectionStatusText()}
              </span>
            </div>

            {/* 동기화 상태 */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">동기화:</span>
              <span
                className={`px-2 py-1 rounded-full ${
                  metadata.isSyncing
                    ? "bg-blue-100 text-blue-700"
                    : metadata.hasErrors
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-700"
                }`}
              >
                {syncHelpers.getSyncStatusText()}
              </span>
            </div>

            {/* 대기 중인 작업 */}
            {metadata.pendingOperations > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">대기 중:</span>
                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
                  {metadata.pendingOperations}개 작업
                </span>
              </div>
            )}

            {/* 마지막 동기화 시간 */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">마지막 동기화:</span>
              <span className="text-gray-500">
                {syncHelpers.getLastSyncText()}
              </span>
            </div>
          </div>

          {/* 동기화 액션 버튼 */}
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={syncHelpers.triggerSync}
              disabled={metadata.isSyncing}
              className="w-full h-8 text-xs"
            >
              {metadata.isSyncing ? (
                <>
                  <svg
                    className="animate-spin h-3 w-3 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  동기화 중...
                </>
              ) : (
                <>
                  <svg
                    className="h-3 w-3 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  수동 동기화
                </>
              )}
            </Button>

            {/* 오프라인 모드 토글 */}
            <Button
              size="sm"
              variant={metadata.isOnline ? "outline" : "default"}
              onClick={syncHelpers.toggleOfflineMode}
              className="w-full h-8 text-xs"
            >
              {metadata.isOnline ? (
                <>
                  <svg
                    className="h-3 w-3 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 12h.01M21 12c0 4.971-4.029 9-9 9s-9-4.029-9-9 4.029-9 9-9 9 4.029 9 9z"
                    />
                  </svg>
                  오프라인 모드
                </>
              ) : (
                <>
                  <svg
                    className="h-3 w-3 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                    />
                  </svg>
                  온라인 모드
                </>
              )}
            </Button>

            {/* 에러 정리 버튼 (에러가 있을 때만 표시) */}
            {metadata.hasErrors && (
              <Button
                size="sm"
                variant="destructive"
                onClick={syncHelpers.clearErrors}
                className="w-full h-8 text-xs"
              >
                <svg
                  className="h-3 w-3 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                에러 정리
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
