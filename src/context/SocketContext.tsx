'use client'
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { Message } from '@/types'

interface TypingState { [senderId: string]: boolean }
interface OnlineState { [userId: string]: 'online' | 'offline' }

interface SocketContextType {
  socket: Socket | null
  connected: boolean
  onlineUsers: OnlineState
  typingUsers: TypingState
  groupTypingUsers: { [groupId: string]: { [userId: string]: boolean } }
  sendMessage: (receiverId: string, message: string, roomId?: string, ack?: (r: any) => void) => void
  sendGroupMessage: (groupId: string, message: string, ack?: (r: any) => void) => void
  sendTyping: (receiverId: string, isTyping: boolean) => void
  sendGroupTyping: (groupId: string, isTyping: boolean) => void
  joinRoom: (roomId: string) => void
  markRead: (roomId: string, senderId: string) => void
  deleteMessage: (messageId: string, deleteForAll: boolean, ack?: (r: any) => void) => void
  onNewMessage: (cb: (msg: Message) => void) => () => void
  onNewGroupMessage: (cb: (msg: Message) => void) => () => void
  onMessagesRead: (cb: (data: { roomId: string; readBy: string }) => void) => () => void
  onMessageDeleted: (cb: (data: { messageId: string; roomId: string }) => void) => () => void
}

const SocketContext = createContext<SocketContextType | null>(null)
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<OnlineState>({})
  const [typingUsers, setTypingUsers] = useState<TypingState>({})
  const [groupTypingUsers, setGroupTypingUsers] = useState<{ [gid: string]: { [uid: string]: boolean } }>({})
  const socketRef = useRef<Socket | null>(null)

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
    s.on('userStatus', ({ userId, status }: { userId: string; status: 'online' | 'offline' }) => {
      setOnlineUsers(prev => ({ ...prev, [userId]: status }))
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

    return () => { s.disconnect() }
  }, [user])

  const sendMessage = useCallback((receiverId: string, message: string, roomId?: string, ack?: (r: any) => void) => {
    socketRef.current?.emit('sendMessage', { receiverId, message, roomId }, ack)
  }, [])

  const sendGroupMessage = useCallback((groupId: string, message: string, ack?: (r: any) => void) => {
    socketRef.current?.emit('sendGroupMessage', { groupId, message }, ack)
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
    socketRef.current?.on('newMessage', cb)
    return () => { socketRef.current?.off('newMessage', cb) }
  }, [socket])

  const onNewGroupMessage = useCallback((cb: (msg: Message) => void) => {
    socketRef.current?.on('newGroupMessage', cb)
    return () => { socketRef.current?.off('newGroupMessage', cb) }
  }, [socket])

  const onMessagesRead = useCallback((cb: (data: { roomId: string; readBy: string }) => void) => {
    socketRef.current?.on('messagesRead', cb)
    return () => { socketRef.current?.off('messagesRead', cb) }
  }, [socket])

  const onMessageDeleted = useCallback((cb: (data: { messageId: string; roomId: string }) => void) => {
    socketRef.current?.on('messageDeleted', cb)
    return () => { socketRef.current?.off('messageDeleted', cb) }
  }, [socket])

  return (
    <SocketContext.Provider value={{
      socket, connected, onlineUsers, typingUsers, groupTypingUsers,
      sendMessage, sendGroupMessage, sendTyping, sendGroupTyping,
      joinRoom, markRead, deleteMessage,
      onNewMessage, onNewGroupMessage, onMessagesRead, onMessageDeleted,
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
