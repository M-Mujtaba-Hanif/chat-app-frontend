'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import ChatSidebar from '@/components/chat/ChatSidebar'
import ChatWindow from '@/components/chat/ChatWindow'
import { MessageSquare, Sparkles } from 'lucide-react'

export default function ChatPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null)
  const [showWindow, setShowWindow] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login')
  }, [user, loading, router])

  const handleSelectUser = (userId: string, userName: string) => {
    setSelectedUser({ id: userId, name: userName })
    setShowWindow(true)
  }

  if (loading || !user) return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="h-screen flex bg-surface-950 overflow-hidden">
      {/* Sidebar — always visible on lg, hidden on mobile when chat open */}
      <div className={`${showWindow ? 'hidden lg:flex' : 'flex'} h-full`}>
        <ChatSidebar
          selectedUserId={selectedUser?.id}
          onSelectUser={handleSelectUser}
        />
      </div>

      {/* Chat Window */}
      {selectedUser ? (
        <div className={`${showWindow ? 'flex' : 'hidden lg:flex'} flex-1 h-full`}>
          <ChatWindow
            otherUserId={selectedUser.id}
            otherUserName={selectedUser.name}
            onBack={() => setShowWindow(false)}
          />
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 h-full items-center justify-center bg-surface-950">
          <div className="text-center">
            {/* Animated logo */}
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-brand-500/20 to-brand-700/20 animate-pulse" />
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center glow-brand">
                <MessageSquare size={40} className="text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-accent-500 flex items-center justify-center">
                <Sparkles size={12} className="text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Your messages</h2>
            <p className="text-slate-500 text-sm max-w-xs">
              Select a conversation from the sidebar to start chatting in real-time
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-8">
              {['⚡ Real-time', '👁️ Read receipts', '✍️ Typing indicators', '🟢 Online status'].map(f => (
                <span key={f} className="text-xs font-medium px-3 py-1.5 bg-surface-800 border border-slate-700/50 text-slate-400 rounded-full">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
