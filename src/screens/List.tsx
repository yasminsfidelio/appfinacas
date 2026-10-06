import { useState } from 'react'
import type { Tx } from '../lib/api'
import { useMonthData } from '../lib/month'
import { dayLabel, money, type Kind } from '../lib/util'
import { TxRow } from '../components/TxRow'
import { Card, Empty, ErrorNote, Segmented } from '../components/ui'

export function List({ onEdit }: { onEdit: (tx: Tx) => void }) {
  const data = useMonthData()
  const [filter, setFilter] = useState<'all' | Kind>('all')

  const txs = filter === 'all' ? data.txs : data.txs.filter((t) => t.kind === filter)
  const days = new Map<string, Tx[]>()
  for (const tx of txs) days.set(tx.date, [...(days.get(tx.date) ?? []), tx])

  return (
    <div className="space-y-3">
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Tudo' },
          { value: 'expense', label: 'Despesas' },
          { value: 'income', label: 'Receitas' },
        ]}
      />
      <ErrorNote error={data.error} />

      {txs.length === 0 && !data.loading && (
        <Empty emoji="🧾" title="Nenhum lançamento" hint="O que você registrar neste mês aparece aqui." />
      )}

      {[...days.entries()].map(([date, list]) => {
        const total = list.reduce((s, t) => s + (t.kind === 'income' ? t.amount : -t.amount), 0)
        return (
          <Card key={date} className="!py-2">
            <div className="flex items-center justify-between pt-1.5 pb-1 text-xs font-semibold text-muted">
              <span className="capitalize">{dayLabel(date)}</span>
              <span className="tabular">{money(total)}</span>
            </div>
            <div className="divide-y divide-line">
              {list.map((tx) => (
                <TxRow key={tx.id} tx={tx} onClick={() => onEdit(tx)} />
              ))}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
