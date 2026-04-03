'use client'
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { Message } from '@/types'

interface TypingState { [senderId: string]: boolean }
interface OnlineState { [userId: string]: 'online' | 'offline' }
interface LastSeenState { [userId: string]: string }

interface SocketContextType {
  socket: Socket | null
  connected: boolean
  onlineUsers: OnlineState
  lastSeenMap: LastSeenState
  typingUsers: TypingState
  groupTypingUsers: { [groupId: string]: { [userId: string]: boolean } }
  unreadCounts: { [roomId: string]: number }
  activeRoomId: string | null
  setActiveRoom: (roomId: string | null) => void
  clearUnread: (roomId: string) => void
  sendMessage: (receiverId: string, message: string, roomId?: string, replyToId?: string, ack?: (r: any) => void) => void
  sendGroupMessage: (groupId: string, message: string, replyToId?: string, ack?: (r: any) => void) => void
  sendTyping: (receiverId: string, isTyping: boolean) => void
  sendGroupTyping: (groupId: string, isTyping: boolean) => void
  joinRoom: (roomId: string) => void
  markRead: (roomId: string, senderId: string) => void
  deleteMessage: (messageId: string, deleteForAll: boolean, ack?: (r: any) => void) => void
  onNewMessage: (cb: (msg: Message) => void) => () => void
  onNewGroupMessage: (cb: (msg: Message) => void) => () => void
  onMessagesRead: (cb: (data: { roomId: string; readBy: string }) => void) => () => void
  onMessageDeleted: (cb: (data: { messageId: string; roomId: string }) => void) => () => void
  onMessageDelivered: (cb: (data: { messageId: string; roomId: string }) => void) => () => void
  onUserLeftGroup: (cb: (data: { groupId: string; userId: string }) => void) => () => void
}

