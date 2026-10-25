'use client'

import { useState } from 'react'
import { Wallet, Mail, Lock, Eye, EyeOff, User, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, inputCls } from './ui'

const translate = (msg = '') => {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Λάθος email ή κωδικός.'
  if (m.includes('email not confirmed')) return 'Δεν έχεις επιβεβαιώσει ακόμα το email σου. Έλεγξε τα εισερχόμενα.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Υπάρχει ήδη λογαριασμός με αυτό το email.'
  if (m.includes('password should be at least')) return 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.'
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Το email δεν είναι έγκυρο.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Πολλές προσπάθειες. Δοκίμασε ξανά σε λίγο.'
  if (m.includes('signups not allowed')) return 'Οι εγγραφές είναι κλειστές. Ζήτα πρόσκληση από τον διαχειριστή.'
  return msg || 'Κάτι πήγε στραβά. Δοκίμασε ξανά.'
}

function Shell({ children }) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[680px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[300px] w-[400px] rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="relative w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500 shadow-xl shadow-indigo-500/30">
            <Wallet className="text-white" size={26} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">FinTrack</h1>
          <p className="mt-1 text-sm text-slate-400">Έσοδα, έξοδα και δόσεις — όλα σε ένα μέρος</p>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-[#121620]/90 p-6 shadow-2xl backdrop-blur">{children}</div>
      </div>
    </div>
  )
}

function Field({ icon: Icon, right, ...props }) {
  return (
    <div className="relative">
      <Icon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
      <input {...props} className={`${inputCls} pl-11 ${right ? 'pr-12' : ''}`} />
      {right && <div className="absolute right-2 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  )
}

export default function AuthScreen() {
  const [mode, setMode] = useState('signin') // signin | signup | forgot
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectTo, data: { full_name: name.trim() } },
        })
        if (error) throw error
        if (!data.session) setDone(`Σου στείλαμε email στο ${email.trim()}. Πάτα τον σύνδεσμο για να ενεργοποιήσεις τον λογαριασμό σου.`)
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
        if (error) throw error
        setDone(`Αν υπάρχει λογαριασμός με το ${email.trim()}, θα λάβεις σύνδεσμο επαναφοράς κωδικού.`)
      }
    } catch (err) {
      setError(translate(err.message))
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (m) => {
    setMode(m)
    setError('')
    setDone('')
  }

  if (done) {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
            <CheckCircle2 className="text-emerald-400" size={26} />
          </div>
          <h2 className="text-lg font-bold text-white">Έλεγξε το email σου</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">{done}</p>
          <Button tone="ghost" className="mt-6 w-full" onClick={() => switchMode('signin')}>
            Επιστροφή στη σύνδεση
          </Button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      {mode !== 'forgot' ? (
        <div className="mb-6 grid grid-cols-2 rounded-2xl bg-white/[0.04] p-1">
          {[
            ['signin', 'Σύνδεση'],
            ['signup', 'Εγγραφή'],
          ].map(([k, l]) => (
            <button
              key={k}
              onClick={() => switchMode(k)}
              className={`rounded-xl py-2.5 text-sm font-semibold transition ${mode === k ? 'bg-white/10 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              {l}
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-5">
          <h2 className="text-lg font-bold text-white">Ξέχασες τον κωδικό;</h2>
          <p className="mt-1 text-sm text-slate-400">Βάλε το email σου και θα σου στείλουμε σύνδεσμο επαναφοράς.</p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-3">
        {mode === 'signup' && <Field icon={User} type="text" placeholder="Όνομα (προαιρετικό)" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />}
        <Field icon={Mail} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        {mode !== 'forgot' && (
          <Field
            icon={Lock}
            type={showPw ? 'text' : 'password'}
            placeholder={mode === 'signup' ? 'Κωδικός (τουλ. 6 χαρακτήρες)' : 'Κωδικός'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            right={
              <button type="button" onClick={() => setShowPw((v) => !v)} className="rounded-lg p-2 text-slate-500 hover:text-slate-200" aria-label="Εμφάνιση κωδικού">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
        )}

        {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}

        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : null}
          {mode === 'signin' ? 'Σύνδεση' : mode === 'signup' ? 'Δημιουργία λογαριασμού' : 'Αποστολή συνδέσμου'}
          {!busy && <ArrowRight size={18} />}
        </Button>
      </form>

      <div className="mt-5 text-center text-sm">
        {mode === 'signin' && (
          <button onClick={() => switchMode('forgot')} className="text-slate-400 hover:text-white">
            Ξέχασες τον κωδικό;
          </button>
        )}
        {mode === 'forgot' && (
          <button onClick={() => switchMode('signin')} className="text-slate-400 hover:text-white">
            ← Πίσω στη σύνδεση
          </button>
        )}
      </div>
    </Shell>
  )
}

export function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(translate(error.message))
    else onDone()
  }

  return (
    <Shell>
      <h2 className="text-lg font-bold text-white">Νέος κωδικός</h2>
      <p className="mb-5 mt-1 text-sm text-slate-400">Διάλεξε έναν νέο κωδικό για τον λογαριασμό σου.</p>
      <form onSubmit={submit} className="space-y-3">
        <Field icon={Lock} type="password" placeholder="Νέος κωδικός" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
        {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy && <Loader2 size={18} className="animate-spin" />}
          Αποθήκευση κωδικού
        </Button>
      </form>
    </Shell>
  )
}
