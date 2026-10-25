'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'

// ---------------------------------------------------------------------------
// Shared class names
// ---------------------------------------------------------------------------
export const inputCls =
  'w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 outline-none transition focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/15'

export const cardCls = 'bg-white/[0.03] border border-white/[0.07] rounded-3xl'

const tones = {
  primary: 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20',
  income: 'bg-emerald-500 hover:bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/20',
  expense: 'bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/20',
  danger: 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20',
  ghost: 'bg-white/[0.05] hover:bg-white/[0.09] text-slate-200 border border-white/10',
  subtle: 'text-slate-400 hover:text-white hover:bg-white/[0.06]',
}

export function Button({ tone = 'primary', className = '', size = 'md', ...props }) {
  const sizes = { sm: 'px-3 py-2 text-sm rounded-xl', md: 'px-5 py-3 rounded-xl', lg: 'px-5 py-3.5 rounded-2xl text-[15px]' }
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none ${sizes[size]} ${tones[tone]} ${className}`}
    />
  )
}

export function Label({ children, hint }) {
  return (
    <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-medium text-slate-400">
      {children}
      {hint && <span className="text-xs font-normal text-slate-500">{hint}</span>}
    </span>
  )
}

export function Switch({ checked, onChange, label, tone = 'indigo' }) {
  const on = { indigo: 'bg-indigo-500', emerald: 'bg-emerald-500', rose: 'bg-rose-500' }[tone]
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5">
      <span className="text-sm text-slate-200">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? on : 'bg-white/15'}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </label>
  )
}

// ---------------------------------------------------------------------------
// Sheet: bottom sheet σε κινητό, modal σε desktop
// ---------------------------------------------------------------------------
export function Sheet({ open, onClose, title, subtitle, children }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && closeRef.current?.()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-6">
      <div className="absolute inset-0 animate-fade bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative max-h-[92vh] w-full animate-sheet overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#121620] pb-[max(env(safe-area-inset-bottom),1rem)] shadow-2xl md:max-w-lg md:rounded-[28px] md:pb-2"
      >
        <div className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-white/15 md:hidden" />
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold text-white">{title}</h3>
            {subtitle && <div className="mt-0.5 text-sm text-slate-400">{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Κλείσιμο" className="-mr-1 rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <div className="px-5 pb-4">{children}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confirm dialog (Promise-based) — αντικαθιστά το native confirm()
// ---------------------------------------------------------------------------
const ConfirmCtx = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const confirm = useCallback((opts) => new Promise((resolve) => setState({ ...opts, resolve })), [])
  const close = (v) => {
    state?.resolve(v)
    setState(null)
  }
  const actions = state?.actions || [
    { label: state?.confirmLabel || 'Επιβεβαίωση', value: true, tone: state?.tone || 'primary' },
    { label: 'Ακύρωση', value: false, tone: 'ghost' },
  ]

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 md:items-center">
          <div className="absolute inset-0 animate-fade bg-black/70 backdrop-blur-sm" onClick={() => close(false)} />
          <div role="alertdialog" className="relative w-full max-w-sm animate-pop rounded-3xl border border-white/10 bg-[#151a25] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">{state.title}</h3>
            {state.message && <p className="mt-2 text-sm leading-relaxed text-slate-400">{state.message}</p>}
            <div className="mt-6 flex flex-col gap-2">
              {actions.map((a) => (
                <Button key={String(a.value)} tone={a.tone || 'ghost'} onClick={() => close(a.value)} className="w-full">
                  {a.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  )
}
export const useConfirm = () => useContext(ConfirmCtx)

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------
const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const dismiss = useCallback((id) => setItems((l) => l.filter((t) => t.id !== id)), [])
  const push = useCallback(
    (type, message, opts = {}) => {
      const id = Math.random().toString(36).slice(2)
      setItems((l) => [...l.slice(-2), { id, type, message, action: opts.action }])
      setTimeout(() => dismiss(id), opts.duration || (opts.action ? 5000 : 3200))
    },
    [dismiss]
  )
  const api = useRef(null)
  if (!api.current) api.current = {}
  api.current.success = (m, o) => push('success', m, o)
  api.current.error = (m, o) => push('error', m, o)
  api.current.info = (m, o) => push('info', m, o)

  const icons = {
    success: <CheckCircle2 size={18} className="text-emerald-400" />,
    error: <AlertCircle size={18} className="text-rose-400" />,
    info: <Info size={18} className="text-indigo-300" />,
  }

  return (
    <ToastCtx.Provider value={api.current}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm animate-pop items-center gap-3 rounded-2xl border border-white/10 bg-[#1a1f2b]/95 px-4 py-3 text-sm text-slate-100 shadow-2xl backdrop-blur"
          >
            {icons[t.type]}
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action.onClick()
                  dismiss(t.id)
                }}
                className="rounded-lg px-2 py-1 font-semibold text-indigo-300 hover:bg-white/10"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

export function Splash() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500/25 border-t-indigo-500" />
    </div>
  )
}
