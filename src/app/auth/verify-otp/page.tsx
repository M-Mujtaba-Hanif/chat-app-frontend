'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { MessageSquare, Loader2, AlertCircle, CheckCircle, RefreshCw, Mail } from 'lucide-react'

function VerifyOtpContent() {
  const router = useRouter()
  const params = useSearchParams()
  const email = params.get('email') || ''
  const { verifyOtp, sendOtp } = useAuth()
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const t = setInterval(() => setCountdown(c => c - 1), 1000)
    return () => clearInterval(t)
  }, [countdown])

  const handleChange = (idx: number, val: string) => {
    const char = val.replace(/\D/g, '').slice(-1)
    const next = [...code]
    next[idx] = char
    setCode(next)
    if (char && idx < 5) inputRefs.current[idx + 1]?.focus()
    if (next.every(c => c)) handleVerify(next.join(''))
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setCode(pasted.split(''))
      handleVerify(pasted)
    }
  }

  const handleVerify = async (otp: string) => {
    setError('')
    setLoading(true)
    try {
      await verifyOtp(email, otp)
      setSuccess(true)
      setTimeout(() => router.push('/auth/login'), 2000)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid OTP. Try again.')
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResending(true)
    setError('')
    try {
      await sendOtp(email)
      setCountdown(60)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to resend OTP')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
            <MessageSquare size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold text-white">NexChat</span>
        </div>

        {success ? (
          <div className="animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-accent-500/20 border border-accent-500/40 flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} className="text-accent-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Verified!</h2>
            <p className="text-slate-400">Your account is now active. Redirecting to login...</p>
          </div>
        ) : (
          <>
            {/* Email icon */}
            <div className="w-20 h-20 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center mx-auto mb-6">
              <Mail size={36} className="text-brand-400" />
            </div>

            <h2 className="text-3xl font-bold text-white mb-3">Check your email</h2>
            <p className="text-slate-400 mb-2">We sent a 6-digit code to</p>
            <p className="text-brand-400 font-semibold mb-8">{email}</p>

            {error && (
              <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm animate-fade-in">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            {/* OTP inputs */}
            <div className="flex gap-3 justify-center mb-8" onPaste={handlePaste}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  disabled={loading}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-xl border transition-all duration-200 bg-surface-800 text-white outline-none
                    ${digit ? 'border-brand-500 bg-brand-500/10 text-brand-300' : 'border-slate-700'}
                    focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30`}
                />
              ))}
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 text-brand-400 mb-6">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Verifying...</span>
              </div>
            )}

            {/* Resend */}
            <div className="text-sm text-slate-400">
              Didn&apos;t receive the code?{' '}
              {countdown > 0 ? (
                <span className="text-slate-500">Resend in {countdown}s</span>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="text-brand-400 hover:text-brand-300 font-medium transition-colors inline-flex items-center gap-1.5"
                >
                  {resending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Resend code
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function VerifyOtpPage() {
  return (
    <Suspense>
      <VerifyOtpContent />
    </Suspense>
  )
}
