'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Check, Calendar, Euro, CreditCard, Wallet, ChevronDown, ChevronUp, Download, Upload, Cloud, CloudOff, RefreshCw, Loader2, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, CircleDollarSign, RotateCcw, Repeat, X, History, Copy } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ExpenseTracker() {
  const [installments, setInstallments] = useState([])
  const [monthlyBudgets, setMonthlyBudgets] = useState([])
  const [recurringItems, setRecurringItems] = useState({ incomes: [], expenses: [] })
  const [activeTab, setActiveTab] = useState('budget')
  const [showAddInstallment, setShowAddInstallment] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [expandedPlan, setExpandedPlan] = useState(null)
  const [expandedExpense, setExpandedExpense] = useState(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isOnline, setIsOnline] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [payingExpense, setPayingExpense] = useState(null)
  const [paymentAmount, setPaymentAmount] = useState('')

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const [newPlan, setNewPlan] = useState({ name: '', amount: '', startDate: '', totalInstallments: '', dayOfMonth: '2' })
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'Γενικά', isRecurring: false })
  const [newIncome, setNewIncome] = useState({ description: '', amount: '', isRecurring: false })

  const categories = ['Γενικά', 'Λογαριασμοί', 'Σούπερ Μάρκετ', 'Μεταφορές', 'Ψυχαγωγία', 'Υγεία', 'Εκπαίδευση', 'Ενοίκιο', 'Συνδρομές', 'Άλλο']
  const isSupabaseConfigured = supabase !== null
  const monthNames = ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος']
  const monthNamesShort = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιούν', 'Ιούλ', 'Αύγ', 'Σεπ', 'Οκτ', 'Νοέ', 'Δεκ']

  const getMonthName = (monthStr) => {
    const [year, month] = monthStr.split('-')
    return `${monthNames[parseInt(month) - 1]} ${year}`
  }

  const getMonthNameShort = (monthStr) => {
    const [year, month] = monthStr.split('-')
    return `${monthNamesShort[parseInt(month) - 1]} ${year}`
  }

  const changeMonth = (direction) => {
    const [year, month] = selectedMonth.split('-').map(Number)
    let newMonth = month + direction
    let newYear = year
    if (newMonth > 12) { newMonth = 1; newYear++ }
    if (newMonth < 1) { newMonth = 12; newYear-- }
    setSelectedMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`)
  }

  const getCurrentBudget = () => {
    return monthlyBudgets.find(b => b.month === selectedMonth) || { month: selectedMonth, incomes: [], expenses: [] }
  }

  const applyRecurringItems = useCallback((budget) => {
    let updated = false
    let newBudget = { ...budget, incomes: [...(budget.incomes || [])], expenses: [...(budget.expenses || [])] }

    recurringItems.incomes.forEach(ri => {
      const exists = newBudget.incomes.some(i => i.recurringId === ri.id)
      if (!exists) {
        newBudget.incomes.push({ id: Date.now() + Math.random(), description: ri.description, amount: ri.amount, recurringId: ri.id })
        updated = true
      }
    })

    recurringItems.expenses.forEach(re => {
      const exists = newBudget.expenses.some(e => e.recurringId === re.id)
      if (!exists) {
        newBudget.expenses.push({
          id: Date.now() + Math.random(),
          description: re.description,
          amount: re.amount,
          category: re.category,
          paidAmount: 0,
          payments: [],
          completed: false,
          recurringId: re.id
        })
        updated = true
      }
    })

    return { budget: newBudget, updated }
  }, [recurringItems])

  const loadFromCloud = useCallback(async () => {
    if (!isSupabaseConfigured) return false
    try {
      setIsSyncing(true)
      const { data: instData, error: instErr } = await supabase.from('installments').select('*').order('created_at', { ascending: true })
      if (instErr) throw instErr
      const { data: budgetData, error: budgetErr } = await supabase.from('monthly_budgets').select('*').order('month', { ascending: false })
      if (budgetErr && budgetErr.code !== 'PGRST116') throw budgetErr
      const { data: recurringData, error: recurringErr } = await supabase.from('recurring_items').select('*')
      if (recurringErr && recurringErr.code !== 'PGRST116') throw recurringErr

      if (instData) setInstallments(instData.map(i => ({ id: i.id, name: i.name, amount: i.amount, startDate: i.start_date, totalInstallments: i.total_installments, dayOfMonth: i.day_of_month, payments: i.payments || [] })))
      if (budgetData) setMonthlyBudgets(budgetData.map(b => ({ id: b.id, month: b.month, incomes: b.incomes || [], expenses: b.expenses || [] })))
      if (recurringData) {
        const incomes = recurringData.filter(r => r.type === 'income').map(r => ({ id: r.id, description: r.description, amount: r.amount }))
        const expenses = recurringData.filter(r => r.type === 'expense').map(r => ({ id: r.id, description: r.description, amount: r.amount, category: r.category }))
        setRecurringItems({ incomes, expenses })
      }

      setLastSync(new Date())
      setIsOnline(true)
      return true
    } catch (e) { console.error('Cloud load error:', e); setIsOnline(false); return false }
    finally { setIsSyncing(false) }
  }, [isSupabaseConfigured])

  const saveInstallment = async (inst) => {
    if (!isSupabaseConfigured) return
    try {
      await supabase.from('installments').upsert({ id: inst.id, name: inst.name, amount: inst.amount, start_date: inst.startDate, total_installments: inst.totalInstallments, day_of_month: inst.dayOfMonth, payments: inst.payments, updated_at: new Date().toISOString() })
      setLastSync(new Date()); setIsOnline(true)
    } catch (e) { console.error('Save error:', e); setIsOnline(false) }
  }

  const deleteInstallment = async (id) => { if (isSupabaseConfigured) await supabase.from('installments').delete().eq('id', id) }

  const saveBudget = async (budget) => {
    if (!isSupabaseConfigured) return
    try {
      await supabase.from('monthly_budgets').upsert({ id: budget.id, month: budget.month, incomes: budget.incomes, expenses: budget.expenses, updated_at: new Date().toISOString() })
      setLastSync(new Date()); setIsOnline(true)
    } catch (e) { console.error('Save error:', e); setIsOnline(false) }
  }

  const saveRecurringItem = async (item, type) => {
    if (!isSupabaseConfigured) return
    try {
      await supabase.from('recurring_items').upsert({ id: item.id, type, description: item.description, amount: item.amount, category: item.category || null, updated_at: new Date().toISOString() })
      setLastSync(new Date()); setIsOnline(true)
    } catch (e) { console.error('Save error:', e); setIsOnline(false) }
  }

  const deleteRecurringItem = async (id) => {
    if (isSupabaseConfigured) await supabase.from('recurring_items').delete().eq('id', id)
  }

  useEffect(() => {
    const init = async () => {
      const loaded = await loadFromCloud()
      if (!loaded) {
        const saved = localStorage.getItem('installments')
        const savedBudgets = localStorage.getItem('monthlyBudgets')
        const savedRecurring = localStorage.getItem('recurringItems')
        if (saved) setInstallments(JSON.parse(saved))
        if (savedBudgets) setMonthlyBudgets(JSON.parse(savedBudgets))
        if (savedRecurring) setRecurringItems(JSON.parse(savedRecurring))
      }
      setIsLoaded(true)
    }
    init()
  }, [loadFromCloud])

  useEffect(() => {
    if (!isLoaded) return
    const budget = getCurrentBudget()
    const { budget: newBudget, updated } = applyRecurringItems(budget)
    if (updated) {
      const finalBudget = { ...newBudget, id: budget.id || Date.now() }
      setMonthlyBudgets(prev => {
        const exists = prev.find(b => b.month === selectedMonth)
        if (exists) return prev.map(b => b.month === selectedMonth ? finalBudget : b)
        return [...prev, finalBudget]
      })
      saveBudget(finalBudget)
    }
  }, [selectedMonth, isLoaded, recurringItems])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const sub1 = supabase.channel('inst').on('postgres_changes', { event: '*', schema: 'public', table: 'installments' }, (p) => {
      if (p.eventType === 'DELETE') setInstallments(prev => prev.filter(i => i.id !== p.old.id))
      else { const n = { id: p.new.id, name: p.new.name, amount: p.new.amount, startDate: p.new.start_date, totalInstallments: p.new.total_installments, dayOfMonth: p.new.day_of_month, payments: p.new.payments || [] }
        setInstallments(prev => prev.find(i => i.id === p.new.id) ? prev.map(i => i.id === p.new.id ? n : i) : [...prev, n]) }
      setLastSync(new Date())
    }).subscribe()
    const sub2 = supabase.channel('budgets').on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_budgets' }, (p) => {
      if (p.eventType === 'DELETE') setMonthlyBudgets(prev => prev.filter(b => b.id !== p.old.id))
      else { const n = { id: p.new.id, month: p.new.month, incomes: p.new.incomes || [], expenses: p.new.expenses || [] }
        setMonthlyBudgets(prev => prev.find(b => b.id === p.new.id) ? prev.map(b => b.id === p.new.id ? n : b) : [...prev, n]) }
      setLastSync(new Date())
    }).subscribe()
    return () => { sub1.unsubscribe(); sub2.unsubscribe() }
  }, [isSupabaseConfigured])

  useEffect(() => { if (isLoaded) localStorage.setItem('installments', JSON.stringify(installments)) }, [installments, isLoaded])
  useEffect(() => { if (isLoaded) localStorage.setItem('monthlyBudgets', JSON.stringify(monthlyBudgets)) }, [monthlyBudgets, isLoaded])
  useEffect(() => { if (isLoaded) localStorage.setItem('recurringItems', JSON.stringify(recurringItems)) }, [recurringItems, isLoaded])

  const formatCurrency = (a) => new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(a)
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('el-GR') : '-'

  const addPlan = async () => {
    if (!newPlan.name || !newPlan.amount || !newPlan.startDate || !newPlan.totalInstallments) return
    const start = new Date(newPlan.startDate)
    const payments = Array.from({ length: parseInt(newPlan.totalInstallments) }, (_, i) => ({ number: i + 1, amount: parseFloat(newPlan.amount), dueDate: new Date(start.getFullYear(), start.getMonth() + i, parseInt(newPlan.dayOfMonth)).toISOString().split('T')[0], paid: false, paidDate: null }))
    const inst = { id: Date.now(), name: newPlan.name, amount: parseFloat(newPlan.amount), startDate: newPlan.startDate, totalInstallments: parseInt(newPlan.totalInstallments), dayOfMonth: parseInt(newPlan.dayOfMonth), payments }
    setInstallments([...installments, inst])
    await saveInstallment(inst)
    setNewPlan({ name: '', amount: '', startDate: '', totalInstallments: '', dayOfMonth: '2' })
    setShowAddInstallment(false)
  }

  const togglePayment = async (planId, num) => {
    const updated = installments.map(p => {
      if (p.id === planId) { const up = { ...p, payments: p.payments.map(pay => pay.number === num ? { ...pay, paid: !pay.paid, paidDate: !pay.paid ? new Date().toISOString().split('T')[0] : null } : pay) }; saveInstallment(up); return up }
      return p
    })
    setInstallments(updated)
  }

  const removePlan = async (id) => { if (confirm('Διαγραφή προγράμματος;')) { setInstallments(installments.filter(p => p.id !== id)); await deleteInstallment(id); if (expandedPlan === id) setExpandedPlan(null) } }

  const addIncome = async () => {
    if (!newIncome.description || !newIncome.amount) return
    const budget = getCurrentBudget()
    const incomeId = Date.now()

    if (newIncome.isRecurring) {
      const recurringItem = { id: incomeId, description: newIncome.description, amount: parseFloat(newIncome.amount) }
      setRecurringItems(prev => ({ ...prev, incomes: [...prev.incomes, recurringItem] }))
      await saveRecurringItem(recurringItem, 'income')
    }

    const income = { id: incomeId, description: newIncome.description, amount: parseFloat(newIncome.amount), recurringId: newIncome.isRecurring ? incomeId : null }
    const updatedBudget = { id: budget.id || Date.now(), month: selectedMonth, incomes: [...(budget.incomes || []), income], expenses: budget.expenses || [] }
    setMonthlyBudgets(prev => {
      const exists = prev.find(b => b.month === selectedMonth)
      if (exists) return prev.map(b => b.month === selectedMonth ? updatedBudget : b)
      return [...prev, updatedBudget]
    })
    await saveBudget(updatedBudget)
    setNewIncome({ description: '', amount: '', isRecurring: false })
    setShowAddIncome(false)
  }

  const addExpense = async () => {
    if (!newExpense.description || !newExpense.amount) return
    const budget = getCurrentBudget()
    const expenseId = Date.now()

    if (newExpense.isRecurring) {
      const recurringItem = { id: expenseId, description: newExpense.description, amount: parseFloat(newExpense.amount), category: newExpense.category }
      setRecurringItems(prev => ({ ...prev, expenses: [...prev.expenses, recurringItem] }))
      await saveRecurringItem(recurringItem, 'expense')
    }

    const expense = {
      id: expenseId,
      description: newExpense.description,
      amount: parseFloat(newExpense.amount),
      paidAmount: 0,
      payments: [],
      completed: false,
      category: newExpense.category,
      recurringId: newExpense.isRecurring ? expenseId : null
    }
    const updatedBudget = { id: budget.id || Date.now(), month: selectedMonth, incomes: budget.incomes || [], expenses: [...(budget.expenses || []), expense] }
    setMonthlyBudgets(prev => {
      const exists = prev.find(b => b.month === selectedMonth)
      if (exists) return prev.map(b => b.month === selectedMonth ? updatedBudget : b)
      return [...prev, updatedBudget]
    })
    await saveBudget(updatedBudget)
    setNewExpense({ description: '', amount: '', category: 'Γενικά', isRecurring: false })
    setShowAddExpense(false)
  }

  const removeIncome = async (incomeId) => {
    const budget = getCurrentBudget()
    const income = budget.incomes.find(i => i.id === incomeId)
    if (income?.recurringId) {
      if (confirm('Διαγραφή και από τα επαναλαμβανόμενα;')) {
        setRecurringItems(prev => ({ ...prev, incomes: prev.incomes.filter(i => i.id !== income.recurringId) }))
        await deleteRecurringItem(income.recurringId)
      }
    }
    const updatedBudget = { ...budget, incomes: budget.incomes.filter(i => i.id !== incomeId) }
    setMonthlyBudgets(prev => prev.map(b => b.month === selectedMonth ? updatedBudget : b))
    await saveBudget(updatedBudget)
  }

  const removeExpense = async (expenseId) => {
    const budget = getCurrentBudget()
    const expense = budget.expenses.find(e => e.id === expenseId)
    if (expense?.recurringId) {
      if (confirm('Διαγραφή και από τα επαναλαμβανόμενα;')) {
        setRecurringItems(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== expense.recurringId) }))
        await deleteRecurringItem(expense.recurringId)
      }
    }
    const updatedBudget = { ...budget, expenses: budget.expenses.filter(e => e.id !== expenseId) }
    setMonthlyBudgets(prev => prev.map(b => b.month === selectedMonth ? updatedBudget : b))
    await saveBudget(updatedBudget)
  }

  const completeExpense = async (expenseId) => {
    const budget = getCurrentBudget()
    const updatedBudget = {
      ...budget,
      expenses: budget.expenses.map(e => {
        if (e.id === expenseId) {
          const newPayment = { id: Date.now(), amount: e.amount - (e.paidAmount || 0), date: new Date().toISOString() }
          return { ...e, paidAmount: e.amount, payments: [...(e.payments || []), newPayment], completed: true }
        }
        return e
      })
    }
    setMonthlyBudgets(prev => prev.map(b => b.month === selectedMonth ? updatedBudget : b))
    await saveBudget(updatedBudget)
  }

  const addPartialPayment = async (expenseId) => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) return
    const budget = getCurrentBudget()
    const updatedBudget = {
      ...budget,
      expenses: budget.expenses.map(e => {
        if (e.id === expenseId) {
          const newPayment = { id: Date.now(), amount: parseFloat(paymentAmount), date: new Date().toISOString() }
          const newPaidAmount = (e.paidAmount || 0) + parseFloat(paymentAmount)
          const isCompleted = newPaidAmount >= e.amount
          return { ...e, paidAmount: Math.min(newPaidAmount, e.amount), payments: [...(e.payments || []), newPayment], completed: isCompleted }
        }
        return e
      })
    }
    setMonthlyBudgets(prev => prev.map(b => b.month === selectedMonth ? updatedBudget : b))
    await saveBudget(updatedBudget)
    setPayingExpense(null)
    setPaymentAmount('')
  }

  const removePayment = async (expenseId, paymentId) => {
    const budget = getCurrentBudget()
    const updatedBudget = {
      ...budget,
      expenses: budget.expenses.map(e => {
        if (e.id === expenseId) {
          const paymentToRemove = (e.payments || []).find(p => p.id === paymentId)
          if (!paymentToRemove) return e
          const newPayments = (e.payments || []).filter(p => p.id !== paymentId)
          const newPaidAmount = Math.max(0, (e.paidAmount || 0) - paymentToRemove.amount)
          return { ...e, paidAmount: newPaidAmount, payments: newPayments, completed: false }
        }
        return e
      })
    }
    setMonthlyBudgets(prev => prev.map(b => b.month === selectedMonth ? updatedBudget : b))
    await saveBudget(updatedBudget)
  }

  const copyToNextMonth = async () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    let nextMonth = month + 1
    let nextYear = year
    if (nextMonth > 12) { nextMonth = 1; nextYear++ }
    const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}`

    const currentBudget = getCurrentBudget()
    const existingNext = monthlyBudgets.find(b => b.month === nextMonthStr)

    if (existingNext && existingNext.expenses?.length > 0) {
      if (!confirm(`Ο ${getMonthNameShort(nextMonthStr)} έχει ήδη εγγραφές. Θέλεις να προστεθούν;`)) return
    }

    const newBudget = {
      id: existingNext?.id || Date.now(),
      month: nextMonthStr,
      incomes: [...(existingNext?.incomes || []), ...(currentBudget.incomes || []).map(i => ({ ...i, id: Date.now() + Math.random() }))],
      expenses: [...(existingNext?.expenses || []), ...(currentBudget.expenses || []).map(e => ({ ...e, id: Date.now() + Math.random(), paidAmount: 0, payments: [], completed: false }))]
    }

    setMonthlyBudgets(prev => {
      const exists = prev.find(b => b.month === nextMonthStr)
      if (exists) return prev.map(b => b.month === nextMonthStr ? newBudget : b)
      return [...prev, newBudget]
    })
    await saveBudget(newBudget)
    setSelectedMonth(nextMonthStr)
  }

  const getStats = (p) => ({ paid: p.payments.filter(x => x.paid).length, remaining: p.payments.filter(x => !x.paid).reduce((s, x) => s + x.amount, 0) })

  const budget = getCurrentBudget()
  const totalIncome = (budget.incomes || []).reduce((s, i) => s + i.amount, 0)
  const totalExpenses = (budget.expenses || []).reduce((s, e) => s + e.amount, 0)
  const totalPaidExpenses = (budget.expenses || []).reduce((s, e) => s + (e.paidAmount || 0), 0)
  const remaining = totalIncome - totalPaidExpenses
  const pendingExpenses = totalExpenses - totalPaidExpenses

  const overallInstDue = installments.reduce((s, p) => s + p.payments.filter(x => !x.paid).reduce((a, x) => a + x.amount, 0), 0)

  const exportData = () => { const d = { installments, monthlyBudgets, recurringItems, exportDate: new Date().toISOString(), version: '2.0' }; const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `fintrack-backup-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(u) }

  const importData = async (ev) => {
    const f = ev.target.files[0];
    if (f) {
      const r = new FileReader();
      r.onload = async (e) => {
        try {
          const d = JSON.parse(e.target.result);
          if (d.installments) { setInstallments(d.installments); for (const i of d.installments) await saveInstallment(i) }
          if (d.monthlyBudgets) { setMonthlyBudgets(d.monthlyBudgets); for (const b of d.monthlyBudgets) await saveBudget(b) }
          if (d.recurringItems) { setRecurringItems(d.recurringItems) }
          alert('Εισαγωγή επιτυχής!')
        } catch { alert('Σφάλμα αρχείου') }
      };
      r.readAsText(f)
    }
  }

  if (!isLoaded) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-400">Φόρτωση...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-slate-800/50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <Wallet className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">FinTrack</h1>
                <div className="flex items-center gap-2">
                  {isSupabaseConfigured ? (
                    <>{isSyncing ? <span className="text-indigo-400 text-xs flex items-center gap-1"><Loader2 size={10} className="animate-spin" />Συγχρονισμός</span>
                      : isOnline ? <span className="text-emerald-400 text-xs flex items-center gap-1"><Cloud size={10} />Συνδεδεμένο</span>
                      : <span className="text-amber-400 text-xs flex items-center gap-1"><CloudOff size={10} />Offline</span>}</>
                  ) : <span className="text-slate-500 text-xs">Τοπική αποθήκευση</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadFromCloud} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"><RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} /></button>
              <label className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all cursor-pointer"><Upload size={18} /><input type="file" accept=".json" onChange={importData} className="hidden" /></label>
              <button onClick={exportData} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"><Download size={18} /></button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-24">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab('budget')} className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium transition-all ${activeTab === 'budget' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'}`}><Wallet size={18} />Προϋπολογισμός</button>
          <button onClick={() => setActiveTab('installments')} className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium transition-all ${activeTab === 'installments' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-white'}`}><CreditCard size={18} />Δόσεις</button>
        </div>

        {activeTab === 'budget' && (
          <div className="space-y-6">
            {/* Month Selector */}
            <div className="flex items-center justify-between bg-slate-800/30 backdrop-blur rounded-2xl p-4 border border-slate-700/50">
              <button onClick={() => changeMonth(-1)} className="p-2.5 bg-slate-700/50 hover:bg-slate-700 rounded-xl text-white transition-all"><ChevronLeft size={20} /></button>
              <div className="text-center">
                <h2 className="text-xl font-bold text-white">{getMonthName(selectedMonth)}</h2>
                <button onClick={copyToNextMonth} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mx-auto mt-1">
                  <Copy size={12} />Αντιγραφή στον επόμενο μήνα
                </button>
              </div>
              <button onClick={() => changeMonth(1)} className="p-2.5 bg-slate-700/50 hover:bg-slate-700 rounded-xl text-white transition-all"><ChevronRight size={20} /></button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 rounded-2xl p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-emerald-400 text-sm mb-2"><TrendingUp size={14} />Έσοδα</div>
                <div className="text-xl md:text-2xl font-bold text-white">{formatCurrency(totalIncome)}</div>
              </div>
              <div className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border border-rose-500/20 rounded-2xl p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-rose-400 text-sm mb-2"><TrendingDown size={14} />Έξοδα</div>
                <div className="text-xl md:text-2xl font-bold text-white">{formatCurrency(totalExpenses)}</div>
              </div>
              <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-2xl p-4 backdrop-blur">
                <div className="flex items-center gap-2 text-amber-400 text-sm mb-2"><CircleDollarSign size={14} />Εκκρεμή</div>
                <div className="text-xl md:text-2xl font-bold text-white">{formatCurrency(pendingExpenses)}</div>
              </div>
              <div className={`bg-gradient-to-br ${remaining >= 0 ? 'from-indigo-500/10 to-indigo-600/5 border-indigo-500/20' : 'from-rose-500/10 to-rose-600/5 border-rose-500/20'} border rounded-2xl p-4 backdrop-blur`}>
                <div className={`flex items-center gap-2 ${remaining >= 0 ? 'text-indigo-400' : 'text-rose-400'} text-sm mb-2`}><Wallet size={14} />Διαθέσιμα</div>
                <div className="text-xl md:text-2xl font-bold text-white">{formatCurrency(remaining)}</div>
              </div>
            </div>

            {/* Progress Bar */}
            {totalExpenses > 0 && (
              <div className="bg-slate-800/30 backdrop-blur rounded-2xl p-4 border border-slate-700/50">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Πρόοδος πληρωμών</span>
                  <span className="text-white font-medium">{Math.round((totalPaidExpenses / totalExpenses) * 100)}%</span>
                </div>
                <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${(totalPaidExpenses / totalExpenses) * 100}%` }} />
                </div>
              </div>
            )}

            {/* Add Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setShowAddIncome(!showAddIncome); setShowAddExpense(false) }} className="py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-2xl flex items-center justify-center gap-2 transition-all font-medium"><Plus size={20} />Νέο Έσοδο</button>
              <button onClick={() => { setShowAddExpense(!showAddExpense); setShowAddIncome(false) }} className="py-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-2xl flex items-center justify-center gap-2 transition-all font-medium"><Plus size={20} />Νέο Έξοδο</button>
            </div>

            {/* Add Income Form */}
            {showAddIncome && (
              <div className="bg-slate-800/50 backdrop-blur border border-emerald-500/30 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-emerald-400">Νέο Έσοδο</h3>
                  <button onClick={() => setShowAddIncome(false)} className="p-1 text-slate-400 hover:text-white"><X size={20} /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input type="text" placeholder="Περιγραφή (π.χ. Μισθός)" value={newIncome.description} onChange={e => setNewIncome({ ...newIncome, description: e.target.value })} className="bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none transition-all" />
                  <input type="number" step="0.01" placeholder="Ποσό (€)" value={newIncome.amount} onChange={e => setNewIncome({ ...newIncome, amount: e.target.value })} className="bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none transition-all" />
                </div>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${newIncome.isRecurring ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 group-hover:border-slate-500'}`}>
                    {newIncome.isRecurring && <Check size={14} className="text-white" />}
                  </div>
                  <input type="checkbox" checked={newIncome.isRecurring} onChange={e => setNewIncome({ ...newIncome, isRecurring: e.target.checked })} className="hidden" />
                  <span className="text-slate-300 flex items-center gap-2"><Repeat size={16} className="text-emerald-400" />Επαναλαμβανόμενο κάθε μήνα</span>
                </label>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddIncome(false)} className="px-5 py-2.5 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-all">Ακύρωση</button>
                  <button onClick={addIncome} className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all font-medium">Προσθήκη</button>
                </div>
              </div>
            )}

            {/* Add Expense Form */}
            {showAddExpense && (
              <div className="bg-slate-800/50 backdrop-blur border border-rose-500/30 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-rose-400">Νέο Έξοδο</h3>
                  <button onClick={() => setShowAddExpense(false)} className="p-1 text-slate-400 hover:text-white"><X size={20} /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input type="text" placeholder="Περιγραφή" value={newExpense.description} onChange={e => setNewExpense({ ...newExpense, description: e.target.value })} className="bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-rose-500/50 focus:outline-none transition-all" />
                  <input type="number" step="0.01" placeholder="Ποσό (€)" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })} className="bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-rose-500/50 focus:outline-none transition-all" />
                  <select value={newExpense.category} onChange={e => setNewExpense({ ...newExpense, category: e.target.value })} className="bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-rose-500/50 focus:outline-none transition-all md:col-span-2">{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
                </div>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${newExpense.isRecurring ? 'bg-rose-500 border-rose-500' : 'border-slate-600 group-hover:border-slate-500'}`}>
                    {newExpense.isRecurring && <Check size={14} className="text-white" />}
                  </div>
                  <input type="checkbox" checked={newExpense.isRecurring} onChange={e => setNewExpense({ ...newExpense, isRecurring: e.target.checked })} className="hidden" />
                  <span className="text-slate-300 flex items-center gap-2"><Repeat size={16} className="text-rose-400" />Επαναλαμβανόμενο κάθε μήνα</span>
                </label>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddExpense(false)} className="px-5 py-2.5 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-all">Ακύρωση</button>
                  <button onClick={addExpense} className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-xl hover:shadow-lg hover:shadow-rose-500/25 transition-all font-medium">Προσθήκη</button>
                </div>
              </div>
            )}

            {/* Incomes List */}
            {(budget.incomes || []).length > 0 && (
              <div className="bg-slate-800/30 backdrop-blur border border-slate-700/50 rounded-2xl overflow-hidden">
                <div className="p-4 bg-emerald-500/5 border-b border-slate-700/50">
                  <h3 className="font-semibold text-emerald-400 flex items-center gap-2"><TrendingUp size={18} />Έσοδα</h3>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {(budget.incomes || []).map(income => (
                    <div key={income.id} className="flex items-center justify-between p-4 hover:bg-slate-800/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                          {income.recurringId ? <Repeat className="text-emerald-400" size={18} /> : <Euro className="text-emerald-400" size={18} />}
                        </div>
                        <div>
                          <span className="text-white font-medium">{income.description}</span>
                          {income.recurringId && <span className="ml-2 text-xs text-emerald-400/60 bg-emerald-500/10 px-2 py-0.5 rounded-full">Μηνιαίο</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-400 font-semibold text-lg">{formatCurrency(income.amount)}</span>
                        <button onClick={() => removeIncome(income.id)} className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expenses List */}
            {(budget.expenses || []).length > 0 && (
              <div className="bg-slate-800/30 backdrop-blur border border-slate-700/50 rounded-2xl overflow-hidden">
                <div className="p-4 bg-rose-500/5 border-b border-slate-700/50">
                  <h3 className="font-semibold text-rose-400 flex items-center gap-2"><TrendingDown size={18} />Έξοδα</h3>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {(budget.expenses || []).map(expense => {
                    const paidAmount = expense.paidAmount || 0
                    const remainingAmount = expense.amount - paidAmount
                    const progress = (paidAmount / expense.amount) * 100
                    const isCompleted = expense.completed || paidAmount >= expense.amount
                    const isExpanded = expandedExpense === expense.id

                    return (
                      <div key={expense.id} className={`transition-all ${isCompleted ? 'bg-emerald-500/5' : ''}`}>
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => !isCompleted && completeExpense(expense.id)}
                                disabled={isCompleted}
                                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-indigo-500/20 hover:text-indigo-400'}`}
                              >
                                {isCompleted ? <Check size={18} /> : <Euro size={18} />}
                              </button>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${isCompleted ? 'text-emerald-400 line-through' : 'text-white'}`}>{expense.description}</span>
                                  {expense.recurringId && <span className="text-xs text-rose-400/60 bg-rose-500/10 px-2 py-0.5 rounded-full">Μηνιαίο</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-700/50 rounded-lg">{expense.category}</span>
                                  {!isCompleted && remainingAmount > 0 && (
                                    <span className="text-xs text-amber-400">Υπόλοιπο: {formatCurrency(remainingAmount)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-right mr-2">
                                <div className={`font-semibold text-lg ${isCompleted ? 'text-emerald-400' : 'text-white'}`}>{formatCurrency(expense.amount)}</div>
                                {paidAmount > 0 && !isCompleted && (
                                  <div className="text-xs text-emerald-400">Πληρώθηκαν: {formatCurrency(paidAmount)}</div>
                                )}
                              </div>
                              {!isCompleted && (
                                <button
                                  onClick={() => setPayingExpense(payingExpense === expense.id ? null : expense.id)}
                                  className="p-2.5 text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-xl transition-all"
                                  title="Προσθήκη πληρωμής"
                                >
                                  <CircleDollarSign size={18} />
                                </button>
                              )}
                              {(expense.payments || []).length > 0 && (
                                <button
                                  onClick={() => setExpandedExpense(isExpanded ? null : expense.id)}
                                  className="p-2.5 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-all"
                                  title="Ιστορικό πληρωμών"
                                >
                                  <History size={18} />
                                </button>
                              )}
                              <button onClick={() => removeExpense(expense.id)} className="p-2.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"><Trash2 size={16} /></button>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          {!isCompleted && expense.amount > 0 && (
                            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          )}

                          {/* Payment Input */}
                          {payingExpense === expense.id && (
                            <div className="mt-4 flex gap-2">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="Ποσό πληρωμής..."
                                value={paymentAmount}
                                onChange={e => setPaymentAmount(e.target.value)}
                                className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none"
                                autoFocus
                              />
                              <button onClick={() => addPartialPayment(expense.id)} className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:shadow-lg hover:shadow-indigo-500/25 transition-all">Καταχώρηση</button>
                              <button onClick={() => { setPayingExpense(null); setPaymentAmount('') }} className="px-3 py-2.5 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-all"><X size={16} /></button>
                            </div>
                          )}
                        </div>

                        {/* Payment History */}
                        {isExpanded && (expense.payments || []).length > 0 && (
                          <div className="px-4 pb-4">
                            <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 overflow-hidden">
                              <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700/50">
                                <span className="text-sm text-slate-400 font-medium">Ιστορικό Πληρωμών</span>
                              </div>
                              <div className="divide-y divide-slate-700/30">
                                {(expense.payments || []).map(payment => (
                                  <div key={payment.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/30 transition-all">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                                        <Check size={14} className="text-emerald-400" />
                                      </div>
                                      <div>
                                        <span className="text-white text-sm">{formatCurrency(payment.amount)}</span>
                                        <span className="text-slate-500 text-xs ml-2">{formatDate(payment.date)}</span>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => removePayment(expense.id, payment.id)}
                                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                                      title="Αναίρεση"
                                    >
                                      <RotateCcw size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {(budget.incomes || []).length === 0 && (budget.expenses || []).length === 0 && (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Wallet size={32} className="text-slate-600" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Κανένα στοιχείο</h3>
                <p className="text-slate-400 mb-6">Ξεκίνα προσθέτοντας έσοδα ή έξοδα για τον {getMonthName(selectedMonth)}</p>
              </div>
            )}

            {/* Recurring Items Info */}
            {(recurringItems.incomes.length > 0 || recurringItems.expenses.length > 0) && (
              <div className="bg-slate-800/30 backdrop-blur border border-slate-700/50 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Repeat size={16} />
                  <span>{recurringItems.incomes.length + recurringItems.expenses.length} επαναλαμβανόμενα στοιχεία ενεργά</span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'installments' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-5 backdrop-blur">
              <div className="text-indigo-400 text-sm mb-2">Συνολικές Οφειλές Δόσεων</div>
              <div className="text-3xl font-bold text-white">{formatCurrency(overallInstDue)}</div>
            </div>

            <button onClick={() => setShowAddInstallment(!showAddInstallment)} className="w-full py-4 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded-2xl flex items-center justify-center gap-2 transition-all font-medium"><Plus size={20} />Νέο Πρόγραμμα Δόσεων</button>

            {showAddInstallment && (
              <div className="bg-slate-800/50 backdrop-blur border border-indigo-500/30 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-indigo-400">Νέο Πρόγραμμα</h3>
                  <button onClick={() => setShowAddInstallment(false)} className="p-1 text-slate-400 hover:text-white"><X size={20} /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input type="text" placeholder="Όνομα" value={newPlan.name} onChange={e => setNewPlan({ ...newPlan, name: e.target.value })} className="bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none transition-all" />
                  <input type="number" step="0.01" placeholder="Ποσό δόσης (€)" value={newPlan.amount} onChange={e => setNewPlan({ ...newPlan, amount: e.target.value })} className="bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none transition-all" />
                  <input type="date" value={newPlan.startDate} onChange={e => setNewPlan({ ...newPlan, startDate: e.target.value })} className="bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-indigo-500/50 focus:outline-none transition-all" />
                  <input type="number" placeholder="Αριθμός δόσεων" value={newPlan.totalInstallments} onChange={e => setNewPlan({ ...newPlan, totalInstallments: e.target.value })} className="bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none transition-all" />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddInstallment(false)} className="px-5 py-2.5 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-all">Ακύρωση</button>
                  <button onClick={addPlan} className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all font-medium">Προσθήκη</button>
                </div>
              </div>
            )}

            {installments.map(plan => {
              const st = getStats(plan); const exp = expandedPlan === plan.id
              return (
                <div key={plan.id} className="bg-slate-800/30 backdrop-blur border border-slate-700/50 rounded-2xl overflow-hidden">
                  <div className="p-5 cursor-pointer hover:bg-slate-800/50 transition-all" onClick={() => setExpandedPlan(exp ? null : plan.id)}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center"><CreditCard className="text-indigo-400" size={22} /></div>
                        <div>
                          <h3 className="font-semibold text-white text-lg">{plan.name}</h3>
                          <p className="text-sm text-slate-400">{formatCurrency(plan.amount)} × {plan.totalInstallments} δόσεις</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm text-slate-400">{st.paid}/{plan.totalInstallments}</div>
                          <div className="text-rose-400 font-semibold">{formatCurrency(st.remaining)}</div>
                        </div>
                        <div className={`p-2 rounded-lg transition-all ${exp ? 'bg-indigo-500/20' : 'bg-slate-700/50'}`}>
                          {exp ? <ChevronUp className="text-indigo-400" size={20} /> : <ChevronDown className="text-slate-400" size={20} />}
                        </div>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${(st.paid / plan.totalInstallments) * 100}%` }} />
                    </div>
                  </div>
                  {exp && (
                    <div className="border-t border-slate-700/50">
                      <div className="p-4 bg-slate-900/30 flex justify-between items-center">
                        <span className="text-sm text-slate-400 font-medium">Αναλυτικά δόσεων</span>
                        <button onClick={e => { e.stopPropagation(); removePlan(plan.id) }} className="text-rose-400 text-sm flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 rounded-lg hover:bg-rose-500/20 transition-all"><Trash2 size={14} />Διαγραφή</button>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {plan.payments.map(pay => (
                          <div key={pay.number} className={`flex items-center justify-between p-4 border-b border-slate-700/30 last:border-0 hover:bg-slate-800/30 transition-all ${pay.paid ? 'bg-emerald-500/5' : ''}`}>
                            <div className="flex items-center gap-4">
                              <button onClick={(e) => { e.stopPropagation(); togglePayment(plan.id, pay.number) }} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${pay.paid ? 'bg-emerald-500 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-indigo-500/20 hover:text-indigo-400'}`}>{pay.paid ? <Check size={18} /> : <span className="text-sm font-medium">{pay.number}</span>}</button>
                              <div>
                                <div className={`font-medium ${pay.paid ? 'text-emerald-400 line-through' : 'text-white'}`}>Δόση {pay.number}</div>
                                <div className="text-xs text-slate-500 flex items-center gap-1"><Calendar size={10} />{formatDate(pay.dueDate)}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`font-medium ${pay.paid ? 'text-emerald-400' : 'text-white'}`}>{formatCurrency(pay.amount)}</div>
                              {pay.paid && pay.paidDate && <div className="text-xs text-emerald-400">✓ {formatDate(pay.paidDate)}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {!installments.length && (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CreditCard size={32} className="text-slate-600" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Κανένα πρόγραμμα δόσεων</h3>
                <p className="text-slate-400">Πρόσθεσε ένα νέο πρόγραμμα για να ξεκινήσεις την παρακολούθηση</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
