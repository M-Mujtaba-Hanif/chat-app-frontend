'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSocket } from '@/context/SocketContext'
import { chatApi, groupApi } from '@/lib/api'
import { Message, User, Group } from '@/types'
import Avatar from '@/components/ui/Avatar'
import {
  Send, ArrowLeft, Users, UserPlus, UserMinus,
  Trash2, CornerUpLeft, X, Info, Plus,
  LogOut, Shield, CheckCheck, Check, Reply
} from 'lucide-react'
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns'

interface ChatWindowProps {
  otherUserId?: string
  otherUserName?: string
  otherUser?: User
  groupId?: string
  groupName?: string
  type: 'personal' | 'group'
  onBack?: () => void
}

function formatTime(date: string) {
  const d = new Date(date)
  if (isToday(d)) return format(d, 'h:mm a')
  if (isYesterday(d)) return `Yesterday ${format(d, 'h:mm a')}`
  return format(d, 'MMM d, h:mm a')
}

function groupByDate(messages: Message[]) {
  const groups: { label: string; messages: Message[] }[] = []
  let currentLabel = ''
  messages.forEach(msg => {
    const d = new Date(msg.createdAt)
    const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMMM d, yyyy')
    if (label !== currentLabel) {
      currentLabel = label
      groups.push({ label, messages: [msg] })
    } else {
      groups[groups.length - 1].messages.push(msg)
    }
  })
  return groups
}

// Message tick component
function MessageTick({ delivered, read }: { delivered?: boolean; read: boolean }) {
  if (read) return <CheckCheck size={11} className="text-emerald-400" />
  if (delivered) return <CheckCheck size={11} className="text-white/50" />
  return <Check size={11} className="text-white/40" />
}

