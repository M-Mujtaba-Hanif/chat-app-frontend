'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import ChatSidebar from '@/components/chat/ChatSidebar'
import ChatWindow from '@/components/chat/ChatWindow'
import { MessageSquare, Users } from 'lucide-react'

type Selection =
  | { type: 'personal'; id: string; name: string }
  | { type: 'group'; id: string; name: string }
  | null

export default function ChatPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [selected, setSelected] = useState<Selection>(null)
  const [showWindow, setShowWindow] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/auth/login')
  }, [user, loading, router])

  const handleSelectUser = (userId: string, userName: string) => {
    setSelected({ type: 'personal', id: userId, name: userName })
    setShowWindow(true)
  }

  const handleSelectGroup = (groupId: string, groupName: string) => {
    setSelected({ type: 'group', id: groupId, name: groupName })
    setShowWindow(true)
  }

  if (loading || !user) return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="h-screen flex bg-surface-950 overflow-hidden">
      <div className={`${showWindow ? 'hidden lg:flex' : 'flex'} h-full`}>
        <ChatSidebar
          selectedId={selected?.id}
          selectedType={selected?.type}
          onSelectUser={handleSelectUser}
          onSelectGroup={handleSelectGroup}
        />
      </div>

      {selected ? (
        <div className={`${showWindow ? 'flex' : 'hidden lg:flex'} flex-1 h-full`}>
          {selected.type === 'personal' ? (
            <ChatWindow
              type="personal"
              otherUserId={selected.id}
              otherUserName={selected.name}
              onBack={() => setShowWindow(false)}
            />
          ) : (
            <ChatWindow
              type="group"
              groupId={selected.id}
              groupName={selected.name}
              onBack={() => setShowWindow(false)}
            />
          )}
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 h-full items-center justify-center bg-surface-950">
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-700/20 border border-brand-500/20 flex items-center justify-center mx-auto mb-5">
              <MessageSquare size={36} className="text-brand-500/60" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Your Messages</h3>
            <p className="text-slate-500 text-sm max-w-xs">Select a conversation from the sidebar, or find new people to chat with.</p>
            <div className="flex items-center justify-center gap-4 mt-6 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <MessageSquare size={12} />
                <span>Personal chats</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-slate-700" />
              <div className="flex items-center gap-1.5">
                <Users size={12} />
                <span>Group rooms</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
