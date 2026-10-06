import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react'
import { useBudgets, useGoals, type Tx } from '../lib/api'
import { useApp } from '../lib/ctx'
import { useMonthData } from '../lib/month'
import { category, money, monthLabel } from '../lib/util'
import { TxRow } from '../components/TxRow'
import { Card, Empty, ErrorNote, Progress } from '../components/ui'
import type { Tab } from '../App'

export function Home({ onEdit, goTo }: { onEdit: (tx: Tx) => void; goTo: (tab: Tab) => void }) {
  const { scope, month } = useApp()
  const data = useMonthData()
  const budgets = (useBudgets().data ?? []).filter((b) => b.scope === scope)
  const goals = (useGoals().data ?? []).filter((g) => g.scope === scope)

  const pending = data.fixed.filter((f) => !f.paid && f.rec.kind === 'expense')
  const top = [...data.byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const max = top[0]?.[1] ?? 0

  return (
    <div className="space-y-3">
      <ErrorNote error={data.error} />

      <section className="rounded-3xl bg-accent p-5 text-on-accent">
        <p className="text-sm opacity-85">
          {scope === 'shared' ? 'Saldo do casal' : 'Meu saldo'} em {monthLabel(month).toLowerCase()}
        </p>
        <p className="tabular mt-1 text-4xl font-bold tracking-tight">{money(data.balance)}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-black/10 px-3 py-2.5">
            <p className="flex items-center gap-1 text-xs opacity-85">
              <ArrowDownLeft size={14} /> Receitas
            </p>
            <p className="tabular mt-0.5 font-semibold">{money(data.income)}</p>
          </div>
          <div className="rounded-2xl bg-black/10 px-3 py-2.5">
            <p className="flex items-center gap-1 text-xs opacity-85">
              <ArrowUpRight size={14} /> Despesas
            </p>
            <p className="tabular mt-0.5 font-semibold">{money(data.expense)}</p>
          </div>
        </div>
        {(data.toPay > 0 || data.toReceive > 0) && (
          <p className="mt-3 text-sm opacity-90">
            Depois das fixas pendentes sobra <strong className="tabular">{money(data.forecast)}</strong>
          </p>
        )}
      </section>

      {pending.length > 0 && (
        <Card>
          <button onClick={() => goTo('fixed')} className="flex w-full items-center justify-between text-left">
            <span>
              <span className="block font-semibold">
                {pending.length} {pending.length === 1 ? 'conta fixa a pagar' : 'contas fixas a pagar'}
              </span>
              <span className="tabular block text-sm text-muted">{money(data.toPay)} no total</span>
            </span>
            <ChevronRight className="text-muted" size={20} />
          </button>
        </Card>
      )}

      {top.length > 0 && (
        <Card>
          <h3 className="mb-3 font-semibold">Para onde foi o dinheiro</h3>
          <div className="space-y-3">
            {top.map(([key, spent]) => {
              const cat = category(key)
              const limit = budgets.find((b) => b.category === key)?.amount
              const over = limit !== undefined && spent > limit
              return (
                <div key={key}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">
                      {cat.emoji} {cat.label}
                    </span>
                    <span className={`tabular shrink-0 ${over ? 'font-semibold text-bad' : ''}`}>
                      {money(spent)}
                      {limit !== undefined && <span className="text-muted"> / {money(limit)}</span>}
                    </span>
                  </div>
                  <Progress ratio={limit !== undefined ? spent / limit : spent / max} color={over ? 'var(--bad)' : cat.color} />
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {goals.length > 0 && (
        <Card>
          <button onClick={() => goTo('plan')} className="mb-3 flex w-full items-center justify-between">
            <h3 className="font-semibold">Metas</h3>
            <ChevronRight className="text-muted" size={20} />
          </button>
          <div className="space-y-3">
            {goals.slice(0, 3).map((g) => {
              const saved = g.goal_deposits.reduce((s, d) => s + d.amount, 0)
              return (
                <div key={g.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">
                      {g.emoji} {g.name}
                    </span>
                    <span className="tabular shrink-0 text-muted">{Math.round((saved / g.target) * 100)}%</span>
                  </div>
                  <Progress ratio={saved / g.target} />
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-semibold">Últimos lançamentos</h3>
          {data.txs.length > 5 && (
            <button onClick={() => goTo('list')} className="text-sm font-semibold text-accent">
              Ver todos
            </button>
          )}
        </div>
        {data.txs.length === 0 && !data.loading ? (
          <Empty emoji="🧾" title="Nada lançado neste mês" hint="Toque no + para registrar o primeiro gasto ou receita." />
        ) : (
          <div className="divide-y divide-line">
            {data.txs.slice(0, 5).map((tx) => (
              <TxRow key={tx.id} tx={tx} onClick={() => onEdit(tx)} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