const SocketContext = createContext<SocketContextType | null>(null)
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<OnlineState>({})
  const [lastSeenMap, setLastSeenMap] = useState<LastSeenState>({})
  const [typingUsers, setTypingUsers] = useState<TypingState>({})
  const [groupTypingUsers, setGroupTypingUsers] = useState<{ [gid: string]: { [uid: string]: boolean } }>({})
  const [unreadCounts, setUnreadCounts] = useState<{ [roomId: string]: number }>({})
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const activeRoomRef = useRef<string | null>(null)
  const userRef = useRef(user)

  useEffect(() => { userRef.current = user }, [user])
  useEffect(() => { activeRoomRef.current = activeRoomId }, [activeRoomId])

  const setActiveRoom = useCallback((roomId: string | null) => {
    setActiveRoomId(roomId)
    if (roomId) setUnreadCounts(prev => ({ ...prev, [roomId]: 0 }))
  }, [])

  const clearUnread = useCallback((roomId: string) => {
    setUnreadCounts(prev => ({ ...prev, [roomId]: 0 }))
  }, [])

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect()
      setSocket(null)
      setConnected(false)
      return
    }

    const s = io(SOCKET_URL, { withCredentials: true, transports: ['websocket', 'polling'] })
    socketRef.current = s
    setSocket(s)

    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))
    s.on('onlineUsers', (ids: string[]) => {
      const map: OnlineState = {}
      ids.forEach(id => { map[id] = 'online' })
      setOnlineUsers(map)
    })
    s.on('userStatus', ({ userId, status, lastSeen }: { userId: string; status: 'online' | 'offline'; lastSeen?: string }) => {
      setOnlineUsers(prev => ({ ...prev, [userId]: status }))
      if (status === 'offline' && lastSeen) {
        setLastSeenMap(prev => ({ ...prev, [userId]: lastSeen }))
      }
    })
    s.on('typing', ({ senderId, isTyping }: { senderId: string; isTyping: boolean }) => {
      setTypingUsers(prev => ({ ...prev, [senderId]: isTyping }))
    })
    s.on('groupTyping', ({ senderId, groupId, isTyping }: { senderId: string; groupId: string; isTyping: boolean }) => {
      setGroupTypingUsers(prev => ({
        ...prev,
        [groupId]: { ...(prev[groupId] || {}), [senderId]: isTyping },
      }))
    })
    // Track unread counts for background messages
    s.on('newMessage', (msg: Message) => {
      const currentUser = userRef.current
      const currentRoom = activeRoomRef.current
      if (msg.senderId !== currentUser?.id && msg.roomId !== currentRoom) {
        setUnreadCounts(prev => ({ ...prev, [msg.roomId]: (prev[msg.roomId] || 0) + 1 }))
      }
    })
    s.on('newGroupMessage', (msg: Message) => {
      const currentUser = userRef.current
      const currentRoom = activeRoomRef.current
      if (msg.senderId !== currentUser?.id && msg.roomId !== currentRoom) {
        setUnreadCounts(prev => ({ ...prev, [msg.roomId]: (prev[msg.roomId] || 0) + 1 }))
      }
    })

    return () => { s.disconnect() }
  }, [user])

  const sendMessage = useCallback((receiverId: string, message: string, roomId?: string, replyToId?: string, ack?: (r: any) => void) => {
    socketRef.current?.emit('sendMessage', { receiverId, message, roomId, replyToId }, ack)
  }, [])

  const sendGroupMessage = useCallback((groupId: string, message: string, replyToId?: string, ack?: (r: any) => void) => {
    socketRef.current?.emit('sendGroupMessage', { groupId, message, replyToId }, ack)
  }, [])

  const sendTyping = useCallback((receiverId: string, isTyping: boolean) => {
    socketRef.current?.emit('typing', { receiverId, isTyping })
  }, [])

  const sendGroupTyping = useCallback((groupId: string, isTyping: boolean) => {
    socketRef.current?.emit('groupTyping', { groupId, isTyping })
  }, [])

  const joinRoom = useCallback((roomId: string) => {
    socketRef.current?.emit('joinRoom', roomId)
  }, [])

  const markRead = useCallback((roomId: string, senderId: string) => {
    socketRef.current?.emit('messageRead', { roomId, senderId })
  }, [])

  const deleteMessage = useCallback((messageId: string, deleteForAll: boolean, ack?: (r: any) => void) => {
    socketRef.current?.emit('deleteMessage', { messageId, deleteForAll }, ack)
  }, [])

  const onNewMessage = useCallback((cb: (msg: Message) => void) => {
    const s = socketRef.current
    s?.on('newMessage', cb)
    return () => { s?.off('newMessage', cb) }
  }, [socket])

  const onNewGroupMessage = useCallback((cb: (msg: Message) => void) => {
    const s = socketRef.current
    s?.on('newGroupMessage', cb)
    return () => { s?.off('newGroupMessage', cb) }
  }, [socket])

  const onMessagesRead = useCallback((cb: (data: { roomId: string; readBy: string }) => void) => {
    const s = socketRef.current
    s?.on('messagesRead', cb)
    return () => { s?.off('messagesRead', cb) }
  }, [socket])

  const onMessageDeleted = useCallback((cb: (data: { messageId: string; roomId: string }) => void) => {
    const s = socketRef.current
    s?.on('messageDeleted', cb)
    return () => { s?.off('messageDeleted', cb) }
  }, [socket])

  const onMessageDelivered = useCallback((cb: (data: { messageId: string; roomId: string }) => void) => {
    const s = socketRef.current
    s?.on('messageDelivered', cb)
    return () => { s?.off('messageDelivered', cb) }
  }, [socket])

  const onUserLeftGroup = useCallback((cb: (data: { groupId: string; userId: string }) => void) => {
    const s = socketRef.current
    s?.on('userLeftGroup', cb)
    return () => { s?.off('userLeftGroup', cb) }
  }, [socket])

  return (
    <SocketContext.Provider value={{
      socket, connected, onlineUsers, lastSeenMap, typingUsers, groupTypingUsers,
      unreadCounts, activeRoomId, setActiveRoom, clearUnread,
      sendMessage, sendGroupMessage, sendTyping, sendGroupTyping,
      joinRoom, markRead, deleteMessage,
      onNewMessage, onNewGroupMessage, onMessagesRead, onMessageDeleted,
      onMessageDelivered, onUserLeftGroup,
    }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocket must be used within SocketProvider')
  return ctx
}
