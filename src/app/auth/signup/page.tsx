'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { Eye, EyeOff, MessageSquare, Mail, Lock, User, Loader2, AlertCircle, CheckCircle } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const { register } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const passwordStrength = (() => {
    const p = form.password
    if (!p) return 0
    let score = 0
    if (p.length >= 8) score++
    if (/[A-Z]/.test(p)) score++
    if (/[0-9]/.test(p)) score++
    if (/[^A-Za-z0-9]/.test(p)) score++
    return score
  })()

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][passwordStrength]
  const strengthColor = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-emerald-500'][passwordStrength]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors([])
    const errs: string[] = []
    if (form.password !== form.confirm) errs.push('Passwords do not match')
    if (form.password.length < 8) errs.push('Password must be at least 8 characters')
    if (!/[A-Z]/.test(form.password)) errs.push('Password must contain at least one uppercase letter')
    if (!/[0-9]/.test(form.password)) errs.push('Password must contain at least one number')
    if (errs.length) { setErrors(errs); return }

    setLoading(true)
    try {
      await register(form.name, form.email, form.password)
      router.push(`/auth/verify-otp?email=${encodeURIComponent(form.email)}`)
    } catch (err: any) {
      const data = err?.response?.data
      if (data?.errors && Array.isArray(data.errors)) {
        setErrors(data.errors)
      } else {
        setErrors([data?.message || 'Registration failed. Try again.'])
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
            <MessageSquare size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold text-white">NexChat</span>
        </div>

        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Create account</h2>
          <p className="text-slate-400">Join thousands of teams already using NexChat</p>
        </div>

        <div className="flex gap-2 mb-8">
          {['Account Info', 'Verify Email', 'Start Chatting'].map((step, i) => (
            <div key={i} className="flex-1">
              <div className={`h-1 rounded-full mb-1.5 ${i === 0 ? 'bg-brand-500' : 'bg-slate-700'}`} />
              <span className={`text-xs ${i === 0 ? 'text-brand-400' : 'text-slate-600'}`}>{step}</span>
            </div>
          ))}
        </div>

        {errors.length > 0 && (
          <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm">
            {errors.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-red-400 mb-1 last:mb-0">
                <AlertCircle size={14} className="shrink-0" />
                {e}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Full name</label>
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                required placeholder="Ali Hassan"
                className="w-full bg-surface-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 pl-11 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
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
                required placeholder="Min. 8 chars, 1 uppercase, 1 number"
                className="w-full bg-surface-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 pl-11 pr-11 focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 transition-all text-sm"
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.password && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(n => (
                    <div key={n} className={`h-1 flex-1 rounded-full transition-all duration-300 ${passwordStrength >= n ? strengthColor : 'bg-slate-700'}`} />
                  ))}
                </div>
                <div className="flex gap-3 text-xs text-slate-500">
                  <span className={/[A-Z]/.test(form.password) ? 'text-emerald-400' : ''}>A-Z</span>
                  <span className={/[0-9]/.test(form.password) ? 'text-emerald-400' : ''}>0-9</span>
                  <span className={form.password.length >= 8 ? 'text-emerald-400' : ''}>8+ chars</span>
                  <span className="ml-auto text-slate-400">{strengthLabel}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Confirm password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password" value={form.confirm}
                onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
                required placeholder="Re-enter password"
                className={`w-full bg-surface-800 border text-white placeholder-slate-500 rounded-xl px-4 py-3 pl-11 pr-11 focus:outline-none focus:ring-1 transition-all text-sm ${
                  form.confirm && form.password !== form.confirm
                    ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/30'
                    : 'border-slate-700 focus:border-brand-500/50 focus:ring-brand-500/30'
                }`}
              />
              {form.confirm && (
                <div className={`absolute right-4 top-1/2 -translate-y-1/2 ${form.password === form.confirm ? 'text-emerald-400' : 'text-red-400'}`}>
                  <CheckCircle size={16} />
                </div>
              )}
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full mt-2 bg-gradient-to-r from-brand-500 to-brand-700 hover:from-brand-400 hover:to-brand-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-6 py-3.5 transition-all duration-200 flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={18} className="animate-spin" /> Creating account...</> : 'Create account'}
          </button>
        </form>

        <p className="text-center text-slate-400 text-sm mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
