'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Check, Calendar, Euro, CreditCard, Receipt, ChevronDown, ChevronUp, Edit2, Filter, Download, Upload, Cloud, CloudOff, RefreshCw, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ExpenseTracker() {
  const [installments, setInstallments] = useState([])
  const [expenses, setExpenses] = useState([])
  const [activeTab, setActiveTab] = useState('installments')
  const [showAddInstallment, setShowAddInstallment] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [expandedPlan, setExpandedPlan] = useState(null)
  const [filterPaid, setFilterPaid] = useState('all')
  const [editingExpense, setEditingExpense] = useState(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isOnline, setIsOnline] = useState(false)
  const [lastSync, setLastSync] = useState(null)

  const [newPlan, setNewPlan] = useState({ name: '', amount: '', startDate: '', totalInstallments: '', dayOfMonth: '2' })
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category: 'Γενικά', paid: false })

  const categories = ['Γενικά', 'Λογαριασμοί', 'Τρόφιμα', 'Μεταφορές', 'Ψυχαγωγία', 'Υγεία', 'Εκπαίδευση', 'Άλλο']
  const isSupabaseConfigured = supabase !== null

  const loadFromCloud = useCallback(async () => {
    if (!isSupabaseConfigured) return false
    try {
      setIsSyncing(true)
      const { data: instData, error: instErr } = await supabase.from('installments').select('*').order('created_at', { ascending: true })
      if (instErr) throw instErr
      const { data: expData, error: expErr } = await supabase.from('expenses').select('*').order('date', { ascending: false })
      if (expErr) throw expErr
      if (instData) setInstallments(instData.map(i => ({ id: i.id, name: i.name, amount: i.amount, startDate: i.start_date, totalInstallments: i.total_installments, dayOfMonth: i.day_of_month, payments: i.payments || [] })))
      if (expData) setExpenses(expData)
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
  
  const saveExpense = async (exp) => {
    if (!isSupabaseConfigured) return
    try {
      await supabase.from('expenses').upsert({ id: exp.id, description: exp.description, amount: exp.amount, date: exp.date, category: exp.category, paid: exp.paid, updated_at: new Date().toISOString() })
      setLastSync(new Date()); setIsOnline(true)
    } catch (e) { console.error('Save error:', e); setIsOnline(false) }
  }

  const deleteExpenseCloud = async (id) => { if (isSupabaseConfigured) await supabase.from('expenses').delete().eq('id', id) }

  useEffect(() => {
    const init = async () => {
      const loaded = await loadFromCloud()
      if (!loaded) {
        const saved = localStorage.getItem('installments')
        const savedExp = localStorage.getItem('expenses')
        if (saved) setInstallments(JSON.parse(saved))
        else if (!isSupabaseConfigured) {
          setInstallments([{ id: Date.now(), name: 'Δάνειο', amount: 230.90, startDate: '2026-02-02', totalInstallments: 84, dayOfMonth: 2,
            payments: Array.from({ length: 84 }, (_, i) => ({ number: i + 1, amount: 230.90, dueDate: new Date(2026, 1 + i, 2).toISOString().split('T')[0], paid: false, paidDate: null })) }])
        }
        if (savedExp) setExpenses(JSON.parse(savedExp))
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
    const sub2 = supabase.channel('exp').on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, (p) => {
      if (p.eventType === 'DELETE') setExpenses(prev => prev.filter(e => e.id !== p.old.id))
      else setExpenses(prev => prev.find(e => e.id === p.new.id) ? prev.map(e => e.id === p.new.id ? p.new : e) : [...prev, p.new])
      setLastSync(new Date())
    }).subscribe()
    return () => { sub1.unsubscribe(); sub2.unsubscribe() }
  }, [isSupabaseConfigured])

  useEffect(() => { if (isLoaded) localStorage.setItem('installments', JSON.stringify(installments)) }, [installments, isLoaded])
  useEffect(() => { if (isLoaded) localStorage.setItem('expenses', JSON.stringify(expenses)) }, [expenses, isLoaded])

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('el-GR') : '-'
  const formatCurrency = (a) => new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' }).format(a)

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

  const addExp = async () => {
    if (!newExpense.description || !newExpense.amount) return
    const exp = { id: Date.now(), ...newExpense, amount: parseFloat(newExpense.amount) }
    setExpenses([...expenses, exp])
    await saveExpense(exp)
    setNewExpense({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category: 'Γενικά', paid: false })
    setShowAddExpense(false)
  }

  const toggleExp = async (id) => { const up = expenses.map(e => { if (e.id === id) { const u = { ...e, paid: !e.paid }; saveExpense(u); return u } return e }); setExpenses(up) }
  const removeExp = async (id) => { if (confirm('Διαγραφή;')) { setExpenses(expenses.filter(e => e.id !== id)); await deleteExpenseCloud(id) } }
  const updateExp = async (id, updates) => { const up = expenses.map(e => { if (e.id === id) { const u = { ...e, ...updates }; saveExpense(u); return u } return e }); setExpenses(up); setEditingExpense(null) }

  const getStats = (p) => ({ paid: p.payments.filter(x => x.paid).length, remaining: p.payments.filter(x => !x.paid).reduce((s, x) => s + x.amount, 0) })
  const overall = { totalDue: installments.reduce((s, p) => s + p.payments.filter(x => !x.paid).reduce((a, x) => a + x.amount, 0), 0) + expenses.filter(e => !e.paid).reduce((s, e) => s + e.amount, 0),
    totalPaid: installments.reduce((s, p) => s + p.payments.filter(x => x.paid).reduce((a, x) => a + x.amount, 0), 0) + expenses.filter(e => e.paid).reduce((s, e) => s + e.amount, 0),
    instDue: installments.reduce((s, p) => s + p.payments.filter(x => !x.paid).reduce((a, x) => a + x.amount, 0), 0), expDue: expenses.filter(e => !e.paid).reduce((s, e) => s + e.amount, 0) }

  const filtered = expenses.filter(e => filterPaid === 'paid' ? e.paid : filterPaid === 'unpaid' ? !e.paid : true).sort((a, b) => new Date(b.date) - new Date(a.date))

  const exportData = () => { const d = { installments, expenses, exportDate: new Date().toISOString() }; const b = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `backup-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(u) }
  const importData = async (ev) => { const f = ev.target.files[0]; if (f) { const r = new FileReader(); r.onload = async (e) => { try { const d = JSON.parse(e.target.result); if (d.installments) { setInstallments(d.installments); for (const i of d.installments) await saveInstallment(i) } if (d.expenses) { setExpenses(d.expenses); for (const x of d.expenses) await saveExpense(x) } alert('Εισαγωγή επιτυχής!') } catch { alert('Σφάλμα αρχείου') } }; r.readAsText(f) } }

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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-6">
          <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 rounded-xl p-3"><div className="text-red-400 text-xs mb-1">Οφειλόμενα</div><div className="text-lg md:text-2xl font-bold text-white">{formatCurrency(overall.totalDue)}</div></div>
          <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-3"><div className="text-green-400 text-xs mb-1">Πληρωμένα</div><div className="text-lg md:text-2xl font-bold text-white">{formatCurrency(overall.totalPaid)}</div></div>
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-3"><div className="text-blue-400 text-xs mb-1">Δόσεις</div><div className="text-lg md:text-2xl font-bold text-white">{formatCurrency(overall.instDue)}</div></div>
          <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-3"><div className="text-purple-400 text-xs mb-1">Έξοδα</div><div className="text-lg md:text-2xl font-bold text-white">{formatCurrency(overall.expDue)}</div></div>
        </div>

        <div className="flex justify-end gap-2 mb-4">
          <label className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer text-sm"><Upload size={16} /><span className="hidden sm:inline">Εισαγωγή</span><input type="file" accept=".json" onChange={importData} className="hidden" /></label>
          <button onClick={exportData} className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-sm"><Download size={16} /><span className="hidden sm:inline">Εξαγωγή</span></button>
        </div>

        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab('installments')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium ${activeTab === 'installments' ? 'bg-blue-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'}`}><CreditCard size={20} />Δόσεις</button>
          <button onClick={() => setActiveTab('expenses')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium ${activeTab === 'expenses' ? 'bg-purple-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'}`}><Receipt size={20} />Έξοδα</button>
        </div>

        {activeTab === 'installments' && (
          <div className="space-y-4">
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

        {activeTab === 'expenses' && (
          <div className="space-y-4">
            <button onClick={() => setShowAddExpense(!showAddExpense)} className="w-full py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 rounded-xl flex items-center justify-center gap-2"><Plus size={20} />Νέο Έξοδο</button>
            {showAddExpense && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-4">
                <h3 className="text-lg font-semibold text-white">Νέο Έξοδο</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input type="text" placeholder="Περιγραφή" value={newExpense.description} onChange={e => setNewExpense({ ...newExpense, description: e.target.value })} className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400" />
                  <input type="number" step="0.01" placeholder="Ποσό (€)" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })} className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400" />
                  <input type="date" value={newExpense.date} onChange={e => setNewExpense({ ...newExpense, date: e.target.value })} className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white" />
                  <select value={newExpense.category} onChange={e => setNewExpense({ ...newExpense, category: e.target.value })} className="bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-3 text-white">{categories.map(c => <option key={c}>{c}</option>)}</select>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddExpense(false)} className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg">Ακύρωση</button>
                  <button onClick={addExp} className="px-4 py-2 bg-purple-600 text-white rounded-lg">Προσθήκη</button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2"><Filter size={16} className="text-slate-400" /><select value={filterPaid} onChange={e => setFilterPaid(e.target.value)} className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"><option value="all">Όλα</option><option value="unpaid">Απλήρωτα</option><option value="paid">Πληρωμένα</option></select></div>
            <div className="space-y-2">
              {filtered.map(exp => (
                <div key={exp.id} className={`bg-slate-800/50 border border-slate-700 rounded-xl p-3 ${exp.paid ? 'opacity-60' : ''}`}>
                  {editingExpense === exp.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2"><input type="text" defaultValue={exp.description} id={`d-${exp.id}`} className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" /><input type="number" step="0.01" defaultValue={exp.amount} id={`a-${exp.id}`} className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" /></div>
                      <div className="flex gap-2 justify-end"><button onClick={() => setEditingExpense(null)} className="px-3 py-1 text-sm text-slate-400">Ακύρωση</button><button onClick={() => updateExp(exp.id, { description: document.getElementById(`d-${exp.id}`).value, amount: parseFloat(document.getElementById(`a-${exp.id}`).value) })} className="px-3 py-1 text-sm bg-purple-600 text-white rounded-lg">OK</button></div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <button onClick={() => toggleExp(exp.id)} className={`w-9 h-9 rounded-lg flex items-center justify-center ${exp.paid ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>{exp.paid ? <Check size={16} /> : <Euro size={16} />}</button>
                        <div className="min-w-0"><div className={`font-medium truncate ${exp.paid ? 'text-green-400 line-through' : 'text-white'}`}>{exp.description}</div><div className="text-xs text-slate-400 flex gap-2"><span className="px-2 py-0.5 bg-slate-700 rounded">{exp.category}</span><span>{formatDate(exp.date)}</span></div></div>
                      </div>
                      <div className="flex items-center gap-2"><div className={exp.paid ? 'text-green-400' : 'text-white'}>{formatCurrency(exp.amount)}</div><button onClick={() => setEditingExpense(exp.id)} className="p-2 text-slate-400 hover:text-white"><Edit2 size={14} /></button><button onClick={() => removeExp(exp.id)} className="p-2 text-slate-400 hover:text-red-400"><Trash2 size={14} /></button></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {!filtered.length && <div className="text-center py-12 text-slate-400"><Receipt size={48} className="mx-auto mb-4 opacity-50" /><p>Δεν υπάρχουν έξοδα</p></div>}
          </div>
        )}
      </div>
    </div>
  )
}
