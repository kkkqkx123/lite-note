/**
 * Analytics Dashboard Page
 * 数据分析看板页面
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  getTrends,
  getDeviceDistribution,
  getRecentLogs,
  generateTestData,
  checkCassandraStatus,
  aggregateDailyStats,
} from '@/app/actions/analytics'
import type {
  TrendDataPoint,
  DeviceDistribution,
  UserBehaviorLog,
} from '@/lib/types/analytics'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [cassandraStatus, setCassandraStatus] = useState<{
    available: boolean
    enabled: boolean
  }>({ available: false, enabled: false })
  const [trends, setTrends] = useState<TrendDataPoint[]>([])
  const [deviceDistribution, setDeviceDistribution] = useState<DeviceDistribution[]>([])
  const [recentLogs, setRecentLogs] = useState<UserBehaviorLog[]>([])

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 检查Cassandra状态
      const status = await checkCassandraStatus()
      setCassandraStatus(status)

      // 并行加载所有数据
      const [trendsResult, deviceResult, logsResult] = await Promise.all([
        getTrends(),
        getDeviceDistribution(),
        getRecentLogs(20),
      ])

      if (trendsResult.success && trendsResult.data) {
        setTrends(trendsResult.data)
      }

      if (deviceResult.success && deviceResult.data) {
        setDeviceDistribution(deviceResult.data)
      }

      if (logsResult.success && logsResult.data) {
        setRecentLogs(logsResult.data)
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 生成测试数据
  const handleGenerateTestData = async () => {
    setGenerating(true)
    try {
      const result = await generateTestData(10000)
      if (result.success) {
        alert(`成功生成 ${result.generated} 条测试数据！`)
        await loadData()
      } else {
        alert(`生成失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to generate test data:', error)
      alert('生成测试数据失败')
    } finally {
      setGenerating(false)
    }
  }

  // 执行聚合
  const handleAggregate = async () => {
    try {
      const result = await aggregateDailyStats()
      if (result.success) {
        alert('聚合统计完成！')
      } else {
        alert(`聚合失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to aggregate stats:', error)
      alert('聚合统计失败')
    }
  }

  // 计算总阅读量
  const totalViews = trends.reduce((sum, t) => sum + t.count, 0)

  // 计算平均每小时阅读量
  const avgHourlyViews = trends.length > 0 ? totalViews / trends.length : 0

  // 获取主要设备
  const topDevice =
    deviceDistribution.length > 0
      ? deviceDistribution.sort((a, b) => b.count - a.count)[0].device_type
      : 'N/A'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                ← 返回首页
              </Link>
              <h1 className="text-2xl font-bold text-slate-900">数据分析看板</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? '加载中...' : '刷新数据'}
              </button>
              <button
                onClick={handleAggregate}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                执行聚合
              </button>
              <button
                onClick={handleGenerateTestData}
                disabled={generating || !cassandraStatus.enabled}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {generating ? '生成中...' : '生成测试数据'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Cassandra Status */}
        <div className="mb-6 p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${
                cassandraStatus.available
                  ? 'bg-green-500'
                  : cassandraStatus.enabled
                  ? 'bg-red-500'
                  : 'bg-gray-400'
              }`}
            />
            <span className="text-sm text-slate-600">
              Cassandra 状态:{' '}
              <span className="font-medium">
                {!cassandraStatus.enabled
                  ? '已禁用'
                  : cassandraStatus.available
                  ? '已连接'
                  : '未连接'}
              </span>
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-600">加载中...</div>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <MetricCard
                title="总阅读量"
                value={totalViews.toLocaleString()}
                subtitle="过去24小时"
                icon="📊"
              />
              <MetricCard
                title="平均每小时"
                value={avgHourlyViews.toFixed(1)}
                subtitle="阅读量"
                icon="📈"
              />
              <MetricCard
                title="主要设备"
                value={topDevice}
                subtitle="访问设备类型"
                icon="💻"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Trend Chart */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">
                  流量趋势（24小时）
                </h2>
                <TrendChart data={trends} />
              </div>

              {/* Device Distribution */}
              <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">
                  设备分布
                </h2>
                <DeviceChart data={deviceDistribution} />
              </div>
            </div>

            {/* Recent Logs */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                最近活跃记录
              </h2>
              <RecentLogsTable logs={recentLogs} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// Metric Card Component
function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string
  value: string
  subtitle: string
  icon: string
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  )
}

// Trend Chart Component (Simple Bar Chart)
function TrendChart({ data }: { data: TrendDataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-500">
        暂无数据
      </div>
    )
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="h-48 flex items-end gap-1">
      {data.map((point) => (
        <div
          key={point.hour}
          className="flex-1 flex flex-col items-center"
          title={`${point.hour}:00 - ${point.count} 次`}
        >
          <div
            className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all hover:from-blue-600 hover:to-blue-500"
            style={{
              height: `${(point.count / maxCount) * 100}%`,
              minHeight: point.count > 0 ? '4px' : '0px',
            }}
          />
          {point.hour % 6 === 0 && (
            <span className="text-xs text-slate-500 mt-1">{point.hour}:00</span>
          )}
        </div>
      ))}
    </div>
  )
}

// Device Distribution Chart (Simple Pie Chart)
function DeviceChart({ data }: { data: DeviceDistribution[] }) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-500">
        暂无数据
      </div>
    )
  }

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

  return (
    <div className="h-48 flex items-center gap-8">
      {/* Pie Chart */}
      <div className="relative w-48 h-48">
        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
          {data.reduce(
            (acc, item, index) => {
              const startAngle = acc.currentAngle
              const angle = (item.percentage / 100) * 360
              const endAngle = startAngle + angle

              const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180)
              const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180)
              const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180)
              const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180)

              const largeArc = angle > 180 ? 1 : 0

              const path =
                angle >= 360
                  ? `M 50 10 A 40 40 0 1 1 49.9 10 Z`
                  : `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`

              acc.paths.push(
                <path
                  key={item.device_type}
                  d={path}
                  fill={colors[index % colors.length]}
                  className="hover:opacity-80 transition-opacity"
                />
              )

              acc.currentAngle = endAngle
              return acc
            },
            { paths: [] as React.ReactNode[], currentAngle: 0 }
          ).paths}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-2">
        {data.map((item, index) => (
          <div key={item.device_type} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: colors[index % colors.length] }}
            />
            <span className="text-sm text-slate-700 flex-1">
              {item.device_type}
            </span>
            <span className="text-sm font-medium text-slate-900">
              {item.percentage.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-500">({item.count})</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Recent Logs Table
function RecentLogsTable({ logs }: { logs: UserBehaviorLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-slate-500">
        暂无数据
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
              时间
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
              用户
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
              行为
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
              笔记
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
              设备
            </th>
            <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">
              时长
            </th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, index) => (
            <tr
              key={`${log.user_id}-${log.timestamp}-${index}`}
              className="border-b border-slate-100 hover:bg-slate-50"
            >
              <td className="py-3 px-4 text-sm text-slate-700">
                {new Date(log.timestamp).toLocaleString('zh-CN')}
              </td>
              <td className="py-3 px-4 text-sm text-slate-700 font-mono">
                {log.user_id}
              </td>
              <td className="py-3 px-4">
                <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                  {log.action_type}
                </span>
              </td>
              <td className="py-3 px-4 text-sm text-slate-700 font-mono">
                {log.note_id || '-'}
              </td>
              <td className="py-3 px-4 text-sm text-slate-700">
                {log.device_type}
              </td>
              <td className="py-3 px-4 text-sm text-slate-700">
                {log.duration_ms ? `${log.duration_ms}ms` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
