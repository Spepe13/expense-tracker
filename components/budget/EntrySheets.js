'use client'

import { useEffect, useState } from 'react'
import { Check, Pencil, Repeat, RotateCcw, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { CATEGORIES, categoryColor, fmt, fmtDate, monthNameShort, parseAmount, same, sum } from '../../lib/utils'
import { Button, Label, Sheet, Switch, inputCls, useConfirm, useToast } from '../ui'

// ---------------------------------------------------------------------------
function CategoryPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((c) => {
        const active = c === value
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition ${
              active ? 'border-white/30 bg-white/10 text-white' : 'border-white/[0.08] text-slate-400 hover:border-white/20 hover:text-slate-200'
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: categoryColor(c) }} />
            {c}
          </button>
        )
      })}
    </div>
  )
}

function AmountInput({ value, onChange, autoFocus, tone = 'indigo' }) {
  const ring = { indigo: 'focus:border-indigo-400/60', emerald: 'focus:border-emerald-400/60', rose: 'focus:border-rose-400/60' }[tone]
  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        placeholder="0,00"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        autoFocus={autoFocus}
        className={`${inputCls} ${ring} pr-10 text-2xl font-bold tabular-nums`}
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-slate-500">€</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Προσθήκη εσόδου / εξόδου
// ---------------------------------------------------------------------------
export function AddEntrySheet({ open, initialKind = 'expense', month, onClose, onSubmit }) {
  const [kind, setKind] = useState(initialKind)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Γενικά')
  const [isRecurring, setIsRecurring] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setKind(initialKind)
      setDescription('')
      setAmount('')
      setCategory('Γενικά')
      setIsRecurring(false)
    }
  }, [open, initialKind])

  const value = parseAmount(amount)
  const valid = description.trim() && value > 0

  const submit = async (e) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    await onSubmit({ kind, description: description.trim(), amount: value, category, isRecurring })
    setBusy(false)
    onClose()
  }

  const isIncome = kind === 'income'
  return (
    <Sheet open={open} onClose={onClose} title={isIncome ? 'Νέο έσοδο' : 'Νέο έξοδο'} subtitle={monthNameShort(month)}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.04] p-1">
          <button
            type="button"
            onClick={() => setKind('expense')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${!isIncome ? 'bg-rose-500/20 text-rose-200' : 'text-slate-400'}`}
          >
            <TrendingDown size={16} /> Έξοδο
          </button>
          <button
            type="button"
            onClick={() => setKind('income')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${isIncome ? 'bg-emerald-500/20 text-emerald-200' : 'text-slate-400'}`}
          >
            <TrendingUp size={16} /> Έσοδο
          </button>
        </div>

        <label className="block">
          <Label>Ποσό</Label>
          <AmountInput value={amount} onChange={setAmount} autoFocus tone={isIncome ? 'emerald' : 'rose'} />
        </label>

        <label className="block">
          <Label>Περιγραφή</Label>
          <input
            type="text"
            placeholder={isIncome ? 'π.χ. Μισθός' : 'π.χ. ΔΕΗ'}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
          />
        </label>

        {!isIncome && (
          <div>
            <Label>Κατηγορία</Label>
            <CategoryPicker value={category} onChange={setCategory} />
          </div>
        )}

        <Switch
          checked={isRecurring}
          onChange={setIsRecurring}
          tone={isIncome ? 'emerald' : 'rose'}
          label={
            <span className="flex items-center gap-2">
              <Repeat size={16} className="text-slate-400" />
              <span>
                Κάθε μήνα <span className="text-slate-500">· από {monthNameShort(month)}</span>
              </span>
            </span>
          }
        />

        <Button type="submit" tone={isIncome ? 'income' : 'expense'} size="lg" className="w-full" disabled={!valid || busy}>
          Προσθήκη {valid ? `· ${fmt(value)}` : ''}
        </Button>
      </form>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Κοινό: διαγραφή με επιλογή για επαναλαμβανόμενα
// ---------------------------------------------------------------------------
async function askDelete(confirm, entry) {
  if (entry.recurringId) {
    return confirm({
      title: 'Διαγραφή επαναλαμβανόμενου',
      message: `Το «${entry.description}» επαναλαμβάνεται κάθε μήνα. Τι θέλεις να γίνει;`,
      actions: [
        { label: 'Μόνο από αυτόν τον μήνα', value: 'month', tone: 'ghost' },
        { label: 'Από αυτόν και τους επόμενους', value: 'forward', tone: 'expense' },
        { label: 'Ακύρωση', value: false, tone: 'subtle' },
      ],
    })
  }
  const ok = await confirm({
    title: 'Διαγραφή',
    message: `Να διαγραφεί το «${entry.description}»;`,
    confirmLabel: 'Διαγραφή',
    tone: 'expense',
  })
  return ok ? 'month' : false
}

