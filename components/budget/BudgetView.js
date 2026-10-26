'use client'

import { useMemo, useRef, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Copy, CreditCard, Plus, Repeat, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { categoryColor, currentMonth, daysLeftInMonth, fmt, fmtDateShort, monthGen, monthName, monthNameShort, same, shiftMonth, sum } from '../../lib/utils'
import { cardCls, useConfirm, useToast } from '../ui'
import BudgetAlert, { getBudgetAlert } from './BudgetAlert'
import { AddEntrySheet, ExpenseSheet, IncomeSheet, RecurringSheet } from './EntrySheets'

// ---------------------------------------------------------------------------
function MonthSwitcher({ month, setMonth, onCopy }) {
  const isCurrent = month === currentMonth()
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Προηγούμενος μήνας" className="rounded-full p-2.5 text-slate-300 transition hover:bg-white/10">
        <ChevronLeft size={20} />
      </button>
      <div className="min-w-0 flex-1 text-center">
        <h2 className="text-xl font-extrabold tracking-tight text-white">{monthName(month)}</h2>
        <div className="mt-0.5 flex items-center justify-center gap-3 text-xs">
          {!isCurrent && (
            <button onClick={() => setMonth(currentMonth())} className="font-semibold text-indigo-300 hover:text-indigo-200">
              Σήμερα
            </button>
          )}
          <button onClick={onCopy} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-300">
            <Copy size={11} /> Αντιγραφή στον επόμενο
          </button>
        </div>
      </div>
      <button onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Επόμενος μήνας" className="rounded-full p-2.5 text-slate-300 transition hover:bg-white/10">
        <ChevronRight size={20} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
function BalanceHero({ month, income, expenses, paid, installments }) {
  const balance = income - expenses
  const pending = expenses - paid
  const negative = balance < 0
  const base = Math.max(income, expenses, 1)
  const pPaid = (paid / base) * 100
  const pPending = (pending / base) * 100
  const isCurrent = month === currentMonth()

  return (
    <section className={`relative overflow-hidden ${cardCls} p-5 md:p-6`}>
      <div className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${negative ? 'bg-rose-500/15' : 'bg-indigo-500/15'}`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-400">Υπόλοιπο {monthGen(month)}</span>
          {isCurrent && <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-slate-400">{daysLeftInMonth()} ημέρες ακόμα</span>}
        </div>
        <div className={`mt-1 text-4xl font-extrabold tracking-tight tabular-nums md:text-5xl ${negative ? 'text-rose-300' : 'text-white'}`}>{fmt(balance)}</div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-emerald-500/[0.07] px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 text-xs text-emerald-300/80">
              <TrendingUp size={13} /> Έσοδα
            </div>
            <div className="mt-0.5 font-bold tabular-nums text-emerald-200">{fmt(income)}</div>
          </div>
          <div className="rounded-2xl bg-rose-500/[0.07] px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 text-xs text-rose-300/80">
              <TrendingDown size={13} /> Έξοδα
            </div>
            <div className="mt-0.5 font-bold tabular-nums text-rose-200">{fmt(expenses)}</div>
            {installments > 0 && <div className="text-[11px] text-rose-200/50">με δόσεις {fmt(installments)}</div>}
          </div>
        </div>

        {expenses > 0 && (
          <>
            <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full bg-indigo-400 transition-all duration-500" style={{ width: `${pPaid}%` }} />
              <div className={`h-full transition-all duration-500 ${negative ? 'bg-rose-400' : 'bg-amber-400'}`} style={{ width: `${pPending}%` }} />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-indigo-400" /> Πληρωμένα {fmt(paid)}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${negative ? 'bg-rose-400' : 'bg-amber-400'}`} /> Εκκρεμή {fmt(pending)}
              </span>
              {!negative && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-white/20" /> Ελεύθερα {fmt(balance)}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
function CategoryBreakdown({ expenses }) {
  const [all, setAll] = useState(false)
  const total = sum(expenses, (e) => e.amount)
  const rows = useMemo(() => {
    const map = {}
    for (const e of expenses) map[e.category || 'Γενικά'] = (map[e.category || 'Γενικά'] || 0) + e.amount
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [expenses])
  if (!rows.length) return null
  const shown = all ? rows : rows.slice(0, 4)

  return (
    <section className={`${cardCls} p-5`}>
      <h3 className="mb-4 text-sm font-semibold text-slate-300">Πού πάνε τα χρήματα</h3>
      <ul className="space-y-3">
        {shown.map((r) => {
          const pct = total ? (r.amount / total) * 100 : 0
          return (
            <li key={r.name}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-200">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: categoryColor(r.name) }} />
                  {r.name}
                </span>
                <span className="tabular-nums text-slate-300">
                  {fmt(r.amount)} <span className="ml-1 text-xs text-slate-500">{Math.round(pct)}%</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: categoryColor(r.name) }} />
              </div>
            </li>
          )
        })}
      </ul>
      {rows.length > 4 && (
        <button onClick={() => setAll((v) => !v)} className="mt-4 text-xs font-semibold text-indigo-300 hover:text-indigo-200">
          {all ? 'Λιγότερα' : `Όλες οι κατηγορίες (${rows.length})`}
        </button>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
function PayCircle({ pct, done, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={done ? 'Εξοφλήθηκε' : 'Εξόφληση'}
      className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-90"
      style={{
        background: done ? '#10b981' : `conic-gradient(#818cf8 ${pct * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
      }}
    >
      {!done && <span className="absolute inset-[3px] rounded-full bg-[#10131b] transition group-hover:bg-[#161a24]" />}
      <Check size={17} className={`relative ${done ? 'text-white' : 'text-slate-600 group-hover:text-indigo-300'}`} strokeWidth={3} />
    </button>
  )
}

function ExpenseRow({ e, onOpen, onPay, onUnpay, maybeDuplicate }) {
  const paid = e.paidAmount || 0
  const done = e.completed || paid >= e.amount
  const pct = e.amount > 0 ? Math.min(100, (paid / e.amount) * 100) : 0
  return (
    <li onClick={onOpen} className="flex cursor-pointer items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.025] active:bg-white/[0.04]">
      <PayCircle
        pct={pct}
        done={done}
        onClick={(ev) => {
          ev.stopPropagation()
          if (done) (e.isInstallment ? onUnpay() : onOpen())
          else onPay()
        }}
      />
      <div className="min-w-0 flex-1">
        <div className={`truncate font-medium ${done ? 'text-slate-500 line-through decoration-slate-600' : 'text-slate-100'}`}>{e.description}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
          {e.isInstallment ? (
            <>
              <CreditCard size={11} className="shrink-0 text-indigo-300/80" />
              <span className="truncate">
                Δόση {e.number}/{e.total} · {fmtDateShort(e.dueDate)}
              </span>
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: categoryColor(e.category) }} />
              <span className="truncate">{e.category}</span>
              {e.recurringId && <Repeat size={11} className="shrink-0" />}
            </>
          )}
        </div>
        {maybeDuplicate && !done && (
          <div className="mt-1 inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">Μοιάζει διπλό με δόση — οι δόσεις μετράνε πλέον αυτόματα</div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className={`font-semibold tabular-nums ${done ? 'text-slate-500' : 'text-slate-100'}`}>{fmt(e.amount)}</div>
        {!done && paid > 0 && <div className="text-[11px] tabular-nums text-amber-300/90">μένουν {fmt(e.amount - paid)}</div>}
      </div>
    </li>
  )
}

function IncomeRow({ i, onOpen }) {
  return (
    <li onClick={onOpen} className="flex cursor-pointer items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.025]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
        {i.recurringId ? <Repeat size={16} className="text-emerald-400" /> : <TrendingUp size={16} className="text-emerald-400" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-slate-100">{i.description}</div>
        <div className="text-xs text-slate-500">{i.recurringId ? 'Κάθε μήνα' : 'Μία φορά'}</div>
      </div>
      <div className="font-semibold tabular-nums text-emerald-300">+{fmt(i.amount)}</div>
    </li>
  )
}

// ---------------------------------------------------------------------------
export default function BudgetView({ fin, month, setMonth, goToInstallments }) {
  const confirm = useConfirm()
  const toast = useToast()
  const listRef = useRef(null)
  const [listTab, setListTab] = useState('expenses')
  const [filter, setFilter] = useState('all')
  const [addKind, setAddKind] = useState(null)
  const [selected, setSelected] = useState(null) // { kind, id }
  const [showRecurring, setShowRecurring] = useState(false)

  const budget = fin.budgetFor(month)
  const incomes = budget.incomes || []
  const expenses = budget.expenses || []

  // Οι δόσεις του μήνα μετράνε αυτόματα ως έξοδα (πηγή: προγράμματα δόσεων)
  const instRows = fin.installments.flatMap((p) =>
    p.payments
      .filter((x) => x.dueDate?.startsWith(month))
      .map((x) => ({
        id: `inst-${p.id}-${x.number}`,
        isInstallment: true,
        planId: p.id,
        number: x.number,
        total: p.totalInstallments,
        dueDate: x.dueDate,
        description: p.name,
        amount: x.amount,
        category: 'Δόσεις',
        paidAmount: x.paid ? x.amount : 0,
        completed: !!x.paid,
      }))
  )
  const allExpenses = [...expenses, ...instRows]

  const totalIncome = sum(incomes, (i) => i.amount)
  const totalExpenses = sum(allExpenses, (e) => e.amount)
  const totalPaid = sum(allExpenses, (e) => Math.min(e.paidAmount || 0, e.amount))

  const instDue = sum(instRows, (x) => x.amount)
  const instUnpaid = instRows.filter((x) => !x.completed)
  const instThisMonth = instRows

  // Χειροκίνητα έξοδα που μάλλον είναι η ίδια δόση (για τη μετάβαση από τη χειροκίνητη καταχώρηση)
  const norm = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  const planNames = instRows.map((r) => norm(r.description)).filter((n) => n.length >= 3)
  const isMaybeDuplicate = (e) => {
    if (e.isInstallment) return false
    const d = norm(e.description)
    return d.length >= 3 && planNames.some((n) => d.includes(n) || n.includes(d))
  }

  const pendingByCategory = useMemo(() => {
    const map = {}
    for (const e of allExpenses) {
      const left = e.amount - (e.paidAmount || 0)
      if (left > 0) map[e.category || 'Γενικά'] = (map[e.category || 'Γενικά'] || 0) + left
    }
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, fin.installments, month])

  const alert = getBudgetAlert({ month, income: totalIncome, expenses: totalExpenses })

  const pendingCount = allExpenses.filter((e) => !(e.completed || (e.paidAmount || 0) >= e.amount)).length
  const shownExpenses = allExpenses
    .filter((e) => {
      const done = e.completed || (e.paidAmount || 0) >= e.amount
      return filter === 'all' || (filter === 'pending' ? !done : done)
    })
    .sort((a, b) => {
      const da = a.completed || (a.paidAmount || 0) >= a.amount
      const db = b.completed || (b.paidAmount || 0) >= b.amount
      return da === db ? b.amount - a.amount : da ? 1 : -1
    })

  const activeRecurringCount = fin.recurring.filter((r) => !r.endMonth || r.endMonth >= month).length

  const selectedEntry = selected
    ? (selected.kind === 'income' ? incomes : expenses).find((x) => same(x.id, selected.id))
    : null

  const copyNext = async () => {
    const next = shiftMonth(month, 1)
    const nonRecurring = incomes.filter((i) => !i.recurringId).length + expenses.filter((e) => !e.recurringId).length
    if (!nonRecurring) {
      toast.info('Δεν υπάρχουν μη-επαναλαμβανόμενες εγγραφές για αντιγραφή')
      return
    }
    const existing = fin.budgetFor(next)
    const ok = await confirm({
      title: `Αντιγραφή στον ${monthNameShort(next)}`,
      message:
        `Θα αντιγραφούν ${nonRecurring} εγγραφές (χωρίς τις πληρωμές τους). Τα επαναλαμβανόμενα προστίθενται ήδη αυτόματα.` +
        (existing.expenses.length || existing.incomes.length ? ' Ο επόμενος μήνας έχει ήδη εγγραφές — οι νέες θα προστεθούν σε αυτές.' : ''),
      confirmLabel: 'Αντιγραφή',
    })
    if (!ok) return
    const target = await fin.copyToNext(month)
    setMonth(target)
    toast.success(`Αντιγράφηκαν στον ${monthNameShort(target)}`)
  }

  const reviewExpenses = () => {
    setListTab('expenses')
    setFilter('pending')
    setTimeout(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const isEmpty = !incomes.length && !allExpenses.length

  return (
    <div className="space-y-4 md:space-y-5">
      <MonthSwitcher month={month} setMonth={setMonth} onCopy={copyNext} />

      <BudgetAlert
        alert={alert}
        month={month}
        income={totalIncome}
        expenses={totalExpenses}
        installmentsDue={instDue}
        topCategories={pendingByCategory}
        onAddIncome={() => setAddKind('income')}
        onReviewExpenses={reviewExpenses}
      />

      <div className="grid gap-4 md:grid-cols-5 md:gap-5">
        <div className="space-y-4 md:col-span-3 md:space-y-5">
          <BalanceHero month={month} income={totalIncome} expenses={totalExpenses} paid={totalPaid} installments={instDue} />

          <div className="grid grid-cols-2 gap-3">
            <div className={`${cardCls} p-4`}>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Wallet size={13} /> Διαθέσιμα τώρα
              </div>
              <div className={`mt-1 text-lg font-bold tabular-nums ${totalIncome - totalPaid < 0 ? 'text-rose-300' : 'text-white'}`}>{fmt(totalIncome - totalPaid)}</div>
              <div className="text-[11px] text-slate-500">έσοδα − πληρωμένα</div>
            </div>
            <button onClick={goToInstallments} className={`${cardCls} p-4 text-left transition hover:bg-white/[0.05]`}>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <CreditCard size={13} /> Δόσεις μήνα
              </div>
              <div className="mt-1 text-lg font-bold tabular-nums text-white">{fmt(instDue)}</div>
              <div className="text-[11px] text-slate-500">{instThisMonth.length ? `${instUnpaid.length} από ${instThisMonth.length} απλήρωτες` : 'καμία δόση'}</div>
            </button>
          </div>

          {/* Λίστες */}
          <section ref={listRef} className={`${cardCls} scroll-mt-24 overflow-hidden`}>
            <div className="flex items-center gap-1 border-b border-white/[0.06] p-2">
              {[
                ['expenses', `Έξοδα`, allExpenses.length],
                ['incomes', `Έσοδα`, incomes.length],
              ].map(([k, l, n]) => (
                <button
                  key={k}
                  onClick={() => setListTab(k)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${listTab === k ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {l} <span className="ml-1 text-xs font-normal text-slate-500">{n}</span>
                </button>
              ))}
            </div>

            {listTab === 'expenses' && allExpenses.length > 0 && (
              <div className="flex gap-1.5 px-4 pt-3">
                {[
                  ['all', 'Όλα'],
                  ['pending', `Εκκρεμή · ${pendingCount}`],
                  ['paid', 'Πληρωμένα'],
                ].map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${filter === k ? 'bg-indigo-500/20 text-indigo-200' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}

            {listTab === 'expenses' ? (
              shownExpenses.length ? (
                <ul className="mt-1 divide-y divide-white/[0.04]">
                  {shownExpenses.map((e) => (
                    <ExpenseRow
                      key={e.id}
                      e={e}
                      maybeDuplicate={isMaybeDuplicate(e)}
                      onOpen={() => (e.isInstallment ? goToInstallments() : setSelected({ kind: 'expense', id: e.id }))}
                      onUnpay={() => fin.togglePlanPayment(e.planId, e.number)}
                      onPay={async () => {
                        if (e.isInstallment) {
                          await fin.togglePlanPayment(e.planId, e.number)
                          toast.success(`Δόση ${e.number} · ${e.description}`, { action: { label: 'Αναίρεση', onClick: () => fin.togglePlanPayment(e.planId, e.number) } })
                          return
                        }
                        await fin.payFull(month, e.id)
                        toast.success(`«${e.description}» εξοφλήθηκε`, { action: { label: 'Αναίρεση', onClick: () => fin.undoLastPayment(month, e.id) } })
                      }}
                    />
                  ))}
                </ul>
              ) : (
                <EmptyList
                  text={allExpenses.length ? 'Τίποτα σε αυτό το φίλτρο' : 'Δεν υπάρχουν έξοδα αυτόν τον μήνα'}
                  action={!allExpenses.length && { label: 'Νέο έξοδο', onClick: () => setAddKind('expense') }}
                />
              )
            ) : incomes.length ? (
              <ul className="divide-y divide-white/[0.04]">
                {incomes.map((i) => (
                  <IncomeRow key={i.id} i={i} onOpen={() => setSelected({ kind: 'income', id: i.id })} />
                ))}
              </ul>
            ) : (
              <EmptyList text="Δεν υπάρχουν έσοδα αυτόν τον μήνα" action={{ label: 'Νέο έσοδο', onClick: () => setAddKind('income') }} />
            )}
          </section>
        </div>

        <div className="space-y-4 md:col-span-2 md:space-y-5">
          {isEmpty ? (
            <section className={`${cardCls} p-6 text-center`}>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10">
                <Wallet className="text-indigo-300" size={24} />
              </div>
              <h3 className="font-bold text-white">Ξεκίνα τον {monthName(month).split(' ')[0]}</h3>
              <p className="mt-1 text-sm text-slate-400">Πρόσθεσε τα έσοδά σου και μετά τα έξοδα. Ό,τι επαναλαμβάνεται, σημείωσέ το ως μηνιαίο.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => setAddKind('income')} className="rounded-xl bg-emerald-500/15 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20">
                  + Έσοδο
                </button>
                <button onClick={() => setAddKind('expense')} className="rounded-xl bg-rose-500/15 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-500/20">
                  + Έξοδο
                </button>
              </div>
            </section>
          ) : (
            <CategoryBreakdown expenses={allExpenses} />
          )}

          {activeRecurringCount > 0 && (
            <button onClick={() => setShowRecurring(true)} className={`${cardCls} flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/[0.05]`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05]">
                <Repeat size={17} className="text-slate-300" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-slate-200">{activeRecurringCount} επαναλαμβανόμενα</span>
                <span className="block text-xs text-slate-500">Διαχείριση μηνιαίων εσόδων & εξόδων</span>
              </span>
              <ChevronRight size={18} className="text-slate-500" />
            </button>
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setAddKind(listTab === 'incomes' ? 'income' : 'expense')}
        aria-label="Νέα εγγραφή"
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-xl shadow-indigo-500/30 transition hover:bg-indigo-400 active:scale-95 md:bottom-8 md:right-8"
      >
        <Plus size={26} />
      </button>

      <AddEntrySheet
        open={!!addKind}
        initialKind={addKind || 'expense'}
        month={month}
        onClose={() => setAddKind(null)}
        onSubmit={async (data) => {
          await fin.addEntry(month, data)
          setListTab(data.kind === 'income' ? 'incomes' : 'expenses')
          toast.success(data.kind === 'income' ? 'Το έσοδο προστέθηκε' : 'Το έξοδο προστέθηκε')
        }}
      />

      {selected?.kind === 'expense' && selectedEntry && <ExpenseSheet expense={selectedEntry} month={month} fin={fin} onClose={() => setSelected(null)} />}
      {selected?.kind === 'income' && selectedEntry && <IncomeSheet income={selectedEntry} month={month} fin={fin} onClose={() => setSelected(null)} />}
      <RecurringSheet open={showRecurring} onClose={() => setShowRecurring(false)} fin={fin} fromMonth={shiftMonth(month, 1) < currentMonth() ? currentMonth() : shiftMonth(month, 1)} />
    </div>
  )
}

function EmptyList({ text, action }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="text-sm text-slate-500">{text}</p>
      {action && (
        <button onClick={action.onClick} className="mt-3 text-sm font-semibold text-indigo-300 hover:text-indigo-200">
          + {action.label}
        </button>
      )}
    </div>
  )
}
