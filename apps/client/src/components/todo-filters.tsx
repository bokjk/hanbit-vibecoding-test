import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TodoFilter, FilterType, SortBy, SortOrder } from 'types/index';

interface TodoFiltersProps {
  filter: TodoFilter;
  onFilterChange: (filter: TodoFilter) => void;
  className?: string;
}

interface FilterChipProps {
  label: string;
  icon?: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  count?: number;
}

function FilterChip({ label, icon, isActive, onClick, count }: FilterChipProps) {
  return (
    <Button
      variant={isActive ? 'default' : 'outline'}
      onClick={onClick}
      className={`h-10 px-4 transition-all duration-200 hover:scale-105 ${
        isActive 
          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg border-0' 
          : 'hover:bg-gray-50 border-gray-200'
      }`}
    >
      <div className="flex items-center space-x-2">
        {icon}
        <span className="font-medium">{label}</span>
        {count !== undefined && (
          <span className={`text-xs px-2 py-1 rounded-full ${
            isActive ? 'bg-white/20' : 'bg-gray-100'
          }`}>
            {count}
          </span>
        )}
      </div>
    </Button>
  );
}

export function TodoFilters({ filter, onFilterChange, className = '' }: TodoFiltersProps) {
  const handleFilterTypeChange = (type: FilterType) => {
    onFilterChange({ ...filter, type });
  };

  const handleSortByChange = (sortBy: SortBy) => {
    onFilterChange({ ...filter, sortBy });
  };

  const handleSortOrderChange = (sortOrder: SortOrder) => {
    onFilterChange({ ...filter, sortOrder });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 스마트 필터 칩들 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center">
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
          </svg>
          필터
        </h3>
        
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="전체"
            icon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
            isActive={filter.type === 'all'}
            onClick={() => handleFilterTypeChange('all')}
          />
          
          <FilterChip
            label="진행 중"
            icon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            isActive={filter.type === 'active'}
            onClick={() => handleFilterTypeChange('active')}
          />
          
          <FilterChip
            label="완료됨"
            icon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            isActive={filter.type === 'completed'}
            onClick={() => handleFilterTypeChange('completed')}
          />
        </div>
      </div>

      {/* 우선순위 필터 (새로운 기능) */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center">
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
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
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          정렬
        </h3>
        
        <div className="grid grid-cols-1 gap-3">
          <Select value={filter.sortBy} onValueChange={handleSortByChange}>
            <SelectTrigger className="h-10 bg-white border-gray-200 hover:border-gray-300 focus:border-blue-500 transition-colors">
              <SelectValue placeholder="정렬 기준" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt" className="flex items-center">
                <span className="flex items-center">
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  생성일순
                </span>
              </SelectItem>
              <SelectItem value="priority" className="flex items-center">
                <span className="flex items-center">
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  우선순위순
                </span>
              </SelectItem>
              <SelectItem value="title" className="flex items-center">
                <span className="flex items-center">
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  제목순
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filter.sortOrder} onValueChange={handleSortOrderChange}>
            <SelectTrigger className="h-10 bg-white border-gray-200 hover:border-gray-300 focus:border-blue-500 transition-colors">
              <SelectValue placeholder="정렬 순서" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc" className="flex items-center">
                <span className="flex items-center">
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  내림차순
                </span>
              </SelectItem>
              <SelectItem value="asc" className="flex items-center">
                <span className="flex items-center">
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  오름차순
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
} 