function EditFields({ form, setForm, kind }) {
  return (
    <div className="space-y-4">
      <label className="block">
        <Label>Ποσό</Label>
        <AmountInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} tone={kind === 'income' ? 'emerald' : 'rose'} />
      </label>
      <label className="block">
        <Label>Περιγραφή</Label>
        <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} />
      </label>
      {kind === 'expense' && (
        <div>
          <Label>Κατηγορία</Label>
          <CategoryPicker value={form.category} onChange={(c) => setForm({ ...form, category: c })} />
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Λεπτομέρειες εξόδου: πληρωμές, ιστορικό, επεξεργασία, διαγραφή
// ---------------------------------------------------------------------------
export function ExpenseSheet({ expense, month, fin, onClose }) {
  const confirm = useConfirm()
  const toast = useToast()
  const [mode, setMode] = useState('view')
  const [pay, setPay] = useState('')
  const [form, setForm] = useState({ description: '', amount: '', category: 'Γενικά' })

  useEffect(() => {
    if (expense) {
      setMode('view')
      setPay('')
      setForm({ description: expense.description, amount: String(expense.amount).replace('.', ','), category: expense.category || 'Γενικά' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense?.id])

  if (!expense) return null
  const paid = expense.paidAmount || 0
  const left = Math.max(0, expense.amount - paid)
  const done = expense.completed || paid >= expense.amount
  const pct = expense.amount > 0 ? Math.min(100, (paid / expense.amount) * 100) : 0
  const payValue = parseAmount(pay)

  const save = async () => {
    const amount = parseAmount(form.amount)
    if (!form.description.trim() || !(amount > 0)) return
    await fin.editEntry(month, 'expense', expense.id, { description: form.description.trim(), amount, category: form.category })
    toast.success(expense.recurringId ? 'Αποθηκεύτηκε (και στους επόμενους μήνες)' : 'Αποθηκεύτηκε')
    setMode('view')
  }

  const remove = async () => {
    const scope = await askDelete(confirm, expense)
    if (!scope) return
    await fin.removeEntry(month, 'expense', expense.id, scope)
    toast.success('Διαγράφηκε')
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={mode === 'edit' ? 'Επεξεργασία εξόδου' : expense.description}
      subtitle={
        mode === 'view' && (
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: categoryColor(expense.category) }} />
            {expense.category}
            {expense.recurringId && (
              <span className="inline-flex items-center gap-1 text-slate-500">
                · <Repeat size={12} /> μηνιαίο
              </span>
            )}
          </span>
        )
      }
    >
      {mode === 'edit' ? (
        <div className="space-y-4">
          <EditFields form={form} setForm={setForm} kind="expense" />
          {expense.recurringId && <p className="text-xs text-slate-500">Η αλλαγή θα ισχύσει και στους επόμενους μήνες που δεν έχουν πληρωμές.</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button tone="ghost" onClick={() => setMode('view')}>Ακύρωση</Button>
            <Button onClick={save}>Αποθήκευση</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl bg-white/[0.03] p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-slate-500">Σύνολο</div>
                <div className="text-3xl font-extrabold tabular-nums text-white">{fmt(expense.amount)}</div>
              </div>
              <div className="text-right text-sm">
                {done ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-300">
                    <Check size={14} /> Εξοφλήθηκε
                  </span>
                ) : (
                  <>
                    <div className="text-slate-500">Υπόλοιπο</div>
                    <div className="font-bold tabular-nums text-amber-300">{fmt(left)}</div>
                  </>
                )}
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className={`h-full rounded-full transition-all ${done ? 'bg-emerald-400' : 'bg-indigo-400'}`} style={{ width: `${pct}%` }} />
            </div>
            {paid > 0 && !done && <div className="mt-2 text-xs text-slate-400">Πληρώθηκαν {fmt(paid)}</div>}
          </div>

          {!done && (
            <div className="space-y-2">
              <Button
                tone="income"
                size="lg"
                className="w-full"
                onClick={async () => {
                  await fin.payFull(month, expense.id)
                  toast.success('Εξοφλήθηκε', { action: { label: 'Αναίρεση', onClick: () => fin.undoLastPayment(month, expense.id) } })
                  onClose()
                }}
              >
                <Check size={18} /> Εξόφληση {fmt(left)}
              </Button>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Μερική πληρωμή (€)"
                  value={pay}
                  onChange={(e) => setPay(e.target.value.replace(/[^\d.,]/g, ''))}
                  className={`${inputCls} flex-1`}
                />
                <Button
                  tone="ghost"
                  disabled={!(payValue > 0)}
                  onClick={async () => {
                    await fin.payPartial(month, expense.id, payValue)
                    setPay('')
                    toast.success(`Καταχωρήθηκε πληρωμή ${fmt(payValue)}`)
                  }}
                >
                  Καταχώρηση
                </Button>
              </div>
            </div>
          )}

          {(expense.payments || []).length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ιστορικό πληρωμών</div>
              <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/[0.06]">
                {expense.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15">
                        <Check size={14} className="text-emerald-400" />
                      </span>
                      <span className="font-semibold tabular-nums text-slate-100">{fmt(p.amount)}</span>
                      <span className="text-xs text-slate-500">{fmtDate(p.date)}</span>
                    </div>
                    <button
                      onClick={() => fin.undoPayment(month, expense.id, p.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-white"
                    >
                      <RotateCcw size={13} /> Αναίρεση
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-4">
            <Button tone="ghost" onClick={() => setMode('edit')}>
              <Pencil size={16} /> Επεξεργασία
            </Button>
            <Button tone="danger" onClick={remove}>
              <Trash2 size={16} /> Διαγραφή
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Επεξεργασία εσόδου
// ---------------------------------------------------------------------------
export function IncomeSheet({ income, month, fin, onClose }) {
  const confirm = useConfirm()
  const toast = useToast()
  const [form, setForm] = useState({ description: '', amount: '' })

  useEffect(() => {
    if (income) setForm({ description: income.description, amount: String(income.amount).replace('.', ',') })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [income?.id])

  if (!income) return null

  const save = async () => {
    const amount = parseAmount(form.amount)
    if (!form.description.trim() || !(amount > 0)) return
    await fin.editEntry(month, 'income', income.id, { description: form.description.trim(), amount })
    toast.success('Αποθηκεύτηκε')
    onClose()
  }
  const remove = async () => {
    const scope = await askDelete(confirm, income)
    if (!scope) return
    await fin.removeEntry(month, 'income', income.id, scope)
    toast.success('Διαγράφηκε')
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title="Επεξεργασία εσόδου" subtitle={income.recurringId ? 'Μηνιαίο έσοδο' : monthNameShort(month)}>
      <div className="space-y-4">
        <EditFields form={form} setForm={setForm} kind="income" />
        {income.recurringId && <p className="text-xs text-slate-500">Η αλλαγή θα ισχύσει και στους επόμενους μήνες.</p>}
        <Button tone="income" size="lg" className="w-full" onClick={save}>Αποθήκευση</Button>
        <Button tone="danger" className="w-full" onClick={remove}>
          <Trash2 size={16} /> Διαγραφή
        </Button>
      </div>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Λίστα ενεργών επαναλαμβανόμενων
// ---------------------------------------------------------------------------
export function RecurringSheet({ open, onClose, fin, fromMonth }) {
  const confirm = useConfirm()
  const toast = useToast()
  const active = fin.recurring.filter((r) => !r.endMonth || r.endMonth >= fromMonth)
  const incomes = active.filter((r) => r.type === 'income')
  const expenses = active.filter((r) => r.type === 'expense')

  const stop = async (r) => {
    const ok = await confirm({
      title: 'Διακοπή επανάληψης',
      message: `Το «${r.description}» δεν θα προστίθεται από ${monthNameShort(fromMonth)} και μετά. Οι προηγούμενοι μήνες μένουν ως έχουν.`,
      confirmLabel: 'Διακοπή',
      tone: 'expense',
    })
    if (!ok) return
    await fin.stopRecurring(r.id, fromMonth)
    toast.success('Η επανάληψη σταμάτησε')
  }

  const Group = ({ title, items, color }) =>
    items.length > 0 && (
      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>{title}</span>
          <span className={`tabular-nums ${color}`}>{fmt(sum(items, (r) => r.amount))}/μήνα</span>
        </div>
        <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/[0.06]">
          {items.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-100">{r.description}</div>
                <div className="text-xs text-slate-500">
                  από {r.startMonth ? monthNameShort(r.startMonth) : '—'}
                  {r.category ? ` · ${r.category}` : ''}
                </div>
              </div>
              <span className="font-semibold tabular-nums text-slate-200">{fmt(r.amount)}</span>
              <button onClick={() => stop(r)} className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-rose-500/10 hover:text-rose-300">
                Διακοπή
              </button>
            </li>
          ))}
        </ul>
      </div>
    )

  return (
    <Sheet open={open} onClose={onClose} title="Επαναλαμβανόμενα" subtitle="Προστίθενται αυτόματα κάθε μήνα">
      <div className="space-y-5">
        <Group title="Έσοδα" items={incomes} color="text-emerald-300" />
        <Group title="Έξοδα" items={expenses} color="text-rose-300" />
        {!active.length && <p className="py-6 text-center text-sm text-slate-500">Δεν υπάρχουν ενεργά επαναλαμβανόμενα.</p>}
      </div>
    </Sheet>
  )
}
