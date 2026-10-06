import { useMemo } from 'react'
import { useRecurring, useRecurringValues, useTransactions, type Recurring, type Tx } from './api'
import { useApp } from './ctx'
import { monthStart } from './util'

export interface FixedItem {
  rec: Recurring
  /** lançamento que quitou a conta neste mês, se houver */
  paid: Tx | undefined
  /** valor esperado neste mês: o definido para o mês ou, na falta, o valor/estimativa cadastrado */
  amount: number
  /** conta variável ainda sem valor definido neste mês */
  needsValue: boolean
}

/** Tudo que as telas precisam do mês selecionado, já filtrado por Nosso/Meu. */
export function useMonthData() {
  const { scope, month } = useApp()
  const txQuery = useTransactions(month)
  const recQuery = useRecurring()
  const values = useRecurringValues(month).data

  return useMemo(() => {
    const all = txQuery.data ?? []
    const start = monthStart(month)
    const scoped = all.filter((t) => t.scope === scope)
    const txs = scoped.filter((t) => t.date.slice(0, 7) === month)

    const fixed: FixedItem[] = (recQuery.data ?? [])
      .filter((r) => r.scope === scope && r.start_month <= start)
      .map((rec) => {
        const paid = scoped.find((t) => t.recurring_id === rec.id && t.ref_month === start)
        const value = rec.variable ? values?.find((v) => v.recurring_id === rec.id)?.amount : undefined
        return { rec, paid, amount: value ?? rec.amount, needsValue: rec.variable && value === undefined && !paid }
      })

    const sum = (list: { amount: number }[]) => list.reduce((s, x) => s + x.amount, 0)
    const income = sum(txs.filter((t) => t.kind === 'income'))
    const expense = sum(txs.filter((t) => t.kind === 'expense'))
    const pending = fixed.filter((f) => !f.paid)
    const toPay = sum(pending.filter((f) => f.rec.kind === 'expense'))
    const toReceive = sum(pending.filter((f) => f.rec.kind === 'income'))

    const byCategory = new Map<string, number>()
    for (const t of txs) if (t.kind === 'expense') byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount)

    return {
      loading: txQuery.isLoading || recQuery.isLoading,
      error: txQuery.error ?? recQuery.error,
      txs,
      fixed,
      income,
      expense,
      balance: income - expense,
      toPay,
      toReceive,
      /** quanto sobra se todas as fixas pendentes forem pagas/recebidas */
      forecast: income - expense - toPay + toReceive,
      byCategory,
    }
  }, [txQuery.data, txQuery.isLoading, txQuery.error, recQuery.data, recQuery.isLoading, recQuery.error, values, scope, month])
}
