'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useSocket } from '@/context/SocketContext'
import { chatApi } from '@/lib/api'
import { Message } from '@/types'
import Avatar from '@/components/ui/Avatar'
import { Send, Check, CheckCheck, MoreVertical, Phone, Video, Smile, Paperclip, ArrowLeft } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'

interface ChatWindowProps {
  otherUserId: string
  otherUserName: string
  onBack?: () => void
}

function formatMsgTime(date: string) {
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

export default function ChatWindow({ otherUserId, otherUserName, onBack }: ChatWindowProps) {
  const { user } = useAuth()
  const { sendMessage, sendTyping, joinRoom, onNewMessage, onMessageSent, onlineUsers, typingUsers } = useSocket()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isOnline = onlineUsers[otherUserId] === 'online'
  const isTyping = typingUsers[otherUserId]

  const roomId = [user?.id, otherUserId].sort().join('_')

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await chatApi.getChatHistory(otherUserId)
      const msgs = [...res.data.data.messages].reverse()
      setMessages(msgs)
      await chatApi.markAsRead(otherUserId)
    } catch {}
    finally { setLoading(false) }
  }, [otherUserId])

  useEffect(() => {
    fetchHistory()
    joinRoom(roomId)

    const offNew = onNewMessage((msg) => {
      if (msg.roomId === roomId) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        chatApi.markAsRead(otherUserId).catch(() => {})
      }
    })
    const offSent = onMessageSent((msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    })

    return () => { offNew(); offSent() }
  }, [otherUserId, roomId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const handleInputChange = (val: string) => {
    setInput(val)
    sendTyping(otherUserId, true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => sendTyping(otherUserId, false), 1500)
  }

  const handleSend = async () => {
    if (!input.trim() || sending) return
    const text = input.trim()
    setInput('')
    sendTyping(otherUserId, false)
    setSending(true)
    try {
      sendMessage(otherUserId, text, roomId)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const groups = groupByDate(messages)

  return (
    <div className="flex-1 h-full flex flex-col bg-surface-950">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3.5 border-b border-slate-800/60 bg-surface-900/80 backdrop-blur-sm">
        {onBack && (
          <button onClick={onBack} className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg">
            <ArrowLeft size={20} />
          </button>
        )}
        <Avatar name={otherUserName} size="md" online={isOnline} />
        <div className="flex-1">
          <h3 className="font-semibold text-white text-sm">{otherUserName}</h3>
          <p className="text-xs text-slate-500">
            {isTyping ? (
              <span className="text-brand-400 font-medium">typing...</span>
            ) : isOnline ? (
              <span className="text-accent-500">Online</span>
            ) : (
              'Offline'
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-all">
            <Phone size={18} />
          </button>
          <button className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-all">
            <Video size={18} />
          </button>
          <button className="p-2 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-all">
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-500 text-sm">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-3xl bg-surface-800 flex items-center justify-center mb-4">
              <Avatar name={otherUserName} size="xl" />
            </div>
            <p className="text-white font-semibold mb-1">{otherUserName}</p>
            <p className="text-slate-500 text-sm">Start the conversation! 👋</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 border-t border-slate-800" />
                <span className="text-xs text-slate-600 font-medium px-3 py-1 bg-surface-900 rounded-full border border-slate-800">
                  {group.label}
                </span>
                <div className="flex-1 border-t border-slate-800" />
              </div>
              <div className="space-y-1.5">
                {group.messages.map((msg, idx) => {
                  const isMine = msg.senderId === user?.id
                  const prevMsg = group.messages[idx - 1]
                  const showAvatar = !isMine && (idx === 0 || prevMsg?.senderId !== msg.senderId)

                  return (
                    <div key={msg.id}
                      className={`flex items-end gap-2 animate-message-in ${isMine ? 'justify-end' : 'justify-start'}`}>
                      {!isMine && (
                        <div className="w-7 shrink-0">
                          {showAvatar && <Avatar name={otherUserName} size="sm" />}
                        </div>
                      )}
                      <div className={`group relative max-w-[65%]`}>
                        <div className={`px-4 py-2.5 text-sm leading-relaxed ${isMine ? 'bubble-sent' : 'bubble-received'}`}>
                          {msg.message}
                        </div>
                        <div className={`flex items-center gap-1 mt-1 px-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-[10px] text-slate-600">{formatMsgTime(msg.createdAt)}</span>
                          {isMine && (
                            msg.read
                              ? <CheckCheck size={12} className="text-brand-400" />
                              : <Check size={12} className="text-slate-600" />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex items-end gap-2 animate-fade-in">
            <Avatar name={otherUserName} size="sm" />
            <div className="bubble-received px-4 py-3">
              <div className="typing-dots flex gap-1">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3.5 border-t border-slate-800/60 bg-surface-900/60 backdrop-blur-sm">
        <div className="flex items-end gap-3">
          <button className="p-2.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-xl transition-all shrink-0">
            <Paperclip size={18} />
          </button>
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${otherUserName}...`}
              rows={1}
              className="w-full bg-surface-800 border border-slate-700/60 text-white placeholder-slate-500 text-sm rounded-2xl px-4 py-3 pr-12 resize-none focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 transition-all max-h-32 overflow-y-auto"
              style={{ lineHeight: '1.5' }}
            />
            <button className="absolute right-3 bottom-3 p-0.5 text-slate-500 hover:text-slate-300 transition-colors">
              <Smile size={16} />
            </button>
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="p-3 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 hover:from-brand-400 hover:to-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all glow-brand shrink-0">
            <Send size={18} />
          </button>
        </div>
        <p className="text-[10px] text-slate-700 text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
