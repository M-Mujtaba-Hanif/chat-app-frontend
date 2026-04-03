'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { adminApi } from '@/lib/api'
import { User, Group, Pagination } from '@/types'
import Avatar from '@/components/ui/Avatar'
import {
  Shield, Users, MessageSquare, Search, RefreshCw, LogOut,
  CheckCircle, XCircle, Ban, UserCheck, UserX, ChevronLeft, ChevronRight,
  Activity, Home, Wifi, WifiOff, Lock, Unlock
} from 'lucide-react'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'

type AdminTab = 'users' | 'online' | 'groups'
type StatFilter = '' | 'verified' | 'active' | 'blocked' | 'online'
type ActionType = 'block' | 'unblock' | 'verify'

const ACTION_MAP: Record<ActionType, { fn: (id: string) => Promise<any>; label: string; icon: any; color: string; bg: string }> = {
  block:   { fn: adminApi.blockUser,   label: 'Block',   icon: Ban,       color: 'text-red-400',    bg: 'hover:bg-red-500/10' },
  unblock: { fn: adminApi.unblockUser, label: 'Unblock', icon: UserCheck, color: 'text-emerald-400', bg: 'hover:bg-emerald-500/10' },
  verify:  { fn: adminApi.verifyUser,  label: 'Verify',  icon: CheckCircle, color: 'text-brand-400', bg: 'hover:bg-brand-500/10' },
}

interface Stats {
  totalUsers: number; verifiedUsers: number; activeUsers: number
  blockedUsers: number; totalMessages: number; totalGroups: number; onlineCount: number
}

