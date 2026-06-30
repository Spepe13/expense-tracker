'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Check, Calendar, Euro, CreditCard, Wallet, ChevronDown, ChevronUp, Download, Upload, Cloud, CloudOff, RefreshCw, Loader2, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, CircleDollarSign } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ExpenseTracker() {
  const [installments, setInstallments] = useState([])
  const [monthlyBudgets, setMonthlyBudgets] = useState([])
  const [activeTab, setActiveTab] = useState('installments')
  const [showAddInstallment, setShowAddInstallment] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [expandedPlan, setExpandedPlan] = useState(null)
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
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'Γενικά' })
  const [newIncome, setNewIncome] = useState({ description: '', amount: '' })

  const categories = ['Γενικά', 'Λογαριασμοί', 'Σούπερ Μάρκετ', 'Μεταφορές', 'Ψυχαγωγία', 'Υγεία', 'Εκπαίδευση', 'Ενοίκιο', 'Άλλο']
  const isSupabaseConfigured = supabase !== null
  const monthNames = ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος']

  const getMonthName = (monthStr) => {
    const [year, month] = monthStr.split('-')
    return `${monthNames[parseInt(month) - 1]} ${year}`
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

  const loadFromCloud = useCallback(async () => {
    if (!isSupabaseConfigured) return false
    try {
      setIsSyncing(true)
      const { data: instData, error: instErr } = await supabase.from('installments').select('*').order('created_at', { ascending: true })
      if (instErr) throw instErr
      const { data: budgetData, error: budgetErr } = await supabase.from('monthly_budgets').select('*').order('month', { ascending: false })
      if (budgetErr && budgetErr.code !== 'PGRST116') throw budgetErr
      
      if (instData) setInstallments(instData.map(i => ({ id: i.id, name: i.name, amount: i.amount, startDate: i.start_date, totalInstallments: i.total_installments, dayOfMonth: i.day_of_month, payments: i.payments || [] })))
      if (budgetData) setMonthlyBudgets(budgetData.map(b => ({ id: b.id, month: b.month, incomes: b.incomes || [], expenses: b.expenses || [] })))
      
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

  useEffect(() => {
    const init = async () => {
      const loaded = await loadFromCloud()
      if (!loaded) {
        const saved = localStorage.getItem('installments')
        const savedBudgets = localStorage.getItem('monthlyBudgets')
        if (saved) setInstallments(JSON.parse(saved))
        else if (!isSupabaseConfigured) {
          setInstallments([{ id: Date.now(), name: 'Δάνειο', amount: 230.90, startDate: '2026-02-02', totalInstallments: 84, dayOfMonth: 2,
            payments: Array.from({ length: 84 }, (_, i) => ({ number: i + 1, amount: 230.90, dueDate: new Date(2026, 1 + i, 2).toISOString().split('T')[0], paid: false, paidDate: null })) }])
        }
        if (savedBudgets) setMonthlyBudgets(JSON.parse(savedBudgets))
      }
      setIsLoaded(true)
    }
    init()
  }, [loadFromCloud, isSupabaseConfigured])

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

  const formatCurrency = (a) => new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(a)
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('el-GR') : '-'

  // Installment functions
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

  // Budget functions
  const addIncome = async () => {
    if (!newIncome.description || !newIncome.amount) return
    const budget = getCurrentBudget()
    const income = { id: Date.now(), description: newIncome.description, amount: parseFloat(newIncome.amount) }
    const updatedBudget = { id: budget.id || Date.now(), month: selectedMonth, incomes: [...(budget.incomes || []), income], expenses: budget.expenses || [] }
    setMonthlyBudgets(prev => {
      const exists = prev.find(b => b.month === selectedMonth)
      if (exists) return prev.map(b => b.month === selectedMonth ? updatedBudget : b)
      return [...prev, updatedBudget]
    })
    await saveBudget(updatedBudget)
    setNewIncome({ description: '', amount: '' })
    setShowAddIncome(false)
  }

  const addExpense = async () => {
    if (!newExpense.description || !newExpense.amount) return
    const budget = getCurrentBudget()
    const expense = { 
      id: Date.now(), 
      description: newExpense.description, 
      amount: parseFloat(newExpense.amount), 
      paidAmount: 0,
      completed: false,
      category: newExpense.category 
    }
    const updatedBudget = { id: budget.id || Date.now(), month: selectedMonth, incomes: budget.incomes || [], expenses: [...(budget.expenses || []), expense] }
    setMonthlyBudgets(prev => {
      const exists = prev.find(b => b.month === selectedMonth)
      if (exists) return prev.map(b => b.month === selectedMonth ? updatedBudget : b)
      return [...prev, updatedBudget]
    })
    await saveBudget(updatedBudget)
    setNewExpense({ description: '', amount: '', category: 'Γενικά' })
    setShowAddExpense(false)
  }

  const removeIncome = async (incomeId) => {
    const budget = getCurrentBudget()
    const updatedBudget = { ...budget, incomes: budget.incomes.filter(i => i.id !== incomeId) }
    setMonthlyBudgets(prev => prev.map(b => b.month === selectedMonth ? updatedBudget : b))
    await saveBudget(updatedBudget)
  }

  const removeExpense = async (expenseId) => {
    const budget = getCurrentBudget()
    const updatedBudget = { ...budget, expenses: budget.expenses.filter(e => e.id !== expenseId) }
    setMonthlyBudgets(prev => prev.map(b => b.month === selectedMonth ? updatedBudget : b))
    await saveBudget(updatedBudget)
  }

  const completeExpense = async (expenseId) => {
    const budget = getCurrentBudget()
    const updatedBudget = {
      ...budget,
      expenses: budget.expenses.map(e => e.id === expenseId ? { ...e, paidAmount: e.amount, completed: true } : e)
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
          const newPaidAmount = (e.paidAmount || 0) + parseFloat(paymentAmount)
          const isCompleted = newPaidAmount >= e.amount
          return { ...e, paidAmount: Math.min(newPaidAmount, e.amount), completed: isCompleted }
        }
        return e
      })
    }
    setMonthlyBudgets(prev => prev.map(b => b.month === selectedMonth ? updatedBudget : b))
    await saveBudget(updatedBudget)
    setPayingExpense(null)
    setPaymentAmount('')
  }

  const getStats = (p) => ({ paid: p.payments.filter(x => x.paid).length, remaining: p.payments.filter(x => !x.paid).reduce((s, x) => s + x.amount, 0) })
  
  const budget = getCurrentBudget()
  const totalIncome = (budget.incomes || []).reduce((s, i) => s + i.amount, 0)
  const totalExpenses = (budget.expenses || []).reduce((s, e) => s + e.amount, 0)
  const totalPaidExpenses = (budget.expenses || []).reduce((s, e) => s + (e.paidAmount || 0), 0)
  const remaining = totalIncome - totalPaidExpenses

  const overallInstDue = installments.reduce((s, p) => s + p.payments.filter(x => !x.paid).reduce((a, x) => a + x.amount, 0), 0)

  const exportData = () => { const d = { installments, monthlyBudgets, exportDate: new Date().toISOString() }; const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `backup-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(u) }
  
  const importData = async (ev) => { 
    const f = ev.target.files[0]; 
    if (f) { 
      const r = new FileReader(); 
      r.onload = async (e) => { 
        try { 
          const d = JSON.parse(e.target.result); 
          if (d.installments) { setInstallments(d.installments); for (const i of d.installments) await saveInstallment(i) } 
          if (d.monthlyBudgets) { setMonthlyBudgets(d.monthlyBudgets); for (const b of d.monthlyBudgets) await saveBudget(b) }
          alert('Εισαγωγή επιτυχής!') 
        } catch { alert('Σφάλμα αρχείου') } 
      }; 
      r.readAsText(f) 
    } 
  }

  if (!isLoaded) return <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center"><div className="text-white text-xl flex items-center gap-3"><Loader2 className="animate-spin" />Φόρτωση...</div></div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-6 pb-24">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-4xl font-bold text-white mb-2">💰 Διαχείριση Οικονομικών</h1>
          <p className="text-slate-400 text-sm">Παρακολούθησε τις δόσεις και τα έξοδά σου</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            {isSupabaseConfigured ? (
              <>{isSyncing ? <span className="text-blue-400 text-xs flex items-center gap-1"><Loader2 size={12} className="animate-spin" />Συγχρονισμός...</span>
                : isOnline ? <span className="text-green-400 text-xs flex items-center gap-1"><Cloud size={12} />Συνδεδεμένο {lastSync && <span className="text-slate-500">• {lastSync.toLocaleTimeString('el-GR')}</span>}</span>
                : <span className="text-yellow-400 text-xs flex items-center gap-1"><CloudOff size={12} />Offline</span>}
                <button onClick={loadFromCloud} className="text-slate-400 hover:text-white p-1"><RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} /></button></>
            ) : <span className="text-yellow-400 text-xs flex items-center gap-1"><CloudOff size={12} />Cloud sync δεν έχει ρυθμιστεί</span>}
          </div>
        </div>

        <div className="flex justify-end gap-2 mb-4">
          <label className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer text-sm"><Upload size={16} /><span className="hidden sm:inline">Εισαγωγή</span><input type="file" accept=".json" onChange={importData} className="hidden" /></label>
          <button onClick={exportData} className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"><Download size={16} /><span className="hidden sm:inline">Εξαγωγή</span></button>
        </div>

        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab('installments')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium ${activeTab === 'installments' ? 'bg-blue-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'}`}><CreditCard size={20} />Δόσεις</button>
          <button onClick={() => setActiveTab('budget')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium ${activeTab === 'budget' ? 'bg-purple-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'}`}><Wallet size={20} />Μηνιαίος Προϋπολογισμός</button>
        </div>

        {activeTab === 'installments' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-4">
              <div className="text-blue-400 text-sm mb-1">Συνολικές Οφειλές Δόσεων</div>
              <div className="text-2xl md:text-3xl font-bold text-white">{formatCurrency(overallInstDue)}</div>
            </div>

            <button onClick={() => setShowAddInstallment(!showAddInstallment)} className="w-full py-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-xl flex items-center justify-center gap-2"><Plus size={20} />Νέο Πρόγραμμα Δόσεων</button>
            
            {showAddInstallment && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-4">
                <h3 className="text-lg font-semibold text-white">Νέο Πρόγραμμα</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input type="text" placeholder="Όνομα" value={newPlan.name} onChange={e => setNewPlan({ ...newPlan, name: e.target.value })} className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400" />
                  <input type="number" step="0.01" placeholder="Ποσό (€)" value={newPlan.amount} onChange={e => setNewPlan({ ...newPlan, amount: e.target.value })} className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400" />
                  <input type="date" value={newPlan.startDate} onChange={e => setNewPlan({ ...newPlan, startDate: e.target.value })} className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white" />
                  <input type="number" placeholder="Αριθμός δόσεων" value={newPlan.totalInstallments} onChange={e => setNewPlan({ ...newPlan, totalInstallments: e.target.value })} className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400" />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddInstallment(false)} className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg">Ακύρωση</button>
                  <button onClick={addPlan} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Προσθήκη</button>
                </div>
              </div>
            )}

            {installments.map(plan => {
              const st = getStats(plan); const exp = expandedPlan === plan.id
              return (
                <div key={plan.id} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="p-4 cursor-pointer hover:bg-slate-700/30" onClick={() => setExpandedPlan(exp ? null : plan.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center"><CreditCard className="text-blue-400" size={20} /></div><div><h3 className="font-semibold text-white">{plan.name}</h3><p className="text-sm text-slate-400">{formatCurrency(plan.amount)} × {plan.totalInstallments}</p></div></div>
                      <div className="flex items-center gap-3"><div className="text-right"><div className="text-xs text-slate-400">{st.paid}/{plan.totalInstallments}</div><div className="text-red-400 font-medium text-sm">{formatCurrency(st.remaining)}</div></div>{exp ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />}</div>
                    </div>
                    <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500 to-blue-400" style={{ width: `${(st.paid / plan.totalInstallments) * 100}%` }} /></div>
                  </div>
                  {exp && (
                    <div className="border-t border-slate-700">
                      <div className="p-3 bg-slate-900/50 flex justify-between"><span className="text-sm text-slate-400">Δόσεις</span><button onClick={e => { e.stopPropagation(); removePlan(plan.id) }} className="text-red-400 text-sm flex items-center gap-1"><Trash2 size={14} />Διαγραφή</button></div>
                      <div className="max-h-80 overflow-y-auto">
                        {plan.payments.map(pay => (
                          <div key={pay.number} className={`flex items-center justify-between p-3 border-b border-slate-700/50 ${pay.paid ? 'bg-green-900/10' : ''}`}>
                            <div className="flex items-center gap-3">
                              <button onClick={() => togglePayment(plan.id, pay.number)} className={`w-9 h-9 rounded-lg flex items-center justify-center ${pay.paid ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>{pay.paid ? <Check size={16} /> : pay.number}</button>
                              <div><div className={`font-medium text-sm ${pay.paid ? 'text-green-400 line-through' : 'text-white'}`}>Δόση {pay.number}</div><div className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={10} />{formatDate(pay.dueDate)}</div></div>
                            </div>
                            <div className="text-right"><div className={pay.paid ? 'text-green-400' : 'text-white'}>{formatCurrency(pay.amount)}</div>{pay.paid && pay.paidDate && <div className="text-xs text-green-400">✓ {formatDate(pay.paidDate)}</div>}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {!installments.length && <div className="text-center py-12 text-slate-400"><CreditCard size={48} className="mx-auto mb-4 opacity-50" /><p>Δεν υπάρχουν προγράμματα</p></div>}
          </div>
        )}

        {activeTab === 'budget' && (
          <div className="space-y-4">
            {/* Month Selector */}
            <div className="flex items-center justify-center gap-4 bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <button onClick={() => changeMonth(-1)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white"><ChevronLeft size={20} /></button>
              <h2 className="text-xl font-bold text-white min-w-[200px] text-center">{getMonthName(selectedMonth)}</h2>
              <button onClick={() => changeMonth(1)} className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white"><ChevronRight size={20} /></button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
              <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-3">
                <div className="text-green-400 text-xs mb-1 flex items-center gap-1"><TrendingUp size={12} />Έσοδα</div>
                <div className="text-lg md:text-xl font-bold text-white">{formatCurrency(totalIncome)}</div>
              </div>
              <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 rounded-xl p-3">
                <div className="text-red-400 text-xs mb-1 flex items-center gap-1"><TrendingDown size={12} />Έξοδα</div>
                <div className="text-lg md:text-xl font-bold text-white">{formatCurrency(totalExpenses)}</div>
              </div>
              <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-xl p-3">
                <div className="text-orange-400 text-xs mb-1">Πληρωμένα</div>
                <div className="text-lg md:text-xl font-bold text-white">{formatCurrency(totalPaidExpenses)}</div>
              </div>
              <div className={`bg-gradient-to-br ${remaining >= 0 ? 'from-blue-500/20 to-blue-600/10 border-blue-500/30' : 'from-red-500/20 to-red-600/10 border-red-500/30'} border rounded-xl p-3`}>
                <div className={`${remaining >= 0 ? 'text-blue-400' : 'text-red-400'} text-xs mb-1`}>Υπόλοιπο</div>
                <div className="text-lg md:text-xl font-bold text-white">{formatCurrency(remaining)}</div>
              </div>
            </div>

            {/* Add Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { setShowAddIncome(!showAddIncome); setShowAddExpense(false) }} className="py-3 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 rounded-xl flex items-center justify-center gap-2"><Plus size={20} />Έσοδο</button>
              <button onClick={() => { setShowAddExpense(!showAddExpense); setShowAddIncome(false) }} className="py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-xl flex items-center justify-center gap-2"><Plus size={20} />Έξοδο</button>
            </div>

            {/* Add Income Form */}
            {showAddIncome && (
              <div className="bg-slate-800/50 border border-green-500/30 rounded-xl p-4 space-y-4">
                <h3 className="text-lg font-semibold text-green-400">Νέο Έσοδο</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input type="text" placeholder="Περιγραφή (π.χ. Μισθός)" value={newIncome.description} onChange={e => setNewIncome({ ...newIncome, description: e.target.value })} className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400" />
                  <input type="number" step="0.01" placeholder="Ποσό (€)" value={newIncome.amount} onChange={e => setNewIncome({ ...newIncome, amount: e.target.value })} className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400" />
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddIncome(false)} className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg">Ακύρωση</button>
                  <button onClick={addIncome} className="px-4 py-2 bg-green-600 text-white rounded-lg">Προσθήκη</button>
                </div>
              </div>
            )}

            {/* Add Expense Form */}
            {showAddExpense && (
              <div className="bg-slate-800/50 border border-red-500/30 rounded-xl p-4 space-y-4">
                <h3 className="text-lg font-semibold text-red-400">Νέο Έξοδο</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input type="text" placeholder="Περιγραφή" value={newExpense.description} onChange={e => setNewExpense({ ...newExpense, description: e.target.value })} className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400" />
                  <input type="number" step="0.01" placeholder="Ποσό (€)" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })} className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400" />
                  <select value={newExpense.category} onChange={e => setNewExpense({ ...newExpense, category: e.target.value })} className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white md:col-span-2">{categories.map(c => <option key={c}>{c}</option>)}</select>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddExpense(false)} className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg">Ακύρωση</button>
                  <button onClick={addExpense} className="px-4 py-2 bg-red-600 text-white rounded-lg">Προσθήκη</button>
                </div>
              </div>
            )}

            {/* Incomes List */}
            {(budget.incomes || []).length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <div className="p-3 bg-green-900/20 border-b border-slate-700">
                  <h3 className="font-semibold text-green-400 flex items-center gap-2"><TrendingUp size={16} />Έσοδα</h3>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {(budget.incomes || []).map(income => (
                    <div key={income.id} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-green-600/20 rounded-lg flex items-center justify-center"><Euro className="text-green-400" size={16} /></div>
                        <span className="text-white">{income.description}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-400 font-medium">{formatCurrency(income.amount)}</span>
                        <button onClick={() => removeIncome(income.id)} className="p-2 text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expenses List */}
            {(budget.expenses || []).length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <div className="p-3 bg-red-900/20 border-b border-slate-700">
                  <h3 className="font-semibold text-red-400 flex items-center gap-2"><TrendingDown size={16} />Έξοδα</h3>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {(budget.expenses || []).map(expense => {
                    const paidAmount = expense.paidAmount || 0
                    const remainingAmount = expense.amount - paidAmount
                    const progress = (paidAmount / expense.amount) * 100
                    const isCompleted = expense.completed || paidAmount >= expense.amount

                    return (
                      <div key={expense.id} className={`p-3 ${isCompleted ? 'bg-green-900/10' : ''}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => !isCompleted && completeExpense(expense.id)}
                              className={`w-9 h-9 rounded-lg flex items-center justify-center ${isCompleted ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                            >
                              {isCompleted ? <Check size={16} /> : <Euro size={16} />}
                            </button>
                            <div>
                              <span className={`font-medium ${isCompleted ? 'text-green-400 line-through' : 'text-white'}`}>{expense.description}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-400 px-2 py-0.5 bg-slate-700 rounded">{expense.category}</span>
                                {!isCompleted && remainingAmount > 0 && (
                                  <span className="text-xs text-orange-400">Μένουν: {formatCurrency(remainingAmount)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className={`font-medium ${isCompleted ? 'text-green-400' : 'text-white'}`}>{formatCurrency(expense.amount)}</div>
                              {paidAmount > 0 && !isCompleted && (
                                <div className="text-xs text-green-400">Πληρώθηκαν: {formatCurrency(paidAmount)}</div>
                              )}
                            </div>
                            {!isCompleted && (
                              <button 
                                onClick={() => setPayingExpense(payingExpense === expense.id ? null : expense.id)}
                                className="p-2 text-blue-400 hover:text-blue-300 bg-blue-600/20 rounded-lg"
                                title="Προσθήκη πληρωμής"
                              >
                                <CircleDollarSign size={16} />
                              </button>
                            )}
                            <button onClick={() => removeExpense(expense.id)} className="p-2 text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
                          </div>
                        </div>
                        
                        {/* Progress Bar */}
                        {!isCompleted && (
                          <div className="mt-2">
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Payment Input */}
                        {payingExpense === expense.id && (
                          <div className="mt-3 flex gap-2">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Ποσό πληρωμής..."
                              value={paymentAmount}
                              onChange={e => setPaymentAmount(e.target.value)}
                              className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-400"
                              autoFocus
                            />
                            <button 
                              onClick={() => addPartialPayment(expense.id)}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm"
                            >
                              Πληρωμή
                            </button>
                            <button 
                              onClick={() => { setPayingExpense(null); setPaymentAmount('') }}
                              className="px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {(budget.incomes || []).length === 0 && (budget.expenses || []).length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Wallet size={48} className="mx-auto mb-4 opacity-50" />
                <p>Δεν υπάρχουν εγγραφές για τον {getMonthName(selectedMonth)}</p>
                <p className="text-sm mt-2">Πρόσθεσε έσοδα ή έξοδα για να ξεκινήσεις!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
