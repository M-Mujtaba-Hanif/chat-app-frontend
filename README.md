# NexChat Frontend — Next.js 14

A beautiful real-time chat frontend for the NexChat backend, built with Next.js 14, TypeScript, Tailwind CSS, and Socket.IO.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Your backend running at `http://localhost:3001`

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Frontend runs at **http://localhost:3000**

### Build for Production

```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx                 # Smart redirect (user→/chat, admin→/admin)
│   ├── layout.tsx               # Root layout with providers
│   ├── globals.css              # Design system, animations, Tailwind
│   ├── auth/
│   │   ├── login/page.tsx       # Login with email + Google OAuth
│   │   ├── signup/page.tsx      # Register with password strength meter
│   │   └── verify-otp/page.tsx  # 6-digit OTP with auto-submit + resend
│   ├── chat/page.tsx            # Real-time chat panel (Socket.IO)
│   └── admin/page.tsx           # Admin dashboard with user management
├── components/
│   ├── ui/Avatar.tsx            # Avatar with online indicator
│   ├── chat/
│   │   ├── ChatSidebar.tsx      # Conversation list with online status
│   │   └── ChatWindow.tsx       # Full chat window with typing + read receipts
│   └── admin/                   # Admin-specific components
├── context/
│   ├── AuthContext.tsx          # Auth state (login/register/OTP/logout)
│   └── SocketContext.tsx        # Socket.IO (messages, typing, online)
├── lib/api.ts                   # All API calls (authApi, chatApi, adminApi)
└── types/index.ts               # TypeScript types
```

---

## 🔌 Backend API Integration

All API calls are made to `NEXT_PUBLIC_API_URL` (default: `http://localhost:3001/api/v1`).

### Auth endpoints used:
- `POST /auth/register` — Signup
- `POST /auth/login` — Login (session cookie)
- `POST /auth/logout` — Logout
- `GET  /auth/me` — Get current user
- `POST /auth/send-otp` — Send OTP email
- `POST /auth/verify-otp` — Verify OTP
- `GET  /auth/google` — Google OAuth (redirect)

### Chat endpoints:
- `GET  /chat/conversations` — Conversation list
- `GET  /chat/history/:userId` — Chat history
- `POST /chat/send` — Send message (REST fallback)
- `PUT  /chat/read/:userId` — Mark as read

### Admin endpoints:
- `GET    /admin/users` — List users (paginated + search)
- `PATCH  /admin/users/:id/block`
- `PATCH  /admin/users/:id/unblock`
- `PATCH  /admin/users/:id/verify`
- `PATCH  /admin/users/:id/activate`
- `PATCH  /admin/users/:id/deactivate`

### Socket.IO events:
- `joinRoom(roomId)` — Join chat room
- `sendMessage({ receiverId, message, roomId })` — Send message
- `typing({ receiverId, isTyping })` — Typing indicator
- `newMessage` — Receive message
- `messageSent` — Message confirmation
- `userStatus` — Online/offline status
- `typing` — Remote typing status

---

## 🎨 Design System

- **Color**: Indigo (`brand-500: #6366f1`) primary, Emerald (`accent-500: #10b981`) success
- **Dark theme**: `surface-950 (#020617)` base, `surface-900 (#0f172a)` cards
- **Typography**: Outfit (Google Fonts)
- **Effects**: Glass morphism, gradient text, animated bubbles, glow effects

---

## 📝 Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

---

## 🐳 Docker (add to existing docker-compose.yml)

```yaml
frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile
  ports:
    - "3000:3000"
  environment:
    - NEXT_PUBLIC_API_URL=http://backend:3001/api/v1
    - NEXT_PUBLIC_SOCKET_URL=http://backend:3001
  depends_on:
    - backend
```

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```
