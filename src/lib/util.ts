export type Scope = 'shared' | 'personal'
export type Kind = 'expense' | 'income'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const money = (n: number) => brl.format(n)

// ---------- Datas (sempre strings locais, sem fuso) ----------

const pad = (n: number) => String(n).padStart(2, '0')

/** 'YYYY-MM-DD' de hoje, no fuso do aparelho */
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 'YYYY-MM' */
export const currentMonth = () => today().slice(0, 7)

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export const daysInMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** Dia dentro do mês, limitado ao último dia (ex.: dia 31 em fevereiro vira 28) */
export const dateInMonth = (month: string, day: number) =>
  `${month}-${pad(Math.min(day, daysInMonth(month)))}`

export const monthStart = (month: string) => `${month}-01`
export const monthEnd = (month: string) => dateInMonth(month, 31)

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })
  const name = label.charAt(0).toUpperCase() + label.slice(1)
  return y === new Date().getFullYear() ? name : `${name} ${y}`
}

export function dayLabel(date: string): string {
  if (date === today()) return 'Hoje'
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (dt.toDateString() === yesterday.toDateString()) return 'Ontem'
  return dt.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function shortDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ---------- Categorias ----------

export interface Category {
  key: string
  label: string
  emoji: string
  color: string
}

export const EXPENSE_CATEGORIES: Category[] = [
  { key: 'moradia', label: 'Moradia', emoji: '🏠', color: '#5b8def' },
  { key: 'contas', label: 'Contas', emoji: '💡', color: '#e5a83b' },
  { key: 'mercado', label: 'Mercado', emoji: '🛒', color: '#3fb27f' },
  { key: 'restaurantes', label: 'Restaurantes', emoji: '🍽️', color: '#ef7d57' },
  { key: 'transporte', label: 'Transporte', emoji: '🚗', color: '#6c7ae0' },
  { key: 'saude', label: 'Saúde', emoji: '💊', color: '#e0607e' },
  { key: 'lazer', label: 'Lazer', emoji: '🎉', color: '#b56be0' },
  { key: 'compras', label: 'Compras', emoji: '🛍️', color: '#e07bb5' },
  { key: 'assinaturas', label: 'Assinaturas', emoji: '📺', color: '#4bb3c4' },
  { key: 'educacao', label: 'Educação', emoji: '📚', color: '#8a9a5b' },
  { key: 'pets', label: 'Pets', emoji: '🐾', color: '#b08968' },
  { key: 'outros', label: 'Outros', emoji: '📦', color: '#8b958f' },
]

export const INCOME_CATEGORIES: Category[] = [
  { key: 'salario', label: 'Salário', emoji: '💼', color: '#3fb27f' },
  { key: 'extra', label: 'Renda extra', emoji: '✨', color: '#e5a83b' },
  { key: 'rendimentos', label: 'Rendimentos', emoji: '📈', color: '#5b8def' },
  { key: 'outras-receitas', label: 'Outras', emoji: '💰', color: '#8b958f' },
]

const ALL = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]
const FALLBACK = EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]

export const category = (key: string): Category => ALL.find((c) => c.key === key) ?? FALLBACK
export const categoriesFor = (kind: Kind) => (kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)

// ---------- Parcelas ----------

/** Divide o total em n parcelas; os centavos que sobram vão na primeira. */
export function splitInstallments(total: number, n: number): number[] {
  const cents = Math.round(total * 100)
  const base = Math.floor(cents / n)
  const rest = cents - base * n
  return Array.from({ length: n }, (_, i) => (base + (i === 0 ? rest : 0)) / 100)
}
