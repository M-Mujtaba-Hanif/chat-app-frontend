export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  role: 'user' | 'admin'
  isVerified: boolean
  isActive: boolean
  isOnlineStatus?: boolean
  isOnlineNow?: boolean
  lastSeen?: string
  lastLogin?: string
  googleId?: string
  facebookId?: string
  createdAt?: string
  updatedAt?: string
}

export interface ReplyTo {
  id: string
  message: string
  senderId: string
}

export interface Message {
  id: string
  senderId: string
  receiverId?: string
  groupId?: string
  message: string
  roomId: string
  type: 'personal' | 'group'
  read: boolean
  delivered?: boolean
  deletedForAll?: boolean
  replyToId?: string
  ReplyTo?: ReplyTo
  createdAt: string
  updatedAt: string
  Sender?: { id: string; name: string; avatar?: string }
}

export interface Conversation {
  roomId: string
  lastMessage: {
    id: string
    message: string
    senderId: string
    createdAt: string
    read: boolean
  }
  user: User
  unreadCount: number
}

export interface Group {
  id: string
  name: string
  description?: string
  avatar?: string
  createdBy: string
  onlyAdminCanSend?: boolean
  Creator?: User
  Members?: (User & { GroupMember: { role: string; joinedAt: string } })[]
  createdAt: string
}

export interface FriendRequest {
  id: string
  senderId: string
  receiverId: string
  status: 'pending' | 'accepted' | 'rejected'
  Sender?: User
  Receiver?: User
  createdAt: string
}

export interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}
