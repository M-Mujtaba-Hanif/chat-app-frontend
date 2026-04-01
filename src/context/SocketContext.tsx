'use client'
import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { Message } from '@/types'

interface TypingState {
  [senderId: string]: boolean
}

interface OnlineState {
  [userId: string]: 'online' | 'offline'
}

interface SocketContextType {
  socket: Socket | null
  connected: boolean
  onlineUsers: OnlineState
  typingUsers: TypingState
  sendMessage: (receiverId: string, message: string, roomId?: string) => void
  sendTyping: (receiverId: string, isTyping: boolean) => void
  joinRoom: (roomId: string) => void
  onNewMessage: (cb: (msg: Message) => void) => () => void
  onMessageSent: (cb: (msg: Message) => void) => () => void
}

const SocketContext = createContext<SocketContextType | null>(null)

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001'

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<OnlineState>({})
  const [typingUsers, setTypingUsers] = useState<TypingState>({})
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect()
      setSocket(null)
      setConnected(false)
      return
    }

    const s = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })

    socketRef.current = s
    setSocket(s)

    s.on('connect', () => setConnected(true))
    s.on('disconnect', () => setConnected(false))

    s.on('userStatus', ({ userId, status }: { userId: string; status: 'online' | 'offline' }) => {
      setOnlineUsers(prev => ({ ...prev, [userId]: status }))
    })

    s.on('typing', ({ senderId, isTyping }: { senderId: string; isTyping: boolean }) => {
      setTypingUsers(prev => ({ ...prev, [senderId]: isTyping }))
    })

    return () => {
      s.disconnect()
    }
  }, [user])

  const sendMessage = (receiverId: string, message: string, roomId?: string) => {
    socketRef.current?.emit('sendMessage', { receiverId, message, roomId })
  }

  const sendTyping = (receiverId: string, isTyping: boolean) => {
    socketRef.current?.emit('typing', { receiverId, isTyping })
  }

  const joinRoom = (roomId: string) => {
    socketRef.current?.emit('joinRoom', roomId)
  }

  const onNewMessage = (cb: (msg: Message) => void) => {
    socketRef.current?.on('newMessage', cb)
    return () => { socketRef.current?.off('newMessage', cb) }
  }

  const onMessageSent = (cb: (msg: Message) => void) => {
    socketRef.current?.on('messageSent', cb)
    return () => { socketRef.current?.off('messageSent', cb) }
  }

  return (
    <SocketContext.Provider value={{
      socket, connected, onlineUsers, typingUsers,
      sendMessage, sendTyping, joinRoom, onNewMessage, onMessageSent
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
