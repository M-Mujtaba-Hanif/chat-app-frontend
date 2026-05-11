'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { adminApi } from '@/lib/api'
import { User, Group, Pagination } from '@/types'
import Avatar from '@/components/ui/Avatar'
import { cn, formatLastSeen } from '@/lib/utils'
import {
  Shield, Users, MessageSquare, Search, RefreshCw, LogOut,
  CheckCircle, XCircle, Ban, UserCheck, ChevronLeft, ChevronRight,
  Activity, Home, Wifi, WifiOff, Lock, Unlock, FileText, Eye,
  TrendingUp, Zap, BarChart3, AlertCircle, Send, Image, FileIcon,
  Volume2, CheckCheck, Check,
} from 'lucide-react'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { OrbitalLoader } from '@/components/ui/PremiumLoader'

type AdminTab = 'overview' | 'users' | 'groups' | 'monitor' | 'audit'
type StatFilter = '' | 'verified' | 'active' | 'blocked' | 'online'
type ActionType = 'block' | 'unblock' | 'verify'

const ACTION_MAP: Record<ActionType, { fn: (id: string) => Promise<any>; label: string; icon: any; color: string }> = {
  block:   { fn: adminApi.blockUser,   label: 'Block',   icon: Ban,        color: 'text-destructive' },
  unblock: { fn: adminApi.unblockUser, label: 'Unblock', icon: UserCheck,  color: 'text-accent' },
  verify:  { fn: adminApi.verifyUser,  label: 'Verify',  icon: CheckCircle, color: 'text-primary' },
}

interface Stats {
  totalUsers: number; verifiedUsers: number; activeUsers: number
  blockedUsers: number; totalMessages: number; totalGroups: number; onlineCount: number
}
interface AuditEntry { id: string; userId?: string; action: string; ip?: string; meta?: any; createdAt: string }
interface MonitorMessage { id: string; senderId: string; message: string; mediaUrl?: string; mediaType?: string; mediaName?: string; deletedForAll?: boolean; read: boolean; delivered?: boolean; createdAt: string; Sender?: { id: string; name: string; avatar?: string } }

const ACTION_BADGE: Record<string, string> = {
  LOGIN_SUCCESS:   'bg-accent/15 text-accent border-accent/20',
  LOGIN_FAILED:    'bg-destructive/15 text-destructive border-destructive/20',
  LOGIN_BLOCKED:   'bg-orange-500/15 text-orange-500 border-orange-500/20',
  LOGOUT:          'bg-muted text-muted-foreground border-border',
  REGISTER:        'bg-primary/15 text-primary border-primary/20',
  OTP_VERIFIED:    'bg-accent/15 text-accent border-accent/20',
  OAUTH_LOGIN:     'bg-blue-500/15 text-blue-400 border-blue-500/20',
  PROFILE_UPDATED: 'bg-muted text-muted-foreground border-border',
  ACCOUNT_BLOCKED: 'bg-destructive/15 text-destructive border-destructive/20',
}

const container = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { staggerChildren: 0.05 } },
}
const item = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

// ── Animated stat card ────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, gradient, active, onClick }: {
  icon: any; label: string; value: number | string; gradient: string; active?: boolean; onClick?: () => void
}) {
  return (
    <motion.button
      variants={item}
      whileHover={onClick ? { scale: 1.02, y: -2 } : {}}
      onClick={onClick}
      className={cn(
        'relative overflow-hidden bg-card border rounded-2xl p-5 text-left transition-all group w-full',
        onClick ? 'cursor-pointer' : 'cursor-default',
        active ? 'border-primary/60 shadow-glow-md' : 'border-border',
      )}
    >
      <div className={cn('absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl', gradient)} style={{ filter: 'blur(60px)', transform: 'scale(0.5)' }} />
      <div className="relative z-10">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-4', gradient)}>
          <Icon size={18} className="text-white" />
        </div>
        <motion.p key={value} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-foreground">{value}</motion.p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </motion.button>
  )
}

// ── Chat monitor message bubble ────────────────────────────────────────────────