export default function ChatWindow({ otherUserId, otherUserName, otherUser, groupId, groupName, type, onBack }: ChatWindowProps) {
  const { user } = useAuth()
  const {
    sendMessage, sendGroupMessage, sendTyping, sendGroupTyping,
    joinRoom, markRead, deleteMessage,
    onNewMessage, onNewGroupMessage, onMessagesRead, onMessageDeleted, onMessageDelivered, onUserLeftGroup,
    onlineUsers, lastSeenMap, typingUsers, groupTypingUsers,
    setActiveRoom, clearUnread,
  } = useSocket()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [groupInfo, setGroupInfo] = useState<Group | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [friends, setFriends] = useState<User[]>([])
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msgId: string; isMine: boolean; msg: Message } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const roomId = type === 'personal' && otherUserId
    ? [user?.id, otherUserId].sort().join('_')
    : `group:${groupId}`

  const isOnline = type === 'personal' ? onlineUsers[otherUserId!] === 'online' : false
  const isTyping = type === 'personal'
    ? typingUsers[otherUserId!]
    : Object.values(groupTypingUsers[groupId!] || {}).some(Boolean)

  const typingNames = type === 'group'
    ? Object.entries(groupTypingUsers[groupId!] || {})
        .filter(([, v]) => v)
        .map(([uid]) => groupInfo?.Members?.find(m => m.id === uid)?.name || 'Someone')
    : []

  const isGroupAdmin = type === 'group' && groupInfo?.Members?.some(
    m => m.id === user?.id && (m as any).GroupMember?.role === 'admin'
  )

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // Clear input when conversation changes
  useEffect(() => {
    setInput('')
    setReplyTo(null)
  }, [otherUserId, groupId])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      if (type === 'personal' && otherUserId) {
        const res = await chatApi.getChatHistory(otherUserId)
        setMessages([...res.data.data.messages].reverse())
        markRead(roomId, otherUserId)
        clearUnread(roomId)
      } else if (type === 'group' && groupId) {
        const res = await groupApi.getGroupMessages(groupId)
        setMessages(res.data.data.messages)
        const gRes = await groupApi.getGroupById(groupId)
        setGroupInfo(gRes.data.data)
        clearUnread(roomId)
      }
    } catch { }
    finally { setLoading(false) }
  }, [otherUserId, groupId, type])

  useEffect(() => {
    fetchHistory()
    joinRoom(roomId)
    setActiveRoom(roomId)
    return () => setActiveRoom(null)
  }, [otherUserId, groupId])

  useEffect(() => { scrollToBottom() }, [messages])

  // Socket listeners
  useEffect(() => {
    const offNew = onNewMessage((msg) => {
      if (msg.roomId === roomId) {
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        if (otherUserId) markRead(roomId, otherUserId)
        clearUnread(roomId)
      }
    })
    const offGroup = onNewGroupMessage((msg) => {
      if (msg.roomId === roomId) {
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        clearUnread(roomId)
      }
    })
    const offRead = onMessagesRead(({ roomId: rId }) => {
      if (rId === roomId) setMessages(prev => prev.map(m => ({ ...m, read: true })))
    })
    const offDel = onMessageDeleted(({ messageId, roomId: rId }) => {
      if (rId === roomId) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, deletedForAll: true, message: 'This message was deleted' } : m))
      }
    })
    const offDelivered = onMessageDelivered(({ messageId, roomId: rId }) => {
      if (rId === roomId) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, delivered: true } : m))
      }
    })
    const offLeft = onUserLeftGroup(({ groupId: gId }) => {
      if (gId === groupId) {
        groupApi.getGroupById(gId).then(r => setGroupInfo(r.data.data)).catch(() => {})
      }
    })
    return () => { offNew(); offGroup(); offRead(); offDel(); offDelivered(); offLeft() }
  }, [roomId, otherUserId, groupId])

  const handleSend = async () => {
    if (!input.trim() || sending) return
    const text = input.trim()
    const replyToId = replyTo?.id
    setInput('')
    setReplyTo(null)
    setSending(true)

    if (type === 'personal' && otherUserId) sendTyping(otherUserId, false)
    if (type === 'group' && groupId) sendGroupTyping(groupId, false)

    try {
      if (type === 'personal' && otherUserId) {
        await new Promise<void>((resolve, reject) => {
          sendMessage(otherUserId, text, roomId, replyToId, (res) => {
            if (res?.success) { setMessages(prev => prev.some(m => m.id === res.message?.id) ? prev : [...prev, res.message]); resolve() }
            else reject(new Error(res?.error || 'Failed'))
          })
        })
      } else if (type === 'group' && groupId) {
        await new Promise<void>((resolve, reject) => {
          sendGroupMessage(groupId, text, replyToId, (res) => {
            if (res?.success) { setMessages(prev => prev.some(m => m.id === res.message?.id) ? prev : [...prev, res.message]); resolve() }
            else { showToast(res?.error || 'Failed to send'); reject() }
          })
        })
      }
    } catch(e: any) { if (e?.message) showToast(e.message) }
    finally { setSending(false); inputRef.current?.focus() }
  }

  const handleTyping = () => {
    if (type === 'personal' && otherUserId) {
      sendTyping(otherUserId, true)
      if (typingRef.current) clearTimeout(typingRef.current)
      typingRef.current = setTimeout(() => sendTyping(otherUserId, false), 2000)
    }
    if (type === 'group' && groupId) {
      sendGroupTyping(groupId, true)
      if (typingRef.current) clearTimeout(typingRef.current)
      typingRef.current = setTimeout(() => sendGroupTyping(groupId, false), 2000)
    }
  }

  const handleDeleteMsg = (msgId: string, forAll: boolean) => {
    setContextMenu(null)
    deleteMessage(msgId, forAll, (res) => {
      if (res?.success) {
        if (forAll) setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deletedForAll: true, message: 'This message was deleted' } : m))
        else setMessages(prev => prev.filter(m => m.id !== msgId))
      }
    })
  }

  const handleContextMenu = (e: React.MouseEvent, msg: Message) => {
    e.preventDefault()
    const isMine = msg.senderId === user?.id
    // Clamp position to viewport
    const menuW = 180, menuH = 100
    const x = Math.min(e.clientX, window.innerWidth - menuW - 8)
    const y = Math.min(e.clientY, window.innerHeight - menuH - 8)
    setContextMenu({ x, y, msgId: msg.id, isMine, msg })
  }

  const handleLeaveGroup = async () => {
    if (!groupId) return
    try {
      await groupApi.leaveGroup(groupId)
      onBack?.()
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to leave group')
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!groupId) return
    try {
      await groupApi.removeMember(groupId, userId)
      const res = await groupApi.getGroupById(groupId)
      setGroupInfo(res.data.data)
      showToast('Member removed')
    } catch { showToast('Failed to remove member') }
  }

  const handleAddMember = async (userId: string) => {
    if (!groupId) return
    try {
      await groupApi.addMember(groupId, userId)
      const res = await groupApi.getGroupById(groupId)
      setGroupInfo(res.data.data)
      showToast('Member added!')
    } catch (err: any) { showToast(err?.response?.data?.message || 'Failed') }
  }

  const handleToggleAdminOnly = async () => {
    if (!groupId || !groupInfo) return
    try {
      await groupApi.updateGroupSettings(groupId, { onlyAdminCanSend: !groupInfo.onlyAdminCanSend })
      setGroupInfo(prev => prev ? { ...prev, onlyAdminCanSend: !prev.onlyAdminCanSend } : prev)
      showToast(`Only admins can send: ${!groupInfo.onlyAdminCanSend ? 'ON' : 'OFF'}`)
    } catch { showToast('Failed to update setting') }
  }

  const fetchFriends = async () => {
    try {
      const res = await groupApi.getFriends()
      setFriends(res.data.data)
    } catch { }
  }

  // Subtitle: online/offline with last seen
  const lastSeen = lastSeenMap[otherUserId!] || otherUser?.lastSeen
  const subtitle = type === 'personal'
    ? isOnline
      ? 'Online'
      : lastSeen
        ? `Last seen ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}`
        : 'Offline'
    : `${groupInfo?.Members?.length || 0} members`

  const messageGroups = groupByDate(messages)

  // Non-member friends for add member
  const nonMemberFriends = friends.filter(f => !groupInfo?.Members?.some(m => m.id === f.id))

  return (
    <div className="flex flex-col h-full bg-surface-950 flex-1 relative" onClick={() => setContextMenu(null)}>
      {/* Toast */}
      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white shadow-xl animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800/60 bg-surface-900 shrink-0">
        {onBack && (
          <button onClick={onBack} className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors">
            <ArrowLeft size={18} />
          </button>
        )}
        {type === 'personal' ? (
          <Avatar name={otherUserName || ''} avatar={otherUser?.avatar} size="md" online={isOnline} />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold">{groupName?.[0]?.toUpperCase()}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white truncate">{type === 'personal' ? otherUserName : groupName}</h2>
          <div className="flex items-center gap-1.5">
            {type === 'personal' && (
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-600'}`} />
            )}
            <span className={`text-xs ${isOnline && type === 'personal' ? 'text-emerald-400' : 'text-slate-500'}`}>{subtitle}</span>
          </div>
        </div>
        {type === 'group' && (
          <button
            onClick={() => {
              setShowInfo(v => !v)
              setShowAddMember(false)
              if (!showInfo) fetchFriends()
            }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all"
          >
            <Info size={16} />
          </button>
        )}
      </div>

      {/* Group info panel */}
      {showInfo && type === 'group' && groupInfo && (
        <div className="absolute top-16 right-2 z-40 w-80 bg-surface-900 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
          {/* Group header */}
          <div className="p-4 border-b border-slate-800/60">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-lg">{groupInfo.name[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold">{groupInfo.name}</p>
                <p className="text-xs text-slate-500">{groupInfo.Members?.length} members</p>
              </div>
            </div>

            {/* Admin controls */}
            {isGroupAdmin && (
              <div className="space-y-2">
                <button
                  onClick={handleToggleAdminOnly}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${groupInfo.onlyAdminCanSend ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}
                >
                  <div className="flex items-center gap-2">
                    <Shield size={12} />
                    Only admins can send
                  </div>
                  <div className={`w-8 h-4 rounded-full transition-colors ${groupInfo.onlyAdminCanSend ? 'bg-amber-500' : 'bg-slate-600'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full mt-0.5 transition-transform ${groupInfo.onlyAdminCanSend ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                  </div>
                </button>
                <button
                  onClick={() => { setShowAddMember(v => !v) }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-brand-500/10 text-brand-400 border border-brand-500/20 hover:bg-brand-500/20 transition-all"
                >
                  <UserPlus size={12} /> Add Members
                </button>
                {showAddMember && nonMemberFriends.length > 0 && (
                  <div className="bg-surface-800 rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto">
                    {nonMemberFriends.map(f => (
                      <button key={f.id} onClick={() => handleAddMember(f.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-700/50 rounded-lg transition-all text-left">
                        <Avatar name={f.name} avatar={f.avatar} size="xs" online={onlineUsers[f.id] === 'online'} />
                        <span className="text-xs text-slate-300 truncate">{f.name}</span>
                        <Plus size={12} className="ml-auto text-brand-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Members list */}
          <div className="p-3 max-h-56 overflow-y-auto">
            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-2 px-1">Members</p>
            {groupInfo.Members?.map(m => {
              const role = (m as any).GroupMember?.role
              const isMe = m.id === user?.id
              return (
                <div key={m.id} className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-slate-800/40 transition-all">
                  <Avatar name={m.name} avatar={m.avatar} size="xs" online={onlineUsers[m.id] === 'online'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{m.name}{isMe ? ' (You)' : ''}</p>
                    {role === 'admin' && (
                      <span className="text-[9px] text-amber-400 font-medium">Admin</span>
                    )}
                  </div>
                  {isGroupAdmin && !isMe && (
                    <button onClick={() => handleRemoveMember(m.id)} className="p-1 text-slate-600 hover:text-red-400 transition-colors">
                      <UserMinus size={11} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Leave group */}
          <div className="p-3 border-t border-slate-800/60">
            <button
              onClick={handleLeaveGroup}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all"
            >
              <LogOut size={12} /> Leave Group
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scroll-smooth">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600">
            <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-3">
              {type === 'personal' ? <Avatar name={otherUserName || ''} avatar={otherUser?.avatar} size="lg" /> : <Users size={28} />}
            </div>
            <p className="text-sm font-medium text-slate-500">Say hello to {type === 'personal' ? otherUserName : groupName}!</p>
            <p className="text-xs text-slate-600 mt-1">This is the start of your conversation</p>
          </div>
        ) : (
          messageGroups.map(({ label, messages: grpMsgs }) => (
            <div key={label}>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-slate-800/60" />
                <span className="text-xs text-slate-600 px-3 py-1 bg-surface-900 rounded-full border border-slate-800/50">{label}</span>
                <div className="flex-1 h-px bg-slate-800/60" />
              </div>
              {grpMsgs.map((msg, i) => {
                const isMine = msg.senderId === user?.id
                const isDeleted = msg.deletedForAll
                const prevMsg = i > 0 ? grpMsgs[i - 1] : null
                const sameSender = prevMsg?.senderId === msg.senderId
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${sameSender ? 'mt-0.5' : 'mt-3'}`}
                    onContextMenu={(e) => !isDeleted && handleContextMenu(e, msg)}
                  >
                    {!isMine && !sameSender && type === 'group' && (
                      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 mr-2 shrink-0 self-end mb-1">
                        {(msg.Sender?.name || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    {!isMine && sameSender && type === 'group' && <div className="w-9" />}
                    <div className="max-w-[70%]">
                      {!isMine && !sameSender && type === 'group' && (
                        <p className="text-[10px] text-slate-500 ml-1 mb-0.5">{msg.Sender?.name}</p>
                      )}
                      <div className={`px-3.5 py-2 rounded-2xl text-sm relative ${
                        isDeleted
                          ? 'bg-slate-800/50 text-slate-600 italic border border-slate-700/40'
                          : isMine
                            ? 'bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-br-sm'
                            : 'bg-surface-800 text-slate-200 rounded-bl-sm'
                      }`}>
                        {/* Reply preview */}
                        {msg.ReplyTo && !isDeleted && (
                          <div className={`mb-2 px-2.5 py-1.5 rounded-lg text-xs border-l-2 ${isMine ? 'bg-white/10 border-white/30 text-white/70' : 'bg-slate-700/50 border-brand-500/50 text-slate-400'}`}>
                            <p className="font-semibold mb-0.5 text-[10px] uppercase tracking-wide opacity-70">
                              {msg.ReplyTo.senderId === user?.id ? 'You' : (msg.Sender?.name || 'Someone')}
                            </p>
                            <p className="truncate">{msg.ReplyTo.message}</p>
                          </div>
                        )}
                        <p className="leading-relaxed break-words">{msg.message}</p>
                        <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <span className={`text-[10px] ${isMine ? 'text-brand-300/60' : 'text-slate-600'}`}>
                            {format(new Date(msg.createdAt), 'h:mm a')}
                          </span>
                          {isMine && !isDeleted && (
                            <MessageTick delivered={msg.delivered} read={msg.read} />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex justify-start mt-2">
            <div className="bg-surface-800 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1">
              {type === 'group' && typingNames.length > 0 && (
                <span className="text-xs text-slate-500 mr-2">{typingNames.join(', ')}</span>
              )}
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-surface-800 border border-slate-700/50 rounded-xl shadow-2xl py-1.5 min-w-[160px] overflow-hidden"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          {/* Reply - available for all non-deleted messages */}
          {!contextMenu.msg.deletedForAll && (
            <button
              onClick={() => { setReplyTo(contextMenu.msg); setContextMenu(null); inputRef.current?.focus() }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50 transition-all"
            >
              <CornerUpLeft size={13} /> Reply
            </button>
          )}
          {contextMenu.isMine && !contextMenu.msg.deletedForAll && (
            <>
              {contextMenu.msg.type === 'personal' || type === 'personal' ? (
                <div className="h-px bg-slate-700/50 mx-2 my-1" />
              ) : null}
              <button
                onClick={() => handleDeleteMsg(contextMenu.msgId, true)}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-all"
              >
                <Trash2 size={13} /> Delete for everyone
              </button>
              <button
                onClick={() => handleDeleteMsg(contextMenu.msgId, false)}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-400 hover:bg-slate-700/50 transition-all"
              >
                <Trash2 size={13} /> Delete for me
              </button>
            </>
          )}
        </div>
      )}

      {/* Reply Preview Bar */}
      {replyTo && (
        <div className="mx-4 mb-2 px-3 py-2.5 bg-surface-800 border border-slate-700/50 rounded-xl flex items-start gap-3">
          <Reply size={14} className="text-brand-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-brand-400 font-semibold mb-0.5">
              {replyTo.senderId === user?.id ? 'You' : (replyTo.Sender?.name || 'Someone')}
            </p>
            <p className="text-xs text-slate-400 truncate">{replyTo.message}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-slate-600 hover:text-slate-400 transition-colors shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-800/60 bg-surface-900 shrink-0">
        {type === 'group' && groupInfo?.onlyAdminCanSend && !isGroupAdmin ? (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-slate-500">
            <Shield size={14} className="text-amber-500/60" />
            Only admins can send messages
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-surface-800 rounded-xl px-4 py-2.5 border border-slate-700/50 focus-within:border-brand-500/40 transition-all">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => { setInput(e.target.value); handleTyping() }}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={`Message ${type === 'personal' ? otherUserName : groupName}...`}
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 outline-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="w-8 h-8 flex items-center justify-center bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all shrink-0"
            >
              <Send size={14} className="text-white" />
            </button>
          </div>
        )}
        <p className="text-[10px] text-slate-700 text-center mt-1.5">Press Enter to send · Right-click to reply or delete</p>
      </div>
    </div>
  )
}
