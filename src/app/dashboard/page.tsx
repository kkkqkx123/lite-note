/**
 * Analytics Dashboard Page
 * 数据分析看板页面
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  getRecentLogs,
  generateTestData,
  checkCassandraStatus,
  aggregateDailyStats,
  getCassandraHealth,
  cleanupCassandraData,
  getDashboardStats,
} from '@/app/actions/analytics'
import type {
  TrendDataPoint,
  DeviceDistribution,
  UserBehaviorLog,
} from '@/lib/types/analytics'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [cassandraStatus, setCassandraStatus] = useState<{
    available: boolean
    enabled: boolean
  }>({ available: false, enabled: false })
  const [healthDetails, setHealthDetails] = useState<{
    keyspaceReady: boolean
    tables: { userBehaviorLogs: boolean; dailyAggregatedStats: boolean }
    latency: number
  } | null>(null)

  // 统计数据
  const [totalRecords, setTotalRecords] = useState(0)
  const [last24HoursTotal, setLast24HoursTotal] = useState(0)
  const [avgPerHour, setAvgPerHour] = useState(0)
  const [trends, setTrends] = useState<TrendDataPoint[]>([])
  const [deviceDistribution, setDeviceDistribution] = useState<DeviceDistribution[]>([])
  const [topDevice, setTopDevice] = useState('N/A')
  const [recentLogs, setRecentLogs] = useState<UserBehaviorLog[]>([])

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // 检查Cassandra状态
      const status = await checkCassandraStatus()
      setCassandraStatus(status)

      // 获取详细健康状态
      if (status.enabled) {
        const healthResult = await getCassandraHealth()
        if (healthResult.success && healthResult.status) {
          setHealthDetails({
            keyspaceReady: healthResult.status.keyspaceReady,
            tables: healthResult.status.tables,
            latency: healthResult.status.latency,
          })
        }
      }

      // 使用新的统一统计API获取准确数据
      const [statsResult, logsResult] = await Promise.all([
        getDashboardStats(),
        getRecentLogs(20),
      ])

      if (statsResult.success && statsResult.data) {
        setTotalRecords(statsResult.data.totalRecords)
        setLast24HoursTotal(statsResult.data.last24Hours.total)
        setAvgPerHour(statsResult.data.last24Hours.avgPerHour)
        setTrends(statsResult.data.last24Hours.trends)
        setDeviceDistribution(statsResult.data.deviceDistribution)
        setTopDevice(statsResult.data.topDevice)
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

  // 生成测试数据（限制数量，大量数据请使用脚本）
  const handleGenerateTestData = async () => {
    setGenerating(true)
    try {
      // 界面只生成少量数据，大量数据推荐使用脚本
      const result = await generateTestData(100)
      if (result.success) {
        alert(`成功生成 ${result.generated} 条测试数据！\n\n需要生成更多数据请运行:\nnpx tsx scripts/seed-cassandra.ts 5000`)
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
        alert(`聚合统计完成！今日浏览量: ${result.stats?.totalViews || 0}`)
      } else {
        alert(`聚合失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to aggregate stats:', error)
      alert('聚合统计失败')
    }
  }

  // 清理测试数据
  const handleCleanupData = async () => {
    if (!confirm('确定要清理所有测试数据吗？此操作不可恢复。')) {
      return
    }

    setCleaning(true)
    try {
      const result = await cleanupCassandraData()
      if (result.success) {
        alert(`成功清理 ${result.deletedRows} 条测试数据！`)
        await loadData()
      } else {
        alert(`清理失败: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to cleanup data:', error)
      alert('清理数据失败')
    } finally {
      setCleaning(false)
    }
  }

  // 统计数据现在直接从 API 获取，不需要前端计算

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
              <Link
                href="/dashboard/data"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                数据浏览
              </Link>
              <button
                onClick={loadData}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? '加载中...' : '刷新数据'}
              </button>
              <button
                onClick={handleAggregate}
                disabled={!cassandraStatus.available}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                执行聚合
              </button>
              <button
                onClick={handleGenerateTestData}
                disabled={generating || !cassandraStatus.available}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {generating ? '生成中...' : '生成测试数据'}
              </button>
              <button
                onClick={handleCleanupData}
                disabled={cleaning || !cassandraStatus.available}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {cleaning ? '清理中...' : '清理数据'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Cassandra Status */}
        <div className="mb-6 p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
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
            {healthDetails && cassandraStatus.available && (
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${healthDetails.keyspaceReady ? 'bg-green-400' : 'bg-red-400'}`} />
                  Keyspace
                </span>
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${healthDetails.tables.userBehaviorLogs ? 'bg-green-400' : 'bg-red-400'}`} />
                  日志表
                </span>
                <span className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${healthDetails.tables.dailyAggregatedStats ? 'bg-green-400' : 'bg-red-400'}`} />
                  统计表
                </span>
                <span>延迟: {healthDetails.latency}ms</span>
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-600">加载中...</div>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <MetricCard
                title="总记录数"
                value={totalRecords.toLocaleString()}
                subtitle="累计"
                icon="🗄️"
              />
              <MetricCard
                title="24小时阅读"
                value={last24HoursTotal.toLocaleString()}
                subtitle="过去24小时"
                icon="📊"
              />
              <MetricCard
                title="平均每小时"
                value={avgPerHour.toLocaleString()}
                subtitle="过去24小时"
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

// Trend Chart Component (Simple Bar Chart with values)
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
    <div className="flex flex-col">
      {/* 图表区域 */}
      <div className="h-44 flex gap-1">
        {data.map((point) => {
          const heightPercentage = (point.count / maxCount) * 100
          const barHeight = Math.max(heightPercentage, point.count > 0 ? 4 : 0)
          const showValueInside = heightPercentage > 20 && point.count > 0

          return (
            <div
              key={point.hour}
              className="flex-1 flex flex-col items-center group relative h-full"
              title={`${point.hour}:00 - ${point.count} 次`}
            >
              {/* 数值显示（柱子上方） */}
              {point.count > 0 && (
                <span
                  className={`text-xs font-medium text-slate-700 mb-1 transition-all group-hover:font-bold group-hover:text-blue-600 ${
                    showValueInside ? 'absolute -top-5 z-10' : 'relative flex-shrink-0'
                  }`}
                >
                  {point.count}
                </span>
              )}
              
              {/* 图表区域（固定高度） */}
              <div className="flex-1 w-full relative min-h-0">
                {/* 柱状条（绝对定位，从底部向上） */}
                <div
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all hover:from-blue-600 hover:to-blue-500 hover:shadow-lg"
                  style={{
                    height: `${barHeight}%`,
                    minHeight: point.count > 0 ? '4px' : '0px',
                  }}
                >
                  {/* 内部数值（仅当柱子足够高时显示） */}
                  {showValueInside && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      {point.count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 时间标签（独立的一行） */}
      <div className="flex gap-1 mt-1">
        {data.map((point) => (
          <div
            key={`label-${point.hour}`}
            className="flex-1 flex justify-center"
          >
            {point.hour % 3 === 0 && (
              <span className="text-xs text-slate-500">
                {point.hour}:00
              </span>
            )}
          </div>
        ))}
      </div>
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