function MonitorBubble({ msg, adminUserId }: { msg: MonitorMessage; adminUserId: string }) {
  const isMine = msg.senderId === adminUserId
  const isDeleted = msg.deletedForAll
  return (
    <div className={cn('flex mb-2', isMine ? 'justify-end' : 'justify-start')}>
      {!isMine && (
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold mr-2 shrink-0 self-end">
          {(msg.Sender?.name || 'U')[0].toUpperCase()}
        </div>
      )}
      <div className="max-w-[65%]">
        {!isMine && <p className="text-[10px] text-muted-foreground mb-0.5 ml-1">{msg.Sender?.name}</p>}
        <div className={cn('px-3 py-2 rounded-2xl text-sm', isDeleted
          ? 'bg-secondary text-muted-foreground italic border border-border'
          : isMine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-secondary text-foreground rounded-bl-sm')}>
          {msg.mediaUrl && !isDeleted && (
            <div className="mb-1 rounded-lg overflow-hidden">
              {msg.mediaType === 'image'
                ? <img src={msg.mediaUrl} alt="media" className="max-w-full max-h-48 rounded-lg" />
                : <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs underline">
                    <FileIcon size={12} /> {msg.mediaName || 'File'}
                  </a>}
            </div>
          )}
          <p className="text-xs leading-relaxed break-words">{msg.message}</p>
          <div className={cn('flex items-center gap-1 mt-0.5', isMine ? 'justify-end' : 'justify-start')}>
            <span className="text-[9px] opacity-60">{format(new Date(msg.createdAt), 'h:mm a')}</span>
            {isMine && !isDeleted && (msg.read ? <CheckCheck size={10} className="text-accent" /> : <Check size={10} className="opacity-40" />)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user, loading: authLoading, logout } = useAuth()
  const router = useRouter()

  const [activeTab, setActiveTab]   = useState<AdminTab>('overview')
  const [users, setUsers]           = useState<User[]>([])
  const [onlineUsers, setOnlineUsers] = useState<User[]>([])
  const [groups, setGroups]         = useState<Group[]>([])
  const [auditLogs, setAuditLogs]   = useState<AuditEntry[]>([])
  const [stats, setStats]           = useState<Stats | null>(null)
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 1 })
  const [groupsPagination, setGroupsPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, totalPages: 1 })
  const [auditPagination, setAuditPagination]   = useState<Pagination>({ total: 0, page: 1, limit: 50, totalPages: 1 })
  const [search, setSearch]         = useState('')
  const [groupSearch, setGroupSearch] = useState('')
  const [auditAction, setAuditAction] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statFilter, setStatFilter] = useState<StatFilter>('')
  const [loading, setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Monitor state
  const [monitorMode, setMonitorMode]           = useState<'personal' | 'group'>('group')
  const [monitorSearch, setMonitorSearch]       = useState('')
  // Personal monitor
  const [monitorUsers, setMonitorUsers]         = useState<User[]>([])
  const [selectedUser1, setSelectedUser1]       = useState<User | null>(null)
  const [selectedUser2, setSelectedUser2]       = useState<User | null>(null)
  const [selectingSlot, setSelectingSlot]       = useState<1 | 2>(1)
  // Group monitor
  const [monitorGroups, setMonitorGroups]       = useState<Group[]>([])
  const [selectedMonitorGroup, setSelectedMonitorGroup] = useState<Group | null>(null)
  const [groupMonitorData, setGroupMonitorData] = useState<{ group: any; messages: MonitorMessage[] } | null>(null)
  // Shared
  const [monitorMessages, setMonitorMessages]   = useState<MonitorMessage[]>([])
  const [monitorLoading, setMonitorLoading]     = useState(false)
  const monitorBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) router.push('/auth/login')
  }, [user, authLoading, router])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const fetchStats     = useCallback(async () => {
    try { const r = await adminApi.getStats(); setStats(r.data.data) } catch { }
  }, [])
  const fetchUsers     = useCallback(async (page = 1) => {
    setLoading(true)
    try { const r = await adminApi.getUsers(page, 10, debouncedSearch, statFilter); setUsers(r.data.data.users); setPagination(r.data.data.pagination) }
    catch { } finally { setLoading(false) }
  }, [debouncedSearch, statFilter])
  const fetchOnline    = useCallback(async () => {
    setLoading(true)
    try { const r = await adminApi.getOnlineUsers(); setOnlineUsers(r.data.data.users) }
    catch { } finally { setLoading(false) }
  }, [])
  const fetchGroups    = useCallback(async (page = 1) => {
    setLoading(true)
    try { const r = await adminApi.getGroups(page, 10, groupSearch); setGroups(r.data.data.groups); setGroupsPagination(r.data.data.pagination) }
    catch { } finally { setLoading(false) }
  }, [groupSearch])
  const fetchAudit     = useCallback(async (page = 1) => {
    setLoading(true)
    try { const r = await adminApi.getAuditLogs(page, 50, auditAction); setAuditLogs(r.data.data.logs); setAuditPagination(r.data.data.pagination) }
    catch { } finally { setLoading(false) }
  }, [auditAction])
  const fetchMonitorUsers = useCallback(async () => {
    try { const r = await adminApi.getMonitorUsers(); setMonitorUsers(r.data.data) } catch { }
  }, [])
  const fetchMonitorGroups = useCallback(async () => {
    try { const r = await adminApi.getGroups(1, 100, ''); setMonitorGroups(r.data.data.groups) } catch { }
  }, [])

  useEffect(() => { fetchStats() }, [])
  useEffect(() => { if (activeTab === 'overview') fetchStats() }, [activeTab])
  useEffect(() => { if (activeTab === 'users') fetchUsers(1) }, [debouncedSearch, activeTab, statFilter])
  useEffect(() => { if (activeTab === 'groups') fetchGroups(1) }, [activeTab, groupSearch])
  useEffect(() => { if (activeTab === 'audit') fetchAudit(1) }, [activeTab, auditAction])
  useEffect(() => {
    if (activeTab === 'monitor') { fetchMonitorUsers(); fetchMonitorGroups() }
  }, [activeTab])

  // Auto-load chat when both users selected
  useEffect(() => {
    if (selectedUser1 && selectedUser2) {
      setMonitorLoading(true)
      adminApi.getPersonalChat(selectedUser1.id, selectedUser2.id).then(r => {
        setMonitorMessages(r.data.data.messages)
        setTimeout(() => monitorBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }).catch(() => {}).finally(() => setMonitorLoading(false))
    }
  }, [selectedUser1, selectedUser2])

  // Auto-load group chat when group selected
  useEffect(() => {
    if (selectedMonitorGroup) {
      setMonitorLoading(true)
      adminApi.getGroupChat(selectedMonitorGroup.id).then(r => {
        setGroupMonitorData(r.data.data)
        setTimeout(() => monitorBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }).catch(() => {}).finally(() => setMonitorLoading(false))
    }
  }, [selectedMonitorGroup])

  const handleAction = async (userId: string, action: ActionType) => {
    setActionLoading(`${userId}-${action}`)
    try {
      await ACTION_MAP[action].fn(userId)
      toast.success(`User ${action}d`)
      fetchUsers(pagination.page); fetchStats()
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed') }
    finally { setActionLoading(null) }
  }

  const getActions = (u: User): ActionType[] => {
    const a: ActionType[] = []
    if (!u.isVerified) a.push('verify')
    if (u.isActive) a.push('block'); else a.push('unblock')
    return a
  }

  const filteredMonitorUsers = monitorUsers.filter(u =>
    u.name.toLowerCase().includes(monitorSearch.toLowerCase()) || u.email.toLowerCase().includes(monitorSearch.toLowerCase())
  )

  if (authLoading || !user) return (
    <div className="min-h-screen aurora-bg flex flex-col items-center justify-center gap-5">
      <OrbitalLoader size={60} />
      <p className="text-sm text-muted-foreground gradient-text font-medium">Loading Admin Panel…</p>
    </div>
  )

  const NAV_TABS: { id: AdminTab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview',     icon: BarChart3 },
    { id: 'users',    label: 'Users',        icon: Users },
    { id: 'groups',   label: 'Groups',       icon: MessageSquare },
    { id: 'monitor',  label: 'Chat Monitor', icon: Eye },
    { id: 'audit',    label: 'Audit Logs',   icon: FileText },
  ]

  const si = 'w-full bg-card border border-border text-foreground placeholder:text-muted-foreground text-sm rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-primary/50 transition-all'

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Sidebar nav ──────────────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 bg-card border-r border-border flex flex-col sticky top-0 h-screen">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-glow-sm">
              <Shield size={17} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Admin Panel</p>
              <p className="text-[10px] text-muted-foreground">NexChat Control</p>
            </div>
          </div>
        </div>

        {stats && (
          <div className="px-4 py-3 border-b border-border">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Users',  value: stats.totalUsers,  color: 'text-primary' },
                { label: 'Online', value: stats.onlineCount, color: 'text-accent' },
                { label: 'Groups', value: stats.totalGroups, color: 'text-amber-500' },
                { label: 'Msgs',   value: stats.totalMessages, color: 'text-violet-400' },
              ].map(s => (
                <div key={s.label} className="bg-secondary rounded-lg px-2.5 py-2 text-center">
                  <p className={cn('text-base font-bold', s.color)}>{s.value}</p>
                  <p className="text-[9px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <nav className="flex-1 p-3 space-y-1">
          {NAV_TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                activeTab === t.id ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
              )}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <Link href="/dashboard" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
            <BarChart3 size={15} /> My Dashboard
          </Link>
          <Link href="/chat" className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
            <Home size={15} /> Back to Chat
          </Link>
          <button onClick={async () => { await logout(); router.push('/auth/login') }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-all">
            <LogOut size={15} /> Logout
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b border-border px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {NAV_TABS.find(t => t.id === activeTab)?.label}
            </h1>
            <p className="text-xs text-muted-foreground">Signed in as <span className="text-amber-500 font-medium">{user.name}</span></p>
          </div>
          <button onClick={fetchStats} className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all">
            <RefreshCw size={15} />
          </button>
        </div>

        <div className="px-8 py-8">
          <AnimatePresence mode="wait">

            {/* ── OVERVIEW ───────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <motion.div key="overview" variants={container} initial="hidden" animate="show" exit={{ opacity: 0 }}>
                <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <StatCard icon={Users}          label="Total Users"   value={stats?.totalUsers ?? '—'}    gradient="bg-gradient-to-br from-primary to-violet-600"  active={statFilter === ''} onClick={() => { setStatFilter(''); setActiveTab('users') }} />
                  <StatCard icon={Wifi}           label="Online Now"    value={stats?.onlineCount ?? '—'}   gradient="bg-gradient-to-br from-accent to-teal-600"     onClick={() => setActiveTab('users')} />
                  <StatCard icon={MessageSquare}  label="Messages"      value={stats?.totalMessages ?? '—'} gradient="bg-gradient-to-br from-indigo-500 to-blue-600" />
                  <StatCard icon={Activity}       label="Groups"        value={stats?.totalGroups ?? '—'}   gradient="bg-gradient-to-br from-amber-500 to-orange-600" onClick={() => setActiveTab('groups')} />
                </motion.div>

                <div className="grid lg:grid-cols-3 gap-4 mb-8">
                  <StatCard icon={CheckCircle} label="Verified Users" value={stats?.verifiedUsers ?? '—'}  gradient="bg-gradient-to-br from-cyan-500 to-sky-600" onClick={() => { setStatFilter('verified'); setActiveTab('users') }} />
                  <StatCard icon={Zap}         label="Active Users"   value={stats?.activeUsers ?? '—'}    gradient="bg-gradient-to-br from-violet-500 to-purple-600" onClick={() => { setStatFilter('active'); setActiveTab('users') }} />
                  <StatCard icon={Ban}         label="Blocked Users"  value={stats?.blockedUsers ?? '—'}   gradient="bg-gradient-to-br from-destructive to-red-600" onClick={() => { setStatFilter('blocked'); setActiveTab('users') }} />
                </div>

                {/* Quick actions */}
                <motion.div variants={item} className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="font-semibold text-foreground mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {NAV_TABS.filter(t => t.id !== 'overview').map(t => (
                      <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl bg-secondary hover:bg-secondary/80 border border-border hover:border-primary/30 transition-all group">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <t.icon size={18} className="text-primary" />
                        </div>
                        <span className="text-xs font-medium text-foreground">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* ── USERS ──────────────────────────────────────────────── */}
            {activeTab === 'users' && (
              <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <div className="relative flex-1 min-w-48">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…" className={si} />
                  </div>
                  {statFilter && (
                    <span className="px-3 py-1.5 text-xs bg-primary/10 text-primary border border-primary/20 rounded-lg flex items-center gap-1.5">
                      Filter: {statFilter} <button onClick={() => setStatFilter('')} className="hover:text-foreground ml-1 text-base leading-none">×</button>
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {pagination.total} users
                    <button onClick={() => fetchUsers(1)} className="p-1.5 hover:text-foreground hover:bg-secondary rounded-lg"><RefreshCw size={12} /></button>
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        {['User', 'Status', 'Role', 'Joined', 'Last Login', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {loading ? [...Array(5)].map((_, i) => (
                        <tr key={i}>{[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3.5"><div className="skeleton h-8 rounded-lg" /></td>)}</tr>
                      )) : users.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">No users found</td></tr>
                      ) : users.map(u => (
                        <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-secondary/50 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <Avatar name={u.name} avatar={u.avatar} size="sm" online={u.isOnlineNow} />
                              <div><p className="text-sm font-medium text-foreground">{u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col gap-1">
                              <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit border', u.isActive ? 'bg-accent/15 text-accent border-accent/20' : 'bg-destructive/15 text-destructive border-destructive/20')}>
                                <span className={cn('w-1 h-1 rounded-full', u.isActive ? 'bg-accent' : 'bg-destructive')} />
                                {u.isActive ? 'Active' : 'Blocked'}
                              </span>
                              <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit border', u.isVerified ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' : 'bg-muted text-muted-foreground border-border')}>
                                {u.isVerified ? <><CheckCircle size={9} /> Verified</> : <><XCircle size={9} /> Unverified</>}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border', u.role === 'admin' ? 'bg-amber-500/15 text-amber-500 border-amber-500/20' : 'bg-muted text-muted-foreground border-border')}>
                              {u.role === 'admin' && <Shield size={10} />}{u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-muted-foreground">{u.createdAt ? format(new Date(u.createdAt), 'MMM d, yyyy') : '-'}</td>
                          <td className="px-4 py-3.5 text-xs text-muted-foreground">
                            {u.lastLogin ? <span title={format(new Date(u.lastLogin), 'PPpp')}>{formatDistanceToNow(new Date(u.lastLogin), { addSuffix: true })}</span> : <span className="opacity-30">Never</span>}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1">
                              {getActions(u).map(action => {
                                const { icon: AIcon, label, color } = ACTION_MAP[action]
                                const isLoading = actionLoading === `${u.id}-${action}`
                                return (
                                  <button key={action} onClick={() => handleAction(u.id, action)} disabled={!!actionLoading} title={label}
                                    className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border border-current/20 hover:bg-current/10 disabled:opacity-40', color)}>
                                    {isLoading ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <AIcon size={12} />}
                                    {label}
                                  </button>
                                )
                              })}
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>

                  {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3.5 border-t border-border">
                      <p className="text-xs text-muted-foreground">{((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => fetchUsers(pagination.page - 1)} disabled={pagination.page <= 1} className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 hover:bg-secondary rounded-lg"><ChevronLeft size={15} /></button>
                        {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => i + 1).map(p => (
                          <button key={p} onClick={() => fetchUsers(p)} className={cn('w-7 h-7 text-xs rounded-lg transition-all', pagination.page === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary')}>{p}</button>
                        ))}
                        <button onClick={() => fetchUsers(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 hover:bg-secondary rounded-lg"><ChevronRight size={15} /></button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── GROUPS ─────────────────────────────────────────────── */}
            {activeTab === 'groups' && (
              <motion.div key="groups" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" value={groupSearch} onChange={e => setGroupSearch(e.target.value)} placeholder="Search groups…" className={si} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border rounded-xl px-3 py-2">
                    <Users size={13} className="text-primary" />
                    <span className="font-semibold text-foreground">{groupsPagination.total}</span> groups
                  </div>
                </div>

                {/* Group cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {loading ? [...Array(6)].map((_, i) => (
                    <div key={i} className="skeleton h-48 rounded-2xl" />
                  )) : groups.map((g, idx) => {
                    const adminCount  = g.Members?.filter(m => m.GroupMember?.role === 'admin').length ?? 0
                    const memberCount = g.Members?.length ?? 0
                    return (
                      <motion.div
                        key={g.id}
                        variants={item}
                        initial="hidden"
                        animate="show"
                        transition={{ delay: idx * 0.05 }}
                        whileHover={{ y: -3, scale: 1.01 }}
                        className="bg-card border border-border rounded-2xl overflow-hidden group hover:border-primary/30 hover:shadow-glow-sm transition-all"
                      >
                        {/* Group header */}
                        <div className="relative p-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-glow-sm">
                              <span className="text-white font-bold text-lg">{g.name[0]}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-foreground truncate">{g.name}</p>
                              {g.description && <p className="text-xs text-muted-foreground truncate">{g.description}</p>}
                              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{format(new Date(g.createdAt), 'MMM d, yyyy')}</p>
                            </div>
                            <span className={cn('text-[10px] px-2 py-1 rounded-full border font-semibold shrink-0', g.onlyAdminCanSend ? 'bg-amber-500/15 text-amber-500 border-amber-500/20' : 'bg-accent/10 text-accent border-accent/20')}>
                              {g.onlyAdminCanSend ? '🔒 Restricted' : '🔓 Open'}
                            </span>
                          </div>
                        </div>

                        {/* Stats row */}
                        <div className="flex divide-x divide-border/50">
                          <div className="flex-1 px-3 py-2.5 text-center">
                            <p className="text-lg font-bold text-foreground">{memberCount}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Members</p>
                          </div>
                          <div className="flex-1 px-3 py-2.5 text-center">
                            <p className="text-lg font-bold text-amber-500">{adminCount}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Admins</p>
                          </div>
                          <div className="flex-1 px-3 py-2.5 text-center">
                            <p className="text-lg font-bold text-primary">{memberCount - adminCount}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Users</p>
                          </div>
                        </div>

                        {/* Creator */}
                        <div className="px-4 py-2.5 border-t border-border/50 flex items-center gap-2">
                          {g.Creator && (
                            <>
                              <Avatar name={g.Creator.name} avatar={g.Creator.avatar} size="xs" online={false} />
                              <p className="text-xs text-muted-foreground flex-1 truncate">Created by <span className="text-foreground font-medium">{g.Creator.name}</span></p>
                            </>
                          )}
                          <button
                            onClick={async () => {
                              await adminApi.updateGroupSettings(g.id, { onlyAdminCanSend: !g.onlyAdminCanSend })
                              toast.success(g.onlyAdminCanSend ? 'Group opened' : 'Group restricted')
                              fetchGroups(groupsPagination.page)
                            }}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border shrink-0',
                              g.onlyAdminCanSend ? 'text-accent border-accent/20 hover:bg-accent/10' : 'text-amber-500 border-amber-500/20 hover:bg-amber-500/10',
                            )}>
                            {g.onlyAdminCanSend ? <><Unlock size={10} /> Open</> : <><Lock size={10} /> Restrict</>}
                          </button>
                        </div>

                        {/* Member list (collapsible) */}
                        {g.Members && g.Members.length > 0 && (
                          <div className="px-4 pb-3 border-t border-border/50">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-2.5 mb-2">Members</p>
                            <div className="space-y-1 max-h-28 overflow-y-auto">
                              {g.Members.map(m => (
                                <div key={m.id} className="flex items-center gap-2 py-1">
                                  <Avatar name={m.name} avatar={m.avatar} size="xs" online={false} />
                                  <p className="text-xs text-foreground truncate flex-1">{m.name}</p>
                                  {m.GroupMember?.role === 'admin' && (
                                    <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/15 text-amber-500 border border-amber-500/20 rounded-full font-semibold shrink-0">
                                      Admin
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>

                {groupsPagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <button onClick={() => fetchGroups(groupsPagination.page - 1)} disabled={groupsPagination.page <= 1} className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 hover:bg-secondary rounded-xl transition-all"><ChevronLeft size={15} /></button>
                    {Array.from({ length: Math.min(groupsPagination.totalPages, 5) }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => fetchGroups(p)} className={cn('w-8 h-8 text-xs rounded-xl transition-all', groupsPagination.page === p ? 'bg-primary text-primary-foreground shadow-glow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-secondary')}>{p}</button>
                    ))}
                    <button onClick={() => fetchGroups(groupsPagination.page + 1)} disabled={groupsPagination.page >= groupsPagination.totalPages} className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-30 hover:bg-secondary rounded-xl transition-all"><ChevronRight size={15} /></button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── CHAT MONITOR ────────────────────────────────────────── */}
            {activeTab === 'monitor' && (
              <motion.div key="monitor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {/* Sub-tabs */}
                <div className="flex gap-2">
                  {(['group', 'personal'] as const).map(m => (
                    <button key={m} onClick={() => { setMonitorMode(m); setMonitorMessages([]); setGroupMonitorData(null); setSelectedUser1(null); setSelectedUser2(null); setSelectedMonitorGroup(null) }}
                      className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-all border', monitorMode === m ? 'bg-primary text-primary-foreground border-primary shadow-glow-sm' : 'bg-card text-muted-foreground border-border hover:text-foreground')}>
                      {m === 'group' ? '👥 Group Chats' : '💬 Personal Chats'}
                    </button>
                  ))}
                  <div className="ml-auto flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
                    <Eye size={13} /> Read-only Admin View
                  </div>
                </div>

                <div className="flex gap-4" style={{ height: 'calc(100vh - 18rem)' }}>

                  {/* ── GROUP MONITOR ─────────────────────────────────── */}
                  {monitorMode === 'group' && (
                    <>
                      {/* Groups list */}
                      <div className="w-72 shrink-0 bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-border">
                          <h3 className="font-semibold text-foreground text-sm mb-2">All Groups</h3>
                          <p className="text-[11px] text-muted-foreground">Click any group to read its messages</p>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                          {monitorGroups.length === 0 ? (
                            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">No groups</div>
                          ) : monitorGroups.filter(g => g.name.toLowerCase().includes(monitorSearch.toLowerCase())).map(g => (
                            <button key={g.id} onClick={() => setSelectedMonitorGroup(g)}
                              className={cn('w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary transition-all border-l-2', selectedMonitorGroup?.id === g.id ? 'border-primary bg-primary/5' : 'border-transparent')}>
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 text-white text-sm font-bold shadow-glow-sm">
                                {g.name[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">{g.name}</p>
                                <p className="text-[10px] text-muted-foreground">{g.Members?.length ?? 0} members</p>
                              </div>
                              {selectedMonitorGroup?.id === g.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Group chat view */}
                      <div className="flex-1 bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
                        {!selectedMonitorGroup ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4"><Eye size={28} className="text-primary/50" /></div>
                            <p className="font-medium">Select a group</p>
                            <p className="text-sm mt-1">Click any group on the left to read its chat</p>
                          </div>
                        ) : (
                          <>
                            <div className="px-5 py-3.5 border-b border-border flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 text-white text-sm font-bold">
                                {selectedMonitorGroup.name[0]}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">{selectedMonitorGroup.name}</p>
                                <p className="text-xs text-muted-foreground">{groupMonitorData?.messages?.length ?? 0} messages · {selectedMonitorGroup.Members?.length ?? 0} members</p>
                              </div>
                              <span className="text-[10px] px-2 py-1 bg-amber-500/15 text-amber-500 border border-amber-500/20 rounded-full font-medium">👁 Admin View</span>
                            </div>
                            <div className="flex-1 overflow-y-auto px-5 py-4">
                              {monitorLoading ? (
                                <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                              ) : !groupMonitorData?.messages?.length ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                  <MessageSquare size={28} className="mb-2 opacity-30" />
                                  <p className="text-sm">No messages in this group</p>
                                </div>
                              ) : groupMonitorData.messages.map(msg => (
                                <MonitorBubble key={msg.id} msg={msg} adminUserId="" />
                              ))}
                              <div ref={monitorBottomRef} />
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}

                  {/* ── PERSONAL MONITOR ──────────────────────────────── */}
                  {monitorMode === 'personal' && (
                    <>
                      {/* User selector */}
                      <div className="w-72 shrink-0 bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-border">
                          <h3 className="font-semibold text-foreground text-sm mb-3">Select Two Users</h3>
                          <div className="flex gap-2 mb-3">
                            {([1, 2] as const).map(slot => {
                              const selected = slot === 1 ? selectedUser1 : selectedUser2
                              return (
                                <button key={slot} onClick={() => setSelectingSlot(slot)}
                                  className={cn('flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all', selectingSlot === slot ? 'border-primary bg-primary/10' : 'border-border bg-secondary')}>
                                  {selected ? <><Avatar name={selected.name} size="xs" /><span className="text-xs font-medium text-foreground truncate">{selected.name}</span></>
                                    : <><div className="w-4 h-4 rounded-full border-2 border-dashed border-muted-foreground/40" /><span className="text-xs text-muted-foreground">User {slot}</span></>}
                                </button>
                              )
                            })}
                          </div>
                          <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input value={monitorSearch} onChange={e => setMonitorSearch(e.target.value)} placeholder="Search users…"
                              className="w-full bg-background border border-border text-foreground text-xs rounded-lg pl-8 pr-3 py-2 focus:outline-none focus:border-primary/50" />
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                          {filteredMonitorUsers.map(u => (
                            <button key={u.id}
                              onClick={() => {
                                if (selectingSlot === 1) { setSelectedUser1(u); if (selectedUser2?.id !== u.id) setSelectingSlot(2) }
                                else { if (selectedUser1?.id !== u.id) { setSelectedUser2(u); setSelectingSlot(1) } }
                              }}
                              className={cn('w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-secondary transition-all', (selectedUser1?.id === u.id || selectedUser2?.id === u.id) && 'bg-primary/10')}>
                              <Avatar name={u.name} avatar={u.avatar} size="sm" online={u.isOnlineStatus} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">{u.name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                              </div>
                              {selectedUser1?.id === u.id && <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-bold">1</span>}
                              {selectedUser2?.id === u.id && <span className="text-[9px] bg-violet-500 text-white px-1.5 py-0.5 rounded font-bold">2</span>}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Personal chat view */}
                      <div className="flex-1 bg-card border border-border rounded-2xl flex flex-col overflow-hidden">
                        {!selectedUser1 || !selectedUser2 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                            <Eye size={40} className="mb-4 opacity-30" />
                            <p className="font-medium">Select two users</p>
                            <p className="text-sm mt-1">See their private conversation</p>
                          </div>
                        ) : (
                          <>
                            <div className="px-5 py-3.5 border-b border-border flex items-center gap-3">
                              <div className="flex -space-x-2"><Avatar name={selectedUser1.name} size="sm" /><Avatar name={selectedUser2.name} size="sm" /></div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">{selectedUser1.name} ↔ {selectedUser2.name}</p>
                                <p className="text-xs text-muted-foreground">{monitorMessages.length} messages</p>
                              </div>
                              <span className="text-[10px] px-2 py-1 bg-amber-500/15 text-amber-500 border border-amber-500/20 rounded-full">👁 Admin View</span>
                            </div>
                            <div className="flex-1 overflow-y-auto px-5 py-4">
                              {monitorLoading ? <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                              : monitorMessages.length === 0 ? <div className="flex flex-col items-center justify-center h-full text-muted-foreground"><MessageSquare size={28} className="mb-2 opacity-30" /><p className="text-sm">No messages</p></div>
                              : monitorMessages.map(msg => <MonitorBubble key={msg.id} msg={msg} adminUserId={selectedUser1.id} />)}
                              <div ref={monitorBottomRef} />
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── AUDIT LOGS ──────────────────────────────────────────── */}
            {activeTab === 'audit' && (
              <motion.div key="audit" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex items-center gap-3 mb-4">
                  <select value={auditAction} onChange={e => setAuditAction(e.target.value)}
                    className="bg-card border border-border text-foreground text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-primary/50">
                    <option value="">All actions</option>
                    {['LOGIN_SUCCESS','LOGIN_FAILED','LOGIN_BLOCKED','LOGOUT','REGISTER','OTP_VERIFIED','OAUTH_LOGIN','PROFILE_UPDATED','ACCOUNT_BLOCKED'].map(a => (
                      <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {auditPagination.total} logs
                    <button onClick={() => fetchAudit(1)} className="p-1.5 hover:text-foreground hover:bg-secondary rounded-lg transition-all"><RefreshCw size={12} /></button>
                  </div>
                </div>
                <div className="bg-card rounded-2xl border border-border overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        {['Action', 'User ID', 'IP Address', 'Details', 'Time'].map(h => (
                          <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {loading ? <tr><td colSpan={5} className="px-4 py-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
                      : auditLogs.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">No audit logs found</td></tr>
                      ) : auditLogs.map(log => (
                        <tr key={log.id} className="hover:bg-secondary/50 transition-colors">
                          <td className="px-4 py-3">
                            <span className={cn('inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap', ACTION_BADGE[log.action] || 'bg-muted text-muted-foreground border-border')}>
                              {log.action.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{log.userId ? log.userId.slice(0, 8) + '…' : '—'}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{log.ip || '—'}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-48 truncate">
                            {log.meta ? Object.entries(log.meta).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap" title={log.createdAt ? format(new Date(log.createdAt), 'PPpp') : ''}>
                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {auditPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3.5 border-t border-border">
                      <p className="text-xs text-muted-foreground">Page {auditPagination.page} of {auditPagination.totalPages}</p>
                      <div className="flex gap-1">
                        <button onClick={() => fetchAudit(auditPagination.page - 1)} disabled={auditPagination.page <= 1} className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 hover:bg-secondary rounded-lg"><ChevronLeft size={15} /></button>
                        <button onClick={() => fetchAudit(auditPagination.page + 1)} disabled={auditPagination.page >= auditPagination.totalPages} className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 hover:bg-secondary rounded-lg"><ChevronRight size={15} /></button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
