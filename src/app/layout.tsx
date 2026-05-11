import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { SocketProvider } from '@/context/SocketContext'
import NotificationPermission from '@/components/ui/NotificationPermission'
import ThemeEngine from '@/components/theme/ThemeEngine'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'NexChat — Premium Real-time Messaging',
  description: 'The premium messaging platform. Real-time, secure, beautiful.',
  keywords: ['chat', 'messaging', 'real-time', 'NexChat'],
  themeColor: [
    { media: '(prefers-color-scheme: dark)',  color: '#0a0d14' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-display`}>
        {/*
          ThemeProvider from next-themes:
          - attribute="class" → adds/removes "dark" class on <html>
          - defaultTheme="dark" → initial theme
          - enableSystem → respects OS preference
          - disableTransitionOnChange → prevents flash on theme switch
        */}
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <ThemeEngine />
          <AuthProvider>
            <SocketProvider>
              {children}
            </SocketProvider>
          </AuthProvider>

          {/*
            Sonner Toaster — premium toast notifications.
            Positioned bottom-right, matches theme automatically.
            Usage anywhere: import { toast } from 'sonner'
                            toast.success('Message sent!')
                            toast.error('Failed to connect')
          */}
          <NotificationPermission />
          <Toaster
            position="bottom-right"
            expand={false}
            richColors
            closeButton
            duration={4000}
            toastOptions={{
              style: {
                background: 'hsl(222, 47%, 6%)',
                border:     '1px solid hsl(217, 32%, 14%)',
                color:      'hsl(210, 40%, 96%)',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
