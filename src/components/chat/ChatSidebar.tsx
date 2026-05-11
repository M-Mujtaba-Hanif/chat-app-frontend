'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { useSocket } from '@/context/SocketContext'
import { chatApi, groupApi, notificationApi } from '@/lib/api'
import { Conversation, User, Group, FriendRequest, Notification } from '@/types'
import Avatar from '@/components/ui/Avatar'
import { cn, formatLastSeen, truncate } from '@/lib/utils'
import {
  Search, LogOut, Shield, MessageSquarePlus, Users, UserPlus,
  Plus, Check, X, ChevronRight, Globe, UserCheck, Edit2, Save,
  MessageSquare, Bell, Loader2, Pencil, BarChart3,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Tab = 'chats' | 'users' | 'groups' | 'requests'

interface ChatSidebarProps {
  selectedId?: string
  selectedType?: 'personal' | 'group'
  onSelectUser:  (userId: string, userName: string, user?: User) => void
  onSelectGroup: (groupId: string, groupName: string) => void
}

// ── Notification Bell Dropdown ────────────────────────────────────────────────

function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const [notifs, setNotifs]     = useState<Notification[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    notificationApi.getAll(1, 15).then(r => {
      setNotifs(r.data.data.notifications)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const markRead = async (id: string) => {
    await notificationApi.markOneRead(id).catch(() => {})
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAll = async () => {
    await notificationApi.markAllRead().catch(() => {})
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  const typeIcon: Record<string, string> = {
    friend_request: '👥', friend_accepted: '🤝', new_message: '💬',
    group_invite: '👥', group_message: '💬', mention: '@',
    reaction: '😊', admin_action: '⚠️', security_alert: '🔒',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className="absolute top-full right-0 mt-2 w-80 bg-card border border-border rounded-2xl shadow-card z-50 overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
        {notifs.some(n => !n.read) && (
          <button onClick={markAll} className="text-xs text-primary hover:text-primary/80 transition-colors">
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-72 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : notifs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Bell size={24} className="mb-2 opacity-40" />
            <p className="text-xs">No notifications</p>
          </div>
        ) : (
          notifs.map(n => (
            <button
              key={n.id}
              onClick={() => markRead(n.id)}
              className={cn(
                'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-secondary transition-all',
                !n.read && 'bg-primary/5',
              )}
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm">
                {typeIcon[n.type] || '🔔'}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-medium truncate', n.read ? 'text-muted-foreground' : 'text-foreground')}>
                  {n.title}
                </p>
                {n.body && <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-2">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">{formatLastSeen(n.createdAt)}</p>
              </div>
              {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />}
            </button>
          ))
        )}
      </div>
    </motion.div>
  )
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────

export default function ChatSidebar({ selectedId, selectedType, onSelectUser, onSelectGroup }: ChatSidebarProps) {
  const { user, logout, updateProfile } = useAuth()
  const { onlineUsers, unreadCounts, unreadNotifications, onNewMessage, onNewGroupMessage } = useSocket()
  const router = useRouter()

  const [tab, setTab]               = useState<Tab>('chats')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [allUsers, setAllUsers]     = useState<User[]>([])
  const [friends, setFriends]       = useState<User[]>([])
  const [groups, setGroups]         = useState<Group[]>([])
  const [friendRequests, setFriendRequests] = useState<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>({ incoming: [], outgoing: [] })
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [newGroupName, setNewGroupName]       = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [creating, setCreating]     = useState(false)

  // Profile
  const [showProfile, setShowProfile]   = useState(false)
  const [editingName, setEditingName]   = useState(false)
  const [nameInput, setNameInput]       = useState(user?.name || '')
  const [savingName, setSavingName]     = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  // Notifications
  const [showNotifs, setShowNotifs] = useState(false)
  const notifsRef = useRef<HTMLDivElement>(null)

  // Fetch helpers
  const fetchConversations = useCallback(async () => {
    try { const r = await chatApi.getConversations(); setConversations(r.data.data.conversations) } catch { }
  }, [])
  const fetchUsers = useCallback(async () => {
    try { const r = await groupApi.getAllUsers(search); setAllUsers(r.data.data) } catch { }
  }, [search])
  const fetchFriends = useCallback(async () => {
    try { const r = await groupApi.getFriends(); setFriends(r.data.data) } catch { }
  }, [])
  const fetchGroups = useCallback(async () => {
    try { const r = await groupApi.getMyGroups(); setGroups(r.data.data) } catch { }
  }, [])
  const fetchRequests = useCallback(async () => {
    try { const r = await groupApi.getFriendRequests(); setFriendRequests(r.data.data) } catch { }
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])
  useEffect(() => {
    const o1 = onNewMessage(() => fetchConversations())
    const o2 = onNewGroupMessage(() => {})
    return () => { o1(); o2() }
  }, [onNewMessage, onNewGroupMessage, fetchConversations])

  useEffect(() => {
    setLoading(true)
    const tasks: Promise<any>[] = []
    if (tab === 'chats')    tasks.push(fetchConversations())
    if (tab === 'users')    tasks.push(fetchUsers(), fetchFriends())
    if (tab === 'groups')   tasks.push(fetchGroups(), fetchFriends())
    if (tab === 'requests') tasks.push(fetchRequests())
    Promise.all(tasks).finally(() => setLoading(false))
  }, [tab])

  useEffect(() => { if (tab === 'users') fetchUsers() }, [search, tab])
  useEffect(() => { setNameInput(user?.name || '') }, [user?.name])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false); setEditingName(false)
      }
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) {
        setShowNotifs(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => { await logout(); router.push('/auth/login') }

  const handleSendFriendRequest = async (receiverId: string) => {
    try { await groupApi.sendFriendRequest(receiverId); toast.success('Friend request sent!'); fetchUsers() }
    catch (err: any) { toast.error(err?.response?.data?.message || 'Failed') }
  }

  const handleRespondRequest = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      await groupApi.respondFriendRequest(requestId, action)
      toast.success(`Request ${action}ed!`)
      fetchRequests()
      if (action === 'accept') { fetchFriends(); fetchConversations() }
    } catch { toast.error('Failed') }
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return
    setCreating(true)
    try {
      const r = await groupApi.createGroup({ name: newGroupName, memberIds: selectedMembers })
      toast.success('Group created!')
      setShowCreateGroup(false); setNewGroupName(''); setSelectedMembers([])
      fetchGroups(); setTab('groups')
      onSelectGroup(r.data.data.id, r.data.data.name)
    } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed') }
    finally { setCreating(false) }
  }

  const handleSaveName = async () => {
    if (!nameInput.trim() || nameInput.trim() === user?.name) { setEditingName(false); return }
    setSavingName(true)
    try { await updateProfile({ name: nameInput.trim() }); setEditingName(false) }
    catch { toast.error('Failed to update name') }
    finally { setSavingName(false) }
  }

  const totalChatUnread  = conversations.reduce((s, c) => s + (unreadCounts[c.roomId] ?? c.unreadCount ?? 0), 0)
  const totalGroupUnread = groups.reduce((s, g) => s + (unreadCounts[`group:${g.id}`] || 0), 0)
  const pendingCount     = friendRequests.incoming.length

  const TABS = [
    { id: 'chats' as Tab,    label: 'Chats',    icon: MessageSquare, badge: totalChatUnread },
    { id: 'users' as Tab,    label: 'People',   icon: Globe },
    { id: 'groups' as Tab,   label: 'Groups',   icon: Users, badge: totalGroupUnread },
    { id: 'requests' as Tab, label: 'Requests', icon: UserCheck, badge: pendingCount },
  ]

  const commonItem = (isSelected: boolean) => cn(
    'w-full flex items-center gap-3 px-4 py-3 transition-all text-left border-r-2',
    isSelected
      ? 'bg-primary/8 border-primary'
      : 'hover:bg-secondary border-transparent',
  )

  return (
    <aside className="w-80 h-full flex flex-col bg-card border-r border-border relative">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-glow-sm">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span className="font-bold text-foreground">NexChat</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Notification bell */}
            <div className="relative" ref={notifsRef}>
              <button
                onClick={() => setShowNotifs(v => !v)}
                className={cn(
                  'relative p-1.5 rounded-lg transition-all',
                  showNotifs ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
                )}
              >
                <Bell size={16} />
                {unreadNotifications > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center"
                  >
                    {unreadNotifications > 9 ? '9+' : unreadNotifications}
                  </motion.span>
                )}
              </button>
              <AnimatePresence>
                {showNotifs && <NotificationDropdown onClose={() => setShowNotifs(false)} />}
              </AnimatePresence>
            </div>

              <Link href="/dashboard"
              className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
              title="My Dashboard">
              <BarChart3 size={16} />
            </Link>
            {user?.role === 'admin' && (
              <Link href="/admin"
                className="p-1.5 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all"
                title="Admin Panel">
                <Shield size={16} />
              </Link>
            )}
          </div>
        </div>

        {/* Profile mini card */}
        <div className="relative mb-3" ref={profileRef}>
          <button
            onClick={() => { setShowProfile(v => !v); setEditingName(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 bg-secondary rounded-xl hover:bg-secondary/80 transition-all text-left"
          >
            <Avatar name={user?.name || ''} avatar={user?.avatar} size="sm" online={true} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-accent online-ring shrink-0" />
          </button>

          <AnimatePresence>
            {showProfile && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.18 }}
                className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-2xl shadow-card p-4"
              >
                <div className="flex flex-col items-center mb-4">
                  <Avatar name={user?.name || ''} avatar={user?.avatar} size="xl" online={true} />
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                    <span className="text-xs text-accent font-medium">Online</span>
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">Display Name</p>
                  {editingName ? (
                    <div className="flex gap-2">
                      <input
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                        autoFocus
                        className="flex-1 bg-background border border-primary/40 text-foreground text-sm rounded-lg px-3 py-1.5 focus:outline-none"
                        placeholder="Enter name..."
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={savingName}
                        className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-lg transition-all disabled:opacity-50 flex items-center gap-1"
                      >
                        {savingName ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between bg-background rounded-lg px-3 py-2">
                      <span className="text-sm text-foreground font-medium">{user?.name}</span>
                      <button onClick={() => setEditingName(true)} className="text-muted-foreground hover:text-primary transition-colors">
                        <Pencil size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">Email</p>
                  <div className="bg-background rounded-lg px-3 py-2">
                    <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-xl text-sm font-medium transition-all border border-destructive/20"
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text" value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'users' ? 'Search people…' : 'Search…'}
            className="w-full input-base pl-9 py-2 text-sm"
          />
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-border shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-all relative',
              tab === t.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <t.icon size={14} />
            {t.label}
            {(t.badge ?? 0) > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-1 right-2 min-w-[16px] h-4 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-1"
              >
                {(t.badge ?? 0) > 99 ? '99+' : t.badge}
              </motion.span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* CHATS */}
        {tab === 'chats' && (
          <div>
            {loading && conversations.length === 0 ? (
              <div className="space-y-0">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="skeleton w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3 w-24 rounded" />
                      <div className="skeleton h-2.5 w-36 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare size={28} className="mb-2 opacity-40" />
                <p className="text-sm">No conversations yet</p>
                <button onClick={() => setTab('users')} className="mt-2 text-xs text-primary hover:underline">Find people →</button>
              </div>
            ) : (
              conversations
                .filter(c => c.user?.name?.toLowerCase().includes(search.toLowerCase()))
                .map(c => {
                  const unread = unreadCounts[c.roomId] ?? c.unreadCount ?? 0
                  const isSelected = selectedId === c.user.id && selectedType === 'personal'
                  return (
                    <button key={c.roomId} onClick={() => onSelectUser(c.user.id, c.user.name, c.user)}
                      className={commonItem(isSelected)}>
                      <Avatar name={c.user.name} avatar={c.user.avatar} size="md" online={onlineUsers[c.user.id] === 'online'} />
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between">
                          <span className={cn('text-sm truncate', unread > 0 ? 'font-bold text-foreground' : 'font-medium text-foreground')}>
                            {c.user.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                            {formatLastSeen(c.lastMessage.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className={cn('text-xs truncate flex-1', unread > 0 ? 'text-foreground/80 font-medium' : 'text-muted-foreground')}>
                            {c.lastMessage.senderId === user?.id ? 'You: ' : ''}{truncate(c.lastMessage.message, 32)}
                          </p>
                          {unread > 0 && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="min-w-[18px] h-4.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-1.5 shrink-0 ml-1"
                            >
                              {unread > 99 ? '99+' : unread}
                            </motion.span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })
            )}
          </div>
        )}

        {/* USERS */}
        {tab === 'users' && (
          <div>
            {allUsers.map(u => {
              const isFriend = friends.some(f => f.id === u.id)
              return (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-all">
                  <Avatar name={u.name} avatar={u.avatar} size="md" online={onlineUsers[u.id] === 'online'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  {isFriend ? (
                    <button onClick={() => onSelectUser(u.id, u.name, u)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-lg hover:bg-primary/20 transition-all shrink-0">
                      <MessageSquarePlus size={12} /> Chat
                    </button>
                  ) : (
                    <button onClick={() => handleSendFriendRequest(u.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-secondary text-foreground text-xs font-medium rounded-lg hover:bg-secondary/80 border border-border transition-all shrink-0">
                      <UserPlus size={12} /> Add
                    </button>
                  )}
                </div>
              )
            })}
            {allUsers.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Users size={28} className="mb-2 opacity-40" />
                <p className="text-sm">No users found</p>
              </div>
            )}
          </div>
        )}

        {/* GROUPS */}
        {tab === 'groups' && (
          <div>
            <div className="px-4 py-3">
              <button
                onClick={() => setShowCreateGroup(!showCreateGroup)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 text-sm font-medium transition-all"
              >
                <Plus size={15} /> Create Group
              </button>
            </div>

            <AnimatePresence>
              {showCreateGroup && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mx-4 mb-3 p-4 bg-secondary rounded-xl border border-border">
                    <p className="text-sm font-semibold text-foreground mb-3">New Group</p>
                    <input
                      value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                      placeholder="Group name" className="input-base mb-3 py-2"
                    />
                    <p className="text-xs text-muted-foreground mb-2">Add friends:</p>
                    <div className="max-h-28 overflow-y-auto space-y-1 mb-3">
                      {friends.map(f => (
                        <label key={f.id} className="flex items-center gap-2 cursor-pointer hover:bg-background px-2 py-1 rounded-lg transition-all">
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(f.id)}
                            onChange={e => setSelectedMembers(prev => e.target.checked ? [...prev, f.id] : prev.filter(id => id !== f.id))}
                            className="rounded accent-primary"
                          />
                          <Avatar name={f.name} avatar={f.avatar} size="xs" online={onlineUsers[f.id] === 'online'} />
                          <span className="text-xs text-foreground">{f.name}</span>
                        </label>
                      ))}
                      {friends.length === 0 && <p className="text-xs text-muted-foreground px-2">No friends yet</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowCreateGroup(false)} className="flex-1 py-2 text-xs text-muted-foreground bg-background rounded-lg hover:bg-secondary transition-all border border-border">Cancel</button>
                      <button onClick={handleCreateGroup} disabled={creating || !newGroupName.trim()} className="flex-1 py-2 text-xs text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all">
                        {creating ? 'Creating…' : 'Create'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase())).map(g => {
              const gUnread = unreadCounts[`group:${g.id}`] || 0
              const isSelected = selectedId === g.id && selectedType === 'group'
              return (
                <button key={g.id} onClick={() => onSelectGroup(g.id, g.name)} className={commonItem(isSelected)}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                    <span className="text-white text-sm font-bold">{g.name[0].toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className={cn('text-sm truncate', gUnread > 0 ? 'font-bold text-foreground' : 'font-medium text-foreground')}>{g.name}</p>
                    <p className="text-xs text-muted-foreground">{g.Members?.length ?? 0} members</p>
                  </div>
                  {gUnread > 0 ? (
                    <span className="min-w-[18px] h-4.5 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-1.5 shrink-0">
                      {gUnread > 99 ? '99+' : gUnread}
                    </span>
                  ) : (
                    <ChevronRight size={14} className="text-muted-foreground/40" />
                  )}
                </button>
              )
            })}

            {groups.length === 0 && !showCreateGroup && !loading && (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Users size={26} className="mb-2 opacity-40" />
                <p className="text-sm">No groups yet</p>
              </div>
            )}
          </div>
        )}

        {/* REQUESTS */}
        {tab === 'requests' && (
          <div className="p-4 space-y-4">
            {friendRequests.incoming.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Incoming ({friendRequests.incoming.length})
                </p>
                {friendRequests.incoming.map(r => (
                  <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                    <Avatar name={r.Sender?.name || ''} avatar={r.Sender?.avatar} size="md" online={onlineUsers[r.senderId] === 'online'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.Sender?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.Sender?.email}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleRespondRequest(r.id, 'accept')}
                        className="w-8 h-8 flex items-center justify-center bg-accent/10 text-accent rounded-lg hover:bg-accent/20 transition-all">
                        <Check size={14} />
                      </button>
                      <button onClick={() => handleRespondRequest(r.id, 'reject')}
                        className="w-8 h-8 flex items-center justify-center bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-all">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {friendRequests.outgoing.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Sent ({friendRequests.outgoing.length})
                </p>
                {friendRequests.outgoing.map(r => (
                  <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                    <Avatar name={r.Receiver?.name || ''} avatar={r.Receiver?.avatar} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.Receiver?.name}</p>
                      <p className="text-xs text-muted-foreground">Pending…</p>
                    </div>
                    <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full border border-border">Sent</span>
                  </div>
                ))}
              </div>
            )}
            {friendRequests.incoming.length === 0 && friendRequests.outgoing.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <UserCheck size={28} className="mb-2 opacity-40" />
                <p className="text-sm">No friend requests</p>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
