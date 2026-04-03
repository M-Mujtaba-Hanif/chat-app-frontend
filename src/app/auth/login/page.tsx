'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { Eye, EyeOff, MessageSquare, Mail, Lock, Loader2, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      router.push('/chat')
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Login failed. Check credentials.'
      // If unverified → redirect to verify OTP page
      if (msg.toLowerCase().includes('not verified') || msg.toLowerCase().includes('verify')) {
        router.push(`/auth/verify-otp?email=${encodeURIComponent(form.email)}`)
        return
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900 via-brand-800 to-surface-950" />
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 30% 50%, rgba(99,102,241,0.15) 0%, transparent 60%), radial-gradient(circle at 70% 20%, rgba(52,211,153,0.1) 0%, transparent 50%)`
        }} />
        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg">
              <MessageSquare size={24} className="text-white" />
            </div>
            <span className="text-2xl font-bold text-white">NexChat</span>
          </div>
          <h1 className="text-5xl font-bold text-white leading-tight mb-6">
            Connect.<br />
            <span className="text-brand-400">Collaborate.</span><br />
            Create.
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed max-w-md">
            Real-time messaging with end-to-end presence awareness, typing indicators, and read receipts.
          </p>
          <div className="mt-14 space-y-4">
            {[
              { text: "Hey, are you available for a quick sync? 👋", side: 'left' },
              { text: "Sure! Give me 2 minutes ⚡", side: 'right' },
              { text: "Perfect, hopping on now 🚀", side: 'left' },
            ].map((bubble, i) => (
              <div key={i} className={`flex ${bubble.side === 'right' ? 'justify-end' : ''}`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium max-w-[280px] ${bubble.side === 'right'
                  ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white rounded-br-sm'
                  : 'bg-slate-800/80 text-slate-200 rounded-bl-sm border border-slate-700/50'}`}>
                  {bubble.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
              <MessageSquare size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold text-white">NexChat</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Welcome back</h2>
            <p className="text-slate-400">Sign in to your account to continue</p>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email" value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  required placeholder="you@example.com"
                  className="w-full bg-surface-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 pl-11 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  required placeholder="••••••••"
                  className="w-full bg-surface-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 pl-11 pr-11 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 transition-all text-sm"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-brand-500 to-brand-700 hover:from-brand-400 hover:to-brand-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-6 py-3.5 transition-all duration-200 flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={18} className="animate-spin" /> Signing in...</> : 'Sign in'}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative flex items-center mb-6">
              <div className="flex-1 border-t border-slate-700" />
              <span className="px-4 text-sm text-slate-500">or continue with</span>
              <div className="flex-1 border-t border-slate-700" />
            </div>
            <a href="http://localhost:3001/api/v1/auth/google"
              className="w-full flex items-center justify-center gap-3 bg-surface-800 hover:bg-surface-700 border border-slate-700 text-white font-medium rounded-xl px-6 py-3 transition-all duration-200">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </a>
          </div>

          <p className="text-center text-slate-400 text-sm mt-8">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">Create Account</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
