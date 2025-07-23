import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TodoStats } from 'types/index';

interface TodoStatsProps {
  stats: TodoStats;
  className?: string;
}

export function TodoStatsComponent({ stats, className = '' }: TodoStatsProps) {
  return (
    <div className={className}>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">통계</h3>
        
        {/* 모바일용 간단한 통계 */}
        <div className="block md:hidden">
          <div className="flex justify-between text-sm text-gray-600">
            <span>전체: {stats.total}개</span>
            <span>진행중: {stats.active}개</span>
            <span>완료: {stats.completed}개</span>
            <span>{stats.completionRate}%</span>
          </div>
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* 데스크톱용 상세 통계 */}
        <div className="hidden md:block space-y-3">
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>전체:</span>
              <span className="font-medium">{stats.total}개</span>
            </div>
            <div className="flex justify-between">
              <span>진행중:</span>
              <span className="font-medium">{stats.active}개</span>
            </div>
            <div className="flex justify-between">
              <span>완료:</span>
              <span className="font-medium">{stats.completed}개</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">진행률</span>
              <span className="font-medium">{stats.completionRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* 하단 통계 카드 (데스크톱용) */
export function TodoStatsCard({ stats, className = '' }: TodoStatsProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">할 일 통계</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600">전체</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">{stats.active}</div>
            <div className="text-sm text-gray-600">진행중</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-600">완료</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">{stats.completionRate}%</div>
            <div className="text-sm text-gray-600">완료율</div>
          </div>
        </div>
        
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-2">
            <span>전체 진행률</span>
            <span>{stats.completionRate}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 