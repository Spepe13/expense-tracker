'use client'

import { useEffect, useRef, useState } from 'react'
import { Cloud, CloudOff, CreditCard, Download, LayoutDashboard, Loader2, LogOut, RefreshCw, Upload, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { currentMonth } from '../lib/utils'
import { useFinance } from '../hooks/useFinance'
import { Splash, useConfirm, useToast } from './ui'
import BudgetView from './budget/BudgetView'
import InstallmentsView from './installments/InstallmentsView'

const TABS = [
  { key: 'budget', label: 'Προϋπολογισμός', icon: LayoutDashboard },
  { key: 'installments', label: 'Δόσεις', icon: CreditCard },
]

function SyncBadge({ status }) {
  if (status === 'syncing' || status === 'loading')
    return (
      <span className="flex items-center gap-1 text-[11px] text-indigo-300">
        <Loader2 size={10} className="animate-spin" /> Συγχρονισμός
      </span>
    )
  if (status === 'offline')
    return (
      <span className="flex items-center gap-1 text-[11px] text-amber-300">
        <CloudOff size={10} /> Εκτός σύνδεσης
      </span>
    )
  return (
    <span className="flex items-center gap-1 text-[11px] text-emerald-400/80">
      <Cloud size={10} /> Συγχρονισμένο
    </span>
  )
}

function UserMenu({ user, fin }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const fileRef = useRef(null)
  const confirm = useConfirm()
  const toast = useToast()
  const name = user.user_metadata?.full_name?.trim() || user.email.split('@')[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  const onImport = (ev) => {
    const f = ev.target.files?.[0]
    ev.target.value = ''
    if (!f) return
    const r = new FileReader()
    r.onload = async (e) => {
      let data
      try {
        data = JSON.parse(e.target.result)
      } catch {
        toast.error('Μη έγκυρο αρχείο backup')
        return
      }
      const ok = await confirm({
        title: 'Εισαγωγή δεδομένων',
        message: `Θα εισαχθούν ${data.monthlyBudgets?.length || 0} μήνες, ${data.installments?.length || 0} προγράμματα δόσεων και ${(data.recurringItems?.incomes?.length || 0) + (data.recurringItems?.expenses?.length || 0)} επαναλαμβανόμενα στον λογαριασμό σου. Οι μήνες που υπάρχουν ήδη θα αντικατασταθούν.`,
        confirmLabel: 'Εισαγωγή',
      })
      if (!ok) return
      const res = await fin.importData(data)
      if (res.ok) toast.success('Η εισαγωγή ολοκληρώθηκε')
    }
    r.readAsText(f)
  }

  const item = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-200 transition hover:bg-white/[0.06]'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Μενού λογαριασμού"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-sm font-bold uppercase text-white shadow-lg shadow-indigo-500/20"
      >
        {name[0]}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 animate-pop rounded-2xl border border-white/10 bg-[#151a25] p-2 shadow-2xl">
          <div className="px-3 pb-3 pt-2">
            <div className="truncate font-semibold text-white">{name}</div>
            <div className="truncate text-xs text-slate-500">{user.email}</div>
          </div>
          <div className="border-t border-white/[0.06] pt-2">
            <button className={item} onClick={() => { fin.reload(); setOpen(false) }}>
              <RefreshCw size={16} className="text-slate-400" /> Ανανέωση δεδομένων
            </button>
            <button className={item} onClick={() => { fin.exportData(); setOpen(false) }}>
              <Download size={16} className="text-slate-400" /> Εξαγωγή backup
            </button>
            <button className={item} onClick={() => fileRef.current?.click()}>
              <Upload size={16} className="text-slate-400" /> Εισαγωγή backup
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImport} />
          </div>
          <div className="mt-2 border-t border-white/[0.06] pt-2">
            <button className={`${item} text-rose-300`} onClick={() => supabase.auth.signOut()}>
              <LogOut size={16} /> Αποσύνδεση
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExpenseTracker({ user }) {
  const toast = useToast()
  const fin = useFinance(user, { onError: (m) => toast.error(m) })
  const [tab, setTab] = useState('budget')
  const [month, setMonth] = useState(currentMonth)
  const { ensureRecurring, loaded, recurring } = fin

  useEffect(() => {
    if (loaded) ensureRecurring(month)
  }, [month, loaded, recurring, ensureRecurring])

  const goTo = (k) => {
    setTab(k)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!loaded) return <Splash />

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0b0e15]/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/25">
              <Wallet className="text-white" size={20} />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold tracking-tight text-white">FinTrack</div>
              <SyncBadge status={fin.status} />
            </div>
          </div>

          <nav className="ml-6 hidden gap-1 rounded-2xl bg-white/[0.04] p-1 md:flex">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => goTo(key)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </nav>

          <div className="ml-auto">
            <UserMenu user={user} fin={fin} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5 md:pb-16 md:pt-8">
        {tab === 'budget' ? <BudgetView fin={fin} month={month} setMonth={setMonth} goToInstallments={() => goTo('installments')} /> : <InstallmentsView fin={fin} />}
      </main>

      {/* Bottom navigation (κινητό) */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.06] bg-[#0b0e15]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-2">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => goTo(key)} className={`flex flex-col items-center gap-1 py-3 text-[11px] font-semibold transition ${tab === key ? 'text-white' : 'text-slate-500'}`}>
              <span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${tab === key ? 'bg-indigo-500/20 text-indigo-200' : ''}`}>
                <Icon size={20} />
              </span>
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
