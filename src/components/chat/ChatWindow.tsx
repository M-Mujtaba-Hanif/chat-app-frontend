'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSocket } from '@/context/SocketContext'
import { chatApi, groupApi } from '@/lib/api'
import { Message, User, Group } from '@/types'
import Avatar from '@/components/ui/Avatar'
import {
  Send, Check, CheckCheck, ArrowLeft, Phone, Video,
  MoreVertical, Trash2, Users, UserPlus, UserMinus, Info
} from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'

interface ChatWindowProps {
  otherUserId?: string
  otherUserName?: string
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

export default function ChatWindow({ otherUserId, otherUserName, groupId, groupName, type, onBack }: ChatWindowProps) {
  const { user } = useAuth()
  const {
    sendMessage, sendGroupMessage, sendTyping, sendGroupTyping,
    joinRoom, markRead, deleteMessage,
    onNewMessage, onNewGroupMessage, onMessagesRead, onMessageDeleted,
    onlineUsers, typingUsers, groupTypingUsers,
  } = useSocket()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [groupInfo, setGroupInfo] = useState<Group | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msgId: string; isMine: boolean } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
      } else if (type === 'group' && groupId) {
        const res = await groupApi.getGroupMessages(groupId)
        setMessages(res.data.data.messages)
        const gRes = await groupApi.getGroupById(groupId)
        setGroupInfo(gRes.data.data)
      }
    } catch { }
    finally { setLoading(false) }
  }, [otherUserId, groupId, type])

  useEffect(() => {
    fetchHistory()
    joinRoom(roomId)
  }, [otherUserId, groupId])

  useEffect(() => { scrollToBottom() }, [messages])

  // Socket listeners
  useEffect(() => {
    const offNew = onNewMessage((msg) => {
      if (msg.roomId === roomId) {
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        if (otherUserId) markRead(roomId, otherUserId)
      }
    })
    const offGroup = onNewGroupMessage((msg) => {
      if (msg.roomId === roomId) {
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
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
    return () => { offNew(); offGroup(); offRead(); offDel() }
  }, [roomId, otherUserId])

  const handleSend = async () => {
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)

    // Stop typing
    if (type === 'personal' && otherUserId) sendTyping(otherUserId, false)
    if (type === 'group' && groupId) sendGroupTyping(groupId, false)

    try {
      if (type === 'personal' && otherUserId) {
        await new Promise<void>((resolve, reject) => {
          sendMessage(otherUserId, text, roomId, (res) => {
            if (res?.success) { setMessages(prev => prev.some(m => m.id === res.message?.id) ? prev : [...prev, res.message]); resolve() }
            else reject()
          })
        })
      } else if (type === 'group' && groupId) {
        await new Promise<void>((resolve, reject) => {
          sendGroupMessage(groupId, text, (res) => {
            if (res?.success) { setMessages(prev => prev.some(m => m.id === res.message?.id) ? prev : [...prev, res.message]); resolve() }
            else reject()
          })
        })
      }
    } catch { }
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

  const handleContextMenu = (e: React.MouseEvent, msgId: string, isMine: boolean) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, msgId, isMine })
  }

  const title = type === 'personal' ? otherUserName : groupName
  const subtitle = type === 'personal'
    ? isOnline ? 'Online' : 'Offline'
    : `${groupInfo?.Members?.length || 0} members`

  const groups = groupByDate(messages)

  return (
    <div className="flex flex-col h-full bg-surface-950 flex-1 relative" onClick={() => setContextMenu(null)}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800/60 bg-surface-900 shrink-0">
        {onBack && (
          <button onClick={onBack} className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors">
            <ArrowLeft size={18} />
          </button>
        )}
        {type === 'personal' ? (
          <Avatar name={otherUserName || ''} size="md" online={isOnline} />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold">{groupName?.[0]?.toUpperCase()}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white truncate">{title}</h2>
          <div className="flex items-center gap-1.5">
            {type === 'personal' && <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-600'}`} />}
            <span className={`text-xs ${isOnline && type === 'personal' ? 'text-emerald-400' : 'text-slate-500'}`}>{subtitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {type === 'group' && (
            <button onClick={() => setShowInfo(!showInfo)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all">
              <Info size={16} />
            </button>
          )}
          <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all">
            <Phone size={16} />
          </button>
          <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all">
            <Video size={16} />
          </button>
          <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all">
            <MoreVertical size={16} />
          </button>
        </div>
      </div>

      {/* Group info panel */}
      {showInfo && groupInfo && (
        <div className="absolute top-16 right-0 z-40 w-72 bg-surface-900 border border-slate-700/50 rounded-xl shadow-xl p-4 m-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <span className="text-white font-bold">{groupInfo.name[0]}</span>
            </div>
            <div>
              <p className="text-white font-semibold">{groupInfo.name}</p>
              {groupInfo.description && <p className="text-xs text-slate-500">{groupInfo.description}</p>}
            </div>
          </div>
          <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-2">Members ({groupInfo.Members?.length})</p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {groupInfo.Members?.map(m => (
              <div key={m.id} className="flex items-center gap-2">
                <Avatar name={m.name} avatar={m.avatar} size="xs" online={onlineUsers[m.id] === 'online'} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{m.name}{m.id === user?.id ? ' (You)' : ''}</p>
                  <p className="text-[10px] text-slate-600">{(m as any).GroupMember?.role}</p>
                </div>
              </div>
            ))}
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
              {type === 'personal' ? <Avatar name={otherUserName || ''} size="lg" /> : <Users size={28} />}
            </div>
            <p className="text-sm font-medium text-slate-500">Say hello to {title}!</p>
            <p className="text-xs text-slate-600 mt-1">This is the start of your conversation</p>
          </div>
        ) : (
          groups.map(({ label, messages: grpMsgs }) => (
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
                    onContextMenu={(e) => !isDeleted && handleContextMenu(e, msg.id, isMine)}
                  >
                    {!isMine && !sameSender && type === 'group' && (
                      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 mr-2 shrink-0 self-end mb-1">
                        {(msg.Sender?.name || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    {!isMine && sameSender && type === 'group' && <div className="w-9" />}
                    <div className={`max-w-[70%] group`}>
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
                        <p className="leading-relaxed break-words">{msg.message}</p>
                        <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <span className={`text-[10px] ${isMine ? 'text-brand-300/60' : 'text-slate-600'}`}>
                            {format(new Date(msg.createdAt), 'h:mm a')}
                          </span>
                          {isMine && !isDeleted && (
                            msg.read
                              ? <CheckCheck size={11} className="text-brand-300/70" />
                              : <Check size={11} className="text-brand-300/40" />
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
          className="fixed z-50 bg-surface-800 border border-slate-700/50 rounded-xl shadow-xl py-1.5 min-w-40"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.isMine && (
            <>
              <button
                onClick={() => handleDeleteMsg(contextMenu.msgId, true)}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-all"
              >
                <Trash2 size={14} /> Delete for everyone
              </button>
              <button
                onClick={() => handleDeleteMsg(contextMenu.msgId, false)}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-400 hover:bg-slate-700/50 transition-all"
              >
                <Trash2 size={14} /> Delete for me
              </button>
            </>
          )}
          {!contextMenu.isMine && (
            <button className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-400 hover:bg-slate-700/50 transition-all">
              Reply
            </button>
          )}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-800/60 bg-surface-900 shrink-0">
        <div className="flex items-center gap-3 bg-surface-800 rounded-xl px-4 py-2.5 border border-slate-700/50 focus-within:border-brand-500/40 transition-all">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value); handleTyping() }}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={`Message ${title}...`}
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
        <p className="text-[10px] text-slate-700 text-center mt-1.5">Press Enter to send · Right-click to delete</p>
      </div>
    </div>
  )
}
