'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { adminApi } from '@/lib/api'
import { User, Pagination } from '@/types'
import Avatar from '@/components/ui/Avatar'
import {
  Shield, Users, MessageSquare, Search, RefreshCw, LogOut,
  CheckCircle, XCircle, Ban, UserCheck, UserX, ChevronLeft,
  ChevronRight, Activity, TrendingUp, Zap, MoreHorizontal,
  Eye, Home
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

type ActionType = 'block' | 'unblock' | 'verify' | 'activate' | 'deactivate'

const ACTION_MAP: Record<ActionType, { fn: (id: string) => Promise<any>; label: string; color: string }> = {
  block:      { fn: adminApi.blockUser,      label: 'Block',      color: 'text-red-400 hover:bg-red-500/10' },
  unblock:    { fn: adminApi.unblockUser,    label: 'Unblock',    color: 'text-accent-400 hover:bg-accent-500/10' },
  verify:     { fn: adminApi.verifyUser,     label: 'Verify',     color: 'text-brand-400 hover:bg-brand-500/10' },
  activate:   { fn: adminApi.activateUser,   label: 'Activate',   color: 'text-accent-400 hover:bg-accent-500/10' },
  deactivate: { fn: adminApi.deactivateUser, label: 'Deactivate', color: 'text-orange-400 hover:bg-orange-500/10' },
}

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="glass rounded-2xl p-5 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shrink-0`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-slate-500 text-sm">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function Badge({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
      active ? 'bg-accent-500/15 text-accent-400 border border-accent-500/25' : 'bg-red-500/15 text-red-400 border border-red-500/25'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-accent-500' : 'bg-red-500'}`} />
      {label}
    </span>
  )
}

export default function AdminPage() {
  const { user, loading: authLoading, logout } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 1 })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const res = await adminApi.getUsers(page, pagination.limit, debouncedSearch)
      setUsers(res.data.data.users)
      setPagination(res.data.data.pagination)
    } catch {}
    finally { setLoading(false) }
  }, [debouncedSearch, pagination.limit])

  useEffect(() => { fetchUsers(1) }, [debouncedSearch])

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleAction = async (userId: string, action: ActionType) => {
    setActionLoading(`${userId}-${action}`)
    setActiveMenu(null)
    try {
      const { fn, label } = ACTION_MAP[action]
      await fn(userId)
      showToast(`User ${label.toLowerCase()}ed successfully`)
      fetchUsers(pagination.page)
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Action failed', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push('/auth/login')
  }

  const stats = {
    total: pagination.total,
    active: users.filter(u => u.isActive).length,
    verified: users.filter(u => u.isVerified).length,
    blocked: users.filter(u => !u.isActive).length,
  }

  if (authLoading) return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium animate-slide-up
          ${toast.type === 'success'
            ? 'bg-accent-500/15 border-accent-500/30 text-accent-400'
            : 'bg-red-500/15 border-red-500/30 text-red-400'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Sidebar */}
      <div className="fixed left-0 top-0 bottom-0 w-60 bg-surface-900 border-r border-slate-800/60 flex flex-col">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">NexChat Admin</p>
              <p className="text-slate-500 text-xs">Control Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { icon: Activity, label: 'Dashboard', active: true },
            { icon: Users, label: 'Users', active: false },
            { icon: MessageSquare, label: 'Messages', active: false },
          ].map(item => (
            <button key={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${item.active
                  ? 'bg-brand-600/20 border border-brand-500/25 text-brand-300'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}>
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* User + actions */}
        <div className="px-3 py-4 border-t border-slate-800/60 space-y-2">
          <Link href="/chat"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-all">
            <Home size={16} />
            Go to Chat
          </Link>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <LogOut size={16} />
            Sign out
          </button>
          <div className="flex items-center gap-2 px-3 pt-2">
            <Avatar name={user?.name || 'Admin'} size="sm" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-600 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="ml-60 p-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage users and monitor platform activity</p>
          </div>
          <button onClick={() => fetchUsers(pagination.page)}
            className="flex items-center gap-2 px-4 py-2 bg-surface-800 border border-slate-700 text-slate-300 hover:text-white text-sm rounded-xl transition-all hover:border-slate-600">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users} label="Total Users" value={pagination.total} sub="registered accounts" color="bg-gradient-to-br from-brand-500 to-brand-700" />
          <StatCard icon={Activity} label="Active Users" value={stats.active} sub={`of ${users.length} shown`} color="bg-gradient-to-br from-accent-500 to-teal-600" />
          <StatCard icon={CheckCircle} label="Verified" value={stats.verified} sub="email confirmed" color="bg-gradient-to-br from-blue-500 to-cyan-600" />
          <StatCard icon={Ban} label="Blocked" value={stats.blocked} sub="access suspended" color="bg-gradient-to-br from-red-500 to-rose-600" />
        </div>

        {/* Users table */}
        <div className="glass rounded-2xl overflow-hidden">
          {/* Table header */}
          <div className="px-6 py-4 border-b border-slate-800/60 flex items-center justify-between">
            <h2 className="font-semibold text-white">User Management</h2>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search users..."
                className="bg-surface-800 border border-slate-700 text-white placeholder-slate-500 text-sm rounded-xl pl-10 pr-4 py-2 w-64 focus:outline-none focus:border-brand-500/50 transition-all"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800/60">
                  {['User', 'Role', 'Status', 'Verified', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b border-slate-800/40">
                      {[...Array(6)].map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 bg-slate-800 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map(u => (
                    <tr key={u.id} className="border-b border-slate-800/40 hover:bg-surface-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} avatar={u.avatar} size="sm" />
                          <div>
                            <p className="text-sm font-semibold text-white">{u.name}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                          u.role === 'admin'
                            ? 'bg-brand-500/15 text-brand-400 border-brand-500/25'
                            : 'bg-slate-700/50 text-slate-400 border-slate-700'
                        }`}>
                          {u.role === 'admin' ? '👑 Admin' : 'User'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge active={u.isActive} label={u.isActive ? 'Active' : 'Blocked'} />
                      </td>
                      <td className="px-6 py-4">
                        <Badge active={u.isVerified} label={u.isVerified ? 'Verified' : 'Unverified'} />
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-500">
                          {u.createdAt ? format(new Date(u.createdAt), 'MMM d, yyyy') : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative">
                          <button
                            onClick={() => setActiveMenu(activeMenu === u.id ? null : u.id)}
                            className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                            <MoreHorizontal size={16} />
                          </button>
                          {activeMenu === u.id && (
                            <div className="absolute right-0 top-10 z-20 w-44 glass rounded-xl border border-slate-700/60 shadow-xl overflow-hidden">
                              {!u.isVerified && (
                                <ActionBtn label="Verify" icon={CheckCircle} loading={actionLoading === `${u.id}-verify`}
                                  onClick={() => handleAction(u.id, 'verify')} color="text-brand-400 hover:bg-brand-500/10" />
                              )}
                              {u.isActive ? (
                                <>
                                  <ActionBtn label="Block" icon={Ban} loading={actionLoading === `${u.id}-block`}
                                    onClick={() => handleAction(u.id, 'block')} color="text-red-400 hover:bg-red-500/10" />
                                  <ActionBtn label="Deactivate" icon={UserX} loading={actionLoading === `${u.id}-deactivate`}
                                    onClick={() => handleAction(u.id, 'deactivate')} color="text-orange-400 hover:bg-orange-500/10" />
                                </>
                              ) : (
                                <>
                                  <ActionBtn label="Unblock" icon={UserCheck} loading={actionLoading === `${u.id}-unblock`}
                                    onClick={() => handleAction(u.id, 'unblock')} color="text-accent-400 hover:bg-accent-500/10" />
                                  <ActionBtn label="Activate" icon={Zap} loading={actionLoading === `${u.id}-activate`}
                                    onClick={() => handleAction(u.id, 'activate')} color="text-accent-400 hover:bg-accent-500/10" />
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-800/60 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchUsers(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all">
                  <ChevronLeft size={16} />
                </button>
                {[...Array(pagination.totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => fetchUsers(i + 1)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                      pagination.page === i + 1
                        ? 'bg-brand-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}>
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => fetchUsers(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click-outside to close dropdown */}
      {activeMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)} />
      )}
    </div>
  )
}

function ActionBtn({ label, icon: Icon, loading, onClick, color }: {
  label: string; icon: any; loading: boolean; onClick: () => void; color: string
}) {
  return (
    <button onClick={onClick} disabled={loading}
      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-60 ${color}`}>
      {loading
        ? <div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" />
        : <Icon size={15} />}
      {label}
    </button>
  )
}
