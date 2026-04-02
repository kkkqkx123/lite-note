/**
 * 用户详情页面
 * 展示单个用户的行为轨迹和统计信息
 */

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getUserTracks, getUserStats } from '@/app/actions/analytics'
import type { UserTrack } from '@/lib/types/analytics'

export default function UserDetailPage() {
  const params = useParams()
  const userId = params.id as string

  const [loading, setLoading] = useState(true)
  const [tracks, setTracks] = useState<UserTrack[]>([])
  const [stats, setStats] = useState<{
    totalActions: number
    actionTypes: Record<string, number>
    deviceTypes: Record<string, number>
    totalDuration: number
    avgDuration: number
  } | null>(null)

  useEffect(() => {
    loadUserData()
  }, [userId])

  const loadUserData = async () => {
    setLoading(true)
    try {
      const [tracksResult, statsResult] = await Promise.all([
        getUserTracks(userId, 100),
        getUserStats(userId),
      ])

      if (tracksResult.success && tracksResult.data) {
        setTracks(tracksResult.data)
      }

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data)
      }
    } catch (error) {
      console.error('Failed to load user data:', error)
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
              <h1 className="text-2xl font-bold text-slate-900">用户详情</h1>
            </div>
            <button
              onClick={loadUserData}
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
            {/* 用户信息卡片 */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                用户: <span className="font-mono">{userId}</span>
              </h2>

              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-600">总行为数</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.totalActions}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-600">总时长</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {(stats.totalDuration / 1000).toFixed(1)}s
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-600">平均时长</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {(stats.avgDuration / 1000).toFixed(1)}s
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-600">行为类型</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {Object.keys(stats.actionTypes).length}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 行为分布 */}
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
                                width: `${(count / stats.totalActions) * 100}%`,
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
                                width: `${(count / stats.totalActions) * 100}%`,
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

            {/* 行为时间线 */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">行为时间线</h3>

              {tracks.length > 0 ? (
                <div className="space-y-4">
                  {tracks.map((track, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg"
                    >
                      <div className="text-sm text-slate-500 w-40">
                        {formatTimestamp(track.timestamp)}
                      </div>
                      <div className="flex-1">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${getActionColor(
                            track.action_type
                          )}`}
                        >
                          {track.action_type}
                        </span>
                        {track.note_id && (
                          <Link
                            href={`/dashboard/notes/${track.note_id}`}
                            className="ml-2 text-sm font-mono text-blue-600 hover:underline"
                          >
                            {track.note_id}
                          </Link>
                        )}
                        {track.duration_ms && (
                          <span className="ml-2 text-sm text-slate-500">
                            时长: {(track.duration_ms / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">暂无行为记录</div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
