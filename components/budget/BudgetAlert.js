'use client'

import { AlertTriangle, TrendingUp, ListChecks } from 'lucide-react'
import { categoryColor, currentMonth, fmt, monthAcc, monthOnly } from '../../lib/utils'

/**
 * Ειδοποίηση ταμπλό για την ισορροπία εσόδων / εξόδων του μήνα.
 *
 * Τα `expenses` περιλαμβάνουν ήδη τις δόσεις του μήνα.
 *
 * Επίπεδα:
 *  - danger : τα έξοδα του μήνα (μαζί με τις δόσεις) ξεπερνούν τα έσοδα
 *  - notice : έχουν δεσμευτεί ≥ 90% των εσόδων
 */
export function getBudgetAlert({ month, income, expenses }) {
  if (expenses <= 0) return null
  const isPast = month < currentMonth()

  if (expenses > income) {
    return { level: 'danger', gap: expenses - income, isPast }
  }
  if (income > 0 && expenses / income >= 0.9) {
    return { level: 'notice', ratio: expenses / income, left: income - expenses, isPast }
  }
  return null
}

export default function BudgetAlert({ alert, month, income, expenses, installmentsDue, topCategories, onAddIncome, onReviewExpenses }) {
  if (!alert) return null
  const m = monthAcc(month)

  if (alert.level === 'danger') {
    return (
      <section role="alert" className="relative overflow-hidden rounded-3xl border border-rose-500/30 bg-gradient-to-br from-rose-500/[0.16] to-rose-500/[0.04] p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-rose-500/20 blur-3xl" />
        <div className="relative flex gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/20">
            <AlertTriangle className="text-rose-300" size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-rose-100">
              {alert.isPast ? `Ο ${monthOnly(month)} έκλεισε με έλλειμμα` : 'Τα έξοδα ξεπερνούν τα έσοδα'}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-rose-100/80">
              {income <= 0 ? (
                <>Δεν έχεις καταχωρήσει έσοδα για τον {m}, ενώ τα έξοδα είναι <b className="text-white">{fmt(expenses)}</b>.</>
              ) : (
                <>
                  Τον {m} τα έξοδα ({fmt(expenses)}{installmentsDue > 0 ? `, μαζί με ${fmt(installmentsDue)} δόσεις` : ''}) είναι περισσότερα από τα έσοδα ({fmt(income)}) κατά{' '}
                  <b className="whitespace-nowrap text-white">{fmt(alert.gap)}</b>.
                </>
              )}
              {!alert.isPast && ' Χρειάζεται είτε να βρεις επιπλέον έσοδα είτε να περιορίσεις τα έξοδα του μήνα.'}
            </p>

            {!alert.isPast && topCategories.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-rose-200/60">Μεγαλύτερα εκκρεμή ανά κατηγορία</div>
                <div className="flex flex-wrap gap-1.5">
                  {topCategories.map((c) => (
                    <span key={c.name} className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1 text-xs text-rose-50">
                      <span className="h-2 w-2 rounded-full" style={{ background: categoryColor(c.name) }} />
                      {c.name} · {fmt(c.amount)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!alert.isPast && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={onAddIncome} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50">
                  <TrendingUp size={16} /> Πρόσθεσε έσοδο
                </button>
                <button onClick={onReviewExpenses} className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/15">
                  <ListChecks size={16} /> Δες τα εκκρεμή έξοδα
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section role="status" className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-100/85">
      <AlertTriangle size={18} className="shrink-0 text-amber-300" />
      <span>
        Έχεις δεσμεύσει το <b className="text-white">{Math.round(alert.ratio * 100)}%</b> των εσόδων. Περιθώριο: <b className="text-white">{fmt(alert.left)}</b>.
      </span>
    </section>
  )
}
