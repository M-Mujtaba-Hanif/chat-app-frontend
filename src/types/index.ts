export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  role: 'user' | 'admin'
  isVerified: boolean
  isActive: boolean
  googleId?: string
  facebookId?: string
  createdAt?: string
  updatedAt?: string
}

export interface Message {
  id: string
  senderId: string
  receiverId: string
  message: string
  roomId: string
  read: boolean
  createdAt: string
  updatedAt: string
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
