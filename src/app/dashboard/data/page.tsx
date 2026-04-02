/**
 * 数据浏览页面
 * 用于查看详细的行为日志数据表格
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  queryLogs,
  getAllUsers,
  getAllNotes,
  type QueryLogsParams,
  type QueryLogsResult,
} from '@/app/actions/analytics'
import type { ActionType, DeviceType, UserBehaviorLog } from '@/lib/types/analytics'

const ACTION_TYPES: ActionType[] = ['view', 'click', 'scroll', 'edit', 'create', 'delete']
const DEVICE_TYPES: DeviceType[] = ['mobile', 'desktop', 'tablet']

export default function DataPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<QueryLogsResult | null>(null)
  const [users, setUsers] = useState<{ user_id: string; count: number }[]>([])
  const [notes, setNotes] = useState<{ note_id: string; count: number }[]>([])

  // 筛选条件
  const [filters, setFilters] = useState<QueryLogsParams>({
    page: 1,
    pageSize: 50,
  })

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [logsResult, usersResult, notesResult] = await Promise.all([
        queryLogs(filters),
        getAllUsers(),
        getAllNotes(),
      ])

      if (logsResult.success && logsResult.data) {
        setData(logsResult.data)
      }

      if (usersResult.success && usersResult.data) {
        setUsers(usersResult.data)
      }

      if (notesResult.success && notesResult.data) {
        setNotes(notesResult.data)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 处理筛选变化
  const handleFilterChange = (key: keyof QueryLogsParams, value: string | number | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1, // 重置到第一页
    }))
  }

  // 处理分页
  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({
      ...prev,
      page: newPage,
    }))
  }

  // 清空筛选
  const clearFilters = () => {
    setFilters({
      page: 1,
      pageSize: 50,
    })
  }

  // 格式化时间戳
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // 获取操作类型颜色
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

  // 获取设备类型图标
  const getDeviceIcon = (device: string) => {
    const icons: Record<string, string> = {
      mobile: '📱',
      desktop: '💻',
      tablet: '📲',
    }
    return icons[device] || '💻'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-slate-600 hover:text-slate-900 transition-colors"
              >
                ← 返回看板
              </Link>
              <h1 className="text-2xl font-bold text-slate-900">数据浏览</h1>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? '加载中...' : '刷新'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 筛选条件 */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">筛选条件</h2>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              清空筛选
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 用户筛选 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                用户
              </label>
              <select
                value={filters.userId || ''}
                onChange={(e) => handleFilterChange('userId', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部用户</option>
                {users.map((user) => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.user_id} ({user.count}条)
                  </option>
                ))}
              </select>
            </div>

            {/* 笔记筛选 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                笔记
              </label>
              <select
                value={filters.noteId || ''}
                onChange={(e) => handleFilterChange('noteId', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部笔记</option>
                {notes.map((note) => (
                  <option key={note.note_id} value={note.note_id}>
                    {note.note_id} ({note.count}条)
                  </option>
                ))}
              </select>
            </div>

            {/* 行为类型 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                行为类型
              </label>
              <select
                value={filters.actionType || ''}
                onChange={(e) => handleFilterChange('actionType', (e.target.value as ActionType) || undefined)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部类型</option>
                {ACTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* 设备类型 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                设备类型
              </label>
              <select
                value={filters.deviceType || ''}
                onChange={(e) => handleFilterChange('deviceType', (e.target.value as DeviceType) || undefined)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部设备</option>
                {DEVICE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 时间范围 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                开始时间
              </label>
              <input
                type="datetime-local"
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value).getTime() : undefined
                  handleFilterChange('startTime', date)
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                结束时间
              </label>
              <input
                type="datetime-local"
                onChange={(e) => {
                  const date = e.target.value ? new Date(e.target.value).getTime() : undefined
                  handleFilterChange('endTime', date)
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 数据统计 */}
        {data && (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-6">
            <div className="flex items-center gap-6 text-sm text-slate-600">
              <span>
                共 <strong className="text-slate-900">{data.total.toLocaleString()}</strong> 条记录
              </span>
              <span>
                当前第 <strong className="text-slate-900">{data.page}</strong> 页
              </span>
              <span>
                每页 <strong className="text-slate-900">{data.pageSize}</strong> 条
              </span>
              {data.hasMore && <span className="text-blue-600">有更多数据</span>}
            </div>
          </div>
        )}

        {/* 数据表格 */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-slate-600">加载中...</div>
            </div>
          ) : data && data.logs.length > 0 ? (
            <>
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
                        笔记
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                        设备
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                        时长
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                        详情
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.logs.map((log, index) => (
                      <tr
                        key={`${log.user_id}-${log.timestamp}-${index}`}
                        className="border-b border-slate-100 hover:bg-blue-50 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm text-slate-700 whitespace-nowrap">
                          {formatTimestamp(log.timestamp)}
                        </td>
                        <td className="py-3 px-4">
                          <Link
                            href={`/dashboard/users/${log.user_id}`}
                            className="text-sm font-mono text-blue-600 hover:text-blue-700 hover:underline"
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
                        <td className="py-3 px-4">
                          {log.note_id ? (
                            <Link
                              href={`/dashboard/notes/${log.note_id}`}
                              className="text-sm font-mono text-slate-700 hover:text-blue-600 hover:underline"
                            >
                              {log.note_id}
                            </Link>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-700">
                          <span className="flex items-center gap-1">
                            <span>{getDeviceIcon(log.device_type)}</span>
                            <span className="capitalize">{log.device_type}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-700">
                          {log.duration_ms ? (
                            <span className="font-mono">{log.duration_ms.toLocaleString()}ms</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-500">
                          {log.metadata ? (
                            <button
                              onClick={() => alert(JSON.stringify(log.metadata, null, 2))}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              查看
                            </button>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
                <button
                  onClick={() => handlePageChange(data.page - 1)}
                  disabled={data.page <= 1}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <span className="text-sm text-slate-600">
                  第 {data.page} 页
                </span>
                <button
                  onClick={() => handlePageChange(data.page + 1)}
                  disabled={!data.hasMore}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-500">
              暂无数据
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