function StatCard({ icon: Icon, label, value, color, sub, active, onClick }: {
  icon: any; label: string; value: number | string; color: string; sub?: string; active?: boolean; onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`glass rounded-2xl p-5 flex items-start gap-4 w-full text-left transition-all ${onClick ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'} ${active ? 'ring-2 ring-brand-500/60' : ''}`}
    >
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center shrink-0`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-slate-500 text-xs">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </button>
  )
}

function Toast({ msg, type }: { msg: string; type: 'success' | 'error' }) {
  return (
    <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium text-white shadow-xl animate-fade-in ${type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
      {type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
      {msg}
    </div>
  )
}

export default function AdminPage() {
  const { user, loading: authLoading, logout } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<AdminTab>('users')
  const [users, setUsers] = useState<User[]>([])
  const [onlineUsers, setOnlineUsers] = useState<User[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [groupsPagination, setGroupsPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 1 })
  const [stats, setStats] = useState<Stats | null>(null)
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 1 })
  const [search, setSearch] = useState('')
  const [groupSearch, setGroupSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statFilter, setStatFilter] = useState<StatFilter>('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) router.push('/auth/login')
  }, [user, authLoading, router])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchStats = useCallback(async () => {
    try {
      const res = await adminApi.getStats()
      setStats(res.data.data)
    } catch { }
  }, [])

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const res = await adminApi.getUsers(page, pagination.limit, debouncedSearch, statFilter)
      setUsers(res.data.data.users)
      setPagination(res.data.data.pagination)
    } catch { }
    finally { setLoading(false) }
  }, [debouncedSearch, pagination.limit, statFilter])

  const fetchOnlineUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.getOnlineUsers()
      setOnlineUsers(res.data.data.users)
    } catch { }
    finally { setLoading(false) }
  }, [])

  const fetchGroups = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const res = await adminApi.getGroups(page, 10, groupSearch)
      setGroups(res.data.data.groups)
      setGroupsPagination(res.data.data.pagination)
    } catch { }
    finally { setLoading(false) }
  }, [groupSearch])

  useEffect(() => { fetchStats() }, [])
  useEffect(() => { if (activeTab === 'users') fetchUsers(1) }, [debouncedSearch, activeTab, statFilter])
  useEffect(() => { if (activeTab === 'online') fetchOnlineUsers() }, [activeTab])
  useEffect(() => { if (activeTab === 'groups') fetchGroups(1) }, [activeTab, groupSearch])

  const handleStatClick = (filter: StatFilter, tab: AdminTab = 'users') => {
    setStatFilter(f => f === filter ? '' : filter)
    setActiveTab(tab)
    setSearch('')
  }

  const handleAction = async (userId: string, action: ActionType) => {
    setActionLoading(`${userId}-${action}`)
    try {
      await ACTION_MAP[action].fn(userId)
      showToast(`User ${action}d successfully`)
      fetchUsers(pagination.page)
      fetchStats()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Action failed', 'error')
    } finally { setActionLoading(null) }
  }

  const handleToggleGroupPrivacy = async (groupId: string, current: boolean) => {
    try {
      await adminApi.updateGroupSettings(groupId, { onlyAdminCanSend: !current })
      showToast(`Group ${!current ? 'restricted to admins only' : 'opened for all members'}`)
      fetchGroups(groupsPagination.page)
    } catch { showToast('Failed to update group setting', 'error') }
  }

  const getActions = (u: User): ActionType[] => {
    const actions: ActionType[] = []
    if (!u.isVerified) actions.push('verify')
    if (u.isActive) actions.push('block')
    else actions.push('unblock')
    return actions
  }

  const handleLogout = async () => { await logout(); router.push('/auth/login') }

  if (authLoading || !user) return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <header className="sticky top-0 z-30 bg-surface-900/90 backdrop-blur border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Admin Panel</h1>
              <p className="text-xs text-slate-500">NexChat Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/chat" className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-all">
              <Home size={13} /> Back to Chat
            </Link>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all">
              <LogOut size={13} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats - equal size, clickable */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
            {[
              { icon: Users, label: 'Total Users', value: stats.totalUsers, color: 'bg-brand-600', filter: '' as StatFilter },
              { icon: Wifi, label: 'Online Now', value: stats.onlineCount, color: 'bg-emerald-600', filter: 'online' as StatFilter, sub: 'Live', tab: 'online' as AdminTab },
              { icon: CheckCircle, label: 'Verified', value: stats.verifiedUsers, color: 'bg-cyan-600', filter: 'verified' as StatFilter },
              { icon: Activity, label: 'Active', value: stats.activeUsers, color: 'bg-violet-600', filter: 'active' as StatFilter },
              { icon: Ban, label: 'Blocked', value: stats.blockedUsers, color: 'bg-red-600', filter: 'blocked' as StatFilter },
              { icon: MessageSquare, label: 'Messages', value: stats.totalMessages, color: 'bg-indigo-600', filter: '' as StatFilter },
              { icon: Users, label: 'Groups', value: stats.totalGroups, color: 'bg-orange-600', filter: '' as StatFilter, tab: 'groups' as AdminTab },
            ].map((s, i) => (
              <StatCard
                key={i}
                icon={s.icon}
                label={s.label}
                value={s.value}
                color={s.color}
                sub={s.sub}
                active={statFilter === s.filter && s.filter !== '' && activeTab === (s.tab || 'users')}
                onClick={s.filter !== '' || s.tab ? () => handleStatClick(s.filter, s.tab || 'users') : undefined}
              />
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-surface-900 p-1 rounded-xl w-fit">
          {([
            { id: 'users' as AdminTab, label: 'All Users', icon: Users },
            { id: 'online' as AdminTab, label: 'Online Now', icon: Wifi },
            { id: 'groups' as AdminTab, label: 'Groups', icon: MessageSquare },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full bg-surface-900 border border-slate-700/60 text-white placeholder-slate-500 text-sm rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-brand-500/50"
                />
              </div>
              {statFilter && (
                <span className="px-3 py-1.5 text-xs bg-brand-500/15 text-brand-400 border border-brand-500/30 rounded-lg flex items-center gap-1.5">
                  Filter: {statFilter}
                  <button onClick={() => setStatFilter('')} className="hover:text-white ml-1">×</button>
                </span>
              )}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                {pagination.total} users
                <button onClick={() => fetchUsers(1)} className="p-1.5 hover:text-white hover:bg-slate-700 rounded-lg transition-all">
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>

            <div className="bg-surface-900 rounded-2xl border border-slate-800/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800/60">
                      {['User', 'Status', 'Role', 'Joined', 'Last Login', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {loading ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
                    ) : users.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-600 text-sm">No users found</td></tr>
                    ) : users.map(u => (
                      <tr key={u.id} className="hover:bg-surface-800/40 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar name={u.name} avatar={u.avatar} size="sm" online={u.isOnlineNow} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-white">{u.name}</p>
                              <p className="text-xs text-slate-500">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col gap-1.5">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit ${u.isActive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/15 text-red-400 border border-red-500/20'}`}>
                              <span className={`w-1 h-1 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                              {u.isActive ? 'Active' : 'Blocked'}
                            </span>
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit ${u.isVerified ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20' : 'bg-slate-700 text-slate-500 border border-slate-600'}`}>
                              {u.isVerified ? <><CheckCircle size={9} /> Verified</> : <><XCircle size={9} /> Unverified</>}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${u.role === 'admin' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-700/60 text-slate-400 border border-slate-600/40'}`}>
                            {u.role === 'admin' && <Shield size={10} />}
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500">
                          {u.createdAt ? format(new Date(u.createdAt), 'MMM d, yyyy') : '-'}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500">
                          {u.lastLogin
                            ? <span title={format(new Date(u.lastLogin), 'MMM d, yyyy HH:mm')}>
                                {formatDistanceToNow(new Date(u.lastLogin), { addSuffix: true })}
                              </span>
                            : <span className="text-slate-700">Never</span>
                          }
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            {getActions(u).map(action => {
                              const { icon: ActionIcon, label, color, bg } = ACTION_MAP[action]
                              const isLoading = actionLoading === `${u.id}-${action}`
                              return (
                                <button
                                  key={action}
                                  onClick={() => handleAction(u.id, action)}
                                  disabled={!!actionLoading}
                                  title={label}
                                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${color} ${bg} border-transparent hover:border-current/20 disabled:opacity-40`}
                                >
                                  {isLoading ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <ActionIcon size={12} />}
                                  {label}
                                </button>
                              )
                            })}
                            {u.role === 'admin' && (
                              <span className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-amber-500/60 border border-amber-500/20 rounded-lg">
                                <Shield size={12} /> Admin
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800/60">
                  <p className="text-xs text-slate-600">
                    Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => fetchUsers(pagination.page - 1)} disabled={pagination.page <= 1} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-700 rounded-lg">
                      <ChevronLeft size={15} />
                    </button>
                    {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => fetchUsers(p)} className={`w-7 h-7 text-xs rounded-lg transition-all ${pagination.page === p ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>{p}</button>
                    ))}
                    <button onClick={() => fetchUsers(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-700 rounded-lg">
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Online Tab */}
        {activeTab === 'online' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">{onlineUsers.length} users online right now</p>
              <button onClick={fetchOnlineUsers} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-surface-800 hover:bg-surface-700 border border-slate-700 rounded-xl transition-all">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
            {onlineUsers.length === 0 ? (
              <div className="bg-surface-900 rounded-2xl border border-slate-800/60 flex flex-col items-center justify-center py-16 text-slate-600">
                <WifiOff size={32} className="mb-3 opacity-40" />
                <p className="text-sm">No users online right now</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {onlineUsers.map(u => (
                  <div key={u.id} className="bg-surface-900 rounded-2xl border border-slate-800/60 p-4 flex items-center gap-3 hover:border-emerald-500/20 transition-all">
                    <Avatar name={u.name} avatar={u.avatar} size="md" online={true} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{u.name}</p>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs text-emerald-500">Online now</span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${u.role === 'admin' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-slate-700/60 text-slate-500 border border-slate-600/40'}`}>
                      {u.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Groups Tab */}
        {activeTab === 'groups' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text" value={groupSearch} onChange={e => setGroupSearch(e.target.value)}
                  placeholder="Search groups..."
                  className="w-full bg-surface-900 border border-slate-700/60 text-white placeholder-slate-500 text-sm rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-brand-500/50"
                />
              </div>
              <div className="text-xs text-slate-500">{groupsPagination.total} groups</div>
            </div>

            <div className="bg-surface-900 rounded-2xl border border-slate-800/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800/60">
                      {['Group', 'Creator', 'Members', 'Created', 'Privacy', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {loading ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
                    ) : groups.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-600 text-sm">No groups found</td></tr>
                    ) : groups.map(g => (
                      <tr key={g.id} className="hover:bg-surface-800/40 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
                              <span className="text-white text-sm font-bold">{g.name[0]}</span>
                            </div>
                            <p className="text-sm font-semibold text-white">{g.name}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {g.Creator ? (
                            <div className="flex items-center gap-2">
                              <Avatar name={g.Creator.name} avatar={g.Creator.avatar} size="xs" />
                              <span className="text-xs text-slate-400">{g.Creator.name}</span>
                            </div>
                          ) : <span className="text-xs text-slate-600">-</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-slate-400">{g.Members?.length || 0} members</span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-500">
                          {format(new Date(g.createdAt), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${g.onlyAdminCanSend ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500/70 border border-emerald-500/20'}`}>
                            {g.onlyAdminCanSend ? <><Lock size={9} /> Admin only</> : <><Unlock size={9} /> Open</>}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => handleToggleGroupPrivacy(g.id, g.onlyAdminCanSend || false)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${g.onlyAdminCanSend ? 'text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20' : 'text-amber-400 hover:bg-amber-500/10 border-amber-500/20'}`}
                          >
                            {g.onlyAdminCanSend ? <><Unlock size={11} /> Open</> : <><Lock size={11} /> Restrict</>}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {groupsPagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800/60">
                  <p className="text-xs text-slate-600">{groupsPagination.total} total groups</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => fetchGroups(groupsPagination.page - 1)} disabled={groupsPagination.page <= 1} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-700 rounded-lg">
                      <ChevronLeft size={15} />
                    </button>
                    <button onClick={() => fetchGroups(groupsPagination.page + 1)} disabled={groupsPagination.page >= groupsPagination.totalPages} className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30 hover:bg-slate-700 rounded-lg">
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
