'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { MessageSquare, Loader2, AlertCircle, CheckCircle, Mail, RefreshCw } from 'lucide-react'

export default function VerifyOtpPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { verifyOtp, sendOtp } = useAuth()
  const email = params.get('email') || ''
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [countdown])

  const handleChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return
    const next = [...code]
    next[i] = val.slice(-1)
    setCode(next)
    if (val && i < 5) inputRefs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) inputRefs.current[i - 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setCode(pasted.split(''))
      inputRefs.current[5]?.focus()
    }
  }

  const handleVerify = async () => {
    const fullCode = code.join('')
    if (fullCode.length < 6) { setError('Please enter the full 6-digit code'); return }
    setError('')
    setLoading(true)
    try {
      await verifyOtp(email, fullCode)
      setSuccess(true)
      setTimeout(() => router.push('/auth/login?verified=1'), 1500)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid or expired OTP')
    } finally { setLoading(false) }
  }

  const handleResend = async () => {
    if (countdown > 0) return
    setResending(true)
    try {
      await sendOtp(email)
      setCountdown(60)
      setCode(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to resend OTP')
    } finally { setResending(false) }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
            <MessageSquare size={20} className="text-white" />
          </div>
          <span className="text-xl font-bold text-white">NexChat</span>
        </div>

        <div className="bg-surface-900 border border-slate-800/60 rounded-2xl p-8">
          <div className="flex items-center justify-center w-14 h-14 bg-brand-500/15 rounded-2xl mx-auto mb-5">
            <Mail size={26} className="text-brand-400" />
          </div>

          <h2 className="text-2xl font-bold text-white text-center mb-2">Verify your email</h2>
          <p className="text-slate-400 text-sm text-center mb-1">We sent a 6-digit code to</p>
          <p className="text-brand-400 font-medium text-sm text-center mb-8 truncate">{email}</p>

          {success ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle size={40} className="text-emerald-400" />
              <p className="text-emerald-400 font-semibold">Email verified!</p>
              <p className="text-slate-500 text-sm">Redirecting to login...</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm mb-6">
                  <AlertCircle size={15} className="shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
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
                    className={`w-11 h-14 text-center text-xl font-bold bg-surface-800 border rounded-xl text-white focus:outline-none transition-all ${
                      digit ? 'border-brand-500 bg-brand-500/10' : 'border-slate-700 focus:border-brand-500/60'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={handleVerify}
                disabled={loading || code.join('').length < 6}
                className="w-full bg-gradient-to-r from-brand-500 to-brand-700 hover:from-brand-400 hover:to-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3.5 transition-all flex items-center justify-center gap-2 mb-4"
              >
                {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : 'Verify Email'}
              </button>

              <div className="flex items-center justify-center gap-2">
                <p className="text-slate-500 text-sm">Didn&apos;t receive the code?</p>
                <button
                  onClick={handleResend}
                  disabled={countdown > 0 || resending}
                  className="text-sm font-medium flex items-center gap-1 disabled:text-slate-600 disabled:cursor-not-allowed text-brand-400 hover:text-brand-300 transition-colors"
                >
                  {resending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  {countdown > 0 ? `Resend in ${countdown}s` : 'Resend'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
