/**
 * 笔记详情页面
 * 展示单篇笔记的访问统计和用户互动
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { queryLogs } from '@/app/actions/analytics'
import type { UserBehaviorLog } from '@/lib/types/analytics'

export default function NoteDetailPage() {
  const params = useParams()
  const noteId = params.id as string

  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<UserBehaviorLog[]>([])
  const [stats, setStats] = useState<{
    totalViews: number
    uniqueUsers: number
    avgDuration: number
    deviceTypes: Record<string, number>
    actionTypes: Record<string, number>
  } | null>(null)

  useEffect(() => {
    loadNoteData()
  }, [noteId])

  const loadNoteData = async () => {
    setLoading(true)
    try {
      // 查询该笔记的所有日志
      const result = await queryLogs({ noteId, pageSize: 100 })

      if (result.success && result.data) {
        setLogs(result.data.logs)

        // 计算统计信息
        const totalViews = result.data.logs.length
        const uniqueUsers = new Set(result.data.logs.map((log) => log.user_id)).size
        const totalDuration = result.data.logs.reduce(
          (sum, log) => sum + (log.duration_ms || 0),
          0
        )

        const deviceTypes: Record<string, number> = {}
        const actionTypes: Record<string, number> = {}

        result.data.logs.forEach((log) => {
          deviceTypes[log.device_type] = (deviceTypes[log.device_type] || 0) + 1
          actionTypes[log.action_type] = (actionTypes[log.action_type] || 0) + 1
        })

        setStats({
          totalViews,
          uniqueUsers,
          avgDuration: totalViews > 0 ? totalDuration / totalViews : 0,
          deviceTypes,
          actionTypes,
        })
      }
    } catch (error) {
      console.error('Failed to load note data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      view: 'bg-blue-100 text-blue-700',
      click: 'bg-green-100 text-green-700',
      scroll: 'bg-yellow-100 text-yellow-700',
      edit: 'bg-purple-100 text-purple-700',
      create: 'bg-pink-100 text-pink-700',
      delete: 'bg-red-100 text-red-700',
    }
    return colors[action] || 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/data"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                ← 返回数据浏览
              </Link>
              <h1 className="text-2xl font-bold text-slate-900">笔记分析</h1>
            </div>
            <button
              onClick={loadNoteData}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? '加载中...' : '刷新'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-600">加载中...</div>
          </div>
        ) : (
          <>
            {/* 笔记信息卡片 */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                笔记 ID: <span className="font-mono">{noteId}</span>
              </h2>

              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-slate-600">总浏览量</p>
                    <p className="text-2xl font-bold text-blue-700">{stats.totalViews}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-slate-600">独立访客</p>
                    <p className="text-2xl font-bold text-green-700">{stats.uniqueUsers}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-sm text-slate-600">平均停留</p>
                    <p className="text-2xl font-bold text-purple-700">
                      {(stats.avgDuration / 1000).toFixed(1)}s
                    </p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <p className="text-sm text-slate-600">设备类型</p>
                    <p className="text-2xl font-bold text-yellow-700">
                      {Object.keys(stats.deviceTypes).length}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 访问分布 */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">行为类型分布</h3>
                  <div className="space-y-2">
                    {Object.entries(stats.actionTypes).map(([action, count]) => (
                      <div key={action} className="flex items-center justify-between">
                        <span className={`px-2 py-1 text-xs rounded-full ${getActionColor(action)}`}>
                          {action}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{
                                width: `${(count / stats.totalViews) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm text-slate-600 w-8">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">设备类型分布</h3>
                  <div className="space-y-2">
                    {Object.entries(stats.deviceTypes).map(([device, count]) => (
                      <div key={device} className="flex items-center justify-between">
                        <span className="text-sm text-slate-700 capitalize">{device}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{
                                width: `${(count / stats.totalViews) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm text-slate-600 w-8">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 访问记录 */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                访问记录 ({logs.length} 条)
              </h3>

              {logs.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                          时间
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                          用户
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                          行为
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                          设备
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                          时长
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log, index) => (
                        <tr
                          key={index}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          <td className="py-3 px-4 text-sm text-slate-700 whitespace-nowrap">
                            {formatTimestamp(log.timestamp)}
                          </td>
                          <td className="py-3 px-4">
                            <Link
                              href={`/dashboard/users/${log.user_id}`}
                              className="text-sm font-mono text-blue-600 hover:underline"
                            >
                              {log.user_id}
                            </Link>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${getActionColor(
                                log.action_type
                              )}`}
                            >
                              {log.action_type}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-700 capitalize">
                            {log.device_type}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-700">
                            {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">暂无访问记录</div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
