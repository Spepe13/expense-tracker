export const MONTHS = ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος']
export const MONTHS_ACC = ['Ιανουάριο', 'Φεβρουάριο', 'Μάρτιο', 'Απρίλιο', 'Μάιο', 'Ιούνιο', 'Ιούλιο', 'Αύγουστο', 'Σεπτέμβριο', 'Οκτώβριο', 'Νοέμβριο', 'Δεκέμβριο']
export const MONTHS_GEN = ['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου']
export const MONTHS_SHORT = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιούν', 'Ιούλ', 'Αύγ', 'Σεπ', 'Οκτ', 'Νοέ', 'Δεκ']

export const CATEGORIES = ['Γενικά', 'Λογαριασμοί', 'Σούπερ Μάρκετ', 'Μεταφορές', 'Ψυχαγωγία', 'Υγεία', 'Εκπαίδευση', 'Ενοίκιο', 'Συνδρομές', 'Άλλο']

export const CATEGORY_COLORS = {
  'Γενικά': '#94a3b8',
  'Λογαριασμοί': '#60a5fa',
  'Σούπερ Μάρκετ': '#34d399',
  'Μεταφορές': '#fbbf24',
  'Ψυχαγωγία': '#f472b6',
  'Υγεία': '#f87171',
  'Εκπαίδευση': '#a78bfa',
  'Ενοίκιο': '#fb923c',
  'Συνδρομές': '#22d3ee',
  'Άλλο': '#cbd5e1',
}
export const categoryColor = (c) => CATEGORY_COLORS[c] || '#94a3b8'

const pad = (n) => String(n).padStart(2, '0')

export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => ymd(new Date())
export const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export const shiftMonth = (monthStr, delta) => {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

const mIdx = (monthStr) => parseInt(monthStr.split('-')[1], 10) - 1
const mYear = (monthStr) => monthStr.split('-')[0]

export const monthName = (m) => `${MONTHS[mIdx(m)]} ${mYear(m)}`
export const monthNameShort = (m) => `${MONTHS_SHORT[mIdx(m)]} ${mYear(m)}`
export const monthAcc = (m) => MONTHS_ACC[mIdx(m)]
export const monthGen = (m) => MONTHS_GEN[mIdx(m)]
export const monthOnly = (m) => MONTHS[mIdx(m)]

export const daysLeftInMonth = () => {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return last - d.getDate()
}

export const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate()

const eur = new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR' })
export const fmt = (a) => eur.format(Number(a) || 0)

export const fmtDate = (d) => {
  if (!d) return '-'
  // 'YYYY-MM-DD' -> τοπική ημερομηνία χωρίς μετατόπιση ζώνης ώρας
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-').map(Number)
    return new Date(y, m - 1, day).toLocaleDateString('el-GR')
  }
  return new Date(d).toLocaleDateString('el-GR')
}

export const fmtDateShort = (d) => {
  if (!d) return '-'
  const [y, m, day] = d.slice(0, 10).split('-').map(Number)
  return `${day} ${MONTHS_SHORT[m - 1]}`
}

// Μοναδικό αριθμητικό id (bigint-safe, < 2^53)
export const newId = () => Date.now() * 1000 + Math.floor(Math.random() * 1000)

// Δέχεται και κόμμα ως υποδιαστολή ("12,50")
export const parseAmount = (v) => {
  const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN
}

export const same = (a, b) => a != null && b != null && String(a) === String(b)

export const sum = (arr, fn = (x) => x) => arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0)
