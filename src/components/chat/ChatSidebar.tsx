'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSocket } from '@/context/SocketContext'
import { chatApi, groupApi } from '@/lib/api'
import { Conversation, User, Group, FriendRequest } from '@/types'
import Avatar from '@/components/ui/Avatar'
import {
  Search, LogOut, Shield, MessageSquarePlus, Users, UserPlus,
  Plus, Check, X, ChevronRight, Globe, UserCheck, Edit2, Save, MessageSquare
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Tab = 'chats' | 'users' | 'groups' | 'requests'

interface ChatSidebarProps {
  selectedId?: string
  selectedType?: 'personal' | 'group'
  onSelectUser: (userId: string, userName: string, user?: User) => void
  onSelectGroup: (groupId: string, groupName: string) => void
}

export default function ChatSidebar({ selectedId, selectedType, onSelectUser, onSelectGroup }: ChatSidebarProps) {
  const { user, logout, updateProfile } = useAuth()
  const { onlineUsers, unreadCounts, onNewMessage, onNewGroupMessage } = useSocket()
  const router = useRouter()

  const [tab, setTab] = useState<Tab>('chats')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [friends, setFriends] = useState<User[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [friendRequests, setFriendRequests] = useState<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>({ incoming: [], outgoing: [] })
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  // Profile card
  const [showProfile, setShowProfile] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(user?.name || '')
  const [savingName, setSavingName] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchConversations = useCallback(async () => {
    try {
      const res = await chatApi.getConversations()
      setConversations(res.data.data.conversations)
    } catch { }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const res = await groupApi.getAllUsers(search)
      setAllUsers(res.data.data)
    } catch { }
  }, [search])

  const fetchFriends = useCallback(async () => {
    try {
      const res = await groupApi.getFriends()
      setFriends(res.data.data)
    } catch { }
  }, [])

  const fetchGroups = useCallback(async () => {
    try {
      const res = await groupApi.getMyGroups()
      setGroups(res.data.data)
    } catch { }
  }, [])

  const fetchRequests = useCallback(async () => {
    try {
      const res = await groupApi.getFriendRequests()
      setFriendRequests(res.data.data)
    } catch { }
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  // Refetch conversations when new message arrives for unread count
  useEffect(() => {
    const off1 = onNewMessage(() => fetchConversations())
    const off2 = onNewGroupMessage(() => { /* groups handle their own */ })
    return () => { off1(); off2() }
  }, [onNewMessage, onNewGroupMessage, fetchConversations])

  useEffect(() => {
    setLoading(true)
    const tasks: Promise<any>[] = []
    if (tab === 'chats') tasks.push(fetchConversations())
    if (tab === 'users') tasks.push(fetchUsers(), fetchFriends())
    if (tab === 'groups') tasks.push(fetchGroups(), fetchFriends())
    if (tab === 'requests') tasks.push(fetchRequests())
    Promise.all(tasks).finally(() => setLoading(false))
  }, [tab])

  useEffect(() => {
    if (tab === 'users') fetchUsers()
  }, [search, tab])

  // Close profile card on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false)
        setEditingName(false)
      }
    }
    if (showProfile) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showProfile])

  useEffect(() => { setNameInput(user?.name || '') }, [user?.name])

  const handleLogout = async () => {
    await logout()
    router.push('/auth/login')
  }

  const handleSendFriendRequest = async (receiverId: string) => {
    try {
      await groupApi.sendFriendRequest(receiverId)
      showToast('Friend request sent!')
      fetchUsers()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed', 'error')
    }
  }

  const handleRespondRequest = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      await groupApi.respondFriendRequest(requestId, action)
      showToast(`Request ${action}ed!`)
      fetchRequests()
      if (action === 'accept') { fetchFriends(); fetchConversations() }
    } catch { showToast('Failed', 'error') }
  }

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return
    setCreating(true)
    try {
      const res = await groupApi.createGroup({ name: newGroupName, memberIds: selectedMembers })
      showToast('Group created!')
      setShowCreateGroup(false)
      setNewGroupName('')
      setSelectedMembers([])
      fetchGroups()
      setTab('groups')
      onSelectGroup(res.data.data.id, res.data.data.name)
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed', 'error')
    } finally { setCreating(false) }
  }

  const handleSaveName = async () => {
    if (!nameInput.trim() || nameInput.trim() === user?.name) { setEditingName(false); return }
    setSavingName(true)
    try {
      await updateProfile(nameInput.trim())
      showToast('Name updated!')
      setEditingName(false)
    } catch { showToast('Failed to update name', 'error') }
    finally { setSavingName(false) }
  }

  const getOnlineStatus = (userId: string) => onlineUsers[userId] === 'online'

  const pendingCount = friendRequests.incoming.length

  // Total unread for chats tab badge
  const totalChatUnread = conversations.reduce((sum, c) => {
    const roomUnread = unreadCounts[c.roomId]
    return sum + (roomUnread !== undefined ? roomUnread : (c.unreadCount || 0))
  }, 0)

  // Total unread for groups tab
  const totalGroupUnread = groups.reduce((sum, g) => sum + (unreadCounts[`group:${g.id}`] || 0), 0)

  const TABS = [
    { id: 'chats' as Tab, label: 'Chats', icon: MessageSquarePlus, badge: totalChatUnread },
    { id: 'users' as Tab, label: 'People', icon: Globe },
    { id: 'groups' as Tab, label: 'Groups', icon: Users, badge: totalGroupUnread },
    { id: 'requests' as Tab, label: 'Requests', icon: UserCheck, badge: pendingCount },
  ]

  return (
    <aside className="w-80 h-full flex flex-col bg-surface-900 border-r border-slate-800/60 relative">
      {toast && (
        <div className={`absolute top-4 left-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium text-white shadow-lg ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-800/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
              <MessageSquarePlus size={16} className="text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-base">NexChat</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${onlineUsers ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                <span className="text-xs text-slate-500">Connected</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {user?.role === 'admin' && (
              <Link href="/admin" className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all" title="Admin Panel">
                <Shield size={16} />
              </Link>
            )}
          </div>
        </div>

        {/* Profile mini card - clickable */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setShowProfile(v => !v); setEditingName(false) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 bg-surface-800/60 rounded-xl mb-3 hover:bg-surface-800 transition-all text-left"
          >
            <Avatar name={user?.name || ''} avatar={user?.avatar} size="sm" online={true} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          </button>

          {/* Profile Dropdown Card */}
          {showProfile && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-surface-800 border border-slate-700/60 rounded-xl shadow-2xl p-4 animate-fade-in">
              {/* Avatar large */}
              <div className="flex flex-col items-center mb-4">
                <Avatar name={user?.name || ''} avatar={user?.avatar} size="xl" online={true} />
                <div className="mt-2 text-xs text-emerald-400 font-medium">● Online</div>
              </div>

              {/* Name edit */}
              <div className="mb-3">
                <p className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-semibold">Display Name</p>
                {editingName ? (
                  <div className="flex gap-2">
                    <input
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                      autoFocus
                      className="flex-1 bg-surface-900 border border-brand-500/50 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none"
                      placeholder="Enter name..."
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={savingName}
                      className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs rounded-lg transition-all disabled:opacity-50 flex items-center gap-1"
                    >
                      {savingName ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <Save size={12} />}
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-surface-900 rounded-lg px-3 py-2">
                    <span className="text-sm text-white font-medium">{user?.name}</span>
                    <button onClick={() => setEditingName(true)} className="text-slate-500 hover:text-brand-400 transition-colors">
                      <Edit2 size={13} />
                    </button>
                  </div>
                )}
              </div>

              {/* Email */}
              <div className="mb-4">
                <p className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-semibold">Email</p>
                <div className="bg-surface-900 rounded-lg px-3 py-2">
                  <p className="text-sm text-slate-400 truncate">{user?.email}</p>
                </div>
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-medium transition-all border border-red-500/20"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'users' ? 'Search people...' : 'Search...'}
            className="w-full bg-surface-800 border border-slate-700/50 text-white placeholder-slate-500 text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-brand-500/50 transition-all"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800/60">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-all relative ${tab === t.id ? 'text-brand-400 border-b-2 border-brand-500' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <t.icon size={14} />
            {t.label}
            {t.badge ? (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {t.badge > 99 ? '99+' : t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* CHATS TAB */}
        {tab === 'chats' && (
          <div>
            {conversations.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                <MessageSquare size={32} className="mb-2 opacity-40" />
                <p className="text-sm">No conversations yet</p>
                <button onClick={() => setTab('users')} className="mt-2 text-xs text-brand-400 hover:underline">Find people</button>
              </div>
            )}
            {conversations
              .filter(c => c.user?.name?.toLowerCase().includes(search.toLowerCase()))
              .map(c => {
                const roomUnread = unreadCounts[c.roomId] !== undefined ? unreadCounts[c.roomId] : (c.unreadCount || 0)
                const isSelected = selectedId === c.user.id && selectedType === 'personal'
                return (
                  <button
                    key={c.roomId}
                    onClick={() => onSelectUser(c.user.id, c.user.name, c.user)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-800/60 transition-all ${isSelected ? 'bg-surface-800 border-r-2 border-brand-500' : ''}`}
                  >
                    <Avatar name={c.user.name} avatar={c.user.avatar} size="md" online={getOnlineStatus(c.user.id)} />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm truncate ${roomUnread > 0 ? 'font-bold text-white' : 'font-semibold text-white'}`}>{c.user.name}</span>
                        <span className="text-xs text-slate-600 shrink-0 ml-2">
                          {formatDistanceToNow(new Date(c.lastMessage.createdAt), { addSuffix: false })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className={`text-xs truncate ${roomUnread > 0 ? 'text-white font-medium' : 'text-slate-500'}`}>
                          {c.lastMessage.senderId === user?.id ? 'You: ' : ''}{c.lastMessage.message}
                        </p>
                        {roomUnread > 0 && (
                          <span className="min-w-[18px] h-4.5 bg-brand-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1.5 shrink-0 ml-1">
                            {roomUnread > 99 ? '99+' : roomUnread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
          </div>
        )}

        {/* USERS TAB */}
        {tab === 'users' && (
          <div>
            {allUsers.map(u => {
              const isFriend = friends.some(f => f.id === u.id)
              return (
                <div key={u.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-800/40 transition-all">
                  <Avatar name={u.name} avatar={u.avatar} size="md" online={getOnlineStatus(u.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{u.name}</p>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isFriend ? (
                      <button
                        onClick={() => onSelectUser(u.id, u.name, u)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-500/15 text-brand-400 text-xs font-medium rounded-lg hover:bg-brand-500/25 transition-all"
                      >
                        <MessageSquarePlus size={12} /> Chat
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSendFriendRequest(u.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-700/60 text-slate-300 text-xs font-medium rounded-lg hover:bg-slate-700 transition-all"
                      >
                        <UserPlus size={12} /> Add
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            {allUsers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-600">
                <Users size={32} className="mb-2 opacity-40" />
                <p className="text-sm">No users found</p>
              </div>
            )}
          </div>
        )}

        {/* GROUPS TAB */}
        {tab === 'groups' && (
          <div>
            <div className="px-4 py-3">
              <button
                onClick={() => setShowCreateGroup(!showCreateGroup)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-brand-500/50 hover:text-brand-400 hover:bg-brand-500/5 text-sm font-medium transition-all"
              >
                <Plus size={16} /> Create Group
              </button>
            </div>

            {showCreateGroup && (
              <div className="mx-4 mb-3 p-4 bg-surface-800 rounded-xl border border-slate-700/50">
                <p className="text-sm font-semibold text-white mb-3">New Group</p>
                <input
                  value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                  placeholder="Group name"
                  className="w-full bg-surface-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-2 mb-3 focus:outline-none focus:border-brand-500/50"
                />
                <p className="text-xs text-slate-500 mb-2">Add friends:</p>
                <div className="max-h-32 overflow-y-auto space-y-1 mb-3">
                  {friends.map(f => (
                    <label key={f.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(f.id)}
                        onChange={e => setSelectedMembers(prev => e.target.checked ? [...prev, f.id] : prev.filter(id => id !== f.id))}
                        className="rounded text-brand-500"
                      />
                      <Avatar name={f.name} avatar={f.avatar} size="xs" online={getOnlineStatus(f.id)} />
                      <span className="text-xs text-slate-300">{f.name}</span>
                    </label>
                  ))}
                  {friends.length === 0 && <p className="text-xs text-slate-600">No friends yet</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowCreateGroup(false)} className="flex-1 py-2 text-xs text-slate-400 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-all">Cancel</button>
                  <button onClick={handleCreateGroup} disabled={creating || !newGroupName.trim()} className="flex-1 py-2 text-xs text-white bg-brand-600 rounded-lg hover:bg-brand-500 disabled:opacity-50 transition-all">
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            )}

            {groups
              .filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
              .map(g => {
                const gUnread = unreadCounts[`group:${g.id}`] || 0
                const isSelected = selectedId === g.id && selectedType === 'group'
                return (
                  <button
                    key={g.id}
                    onClick={() => onSelectGroup(g.id, g.name)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-800/60 transition-all ${isSelected ? 'bg-surface-800 border-r-2 border-brand-500' : ''}`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                        <span className="text-white text-sm font-bold">{g.name[0].toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className={`text-sm truncate ${gUnread > 0 ? 'font-bold text-white' : 'font-semibold text-white'}`}>{g.name}</p>
                      <p className="text-xs text-slate-500">{g.Members?.length || 0} members</p>
                    </div>
                    {gUnread > 0 ? (
                      <span className="min-w-[18px] h-5 bg-brand-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1.5 shrink-0">
                        {gUnread > 99 ? '99+' : gUnread}
                      </span>
                    ) : (
                      <ChevronRight size={14} className="text-slate-600" />
                    )}
                  </button>
                )
              })}

            {groups.length === 0 && !showCreateGroup && (
              <div className="flex flex-col items-center justify-center py-8 text-slate-600">
                <Users size={28} className="mb-2 opacity-40" />
                <p className="text-sm">No groups yet</p>
              </div>
            )}
          </div>
        )}

        {/* REQUESTS TAB */}
        {tab === 'requests' && (
          <div className="p-4 space-y-4">
            {friendRequests.incoming.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Incoming ({friendRequests.incoming.length})</p>
                {friendRequests.incoming.map(r => (
                  <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-slate-800/50 last:border-0">
                    <Avatar name={r.Sender?.name || ''} avatar={r.Sender?.avatar} size="md" online={getOnlineStatus(r.senderId)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{r.Sender?.name}</p>
                      <p className="text-xs text-slate-500 truncate">{r.Sender?.email}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleRespondRequest(r.id, 'accept')} className="w-8 h-8 flex items-center justify-center bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-all">
                        <Check size={14} />
                      </button>
                      <button onClick={() => handleRespondRequest(r.id, 'reject')} className="w-8 h-8 flex items-center justify-center bg-red-500/15 text-red-400 rounded-lg hover:bg-red-500/25 transition-all">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {friendRequests.outgoing.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Sent ({friendRequests.outgoing.length})</p>
                {friendRequests.outgoing.map(r => (
                  <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-slate-800/50 last:border-0">
                    <Avatar name={r.Receiver?.name || ''} avatar={r.Receiver?.avatar} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{r.Receiver?.name}</p>
                      <p className="text-xs text-slate-500">Pending...</p>
                    </div>
                    <span className="text-xs text-slate-600 bg-slate-800 px-2 py-1 rounded-full">Sent</span>
                  </div>
                ))}
              </div>
            )}
            {friendRequests.incoming.length === 0 && friendRequests.outgoing.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-600">
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
