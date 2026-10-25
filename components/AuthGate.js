'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import AuthScreen, { ResetPassword } from './AuthScreen'
import ExpenseTracker from './ExpenseTracker'
import { ConfirmProvider, Splash, ToastProvider } from './ui'

export default function AuthGate() {
  const [session, setSession] = useState(undefined)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!supabase) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6 text-center">
        <div className="max-w-sm rounded-3xl border border-amber-500/20 bg-amber-500/10 p-6 text-amber-200">
          <h1 className="text-lg font-bold">Λείπουν οι ρυθμίσεις Supabase</h1>
          <p className="mt-2 text-sm text-amber-200/80">
            Όρισε τα <code>NEXT_PUBLIC_SUPABASE_URL</code> και <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> στο Vercel (ή στο .env.local).
          </p>
        </div>
      </div>
    )
  }

  if (session === undefined) return <Splash />

  return (
    <ToastProvider>
      <ConfirmProvider>
        {recovery && session ? (
          <ResetPassword onDone={() => setRecovery(false)} />
        ) : session ? (
          <ExpenseTracker key={session.user.id} user={session.user} />
        ) : (
          <AuthScreen />
        )}
      </ConfirmProvider>
    </ToastProvider>
  )
}
