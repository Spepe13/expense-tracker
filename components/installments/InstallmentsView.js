'use client'

import { useEffect, useState } from 'react'
import { Calendar, Check, ChevronRight, CreditCard, Plus, Trash2 } from 'lucide-react'
import { currentMonth, fmt, fmtDate, fmtDateShort, parseAmount, same, sum, today } from '../../lib/utils'
import { Button, Label, Sheet, cardCls, inputCls, useConfirm, useToast } from '../ui'

const planStats = (p) => {
  const paid = p.payments.filter((x) => x.paid)
  const unpaid = p.payments.filter((x) => !x.paid)
  return {
    paidCount: paid.length,
    remaining: sum(unpaid, (x) => x.amount),
    next: unpaid.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] || null,
    done: unpaid.length === 0,
  }
}

// ---------------------------------------------------------------------------
function AddPlanSheet({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: '', amount: '', startDate: '', totalInstallments: '', dayOfMonth: '1' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setForm({ name: '', amount: '', startDate: today(), totalInstallments: '', dayOfMonth: String(new Date().getDate()) })
  }, [open])

  const amount = parseAmount(form.amount)
  const n = parseInt(form.totalInstallments, 10)
  const day = Math.min(31, Math.max(1, parseInt(form.dayOfMonth, 10) || 1))
  const valid = form.name.trim() && amount > 0 && n > 0 && n <= 360 && form.startDate

  const submit = async (e) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    await onSubmit({ name: form.name.trim(), amount, startDate: form.startDate, totalInstallments: n, dayOfMonth: day })
    setBusy(false)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Νέο πρόγραμμα δόσεων">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <Label>Όνομα</Label>
          <input className={inputCls} placeholder="π.χ. Laptop, Δάνειο αυτοκινήτου" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <Label>Ποσό δόσης</Label>
            <input className={inputCls} inputMode="decimal" placeholder="0,00 €" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.,]/g, '') })} />
          </label>
          <label className="block">
            <Label>Αριθμός δόσεων</Label>
            <input className={inputCls} inputMode="numeric" placeholder="12" value={form.totalInstallments} onChange={(e) => setForm({ ...form, totalInstallments: e.target.value.replace(/\D/g, '') })} />
          </label>
          <label className="block">
            <Label>Πρώτη δόση</Label>
            <input type="date" className={`${inputCls} [color-scheme:dark]`} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </label>
          <label className="block">
            <Label>Ημέρα πληρωμής</Label>
            <input className={inputCls} inputMode="numeric" placeholder="1–31" value={form.dayOfMonth} onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
          </label>
        </div>

        {valid && (
          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.07] px-4 py-3 text-sm text-indigo-100/90">
            {n} δόσεις × {fmt(amount)} = <b className="text-white">{fmt(amount * n)}</b>
            <div className="mt-0.5 text-xs text-indigo-200/60">Πληρωμή στις {day} κάθε μήνα</div>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={!valid || busy}>
          Δημιουργία προγράμματος
        </Button>
      </form>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
function PlanSheet({ plan, fin, onClose }) {
  const confirm = useConfirm()
  const toast = useToast()
  if (!plan) return null
  const st = planStats(plan)
  const t = today()

  const remove = async () => {
    const ok = await confirm({
      title: 'Διαγραφή προγράμματος',
      message: `Να διαγραφεί το «${plan.name}» μαζί με όλο το ιστορικό δόσεων;`,
      confirmLabel: 'Διαγραφή',
      tone: 'expense',
    })
    if (!ok) return
    await fin.removePlan(plan.id)
    toast.success('Το πρόγραμμα διαγράφηκε')
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={plan.name} subtitle={`${fmt(plan.amount)} × ${plan.totalInstallments} δόσεις`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/[0.03] p-3.5">
            <div className="text-xs text-slate-500">Πληρωμένες</div>
            <div className="text-lg font-bold tabular-nums text-white">
              {st.paidCount}/{plan.totalInstallments}
            </div>
          </div>
          <div className="rounded-2xl bg-white/[0.03] p-3.5">
            <div className="text-xs text-slate-500">Υπόλοιπο</div>
            <div className="text-lg font-bold tabular-nums text-rose-300">{fmt(st.remaining)}</div>
          </div>
        </div>

        <ul className="max-h-[45vh] divide-y divide-white/[0.05] overflow-y-auto rounded-2xl border border-white/[0.06]">
          {plan.payments.map((pay) => {
            const overdue = !pay.paid && pay.dueDate < t
            return (
              <li key={pay.number} className="flex items-center gap-3 px-4 py-3">
                <button
                  onClick={() => fin.togglePlanPayment(plan.id, pay.number)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition active:scale-90 ${
                    pay.paid ? 'bg-emerald-500 text-white' : overdue ? 'border-2 border-rose-400/60 text-rose-300' : 'border-2 border-white/15 text-slate-400 hover:border-indigo-400 hover:text-indigo-300'
                  }`}
                >
                  {pay.paid ? <Check size={16} strokeWidth={3} /> : pay.number}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${pay.paid ? 'text-slate-500' : 'text-slate-100'}`}>Δόση {pay.number}</div>
                  <div className={`flex items-center gap-1 text-xs ${overdue ? 'text-rose-300' : 'text-slate-500'}`}>
                    <Calendar size={11} /> {fmtDate(pay.dueDate)}
                    {overdue && ' · ληξιπρόθεσμη'}
                    {pay.paid && pay.paidDate && ` · πληρώθηκε ${fmtDate(pay.paidDate)}`}
                  </div>
                </div>
                <span className={`text-sm font-semibold tabular-nums ${pay.paid ? 'text-slate-500' : 'text-slate-100'}`}>{fmt(pay.amount)}</span>
              </li>
            )
          })}
        </ul>

        <Button tone="danger" className="w-full" onClick={remove}>
          <Trash2 size={16} /> Διαγραφή προγράμματος
        </Button>
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
export default function InstallmentsView({ fin }) {
  const toast = useToast()
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState(null)
  const t = today()
  const m = currentMonth()

  const plans = fin.installments
  const totalOwed = sum(plans, (p) => planStats(p).remaining)
  const thisMonth = plans.flatMap((p) => p.payments.filter((x) => x.dueDate?.startsWith(m)))
  const thisMonthLeft = sum(thisMonth.filter((x) => !x.paid), (x) => x.amount)

  const upcoming = plans
    .map((p) => ({ plan: p, next: planStats(p).next }))
    .filter((x) => x.next)
    .sort((a, b) => a.next.dueDate.localeCompare(b.next.dueDate))
    .slice(0, 5)

  const sorted = [...plans].sort((a, b) => Number(planStats(a).done) - Number(planStats(b).done))
  const openPlan = plans.find((p) => same(p.id, openId))

  return (
    <div className="space-y-4 md:space-y-5">
      <h2 className="px-1 text-xl font-extrabold tracking-tight text-white">Δόσεις</h2>

      <section className={`relative overflow-hidden ${cardCls} p-5 md:p-6`}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="relative">
          <div className="text-sm font-medium text-slate-400">Συνολικές οφειλές</div>
          <div className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums text-white">{fmt(totalOwed)}</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/[0.04] px-3.5 py-2.5">
              <div className="text-xs text-slate-400">Μένουν αυτόν τον μήνα</div>
              <div className="mt-0.5 font-bold tabular-nums text-amber-200">{fmt(thisMonthLeft)}</div>
            </div>
            <div className="rounded-2xl bg-white/[0.04] px-3.5 py-2.5">
              <div className="text-xs text-slate-400">Ενεργά προγράμματα</div>
              <div className="mt-0.5 font-bold tabular-nums text-white">{plans.filter((p) => !planStats(p).done).length}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-5 md:gap-5">
        {upcoming.length > 0 && (
          <section className={`${cardCls} overflow-hidden md:col-span-2 md:self-start`}>
            <h3 className="px-5 pb-2 pt-4 text-sm font-semibold text-slate-300">Επόμενες δόσεις</h3>
            <ul className="divide-y divide-white/[0.04]">
              {upcoming.map(({ plan, next }) => {
                const overdue = next.dueDate < t
                return (
                  <li key={plan.id} className="flex items-center gap-3 px-5 py-3">
                    <button
                      onClick={async () => {
                        await fin.togglePlanPayment(plan.id, next.number)
                        toast.success(`Δόση ${next.number} · ${plan.name}`, { action: { label: 'Αναίρεση', onClick: () => fin.togglePlanPayment(plan.id, next.number) } })
                      }}
                      aria-label="Σημείωση ως πληρωμένη"
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition active:scale-90 ${overdue ? 'border-rose-400/60 text-rose-300' : 'border-white/15 text-slate-600 hover:border-indigo-400 hover:text-indigo-300'}`}
                    >
                      <Check size={16} strokeWidth={3} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-100">{plan.name}</div>
                      <div className={`text-xs ${overdue ? 'text-rose-300' : 'text-slate-500'}`}>
                        {overdue ? 'Ληξιπρόθεσμη · ' : ''}
                        {fmtDateShort(next.dueDate)} · δόση {next.number}/{plan.totalInstallments}
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-slate-100">{fmt(next.amount)}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <div className={`space-y-3 ${upcoming.length ? 'md:col-span-3' : 'md:col-span-5'}`}>
          {sorted.map((plan) => {
            const st = planStats(plan)
            const pct = (st.paidCount / plan.totalInstallments) * 100
            return (
              <button key={plan.id} onClick={() => setOpenId(plan.id)} className={`${cardCls} block w-full p-4 text-left transition hover:bg-white/[0.05] ${st.done ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${st.done ? 'bg-emerald-500/15' : 'bg-indigo-500/10'}`}>
                    {st.done ? <Check size={20} className="text-emerald-400" /> : <CreditCard size={20} className="text-indigo-300" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-100">{plan.name}</div>
                    <div className="text-xs text-slate-500">
                      {fmt(plan.amount)} × {plan.totalInstallments}
                      {st.next && ` · επόμενη ${fmtDateShort(st.next.dueDate)}`}
                      {st.done && ' · ολοκληρώθηκε'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold tabular-nums text-slate-100">{fmt(st.remaining)}</div>
                    <div className="text-xs tabular-nums text-slate-500">
                      {st.paidCount}/{plan.totalInstallments}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-600" />
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className={`h-full rounded-full ${st.done ? 'bg-emerald-400' : 'bg-indigo-400'}`} style={{ width: `${pct}%` }} />
                </div>
              </button>
            )
          })}

          {!plans.length && (
            <section className={`${cardCls} px-6 py-12 text-center`}>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10">
                <CreditCard className="text-indigo-300" size={24} />
              </div>
              <h3 className="font-bold text-white">Κανένα πρόγραμμα δόσεων</h3>
              <p className="mt-1 text-sm text-slate-400">Πρόσθεσε δάνεια ή αγορές με δόσεις για να βλέπεις τι χρωστάς και πότε.</p>
              <Button className="mt-4" onClick={() => setAdding(true)}>
                <Plus size={18} /> Νέο πρόγραμμα
              </Button>
            </section>
          )}
        </div>
      </div>

      <button
        onClick={() => setAdding(true)}
        aria-label="Νέο πρόγραμμα δόσεων"
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-xl shadow-indigo-500/30 transition hover:bg-indigo-400 active:scale-95 md:bottom-8 md:right-8"
      >
        <Plus size={26} />
      </button>

      <AddPlanSheet
        open={adding}
        onClose={() => setAdding(false)}
        onSubmit={async (data) => {
          await fin.addPlan(data)
          toast.success('Το πρόγραμμα δημιουργήθηκε')
        }}
      />
      {openPlan && <PlanSheet plan={openPlan} fin={fin} onClose={() => setOpenId(null)} />}
    </div>
  )
}
