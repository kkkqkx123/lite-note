/**
 * Analytics Types
 * 数据分析相关类型定义
 */

// 行为类型
export type ActionType = 'view' | 'click' | 'scroll' | 'edit' | 'create' | 'delete'

// 设备类型
export type DeviceType = 'mobile' | 'desktop' | 'tablet'

// 用户行为日志
export interface UserBehaviorLog {
  user_id: string
  timestamp: number
  note_id?: string
  action_type: ActionType
  duration_ms?: number
  device_type: DeviceType
  metadata?: Record<string, unknown>
}

// 写入日志的输入
export interface LogBehaviorInput {
  userId: string
  noteId?: string
  actionType: ActionType
  durationMs?: number
  deviceType?: DeviceType
  metadata?: Record<string, unknown>
}

// 每日聚合统计
export interface DailyAggregatedStats {
  date: string
  total_views: number
  avg_duration: number
  top_device: string
  mobile_views: number
  desktop_views: number
  updated_at: number
}

// 趋势数据点
export interface TrendDataPoint {
  hour: number
  count: number
}

// 设备分布数据
export interface DeviceDistribution {
  device_type: string
  count: number
  percentage: number
}

// 用户轨迹
export interface UserTrack {
  timestamp: number
  action_type: string
  note_id?: string
  duration_ms?: number
  metadata?: Record<string, unknown>
}

// 分析看板数据
export interface DashboardData {
  totalViews: number
  avgDuration: number
  activeUsers: number
  trends: TrendDataPoint[]
  deviceDistribution: DeviceDistribution[]
  recentLogs: UserBehaviorLog[]
}
