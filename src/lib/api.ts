import axios from 'axios'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

export const authApi = {
  register: (data: { name: string; email: string; password: string }) => api.post('/auth/register', data),
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  sendOtp: (email: string) => api.post('/auth/send-otp', { email }),
  verifyOtp: (email: string, code: string) => api.post('/auth/verify-otp', { email, code }),
}

export const chatApi = {
  getConversations: (page = 1, limit = 20) => api.get(`/chat/conversations?page=${page}&limit=${limit}`),
  getChatHistory: (userId: string, page = 1, limit = 30) => api.get(`/chat/history/${userId}?page=${page}&limit=${limit}`),
  sendMessage: (receiverId: string, message: string) => api.post('/chat/send', { receiverId, message }),
  markAsRead: (userId: string) => api.put(`/chat/read/${userId}`),
}

export const groupApi = {
  getAllUsers: (search = '') => api.get(`/groups/users?search=${search}`),
  getFriends: () => api.get('/groups/friends'),
  getFriendRequests: () => api.get('/groups/friend-requests'),
  sendFriendRequest: (receiverId: string) => api.post('/groups/friend-requests', { receiverId }),
  respondFriendRequest: (requestId: string, action: 'accept' | 'reject') => api.patch(`/groups/friend-requests/${requestId}`, { action }),
  createGroup: (data: { name: string; description?: string; memberIds?: string[] }) => api.post('/groups', data),
  getMyGroups: () => api.get('/groups'),
  getGroupById: (groupId: string) => api.get(`/groups/${groupId}`),
  getGroupMessages: (groupId: string, page = 1, limit = 30) => api.get(`/groups/${groupId}/messages?page=${page}&limit=${limit}`),
  addMember: (groupId: string, userId: string) => api.post(`/groups/${groupId}/members`, { userId }),
  removeMember: (groupId: string, userId: string) => api.delete(`/groups/${groupId}/members/${userId}`),
  deleteGroup: (groupId: string) => api.delete(`/groups/${groupId}`),
}

export const adminApi = {
  getUsers: (page = 1, limit = 10, search = '') => api.get(`/admin/users?page=${page}&limit=${limit}&search=${search}`),
  getOnlineUsers: () => api.get('/admin/online-users'),
  getStats: () => api.get('/admin/stats'),
  blockUser: (id: string) => api.patch(`/admin/users/${id}/block`),
  unblockUser: (id: string) => api.patch(`/admin/users/${id}/unblock`),
  verifyUser: (id: string) => api.patch(`/admin/users/${id}/verify`),
  activateUser: (id: string) => api.patch(`/admin/users/${id}/activate`),
  deactivateUser: (id: string) => api.patch(`/admin/users/${id}/deactivate`),
}

export const dashboardApi = {
  getStats: () => api.get('/dashboard'),
}
