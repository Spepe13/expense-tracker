'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { currentMonth, daysInMonth, newId, same, shiftMonth, today, ymd } from '../lib/utils'

// ---------------------------------------------------------------------------
// DB <-> app mappers
// ---------------------------------------------------------------------------
const mapInst = (i) => ({
  id: i.id,
  name: i.name,
  amount: Number(i.amount),
  startDate: i.start_date,
  totalInstallments: i.total_installments,
  dayOfMonth: i.day_of_month,
  payments: i.payments || [],
})
const mapBudget = (b) => ({
  id: b.id,
  month: b.month,
  incomes: b.incomes || [],
  expenses: b.expenses || [],
  skipped: b.skipped_recurring || [],
})
const mapRec = (r) => ({
  id: r.id,
  type: r.type,
  description: r.description,
  amount: Number(r.amount),
  category: r.category,
  startMonth: r.start_month,
  endMonth: r.end_month,
})

export const emptyBudget = (month) => ({ id: null, month, incomes: [], expenses: [], skipped: [] })

const upsertById = (list, item) =>
  list.some((x) => same(x.id, item.id)) ? list.map((x) => (same(x.id, item.id) ? item : x)) : [...list, item]

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useFinance(user, { onError } = {}) {
  const uid = user.id
  const cacheKey = `fintrack:v7:${uid}`

  const [installments, _setInst] = useState([])
  const [budgets, _setBudgets] = useState([])
  const [recurring, _setRec] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState('loading') // loading | online | syncing | offline
  const [lastSync, setLastSync] = useState(null)

  // Refs που ενημερώνονται ΣΥΓΧΡΟΝΑ, ώστε διαδοχικές ενέργειες να μη βλέπουν stale state
  const instRef = useRef([])
  const budRef = useRef([])
  const recRef = useRef([])
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const setInst = useCallback((next) => {
    instRef.current = typeof next === 'function' ? next(instRef.current) : next
    _setInst(instRef.current)
  }, [])
  const setBudgets = useCallback((next) => {
    budRef.current = typeof next === 'function' ? next(budRef.current) : next
    _setBudgets(budRef.current)
  }, [])
  const setRec = useCallback((next) => {
    recRef.current = typeof next === 'function' ? next(recRef.current) : next
    _setRec(recRef.current)
  }, [])

  // ------------------------------------------------------------------ persistence
  const guard = useCallback(async (fn, errMsg = 'Η αποθήκευση απέτυχε. Έλεγξε τη σύνδεσή σου.') => {
    try {
      setStatus('syncing')
      const { error } = await fn()
      if (error) throw error
      setStatus('online')
      setLastSync(new Date())
      return true
    } catch (e) {
      console.error(e)
      setStatus('offline')
      onErrorRef.current?.(errMsg)
      return false
    }
  }, [])

  const saveInst = useCallback(
    (p) =>
      guard(() =>
        supabase.from('installments').upsert({
          id: p.id,
          user_id: uid,
          name: p.name,
          amount: p.amount,
          start_date: p.startDate,
          total_installments: p.totalInstallments,
          day_of_month: p.dayOfMonth,
          payments: p.payments,
          updated_at: new Date().toISOString(),
        })
      ),
    [guard, uid]
  )

  const saveBudget = useCallback(
    (b) =>
      guard(() =>
        supabase.from('monthly_budgets').upsert({
          id: b.id,
          user_id: uid,
          month: b.month,
          incomes: b.incomes,
          expenses: b.expenses,
          skipped_recurring: b.skipped || [],
          updated_at: new Date().toISOString(),
        })
      ),
    [guard, uid]
  )

  const saveRec = useCallback(
    (r) =>
      guard(() =>
        supabase.from('recurring_items').upsert({
          id: r.id,
          user_id: uid,
          type: r.type,
          description: r.description,
          amount: r.amount,
          category: r.category || null,
          start_month: r.startMonth || null,
          end_month: r.endMonth || null,
          updated_at: new Date().toISOString(),
        })
      ),
    [guard, uid]
  )

  // ------------------------------------------------------------------ load
  const load = useCallback(async () => {
    setStatus((s) => (s === 'loading' ? 'loading' : 'syncing'))
    try {
      const [a, b, c] = await Promise.all([
        supabase.from('installments').select('*').eq('user_id', uid).order('created_at', { ascending: true }),
        supabase.from('monthly_budgets').select('*').eq('user_id', uid).order('month', { ascending: false }),
        supabase.from('recurring_items').select('*').eq('user_id', uid),
      ])
      for (const r of [a, b, c]) if (r.error) throw r.error
      setInst(a.data.map(mapInst))
      setBudgets(b.data.map(mapBudget))
      setRec(c.data.map(mapRec))
      setStatus('online')
      setLastSync(new Date())
    } catch (e) {
      console.error('Load error', e)
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null')
        if (cached) {
          setInst(cached.installments || [])
          setBudgets(cached.budgets || [])
          setRec(cached.recurring || [])
        }
      } catch {}
      setStatus('offline')
      onErrorRef.current?.('Δεν ήταν δυνατή η σύνδεση. Βλέπεις τα τελευταία αποθηκευμένα δεδομένα.')
    } finally {
      setLoaded(true)
    }
  }, [uid, cacheKey, setInst, setBudgets, setRec])

  useEffect(() => {
    load()
  }, [load])

  // Τοπικό cache ανά χρήστη (για offline προβολή)
  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ installments, budgets, recurring }))
    } catch {}
  }, [installments, budgets, recurring, loaded, cacheKey])

  // ------------------------------------------------------------------ realtime
  useEffect(() => {
    const filter = `user_id=eq.${uid}`
    const onRow = (table, mapper, setter) => (p) => {
      if (p.eventType === 'DELETE') setter((l) => l.filter((x) => !same(x.id, p.old?.id)))
      else setter((l) => upsertById(l, mapper(p.new)))
      setLastSync(new Date())
    }
    const onDelete = (setter) => (p) => setter((l) => l.filter((x) => !same(x.id, p.old?.id)))

    const ch = supabase
      .channel(`fintrack-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'installments', filter }, onRow('installments', mapInst, setInst))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'installments', filter }, onRow('installments', mapInst, setInst))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'installments' }, onDelete(setInst))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'monthly_budgets', filter }, onRow('monthly_budgets', mapBudget, setBudgets))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'monthly_budgets', filter }, onRow('monthly_budgets', mapBudget, setBudgets))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'monthly_budgets' }, onDelete(setBudgets))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'recurring_items', filter }, onRow('recurring_items', mapRec, setRec))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'recurring_items', filter }, onRow('recurring_items', mapRec, setRec))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'recurring_items' }, onDelete(setRec))
      .subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [uid, setInst, setBudgets, setRec])

  // ------------------------------------------------------------------ budget helpers
  const getBudget = useCallback((month) => budRef.current.find((b) => b.month === month) || emptyBudget(month), [])

  const commitBudget = useCallback(
    (budget) => {
      const b = { skipped: [], ...budget, id: budget.id || newId() }
      setBudgets((l) => (l.some((x) => x.month === b.month) ? l.map((x) => (x.month === b.month ? b : x)) : [...l, b]))
      return saveBudget(b)
    },
    [setBudgets, saveBudget]
  )

  const updateBudget = useCallback((month, fn) => commitBudget({ ...fn(getBudget(month)), month }), [commitBudget, getBudget])

  // Προσθέτει τα επαναλαμβανόμενα στον μήνα (μόνο τρέχων & μελλοντικοί)
  const ensureRecurring = useCallback(
    (month) => {
      if (month < currentMonth()) return
      const cur = getBudget(month)
      const skipped = cur.skipped || []
      const active = recRef.current.filter(
        (r) =>
          (!r.startMonth || month >= r.startMonth) &&
          (!r.endMonth || month <= r.endMonth) &&
          !skipped.some((s) => same(s, r.id))
      )
      const incomes = [...cur.incomes]
      const expenses = [...cur.expenses]
      let changed = false
      for (const r of active) {
        if (r.type === 'income' && !incomes.some((i) => same(i.recurringId, r.id))) {
          incomes.push({ id: newId(), description: r.description, amount: r.amount, recurringId: r.id })
          changed = true
        }
        if (r.type === 'expense' && !expenses.some((e) => same(e.recurringId, r.id))) {
          expenses.push({
            id: newId(),
            description: r.description,
            amount: r.amount,
            category: r.category || 'Γενικά',
            paidAmount: 0,
            payments: [],
            completed: false,
            recurringId: r.id,
          })
          changed = true
        }
      }
      if (changed) commitBudget({ ...cur, incomes, expenses })
    },
    [getBudget, commitBudget]
  )

  // ------------------------------------------------------------------ entries
  const listKey = (kind) => (kind === 'income' ? 'incomes' : 'expenses')

  const addEntry = useCallback(
    async (month, { kind, description, amount, category, isRecurring }) => {
      const id = newId()
      if (isRecurring) {
        const r = { id, type: kind, description, amount, category: kind === 'expense' ? category : null, startMonth: month, endMonth: null }
        setRec((l) => [...l, r])
        saveRec(r)
      }
      const entry =
        kind === 'income'
          ? { id, description, amount, recurringId: isRecurring ? id : null }
          : { id, description, amount, category, paidAmount: 0, payments: [], completed: false, recurringId: isRecurring ? id : null }
      const key = listKey(kind)
      return updateBudget(month, (b) => ({ ...b, [key]: [...b[key], entry] }))
    },
    [setRec, saveRec, updateBudget]
  )

  const editEntry = useCallback(
    async (month, kind, id, patch) => {
      const key = listKey(kind)
      const entry = getBudget(month)[key].find((e) => same(e.id, id))
      if (!entry) return
      const apply = (e) => {
        const next = { ...e, ...patch }
        if (kind === 'expense') next.completed = (next.paidAmount || 0) >= next.amount && next.amount > 0
        return next
      }
      await updateBudget(month, (b) => ({ ...b, [key]: b[key].map((e) => (same(e.id, id) ? apply(e) : e)) }))

      // Επαναλαμβανόμενο: ενημέρωση προτύπου + απλήρωτων μελλοντικών μηνών
      if (entry.recurringId) {
        const r = recRef.current.find((x) => same(x.id, entry.recurringId))
        if (r) {
          const nr = { ...r, description: patch.description ?? r.description, amount: patch.amount ?? r.amount }
          if (kind === 'expense' && patch.category) nr.category = patch.category
          setRec((l) => l.map((x) => (same(x.id, r.id) ? nr : x)))
          saveRec(nr)
        }
        for (const b of budRef.current.filter((b) => b.month > month)) {
          let changed = false
          const list = b[key].map((e) => {
            if (!same(e.recurringId, entry.recurringId)) return e
            if (kind === 'expense' && (e.paidAmount || 0) > 0) return e
            changed = true
            return apply(e)
          })
          if (changed) commitBudget({ ...b, [key]: list })
        }
      }
    },
    [getBudget, updateBudget, setRec, saveRec, commitBudget]
  )

  // scope: 'month' = μόνο αυτόν τον μήνα | 'forward' = αυτόν & επόμενους
  const removeEntry = useCallback(
    async (month, kind, id, scope = 'month') => {
      const key = listKey(kind)
      const entry = getBudget(month)[key].find((e) => same(e.id, id))
      if (!entry) return

      if (scope === 'forward' && entry.recurringId) {
        const r = recRef.current.find((x) => same(x.id, entry.recurringId))
        if (r) {
          const nr = { ...r, endMonth: shiftMonth(month, -1) }
          setRec((l) => l.map((x) => (same(x.id, r.id) ? nr : x)))
          saveRec(nr)
        }
        for (const b of budRef.current.filter((b) => b.month >= month)) {
          const list = b[key].filter((e) => !same(e.recurringId, entry.recurringId))
          if (list.length !== b[key].length) commitBudget({ ...b, [key]: list })
        }
        return
      }

      await updateBudget(month, (b) => ({
        ...b,
        [key]: b[key].filter((e) => !same(e.id, id)),
        skipped: entry.recurringId ? [...(b.skipped || []), entry.recurringId] : b.skipped || [],
      }))
    },
    [getBudget, setRec, saveRec, commitBudget, updateBudget]
  )

  const stopRecurring = useCallback(
    async (recId, fromMonth) => {
      const r = recRef.current.find((x) => same(x.id, recId))
      if (!r) return
      const nr = { ...r, endMonth: shiftMonth(fromMonth, -1) }
      setRec((l) => l.map((x) => (same(x.id, r.id) ? nr : x)))
      await saveRec(nr)
      const key = listKey(r.type)
      for (const b of budRef.current.filter((b) => b.month >= fromMonth)) {
        const list = b[key].filter((e) => !(same(e.recurringId, recId) && !(e.paidAmount > 0)))
        if (list.length !== b[key].length) commitBudget({ ...b, [key]: list })
      }
    },
    [setRec, saveRec, commitBudget]
  )

  // ------------------------------------------------------------------ payments
  const mapExpense = (month, id, fn) =>
    updateBudget(month, (b) => ({ ...b, expenses: b.expenses.map((e) => (same(e.id, id) ? fn(e) : e)) }))

  const payFull = useCallback(
    (month, id) =>
      mapExpense(month, id, (e) => {
        const left = e.amount - (e.paidAmount || 0)
        if (left <= 0) return { ...e, completed: true }
        return {
          ...e,
          paidAmount: e.amount,
          payments: [...(e.payments || []), { id: newId(), amount: left, date: new Date().toISOString() }],
          completed: true,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateBudget]
  )

  const payPartial = useCallback(
    (month, id, amount) =>
      mapExpense(month, id, (e) => {
        const paid = (e.paidAmount || 0) + amount
        return {
          ...e,
          paidAmount: Math.min(paid, e.amount),
          payments: [...(e.payments || []), { id: newId(), amount, date: new Date().toISOString() }],
          completed: paid >= e.amount,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateBudget]
  )

  const undoPayment = useCallback(
    (month, id, paymentId) =>
      mapExpense(month, id, (e) => {
        const p = (e.payments || []).find((x) => same(x.id, paymentId))
        if (!p) return e
        return {
          ...e,
          payments: e.payments.filter((x) => !same(x.id, paymentId)),
          paidAmount: Math.max(0, (e.paidAmount || 0) - p.amount),
          completed: false,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateBudget]
  )

  const undoLastPayment = useCallback(
    (month, id) => {
      const e = getBudget(month).expenses.find((x) => same(x.id, id))
      const last = e?.payments?.[e.payments.length - 1]
      if (last) return undoPayment(month, id, last.id)
    },
    [getBudget, undoPayment]
  )

  // Αντιγραφή μη-επαναλαμβανόμενων εγγραφών στον επόμενο μήνα
  const copyToNext = useCallback(
    async (month) => {
      const next = shiftMonth(month, 1)
      const cur = getBudget(month)
      await updateBudget(next, (b) => ({
        ...b,
        incomes: [...b.incomes, ...cur.incomes.filter((i) => !i.recurringId).map((i) => ({ ...i, id: newId() }))],
        expenses: [
          ...b.expenses,
          ...cur.expenses
            .filter((e) => !e.recurringId)
            .map((e) => ({ ...e, id: newId(), paidAmount: 0, payments: [], completed: false })),
        ],
      }))
      return next
    },
    [getBudget, updateBudget]
  )

  // ------------------------------------------------------------------ installments
  const addPlan = useCallback(
    async ({ name, amount, startDate, totalInstallments, dayOfMonth }) => {
      const [y, m] = startDate.split('-').map(Number)
      const payments = Array.from({ length: totalInstallments }, (_, i) => {
        const mi = m - 1 + i
        const yy = y + Math.floor(mi / 12)
        const mm = ((mi % 12) + 12) % 12
        const day = Math.min(dayOfMonth, daysInMonth(yy, mm))
        return { number: i + 1, amount, dueDate: ymd(new Date(yy, mm, day)), paid: false, paidDate: null }
      })
      const plan = { id: newId(), name, amount, startDate, totalInstallments, dayOfMonth, payments }
      setInst((l) => [...l, plan])
      return saveInst(plan)
    },
    [setInst, saveInst]
  )

  const togglePlanPayment = useCallback(
    (planId, number) => {
      const plan = instRef.current.find((p) => same(p.id, planId))
      if (!plan) return
      const next = {
        ...plan,
        payments: plan.payments.map((x) =>
          x.number === number ? { ...x, paid: !x.paid, paidDate: !x.paid ? today() : null } : x
        ),
      }
      setInst((l) => l.map((p) => (same(p.id, planId) ? next : p)))
      return saveInst(next)
    },
    [setInst, saveInst]
  )

  const removePlan = useCallback(
    (planId) => {
      setInst((l) => l.filter((p) => !same(p.id, planId)))
      return guard(() => supabase.from('installments').delete().eq('id', planId).eq('user_id', uid))
    },
    [setInst, guard, uid]
  )

  // ------------------------------------------------------------------ import / export
  const exportData = useCallback(() => {
    const data = {
      version: '7.0',
      exportDate: new Date().toISOString(),
      installments: instRef.current,
      monthlyBudgets: budRef.current,
      recurringItems: {
        incomes: recRef.current.filter((r) => r.type === 'income'),
        expenses: recRef.current.filter((r) => r.type === 'expense'),
      },
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fintrack-backup-${today()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // Δέχεται backup από v6 και v7
  const importData = useCallback(
    async (d) => {
      const insts = (d.installments || []).map((p) => ({ ...p, amount: Number(p.amount), payments: p.payments || [] }))
      const recs = [
        ...((d.recurringItems?.incomes || []).map((r) => ({ ...r, type: 'income' }))),
        ...((d.recurringItems?.expenses || []).map((r) => ({ ...r, type: 'expense' }))),
      ]
      // Αν υπάρχει ήδη ο ίδιος μήνας, κρατάμε το υπάρχον id (unique user_id+month)
      const buds = (d.monthlyBudgets || []).map((b) => {
        const existing = budRef.current.find((x) => x.month === b.month)
        return { id: existing?.id || b.id || newId(), month: b.month, incomes: b.incomes || [], expenses: b.expenses || [], skipped: b.skipped || [] }
      })

      const now = new Date().toISOString()
      const ok = await guard(async () => {
        if (insts.length) {
          const r = await supabase.from('installments').upsert(
            insts.map((p) => ({ id: p.id, user_id: uid, name: p.name, amount: p.amount, start_date: p.startDate, total_installments: p.totalInstallments, day_of_month: p.dayOfMonth, payments: p.payments, updated_at: now }))
          )
          if (r.error) return r
        }
        if (recs.length) {
          const r = await supabase.from('recurring_items').upsert(
            recs.map((x) => ({ id: x.id, user_id: uid, type: x.type, description: x.description, amount: x.amount, category: x.category || null, start_month: x.startMonth || null, end_month: x.endMonth || null, updated_at: now }))
          )
          if (r.error) return r
        }
        if (buds.length) {
          const r = await supabase.from('monthly_budgets').upsert(
            buds.map((b) => ({ id: b.id, user_id: uid, month: b.month, incomes: b.incomes, expenses: b.expenses, skipped_recurring: b.skipped, updated_at: now }))
          )
          if (r.error) return r
        }
        return { error: null }
      }, 'Η εισαγωγή απέτυχε.')

      if (ok) await load()
      return { ok, counts: { installments: insts.length, budgets: buds.length, recurring: recs.length } }
    },
    [guard, uid, load]
  )

  return {
    // state
    installments,
    budgets,
    recurring,
    loaded,
    status,
    lastSync,
    // actions
    reload: load,
    ensureRecurring,
    budgetFor: (month) => budgets.find((b) => b.month === month) || emptyBudget(month),
    addEntry,
    editEntry,
    removeEntry,
    stopRecurring,
    payFull,
    payPartial,
    undoPayment,
    undoLastPayment,
    copyToNext,
    addPlan,
    togglePlanPayment,
    removePlan,
    exportData,
    importData,
  }
}
