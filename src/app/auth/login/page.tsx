'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Eye, EyeOff, Mail, Lock, Loader2, AlertCircle, ShieldAlert, Clock } from 'lucide-react'
import { useAuth, LoginError } from '@/context/AuthContext'
import { cn, formatCountdown } from '@/lib/utils'

// ── Animation variants ────────────────────────────────────────────────────────

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]

const pageVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4 } },
}

const formVariants = {
  hidden:   { opacity: 0, y: 24 },
  visible:  { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
}

const fieldVariants = {
  hidden:   { opacity: 0, y: 12 },
  visible:  (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.35, delay: i * 0.07, ease: 'easeOut' as const },
  }),
}

const errorVariants = {
  hidden:   { opacity: 0, y: -8, scale: 0.97 },
  visible:  { opacity: 1, y: 0,  scale: 1,    transition: { duration: 0.25 } },
  exit:     { opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.2 } },
}

// ── Floating chat bubbles on the left panel ───────────────────────────────────

const chatBubbles = [
  { text: "Hey, are you available for a quick sync? 👋", side: 'left',  delay: 0 },
  { text: "Sure! Give me 2 minutes ⚡", side: 'right', delay: 0.6 },
  { text: "Perfect, hopping on now 🚀", side: 'left',  delay: 1.2 },
  { text: "Sent you the files 📎", side: 'right', delay: 1.8 },
]

// ── Lockout countdown timer ───────────────────────────────────────────────────

function LockoutBanner({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    if (remaining <= 0) { onExpire(); return }
    const timer = setInterval(() => setRemaining(r => r - 1), 1000)
    return () => clearInterval(timer)
  }, [remaining, onExpire])

  useEffect(() => { setRemaining(seconds) }, [seconds])

  return (
    <motion.div
      variants={errorVariants}
      initial="hidden" animate="visible" exit="exit"
      className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/30 rounded-xl text-sm"
    >
      <ShieldAlert size={18} className="text-destructive shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-destructive font-semibold mb-1">Account temporarily locked</p>
        <p className="text-muted-foreground text-xs">
          Too many failed attempts. Try again in{' '}
          <span className="font-mono font-bold text-destructive">{formatCountdown(remaining)}</span>
        </p>
        <div className="mt-2 h-1 bg-destructive/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-destructive/60 rounded-full"
            initial={{ width: '100%' }}
            animate={{ width: `${(remaining / seconds) * 100}%` }}
            transition={{ duration: 1, ease: 'linear' }}
          />
        </div>
      </div>
    </motion.div>
  )
}

// ── Attempt warning ───────────────────────────────────────────────────────────

