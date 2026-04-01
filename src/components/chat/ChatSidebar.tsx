'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSocket } from '@/context/SocketContext'
import { chatApi } from '@/lib/api'
import { Conversation } from '@/types'
import Avatar from '@/components/ui/Avatar'
import { Search, MessageSquarePlus, LogOut, Settings, Shield } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface ChatSidebarProps {
  selectedUserId?: string
  onSelectUser: (userId: string, userName: string) => void
}

export default function ChatSidebar({ selectedUserId, onSelectUser }: ChatSidebarProps) {
  const { user, logout } = useAuth()
  const { onlineUsers, connected } = useSocket()
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await chatApi.getConversations()
      setConversations(res.data.data.conversations)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  const handleLogout = async () => {
    await logout()
    router.push('/auth/login')
  }

  const filtered = conversations.filter(c =>
    c.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.user?.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <aside className="w-80 h-full flex flex-col bg-surface-900 border-r border-slate-800/60">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
              <MessageSquarePlus size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-none">NexChat</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-accent-500' : 'bg-slate-600'}`} />
                <span className="text-xs text-slate-500">{connected ? 'Connected' : 'Offline'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {user?.role === 'admin' && (
              <Link href="/admin"
                className="p-2 text-slate-400 hover:text-brand-400 hover:bg-brand-500/10 rounded-lg transition-all">
                <Shield size={18} />
              </Link>
            )}
            <button onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* User profile mini */}
        <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-800/60 rounded-xl mb-4">
          <Avatar name={user?.name || 'You'} avatar={user?.avatar} size="sm" online={true} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-accent-500 shrink-0" />
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-surface-800 border border-slate-700/50 text-white placeholder-slate-500 text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 transition-all"
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
          Recent Chats {conversations.length > 0 && `(${conversations.length})`}
        </p>

        {loading ? (
          <div className="space-y-2 px-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
                <div className="w-10 h-10 rounded-full bg-slate-700 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-slate-700 rounded w-3/4" />
                  <div className="h-2.5 bg-slate-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <MessageSquarePlus size={24} className="text-slate-600" />
            </div>
            <p className="text-slate-500 text-sm font-medium">No conversations yet</p>
            <p className="text-slate-600 text-xs mt-1">Start a new chat to get going</p>
          </div>
        ) : (
          filtered.map(conv => {
            const isOnline = onlineUsers[conv.user?.id] === 'online'
            const isSelected = selectedUserId === conv.user?.id
            const isMine = conv.lastMessage.senderId === user?.id
            const isUnread = !conv.lastMessage.read && !isMine

            return (
              <button
                key={conv.roomId}
                onClick={() => onSelectUser(conv.user.id, conv.user.name)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 text-left group relative
                  ${isSelected
                    ? 'bg-brand-600/15 border border-brand-500/25 sidebar-item-active'
                    : 'hover:bg-surface-800/60 border border-transparent'
                  }`}
              >
                <Avatar name={conv.user?.name || '?'} avatar={conv.user?.avatar} size="md" online={isOnline} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold truncate ${isSelected ? 'text-brand-200' : 'text-white'}`}>
                      {conv.user?.name}
                    </span>
                    <span className="text-xs text-slate-600 shrink-0 ml-2">
                      {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: false })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className={`text-xs truncate ${isUnread ? 'text-white font-medium' : 'text-slate-500'}`}>
                      {isMine && <span className="text-slate-600">You: </span>}
                      {conv.lastMessage.message}
                    </p>
                    {isUnread && (
                      <span className="ml-2 w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}
