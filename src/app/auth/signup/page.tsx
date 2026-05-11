'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Eye, EyeOff, Mail, Lock, User, Loader2, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]

const formVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
}

const fieldVariants = {
  hidden:   { opacity: 0, y: 10 },
  visible:  (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.3, delay: i * 0.07, ease: 'easeOut' as const },
  }),
}

// Password strength checker
const getStrength = (p: string) => {
  if (!p) return 0
  let s = 0
  if (p.length >= 8)          s++
  if (/[A-Z]/.test(p))        s++
  if (/[0-9]/.test(p))        s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return s
}

const strengthMeta = [
  { label: '',       color: 'bg-border' },
  { label: 'Weak',   color: 'bg-destructive' },
  { label: 'Fair',   color: 'bg-amber-500' },
  { label: 'Good',   color: 'bg-yellow-400' },
  { label: 'Strong', color: 'bg-accent' },
]

const requirements = [
  { label: '8+ characters',   test: (p: string) => p.length >= 8 },
  { label: 'Uppercase (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Number (0-9)',    test: (p: string) => /[0-9]/.test(p) },
]

export default function SignupPage() {
  const router = useRouter()
  const { register } = useAuth()

  const [form, setForm]       = useState({ name: '', email: '', password: '', confirm: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState<string[]>([])

  const strength = getStrength(form.password)
  const { label: strengthLabel, color: strengthColor } = strengthMeta[strength]

  const passwordMatch = form.confirm.length > 0 && form.password === form.confirm

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors([])

    const errs: string[] = []
    if (form.password !== form.confirm)    errs.push('Passwords do not match')
    if (form.password.length < 8)          errs.push('Password must be at least 8 characters')
    if (!/[A-Z]/.test(form.password))      errs.push('Password must contain an uppercase letter')
    if (!/[0-9]/.test(form.password))      errs.push('Password must contain a number')
    if (errs.length) { setErrors(errs); return }

    setLoading(true)
    try {
      await register(form.name, form.email, form.password)
      toast.success('Account created! Check your email for the verification code.')
      router.push(`/auth/verify-otp?email=${encodeURIComponent(form.email)}`)
    } catch (err: any) {
      const data = err?.response?.data
      if (Array.isArray(data?.errors)) setErrors(data.errors)
      else setErrors([data?.message || 'Registration failed. Try again.'])
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-background flex items-center justify-center px-6 py-12"
    >
      <motion.div
        variants={formVariants}
        initial="hidden" animate="visible"
        className="w-full max-w-[420px]"
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-10"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-glow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <span className="text-xl font-bold">NexChat</span>
        </motion.div>

        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight mb-2">Create account</h2>
          <p className="text-muted-foreground">Join thousands of teams already on NexChat</p>
        </div>

        {/* Steps indicator */}
        <div className="flex gap-2 mb-8">
          {['Account Info', 'Verify Email', 'Start Chatting'].map((step, i) => (
            <div key={i} className="flex-1">
              <div className={cn('h-1 rounded-full mb-1.5 transition-all', i === 0 ? 'bg-primary' : 'bg-border')} />
              <span className={cn('text-xs', i === 0 ? 'text-primary' : 'text-muted-foreground/40')}>{step}</span>
            </div>
          ))}
        </div>

        {/* Errors */}
        <AnimatePresence>
          {errors.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 px-4 py-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm space-y-1"
            >
              {errors.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-destructive">
                  <AlertCircle size={13} className="shrink-0" />
                  {e}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
            <label className="block text-sm font-medium mb-2">Full name</label>
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                required placeholder="Ali Hassan"
                className="input-base pl-11"
              />
            </div>
          </motion.div>

          {/* Email */}
          <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
            <label className="block text-sm font-medium mb-2">Email address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="email" value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                required placeholder="you@example.com"
                className="input-base pl-11"
              />
            </div>
          </motion.div>

          {/* Password */}
          <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
            <label className="block text-sm font-medium mb-2">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type={showPass ? 'text' : 'password'} value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                required placeholder="Min. 8 chars, 1 uppercase, 1 number"
                className="input-base pl-11 pr-11"
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Strength meter + requirements */}
            <AnimatePresence>
              {form.password && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 overflow-hidden"
                >
                  {/* Meter bars */}
                  <div className="flex gap-1 mb-2">
                    {[1, 2, 3, 4].map(n => (
                      <div key={n} className={cn(
                        'h-1 flex-1 rounded-full transition-all duration-300',
                        strength >= n ? strengthColor : 'bg-border',
                      )} />
                    ))}
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex gap-3">
                      {requirements.map(req => (
                        <span key={req.label} className={cn(
                          'text-xs flex items-center gap-1 transition-colors',
                          req.test(form.password) ? 'text-accent' : 'text-muted-foreground',
                        )}>
                          <CheckCircle2 size={11} />
                          {req.label}
                        </span>
                      ))}
                    </div>
                    {strengthLabel && (
                      <span className="text-xs text-muted-foreground">{strengthLabel}</span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Confirm password */}
          <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible">
            <label className="block text-sm font-medium mb-2">Confirm password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="password" value={form.confirm}
                onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
                required placeholder="Re-enter password"
                className={cn(
                  'input-base pl-11 pr-11',
                  form.confirm && !passwordMatch && 'border-destructive/60 focus:border-destructive/60 focus:ring-destructive/30',
                )}
              />
              {form.confirm && (
                <div className={cn(
                  'absolute right-4 top-1/2 -translate-y-1/2 transition-colors',
                  passwordMatch ? 'text-accent' : 'text-destructive',
                )}>
                  <CheckCircle2 size={16} />
                </div>
              )}
            </div>
          </motion.div>

          {/* Submit */}
          <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="visible">
            <button type="submit" disabled={loading} className="btn-primary w-full mt-1">
              {loading
                ? <><Loader2 size={17} className="animate-spin" /> Creating account...</>
                : <><span>Create account</span><ArrowRight size={17} /></>}
            </button>
          </motion.div>
        </form>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-muted-foreground text-sm mt-7"
        >
          Already have an account?{' '}
          <Link href="/auth/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
            Sign in
          </Link>
        </motion.p>
      </motion.div>
    </motion.div>
  )
}