function AttemptsWarning({ remaining }: { remaining: number }) {
  return (
    <motion.div
      variants={errorVariants}
      initial="hidden" animate="visible" exit="exit"
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl text-sm border',
        remaining <= 1
          ? 'bg-destructive/10 border-destructive/30 text-destructive'
          : 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      )}
    >
      <AlertCircle size={16} className="shrink-0" />
      <span>
        Invalid credentials.{' '}
        <span className="font-semibold">{remaining} attempt{remaining !== 1 ? 's' : ''} remaining</span>
        {' '}before lockout.
      </span>
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()

  const [form, setForm]           = useState({ email: '', password: '' })
  const [showPass, setShowPass]   = useState(false)
  const [loading, setLoading]     = useState(false)
  const [shake, setShake]         = useState(false)

  // Error states — mutually exclusive
  const [genericError, setGenericError]       = useState('')
  const [attemptsLeft, setAttemptsLeft]       = useState<number | null>(null)
  const [lockoutSeconds, setLockoutSeconds]   = useState<number | null>(null)

  const clearErrors = () => {
    setGenericError('')
    setAttemptsLeft(null)
    // Don't clear lockoutSeconds here — it clears itself via the timer
  }

  const triggerShake = useCallback(() => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearErrors()

    // Don't allow submission while locked out
    if (lockoutSeconds !== null && lockoutSeconds > 0) return

    setLoading(true)
    try {
      await login(form.email, form.password)
      toast.success('Welcome back!')
      router.push('/chat')
    } catch (err: unknown) {
      const loginErr = err as LoginError
      triggerShake()

      if (loginErr.code === 'ACCOUNT_LOCKED' && loginErr.remainingSeconds) {
        setLockoutSeconds(loginErr.remainingSeconds)
        setAttemptsLeft(null)
        setGenericError('')
      } else if (loginErr.code === 'INVALID_CREDENTIALS' && loginErr.attemptsRemaining !== undefined) {
        setAttemptsLeft(loginErr.attemptsRemaining)
        setGenericError('')
      } else if (loginErr.message?.toLowerCase().includes('not verified') ||
                 loginErr.message?.toLowerCase().includes('verify')) {
        router.push(`/auth/verify-otp?email=${encodeURIComponent(form.email)}`)
        return
      } else {
        setGenericError(loginErr.message || 'Login failed. Please check your credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden" animate="visible"
      className="min-h-screen bg-background flex"
    >
      {/* ── Left panel — branding + animated bubbles ─────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden">
        {/* Layered gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background" />
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(ellipse at 20% 20%, hsl(var(--primary) / 0.15) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 80%, hsl(var(--accent) / 0.08) 0%, transparent 50%)
          `,
        }} />

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
                           linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }} />

        <div className="relative z-10 flex flex-col justify-center px-14 py-16">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 mb-16"
          >
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-glow-md">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span className="text-2xl font-bold tracking-tight">NexChat</span>
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h1 className="text-5xl font-bold leading-tight mb-5 tracking-tight">
              Connect.<br />
              <span className="gradient-text">Collaborate.</span><br />
              Create.
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed max-w-sm">
              Premium real-time messaging with presence awareness, read receipts, and end-to-end encryption.
            </p>
          </motion.div>

          {/* Animated chat bubbles */}
          <div className="mt-14 space-y-3">
            {chatBubbles.map((bubble, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: bubble.side === 'left' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.6 + bubble.delay }}
                className={cn('flex', bubble.side === 'right' && 'justify-end')}
              >
                <div className={cn(
                  'px-4 py-2.5 rounded-2xl text-sm font-medium max-w-[260px] shadow-card',
                  bubble.side === 'right'
                    ? 'bubble-out rounded-br-sm'
                    : 'bubble-in rounded-bl-sm',
                )}>
                  {bubble.text}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5 }}
            className="mt-14 flex gap-8"
          >
            {[
              { label: 'Active Users', value: '10K+' },
              { label: 'Messages Sent', value: '2M+' },
              { label: 'Uptime', value: '99.9%' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Right panel — login form ──────────────────────────────────── */}
      <div className="w-full lg:w-[55%] flex items-center justify-center px-6 py-12">
        <motion.div
          variants={formVariants}
          initial="hidden" animate="visible"
          className="w-full max-w-[420px]"
        >
          {/* Mobile logo */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3 mb-10 lg:hidden"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-glow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <span className="text-xl font-bold">NexChat</span>
          </motion.div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h2>
            <p className="text-muted-foreground">Sign in to continue to NexChat</p>
          </div>

          {/* Error banners */}
          <AnimatePresence mode="wait">
            {lockoutSeconds !== null ? (
              <div className="mb-6">
                <LockoutBanner
                  key="lockout"
                  seconds={lockoutSeconds}
                  onExpire={() => setLockoutSeconds(null)}
                />
              </div>
            ) : attemptsLeft !== null ? (
              <div className="mb-6">
                <AttemptsWarning key="attempts" remaining={attemptsLeft} />
              </div>
            ) : genericError ? (
              <motion.div
                key="generic"
                variants={errorVariants}
                initial="hidden" animate="visible" exit="exit"
                className="mb-6 flex items-center gap-3 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm"
              >
                <AlertCircle size={16} className="shrink-0" />
                {genericError}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Form */}
          <motion.form
            onSubmit={handleSubmit}
            className={cn('space-y-5', shake && 'animate-shake')}
          >
            {/* Email */}
            <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
              <label className="block text-sm font-medium text-foreground mb-2">
                Email address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  required
                  placeholder="you@example.com"
                  disabled={!!lockoutSeconds}
                  className="input-base pl-11 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </motion.div>

            {/* Password */}
            <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <button type="button" className="text-xs text-primary hover:text-primary/80 transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  required
                  placeholder="••••••••"
                  disabled={!!lockoutSeconds}
                  className="input-base pl-11 pr-11 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </motion.div>

            {/* Submit */}
            <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
              <button
                type="submit"
                disabled={loading || !!lockoutSeconds}
                className="btn-primary w-full mt-1"
              >
                {loading ? (
                  <><Loader2 size={17} className="animate-spin" /> Signing in...</>
                ) : lockoutSeconds ? (
                  <><Clock size={17} /> Locked — try again shortly</>
                ) : (
                  'Sign in'
                )}
              </button>
            </motion.div>
          </motion.form>

          {/* Divider + Google OAuth */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-7"
          >
            <div className="relative flex items-center mb-6">
              <div className="flex-1 border-t border-border" />
              <span className="px-4 text-xs text-muted-foreground">or continue with</span>
              <div className="flex-1 border-t border-border" />
            </div>

            <a
              href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3001'}/api/v1/auth/google`}
              className={cn(
                'flex items-center justify-center gap-3 w-full px-6 py-3 rounded-lg text-sm font-medium',
                'bg-secondary hover:bg-secondary/80 border border-border',
                'text-foreground transition-all duration-200',
                'hover:shadow-card',
              )}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </a>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center text-muted-foreground text-sm mt-8"
          >
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-primary hover:text-primary/80 font-medium transition-colors">
              Create account
            </Link>
          </motion.p>
        </motion.div>
      </div>
    </motion.div>
  )
}
