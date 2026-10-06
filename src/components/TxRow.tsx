import type { Tx } from '../lib/api'
import { firstName, useApp } from '../lib/ctx'
import { category, money } from '../lib/util'
import { CategoryIcon } from './ui'

export function TxRow({ tx, onClick }: { tx: Tx; onClick: () => void }) {
  const { members, userId } = useApp()
  const cat = category(tx.category)
  const details = [cat.label]
  if (tx.installment_total) details.push(`${tx.installment_no}/${tx.installment_total}`)
  if (tx.recurring_id) details.push('fixa')
  if (tx.scope === 'shared') {
    const who = members.find((m) => m.id === tx.owner_id)
    if (who) details.push(who.id === userId ? 'você' : firstName(who.name))
  }

  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 py-2.5 text-left">
      <CategoryIcon emoji={cat.emoji} color={cat.color} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{tx.description}</span>
        <span className="block truncate text-xs text-muted">{details.join(' · ')}</span>
      </span>
      <span className={`tabular shrink-0 font-semibold ${tx.kind === 'income' ? 'text-good' : ''}`}>
        {tx.kind === 'income' ? '+' : '−'} {money(tx.amount)}
      </span>
    </button>
  )
}
